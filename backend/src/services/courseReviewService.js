const db = require('../config/database');
const courseService = require('./courseService');
const videoAccess = require('./videoLearningAccess');
const { CourseApiError } = require('../utils/courseResponses');

async function list(slug, user) {
  const course = await courseService.getCourseLanding(slug, user);
  const result = await db.query(
    `SELECT r.rating, r.comment, r.updated_at, r.user_id,
            COALESCE(NULLIF(u.full_name, ''), 'Học viên') AS author_name
       FROM course_reviews r JOIN users u ON u.id = r.user_id
      WHERE r.course_id = $1 ORDER BY (r.user_id = $2) DESC, r.updated_at DESC LIMIT 50`,
    [course.id, user?.id || null],
  );
  return {
    ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount,
    canReview: await canReview(course, user),
    myReview: (() => {
      const mine = result.rows.find((row) => Number(row.user_id) === Number(user?.id));
      return mine ? { rating: Number(mine.rating), comment: mine.comment } : null;
    })(),
    items: result.rows.map(({ user_id, author_name, rating, comment, updated_at }) => ({
      authorName: author_name, rating: Number(rating), comment, updatedAt: updated_at,
      isMine: Number(user_id) === Number(user?.id),
    })),
  };
}

async function canReview(course, user) {
  if (!user) return false;
  if (course.contentOrigin === 'csca_course') return course.owned === true || course.access.owned === true;
  if (!course.access.canLearn) return false;
  if (await videoAccess.find(user.id, course.id)) return true;
  const enrollment = await db.query(
    `SELECT source FROM course_enrollments WHERE course_id = $1 AND user_id = $2
       AND status IN ('active', 'completed') AND (expires_at IS NULL OR expires_at > NOW())`,
    [course.id, user.id],
  );
  return enrollment.rows.some((row) => row.source !== 'free');
}

async function save(slug, user, input) {
  const course = await courseService.getCourseLanding(slug, user);
  if (!(await canReview(course, user))) {
    throw new CourseApiError(403, 'REVIEW_ACCESS_REQUIRED', 'Chỉ học viên đã mua hoặc được cấp quyền khóa học mới có thể đánh giá.');
  }
  const rating = Number(input?.rating);
  const comment = typeof input?.comment === 'string' ? input.comment.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) {
    throw new CourseApiError(400, 'INVALID_REVIEW', 'Chọn từ 1 đến 5 sao và viết tối đa 2000 ký tự.');
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM courses WHERE id = $1 FOR UPDATE', [course.id]);
    await client.query(
      `INSERT INTO course_reviews (course_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (course_id, user_id) DO UPDATE
       SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()`,
      [course.id, user.id, rating, comment],
    );
    const aggregate = await client.query(
      `UPDATE courses SET rating_avg = stats.avg_rating, rating_count = stats.review_count
         FROM (SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS review_count
                 FROM course_reviews WHERE course_id = $1) stats
        WHERE courses.id = $1 RETURNING rating_avg, rating_count`,
      [course.id],
    );
    await client.query('COMMIT');
    return { ratingAvg: Number(aggregate.rows[0].rating_avg), ratingCount: aggregate.rows[0].rating_count };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { list, save };
