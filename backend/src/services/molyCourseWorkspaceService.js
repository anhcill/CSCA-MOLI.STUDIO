const { CourseApiError } = require("../utils/courseResponses");
const { resolveCorrelationId } = require("../utils/integrationLogger");
const { ensureMolyTrustedDevice, MolyDeviceError } = require("./molyTrustedDeviceService");
const { upsertLearningProgressProjectionTx } = require("./molyCourseCatalogSyncService");
const { createMolyCourseLearningActionsService } = require("./molyCourseLearningActionsService");

const ALLOWED_CLIENT_DELEGATED_SCOPES = Object.freeze([
  "workspace:read",
  "video:play",
  "progress:write",
  "file:view",
  "file:download",
  "quiz:attempt",
  "assignment:submit",
  "notes:rw",
  "bookmarks:rw",
  "qa:rw",
]);

function extractClientIp(req) {
  if (!req) return null;
  const fwd = typeof req.get === "function" ? req.get("x-forwarded-for") : req.headers?.["x-forwarded-for"];
  const raw = fwd ? String(fwd).split(",")[0].trim() : String(req.ip || req.socket?.remoteAddress || "").trim();
  return raw ? raw.replace(/^::ffff:/, "").slice(0, 64) : null;
}

function extractUserAgent(req) {
  if (!req) return "";
  const ua = typeof req.get === "function" ? req.get("user-agent") : req.headers?.["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 1000) : "";
}

function mapUpstreamError(error) {
  if (
    error instanceof CourseApiError &&
    !(error.details && typeof error.details === "object" && error.details.details && typeof error.details.details === "object")
  ) {
    return error;
  }
  if (error instanceof MolyDeviceError) {
    return new CourseApiError(error.status, error.code, error.message, error.details);
  }
  if (error && typeof error.status === "number" && error.code) {
    const rawDetails = error.details && typeof error.details === "object"
      ? (error.details.details && typeof error.details.details === "object" ? error.details.details : error.details)
      : undefined;
    return new CourseApiError(error.status, error.code, error.message, rawDetails);
  }
  return error;
}

function createMolyCourseWorkspaceService({
  db,
  client = null,
  ownership = null,
} = {}) {
  const delegatedSessionCache = new Map();

  async function withTx(work) {
    if (typeof db.transaction === "function") return db.transaction(work);
    if (db.pool && typeof db.pool.connect === "function") {
      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");
        const val = await work(conn);
        await conn.query("COMMIT");
        return val;
      } catch (err) {
        await conn.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        conn.release();
      }
    }
    if (typeof db.connect === "function") {
      const conn = await db.connect();
      try {
        await conn.query("BEGIN");
        const val = await work(conn);
        await conn.query("COMMIT");
        return val;
      } catch (err) {
        await conn.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        if (typeof conn.release === "function") conn.release();
      }
    }
    return work(db);
  }
  async function hasProjectionTables() {
    const res = await db.query(
      `SELECT
         to_regclass('course_profile_projections') IS NOT NULL AS has_profiles,
         to_regclass('course_unit_projections') IS NOT NULL AS has_units,
         to_regclass('course_file_projections') IS NOT NULL AS has_files,
         to_regclass('course_progress_projections') IS NOT NULL AS has_progress`,
    );
    const row = res.rows[0] || {};
    return {
      ready: Boolean(row.has_profiles && row.has_units),
      hasFiles: Boolean(row.has_files),
      hasProgress: Boolean(row.has_progress),
    };
  }

  async function resolveCourse({ courseSlugOrId }) {
    const raw = String(courseSlugOrId || "").trim();
    if (!raw) {
      throw new CourseApiError(400, "INVALID_PARAMETER", "courseSlugOrId is required.");
    }
    const isNumericId = /^\d+$/.test(raw);
    const res = await db.query(
      isNumericId
        ? `SELECT * FROM courses WHERE id = $1::bigint AND tombstoned_at IS NULL LIMIT 1`
        : `SELECT * FROM courses WHERE LOWER(slug) = LOWER($1) AND tombstoned_at IS NULL LIMIT 1`,
      [isNumericId ? Number(raw) : raw],
    );
    const course = res.rows[0] || null;
    if (!course) {
      throw new CourseApiError(404, "COURSE_NOT_FOUND", "Không tìm thấy khóa học.");
    }
    if (course.content_origin !== "csca_course") {
      throw new CourseApiError(400, "UNSUPPORTED_ORIGIN", "Endpoint này chỉ hỗ trợ khóa học đồng bộ từ CSCA-Course.");
    }
    if (course.status !== "published") {
      throw new CourseApiError(404, "COURSE_NOT_FOUND", "Khóa học chưa được xuất bản.");
    }
    return course;
  }

  async function listCourseProfiles(localCourseId) {
    const res = await db.query(
      `SELECT id, source_system, remote_profile_id, external_offering_id, remote_course_id,
              local_course_id, mode,
              COALESCE(NULLIF(badge_label, ''), metadata->>'title') AS title,
              badge_label, allow_file_download, device_limit, enforce_trusted_devices,
              status, last_revision, source_updated_at, metadata
       FROM course_profile_projections
       WHERE local_course_id = $1::bigint
         AND deleted_at IS NULL
         AND status <> 'archived'
       ORDER BY (CASE WHEN mode = 'INDEPENDENT' THEN 0 ELSE 1 END) ASC, id ASC`,
      [Number(localCourseId)],
    );
    return res.rows || [];
  }

  async function resolveProfileProjection({ localCourseId = null, profileId = null }) {
    const rawProfile = profileId != null && String(profileId).trim() ? String(profileId).trim() : null;

    if (localCourseId != null) {
      const profiles = await listCourseProfiles(localCourseId);
      if (!profiles.length) {
        if (rawProfile) {
          const globalRes = await db.query(
            `SELECT id, local_course_id FROM course_profile_projections
             WHERE (remote_profile_id = $1::varchar OR ($2::bigint IS NOT NULL AND id = $2::bigint))
               AND deleted_at IS NULL
             LIMIT 1`,
            [rawProfile, /^\d+$/.test(rawProfile) ? Number(rawProfile) : null],
          );
          if (globalRes.rows[0] && Number(globalRes.rows[0].local_course_id) !== Number(localCourseId)) {
            throw new CourseApiError(
              409,
              "PROFILE_SCOPE_MISMATCH",
              "Profile được chọn không thuộc khóa học hiện tại.",
            );
          }
        }
        throw new CourseApiError(404, "PROFILE_NOT_FOUND", "Khóa học chưa có phiên bản học nào.");
      }

      if (rawProfile) {
        const matched = profiles.find(
          (p) => String(p.remote_profile_id) === rawProfile || String(p.id) === rawProfile,
        );
        if (!matched) {
          const globalRes = await db.query(
            `SELECT id, local_course_id FROM course_profile_projections
             WHERE (remote_profile_id = $1::varchar OR ($2::bigint IS NOT NULL AND id = $2::bigint))
               AND deleted_at IS NULL
             LIMIT 1`,
            [rawProfile, /^\d+$/.test(rawProfile) ? Number(rawProfile) : null],
          );
          if (globalRes.rows[0] && Number(globalRes.rows[0].local_course_id) !== Number(localCourseId)) {
            throw new CourseApiError(
              409,
              "PROFILE_SCOPE_MISMATCH",
              "Profile được chọn không thuộc khóa học hiện tại.",
            );
          }
          throw new CourseApiError(404, "PROFILE_NOT_FOUND", "Không tìm thấy profile học đã chọn.");
        }
        return { profile: matched, allProfiles: profiles };
      }

      // Pick profile that has published units first
      const withUnitsRes = await db.query(
        `SELECT profile_projection_id
         FROM course_unit_projections
         WHERE local_course_id = $1::bigint
           AND deleted_at IS NULL
           AND is_published = TRUE
         GROUP BY profile_projection_id
         ORDER BY COUNT(*) DESC, profile_projection_id ASC
         LIMIT 1`,
        [Number(localCourseId)],
      );
      const preferredId = withUnitsRes.rows[0]?.profile_projection_id
        ? Number(withUnitsRes.rows[0].profile_projection_id)
        : null;
      const defaultProf = (preferredId && profiles.find((p) => Number(p.id) === preferredId)) || profiles[0];
      return { profile: defaultProf, allProfiles: profiles };
    }

    // Lookup without prior localCourseId
    if (!rawProfile) {
      throw new CourseApiError(400, "INVALID_PARAMETER", "profileId is required.");
    }
    const res = await db.query(
      `SELECT id, source_system, remote_profile_id, external_offering_id, remote_course_id,
              local_course_id, mode,
              COALESCE(NULLIF(badge_label, ''), metadata->>'title') AS title,
              badge_label, allow_file_download, device_limit, enforce_trusted_devices,
              status, last_revision, source_updated_at, metadata
       FROM course_profile_projections
       WHERE (remote_profile_id = $1::varchar OR ($2::bigint IS NOT NULL AND id = $2::bigint))
         AND deleted_at IS NULL
         AND status <> 'archived'
       LIMIT 1`,
      [rawProfile, /^\d+$/.test(rawProfile) ? Number(rawProfile) : null],
    );
    const prof = res.rows[0] || null;
    if (!prof) {
      throw new CourseApiError(404, "PROFILE_NOT_FOUND", "Không tìm thấy profile học.");
    }
    const allProfiles = await listCourseProfiles(prof.local_course_id);
    return { profile: prof, allProfiles };
  }

  async function listProfileUnits(profileProjectionId) {
    const res = await db.query(
      `SELECT *
       FROM course_unit_projections
       WHERE profile_projection_id = $1::bigint
         AND deleted_at IS NULL
         AND is_published = TRUE
       ORDER BY section_sort_order ASC, remote_section_id ASC, sort_order ASC, id ASC`,
      [Number(profileProjectionId)],
    );
    return res.rows || [];
  }

  async function resolveUnitProjection({ profileRow, localCourseId, unitKey }) {
    const raw = String(unitKey || "").trim();
    if (!raw) {
      throw new CourseApiError(400, "INVALID_PARAMETER", "unitId is required.");
    }

    const slugMatch = /^u-(\d+)$/i.exec(raw);
    if (slugMatch) {
      const unitProjId = Number(slugMatch[1]);
      const res = await db.query(
        `SELECT * FROM course_unit_projections WHERE id = $1::bigint AND deleted_at IS NULL LIMIT 1`,
        [unitProjId],
      );
      const unitRow = res.rows[0] || null;
      if (!unitRow || unitRow.is_published !== true) {
        throw new CourseApiError(404, "UNIT_NOT_FOUND", "Không tìm thấy bài học.");
      }
      if (localCourseId != null && Number(unitRow.local_course_id) !== Number(localCourseId)) {
        throw new CourseApiError(409, "PROFILE_SCOPE_MISMATCH", "Bài học không thuộc khóa học hiện tại.");
      }
      if (profileRow && Number(unitRow.profile_projection_id) !== Number(profileRow.id)) {
        throw new CourseApiError(409, "PROFILE_SCOPE_MISMATCH", "Bài học không thuộc profile hiện tại.");
      }
      return unitRow;
    }

    const typeIdMatch = /^(lesson|class_session):(\d+)$/i.exec(raw);
    if (typeIdMatch) {
      const unitType = typeIdMatch[1].toLowerCase();
      const remoteUnitId = typeIdMatch[2];
      const res = await db.query(
        `SELECT * FROM course_unit_projections
         WHERE profile_projection_id = $1::bigint
           AND unit_type = $2::varchar
           AND remote_unit_id = $3::varchar
           AND deleted_at IS NULL
           AND is_published = TRUE
         LIMIT 1`,
        [Number(profileRow.id), unitType, remoteUnitId],
      );
      if (res.rows[0]) return res.rows[0];
    }

    const preferredUnitType = String(profileRow.mode || "").toUpperCase() === "MIRROR" ? "class_session" : "lesson";
    const byRemoteRes = await db.query(
      `SELECT * FROM course_unit_projections
       WHERE profile_projection_id = $1::bigint
         AND remote_unit_id = $2::varchar
         AND deleted_at IS NULL
         AND is_published = TRUE
       ORDER BY (CASE WHEN unit_type = $3::varchar THEN 0 ELSE 1 END) ASC, id ASC
       LIMIT 1`,
      [Number(profileRow.id), raw, preferredUnitType],
    );
    if (byRemoteRes.rows[0]) return byRemoteRes.rows[0];

    // Check if the remote unit exists on another profile under the same or another course
    const anywhereRes = await db.query(
      `SELECT id, profile_projection_id, local_course_id
       FROM course_unit_projections
       WHERE remote_unit_id = $1::varchar
         AND deleted_at IS NULL
         AND is_published = TRUE
       LIMIT 1`,
      [raw],
    );
    if (anywhereRes.rows[0]) {
      throw new CourseApiError(409, "PROFILE_SCOPE_MISMATCH", "Bài học không thuộc profile đã chọn.");
    }
    throw new CourseApiError(404, "UNIT_NOT_FOUND", "Không tìm thấy bài học.");
  }

  async function evaluateLiveUserAccess({ user, localCourseId }) {
    // Always derive user identity from verified JWT context; never read user_id/x-device-id from request
    if (!user || !user.id) {
      return { authenticated: false, entitled: false, blockCode: "AUTH_REQUIRED", ownershipInfo: null };
    }
    const uid = Number(user.id);
    if (!Number.isSafeInteger(uid) || uid <= 0) {
      return { authenticated: false, entitled: false, blockCode: "AUTH_REQUIRED", ownershipInfo: null };
    }

    if (ownership && typeof ownership.evaluateCoursesForUser === "function") {
      const map = await ownership.evaluateCoursesForUser(uid, [Number(localCourseId)]);
      const info = map.get(Number(localCourseId)) || null;
      const entitled = Boolean(info?.owned && info?.canLaunchCourse);
      return {
        authenticated: true,
        entitled,
        blockCode: entitled ? null : (info?.blockCode || "ENTITLEMENT_REQUIRED"),
        ownershipInfo: info,
      };
    }

    const entRes = await db.query(
      `SELECT ee.id
       FROM external_entitlements ee
       WHERE ee.user_id = $1::bigint
         AND ee.local_course_id = $2::bigint
         AND ee.status = 'active'
         AND (ee.valid_from IS NULL OR ee.valid_from <= NOW())
         AND (ee.valid_until IS NULL OR ee.valid_until > NOW())
       LIMIT 1`,
      [uid, Number(localCourseId)],
    );
    const entitled = Boolean(entRes.rows[0]);
    return {
      authenticated: true,
      entitled,
      blockCode: entitled ? null : "ENTITLEMENT_REQUIRED",
      ownershipInfo: null,
    };
  }

  function mapProfileSummary(p) {
    const caps = (p.metadata && typeof p.metadata === "object" && p.metadata.capabilities) || {};
    return {
      id: Number(p.id),
      profileProjectionId: Number(p.id),
      remoteProfileId: String(p.remote_profile_id),
      externalOfferingId: String(p.external_offering_id),
      remoteCourseId: String(p.remote_course_id),
      mode: String(p.mode || "MIRROR").replace(/^RECORD_/i, "").toUpperCase(),
      title: p.title || p.badge_label || (p.metadata && p.metadata.title) || null,
      status: p.status || "active",
      capabilities: {
        allowFileDownload: caps.allowFileDownload != null
          ? Boolean(caps.allowFileDownload)
          : p.allow_file_download !== false,
        deviceLimit: Number(caps.deviceLimit ?? p.device_limit ?? 2),
      },
    };
  }

  function formatSidebarUnits(unitRows, courseSlug, remoteProfileId, liveUnits = null, { isPreviewAccess = false } = {}) {
    const liveByKey = new Map();
    if (Array.isArray(liveUnits)) {
      for (const lu of liveUnits) {
        const key = `${lu.unitType || lu.type || "lesson"}:${String(lu.id ?? lu.unitId ?? "")}`;
        liveByKey.set(key, lu);
      }
    }

    return unitRows.map((u, idx) => {
      const live = liveByKey.get(`${u.unit_type}:${String(u.remote_unit_id)}`) || null;
      const projSlug = `u-${u.id}`;
      const href = `/hoc/${courseSlug}/bai-hoc/${projSlug}?profileId=${encodeURIComponent(remoteProfileId)}`;
      const isPublicPreview = Boolean(u.is_public_preview);
      return {
        id: projSlug,
        unitProjectionId: Number(u.id),
        unitKey: `${u.unit_type}:${u.remote_unit_id}`,
        unitType: u.unit_type,
        remoteUnitId: String(u.remote_unit_id),
        sectionId: u.remote_section_id || "sec:default",
        sectionTitle: u.section_title || "Chương 1",
        sectionSortOrder: Number(u.section_sort_order || 0),
        sessionNumber: Number(u.metadata?.sessionNumber || idx + 1),
        title: u.title,
        summary: u.summary || null,
        sortOrder: Number(u.sort_order || 0),
        durationSeconds: Number(u.duration_seconds || 0),
        href,
        isPublished: u.is_published === true,
        isPublicPreview,
        isLocked: live ? Boolean(live.isLocked) : (isPreviewAccess ? !isPublicPreview : false),
        isCompleted: live ? Boolean(live.isCompleted) : false,
        watchedPercent: live ? Number(live.watchedPercent ?? live.progressPercent ?? 0) : 0,
        lockReason: live ? (live.lockReason || null) : (isPreviewAccess && !isPublicPreview ? "Học thử chỉ mở các bài được đánh dấu công khai." : null),
        videoPartCount: Number(u.video_part_count || 0),
        hasTheory: Boolean(u.has_theory),
        vocabCount: Number(u.vocab_count || 0),
        formulaCount: Number(u.formula_count || 0),
        fileCount: Number(u.file_count || 0),
        quizCount: Number(u.quiz_count || 0),
        assignmentCount: Number(u.assignment_count || 0),
      };
    });
  }

  function buildCacheKey(userId, remoteProfileId, deviceTokenHash = null) {
    return `${userId}:${remoteProfileId}:${deviceTokenHash || "none"}`;
  }

  function resolveUserScopes(profileRow) {
    return profileRow.allow_file_download === true
      ? [...ALLOWED_CLIENT_DELEGATED_SCOPES]
      : ALLOWED_CLIENT_DELEGATED_SCOPES.filter((scope) => scope !== "file:download");
  }

  function tryBuildDeviceProofHeader({ deviceCtx, externalUserId }) {
    if (!deviceCtx || typeof deviceCtx.buildProof !== "function") return null;
    try {
      const built = deviceCtx.buildProof({ externalUserId });
      return built?.proofHeader || null;
    } catch (err) {
      if (err instanceof MolyDeviceError && err.code === "DEVICE_PROOF_NOT_CONFIGURED") {
        return null;
      }
      throw err;
    }
  }

  async function ensureDeviceContext({ req = null, res = null, user = null } = {}) {
    if (!req || !user || !user.id) return null;
    if (user.device_limit_locked_at) {
      throw new CourseApiError(
        403,
        "DEVICE_LIMIT_LOCKED",
        "Tài khoản đã bị khóa do vượt quá giới hạn thiết bị tin cậy.",
      );
    }
    try {
      return await ensureMolyTrustedDevice({ req, res, user, db });
    } catch (err) {
      throw mapUpstreamError(err);
    }
  }

  async function mintUserDelegatedSession({
    user,
    profileRow,
    deviceCtx = null,
    req = null,
    correlationId,
  }) {
    if (!client || typeof client.mintDelegatedLearningSession !== "function") {
      throw new CourseApiError(503, "COURSE_CLIENT_UNAVAILABLE", "Dịch vụ học tập liên kết tạm thời không khả dụng.");
    }
    const scopes = resolveUserScopes(profileRow);
    const externalUserId = `moly:${user.id}`;
    const deviceSlotProof = tryBuildDeviceProofHeader({ deviceCtx, externalUserId });
    const clientIp = deviceCtx?.ipAddress || extractClientIp(req);
    const userAgent = deviceCtx?.userAgent || extractUserAgent(req);
    let minted;
    try {
      minted = await client.mintDelegatedLearningSession({
        externalUserId,
        courseId: String(profileRow.remote_course_id),
        profileId: String(profileRow.remote_profile_id),
        scopes,
        ttlSeconds: 240,
        ...(deviceSlotProof ? { deviceSlotProof } : {}),
        ...(clientIp ? { clientIp } : {}),
        ...(userAgent ? { userAgent } : {}),
        correlationId,
      });
    } catch (err) {
      throw mapUpstreamError(err);
    }

    const cacheKey = buildCacheKey(user.id, profileRow.remote_profile_id, deviceCtx?.deviceTokenHash || null);
    const parsedExp = minted?.expiresAt ? Date.parse(minted.expiresAt) : NaN;
    delegatedSessionCache.set(cacheKey, {
      sessionToken: minted.sessionToken,
      sessionId: minted.sessionId || null,
      expiresAtMs: Number.isFinite(parsedExp) ? parsedExp : Date.now() + 220 * 1000,
      scopesKey: scopes.join(","),
    });
    return minted;
  }

  async function getOrMintDelegatedSession({
    user,
    profileRow,
    deviceCtx = null,
    req = null,
    correlationId,
    forceRefresh = false,
  }) {
    const cacheKey = buildCacheKey(user.id, profileRow.remote_profile_id, deviceCtx?.deviceTokenHash || null);
    const scopesKey = resolveUserScopes(profileRow).join(",");
    const cached = !forceRefresh ? delegatedSessionCache.get(cacheKey) : null;
    if (
      cached
      && cached.scopesKey === scopesKey
      && typeof cached.sessionToken === "string"
      && cached.expiresAtMs - Date.now() > 20_000
    ) {
      return { sessionToken: cached.sessionToken, cached: true };
    }
    return mintUserDelegatedSession({ user, profileRow, deviceCtx, req, correlationId });
  }

  async function executeWithDelegatedSession({
    user,
    profileRow,
    deviceCtx = null,
    req = null,
    preferredSessionToken = null,
    correlationId,
  }, operation) {
    let sessionToken = preferredSessionToken && String(preferredSessionToken).trim()
      ? String(preferredSessionToken).trim()
      : null;
    if (!sessionToken) {
      const minted = await getOrMintDelegatedSession({
        user,
        profileRow,
        deviceCtx,
        req,
        correlationId,
      });
      sessionToken = minted.sessionToken;
    }

    try {
      return await operation(sessionToken);
    } catch (err) {
      const code = String(err?.code || err?.errorCode || "").toUpperCase();
      const shouldRetry = err?.status === 401
        || code === "DELEGATED_SESSION_EXPIRED"
        || code === "INVALID_DELEGATED_SESSION"
        || code === "DELEGATED_SESSION_REVOKED";
      if (!shouldRetry) {
        throw mapUpstreamError(err);
      }
      const cacheKey = buildCacheKey(user.id, profileRow.remote_profile_id, deviceCtx?.deviceTokenHash || null);
      delegatedSessionCache.delete(cacheKey);
      const refreshed = await getOrMintDelegatedSession({
        user,
        profileRow,
        deviceCtx,
        req,
        correlationId,
        forceRefresh: true,
      });
      try {
        return await operation(refreshed.sessionToken);
      } catch (retryErr) {
        throw mapUpstreamError(retryErr);
      }
    }
  }

  async function getExternalCourseWorkspace({
    courseSlugOrId,
    profileId = null,
    unitId = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const caps = await hasProjectionTables();
    if (!caps.ready) {
      throw new CourseApiError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Bảng dữ liệu khóa học liên kết chưa sẵn sàng.");
    }

    const courseRow = await resolveCourse({ courseSlugOrId });
    const { profile: profileRow, allProfiles } = await resolveProfileProjection({
      localCourseId: courseRow.id,
      profileId,
    });
    const unitRows = await listProfileUnits(profileRow.id);

    let requestedUnit = null;
    if (unitId != null && String(unitId).trim()) {
      requestedUnit = await resolveUnitProjection({
        profileRow,
        localCourseId: courseRow.id,
        unitKey: unitId,
      });
    } else if (unitRows.length > 0) {
      requestedUnit = unitRows[0];
    }

    const access = await evaluateLiveUserAccess({ user, localCourseId: courseRow.id });
    const remoteProfileId = String(profileRow.remote_profile_id);
    const mappedProfiles = allProfiles.map(mapProfileSummary);
    const activeProfileSummary = mapProfileSummary(profileRow);

    if (access.entitled) {
      const deviceCtx = await ensureDeviceContext({ req, res, user });
      const minted = await mintUserDelegatedSession({
        user,
        profileRow,
        deviceCtx,
        req,
        correlationId: corr,
      });
      let liveWs;
      try {
        liveWs = await client.fetchDelegatedWorkspace({
          sessionToken: minted.sessionToken,
          profileId: remoteProfileId,
          unitId: requestedUnit ? String(requestedUnit.remote_unit_id) : undefined,
          correlationId: corr,
        });
      } catch (err) {
        throw mapUpstreamError(err);
      }

      const sidebarUnits = formatSidebarUnits(unitRows, courseRow.slug, remoteProfileId, liveWs?.units || null);
      const activeRemoteId = liveWs?.activeUnit?.id != null
        ? String(liveWs.activeUnit.id)
        : (requestedUnit ? String(requestedUnit.remote_unit_id) : null);
      const activeProjUnit = sidebarUnits.find((u) => u.remoteUnitId === activeRemoteId) || sidebarUnits[0] || null;

      const normalizedLiveMode = String(
        liveWs?.profile?.mode || liveWs?.mode || activeProfileSummary.mode,
      ).replace(/^RECORD_/i, "").toUpperCase();
      const liveCapabilities = liveWs?.capabilities || liveWs?.profile?.capabilities || activeProfileSummary.capabilities;
      const derivedSelectedLock = liveWs?.selectedUnitLock
        || (liveWs?.activeUnit?.isLocked
          ? {
              locked: true,
              code: "UNIT_LOCKED",
              reason: liveWs.activeUnit.lockReason || "Bài học đang bị khóa theo tiến độ tuần tự.",
              requiredPrevUnitTitle: liveWs.activeUnit.requiredPrevUnitTitle || null,
            }
          : null);

      return {
        course: {
          id: Number(courseRow.id),
          slug: courseRow.slug,
          title: courseRow.title,
          shortDescription: courseRow.short_description || "",
          thumbnailUrl: courseRow.thumbnail_url || null,
          contentOrigin: courseRow.content_origin,
          remoteCourseId: String(profileRow.remote_course_id),
          ssoTargetPath: access.ownershipInfo?.ssoTargetPath || `/video-courses/${profileRow.external_offering_id}`,
        },
        profile: {
          ...activeProfileSummary,
          mode: normalizedLiveMode,
          capabilities: liveCapabilities,
        },
        profiles: mappedProfiles,
        sourceClass: liveWs?.sourceClass || null,
        progress: liveWs?.progress || null,
        isPublicPreviewAccess: false,
        delegatedSession: {
          expiresAt: minted.expiresAt,
          ttlSeconds: minted.ttlSeconds,
          scopes: minted.scopes,
        },
        units: sidebarUnits,
        activeUnit: liveWs?.activeUnit
          ? {
              ...liveWs.activeUnit,
              unitProjectionId: activeProjUnit ? activeProjUnit.unitProjectionId : null,
              projectionSlug: activeProjUnit ? activeProjUnit.id : null,
            }
          : null,
        selectedUnitLock: derivedSelectedLock,
      };
    }

    // Unentitled or unauthenticated: allow ONLY if requested unit is explicitly marked published & public preview
    const previewCandidate = requestedUnit && requestedUnit.is_published === true && requestedUnit.is_public_preview === true
      ? requestedUnit
      : (!unitId ? unitRows.find((u) => u.is_published === true && u.is_public_preview === true) || null : null);

    if (!previewCandidate) {
      if (!access.authenticated) {
        throw new CourseApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để truy cập phòng học.");
      }
      throw new CourseApiError(
        403,
        access.blockCode || "ENTITLEMENT_REQUIRED",
        "Tài khoản hiện không có quyền truy cập nội dung này.",
      );
    }

    if (!client || typeof client.fetchPublicPreviewUnit !== "function") {
      throw new CourseApiError(503, "COURSE_CLIENT_UNAVAILABLE", "Dịch vụ học thử tạm thời không khả dụng.");
    }

    const previewData = await client.fetchPublicPreviewUnit({
      profileId: remoteProfileId,
      unitId: String(previewCandidate.remote_unit_id),
      correlationId: corr,
    });
    const previewUnits = Array.isArray(previewData?.units) ? previewData.units : null;
    const previewActiveUnit = previewData?.activeUnit || previewData || null;
    const sidebarUnits = formatSidebarUnits(unitRows, courseRow.slug, remoteProfileId, previewUnits, { isPreviewAccess: true });

    return {
      course: {
        id: Number(courseRow.id),
        slug: courseRow.slug,
        title: courseRow.title,
        shortDescription: courseRow.short_description || "",
        thumbnailUrl: courseRow.thumbnail_url || null,
        contentOrigin: courseRow.content_origin,
        remoteCourseId: String(profileRow.remote_course_id),
        ssoTargetPath: `/video-courses/${profileRow.external_offering_id}`,
      },
      profile: {
        ...activeProfileSummary,
        capabilities: {
          ...(previewData?.capabilities || activeProfileSummary.capabilities),
          allowFileDownload: false,
          isPublicPreviewAccess: true,
        },
      },
      profiles: mappedProfiles,
      sourceClass: null,
      progress: previewData?.progress || null,
      isPublicPreviewAccess: true,
      delegatedSession: null,
      units: sidebarUnits,
      activeUnit: previewActiveUnit
        ? {
            ...previewActiveUnit,
            unitProjectionId: Number(previewCandidate.id),
            projectionSlug: `u-${previewCandidate.id}`,
          }
        : null,
      selectedUnitLock: null,
    };
  }

  async function enrichUnitDetailFromProjections({
    detail,
    unitRow,
    profileRow,
    userId = null,
    isPublicPreview = false,
  }) {
    const unit = detail && typeof detail === "object" ? detail : {};
    const profileAllowDownload = profileRow.allow_file_download !== false;

    const fileRowsRes = await db.query(
      `SELECT *
       FROM course_file_projections
       WHERE unit_projection_id = $1::bigint
         AND deleted_at IS NULL
         AND is_published = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [Number(unitRow.id)],
    ).catch(() => ({ rows: [] }));
    const fileRows = fileRowsRes.rows || [];
    const fileMap = new Map(fileRows.map((r) => [String(r.remote_file_id), r]));

    const files = Array.isArray(unit.files)
      ? unit.files.map((f) => {
          const fId = String(f?.id ?? f?.fileId ?? f?.remoteFileId ?? "");
          const proj = fileMap.get(fId) || null;
          const allowDownload = f?.allowDownload !== undefined
            ? Boolean(f.allowDownload)
            : (proj?.allow_download_override != null ? Boolean(proj.allow_download_override) : profileAllowDownload);
          return {
            ...f,
            isSlide: Boolean(f?.isSlide ?? proj?.is_slide ?? false),
            revision: Number(f?.revision ?? proj?.last_revision ?? 1),
            updatedAt: f?.updatedAt || (proj?.source_updated_at ? new Date(proj.source_updated_at).toISOString() : null),
            allowDownload: isPublicPreview ? false : allowDownload,
            ...(Array.isArray(f?.placements)
              ? {}
              : (Array.isArray(proj?.placements_json) ? { placements: proj.placements_json } : {})),
          };
        })
      : fileRows.map((r) => ({
          id: r.remote_file_id,
          fileId: r.remote_file_id,
          title: r.title,
          fileName: r.original_filename || r.title,
          originalFilename: r.original_filename || null,
          mimeType: r.mime_type || null,
          fileKind: r.file_kind || "document",
          sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
          isSlide: Boolean(r.is_slide),
          allowView: r.allow_view_override != null ? Boolean(r.allow_view_override) : true,
          allowDownload: isPublicPreview
            ? false
            : (r.allow_download_override != null ? Boolean(r.allow_download_override) : profileAllowDownload),
          placements: Array.isArray(r.placements_json) ? r.placements_json : [],
          revision: Number(r.last_revision || 1),
          updatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
        }));

    let noteRows = [];
    if (userId) {
      const noteRes = await db.query(
        `SELECT *
         FROM course_note_projections
         WHERE user_id = $1::int
           AND profile_projection_id = $2::bigint
           AND unit_type = $3::varchar
           AND remote_unit_id = $4::varchar
           AND deleted_at IS NULL
         ORDER BY timestamp_seconds ASC, id ASC`,
        [Number(userId), Number(profileRow.id), unitRow.unit_type, String(unitRow.remote_unit_id)],
      ).catch(() => ({ rows: [] }));
      noteRows = noteRes.rows || [];
    }
    const noteMap = new Map(noteRows.map((r) => [String(r.remote_note_id), r]));
    const notes = Array.isArray(unit.notes)
      ? unit.notes.map((n) => {
          const nId = String(n?.id ?? n?.noteId ?? "");
          const proj = noteMap.get(nId) || null;
          return {
            ...n,
            revision: Number(n?.revision ?? proj?.last_revision ?? 1),
            updatedAt: n?.updatedAt || (proj?.source_updated_at ? new Date(proj.source_updated_at).toISOString() : null),
          };
        })
      : noteRows.map((r) => ({
          id: r.remote_note_id,
          noteId: r.remote_note_id,
          timestampSeconds: Number(r.timestamp_seconds || 0),
          content: r.content,
          revision: Number(r.last_revision || 1),
          updatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
        }));

    let bookmarks = Array.isArray(unit.bookmarks) ? unit.bookmarks : null;
    if (!bookmarks) {
      if (userId) {
        const bmRes = await db.query(
          `SELECT *
           FROM course_bookmark_projections
           WHERE user_id = $1::int
             AND profile_projection_id = $2::bigint
             AND unit_type = $3::varchar
             AND remote_unit_id = $4::varchar
             AND deleted_at IS NULL
           ORDER BY timestamp_seconds ASC, id ASC`,
          [Number(userId), Number(profileRow.id), unitRow.unit_type, String(unitRow.remote_unit_id)],
        ).catch(() => ({ rows: [] }));
        bookmarks = (bmRes.rows || []).map((r) => ({
          id: r.remote_bookmark_id,
          bookmarkId: r.remote_bookmark_id,
          videoAssetId: r.video_asset_id || null,
          timestampSeconds: Number(r.timestamp_seconds || 0),
          label: r.label || "",
          revision: Number(r.last_revision || 1),
          updatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
        }));
      } else {
        bookmarks = [];
      }
    }

    let qaThreads = Array.isArray(unit.qaThreads) ? unit.qaThreads : null;
    if (!qaThreads) {
      const qaRes = await db.query(
        `SELECT *
         FROM course_qa_thread_projections
         WHERE profile_projection_id = $1::bigint
           AND unit_type = $2::varchar
           AND remote_unit_id = $3::varchar
           AND deleted_at IS NULL
         ORDER BY is_pinned DESC, last_message_at DESC NULLS LAST, id DESC`,
        [Number(profileRow.id), unitRow.unit_type, String(unitRow.remote_unit_id)],
      ).catch(() => ({ rows: [] }));
      qaThreads = (qaRes.rows || []).map((r) => ({
        id: r.remote_thread_id,
        threadId: r.remote_thread_id,
        authorExternalUserId: r.author_external_user_id || null,
        authorName: r.author_name || null,
        authorRole: r.author_role || null,
        title: r.title,
        status: r.status,
        isPinned: Boolean(r.is_pinned),
        messageCount: Number(r.message_count || 0),
        messages: Array.isArray(r.messages_json) ? r.messages_json : [],
        unread: Boolean(r.unread),
        lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
        revision: Number(r.last_revision || 1),
        updatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
      }));
    }

    return {
      ...unit,
      files,
      notes,
      bookmarks,
      qaThreads,
    };
  }

  async function getExternalUnitDetail({
    profileId,
    unitId,
    courseSlugOrId = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const caps = await hasProjectionTables();
    if (!caps.ready) {
      throw new CourseApiError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Bảng dữ liệu khóa học liên kết chưa sẵn sàng.");
    }

    let resolvedCourse = null;
    if (courseSlugOrId) {
      resolvedCourse = await resolveCourse({ courseSlugOrId });
    }
    const { profile: profileRow } = await resolveProfileProjection({
      localCourseId: resolvedCourse?.id || null,
      profileId,
    });
    const unitRow = await resolveUnitProjection({
      profileRow,
      localCourseId: profileRow.local_course_id,
      unitKey: unitId,
    });

    const access = await evaluateLiveUserAccess({
      user,
      localCourseId: profileRow.local_course_id,
    });
    const remoteProfileId = String(profileRow.remote_profile_id);

    if (access.entitled) {
      const deviceCtx = await ensureDeviceContext({ req, res, user });
      const minted = await mintUserDelegatedSession({
        user,
        profileRow,
        deviceCtx,
        req,
        correlationId: corr,
      });
      let detail;
      try {
        detail = await client.fetchDelegatedUnit({
          sessionToken: minted.sessionToken,
          profileId: remoteProfileId,
          unitId: String(unitRow.remote_unit_id),
          correlationId: corr,
        });
      } catch (err) {
        throw mapUpstreamError(err);
      }
      const enriched = await enrichUnitDetailFromProjections({
        detail,
        unitRow,
        profileRow,
        userId: Number(user.id),
        isPublicPreview: false,
      });
      return {
        ...enriched,
        unitProjectionId: Number(unitRow.id),
        projectionSlug: `u-${unitRow.id}`,
        isPublicPreviewAccess: false,
      };
    }

    if (unitRow.is_public_preview === true && unitRow.is_published === true) {
      if (!client || typeof client.fetchPublicPreviewUnit !== "function") {
        throw new CourseApiError(503, "COURSE_CLIENT_UNAVAILABLE", "Dịch vụ học thử tạm thời không khả dụng.");
      }
      let previewData;
      try {
        previewData = await client.fetchPublicPreviewUnit({
          profileId: remoteProfileId,
          unitId: String(unitRow.remote_unit_id),
          correlationId: corr,
        });
      } catch (err) {
        throw mapUpstreamError(err);
      }
      const previewActiveUnit = previewData?.activeUnit || previewData || {};
      const enrichedPreview = await enrichUnitDetailFromProjections({
        detail: previewActiveUnit,
        unitRow,
        profileRow,
        userId: null,
        isPublicPreview: true,
      });
      return {
        ...enrichedPreview,
        unitProjectionId: Number(unitRow.id),
        projectionSlug: `u-${unitRow.id}`,
        isPublicPreviewAccess: true,
      };
    }

    if (!access.authenticated) {
      throw new CourseApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để mở bài học này.");
    }
    throw new CourseApiError(
      403,
      access.blockCode || "ENTITLEMENT_REQUIRED",
      "Bạn không có quyền truy cập bài học này.",
    );
  }

  async function resolveEntitledVideoContext({
    profileId,
    unitId,
    videoId,
    user = null,
    req = null,
    res = null,
  }) {
    const cleanVideoId = String(videoId || "").trim();
    if (!cleanVideoId) {
      throw new CourseApiError(400, "INVALID_PARAMETER", "videoId is required.");
    }
    const caps = await hasProjectionTables();
    if (!caps.ready) {
      throw new CourseApiError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Bảng dữ liệu khóa học liên kết chưa sẵn sàng.");
    }
    const { profile: profileRow } = await resolveProfileProjection({
      localCourseId: null,
      profileId,
    });
    const unitRow = await resolveUnitProjection({
      profileRow,
      localCourseId: profileRow.local_course_id,
      unitKey: unitId,
    });
    const access = await evaluateLiveUserAccess({
      user,
      localCourseId: profileRow.local_course_id,
    });
    if (!access.authenticated) {
      throw new CourseApiError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để tiếp tục.");
    }
    if (!access.entitled) {
      throw new CourseApiError(
        403,
        access.blockCode || "ENTITLEMENT_REQUIRED",
        "Bạn không có quyền truy cập nội dung học này.",
      );
    }
    const deviceCtx = await ensureDeviceContext({ req, res, user });
    return {
      cleanVideoId,
      profileRow,
      unitRow,
      deviceCtx,
      externalUserId: `moly:${user.id}`,
    };
  }

  async function getExternalVideoPlaybackToken({
    profileId,
    unitId,
    videoId,
    ttlSeconds = 60,
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    if (!client || typeof client.requestDelegatedPlaybackToken !== "function") {
      throw new CourseApiError(503, "COURSE_CLIENT_UNAVAILABLE", "Dịch vụ phát video liên kết tạm thời không khả dụng.");
    }
    const {
      cleanVideoId,
      profileRow,
      unitRow,
      deviceCtx,
      externalUserId,
    } = await resolveEntitledVideoContext({
      profileId,
      unitId,
      videoId,
      user,
      req,
      res,
    });
    const clampedTtl = Math.max(15, Math.min(60, Math.floor(Number(ttlSeconds) || 60)));
    const deviceSlotProof = tryBuildDeviceProofHeader({ deviceCtx, externalUserId });
    const clientIp = deviceCtx?.ipAddress || extractClientIp(req);
    const userAgent = deviceCtx?.userAgent || extractUserAgent(req);

    const tokenData = await executeWithDelegatedSession({
      user,
      profileRow,
      deviceCtx,
      req,
      preferredSessionToken: delegatedSessionToken,
      correlationId: corr,
    }, (sessionToken) => client.requestDelegatedPlaybackToken({
      sessionToken,
      videoId: cleanVideoId,
      unitId: String(unitRow.remote_unit_id),
      profileId: String(profileRow.remote_profile_id),
      ttlSeconds: clampedTtl,
      ...(deviceSlotProof ? { deviceSlotProof } : {}),
      ...(clientIp ? { clientIp } : {}),
      ...(userAgent ? { userAgent } : {}),
      correlationId: corr,
    }));

    return {
      ...tokenData,
      unitProjectionId: Number(unitRow.id),
      projectionSlug: `u-${unitRow.id}`,
    };
  }

  async function updateExternalVideoProgress({
    profileId,
    unitId,
    videoId,
    payload = {},
    delegatedSessionToken = null,
    user = null,
    req = null,
    res = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    if (!client || typeof client.sendDelegatedVideoProgress !== "function") {
      throw new CourseApiError(503, "COURSE_CLIENT_UNAVAILABLE", "Dịch vụ đồng bộ tiến độ liên kết tạm thời không khả dụng.");
    }
    const {
      cleanVideoId,
      profileRow,
      unitRow,
      deviceCtx,
    } = await resolveEntitledVideoContext({
      profileId,
      unitId,
      videoId,
      user,
      req,
      res,
    });

    const body = payload && typeof payload === "object" ? payload : {};
    const progressResult = await executeWithDelegatedSession({
      user,
      profileRow,
      deviceCtx,
      req,
      preferredSessionToken: delegatedSessionToken,
      correlationId: corr,
    }, (sessionToken) => client.sendDelegatedVideoProgress({
      sessionToken,
      videoId: cleanVideoId,
      unitId: String(unitRow.remote_unit_id),
      profileId: String(profileRow.remote_profile_id),
      currentTimeSeconds: Number(body.currentTimeSeconds ?? body.lastPositionSeconds ?? 0),
      watchedDeltaSeconds: Number(body.watchedDeltaSeconds ?? 0),
      durationSeconds: body.durationSeconds != null ? Number(body.durationSeconds) : null,
      clientSequence: body.clientSequence != null ? Number(body.clientSequence) : null,
      eventTimestamp: body.eventTimestamp || null,
      correlationId: corr,
    }));

    if (progressResult && !progressResult.stale) {
      const unitsList = Array.isArray(progressResult.units) ? progressResult.units : [];
      const currentUnitIdx = unitsList.findIndex(
        (u) => String(u.id) === String(progressResult.unitId || unitRow.remote_unit_id)
          && (!u.unitType || String(u.unitType) === String(progressResult.unitType || unitRow.unit_type)),
      );
      const nextUnit = currentUnitIdx >= 0 && currentUnitIdx + 1 < unitsList.length
        ? unitsList[currentUnitIdx + 1]
        : null;
      const unlockedNextUnitId = Boolean(progressResult.isUnitCompleted) && nextUnit && !nextUnit.isLocked
        ? String(nextUnit.id)
        : null;

      await withTx((txClient) => upsertLearningProgressProjectionTx(txClient, {
        userId: Number(user.id),
        profileProjectionId: Number(profileRow.id),
        localCourseId: Number(profileRow.local_course_id),
        unitType: progressResult.unitType || unitRow.unit_type,
        remoteUnitId: String(progressResult.unitId || unitRow.remote_unit_id),
        watchedSeconds: Math.round(Number(
          progressResult.unitProgress?.watchedSeconds
          ?? progressResult.watchedSeconds
          ?? 0,
        )),
        lastPositionSeconds: Math.round(Number(progressResult.lastPositionSeconds || 0)),
        completionPct: Number(
          progressResult.unitProgress?.completionPercent
          ?? progressResult.completionPercent
          ?? 0,
        ),
        isVideoCompleted: Boolean(
          progressResult.unitProgress?.isCompleted
          ?? progressResult.isVideoCompleted,
        ),
        isQuizCompleted: Boolean(progressResult.isQuizCompleted),
        isUnitCompleted: Boolean(progressResult.isUnitCompleted),
        isUnlocked: true,
        courseCompletionPct: progressResult.courseProgress?.overallPercent ?? null,
        lastUnitId: String(progressResult.unitId || unitRow.remote_unit_id),
        syncRevision: Number(progressResult.syncRevision || 1),
        sourceUpdatedAt: progressResult.lastHeartbeatAt || new Date().toISOString(),
        unlockedNextUnitId,
        nextUnitType: nextUnit ? nextUnit.unitType : null,
      }));
    }

    return {
      ...progressResult,
      unitProjectionId: Number(unitRow.id),
      projectionSlug: `u-${unitRow.id}`,
    };
  }

  const learningActions = createMolyCourseLearningActionsService({
    db,
    client,
    withTx,
    hasProjectionTables,
    resolveProfileProjection,
    resolveUnitProjection,
    listProfileUnits,
    evaluateLiveUserAccess,
    ensureDeviceContext,
    executeWithDelegatedSession,
    mapUpstreamError,
  });

  return {
    getExternalCourseWorkspace,
    getExternalUnitDetail,
    getExternalVideoPlaybackToken,
    updateExternalVideoProgress,
    ...learningActions,
  };
}

module.exports = {
  createMolyCourseWorkspaceService,
};
