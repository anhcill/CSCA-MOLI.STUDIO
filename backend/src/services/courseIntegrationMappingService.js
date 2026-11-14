const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");

const ALLOWED_SOURCE_SYSTEMS = new Set(["moly", "csca-course", "internal-management"]);
const COURSE_MAPPING_STATUSES = new Set(["active", "inactive", "archived"]);
const EXTERNAL_ENTITLEMENT_STATUSES = new Set(["active", "revoked", "expired", "suspended"]);

function fail(status, code, message, details = undefined) {
  throw new CourseApiError(status, code, message, details);
}

function normalizeSourceSystem(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!ALLOWED_SOURCE_SYSTEMS.has(normalized)) {
    fail(
      422,
      "INVALID_SOURCE_SYSTEM",
      "sourceSystem must be one of: moly, csca-course, internal-management.",
    );
  }
  return normalized;
}

function normalizeExternalId(value, fieldName, maxLength = 128) {
  if (typeof value !== "string") {
    fail(422, "VALIDATION_ERROR", `${fieldName} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    fail(422, "VALIDATION_ERROR", `${fieldName} must contain between 1 and ${maxLength} characters.`);
  }
  return trimmed;
}

function normalizeOptionalText(value, maxLength, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fail(422, "VALIDATION_ERROR", `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    fail(422, "VALIDATION_ERROR", `${fieldName} exceeds ${maxLength} characters.`);
  }
  return trimmed;
}

function parsePositiveId(value, fieldName = "id") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail(422, "VALIDATION_ERROR", `${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function normalizeTimestamp(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);
  if (value === undefined || value === null || Number.isNaN(date.getTime())) {
    fail(422, "VALIDATION_ERROR", `${fieldName} must be a valid ISO timestamp.`);
  }
  return date;
}

function normalizeNullableTimestamp(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeTimestamp(value, fieldName);
}

function normalizeJsonObject(value, fieldName) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    fail(422, "VALIDATION_ERROR", `${fieldName} must be a JSON object.`);
  }
  return value;
}

function formatMappingRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sourceSystem: row.source_system,
    externalCourseId: row.external_course_id,
    externalCourseCode: row.external_course_code || null,
    externalCourseTitle: row.external_course_title || null,
    localCourseId: Number(row.local_course_id),
    localCourseTitle: row.local_course_title || null,
    localCourseSlug: row.local_course_slug || null,
    localVideoPackageId: row.local_video_package_id == null ? null : Number(row.local_video_package_id),
    status: row.status,
    mappingSource: row.mapping_source,
    sourceUpdatedAt: row.source_updated_at,
    notes: row.notes || null,
    createdBy: row.created_by == null ? null : Number(row.created_by),
    updatedBy: row.updated_by == null ? null : Number(row.updated_by),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Factory creating Moly-side manual course mapping & integration freshness service.
 */
function createCourseIntegrationMappingService(db) {
  async function transaction(work) {
    if (typeof db.transaction === "function") return db.transaction(work);
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Creates or updates an explicit manual course mapping. Never matches by title or slug.
   */
  async function upsertManualCourseMapping(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      fail(422, "VALIDATION_ERROR", "Expected a mapping payload object.");
    }
    if (input.autoMatch === true) {
      fail(
        422,
        "AUTO_MAPPING_FORBIDDEN",
        "Automatic course matching by title or slug is disabled; supply explicit localCourseId.",
      );
    }

    const sourceSystem = normalizeSourceSystem(input.sourceSystem);
    const externalCourseId = normalizeExternalId(input.externalCourseId, "externalCourseId");
    const localCourseId = parsePositiveId(input.localCourseId, "localCourseId");
    const localVideoPackageId = input.localVideoPackageId == null
      ? null
      : parsePositiveId(input.localVideoPackageId, "localVideoPackageId");
    const status = typeof input.status === "string" ? input.status.trim().toLowerCase() : "active";
    if (!COURSE_MAPPING_STATUSES.has(status)) {
      fail(422, "VALIDATION_ERROR", "status must be one of: active, inactive, archived.");
    }
    const mappingSource = typeof input.mappingSource === "string"
      ? input.mappingSource.trim().toLowerCase()
      : "manual";
    if (!["manual", "admin_manual"].includes(mappingSource)) {
      fail(422, "AUTO_MAPPING_FORBIDDEN", "mappingSource must be manual or admin_manual.");
    }

    const externalCourseCode = normalizeOptionalText(input.externalCourseCode, 128, "externalCourseCode");
    const externalCourseTitle = normalizeOptionalText(input.externalCourseTitle, 255, "externalCourseTitle");
    const notes = normalizeOptionalText(input.notes, 2000, "notes");
    const metadata = normalizeJsonObject(input.metadata, "metadata");
    const actorId = input.actorId == null ? null : parsePositiveId(input.actorId, "actorId");
    const sourceUpdatedAt = input.sourceUpdatedAt
      ? normalizeTimestamp(input.sourceUpdatedAt, "sourceUpdatedAt")
      : new Date();

    return transaction(async (tx) => {
      const courseRes = await tx.query(
        "SELECT id, title, slug FROM courses WHERE id = $1",
        [localCourseId],
      );
      const localCourse = courseRes.rows[0];
      if (!localCourse) {
        fail(404, "COURSE_NOT_FOUND", `Local course ${localCourseId} does not exist.`);
      }

      if (localVideoPackageId !== null) {
        const hasPkgTable = (await tx.query("SELECT to_regclass('video_packages') AS rel")).rows[0]?.rel;
        if (!hasPkgTable) {
          fail(422, "VIDEO_PACKAGE_SCHEMA_MISSING", "video_packages table is not installed.");
        }
        const pkgRes = await tx.query("SELECT id FROM video_packages WHERE id = $1", [localVideoPackageId]);
        if (!pkgRes.rows[0]) {
          fail(404, "VIDEO_PACKAGE_NOT_FOUND", `Video package ${localVideoPackageId} does not exist.`);
        }
        const linkedCourses = await tx.query(
          "SELECT course_id FROM video_package_courses WHERE video_package_id = $1",
          [localVideoPackageId],
        );
        if (
          linkedCourses.rows.length > 0 &&
          !linkedCourses.rows.some((row) => Number(row.course_id) === localCourseId)
        ) {
          fail(
            422,
            "VIDEO_PACKAGE_COURSE_MISMATCH",
            "localVideoPackageId is not linked to the specified localCourseId.",
          );
        }
      }

      const upsertRes = await tx.query(
        `INSERT INTO external_course_mappings (
           source_system, external_course_id, external_course_code, external_course_title,
           local_course_id, local_video_package_id, status, mapping_source,
           source_updated_at, notes, created_by, updated_by, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12::jsonb)
         ON CONFLICT (source_system, external_course_id) DO UPDATE SET
           external_course_code = COALESCE(EXCLUDED.external_course_code, external_course_mappings.external_course_code),
           external_course_title = COALESCE(EXCLUDED.external_course_title, external_course_mappings.external_course_title),
           local_course_id = EXCLUDED.local_course_id,
           local_video_package_id = EXCLUDED.local_video_package_id,
           status = EXCLUDED.status,
           mapping_source = EXCLUDED.mapping_source,
           source_updated_at = EXCLUDED.source_updated_at,
           notes = COALESCE(EXCLUDED.notes, external_course_mappings.notes),
           updated_by = EXCLUDED.updated_by,
           metadata = external_course_mappings.metadata || EXCLUDED.metadata
         WHERE external_course_mappings.source_updated_at <= EXCLUDED.source_updated_at
         RETURNING *`,
        [
          sourceSystem,
          externalCourseId,
          externalCourseCode,
          externalCourseTitle,
          localCourseId,
          localVideoPackageId,
          status,
          mappingSource,
          sourceUpdatedAt.toISOString(),
          notes,
          actorId,
          JSON.stringify(metadata),
        ],
      );

      if (!upsertRes.rows[0]) {
        fail(409, "STALE_EVENT", "A newer manual mapping already exists.");
      }
      return formatMappingRow({
        ...upsertRes.rows[0],
        local_course_title: localCourse.title,
        local_course_slug: localCourse.slug,
      });
    });
  }

  /**
   * Resolves an external course ID strictly via manual mappings.
   * Throws COURSE_MAPPING_MISSING when unmapped or inactive.
   */
  async function resolveExternalCourseMapping({ sourceSystem, externalCourseId, requireActive = true } = {}) {
    const normalizedSource = normalizeSourceSystem(sourceSystem);
    const normalizedExternalCourseId = normalizeExternalId(externalCourseId, "externalCourseId");

    const result = await db.query(
      `SELECT m.*, c.title AS local_course_title, c.slug AS local_course_slug
       FROM external_course_mappings m
       JOIN courses c ON c.id = m.local_course_id
       WHERE m.source_system = $1
         AND m.external_course_id = $2
         AND ($3::boolean = FALSE OR m.status = 'active')
       LIMIT 1`,
      [normalizedSource, normalizedExternalCourseId, Boolean(requireActive)],
    );

    const row = result.rows[0];
    if (!row) {
      fail(
        422,
        "COURSE_MAPPING_MISSING",
        `No active manual course mapping found for (${normalizedSource}, ${normalizedExternalCourseId}).`,
        { sourceSystem: normalizedSource, externalCourseId: normalizedExternalCourseId },
      );
    }
    return formatMappingRow(row);
  }

  async function resolveLocalCourseToExternal({ sourceSystem, localCourseId, localVideoPackageId = null } = {}) {
    const normalizedSource = normalizeSourceSystem(sourceSystem);
    const parsedCourseId = parsePositiveId(localCourseId, "localCourseId");
    const parsedPackageId = localVideoPackageId == null
      ? null
      : parsePositiveId(localVideoPackageId, "localVideoPackageId");

    const result = await db.query(
      `SELECT m.*, c.title AS local_course_title, c.slug AS local_course_slug
       FROM external_course_mappings m
       JOIN courses c ON c.id = m.local_course_id
       WHERE m.source_system = $1
         AND m.local_course_id = $2
         AND m.status = 'active'
         AND ($3::bigint IS NULL OR m.local_video_package_id = $3)
       ORDER BY m.id ASC`,
      [normalizedSource, parsedCourseId, parsedPackageId],
    );

    if (result.rows.length === 0) {
      fail(
        422,
        "COURSE_MAPPING_MISSING",
        `No active manual course mapping found for local course ${parsedCourseId} and source ${normalizedSource}.`,
        { sourceSystem: normalizedSource, localCourseId: parsedCourseId },
      );
    }
    return result.rows.map(formatMappingRow);
  }

  async function listCourseMappings(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.sourceSystem) {
      params.push(normalizeSourceSystem(filters.sourceSystem));
      conditions.push(`m.source_system = $${params.length}`);
    }
    if (filters.status) {
      const status = String(filters.status).trim().toLowerCase();
      if (!COURSE_MAPPING_STATUSES.has(status)) {
        fail(422, "VALIDATION_ERROR", "Invalid course mapping status filter.");
      }
      params.push(status);
      conditions.push(`m.status = $${params.length}`);
    }
    if (filters.localCourseId != null) {
      params.push(parsePositiveId(filters.localCourseId, "localCourseId"));
      conditions.push(`m.local_course_id = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT m.*, c.title AS local_course_title, c.slug AS local_course_slug
       FROM external_course_mappings m
       JOIN courses c ON c.id = m.local_course_id
       ${whereClause}
       ORDER BY m.updated_at DESC, m.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return result.rows.map(formatMappingRow);
  }

  async function updateCourseMappingStatus({ id, status, notes, actorId } = {}) {
    const mappingId = parsePositiveId(id, "id");
    const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
    if (!COURSE_MAPPING_STATUSES.has(normalizedStatus)) {
      fail(422, "VALIDATION_ERROR", "status must be active, inactive, or archived.");
    }
    const normalizedNotes = normalizeOptionalText(notes, 2000, "notes");
    const parsedActorId = actorId == null ? null : parsePositiveId(actorId, "actorId");

    const result = await db.query(
      `UPDATE external_course_mappings
       SET status = $1,
           notes = COALESCE($2, notes),
           updated_by = $3,
           source_updated_at = GREATEST(source_updated_at, NOW())
       WHERE id = $4
       RETURNING *`,
      [normalizedStatus, normalizedNotes, parsedActorId, mappingId],
    );
    if (!result.rows[0]) {
      fail(404, "NOT_FOUND", `Course mapping ${mappingId} not found.`);
    }
    return formatMappingRow(result.rows[0]);
  }

  /**
   * Records an entitlement event in integration_inbox and updates external_entitlements
   * monotonically by source_updated_at. Older source_updated_at events are marked stale.
   */
  async function ingestEntitlementWithFreshnessGuard(input = {}) {
    const sourceSystem = normalizeSourceSystem(input.sourceSystem);
    const eventId = normalizeExternalId(input.eventId, "eventId");
    const idempotencyKey = normalizeExternalId(input.idempotencyKey, "idempotencyKey", 180);
    const correlationId = normalizeOptionalText(input.correlationId, 128, "correlationId");
    const externalGrantId = normalizeExternalId(input.externalGrantId, "externalGrantId");
    const externalUserId = normalizeExternalId(input.externalUserId, "externalUserId");
    const externalCourseId = normalizeExternalId(input.externalCourseId, "externalCourseId");
    const userId = parsePositiveId(input.userId, "userId");
    const status = typeof input.status === "string" ? input.status.trim().toLowerCase() : "";
    if (!EXTERNAL_ENTITLEMENT_STATUSES.has(status)) {
      fail(422, "INVALID_ENTITLEMENT_STATUS", "Invalid entitlement status.");
    }
    const validFrom = normalizeTimestamp(input.validFrom, "validFrom");
    const validUntil = normalizeNullableTimestamp(input.validUntil, "validUntil");
    if (validUntil && validUntil <= validFrom) {
      fail(422, "VALIDATION_ERROR", "validUntil must be later than validFrom.");
    }
    const sourceUpdatedAt = normalizeTimestamp(input.sourceUpdatedAt, "sourceUpdatedAt");
    const revokedAt = status === "revoked"
      ? normalizeTimestamp(input.revokedAt || sourceUpdatedAt, "revokedAt")
      : null;
    const revokeReason = normalizeOptionalText(input.revokeReason, 500, "revokeReason");
    const metadata = normalizeJsonObject(input.metadata, "metadata");
    const payload = {
      sourceSystem, externalGrantId, externalUserId, externalCourseId, userId,
      status, validFrom: validFrom.toISOString(),
      validUntil: validUntil ? validUntil.toISOString() : null,
      revokedAt: revokedAt ? revokedAt.toISOString() : null,
      revokeReason, sourceUpdatedAt: sourceUpdatedAt.toISOString(), metadata,
    };
    // JSON object key order must not turn a semantically identical retry into a conflict.
    const canonicalJson = (value) => {
      if (Array.isArray(value)) return value.map(canonicalJson);
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
      }
      return value;
    };
    const payloadHash = crypto.createHash("sha256")
      .update(JSON.stringify(canonicalJson(payload))).digest("hex");

    return transaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO integration_inbox
          (source_system,event_id,idempotency_key,correlation_id,event_type,payload_hash,payload,source_updated_at,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'processing')
         ON CONFLICT DO NOTHING RETURNING *`,
        [sourceSystem,eventId,idempotencyKey,correlationId,
          status === "revoked" ? "entitlement.revoked" : "entitlement.changed",
          payloadHash,JSON.stringify(payload),sourceUpdatedAt.toISOString()],
      );
      if (!inserted.rows[0]) {
        const existing = (await tx.query(
          `SELECT * FROM integration_inbox WHERE source_system=$1
           AND (event_id=$2 OR idempotency_key=$3) ORDER BY id`,
          [sourceSystem,eventId,idempotencyKey],
        )).rows;
        if (existing.length !== 1 || existing[0].payload_hash !== payloadHash) {
          fail(409, "IDEMPOTENCY_KEY_CONFLICT", "Event ID or idempotency key is already bound to another payload.");
        }
        return { outcome: "duplicate", inbox: existing[0], entitlement: null };
      }
      const inbox = inserted.rows[0];
      // Serialize even the first insert: FOR UPDATE alone cannot lock a missing grant.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
        [sourceSystem,externalGrantId]);
      const current = (await tx.query(
        "SELECT * FROM external_entitlements WHERE source_system=$1 AND external_grant_id=$2 FOR UPDATE",
        [sourceSystem,externalGrantId],
      )).rows[0] || null;
      if (current && (current.external_user_id !== externalUserId ||
          current.external_course_id !== externalCourseId || Number(current.user_id) !== userId)) {
        fail(409, "ENTITLEMENT_CONFLICT", "A grant cannot be reassigned to another user or offering.");
      }
      if (current && new Date(current.source_updated_at).getTime() >= sourceUpdatedAt.getTime()) {
        const stale = (await tx.query(
          `UPDATE integration_inbox SET status='stale',processed_at=NOW(),
            last_error_code='STALE_EVENT',last_error_message='A strictly newer source_updated_at is required.'
           WHERE id=$1 RETURNING *`, [inbox.id],
        )).rows[0];
        return { outcome: "stale", inbox: stale, entitlement: current };
      }

      const identity = (await tx.query(
        `SELECT * FROM external_identities WHERE source_system=$1 AND external_user_id=$2 FOR SHARE`,
        [sourceSystem,externalUserId],
      )).rows[0];
      if (!identity || Number(identity.user_id) !== userId ||
          (status === "active" && identity.status !== "active")) {
        fail(409, "UNRESOLVED_IDENTITY", "A verified identity mapping is required for this user.");
      }

      // Revocation uses the grant's saved destination even after a catalog mapping is disabled or changed.
      let mappingId = current?.course_mapping_id;
      let localCourseId = current?.local_course_id;
      if (!current || status === "active") {
        const mapping = (await tx.query(
          `SELECT * FROM external_course_mappings WHERE source_system=$1 AND external_course_id=$2
           AND status='active' FOR SHARE`, [sourceSystem,externalCourseId],
        )).rows[0];
        if (!mapping) {
          fail(422, "COURSE_MAPPING_MISSING", "No active manual course mapping exists for this offering.");
        }
        if (current && Number(current.local_course_id) !== Number(mapping.local_course_id)) {
          fail(409, "ENTITLEMENT_CONFLICT", "The mapping destination changed; this grant requires manual review.");
        }
        mappingId = mapping.id;
        localCourseId = mapping.local_course_id;
      }
      const entitlement = (await tx.query(
        `INSERT INTO external_entitlements
          (source_system,external_grant_id,external_user_id,external_course_id,user_id,local_course_id,
           course_mapping_id,external_identity_id,status,valid_from,valid_until,revoked_at,revoke_reason,
           source_updated_at,last_event_id,correlation_id,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
         ON CONFLICT (source_system,external_grant_id) DO UPDATE SET
           status=EXCLUDED.status,valid_from=EXCLUDED.valid_from,valid_until=EXCLUDED.valid_until,
           revoked_at=EXCLUDED.revoked_at,revoke_reason=EXCLUDED.revoke_reason,
           external_identity_id=EXCLUDED.external_identity_id,
           source_updated_at=EXCLUDED.source_updated_at,last_event_id=EXCLUDED.last_event_id,
           correlation_id=EXCLUDED.correlation_id,metadata=external_entitlements.metadata || EXCLUDED.metadata
         WHERE external_entitlements.source_updated_at < EXCLUDED.source_updated_at RETURNING *`,
        [sourceSystem,externalGrantId,externalUserId,externalCourseId,userId,localCourseId,
          mappingId,identity.id,status,validFrom.toISOString(),validUntil?.toISOString() || null,
          revokedAt?.toISOString() || null,status === "revoked" ? revokeReason : null,
          sourceUpdatedAt.toISOString(),eventId,correlationId,JSON.stringify(metadata)],
      )).rows[0];
      if (!entitlement) {
        fail(409, "ENTITLEMENT_CONFLICT", "Concurrent entitlement update; retry with the same event.");
      }
      const processed = (await tx.query(
        "UPDATE integration_inbox SET status='processed',processed_at=NOW() WHERE id=$1 RETURNING *",
        [inbox.id],
      )).rows[0];
      return { outcome: "applied", inbox: processed, entitlement };
    });
  }

  return {
    upsertManualCourseMapping,
    resolveExternalCourseMapping,
    resolveLocalCourseToExternal,
    listCourseMappings,
    updateCourseMappingStatus,
    ingestEntitlementWithFreshnessGuard,
  };
}

module.exports = {
  ALLOWED_SOURCE_SYSTEMS,
  COURSE_MAPPING_STATUSES,
  EXTERNAL_ENTITLEMENT_STATUSES,
  createCourseIntegrationMappingService,
};
