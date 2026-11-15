const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const { SUBJECT_CODES } = require("../utils/courseContract");
const {
  createIntegrationLogger,
  isCatalogSyncKillSwitchActive,
  observeMetricLatency,
  recordMetric,
  resolveCorrelationId,
} = require("../utils/integrationLogger");

const SOURCE_SYSTEM = "csca-course";
const CATALOG_STREAM_NAME = "catalog_courses";
const VALID_LEVELS = new Set(["basic", "intermediate", "advanced"]);
const MAX_BACKFILL_PAGES = 500;

class MolyCatalogSyncError extends CourseApiError {
  constructor(
    status,
    code,
    message,
    { retryable = false, conflictType = null, conflictRecord = null, details = undefined } = {},
  ) {
    super(status, code, message, details);
    this.name = "MolyCatalogSyncError";
    this.errorCode = code;
    this.retryable = Boolean(retryable);
    this.conflictType = conflictType;
    this.conflictRecord = conflictRecord;
  }
}

function stableSortJson(value) {
  if (Array.isArray(value)) return value.map(stableSortJson);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stableSortJson(value[key]);
    }
    return out;
  }
  return value;
}

function canonicalHashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableSortJson(value))).digest("hex");
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeAsciiSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function normalizeSubjectCode({ subjectCode = null, category = null, title = "", slug = "" } = {}) {
  const explicit = typeof subjectCode === "string" ? subjectCode.trim().toUpperCase() : "";
  if (SUBJECT_CODES.includes(explicit)) return explicit;

  const text = normalizeAsciiSearch(`${category || ""} ${title || ""} ${slug || ""}`);
  if (/\b(physics|vat ly|vat li|ly hoc)\b/.test(text) || text.includes("csca-ly") || text.includes("phys")) {
    return "PHYSICS";
  }
  if (/\b(chemistry|hoa hoc|chemical|chem)\b/.test(text) || text.includes("csca-hoa")) {
    return "CHEMISTRY";
  }
  if (/\b(chinese_sci|tu nhien|khtn|science chinese|trung van tu nhien)\b/.test(text)) {
    return "CHINESE_SCI";
  }
  if (/\b(chinese_soc|xa hoi|khxh|social|van hoc|trung van xa hoi|hskk?)\b/.test(text)
    || String(category || "").toUpperCase() === "HSK"
    || String(category || "").toUpperCase() === "HSKK") {
    return "CHINESE_SOC";
  }
  return "MATH";
}

function normalizeCourseLevel(level) {
  const raw = String(level || "").trim().toLowerCase();
  if (VALID_LEVELS.has(raw)) return raw;
  if (raw === "beginner") return "basic";
  return "basic";
}

function normalizeCourseSlug(rawSlug, remoteCourseId) {
  const candidate = String(rawSlug || `csca-course-${remoteCourseId}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (candidate || `csca-course-${remoteCourseId}`).slice(0, 160);
}

function buildShortDescription(description = "", existingShort = null) {
  if (typeof existingShort === "string" && existingShort.trim()) {
    return existingShort.trim().slice(0, 400);
  }
  const plain = String(description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain ? plain.slice(0, 320) : null;
}

function isStaleIncoming({ incomingRevision, incomingUpdatedAt, storedRevision, storedUpdatedAt }) {
  const incRev = Number(incomingRevision || 0);
  const stoRev = Number(storedRevision || 0);
  if (incRev < stoRev) return true;
  if (incRev > stoRev) return false;
  if (!incomingUpdatedAt || !storedUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() < new Date(storedUpdatedAt).getTime();
}

function validateEnvelope(rawBody) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Sync event envelope must be a JSON object.");
  }
  const schemaVersion = String(rawBody.schemaVersion || rawBody.schema_version || "").trim();
  if (schemaVersion !== "2.0") {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "schemaVersion must be '2.0'.");
  }
  const sourceSystem = String(rawBody.sourceSystem || rawBody.source_system || "").trim().toLowerCase();
  if (sourceSystem !== SOURCE_SYSTEM) {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", `sourceSystem must be '${SOURCE_SYSTEM}'.`);
  }
  const eventId = String(rawBody.eventId || rawBody.event_id || "").trim();
  const idempotencyKey = String(rawBody.idempotencyKey || rawBody.idempotency_key || eventId).trim();
  const eventType = String(rawBody.eventType || rawBody.event_type || "").trim();
  const aggregateType = String(rawBody.aggregateType || rawBody.aggregate_type || "").trim();
  const aggregateId = String(rawBody.aggregateId || rawBody.aggregate_id || "").trim();
  const revision = Number(rawBody.revision);
  const sourceUpdatedAt = toIso(rawBody.sourceUpdatedAt || rawBody.source_updated_at || rawBody.occurredAt || rawBody.occurred_at);
  const occurredAt = toIso(rawBody.occurredAt || rawBody.occurred_at) || sourceUpdatedAt;
  const deleted = Boolean(rawBody.deleted);
  const deletedAt = deleted
    ? (toIso(rawBody.deletedAt || rawBody.deleted_at) || sourceUpdatedAt)
    : null;
  const correlationId = resolveCorrelationId(rawBody.correlationId || rawBody.correlation_id);
  const payload = rawBody.payload && typeof rawBody.payload === "object" && !Array.isArray(rawBody.payload)
    ? rawBody.payload
    : null;

  if (!eventId || eventId.length > 180 || !idempotencyKey || idempotencyKey.length > 200) {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Valid eventId and idempotencyKey are required.");
  }
  if (!eventType || !aggregateType || !aggregateId || !Number.isSafeInteger(revision) || revision < 1) {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "eventType, aggregateType, aggregateId, and positive revision are required.");
  }
  if (!sourceUpdatedAt || !payload) {
    throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Valid sourceUpdatedAt and payload object are required.");
  }

  return {
    schemaVersion,
    eventId,
    idempotencyKey,
    eventType,
    sourceSystem,
    aggregateType,
    aggregateId,
    revision,
    sourceUpdatedAt,
    occurredAt,
    deleted,
    deletedAt,
    correlationId,
    payload,
    payloadHash: canonicalHashPayload({
      eventType,
      aggregateType,
      aggregateId,
      revision,
      deleted,
      deletedAt,
      payload,
    }),
  };
}

function createMolyCourseCatalogSyncService({
  db,
  client = null,
  now = () => new Date(),
  retryBaseSeconds = 30,
  maxBackoffSeconds = 1800,
  env = process.env,
} = {}) {
  const integrationLog = createIntegrationLogger({ component: "moly-catalog-sync", env });

  async function withTx(work, existingClient = null) {
    if (existingClient) return work(existingClient);
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

  async function hasCatalogSyncTables(runner = db) {
    try {
      const res = await runner.query(
        `SELECT
           to_regclass('moly_course_sync_inbox') IS NOT NULL AS has_inbox,
           to_regclass('course_profile_projections') IS NOT NULL AS has_profiles,
           to_regclass('course_sync_checkpoints') IS NOT NULL AS has_checkpoints,
           to_regclass('external_course_mappings') IS NOT NULL AS has_mappings`,
      );
      const row = res.rows[0] || {};
      return Boolean(row.has_inbox && row.has_profiles && row.has_checkpoints && row.has_mappings);
    } catch {
      return false;
    }
  }

  async function openConflict({
    conflictType,
    externalCourseId = null,
    localCourseId = null,
    correlationId = null,
    sourceUpdatedAt = null,
    reason,
    payload = {},
    metadata = {},
  }) {
    try {
      const existing = await db.query(
        `SELECT id FROM integration_conflicts
         WHERE source_system = $1
           AND conflict_type = $2
           AND status IN ('open', 'in_review')
           AND COALESCE(external_course_id, '') = COALESCE($3, '')
           AND COALESCE(local_course_id, 0) = COALESCE($4, 0)
         ORDER BY id DESC
         LIMIT 1`,
        [SOURCE_SYSTEM, conflictType, externalCourseId, localCourseId],
      );
      if (existing.rows[0]) {
        await db.query(
          `UPDATE integration_conflicts
           SET reason = $2,
               source_updated_at = COALESCE($3::timestamptz, source_updated_at),
               correlation_id = COALESCE($4, correlation_id),
               payload = $5::jsonb,
               metadata = metadata || $6::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            existing.rows[0].id,
            String(reason).slice(0, 1000),
            toIso(sourceUpdatedAt),
            correlationId,
            JSON.stringify(payload),
            JSON.stringify(metadata),
          ],
        );
        return Number(existing.rows[0].id);
      }

      const inserted = await db.query(
        `INSERT INTO integration_conflicts (
           source_system, conflict_type, status, external_course_id,
           local_course_id, correlation_id, source_updated_at, reason, payload, metadata
         )
         VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
         RETURNING id`,
        [
          SOURCE_SYSTEM,
          conflictType,
          externalCourseId,
          localCourseId,
          correlationId,
          toIso(sourceUpdatedAt) || now().toISOString(),
          String(reason).slice(0, 1000),
          JSON.stringify(payload),
          JSON.stringify(metadata),
        ],
      );
      return Number(inserted.rows[0].id);
    } catch {
      return null;
    }
  }

  async function resolveParentLocalCourseForSync(runner, remoteCourseId) {
    const res = await runner.query(
      `SELECT * FROM courses
       WHERE remote_source_system = $1 AND remote_course_id = $2
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE`,
      [SOURCE_SYSTEM, String(remoteCourseId)],
    );
    return res.rows[0] || null;
  }

  async function upsertOfferingMapping(runner, {
    externalOfferingId,
    externalCourseCode = null,
    externalCourseTitle = null,
    localCourseId,
    remoteCourseId,
    remoteProfileId = null,
    originMode,
    status,
    revision,
    sourceUpdatedAt,
    deletedAt = null,
    metadata = {},
  }) {
    let existing = null;
    if (remoteProfileId) {
      const byProfile = await runner.query(
        `SELECT * FROM external_course_mappings
         WHERE source_system = $1 AND remote_profile_id = $2
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE`,
        [SOURCE_SYSTEM, String(remoteProfileId)],
      );
      existing = byProfile.rows[0] || null;
    }
    if (!existing) {
      const byExtId = await runner.query(
        `SELECT * FROM external_course_mappings
         WHERE source_system = $1 AND external_course_id = $2
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE`,
        [SOURCE_SYSTEM, String(externalOfferingId)],
      );
      existing = byExtId.rows[0] || null;
    }

    if (existing) {
      if (isStaleIncoming({
        incomingRevision: revision,
        incomingUpdatedAt: sourceUpdatedAt,
        storedRevision: existing.last_revision,
        storedUpdatedAt: existing.source_updated_at,
      })) {
        return existing;
      }
      const nextStatus = existing.origin_mode === "manual" && status === "active"
        ? existing.status
        : status;
      const updated = await runner.query(
        `UPDATE external_course_mappings
         SET external_course_id = $2,
             external_course_code = COALESCE($3, external_course_code),
             external_course_title = COALESCE($4, external_course_title),
             local_course_id = $5,
             status = $6,
             origin_mode = CASE WHEN origin_mode = 'manual' THEN 'manual' ELSE $7 END,
             remote_course_id = $8,
             remote_profile_id = COALESCE($9, remote_profile_id),
             last_revision = $10,
             deleted_at = $11,
             source_updated_at = $12,
             metadata = COALESCE(metadata, '{}'::jsonb) || $13::jsonb
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          String(externalOfferingId),
          externalCourseCode,
          externalCourseTitle,
          localCourseId,
          nextStatus,
          originMode,
          String(remoteCourseId),
          remoteProfileId ? String(remoteProfileId) : null,
          Number(revision),
          toIso(deletedAt),
          toIso(sourceUpdatedAt),
          JSON.stringify(metadata),
        ],
      );
      return updated.rows[0];
    }

    const inserted = await runner.query(
      `INSERT INTO external_course_mappings (
         source_system, external_course_id, external_course_code, external_course_title,
         local_course_id, status, mapping_source, origin_mode,
         remote_course_id, remote_profile_id, last_revision, deleted_at,
         source_updated_at, notes, metadata
       )
       VALUES (
         $1, $2, $3, $4,
         $5, $6, 'manual', $7,
         $8, $9, $10, $11,
         $12, 'Synchronized from CSCA-Course catalog v2', $13::jsonb
       )
       RETURNING *`,
      [
        SOURCE_SYSTEM,
        String(externalOfferingId),
        externalCourseCode,
        externalCourseTitle,
        localCourseId,
        status,
        originMode,
        String(remoteCourseId),
        remoteProfileId ? String(remoteProfileId) : null,
        Number(revision),
        toIso(deletedAt),
        toIso(sourceUpdatedAt),
        JSON.stringify(metadata),
      ],
    );
    return inserted.rows[0];
  }

  async function applyProfileRecordTx(runner, profilePayload, {
    parentLocalCourse = null,
    courseInstructor = null,
    correlationId = null,
    eventDeleted = null,
    eventDeletedAt = null,
  } = {}) {
    const profileId = String(profilePayload.profileId || profilePayload.id || "").trim();
    const courseId = String(profilePayload.courseId || "").trim();
    if (!profileId || !courseId) {
      throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Profile payload requires profileId and courseId.");
    }

    const revision = Number(profilePayload.revision || 1);
    const sourceUpdatedAt = toIso(profilePayload.sourceUpdatedAt || now().toISOString()) || now().toISOString();
    const deleted = eventDeleted === true || Boolean(profilePayload.deleted);
    const deletedAt = deleted ? (toIso(eventDeletedAt || profilePayload.deletedAt) || sourceUpdatedAt) : null;
    const externalOfferingId = String(
      profilePayload.externalOfferingId
      || profilePayload.managementClassId
      || `profile:${profileId}`,
    ).trim();

    const parentCourse = parentLocalCourse || await resolveParentLocalCourseForSync(runner, courseId);
    if (!parentCourse) {
      throw new MolyCatalogSyncError(
        404,
        "COURSE_MAPPING_MISSING",
        `Missing local synced course for remote courseId '${courseId}'.`,
        {
          retryable: true,
          conflictType: "COURSE_MAPPING_MISSING",
          conflictRecord: {
            conflictType: "COURSE_MAPPING_MISSING",
            externalCourseId: externalOfferingId,
            correlationId,
            sourceUpdatedAt,
            reason: `No local csca_course projection found for remote courseId '${courseId}' while applying profile '${profileId}'.`,
            payload: profilePayload,
          },
          details: { remoteCourseId: courseId, remoteProfileId: profileId },
        },
      );
    }

    if (parentCourse.content_origin !== "csca_course") {
      throw new MolyCatalogSyncError(
        409,
        "LEGACY_ORIGIN_CONFLICT",
        "External profile sync refused to mutate a moly_native course.",
        {
          retryable: false,
          conflictType: "LEGACY_ORIGIN_CONFLICT",
          conflictRecord: {
            conflictType: "LEGACY_ORIGIN_CONFLICT",
            externalCourseId: externalOfferingId,
            localCourseId: Number(parentCourse.id),
            correlationId,
            sourceUpdatedAt,
            reason: `Cannot attach CSCA-Course profile '${profileId}' onto native Moly course #${parentCourse.id}.`,
            payload: profilePayload,
          },
          details: { localCourseId: Number(parentCourse.id) },
        },
      );
    }

    const existingProjRes = await runner.query(
      `SELECT * FROM course_profile_projections
       WHERE source_system = $1 AND remote_profile_id = $2
       FOR UPDATE`,
      [SOURCE_SYSTEM, profileId],
    );
    const existingProj = existingProjRes.rows[0] || null;
    if (existingProj && isStaleIncoming({
      incomingRevision: revision,
      incomingUpdatedAt: sourceUpdatedAt,
      storedRevision: existingProj.last_revision,
      storedUpdatedAt: existingProj.source_updated_at,
    })) {
      return { action: "stale", remoteProfileId: profileId, localCourseId: Number(parentCourse.id) };
    }

    const rawStatus = String(profilePayload.status || "active").trim().toLowerCase();
    const projStatus = deleted
      ? "tombstoned"
      : rawStatus === "archived"
        ? "archived"
        : rawStatus === "draft" || rawStatus === "inactive" || parentCourse.status !== "published"
          ? "inactive"
          : "active";
    const mappingStatus = deleted || projStatus === "archived"
      ? "archived"
      : projStatus === "inactive"
        ? "inactive"
        : "active";

    const mapping = await upsertOfferingMapping(runner, {
      externalOfferingId,
      externalCourseCode: profilePayload.sourceLiveClassCode || profilePayload.managementClassId || null,
      externalCourseTitle: parentCourse.title,
      localCourseId: Number(parentCourse.id),
      remoteCourseId: courseId,
      remoteProfileId: profileId,
      originMode: "profile_projection",
      status: mappingStatus,
      revision,
      sourceUpdatedAt,
      deletedAt,
      metadata: {
        remoteCourseId: courseId,
        remoteProfileId: profileId,
        mode: profilePayload.mode || "MIRROR",
        badgeLabel: profilePayload.badgeLabel || null,
        ...(courseInstructor ? { instructor: courseInstructor } : {}),
      },
    });

    const mode = String(profilePayload.mode || "MIRROR").toUpperCase() === "INDEPENDENT"
      ? "INDEPENDENT"
      : "MIRROR";
    const deviceLimit = Math.min(Math.max(Number.parseInt(profilePayload.deviceLimit ?? 2, 10) || 2, 1), 10);
    const allowFileDownload = profilePayload.allowFileDownload !== false;
    const enforceTrustedDevices = profilePayload.enforceTrustedDevices !== false;
    const badgeLabel = profilePayload.badgeLabel || (mode === "MIRROR" ? "Bản ghi lớp Live" : "Khóa video độc lập");

    const projMeta = {
      sourceLiveClassCode: profilePayload.sourceLiveClassCode || null,
      ...(courseInstructor ? { instructor: courseInstructor } : {}),
    };

    let savedProj;
    if (existingProj) {
      savedProj = (
        await runner.query(
          `UPDATE course_profile_projections
           SET external_offering_id = $2,
               local_course_id = $3,
               course_mapping_id = $4,
               mode = $5,
               management_class_id = $6,
               source_live_class_id = $7,
               badge_label = $8,
               allow_file_download = $9,
               device_limit = $10,
               enforce_trusted_devices = $11,
               status = $12,
               last_revision = $13,
               source_updated_at = $14,
               deleted_at = $15,
               metadata = COALESCE(metadata, '{}'::jsonb) || $16::jsonb
           WHERE id = $1
           RETURNING *`,
          [
            existingProj.id,
            externalOfferingId,
            Number(parentCourse.id),
            Number(mapping.id),
            mode,
            profilePayload.managementClassId || null,
            profilePayload.sourceLiveClassId != null ? String(profilePayload.sourceLiveClassId) : null,
            badgeLabel,
            allowFileDownload,
            deviceLimit,
            enforceTrustedDevices,
            projStatus,
            revision,
            sourceUpdatedAt,
            deletedAt,
            JSON.stringify(projMeta),
          ],
        )
      ).rows[0];
    } else {
      savedProj = (
        await runner.query(
          `INSERT INTO course_profile_projections (
             source_system, remote_course_id, remote_profile_id, external_offering_id,
             local_course_id, course_mapping_id, mode, management_class_id, source_live_class_id,
             badge_label, allow_file_download, device_limit, enforce_trusted_devices,
             status, checkout_ready, last_revision, source_updated_at, deleted_at, metadata
           )
           VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9,
             $10, $11, $12, $13,
             $14, FALSE, $15, $16, $17, $18::jsonb
           )
           RETURNING *`,
          [
            SOURCE_SYSTEM,
            courseId,
            profileId,
            externalOfferingId,
            Number(parentCourse.id),
            Number(mapping.id),
            mode,
            profilePayload.managementClassId || null,
            profilePayload.sourceLiveClassId != null ? String(profilePayload.sourceLiveClassId) : null,
            badgeLabel,
            allowFileDownload,
            deviceLimit,
            enforceTrustedDevices,
            projStatus,
            revision,
            sourceUpdatedAt,
            deletedAt,
            JSON.stringify(projMeta),
          ],
        )
      ).rows[0];
    }

    return {
      action: existingProj ? "updated" : "inserted",
      profileProjectionId: Number(savedProj.id),
      remoteProfileId: profileId,
      localCourseId: Number(parentCourse.id),
      mappingId: Number(mapping.id),
      status: projStatus,
    };
  }

  async function applyCourseRecordTx(runner, coursePayload, {
    correlationId = null,
    eventType = null,
    eventDeleted = null,
    eventDeletedAt = null,
  } = {}) {
    const courseId = String(coursePayload.courseId || "").trim();
    if (!courseId) {
      throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Course payload requires courseId.");
    }

    const revision = Number(coursePayload.revision || 1);
    const sourceUpdatedAt = toIso(coursePayload.sourceUpdatedAt || now().toISOString()) || now().toISOString();
    const deleted = eventDeleted === true || Boolean(coursePayload.deleted) || eventType === "course.tombstoned";
    const deletedAt = deleted ? (toIso(eventDeletedAt || coursePayload.deletedAt) || sourceUpdatedAt) : null;
    const isPublished = !deleted && eventType !== "course.unpublished"
      && (eventType === "course.published" || Boolean(coursePayload.isPublished));

    const title = String(coursePayload.title || `CSCA Course #${courseId}`).trim().slice(0, 255);
    const desiredSlug = normalizeCourseSlug(coursePayload.slug, courseId);
    const externalKey = `csca-course:${courseId}`;
    const description = typeof coursePayload.description === "string" ? coursePayload.description : "";
    const shortDescription = buildShortDescription(description, coursePayload.shortDescription);
    const subjectCode = normalizeSubjectCode({
      subjectCode: coursePayload.subjectCode,
      category: coursePayload.category,
      title,
      slug: desiredSlug,
    });
    const level = normalizeCourseLevel(coursePayload.level);
    const thumbnailUrl = typeof coursePayload.thumbnailUrl === "string" && coursePayload.thumbnailUrl.trim()
      ? coursePayload.thumbnailUrl.trim().slice(0, 1000)
      : null;
    const totalLessons = Math.max(0, Number.parseInt(coursePayload.totalLessons ?? 0, 10) || 0);
    const instructor = coursePayload.instructor && typeof coursePayload.instructor === "object"
      ? {
          id: coursePayload.instructor.id != null ? String(coursePayload.instructor.id) : null,
          displayName: String(coursePayload.instructor.displayName || "").trim() || null,
          avatarUrl: coursePayload.instructor.avatarUrl || null,
          headline: coursePayload.instructor.headline || null,
        }
      : null;

    let existing = await resolveParentLocalCourseForSync(runner, courseId);

    if (existing && existing.content_origin !== "csca_course") {
      throw new MolyCatalogSyncError(
        409,
        "LEGACY_ORIGIN_CONFLICT",
        "External sync cannot overwrite a moly_native course.",
        {
          retryable: false,
          conflictType: "LEGACY_ORIGIN_CONFLICT",
          conflictRecord: {
            conflictType: "LEGACY_ORIGIN_CONFLICT",
            externalCourseId: `course:${courseId}`,
            localCourseId: Number(existing.id),
            correlationId,
            sourceUpdatedAt,
            reason: `Remote course '${courseId}' collided with native course #${existing.id}.`,
            payload: coursePayload,
          },
          details: { localCourseId: Number(existing.id) },
        },
      );
    }

    if (existing && isStaleIncoming({
      incomingRevision: revision,
      incomingUpdatedAt: sourceUpdatedAt,
      storedRevision: existing.sync_revision,
      storedUpdatedAt: existing.source_updated_at,
    })) {
      return { action: "stale", localCourseId: Number(existing.id), remoteCourseId: courseId, profiles: [] };
    }

    // Never hijack or overwrite a moly_native row sharing slug or external_key.
    const slugOrKeyCollision = (
      await runner.query(
        `SELECT id, slug, external_key, content_origin
         FROM courses
         WHERE (slug = $1 OR external_key = $2)
           AND ($3::bigint IS NULL OR id <> $3::bigint)
         LIMIT 1
         FOR UPDATE`,
        [desiredSlug, externalKey, existing ? existing.id : null],
      )
    ).rows[0] || null;

    if (slugOrKeyCollision) {
      if (slugOrKeyCollision.content_origin === "moly_native") {
        throw new MolyCatalogSyncError(
          409,
          "LEGACY_ORIGIN_CONFLICT",
          `Slug or key collides with moly_native course #${slugOrKeyCollision.id}.`,
          {
            retryable: false,
            conflictType: "LEGACY_ORIGIN_CONFLICT",
            conflictRecord: {
              conflictType: "LEGACY_ORIGIN_CONFLICT",
              externalCourseId: `course:${courseId}`,
              localCourseId: Number(slugOrKeyCollision.id),
              correlationId,
              sourceUpdatedAt,
              reason: `Synced course '${courseId}' slug '${desiredSlug}' collides with native Moly course #${slugOrKeyCollision.id}.`,
              payload: coursePayload,
            },
            details: { localCourseId: Number(slugOrKeyCollision.id) },
          },
        );
      }
      // Deterministic disambiguation only for collision against another csca_course row.
      // (Never modifies the colliding row.)
    }

    const effectiveSlug = slugOrKeyCollision
      ? `${desiredSlug.slice(0, 140)}-${courseId}`
      : desiredSlug;
    const nextStatus = deleted ? "archived" : (isPublished ? "published" : "draft");

    let savedCourse;
    if (existing) {
      savedCourse = (
        await runner.query(
          `UPDATE courses
           SET slug = $2,
               title = $3,
               short_description = $4,
               description = $5,
               subject_code = $6,
               level = $7,
               thumbnail_url = $8,
               status = $9::varchar,
               total_lessons = GREATEST(total_lessons, $10),
               sync_revision = $11,
               source_updated_at = $12::timestamptz,
               tombstoned_at = $13::timestamptz,
               published_at = CASE
                 WHEN $9::varchar = 'published' THEN COALESCE(published_at, $12::timestamptz)
                 ELSE NULL
               END,
               content_updated_at = $12::timestamptz
           WHERE id = $1 AND content_origin = 'csca_course'
           RETURNING *`,
          [
            existing.id,
            effectiveSlug,
            title,
            shortDescription,
            description,
            subjectCode,
            level,
            thumbnailUrl,
            nextStatus,
            totalLessons,
            revision,
            sourceUpdatedAt,
            deletedAt,
          ],
        )
      ).rows[0];
    } else {
      savedCourse = (
        await runner.query(
          `INSERT INTO courses (
             external_key, slug, title, short_description, description,
             subject_code, level, thumbnail_url,
             access_type, required_tier, price_vnd, status, total_lessons,
             published_at, content_updated_at,
             content_origin, remote_source_system, remote_course_id,
             sync_revision, source_updated_at, tombstoned_at
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8,
             'private', 'basic', 0, $9, $10,
             $11, $12,
             'csca_course', $13, $14,
             $15, $12, $16
           )
           RETURNING *`,
          [
            externalKey,
            effectiveSlug,
            title,
            shortDescription,
            description,
            subjectCode,
            level,
            thumbnailUrl,
            nextStatus,
            totalLessons,
            nextStatus === "published" ? sourceUpdatedAt : null,
            sourceUpdatedAt,
            SOURCE_SYSTEM,
            courseId,
            revision,
            deletedAt,
          ],
        )
      ).rows[0];
    }

    await upsertOfferingMapping(runner, {
      externalOfferingId: `course:${courseId}`,
      externalCourseCode: effectiveSlug,
      externalCourseTitle: title,
      localCourseId: Number(savedCourse.id),
      remoteCourseId: courseId,
      remoteProfileId: null,
      originMode: "catalog_auto",
      status: deleted ? "archived" : (isPublished ? "active" : "inactive"),
      revision,
      sourceUpdatedAt,
      deletedAt,
      metadata: {
        remoteCourseId: courseId,
        category: coursePayload.category || null,
        slug: effectiveSlug,
        instructor,
      },
    });

    if (deleted || !isPublished) {
      await runner.query(
        `UPDATE course_profile_projections
         SET status = CASE WHEN $2::boolean THEN 'tombstoned' ELSE 'inactive' END,
             deleted_at = CASE WHEN $2::boolean THEN COALESCE(deleted_at, $3::timestamptz) ELSE deleted_at END,
             last_revision = GREATEST(last_revision, $4),
             source_updated_at = GREATEST(source_updated_at, $5::timestamptz)
         WHERE source_system = $1
           AND local_course_id = $6
           AND status <> 'tombstoned'`,
        [SOURCE_SYSTEM, deleted, deletedAt, revision, sourceUpdatedAt, Number(savedCourse.id)],
      );
    }

    const profileResults = [];
    if (Array.isArray(coursePayload.profiles)) {
      for (const prof of coursePayload.profiles) {
        const res = await applyProfileRecordTx(runner, prof, {
          parentLocalCourse: savedCourse,
          courseInstructor: instructor,
          correlationId,
          eventDeleted: deleted ? true : prof.deleted,
          eventDeletedAt: deleted ? deletedAt : prof.deletedAt,
        });
        profileResults.push(res);
      }
    }

    return {
      action: existing ? "updated" : "inserted",
      localCourseId: Number(savedCourse.id),
      remoteCourseId: courseId,
      status: nextStatus,
      profiles: profileResults,
    };
  }

  async function processInboxRow(inboxRow, { workerId = "inline" } = {}) {
    const envelope = typeof inboxRow.payload === "string"
      ? JSON.parse(inboxRow.payload)
      : inboxRow.payload;
    const aggType = String(inboxRow.aggregate_type || envelope.aggregateType || "").toLowerCase();
    const innerPayload = envelope.payload || envelope;

    try {
      const outcome = await withTx(async (txClient) => {
        let applied;
        if (aggType === "profile") {
          applied = await applyProfileRecordTx(txClient, innerPayload, {
            correlationId: inboxRow.correlation_id,
            eventDeleted: inboxRow.deleted,
            eventDeletedAt: inboxRow.deleted_at,
          });
        } else {
          applied = await applyCourseRecordTx(txClient, innerPayload, {
            correlationId: inboxRow.correlation_id,
            eventType: inboxRow.event_type,
            eventDeleted: inboxRow.deleted,
            eventDeletedAt: inboxRow.deleted_at,
          });
        }

        const nextInboxStatus = applied.action === "stale" ? "stale" : "processed";
        await txClient.query(
          `UPDATE moly_course_sync_inbox
           SET status = $2,
               processed_at = NOW(),
               locked_until = NULL,
               locked_by = NULL,
               last_error_code = $3,
               last_error_message = NULL,
               metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
           WHERE id = $1`,
          [
            inboxRow.id,
            nextInboxStatus,
            applied.action === "stale" ? "STALE_EVENT_IGNORED" : null,
            JSON.stringify({ lastOutcome: applied }),
          ],
        );

        return { inboxStatus: nextInboxStatus, ...applied };
      });

      recordMetric(`moly.catalog_inbox.${outcome.inboxStatus}`);
      return { inboxId: Number(inboxRow.id), eventId: inboxRow.event_id, ...outcome };
    } catch (error) {
      if (error?.conflictRecord) {
        const conflictId = await openConflict(error.conflictRecord);
        if (conflictId != null) {
          error.details = { ...(error.details || {}), conflictId };
        }
      }
      const nextAttempt = Number(inboxRow.attempt_count || 0) + 1;
      const maxAttempts = Number(inboxRow.max_attempts || 8);
      const code = String(error?.code || error?.errorCode || "CATALOG_INBOX_ERROR").slice(0, 80);
      const message = String(error?.message || "Catalog event processing failed.").slice(0, 500);
      const isConflict = code === "LEGACY_ORIGIN_CONFLICT";
      const terminal = isConflict || error?.retryable === false || nextAttempt >= maxAttempts;
      const nextStatus = terminal ? (isConflict ? "ignored" : "dead_letter") : "failed";
      const delaySec = Math.min(maxBackoffSeconds, retryBaseSeconds * (2 ** Math.max(0, nextAttempt - 1)));
      const nextRetryIso = new Date(now().getTime() + delaySec * 1000).toISOString();

      await db.query(
        `UPDATE moly_course_sync_inbox
         SET status = $2,
             attempt_count = $3,
             next_retry_at = $4::timestamptz,
             locked_until = NULL,
             locked_by = NULL,
             last_error_code = $5,
             last_error_message = $6
         WHERE id = $1`,
        [inboxRow.id, nextStatus, nextAttempt, nextRetryIso, code, message],
      );

      integrationLog.warn("catalog_inbox_event_failed", {
        inboxId: Number(inboxRow.id),
        eventId: inboxRow.event_id,
        status: nextStatus,
        code,
        workerId,
      }, inboxRow.correlation_id);
      throw error;
    }
  }

  /**
   * Enqueues one or more v2 catalog events into `moly_course_sync_inbox` with
   * idempotent deduplication, optionally applying immediately (`processImmediately`).
   */
  async function ingestCatalogEvents(rawInput, { processImmediately = true, correlationId = null } = {}) {
    if (!(await hasCatalogSyncTables(db))) {
      throw new MolyCatalogSyncError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Catalog sync tables are not migrated.");
    }
    if (isCatalogSyncKillSwitchActive(env)) {
      throw new MolyCatalogSyncError(503, "SYNC_KILL_SWITCH_ACTIVE", "Course catalog sync is disabled by kill switch.", { retryable: true });
    }

    const rawList = Array.isArray(rawInput?.events)
      ? rawInput.events
      : (Array.isArray(rawInput) ? rawInput : [rawInput]);
    if (!rawList.length || rawList.length > 200) {
      throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Expected between 1 and 200 events.");
    }

    const envelopes = rawList.map((item) => validateEnvelope(
      correlationId && !item?.correlationId && !item?.correlation_id
        ? { ...item, correlationId }
        : item,
    ));

    const results = [];
    for (const envItem of envelopes) {
      const existingRes = await db.query(
        `SELECT * FROM moly_course_sync_inbox
         WHERE source_system = $1
           AND (event_id = $2 OR idempotency_key = $3)
         LIMIT 1`,
        [SOURCE_SYSTEM, envItem.eventId, envItem.idempotencyKey],
      );
      const existing = existingRes.rows[0];
      if (existing) {
        if (existing.payload_hash !== envItem.payloadHash) {
          throw new MolyCatalogSyncError(
            409,
            "IDEMPOTENCY_CONFLICT",
            `Event '${envItem.eventId}' / key '${envItem.idempotencyKey}' already exists with different payload.`,
          );
        }
        if (["processed", "stale", "ignored"].includes(existing.status)) {
          results.push({
            inboxId: Number(existing.id),
            eventId: existing.event_id,
            status: existing.status,
            deduplicated: true,
          });
          continue;
        }
        if (processImmediately) {
          const outcome = await processInboxRow(existing, { workerId: "ingest-inline" });
          results.push({ ...outcome, deduplicated: true });
          continue;
        }
        results.push({ inboxId: Number(existing.id), eventId: existing.event_id, status: existing.status, deduplicated: true });
        continue;
      }

      const insertedRes = await db.query(
        `INSERT INTO moly_course_sync_inbox (
           source_system, schema_version, event_id, idempotency_key, correlation_id,
           event_type, aggregate_type, aggregate_id, aggregate_revision,
           deleted, deleted_at, payload_hash, payload, source_updated_at, occurred_at, status
         )
         VALUES (
           $1, '2.0', $2, $3, $4,
           $5, $6, $7, $8,
           $9, $10, $11, $12::jsonb, $13, $14, 'pending'
         )
         RETURNING *`,
        [
          SOURCE_SYSTEM,
          envItem.eventId,
          envItem.idempotencyKey,
          envItem.correlationId,
          envItem.eventType,
          envItem.aggregateType,
          envItem.aggregateId,
          envItem.revision,
          envItem.deleted,
          envItem.deletedAt,
          envItem.payloadHash,
          JSON.stringify({
            schemaVersion: envItem.schemaVersion,
            eventId: envItem.eventId,
            idempotencyKey: envItem.idempotencyKey,
            eventType: envItem.eventType,
            sourceSystem: envItem.sourceSystem,
            aggregateType: envItem.aggregateType,
            aggregateId: envItem.aggregateId,
            revision: envItem.revision,
            deleted: envItem.deleted,
            deletedAt: envItem.deletedAt,
            sourceUpdatedAt: envItem.sourceUpdatedAt,
            occurredAt: envItem.occurredAt,
            correlationId: envItem.correlationId,
            payload: envItem.payload,
          }),
          envItem.sourceUpdatedAt,
          envItem.occurredAt,
        ],
      );
      const inserted = insertedRes.rows[0];
      if (!processImmediately) {
        results.push({
          inboxId: Number(inserted.id),
          eventId: inserted.event_id,
          status: "pending",
          deduplicated: false,
        });
      } else {
        const outcome = await processInboxRow(inserted, { workerId: "ingest-inline" });
        results.push({ ...outcome, deduplicated: false });
      }
    }

    return {
      accepted: results.length,
      results,
    };
  }

  /**
   * Claims pending/failed rows from `moly_course_sync_inbox` and applies them
   * strictly in revision order per aggregate.
   */
  async function processAvailableInboxJobs({
    workerId = `moly-catalog-inbox-${process.pid}`,
    limit = 50,
    leaseSeconds = 60,
  } = {}) {
    if (isCatalogSyncKillSwitchActive(env)) {
      return { skipped: true, reason: "kill_switch", claimed: 0, results: [] };
    }
    if (!(await hasCatalogSyncTables(db))) {
      return { skipped: true, reason: "schema_not_ready", claimed: 0, results: [] };
    }

    const boundedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const nowIso = now().toISOString();

    const claimed = await withTx(async (txClient) => {
      await txClient.query(
        `UPDATE moly_course_sync_inbox
         SET status = 'failed', locked_until = NULL, locked_by = NULL
         WHERE status = 'processing' AND locked_until < $1`,
        [nowIso],
      );
      const claimRes = await txClient.query(
        `WITH candidate AS (
           SELECT id
           FROM moly_course_sync_inbox
           WHERE status IN ('pending', 'failed')
             AND next_retry_at <= $1
             AND (locked_until IS NULL OR locked_until < $1)
           ORDER BY aggregate_revision ASC, id ASC
           LIMIT $2
           FOR UPDATE SKIP LOCKED
         )
         UPDATE moly_course_sync_inbox i
         SET status = 'processing',
             locked_by = $3,
             locked_until = $4::timestamptz,
             updated_at = NOW()
         FROM candidate
         WHERE i.id = candidate.id
         RETURNING i.*`,
        [
          nowIso,
          boundedLimit,
          String(workerId).slice(0, 100),
          new Date(now().getTime() + leaseSeconds * 1000).toISOString(),
        ],
      );
      return claimRes.rows;
    });

    const results = [];
    for (const row of claimed) {
      if (isCatalogSyncKillSwitchActive(env)) break;
      try {
        results.push(await processInboxRow(row, { workerId }));
      } catch (err) {
        results.push({
          inboxId: Number(row.id),
          eventId: row.event_id,
          status: "failed",
          errorCode: err?.code || "CATALOG_INBOX_ERROR",
        });
      }
    }

    return { skipped: false, claimed: claimed.length, results };
  }

  /**
   * Resumable paginated catalog backfill pulling `/api/integrations/v2/catalog/courses`
   * using `course_sync_checkpoints`. Safely handles > 2,000 rows, interruption/resume,
   * mid-backfill mutations, and native origin conflicts without overwriting local pricing.
   */
  async function runCatalogBackfill({
    streamName = CATALOG_STREAM_NAME,
    limit = 100,
    reset = false,
    maxPages = MAX_BACKFILL_PAGES,
    correlationId = null,
    onPageApplied = null,
  } = {}) {
    if (!(await hasCatalogSyncTables(db))) {
      throw new MolyCatalogSyncError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Catalog sync tables are not migrated.");
    }
    const corr = resolveCorrelationId(correlationId);
    const startMs = Date.now();

    if (!client || typeof client.fetchCatalogCourses !== "function") {
      throw new MolyCatalogSyncError(503, "COURSE_CLIENT_UNAVAILABLE", "CSCA-Course catalog client is unavailable.");
    }

    await db.query(
      `INSERT INTO course_sync_checkpoints (stream_name, source_system, sync_status)
       VALUES ($1, $2, 'idle')
       ON CONFLICT (stream_name) DO NOTHING`,
      [streamName, SOURCE_SYSTEM],
    );

    if (isCatalogSyncKillSwitchActive(env)) {
      await db.query(
        `UPDATE course_sync_checkpoints
         SET sync_status = 'paused_kill_switch', updated_at = NOW()
         WHERE stream_name = $1`,
        [streamName],
      );
      return { paused: true, reason: "kill_switch", pagesProcessed: 0, coursesApplied: 0 };
    }

    const cpRow = (
      await db.query(`SELECT * FROM course_sync_checkpoints WHERE stream_name = $1`, [streamName])
    ).rows[0];

    let afterRevision = reset ? 0 : Number(cpRow?.high_water_revision || 0);
    let afterId = reset ? 0 : Number(cpRow?.after_entity_id || 0);
    let cursor = reset ? null : (cpRow?.last_cursor || null);
    let snapshotAnchorRevision = reset ? null : (cpRow?.snapshot_anchor_revision != null ? Number(cpRow.snapshot_anchor_revision) : null);

    // When resuming an idle incremental sync with no active cursor, reset tie-breaker after_entity_id
    // to 0 only if previous sweep completed (last_cursor === null and !reset).
    if (!reset && !cursor && afterRevision > 0) {
      afterId = 0;
    }

    await db.query(
      `UPDATE course_sync_checkpoints
       SET sync_status = 'backfilling', last_error_code = NULL, last_error_message = NULL
       WHERE stream_name = $1`,
      [streamName],
    );

    let pagesProcessed = 0;
    let coursesApplied = 0;
    let profilesApplied = 0;
    let staleCount = 0;
    let conflictCount = 0;
    let highestRevisionSeen = afterRevision;
    let highestUpdatedAtSeen = cpRow?.high_water_updated_at ? toIso(cpRow.high_water_updated_at) : null;

    try {
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        if (isCatalogSyncKillSwitchActive(env)) {
          await db.query(
            `UPDATE course_sync_checkpoints
             SET sync_status = 'paused_kill_switch'
             WHERE stream_name = $1`,
            [streamName],
          );
          return {
            paused: true,
            reason: "kill_switch",
            pagesProcessed,
            coursesApplied,
            profilesApplied,
            staleCount,
            conflictCount,
            checkpoint: { afterRevision, afterId, cursor, snapshotAnchorRevision },
          };
        }

        const pageData = await client.fetchCatalogCourses({
          afterRevision: cursor ? undefined : afterRevision,
          afterId: cursor ? undefined : afterId,
          cursor,
          snapshotAnchorRevision,
          limit,
          includeTombstoned: true,
          correlationId: corr,
        });

        const pageCourses = Array.isArray(pageData?.courses) ? pageData.courses : [];
        const pg = pageData?.pagination || {};
        if (snapshotAnchorRevision == null && pg.snapshotAnchorRevision != null) {
          snapshotAnchorRevision = Number(pg.snapshotAnchorRevision);
        }

        for (const item of pageCourses) {
          try {
            const outcome = await withTx((txClient) =>
              applyCourseRecordTx(txClient, item, { correlationId: corr }),
            );
            if (outcome.action === "stale") staleCount += 1;
            else coursesApplied += 1;
            profilesApplied += (outcome.profiles || []).filter((p) => p.action !== "stale").length;
          } catch (err) {
            if (err?.conflictRecord) {
              const conflictId = await openConflict(err.conflictRecord);
              if (conflictId != null) {
                err.details = { ...(err.details || {}), conflictId };
              }
            }
            if (err?.code === "LEGACY_ORIGIN_CONFLICT" || err?.conflictType) {
              conflictCount += 1;
              integrationLog.warn("backfill_item_conflict_skipped", {
                remoteCourseId: item?.courseId,
                code: err.code,
              }, corr);
            } else {
              throw err;
            }
          }

          const itemRev = Number(item?.revision || 0);
          if (itemRev > highestRevisionSeen) highestRevisionSeen = itemRev;
          const itemUpdated = toIso(item?.sourceUpdatedAt);
          if (itemUpdated && (!highestUpdatedAtSeen || new Date(itemUpdated) > new Date(highestUpdatedAtSeen))) {
            highestUpdatedAtSeen = itemUpdated;
          }
        }

        pagesProcessed += 1;
        const hasMore = Boolean(pg.hasMore);
        afterRevision = pg.nextAfterRevision != null ? Number(pg.nextAfterRevision) : highestRevisionSeen;
        afterId = pg.nextAfterId != null ? Number(pg.nextAfterId) : 0;
        cursor = hasMore ? (pg.nextCursor || null) : null;

        const checkpointRevision = hasMore
          ? afterRevision
          : Math.max(afterRevision, Number(pg.highWaterRevision || 0), highestRevisionSeen);

        await db.query(
          `UPDATE course_sync_checkpoints
           SET last_cursor = $2,
               after_entity_id = $3,
               high_water_revision = GREATEST(high_water_revision, $4),
               snapshot_anchor_revision = $5,
               high_water_updated_at = COALESCE($6::timestamptz, high_water_updated_at),
               sync_status = $7::varchar,
               last_synced_at = CASE WHEN $7::varchar = 'idle' THEN NOW() ELSE last_synced_at END
           WHERE stream_name = $1`,
          [
            streamName,
            cursor,
            hasMore ? afterId : 0,
            checkpointRevision,
            snapshotAnchorRevision,
            highestUpdatedAtSeen,
            hasMore ? "backfilling" : "idle",
          ],
        );

        if (typeof onPageApplied === "function") {
          await onPageApplied({
            pageIndex,
            hasMore,
            pageCoursesCount: pageCourses.length,
            checkpoint: { afterRevision, afterId, cursor, snapshotAnchorRevision },
          });
        }

        if (!hasMore || pageCourses.length === 0) break;
      }

      // Replay any queued real-time outbox/inbox deliveries that landed during backfill.
      const drainedInbox = await processAvailableInboxJobs({
        workerId: "backfill-converge",
        limit: 100,
      });

      observeMetricLatency("moly.catalog_backfill_ms", Date.now() - startMs);
      recordMetric("moly.catalog_backfill_runs");

      return {
        paused: false,
        pagesProcessed,
        coursesApplied,
        profilesApplied,
        staleCount,
        conflictCount,
        drainedInboxCount: drainedInbox.claimed || 0,
        highWaterRevision: Math.max(afterRevision, highestRevisionSeen),
        snapshotAnchorRevision,
      };
    } catch (error) {
      await db.query(
        `UPDATE course_sync_checkpoints
         SET sync_status = 'error',
             last_error_code = $2,
             last_error_message = $3
         WHERE stream_name = $1`,
        [
          streamName,
          String(error?.code || error?.errorCode || "BACKFILL_ERROR").slice(0, 80),
          String(error?.message || "Backfill failed.").slice(0, 500),
        ],
      ).catch(() => {});
      throw error;
    }
  }

  return {
    MolyCatalogSyncError,
    normalizeSubjectCode,
    normalizeCourseLevel,
    validateEnvelope,
    hasCatalogSyncTables,
    ingestCatalogEvents,
    processAvailableInboxJobs,
    runCatalogBackfill,
  };
}

module.exports = {
  MolyCatalogSyncError,
  SOURCE_SYSTEM,
  CATALOG_STREAM_NAME,
  normalizeSubjectCode,
  normalizeCourseLevel,
  validateEnvelope,
  createMolyCourseCatalogSyncService,
};
