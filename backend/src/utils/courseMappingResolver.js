/**
 * Shared resolution helpers for external course / offering mappings across
 * legacy manual `moly:` mappings and Full Sync v2 `csca-course` profile projections.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Returns true if the mapping row represents a course-level `catalog_auto` container
 * (`course:<id>`) rather than a sellable/entitleable profile or manual offering.
 */
function isCatalogAutoContainerMapping(row) {
  if (!row) return false;
  const meta = isPlainObject(row.metadata) ? row.metadata : {};
  const originMode = String(row.origin_mode || meta.originMode || "").trim().toLowerCase();
  const extId = typeof row.external_course_id === "string" ? row.external_course_id.trim() : "";
  if (meta.moly_external_course_id || row.remote_profile_id || meta.remoteProfileId) {
    return false;
  }
  if (originMode === "catalog_auto") return true;
  if (row.source_system === "csca-course" && extId.startsWith("course:")) {
    return true;
  }
  return false;
}

/**
 * Resolves the canonical external offering identifier for a mapping row.
 * Supports:
 * 1. Explicit `metadata.moly_external_course_id` (`moly:...`)
 * 2. Legacy `source_system = 'moly'` (`moly:...`)
 * 3. Full Sync v2 `csca-course` profile projections (`profile:<id>`, `origin_mode = 'profile_projection'`,
 *    `remote_profile_id`, `metadata.remoteProfileId`, or non-course offering IDs with `metadata.remoteCourseId`)
 */
function resolveOfferingIdFromMapping(row) {
  if (!row) return null;
  const meta = isPlainObject(row.metadata) ? row.metadata : {};

  if (typeof meta.moly_external_course_id === "string") {
    const dualId = meta.moly_external_course_id.trim();
    if (dualId.startsWith("moly:") && dualId.length > 5) {
      return dualId;
    }
  }

  const rawExtId = typeof row.external_course_id === "string" ? row.external_course_id.trim() : "";
  if (row.source_system === "moly") {
    return rawExtId.startsWith("moly:") && rawExtId.length > 5 ? rawExtId : null;
  }

  if (row.source_system === "csca-course") {
    if (isCatalogAutoContainerMapping(row)) {
      return null;
    }
    const remoteProfileId = String(row.remote_profile_id || meta.remoteProfileId || "").trim();
    const originMode = String(row.origin_mode || "").trim().toLowerCase();
    const hasCourseMeta = meta.remoteCourseId !== undefined && meta.remoteCourseId !== null && String(meta.remoteCourseId).trim() !== "";
    const isProfileProjection =
      originMode === "profile_projection"
      || rawExtId.startsWith("profile:")
      || remoteProfileId.length > 0
      || (rawExtId.length > 0 && !rawExtId.startsWith("course:") && hasCourseMeta);

    if (!isProfileProjection) return null;
    if (rawExtId.length > 0 && !rawExtId.startsWith("course:")) {
      return rawExtId;
    }
    if (remoteProfileId.length > 0) {
      return `profile:${remoteProfileId}`;
    }
  }

  return null;
}

/**
 * Detects whether v2 columns (`origin_mode`, `remote_profile_id`, `deleted_at`) exist on `external_course_mappings`.
 */
async function detectMappingSchemaColumns(runner) {
  try {
    const res = await runner.query(
      `SELECT attname AS column_name
       FROM pg_attribute
       WHERE attrelid = to_regclass('external_course_mappings')
         AND NOT attisdropped
         AND attname = ANY($1::text[])`,
      [["origin_mode", "remote_course_id", "remote_profile_id", "deleted_at"]],
    );
    const cols = new Set((res.rows || []).map((r) => r.column_name));
    return {
      hasOriginMode: cols.has("origin_mode"),
      hasRemoteCourseId: cols.has("remote_course_id"),
      hasRemoteProfileId: cols.has("remote_profile_id"),
      hasDeletedAt: cols.has("deleted_at"),
    };
  } catch {
    return {
      hasOriginMode: false,
      hasRemoteCourseId: false,
      hasRemoteProfileId: false,
      hasDeletedAt: false,
    };
  }
}

/**
 * Builds a schema-safe SQL predicate matching active legacy `moly:` and v2 `csca-course` profile mappings.
 */
function buildActiveOfferingMappingSqlPredicate(alias = "ecm", schemaCols = {}) {
  const prefix = alias ? `${alias}.` : "";
  const deletedClause = schemaCols.hasDeletedAt ? `AND ${prefix}deleted_at IS NULL` : "";
  const originClause = schemaCols.hasOriginMode ? `OR ${prefix}origin_mode = 'profile_projection'` : "";
  const profileColClause = schemaCols.hasRemoteProfileId ? `OR ${prefix}remote_profile_id IS NOT NULL` : "";

  return `(
    ${prefix}status = 'active'
    ${deletedClause}
    AND (
      ${prefix}source_system = 'moly'
      OR (
        ${prefix}source_system = 'csca-course'
        AND (
          (${prefix}metadata ? 'moly_external_course_id')
          OR ${prefix}external_course_id LIKE 'profile:%'
          OR (${prefix}metadata ? 'remoteProfileId')
          OR (${prefix}external_course_id NOT LIKE 'course:%' AND (${prefix}metadata ? 'remoteCourseId'))
          ${originClause}
          ${profileColClause}
        )
      )
    )
  )`;
}

/**
 * Queries candidate offering mappings across legacy `moly:` and v2 `csca-course` profile projections.
 */
async function queryOfferingMappings(
  runner,
  { localCourseIds = null, activeOnly = true, videoPackageId = null } = {},
) {
  const cleanIds = Array.isArray(localCourseIds)
    ? [...new Set(localCourseIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
    : [];
  const hasFilter = cleanIds.length > 0;
  const cols = await detectMappingSchemaColumns(runner);
  const pkgId = videoPackageId != null && Number.isSafeInteger(Number(videoPackageId))
    ? Number(videoPackageId)
    : null;

  const selectCols = [
    "id",
    "source_system",
    "external_course_id",
    "local_course_id",
    "local_video_package_id",
    "status",
    "metadata",
    cols.hasOriginMode ? "origin_mode" : "NULL::varchar AS origin_mode",
    cols.hasRemoteCourseId ? "remote_course_id" : "NULL::varchar AS remote_course_id",
    cols.hasRemoteProfileId ? "remote_profile_id" : "NULL::varchar AS remote_profile_id",
    cols.hasDeletedAt ? "deleted_at" : "NULL::timestamptz AS deleted_at",
  ];

  const v2ProfileSql = [
    "(metadata ? 'moly_external_course_id')",
    "external_course_id LIKE 'profile:%'",
    "(metadata ? 'remoteProfileId')",
    "(external_course_id NOT LIKE 'course:%' AND (metadata ? 'remoteCourseId'))",
    cols.hasOriginMode ? "origin_mode = 'profile_projection'" : null,
    cols.hasRemoteProfileId ? "remote_profile_id IS NOT NULL" : null,
  ].filter(Boolean).join(" OR ");

  const deletedFilter = cols.hasDeletedAt ? "AND deleted_at IS NULL" : "";
  const statusFilter = activeOnly ? "AND status = 'active'" : "";

  const rows = (
    await runner.query(
      `SELECT ${selectCols.join(", ")}
       FROM external_course_mappings
       WHERE ($1::boolean = FALSE OR local_course_id = ANY($2::bigint[]))
         ${statusFilter}
         ${deletedFilter}
         AND (
           source_system = 'moly'
           OR (source_system = 'csca-course' AND (${v2ProfileSql}))
         )
       ORDER BY
         (local_video_package_id IS NOT NULL AND local_video_package_id = $3) DESC,
         (local_video_package_id IS NULL) DESC,
         (source_system = 'moly' OR (metadata ? 'moly_external_course_id')) DESC,
         (COALESCE(metadata->>'mode', '') = 'INDEPENDENT') DESC,
         id ASC`,
      [hasFilter, cleanIds, pkgId],
    )
  ).rows;

  return rows
    .map((row) => ({
      ...row,
      offering_id: resolveOfferingIdFromMapping(row),
    }))
    .filter((row) => Boolean(row.offering_id));
}

module.exports = {
  isCatalogAutoContainerMapping,
  resolveOfferingIdFromMapping,
  detectMappingSchemaColumns,
  buildActiveOfferingMappingSqlPredicate,
  queryOfferingMappings,
};
