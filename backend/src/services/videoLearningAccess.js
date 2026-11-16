const db = require('../config/database');

const enabled = () => process.env.CSCA_VIDEO_COMMERCE_ENABLED === 'true';
async function hasCoursesOriginColumn() {
  try {
    const res = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_attribute
         WHERE attrelid = to_regclass('courses')
           AND NOT attisdropped
           AND attname = 'content_origin'
       ) AS has_origin`,
    );
    return Boolean(res.rows[0]?.has_origin);
  } catch {
    return false;
  }
}
async function find(userId, courseId) {
  if (!enabled()) return null;
  const result = await db.query(`SELECT e.id, e.expires_at FROM user_video_entitlements e
    JOIN video_entitlement_courses ec ON ec.entitlement_id=e.id
    JOIN courses c ON c.id=ec.course_id AND c.status='published'
    WHERE e.user_id=$1 AND ec.course_id=$2 AND e.status='active'
      AND e.starts_at<=NOW() AND (e.expires_at IS NULL OR e.expires_at>NOW())
      AND c.subject_code=ANY(e.allowed_subjects)
    ORDER BY e.expires_at DESC NULLS FIRST, e.id DESC LIMIT 1`, [userId, courseId]);
  return result.rows[0] || null;
}
async function syncEnrollments(userId) {
  if (!enabled()) return;
  const hasOrigin = await hasCoursesOriginColumn();
  const originFilter = hasOrigin
    ? "AND COALESCE(c.content_origin, 'moly_native') <> 'csca_course'"
    : '';
  // Enrollment records keep progress; authorization always rechecks the live sources.
  // Synced csca_course offerings use delegated projections instead of native course_enrollments rows.
  await db.query(`INSERT INTO course_enrollments(user_id,course_id,source,expires_at)
    SELECT DISTINCT $1::integer,c.id,'video'::varchar,NULL::timestamptz FROM user_video_entitlements e
    JOIN video_entitlement_courses ec ON ec.entitlement_id=e.id
    JOIN courses c ON c.id=ec.course_id AND c.status='published'
    WHERE e.user_id=$1 AND e.status='active' AND e.starts_at<=NOW()
      AND (e.expires_at IS NULL OR e.expires_at>NOW()) AND c.subject_code=ANY(e.allowed_subjects)
      ${originFilter}
    ON CONFLICT(user_id,course_id) DO UPDATE SET status=CASE
      WHEN course_enrollments.completed_at IS NOT NULL THEN 'completed' ELSE 'active' END,
      source='video',expires_at=NULL,updated_at=NOW()
    WHERE course_enrollments.status='expired' OR (course_enrollments.status IN ('active','completed')
      AND course_enrollments.expires_at<=NOW())`, [userId]);
}
module.exports = { find, syncEnrollments };
