const db = require("../config/database");
const {
  buildActiveOfferingMappingSqlPredicate,
  detectMappingSchemaColumns,
} = require("../utils/courseMappingResolver");

async function hasCoursesContentOriginColumn() {
  try {
    const res = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'courses'
           AND column_name = 'content_origin'
       ) AS has_origin`,
    );
    return Boolean(res.rows[0]?.has_origin);
  } catch {
    return false;
  }
}

async function listUserEnrollments(userId) {
  const hasOrigin = await hasCoursesContentOriginColumn();
  const originFilter = hasOrigin
    ? "AND COALESCE(c.content_origin, 'moly_native') <> 'csca_course'"
    : "";
  const result = await db.query(
    `SELECT
       e.*,
       c.id AS catalog_course_id, c.status AS course_status,
       c.external_key, c.slug, c.title, c.short_description, c.description,
       c.subject_code, c.level, c.thumbnail_url, c.access_type,
       c.price_vnd, c.compare_at_price_vnd, c.is_featured, c.is_new, c.is_hot,
       c.rating_avg, c.rating_count, c.enrolled_count, c.total_sections,
       c.total_lessons, c.total_duration_seconds, c.published_at, c.content_updated_at,
       COALESCE(p.completed_lessons, 0)::int AS completed_lessons,
       COALESCE(p.total_lessons, 0)::int AS progress_total_lessons,
       COALESCE(p.course_completion_pct, 0)::numeric AS course_completion_pct,
       p.last_lesson_id, p.last_lesson_title,
       COALESCE(p.last_position_seconds, 0)::int AS progress_last_position_seconds,
       p.last_activity_at
     FROM course_enrollments e
     JOIN courses c ON c.id = e.course_id AND c.status = 'published'
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE l.is_required)::int AS total_lessons,
         COUNT(*) FILTER (WHERE l.is_required AND lp.status = 'completed')::int AS completed_lessons,
         CASE WHEN COUNT(*) FILTER (WHERE l.is_required) > 0
           THEN SUM(CASE WHEN l.is_required THEN COALESCE(lp.completion_pct, 0) ELSE 0 END)
             / COUNT(*) FILTER (WHERE l.is_required)
           ELSE 0 END AS course_completion_pct,
         recent.lesson_id AS last_lesson_id,
         recent.lesson_title AS last_lesson_title,
         recent.last_position_seconds,
         recent.updated_at AS last_activity_at
       FROM course_lessons l
       JOIN course_sections s
         ON s.id = l.section_id AND s.course_id = l.course_id AND s.is_published = TRUE
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
       LEFT JOIN LATERAL (
         SELECT lp2.lesson_id, l2.title AS lesson_title, lp2.last_position_seconds, lp2.updated_at
         FROM lesson_progress lp2
         JOIN course_lessons l2 ON l2.id = lp2.lesson_id
         WHERE lp2.user_id = e.user_id AND lp2.course_id = e.course_id
         ORDER BY lp2.updated_at DESC, lp2.id DESC LIMIT 1
       ) recent ON TRUE
       WHERE l.course_id = e.course_id AND l.is_published = TRUE
       GROUP BY recent.lesson_id, recent.lesson_title, recent.last_position_seconds, recent.updated_at
     ) p ON TRUE
     WHERE e.user_id = $1 AND e.status IN ('active', 'completed')
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       ${originFilter}
     ORDER BY COALESCE(p.last_activity_at, e.updated_at) DESC, e.id DESC`,
    [userId],
  );
  return result.rows;
}

async function findPublishedLesson(lessonId) {
  const result = await db.query(
    `SELECT l.*,
       GREATEST(
         COALESCE(l.estimated_duration_seconds, 0),
         COALESCE((SELECT CEIL(va.duration_seconds)::int FROM video_assets va
           WHERE va.id = l.video_asset_id AND va.deleted_at IS NULL AND va.duration_seconds > 0), 0)
       ) AS effective_duration_seconds
     FROM course_lessons l
     JOIN course_sections s ON s.id = l.section_id AND s.course_id = l.course_id
     JOIN courses c ON c.id = l.course_id
     WHERE l.id = $1 AND l.is_published = TRUE AND s.is_published = TRUE
       AND c.status = 'published' LIMIT 1`,
    [lessonId],
  );
  return result.rows[0] || null;
}

async function listLessonResources(lessonId) {
  const result = await db.query(
    `SELECT id, title, resource_type, url, material_id, is_downloadable, sort_order,
       original_name, mime_type, size_bytes, storage_public_id, file_kind
     FROM lesson_resources WHERE lesson_id = $1 ORDER BY sort_order, id`,
    [lessonId],
  );
  return result.rows;
}

async function getLessonNavigation(courseId, lessonId) {
  const result = await db.query(
    `WITH ordered AS (
       SELECT l.id,
         LAG(l.id) OVER (ORDER BY s.sort_order, s.id, l.sort_order, l.id) AS previous_lesson_id,
         LEAD(l.id) OVER (ORDER BY s.sort_order, s.id, l.sort_order, l.id) AS next_lesson_id
       FROM course_lessons l
       JOIN course_sections s ON s.id = l.section_id AND s.course_id = l.course_id
       WHERE l.course_id = $1 AND l.is_published = TRUE AND s.is_published = TRUE
     ) SELECT previous_lesson_id, next_lesson_id FROM ordered WHERE id = $2 LIMIT 1`,
    [courseId, lessonId],
  );
  return result.rows[0] || { previous_lesson_id: null, next_lesson_id: null };
}

async function findProgress(userId, lessonId) {
  const result = await db.query(
    `SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2 LIMIT 1`,
    [userId, lessonId],
  );
  return result.rows[0] || null;
}

async function upsertProgress(input) {
  const { userId, courseId, lessonId, status, watchedDeltaSeconds, maxPositionSeconds,
    lastPositionSeconds, completionPct, durationSeconds, autoCompleteVideo } = input;
  const result = await db.query(
    `INSERT INTO lesson_progress (
       user_id, course_id, lesson_id, status, watched_seconds, max_position_seconds,
       last_position_seconds, completion_pct, attempt_count, started_at, completed_at
     ) VALUES ($1,$2,$3,$4::varchar,$5,$6,$7,$8,1,NOW(),CASE WHEN $4::varchar = 'completed' THEN NOW() END)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status = CASE
         WHEN lesson_progress.status = 'completed' THEN 'completed'
         WHEN $10 = TRUE AND $9 > 0
           AND LEAST($9, lesson_progress.watched_seconds + EXCLUDED.watched_seconds) >= ($9 * 0.85)
           THEN 'completed'
         ELSE EXCLUDED.status END,
       watched_seconds = CASE WHEN $9 > 0
         THEN LEAST($9, lesson_progress.watched_seconds + EXCLUDED.watched_seconds)
         ELSE lesson_progress.watched_seconds + EXCLUDED.watched_seconds END,
       max_position_seconds = GREATEST(lesson_progress.max_position_seconds, EXCLUDED.max_position_seconds),
       last_position_seconds = EXCLUDED.last_position_seconds,
       completion_pct = GREATEST(lesson_progress.completion_pct, CASE WHEN $9 > 0
         THEN LEAST(100, ((lesson_progress.watched_seconds + EXCLUDED.watched_seconds)::numeric / $9) * 100)
         ELSE EXCLUDED.completion_pct END),
       started_at = COALESCE(lesson_progress.started_at, NOW()),
       completed_at = CASE
         WHEN lesson_progress.completed_at IS NOT NULL THEN lesson_progress.completed_at
         WHEN EXCLUDED.status = 'completed' OR ($10 = TRUE AND $9 > 0
           AND LEAST($9, lesson_progress.watched_seconds + EXCLUDED.watched_seconds) >= ($9 * 0.85))
           THEN NOW() ELSE NULL END,
       updated_at = NOW()
     RETURNING *`,
    [userId, courseId, lessonId, status, watchedDeltaSeconds, maxPositionSeconds,
      lastPositionSeconds, completionPct, durationSeconds, autoCompleteVideo],
  );
  return result.rows[0];
}

async function getCourseProgress(userId, courseId) {
  const result = await db.query(
    `SELECT COUNT(*) FILTER (WHERE l.is_required)::int AS total_lessons,
       COUNT(*) FILTER (WHERE l.is_required AND lp.status = 'completed')::int AS completed_lessons,
       CASE WHEN COUNT(*) FILTER (WHERE l.is_required) > 0
         THEN SUM(CASE WHEN l.is_required THEN COALESCE(lp.completion_pct, 0) ELSE 0 END)
           / COUNT(*) FILTER (WHERE l.is_required)
         ELSE 0 END AS course_completion_pct,
       recent.lesson_id AS last_lesson_id, recent.lesson_title AS last_lesson_title,
       COALESCE(recent.last_position_seconds, 0)::int AS last_position_seconds,
       recent.updated_at AS last_activity_at
     FROM course_lessons l
     JOIN course_sections s
       ON s.id = l.section_id AND s.course_id = l.course_id AND s.is_published = TRUE
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
     LEFT JOIN LATERAL (
       SELECT lp2.lesson_id, l2.title AS lesson_title, lp2.last_position_seconds, lp2.updated_at
       FROM lesson_progress lp2 JOIN course_lessons l2 ON l2.id = lp2.lesson_id
       WHERE lp2.user_id = $1 AND lp2.course_id = $2
       ORDER BY lp2.updated_at DESC, lp2.id DESC LIMIT 1
     ) recent ON TRUE
     WHERE l.course_id = $2 AND l.is_published = TRUE
     GROUP BY recent.lesson_id, recent.lesson_title, recent.last_position_seconds, recent.updated_at`,
    [userId, courseId],
  );
  return result.rows[0] || null;
}

async function listExternalOnlyCourses(userId) {
  const caps = (await db.query(
    `SELECT
       to_regclass('external_entitlements') IS NOT NULL AS has_ext_entitlements,
       to_regclass('external_course_mappings') IS NOT NULL AS has_mappings,
       to_regclass('user_video_entitlements') IS NOT NULL AS has_video_entitlements,
       to_regclass('video_entitlement_courses') IS NOT NULL AS has_video_entitlement_courses,
       to_regclass('course_enrollments') IS NOT NULL AS has_course_enrollments,
       to_regclass('integration_conflicts') IS NOT NULL AS has_conflicts,
       to_regclass('external_identities') IS NOT NULL AS has_identities`,
  )).rows[0];
  if (!caps?.has_ext_entitlements || !caps?.has_mappings) {
    return [];
  }

  const [hasOrigin, mappingCols] = await Promise.all([
    hasCoursesContentOriginColumn(),
    detectMappingSchemaColumns(db),
  ]);
  const mappingPredicate = buildActiveOfferingMappingSqlPredicate("ecm", mappingCols);
  const originEnrollGuard = hasOrigin
    ? `AND NOT EXISTS (
         SELECT 1
         FROM course_enrollments e
         WHERE e.user_id = $1
           AND e.course_id = c.id
           AND (
             e.status = 'revoked'
             OR (
               COALESCE(c.content_origin, 'moly_native') <> 'csca_course'
               AND e.status IN ('active', 'completed')
               AND (e.expires_at IS NULL OR e.expires_at > NOW())
             )
           )
       )`
    : `AND NOT EXISTS (
         SELECT 1
         FROM course_enrollments e
         WHERE e.user_id = $1
           AND e.course_id = c.id
           AND (
             e.status = 'revoked'
             OR (e.status IN ('active', 'completed') AND (e.expires_at IS NULL OR e.expires_at > NOW()))
           )
       )`;

  const conflictGuardExt = caps.has_conflicts
    ? `AND NOT EXISTS (
         SELECT 1
         FROM integration_conflicts ic
         WHERE ic.status = 'open'
           AND (
             ic.candidate_user_id = $1
             OR (ee.external_user_id IS NOT NULL AND ic.external_user_id = ee.external_user_id)
           )
       )`
    : "";
  const conflictGuardLocal = caps.has_conflicts
    ? `AND NOT EXISTS (
         SELECT 1
         FROM integration_conflicts ic
         WHERE ic.status = 'open'
           AND ic.candidate_user_id = $1
       )`
    : "";
  const identityGuardExt = caps.has_identities
    ? `AND NOT EXISTS (
         SELECT 1
         FROM external_identities ei
         WHERE ei.user_id = $1
           AND ei.source_system = ee.source_system
           AND ei.status <> 'active'
       )`
    : "";

  const branches = [
    `SELECT
       ee.local_course_id,
       ee.id AS external_entitlement_id,
       ee.source_system AS external_source_system,
       ee.external_grant_id,
       ee.external_course_id,
       ee.valid_from,
       ee.valid_until,
       ee.source_updated_at,
       ee.created_at AS external_created_at,
       1 AS source_priority
     FROM external_entitlements ee
     WHERE ee.user_id = $1
       AND ee.status = 'active'
       AND COALESCE(ee.effective_owned, TRUE) = TRUE
       AND (ee.valid_from IS NULL OR ee.valid_from <= NOW())
       AND (ee.valid_until IS NULL OR ee.valid_until > NOW())
       ${conflictGuardExt}
       ${identityGuardExt}`,
  ];

  if (caps.has_video_entitlements && caps.has_video_entitlement_courses) {
    branches.push(
      `SELECT
         vec.course_id AS local_course_id,
         uve.id AS external_entitlement_id,
         'moly'::varchar AS external_source_system,
         ('moly:video_entitlement:' || uve.id::text)::varchar AS external_grant_id,
         NULL::varchar AS external_course_id,
         uve.starts_at AS valid_from,
         uve.expires_at AS valid_until,
         uve.starts_at AS source_updated_at,
         uve.starts_at AS external_created_at,
         2 AS source_priority
       FROM user_video_entitlements uve
       JOIN video_entitlement_courses vec ON vec.entitlement_id = uve.id
       JOIN courses c_uve ON c_uve.id = vec.course_id
       WHERE uve.user_id = $1
         AND uve.status = 'active'
         AND (uve.starts_at IS NULL OR uve.starts_at <= NOW())
         AND (uve.expires_at IS NULL OR uve.expires_at > NOW())
         AND c_uve.subject_code = ANY(uve.allowed_subjects)
         ${hasOrigin ? "AND c_uve.content_origin = 'csca_course'" : ""}
         ${conflictGuardLocal}`,
    );
  }

  if (caps.has_course_enrollments && hasOrigin) {
    branches.push(
      `SELECT
         ce.course_id AS local_course_id,
         ce.id AS external_entitlement_id,
         'moly'::varchar AS external_source_system,
         ('moly:admin_enrollment:' || ce.id::text)::varchar AS external_grant_id,
         NULL::varchar AS external_course_id,
         ce.starts_at AS valid_from,
         ce.expires_at AS valid_until,
         ce.updated_at AS source_updated_at,
         ce.created_at AS external_created_at,
         3 AS source_priority
       FROM course_enrollments ce
       JOIN courses c_ce ON c_ce.id = ce.course_id
       WHERE ce.user_id = $1
         AND ce.source = 'admin'
         AND ce.status IN ('active', 'completed')
         AND (ce.expires_at IS NULL OR ce.expires_at > NOW())
         AND c_ce.content_origin = 'csca_course'
         ${conflictGuardLocal}`,
    );
  }

  const result = await db.query(
    `WITH candidate_grants AS (
       ${branches.join("\n       UNION ALL\n       ")}
     )
     SELECT DISTINCT ON (c.id)
       cg.external_entitlement_id,
       cg.external_source_system,
       cg.external_grant_id,
       COALESCE(cg.external_course_id, mapped_ecm.external_course_id) AS external_course_id,
       cg.valid_from,
       cg.valid_until,
       cg.source_updated_at,
       cg.external_created_at,
       c.id AS catalog_course_id,
       c.id,
       c.status AS course_status,
       c.external_key,
       c.slug,
       c.title,
       c.short_description,
       c.description,
       c.subject_code,
       c.level,
       c.thumbnail_url,
       c.access_type,
       c.price_vnd,
       c.compare_at_price_vnd,
       c.is_featured,
       c.is_new,
       c.is_hot,
       c.rating_avg,
       c.rating_count,
       c.enrolled_count,
       c.total_sections,
       c.total_lessons,
       c.total_duration_seconds,
       c.published_at,
       c.content_updated_at
     FROM candidate_grants cg
     JOIN courses c
       ON c.id = cg.local_course_id
      AND c.status = 'published'
     JOIN LATERAL (
       SELECT ecm.external_course_id
       FROM external_course_mappings ecm
       WHERE ecm.local_course_id = c.id
         AND ${mappingPredicate}
       ORDER BY ecm.id ASC
       LIMIT 1
     ) mapped_ecm ON TRUE
     WHERE TRUE
       ${originEnrollGuard}
     ORDER BY c.id, cg.source_priority ASC, cg.source_updated_at DESC NULLS LAST, cg.external_entitlement_id DESC`,
    [userId],
  );
  return result.rows;
}

async function listExternalFirstUnits(courseIds = [], userId = null) {
  const cleanIds = [...new Set((courseIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!cleanIds.length) return new Map();

  const caps = (
    await db.query(
      `SELECT
         to_regclass('course_profile_projections') IS NOT NULL AS has_profiles,
         to_regclass('course_unit_projections') IS NOT NULL AS has_units,
         to_regclass('course_progress_projections') IS NOT NULL AS has_progress`,
    )
  ).rows[0];
  if (!caps?.has_profiles || !caps?.has_units) return new Map();

  const cleanUserId = Number(userId);
  const useProgressOrder = caps.has_progress && Number.isSafeInteger(cleanUserId) && cleanUserId > 0;
  const res = await db.query(
    `SELECT DISTINCT ON (u.local_course_id)
       u.local_course_id,
       u.id AS unit_projection_id,
       p.id AS profile_projection_id,
       p.remote_profile_id,
       p.mode
     FROM course_unit_projections u
     JOIN course_profile_projections p ON p.id = u.profile_projection_id
     WHERE u.local_course_id = ANY($1::bigint[])
       AND u.deleted_at IS NULL
       AND u.is_published = TRUE
       AND p.deleted_at IS NULL
       AND p.status <> 'archived'
     ORDER BY u.local_course_id ASC,
              ${useProgressOrder ? `EXISTS (SELECT 1 FROM course_progress_projections cp0 WHERE cp0.user_id = $2 AND cp0.profile_projection_id = p.id) DESC,` : ""}
              (CASE WHEN p.mode = 'INDEPENDENT' THEN 0 ELSE 1 END) ASC,
              p.id ASC,
              u.section_sort_order ASC,
              u.remote_section_id ASC,
              u.sort_order ASC,
              u.id ASC`,
    useProgressOrder ? [cleanIds, cleanUserId] : [cleanIds],
  );
  const byCourse = new Map();
  for (const row of res.rows) {
    byCourse.set(Number(row.local_course_id), {
      unitProjectionId: Number(row.unit_projection_id),
      profileProjectionId: Number(row.profile_projection_id),
      remoteProfileId: String(row.remote_profile_id),
      mode: row.mode,
    });
  }
  return byCourse;
}

async function listExternalProgressSummaries(userId, courseIds = []) {
  const cleanUserId = Number(userId);
  const cleanIds = [...new Set(courseIds.map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!Number.isSafeInteger(cleanUserId) || cleanUserId <= 0 || !cleanIds.length) return new Map();

  const regRes = await db.query(
    `SELECT
       to_regclass('course_progress_projections') IS NOT NULL AS has_progress,
       to_regclass('course_unit_projections') IS NOT NULL AS has_units,
       to_regclass('course_profile_projections') IS NOT NULL AS has_profiles`,
  );
  const caps = regRes.rows[0] || {};
  if (!caps.has_progress || !caps.has_units || !caps.has_profiles) return new Map();

  const res = await db.query(
    `WITH chosen_profile AS (
       SELECT DISTINCT ON (p.local_course_id)
         p.local_course_id,
         p.id AS profile_projection_id,
         p.remote_profile_id
       FROM course_profile_projections p
       WHERE p.local_course_id = ANY($2::bigint[])
         AND p.deleted_at IS NULL
         AND p.status <> 'archived'
       ORDER BY p.local_course_id ASC,
                EXISTS (
                  SELECT 1 FROM course_progress_projections cp0
                  WHERE cp0.user_id = $1 AND cp0.profile_projection_id = p.id
                ) DESC,
                EXISTS (
                  SELECT 1 FROM course_unit_projections u0
                  WHERE u0.profile_projection_id = p.id
                    AND u0.deleted_at IS NULL
                    AND u0.is_published = TRUE
                ) DESC,
                (CASE WHEN p.mode = 'INDEPENDENT' THEN 0 ELSE 1 END) ASC,
                p.id ASC
     ),
     first_unit AS (
       SELECT DISTINCT ON (u1.profile_projection_id)
         u1.profile_projection_id,
         u1.id AS first_unit_projection_id
       FROM course_unit_projections u1
       JOIN chosen_profile ch1 ON ch1.profile_projection_id = u1.profile_projection_id
       WHERE u1.deleted_at IS NULL
         AND u1.is_published = TRUE
       ORDER BY u1.profile_projection_id ASC,
                u1.section_sort_order ASC,
                u1.remote_section_id ASC,
                u1.sort_order ASC,
                u1.id ASC
     ),
     recent_unit AS (
       SELECT DISTINCT ON (cp2.local_course_id)
         cp2.local_course_id,
         u2.id AS unit_projection_id,
         u2.title AS unit_title,
         cp2.last_position_seconds,
         cp2.source_updated_at
       FROM course_progress_projections cp2
       JOIN chosen_profile ch ON ch.profile_projection_id = cp2.profile_projection_id
       LEFT JOIN course_unit_projections u2
         ON u2.profile_projection_id = cp2.profile_projection_id
        AND u2.unit_type = cp2.unit_type
        AND u2.remote_unit_id = cp2.remote_unit_id
        AND u2.deleted_at IS NULL
       WHERE cp2.user_id = $1
         AND cp2.local_course_id = ANY($2::bigint[])
       ORDER BY cp2.local_course_id ASC,
                (CASE WHEN cp2.watched_seconds > 0 OR cp2.last_position_seconds > 0 OR cp2.completion_pct > 0 OR cp2.is_unit_completed = TRUE THEN 0 ELSE 1 END) ASC,
                (CASE WHEN cp2.last_unit_id = cp2.remote_unit_id THEN 0 ELSE 1 END) ASC,
                cp2.source_updated_at DESC,
                cp2.id DESC
     )
     SELECT
       ch.local_course_id,
       ch.remote_profile_id,
       fu.first_unit_projection_id,
       COUNT(u.id)::int AS total_units,
       COUNT(u.id) FILTER (WHERE cp.is_unit_completed = TRUE)::int AS completed_units,
       CASE WHEN COUNT(u.id) > 0
         THEN ROUND((SUM(LEAST(100, COALESCE(cp.completion_pct, 0)))::numeric / COUNT(u.id)), 2)
         ELSE 0 END AS partial_completion_pct,
       MAX(cp.course_completion_pct) AS course_completion_pct,
       COALESCE(SUM(cp.watched_seconds), 0)::int AS watched_seconds,
       ru.unit_projection_id AS last_unit_projection_id,
       ru.unit_title AS last_unit_title,
       COALESCE(ru.last_position_seconds, 0)::int AS last_position_seconds
     FROM chosen_profile ch
     JOIN course_unit_projections u
       ON u.profile_projection_id = ch.profile_projection_id
      AND u.deleted_at IS NULL
      AND u.is_published = TRUE
     LEFT JOIN first_unit fu ON fu.profile_projection_id = ch.profile_projection_id
     LEFT JOIN course_progress_projections cp
       ON cp.user_id = $1
      AND cp.profile_projection_id = u.profile_projection_id
      AND cp.unit_type = u.unit_type
      AND cp.remote_unit_id = u.remote_unit_id
     LEFT JOIN recent_unit ru ON ru.local_course_id = ch.local_course_id
     GROUP BY ch.local_course_id, ch.remote_profile_id, fu.first_unit_projection_id, ru.unit_projection_id, ru.unit_title, ru.last_position_seconds`,
    [cleanUserId, cleanIds],
  );

  const byCourse = new Map();
  for (const row of res.rows) {
    const totalLessons = Number(row.total_units || 0);
    const completedLessons = Number(row.completed_units || 0);
    const pct = row.partial_completion_pct != null
      ? Number(row.partial_completion_pct)
      : (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0);
    byCourse.set(Number(row.local_course_id), {
      activeProfileId: String(row.remote_profile_id),
      firstUnitProjectionId: row.first_unit_projection_id ? Number(row.first_unit_projection_id) : null,
      completedLessons,
      totalLessons,
      completionPct: Math.min(100, Math.max(0, Math.round(pct * 100) / 100)),
      watchedSeconds: Number(row.watched_seconds || 0),
      lastLessonId: row.last_unit_projection_id ? `u-${row.last_unit_projection_id}` : null,
      lastLessonTitle: row.last_unit_title || null,
      lastPositionSeconds: Number(row.last_position_seconds || 0),
    });
  }
  return byCourse;
}

module.exports = {
  listUserEnrollments, listExternalOnlyCourses, listExternalFirstUnits, listExternalProgressSummaries, findPublishedLesson, listLessonResources,
  getLessonNavigation, findProgress, upsertProgress, getCourseProgress,
};
