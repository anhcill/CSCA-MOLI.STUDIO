const db = require("../config/database");

async function listUserEnrollments(userId) {
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
     ORDER BY COALESCE(p.last_activity_at, e.updated_at) DESC, e.id DESC`,
    [userId],
  );
  return result.rows;
}

async function findPublishedLesson(lessonId) {
  const result = await db.query(
    `SELECT l.* FROM course_lessons l
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
    `SELECT id, title, resource_type, url, material_id, is_downloadable, sort_order
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
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,NOW(),CASE WHEN $4 = 'completed' THEN NOW() END)
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

module.exports = {
  listUserEnrollments, findPublishedLesson, listLessonResources,
  getLessonNavigation, findProgress, upsertProgress, getCourseProgress,
};
