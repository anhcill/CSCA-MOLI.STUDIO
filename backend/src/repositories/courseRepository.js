const db = require("../config/database");

const COURSE_COLUMNS = `
  c.id, c.external_key, c.slug, c.title, c.short_description, c.description,
  c.subject_code, c.level, c.thumbnail_url, c.preview_video_asset_id,
  c.instructor_id, c.access_type, c.required_tier, c.price_vnd,
  c.compare_at_price_vnd, c.status, c.is_featured, c.is_new, c.is_hot,
  c.certificate_enabled, c.total_sections, c.total_lessons,
  c.total_duration_seconds, c.rating_avg, c.rating_count, c.enrolled_count,
  c.published_at, c.content_updated_at, c.created_at, c.updated_at,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('id', p.id, 'name', p.name)
      ORDER BY p.sort_order, p.id
    )
    FROM course_package_access cpa
    JOIN vip_packages p ON p.id = cpa.package_id
    WHERE cpa.course_id = c.id
  ), '[]'::jsonb) AS packages`;

async function listPublished({ userId = null, subjectCode = null, accessType = null, page = 1, limit = 12 }) {
  const offset = (page - 1) * limit;
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS}, COUNT(*) OVER()::int AS total_count,
       e.id AS enrollment_id, e.status AS enrollment_status,
       COALESCE(progress.completed_required, 0)::int AS completed_required,
       COALESCE(progress.total_required, 0)::int AS total_required,
       COALESCE(progress.course_completion_pct, 0)::numeric AS course_completion_pct
     FROM courses c
     LEFT JOIN course_enrollments e
       ON e.course_id = c.id AND e.user_id = $1
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE l.is_required)::int AS total_required,
         COUNT(*) FILTER (WHERE l.is_required AND lp.status = 'completed')::int AS completed_required,
         CASE WHEN COUNT(*) FILTER (WHERE l.is_required) > 0
           THEN SUM(CASE WHEN l.is_required THEN COALESCE(lp.completion_pct, 0) ELSE 0 END)
             / COUNT(*) FILTER (WHERE l.is_required)
           ELSE 0 END AS course_completion_pct
       FROM course_lessons l
       JOIN course_sections s
         ON s.id = l.section_id AND s.course_id = l.course_id AND s.is_published = TRUE
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE l.course_id = c.id AND l.is_published = TRUE
     ) progress ON TRUE
     WHERE c.status = 'published'
       AND ($2::text IS NULL OR c.subject_code = $2)
       AND ($3::text IS NULL OR c.access_type = $3)
     ORDER BY c.is_featured DESC, c.published_at DESC NULLS LAST, c.id DESC
     LIMIT $4 OFFSET $5`,
    [userId, subjectCode, accessType, limit, offset],
  );
  return result.rows;
}

async function findPublishedBySlug(slug) {
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS} FROM courses c
     WHERE c.slug = $1 AND c.status = 'published' LIMIT 1`,
    [slug],
  );
  return result.rows[0] || null;
}

async function findPublishedById(courseId) {
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS} FROM courses c
     WHERE c.id = $1 AND c.status = 'published' LIMIT 1`,
    [courseId],
  );
  return result.rows[0] || null;
}

async function listCurriculum(courseId, { userId = null, includeContent = false } = {}) {
  const sections = await db.query(
    `SELECT id, course_id, title, description, sort_order, is_published
     FROM course_sections
     WHERE course_id = $1 AND is_published = TRUE
     ORDER BY sort_order, id`,
    [courseId],
  );
  const lessons = await db.query(
    `SELECT l.id, l.external_key, l.course_id, l.section_id, l.slug, l.title,
       l.summary, l.lesson_type,
       CASE WHEN $3::boolean THEN l.content_html ELSE NULL END AS content_html,
       l.sort_order, l.is_published, l.is_free_preview, l.is_required,
       CASE WHEN $3::boolean THEN l.video_asset_id ELSE NULL END AS video_asset_id,
       CASE WHEN $3::boolean THEN l.material_id ELSE NULL END AS material_id,
       l.estimated_duration_seconds, l.passing_score,
       lp.id AS progress_id, lp.user_id AS progress_user_id,
       lp.status AS progress_status, lp.watched_seconds, lp.max_position_seconds,
       lp.last_position_seconds, lp.completion_pct, lp.attempt_count,
       lp.started_at AS progress_started_at, lp.completed_at AS progress_completed_at,
       lp.updated_at AS progress_updated_at
     FROM course_lessons l
     JOIN course_sections s ON s.id = l.section_id AND s.course_id = l.course_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $2
     WHERE l.course_id = $1 AND l.is_published = TRUE AND s.is_published = TRUE
     ORDER BY s.sort_order, s.id, l.sort_order, l.id`,
    [courseId, userId, includeContent],
  );
  return { sections: sections.rows, lessons: lessons.rows };
}

async function listCourseMetadata(courseId) {
  const [outcomes, requirements] = await Promise.all([
    db.query(`SELECT id, content, sort_order FROM course_outcomes WHERE course_id = $1 ORDER BY sort_order, id`, [courseId]),
    db.query(`SELECT id, content, sort_order FROM course_requirements WHERE course_id = $1 ORDER BY sort_order, id`, [courseId]),
  ]);
  return { outcomes: outcomes.rows, requirements: requirements.rows };
}

async function findEnrollment(userId, courseId) {
  const result = await db.query(
    `SELECT * FROM course_enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1`,
    [userId, courseId],
  );
  return result.rows[0] || null;
}

async function findActivePackageEntitlement(userId, courseId) {
  const result = await db.query(
    `SELECT e.id, e.package_id, e.starts_at, e.expires_at
     FROM user_vip_entitlements e
     JOIN course_package_access cpa
       ON cpa.package_id = e.package_id AND cpa.course_id = $2
     JOIN courses c ON c.id = cpa.course_id
     WHERE e.user_id = $1
       AND e.is_active = TRUE
       AND e.starts_at <= NOW()
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND (
         '*' = ANY(COALESCE(e.allowed_subjects, ARRAY[]::text[]))
         OR c.subject_code = ANY(COALESCE(e.allowed_subjects, ARRAY[]::text[]))
       )
     ORDER BY e.expires_at DESC NULLS FIRST, e.created_at DESC, e.id DESC
     LIMIT 1`,
    [userId, courseId],
  );
  return result.rows[0] || null;
}

async function createEnrollment({ userId, courseId, source, expiresAt = null }) {
  const result = await db.query(
    `INSERT INTO course_enrollments (user_id, course_id, source, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, course_id) DO UPDATE SET
       source = EXCLUDED.source,
       status = 'active',
       starts_at = NOW(),
       expires_at = EXCLUDED.expires_at,
       completed_at = NULL,
       updated_at = NOW()
     WHERE course_enrollments.status = 'expired'
        OR (
          course_enrollments.status IN ('active', 'completed')
          AND course_enrollments.expires_at IS NOT NULL
          AND course_enrollments.expires_at <= NOW()
        )
     RETURNING *`,
    [userId, courseId, source, expiresAt],
  );
  return result.rows[0] || findEnrollment(userId, courseId);
}

async function findLesson(courseId, lessonId) {
  const result = await db.query(
    `SELECT * FROM course_lessons
     WHERE id = $1 AND course_id = $2 AND is_published = TRUE LIMIT 1`,
    [lessonId, courseId],
  );
  return result.rows[0] || null;
}

async function upsertProgress({
  userId, courseId, lessonId, status, watchedSeconds,
  maxPositionSeconds, lastPositionSeconds, completionPct,
}) {
  const result = await db.query(
    `INSERT INTO lesson_progress (
       user_id, course_id, lesson_id, status, watched_seconds,
       max_position_seconds, last_position_seconds, completion_pct,
       attempt_count, started_at, completed_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       1, NOW(), CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END
     )
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status = CASE
         WHEN lesson_progress.status = 'completed' THEN 'completed'
         ELSE EXCLUDED.status
       END,
       watched_seconds = GREATEST(lesson_progress.watched_seconds, EXCLUDED.watched_seconds),
       max_position_seconds = GREATEST(lesson_progress.max_position_seconds, EXCLUDED.max_position_seconds),
       last_position_seconds = EXCLUDED.last_position_seconds,
       completion_pct = GREATEST(lesson_progress.completion_pct, EXCLUDED.completion_pct),
       completed_at = CASE
         WHEN lesson_progress.completed_at IS NOT NULL THEN lesson_progress.completed_at
         WHEN EXCLUDED.status = 'completed' THEN NOW()
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING *`,
    [userId, courseId, lessonId, status, watchedSeconds, maxPositionSeconds, lastPositionSeconds, completionPct],
  );
  return result.rows[0];
}

async function getCourseProgress(userId, courseId) {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE l.is_required)::int AS required_lessons,
       COUNT(*) FILTER (WHERE l.is_required AND lp.status = 'completed')::int AS completed_lessons,
       CASE WHEN COUNT(*) FILTER (WHERE l.is_required) > 0
         THEN SUM(CASE WHEN l.is_required THEN COALESCE(lp.completion_pct, 0) ELSE 0 END)
           / COUNT(*) FILTER (WHERE l.is_required)
         ELSE 0 END AS course_completion_pct,
       COALESCE(MAX(lp.updated_at), e.updated_at) AS last_activity_at
     FROM course_enrollments e
     LEFT JOIN course_lessons l ON l.course_id = e.course_id AND l.is_published = TRUE
       AND EXISTS (
         SELECT 1 FROM course_sections s
         WHERE s.id = l.section_id AND s.course_id = l.course_id AND s.is_published = TRUE
       )
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
     WHERE e.user_id = $1 AND e.course_id = $2
     GROUP BY e.id`,
    [userId, courseId],
  );
  return result.rows[0] || null;
}

module.exports = {
  listPublished,
  findPublishedBySlug,
  findPublishedById,
  listCurriculum,
  listCourseMetadata,
  findEnrollment,
  findActivePackageEntitlement,
  createEnrollment,
  findLesson,
  upsertProgress,
  getCourseProgress,
};
