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

  async function hasUnitProjectionTables(runner = db) {
    try {
      const res = await runner.query(
        `SELECT
           to_regclass('course_unit_projections') IS NOT NULL AS has_units,
           to_regclass('course_file_projections') IS NOT NULL AS has_files`,
      );
      const row = res.rows[0] || {};
      return Boolean(row.has_units && row.has_files);
    } catch {
      return false;
    }
  }

  async function refreshCourseProjectionTotalsTx(runner, localCourseId) {
    const cid = Number(localCourseId);
    if (!Number.isSafeInteger(cid) || cid <= 0) return;

    const preferredProfileRes = await runner.query(
      `SELECT p.id
       FROM course_profile_projections p
       LEFT JOIN course_unit_projections u
         ON u.profile_projection_id = p.id
        AND u.deleted_at IS NULL
        AND u.is_published = TRUE
       WHERE p.local_course_id = $1::bigint
         AND p.deleted_at IS NULL
         AND p.status <> 'archived'
       GROUP BY p.id, p.mode
       ORDER BY COUNT(u.id) DESC, (CASE WHEN p.mode = 'INDEPENDENT' THEN 0 ELSE 1 END) ASC, p.id ASC
       LIMIT 1`,
      [cid],
    );
    const preferredProfileId = preferredProfileRes.rows[0]?.id ? Number(preferredProfileRes.rows[0].id) : null;

    if (!preferredProfileId) {
      await runner.query(
        `UPDATE courses
         SET total_sections = 0,
             total_lessons = 0,
             total_duration_seconds = 0,
             content_updated_at = NOW(),
             updated_at = NOW()
         WHERE id = $1::bigint
           AND content_origin = 'csca_course'`,
        [cid],
      );
      return;
    }

    await runner.query(
      `UPDATE courses
       SET total_sections = stats.total_sections,
           total_lessons = stats.total_lessons,
           total_duration_seconds = stats.total_duration_seconds,
           content_updated_at = NOW(),
           updated_at = NOW()
       FROM (
         SELECT
           COUNT(DISTINCT COALESCE(NULLIF(remote_section_id, ''), NULLIF(section_title, ''), 'sec:default'))::int AS total_sections,
           COUNT(*)::int AS total_lessons,
           COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds
         FROM course_unit_projections
         WHERE profile_projection_id = $2::bigint
           AND deleted_at IS NULL
           AND is_published = TRUE
       ) stats
       WHERE id = $1::bigint
         AND content_origin = 'csca_course'`,
      [cid, preferredProfileId],
    );
  }

  async function upsertUnitAndFilesTx(runner, {
    profileProjectionId,
    localCourseId,
    unit,
    fallbackRevision = 1,
    defaultUpdatedAt = null,
  }) {
    const unitType = unit?.unitType === "class_session" ? "class_session" : "lesson";
    const remoteUnitId = String(unit?.unitId || unit?.remoteUnitId || "").trim();
    if (!remoteUnitId) {
      throw new MolyCatalogSyncError(422, "VALIDATION_ERROR", "Curriculum unit requires unitId.");
    }

    const revision = Math.max(1, Number(unit?.revision || fallbackRevision || 1));
    const sourceUpdatedAt = toIso(unit?.sourceUpdatedAt || defaultUpdatedAt || now().toISOString()) || now().toISOString();
    const deleted = Boolean(unit?.deleted);
    const deletedAt = deleted ? (toIso(unit?.deletedAt) || sourceUpdatedAt) : null;
    const isPublished = !deleted && Boolean(unit?.isPublished);
    const isPublicPreview = isPublished && Boolean(unit?.isPublicPreview);

    const counts = unit?.counts && typeof unit.counts === "object" ? unit.counts : {};
    const theory = unit?.theory && typeof unit.theory === "object" ? unit.theory : {};
    const unitFiles = Array.isArray(unit?.files) ? unit.files : [];
    const safeMetadata = {
      unitKey: unit?.unitKey || `${unitType}:${remoteUnitId}`,
      sessionNumber: unit?.sessionNumber != null ? Number(unit.sessionNumber) : null,
      videoPartCount: Number(unit?.videoPartCount ?? counts.videos ?? 0),
      videoParts: Array.isArray(unit?.videoParts)
        ? unit.videoParts.map((vp, idx) => ({
            partId: vp?.partId != null ? String(vp.partId) : `part-${idx + 1}`,
            title: vp?.title ? String(vp.title) : `Phần ${idx + 1}`,
            videoType: vp?.videoType || "primary",
            durationSeconds: Math.max(0, Number(vp?.durationSeconds || 0)),
            sortOrder: Number(vp?.sortOrder ?? idx),
          }))
        : [],
      theory: {
        hasTheory: Boolean(theory.hasTheory),
        hasTranscript: Boolean(theory.hasTranscript),
        takeawayCount: Number(theory.takeawayCount || 0),
        timestampCount: Number(theory.timestampCount || 0),
        title: theory.title ? String(theory.title) : null,
        summary: theory.summary ? String(theory.summary) : null,
        updatedAt: toIso(theory.updatedAt),
      },
      quizzes: Array.isArray(unit?.quizzes)
        ? unit.quizzes.map((q) => ({
            quizId: q?.quizId != null ? String(q.quizId) : null,
            title: q?.title ? String(q.title) : "",
            durationMinutes: q?.durationMinutes != null ? Number(q.durationMinutes) : null,
            passingScore: q?.passingScore != null ? Number(q.passingScore) : 60,
          }))
        : [],
      assignments: Array.isArray(unit?.assignments)
        ? unit.assignments.map((a) => ({
            assignmentId: a?.assignmentId != null ? String(a.assignmentId) : null,
            title: a?.title ? String(a.title) : "",
            maxScore: a?.maxScore != null ? Number(a.maxScore) : 10,
            dueDate: toIso(a?.dueDate),
          }))
        : [],
    };

    const existingUnitRes = await runner.query(
      `SELECT id, last_revision, source_updated_at
       FROM course_unit_projections
       WHERE profile_projection_id = $1::bigint
         AND unit_type = $2::varchar
         AND remote_unit_id = $3::varchar
       FOR UPDATE`,
      [Number(profileProjectionId), unitType, remoteUnitId],
    );
    const existingUnit = existingUnitRes.rows[0] || null;
    if (
      existingUnit
      && isStaleIncoming({
        incomingRevision: revision,
        incomingUpdatedAt: sourceUpdatedAt,
        storedRevision: existingUnit.last_revision,
        storedUpdatedAt: existingUnit.source_updated_at,
      })
    ) {
      return { action: "stale", unitProjectionId: Number(existingUnit.id), unitType, remoteUnitId };
    }

    const upsertedUnit = (
      await runner.query(
        `INSERT INTO course_unit_projections (
           profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
           unit_type, remote_unit_id, title, summary, sort_order, duration_seconds,
           is_published, is_public_preview, video_part_count, has_theory, vocab_count, formula_count,
           file_count, quiz_count, assignment_count, last_revision, source_updated_at, deleted_at, metadata
         )
         VALUES (
           $1::bigint, $2::bigint, $3::varchar, $4::varchar, $5::integer,
           $6::varchar, $7::varchar, $8::varchar, $9::text, $10::integer, $11::integer,
           $12::boolean, $13::boolean, $14::integer, $15::boolean, $16::integer, $17::integer,
           $18::integer, $19::integer, $20::integer, $21::bigint, $22::timestamptz, $23::timestamptz, $24::jsonb
         )
         ON CONFLICT (profile_projection_id, unit_type, remote_unit_id)
         DO UPDATE SET
           local_course_id = EXCLUDED.local_course_id,
           remote_section_id = EXCLUDED.remote_section_id,
           section_title = EXCLUDED.section_title,
           section_sort_order = EXCLUDED.section_sort_order,
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           sort_order = EXCLUDED.sort_order,
           duration_seconds = EXCLUDED.duration_seconds,
           is_published = EXCLUDED.is_published,
           is_public_preview = EXCLUDED.is_public_preview,
           video_part_count = EXCLUDED.video_part_count,
           has_theory = EXCLUDED.has_theory,
           vocab_count = EXCLUDED.vocab_count,
           formula_count = EXCLUDED.formula_count,
           file_count = EXCLUDED.file_count,
           quiz_count = EXCLUDED.quiz_count,
           assignment_count = EXCLUDED.assignment_count,
           last_revision = EXCLUDED.last_revision,
           source_updated_at = EXCLUDED.source_updated_at,
           deleted_at = EXCLUDED.deleted_at,
           metadata = COALESCE(course_unit_projections.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()
         WHERE (
           course_unit_projections.last_revision < EXCLUDED.last_revision
           OR (
             course_unit_projections.last_revision = EXCLUDED.last_revision
             AND course_unit_projections.source_updated_at <= EXCLUDED.source_updated_at
           )
         )
         RETURNING *`,
        [
          Number(profileProjectionId),
          Number(localCourseId),
          unit?.sectionId != null ? String(unit.sectionId).slice(0, 128) : "sec:default",
          String(unit?.sectionTitle || "Chương 1").slice(0, 255),
          Number.parseInt(unit?.sectionSortOrder ?? 0, 10) || 0,
          unitType,
          remoteUnitId.slice(0, 128),
          String(unit?.title || `Bài học #${remoteUnitId}`).slice(0, 255),
          unit?.summary != null ? String(unit.summary) : null,
          Number.parseInt(unit?.sortOrder ?? 0, 10) || 0,
          Math.max(0, Number.parseInt(unit?.durationSeconds ?? 0, 10) || 0),
          isPublished,
          isPublicPreview,
          Math.max(0, Number.parseInt(unit?.videoPartCount ?? counts.videos ?? 0, 10) || 0),
          Boolean(theory?.hasTheory),
          Math.max(0, Number.parseInt(counts.vocab ?? 0, 10) || 0),
          Math.max(0, Number.parseInt(counts.formulas ?? 0, 10) || 0),
          Math.max(0, Number.parseInt(counts.files ?? unitFiles.length, 10) || 0),
          Math.max(0, Number.parseInt(counts.quizzes ?? safeMetadata.quizzes.length, 10) || 0),
          Math.max(0, Number.parseInt(counts.assignments ?? safeMetadata.assignments.length, 10) || 0),
          revision,
          sourceUpdatedAt,
          deletedAt,
          JSON.stringify(safeMetadata),
        ],
      )
    ).rows[0];

    if (!upsertedUnit) {
      return { action: "stale", unitProjectionId: existingUnit ? Number(existingUnit.id) : null, unitType, remoteUnitId };
    }

    const seenFileIds = [];
    for (let idx = 0; idx < unitFiles.length; idx += 1) {
      const f = unitFiles[idx];
      const remoteFileId = String(f?.fileId || f?.id || "").trim();
      if (!remoteFileId) continue;
      seenFileIds.push(remoteFileId);

      const fileUpdatedAt = toIso(f?.updatedAt || sourceUpdatedAt) || sourceUpdatedAt;
      await runner.query(
        `INSERT INTO course_file_projections (
           profile_projection_id, unit_projection_id, remote_file_id, title, original_filename,
           mime_type, file_kind, size_bytes, is_slide, allow_download_override, sort_order,
           is_published, last_revision, source_updated_at, deleted_at, metadata
         )
         VALUES (
           $1::bigint, $2::bigint, $3::varchar, $4::varchar, $5::varchar,
           $6::varchar, $7::varchar, $8::bigint, $9::boolean, $10::boolean, $11::integer,
           $12::boolean, $13::bigint, $14::timestamptz, $15::timestamptz, $16::jsonb
         )
         ON CONFLICT (unit_projection_id, remote_file_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           original_filename = EXCLUDED.original_filename,
           mime_type = EXCLUDED.mime_type,
           file_kind = EXCLUDED.file_kind,
           size_bytes = EXCLUDED.size_bytes,
           is_slide = EXCLUDED.is_slide,
           allow_download_override = EXCLUDED.allow_download_override,
           sort_order = EXCLUDED.sort_order,
           is_published = EXCLUDED.is_published,
           last_revision = GREATEST(course_file_projections.last_revision, EXCLUDED.last_revision),
           source_updated_at = GREATEST(course_file_projections.source_updated_at, EXCLUDED.source_updated_at),
           deleted_at = EXCLUDED.deleted_at,
           metadata = COALESCE(course_file_projections.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          Number(profileProjectionId),
          Number(upsertedUnit.id),
          remoteFileId.slice(0, 128),
          String(f?.title || f?.originalFilename || `Tài liệu ${idx + 1}`).slice(0, 255),
          f?.originalFilename ? String(f.originalFilename).slice(0, 255) : null,
          f?.mimeType ? String(f.mimeType).slice(0, 150) : null,
          f?.fileKind ? String(f.fileKind).slice(0, 50) : "document",
          f?.sizeBytes != null ? Math.max(0, Number.parseInt(f.sizeBytes, 10) || 0) : null,
          Boolean(f?.isSlide),
          f?.allowDownloadOverride != null ? Boolean(f.allowDownloadOverride) : null,
          Number.parseInt(f?.sortOrder ?? idx, 10) || 0,
          !deleted && f?.isPublished !== false && isPublished,
          revision,
          fileUpdatedAt,
          deleted ? deletedAt : null,
          JSON.stringify({ updatedAt: fileUpdatedAt }),
        ],
      );
    }

    // Reconcile detached/removed files for this unit
    await runner.query(
      `UPDATE course_file_projections
       SET deleted_at = COALESCE(deleted_at, $2::timestamptz),
           is_published = FALSE,
           last_revision = GREATEST(last_revision, $3::bigint),
           source_updated_at = GREATEST(source_updated_at, $2::timestamptz),
           updated_at = NOW()
       WHERE unit_projection_id = $1::bigint
         AND deleted_at IS NULL
         AND NOT (remote_file_id = ANY($4::text[]))`,
      [Number(upsertedUnit.id), sourceUpdatedAt, revision, seenFileIds],
    );

    return {
      action: existingUnit ? "updated" : "inserted",
      unitProjectionId: Number(upsertedUnit.id),
      unitType,
      remoteUnitId,
    };
  }

  async function reconcileProfileMissingUnitsTx(runner, {
    profileProjectionId,
    activeUnitKeys = [],
    revision = 1,
    deletedAt = now().toISOString(),
  }) {
    const revNum = Math.max(1, Number(revision || 1));
    const ts = toIso(deletedAt) || now().toISOString();
    const res = await runner.query(
      `UPDATE course_unit_projections
       SET deleted_at = COALESCE(deleted_at, $2::timestamptz),
           is_published = FALSE,
           last_revision = GREATEST(last_revision, $3::bigint),
           source_updated_at = GREATEST(source_updated_at, $2::timestamptz),
           updated_at = NOW()
       WHERE profile_projection_id = $1::bigint
         AND deleted_at IS NULL
         AND NOT ((unit_type || ':' || remote_unit_id) = ANY($4::text[]))
       RETURNING id`,
      [Number(profileProjectionId), ts, revNum, activeUnitKeys],
    );
    const tombUnitIds = res.rows.map((r) => Number(r.id));
    if (tombUnitIds.length > 0) {
      await runner.query(
        `UPDATE course_file_projections
         SET deleted_at = COALESCE(deleted_at, $2::timestamptz),
             is_published = FALSE,
             last_revision = GREATEST(last_revision, $3::bigint),
             source_updated_at = GREATEST(source_updated_at, $2::timestamptz),
             updated_at = NOW()
         WHERE unit_projection_id = ANY($1::bigint[])
           AND deleted_at IS NULL`,
        [tombUnitIds, ts, revNum],
      );
    }
    return tombUnitIds.length;
  }

  async function applyCurriculumRecordTx(runner, payload, {
    correlationId = null,
    eventType = "curriculum.upserted",
    eventDeleted = false,
    eventDeletedAt = null,
    envelopeRevision = 1,
    sourceUpdatedAt = null,
    reconcileMissing = false,
  } = {}) {
    if (!(await hasUnitProjectionTables(runner))) {
      return { action: "skipped_schema_missing", unitsApplied: 0, staleCount: 0, tombstonedCount: 0 };
    }

    const effectiveTs = toIso(eventDeletedAt || sourceUpdatedAt || now().toISOString()) || now().toISOString();
    const revFallback = Math.max(1, Number(envelopeRevision || 1));

    // Tombstone batch path (`curriculum.tombstoned` with `beforeDeleteSnapshot`)
    if (Array.isArray(payload?.tombstonedUnits) && payload.tombstonedUnits.length > 0) {
      const remoteCourseId = payload.courseId != null ? String(payload.courseId) : null;
      const profileIds = Array.isArray(payload.profileIds) ? payload.profileIds.map(String) : [];
      const profRes = profileIds.length > 0
        ? await runner.query(
            `SELECT id, local_course_id
             FROM course_profile_projections
             WHERE source_system = $1 AND remote_profile_id = ANY($2::text[])`,
            [SOURCE_SYSTEM, profileIds],
          )
        : (remoteCourseId
            ? await runner.query(
                `SELECT id, local_course_id
                 FROM course_profile_projections
                 WHERE source_system = $1 AND remote_course_id = $2::varchar`,
                [SOURCE_SYSTEM, remoteCourseId],
              )
            : { rows: [] });

      const profIds = profRes.rows.map((r) => Number(r.id));
      const touchedCourseIds = new Set(profRes.rows.map((r) => Number(r.local_course_id)).filter(Boolean));
      let tombstonedCount = 0;

      if (profIds.length > 0) {
        for (const tu of payload.tombstonedUnits) {
          const uType = tu?.unitType === "class_session" ? "class_session" : "lesson";
          const uId = String(tu?.unitId || "").trim();
          if (!uId) continue;
          const delTs = toIso(tu?.deletedAt || effectiveTs) || effectiveTs;
          const updated = await runner.query(
            `UPDATE course_unit_projections
             SET deleted_at = COALESCE(deleted_at, $4::timestamptz),
                 is_published = FALSE,
                 last_revision = GREATEST(last_revision, $5::bigint),
                 source_updated_at = GREATEST(source_updated_at, $4::timestamptz),
                 updated_at = NOW()
             WHERE profile_projection_id = ANY($1::bigint[])
               AND unit_type = $2::varchar
               AND remote_unit_id = $3::varchar
             RETURNING id`,
            [profIds, uType, uId, delTs, revFallback],
          );
          tombstonedCount += updated.rowCount || 0;
          const ids = updated.rows.map((r) => Number(r.id));
          if (ids.length > 0) {
            await runner.query(
              `UPDATE course_file_projections
               SET deleted_at = COALESCE(deleted_at, $2::timestamptz),
                   is_published = FALSE,
                   last_revision = GREATEST(last_revision, $3::bigint),
                   source_updated_at = GREATEST(source_updated_at, $2::timestamptz),
                   updated_at = NOW()
               WHERE unit_projection_id = ANY($1::bigint[])`,
              [ids, delTs, revFallback],
            );
          }
        }
      }

      for (const cid of touchedCourseIds) {
        await refreshCourseProjectionTotalsTx(runner, cid);
      }

      return {
        action: tombstonedCount > 0 ? "tombstoned" : "processed",
        unitsApplied: 0,
        staleCount: 0,
        tombstonedCount,
      };
    }

    const profileItems = Array.isArray(payload?.profiles)
      ? payload.profiles
      : (payload?.profile ? [payload.profile] : []);
    if (profileItems.length === 0) {
      return { action: "processed", unitsApplied: 0, staleCount: 0, tombstonedCount: 0 };
    }

    let unitsApplied = 0;
    let staleCount = 0;
    let tombstonedCount = 0;
    const touchedCourseIds = new Set();

    for (const prof of profileItems) {
      const remoteProfileId = String(prof?.profileId || "").trim();
      if (!remoteProfileId) continue;

      let profProj = (
        await runner.query(
          `SELECT * FROM course_profile_projections
           WHERE source_system = $1 AND remote_profile_id = $2::varchar
           LIMIT 1
           FOR UPDATE`,
          [SOURCE_SYSTEM, remoteProfileId],
        )
      ).rows[0] || null;

      if (!profProj && payload?.course && prof?.courseId) {
        // Ensure parent course & profile exist cleanly if curriculum arrives right after catalog insert
        const ensuredCourse = await applyCourseRecordTx(runner, payload.course, { correlationId });
        const ensuredProf = await applyProfileRecordTx(runner, prof, {
          parentLocalCourse: ensuredCourse?.localCourseId
            ? (await runner.query(`SELECT * FROM courses WHERE id = $1`, [ensuredCourse.localCourseId])).rows[0]
            : null,
          correlationId,
        });
        if (ensuredProf?.profileProjectionId) {
          profProj = (
            await runner.query(`SELECT * FROM course_profile_projections WHERE id = $1`, [ensuredProf.profileProjectionId])
          ).rows[0] || null;
        }
      }

      if (!profProj) {
        throw new MolyCatalogSyncError(
          425,
          "PROFILE_PROJECTION_MISSING",
          `Profile projection ${remoteProfileId} must be synced before curriculum.`,
        );
      }

      touchedCourseIds.add(Number(profProj.local_course_id));
      const profMeta = {
        sections: Array.isArray(prof.sections) ? prof.sections : [],
        capabilities: prof.capabilities || {},
      };
      await runner.query(
        `UPDATE course_profile_projections
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1::bigint`,
        [Number(profProj.id), JSON.stringify(profMeta)],
      );

      if (eventDeleted === true || eventType === "curriculum.tombstoned" && (!Array.isArray(prof.units) || prof.units.length === 0)) {
        tombstonedCount += await reconcileProfileMissingUnitsTx(runner, {
          profileProjectionId: profProj.id,
          activeUnitKeys: [],
          revision: Math.max(revFallback, Number(prof.revision || 1)),
          deletedAt: effectiveTs,
        });
        continue;
      }

      const incomingUnits = Array.isArray(prof.units) ? prof.units : [];
      const activeKeys = [];
      for (const u of incomingUnits) {
        if (!u?.deleted) {
          const ut = u?.unitType === "class_session" ? "class_session" : "lesson";
          activeKeys.push(`${ut}:${String(u.unitId || u.remoteUnitId || "").trim()}`);
        }
        const unitRes = await upsertUnitAndFilesTx(runner, {
          profileProjectionId: profProj.id,
          localCourseId: profProj.local_course_id,
          unit: {
            ...u,
            deleted: Boolean(u.deleted || eventDeleted === true),
            deletedAt: u.deletedAt || (eventDeleted === true ? effectiveTs : null),
          },
          fallbackRevision: Math.max(revFallback, Number(prof.revision || 1)),
          defaultUpdatedAt: effectiveTs,
        });
        if (unitRes.action === "stale") staleCount += 1;
        else unitsApplied += 1;
      }

      if (reconcileMissing) {
        tombstonedCount += await reconcileProfileMissingUnitsTx(runner, {
          profileProjectionId: profProj.id,
          activeUnitKeys: activeKeys,
          revision: Math.max(revFallback, Number(prof.revision || 1)),
          deletedAt: effectiveTs,
        });
      }
    }

    for (const cid of touchedCourseIds) {
      await refreshCourseProjectionTotalsTx(runner, cid);
    }

    return {
      action: staleCount > 0 && unitsApplied === 0 && tombstonedCount === 0 ? "stale" : "updated",
      unitsApplied,
      staleCount,
      tombstonedCount,
    };
  }

  async function applyUnitContentRecordTx(runner, payload, {
    correlationId = null,
    envelopeRevision = 1,
    sourceUpdatedAt = null,
  } = {}) {
    if (!(await hasUnitProjectionTables(runner))) {
      return { action: "skipped_schema_missing", unitsApplied: 0, staleCount: 0 };
    }
    const items = Array.isArray(payload?.profiles) ? payload.profiles : [];
    let unitsApplied = 0;
    let staleCount = 0;
    const touchedCourseIds = new Set();

    for (const item of items) {
      const remoteProfileId = String(item?.profileId || "").trim();
      const unit = item?.unit;
      if (!remoteProfileId || !unit) continue;

      const profProj = (
        await runner.query(
          `SELECT * FROM course_profile_projections
           WHERE source_system = $1 AND remote_profile_id = $2::varchar
           LIMIT 1`,
          [SOURCE_SYSTEM, remoteProfileId],
        )
      ).rows[0] || null;
      if (!profProj) {
        throw new MolyCatalogSyncError(
          425,
          "PROFILE_PROJECTION_MISSING",
          `Profile projection ${remoteProfileId} must be synced before unit content.`,
        );
      }

      touchedCourseIds.add(Number(profProj.local_course_id));
      if (item.capabilities && typeof item.capabilities === "object") {
        await runner.query(
          `UPDATE course_profile_projections
           SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()
           WHERE id = $1::bigint`,
          [Number(profProj.id), JSON.stringify({ capabilities: item.capabilities })],
        );
      }

      const res = await upsertUnitAndFilesTx(runner, {
        profileProjectionId: profProj.id,
        localCourseId: profProj.local_course_id,
        unit,
        fallbackRevision: Number(unit.revision || envelopeRevision || 1),
        defaultUpdatedAt: sourceUpdatedAt,
      });
      if (res.action === "stale") staleCount += 1;
      else unitsApplied += 1;
    }

    for (const cid of touchedCourseIds) {
      await refreshCourseProjectionTotalsTx(runner, cid);
    }

    return {
      action: staleCount > 0 && unitsApplied === 0 ? "stale" : "updated",
      unitsApplied,
      staleCount,
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
        } else if (aggType === "curriculum") {
          applied = await applyCurriculumRecordTx(txClient, innerPayload, {
            correlationId: inboxRow.correlation_id,
            eventType: inboxRow.event_type,
            eventDeleted: inboxRow.deleted,
            eventDeletedAt: inboxRow.deleted_at,
            envelopeRevision: inboxRow.aggregate_revision,
            sourceUpdatedAt: inboxRow.source_updated_at,
            reconcileMissing: true,
          });
        } else if (aggType === "unit_content") {
          applied = await applyUnitContentRecordTx(txClient, innerPayload, {
            correlationId: inboxRow.correlation_id,
            envelopeRevision: inboxRow.aggregate_revision,
            sourceUpdatedAt: inboxRow.source_updated_at,
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

      let curriculumBackfill = null;
      if (typeof client?.fetchCourseCurriculum === "function" && (await hasUnitProjectionTables(db))) {
        try {
          curriculumBackfill = await runCurriculumBackfill({
            correlationId: corr,
            limit: Math.max(limit, 200),
          });
        } catch (currErr) {
          integrationLog.warn("catalog_backfill_curriculum_followup_failed", {
            message: currErr?.message,
          }, corr);
        }
      }

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
        curriculumBackfill,
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

  /**
   * Pulls Day 3 curriculum metadata across all (or one specified) synced csca_course
   * offerings via signed v2 HTTP into `course_unit_projections` and `course_file_projections`,
   * never writing to native `course_lessons` or `course_sections`.
   */
  async function runCurriculumBackfill({
    courseId = null,
    remoteCourseId = null,
    profileId = null,
    limit = 200,
    maxPages = MAX_BACKFILL_PAGES,
    correlationId = null,
  } = {}) {
    if (!(await hasCatalogSyncTables(db)) || !(await hasUnitProjectionTables(db))) {
      throw new MolyCatalogSyncError(503, "CATALOG_SYNC_SCHEMA_MISSING", "Unit projection sync tables are not migrated.");
    }
    if (!client || typeof client.fetchCourseCurriculum !== "function") {
      throw new MolyCatalogSyncError(503, "COURSE_CLIENT_UNAVAILABLE", "CSCA-Course curriculum client is unavailable.");
    }
    const corr = resolveCorrelationId(correlationId);
    if (isCatalogSyncKillSwitchActive(env)) {
      return { paused: true, reason: "kill_switch", coursesProcessed: 0, unitsApplied: 0, tombstonedCount: 0 };
    }

    let targets = [];
    if (remoteCourseId != null && String(remoteCourseId).trim()) {
      targets = [String(remoteCourseId).trim()];
    } else if (courseId != null) {
      const cRes = await db.query(
        `SELECT DISTINCT COALESCE(cpp.remote_course_id, REPLACE(c.external_key, 'csca-course:', '')) AS rc_id
         FROM courses c
         LEFT JOIN course_profile_projections cpp ON cpp.local_course_id = c.id AND cpp.source_system = $2
         WHERE c.id = $1::bigint AND c.content_origin = 'csca_course'`,
        [Number(courseId), SOURCE_SYSTEM],
      );
      targets = cRes.rows.map((r) => String(r.rc_id || "").trim()).filter((v) => /^\d+$/.test(v));
    } else {
      const allRes = await db.query(
        `SELECT DISTINCT COALESCE(cpp.remote_course_id, REPLACE(c.external_key, 'csca-course:', '')) AS rc_id
         FROM courses c
         LEFT JOIN course_profile_projections cpp ON cpp.local_course_id = c.id AND cpp.source_system = $1
         WHERE c.content_origin = 'csca_course'
           AND c.tombstoned_at IS NULL`,
        [SOURCE_SYSTEM],
      );
      targets = allRes.rows.map((r) => String(r.rc_id || "").trim()).filter((v) => /^\d+$/.test(v));
    }

    let coursesProcessed = 0;
    let pagesProcessed = 0;
    let unitsApplied = 0;
    let staleCount = 0;
    let tombstonedCount = 0;

    for (const rcId of targets) {
      const cpStream = `course-curriculum:${rcId}`;
      await db.query(
        `INSERT INTO course_sync_checkpoints (stream_name, source_system, sync_status)
         VALUES ($1, $2, 'backfilling')
         ON CONFLICT (stream_name) DO UPDATE SET sync_status = 'backfilling', updated_at = NOW()`,
        [cpStream, SOURCE_SYSTEM],
      );

      let cursor = null;
      let sweepCompleted = false;
      const seenActiveByProfile = new Map();
      const maxRevByProfile = new Map();

      try {
        for (let page = 0; page < maxPages; page += 1) {
          const pageData = await client.fetchCourseCurriculum({
            courseId: rcId,
            profileId: profileId || undefined,
            cursor,
            limit,
            includeTombstoned: true,
            correlationId: corr,
          });
          pagesProcessed += 1;
          const pageProfiles = Array.isArray(pageData?.profiles) ? pageData.profiles : [];
          for (const p of pageProfiles) {
            const pIdStr = String(p.profileId || "");
            if (!seenActiveByProfile.has(pIdStr)) seenActiveByProfile.set(pIdStr, new Set());
            const set = seenActiveByProfile.get(pIdStr);
            for (const u of p.units || []) {
              const rev = Number(u?.revision || 1);
              maxRevByProfile.set(pIdStr, Math.max(rev, maxRevByProfile.get(pIdStr) || 1));
              if (!u.deleted) {
                const ut = u?.unitType === "class_session" ? "class_session" : "lesson";
                set.add(`${ut}:${String(u.unitId || "").trim()}`);
              }
            }
          }

          const outcome = await withTx((txClient) =>
            applyCurriculumRecordTx(txClient, pageData, {
              correlationId: corr,
              eventType: "curriculum.upserted",
              envelopeRevision: pageData?.course?.revision || 1,
              sourceUpdatedAt: now().toISOString(),
              reconcileMissing: false,
            }),
          );
          unitsApplied += outcome.unitsApplied || 0;
          staleCount += outcome.staleCount || 0;

          const hasMore = Boolean(pageData?.pagination?.hasMore);
          cursor = hasMore ? (pageData?.pagination?.nextCursor || null) : null;
          if (!hasMore || !cursor) {
            sweepCompleted = true;
            break;
          }
        }

        if (sweepCompleted) {
          const reconciled = await withTx(async (txClient) => {
            let removed = 0;
            const touchedLocalCourses = new Set();
            for (const [pIdStr, activeSet] of seenActiveByProfile.entries()) {
              const pRow = (
                await txClient.query(
                  `SELECT id, local_course_id FROM course_profile_projections WHERE source_system = $1 AND remote_profile_id = $2::varchar LIMIT 1`,
                  [SOURCE_SYSTEM, pIdStr],
                )
              ).rows[0];
              if (!pRow) continue;
              touchedLocalCourses.add(Number(pRow.local_course_id));
              removed += await reconcileProfileMissingUnitsTx(txClient, {
                profileProjectionId: pRow.id,
                activeUnitKeys: [...activeSet],
                revision: maxRevByProfile.get(pIdStr) || 1,
                deletedAt: now().toISOString(),
              });
            }
            for (const cid of touchedLocalCourses) {
              await refreshCourseProjectionTotalsTx(txClient, cid);
            }
            return removed;
          });
          tombstonedCount += reconciled;
        }

        await db.query(
          `UPDATE course_sync_checkpoints
           SET sync_status = 'idle', last_cursor = NULL, last_synced_at = NOW(), last_error_code = NULL, last_error_message = NULL
           WHERE stream_name = $1`,
          [cpStream],
        );
        coursesProcessed += 1;
      } catch (err) {
        await db.query(
          `UPDATE course_sync_checkpoints
           SET sync_status = 'error', last_error_code = $2, last_error_message = $3
           WHERE stream_name = $1`,
          [cpStream, String(err?.code || err?.errorCode || "CURRICULUM_BACKFILL_ERROR").slice(0, 80), String(err?.message || "Failed").slice(0, 1000)],
        ).catch(() => {});
        throw err;
      }
    }

    return {
      paused: false,
      coursesProcessed,
      pagesProcessed,
      unitsApplied,
      staleCount,
      tombstonedCount,
    };
  }

  return {
    MolyCatalogSyncError,
    normalizeSubjectCode,
    normalizeCourseLevel,
    validateEnvelope,
    hasCatalogSyncTables,
    hasUnitProjectionTables,
    ingestCatalogEvents,
    processAvailableInboxJobs,
    runCatalogBackfill,
    runCurriculumBackfill,
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
