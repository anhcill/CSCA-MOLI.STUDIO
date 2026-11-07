const db = require("../config/database");
const { CourseApiError } = require("../utils/courseResponses");

// Admin-side direct course access (course_enrollments.source = 'admin').
// Learner authorization re-reads course_enrollments on every request, so a
// grant/revoke here takes effect on the next playback/progress call.

const MAX_GRANT_TARGETS = 500;
const MAX_DURATION_DAYS = 3650;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_FILTERS = new Set(["active", "expired", "revoked", "completed"]);

function fail(status, code, message, details) {
  throw new CourseApiError(status, code, message, details);
}

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, "ADMIN_COURSE_INVALID_ID", `${field} must be a positive integer.`);
  return id;
}

function resolveExpiry({ durationDays, expiresAt } = {}, now = new Date()) {
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) fail(422, "ENROLLMENT_EXPIRY_INVALID", "Ngày hết hạn không hợp lệ.");
    if (date <= now) fail(422, "ENROLLMENT_EXPIRY_INVALID", "Ngày hết hạn phải ở tương lai.");
    return date;
  }
  if (durationDays === undefined || durationDays === null || durationDays === "") return null;
  const days = Number(durationDays);
  if (!Number.isSafeInteger(days) || days < 1 || days > MAX_DURATION_DAYS) {
    fail(422, "ENROLLMENT_DURATION_INVALID", `Số ngày phải từ 1 đến ${MAX_DURATION_DAYS}.`);
  }
  return new Date(now.getTime() + days * 86400000);
}

function normalizeEmails(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(422, "ENROLLMENT_EMAILS_INVALID", "emails must be an array.");
  return [...new Set(value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item) => item && EMAIL_PATTERN.test(item)))];
}

function normalizeUserIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(422, "ENROLLMENT_USERS_INVALID", "userIds must be an array.");
  return [...new Set(value.map((item) => positiveId(item, "userIds")))];
}

// Effective status: an active row past its expiry is reported as expired.
const EFFECTIVE_STATUS_SQL = `CASE
  WHEN e.status IN ('active','completed') AND e.expires_at IS NOT NULL AND e.expires_at <= NOW() THEN 'expired'
  ELSE e.status END`;

const PROGRESS_SQL = `
  (SELECT COUNT(*)::int FROM lesson_progress lp
    WHERE lp.user_id = e.user_id AND lp.course_id = e.course_id AND lp.status = 'completed') AS completed_lessons_count,
  (SELECT COUNT(*)::int FROM course_lessons cl
    JOIN course_sections cs ON cs.id = cl.section_id AND cs.course_id = cl.course_id
    WHERE cl.course_id = e.course_id AND cl.is_published AND cs.is_published) AS total_lessons_count,
  (SELECT MAX(lp.updated_at) FROM lesson_progress lp
    WHERE lp.user_id = e.user_id AND lp.course_id = e.course_id) AS last_accessed_at`;

function progressPercent(row) {
  const total = Number(row.total_lessons_count || 0);
  if (total < 1) return 0;
  return Math.min(100, Math.round((Number(row.completed_lessons_count || 0) / total) * 100));
}

function createCourseEnrollmentAdminService({ database = db } = {}) {
  async function ensureCourse(courseId, client = database) {
    const course = (await client.query("SELECT id, title, slug, status, access_type, subject_code FROM courses WHERE id = $1", [courseId])).rows[0];
    if (!course) fail(404, "ADMIN_COURSE_NOT_FOUND", "Không tìm thấy khóa học.");
    return course;
  }

  async function listCourseEnrollments(courseIdValue, query = {}) {
    const courseId = positiveId(courseIdValue, "courseId");
    await ensureCourse(courseId);
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
    const search = typeof query.search === "string" && query.search.trim() ? query.search.trim().slice(0, 100) : null;
    const status = STATUS_FILTERS.has(query.status) ? query.status : null;
    const { rows } = await database.query(
      `SELECT e.id, e.user_id, e.source, ${EFFECTIVE_STATUS_SQL} AS status, e.starts_at, e.expires_at,
              e.created_at, u.full_name, u.email, u.username, ${PROGRESS_SQL},
              COUNT(*) OVER()::int AS total_count
         FROM course_enrollments e
         JOIN users u ON u.id = e.user_id
        WHERE e.course_id = $1
          AND ($2::text IS NULL OR u.email ILIKE '%' || $2 || '%' OR u.full_name ILIKE '%' || $2 || '%'
               OR u.username ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR ${EFFECTIVE_STATUS_SQL} = $3)
        ORDER BY e.updated_at DESC, e.id DESC
        LIMIT $4 OFFSET $5`,
      [courseId, search, status, limit, (page - 1) * limit],
    );
    const total = Number(rows[0]?.total_count || 0);
    return {
      items: rows.map((row) => ({
        id: Number(row.id), userId: Number(row.user_id), fullName: row.full_name || null,
        email: row.email, username: row.username || null, source: row.source, status: row.status,
        progressPercent: progressPercent(row), completedLessonsCount: Number(row.completed_lessons_count || 0),
        enrolledAt: row.starts_at || row.created_at, expiresAt: row.expires_at || null,
        lastAccessedAt: row.last_accessed_at || null,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async function upsertAdminEnrollments(client, courseId, userIds, expiresAt) {
    if (!userIds.length) return [];
    // Never shortens an existing live grant: unlimited stays unlimited, a later expiry wins.
    const { rows } = await client.query(
      `INSERT INTO course_enrollments (user_id, course_id, source, status, starts_at, expires_at)
       SELECT uid, $2, 'admin', 'active', NOW(), $3::timestamptz FROM UNNEST($1::int[]) AS uid
       ON CONFLICT (user_id, course_id) DO UPDATE SET
         source = 'admin',
         status = CASE WHEN course_enrollments.completed_at IS NOT NULL THEN 'completed' ELSE 'active' END,
         starts_at = CASE
           WHEN course_enrollments.status IN ('active','completed')
             AND (course_enrollments.expires_at IS NULL OR course_enrollments.expires_at > NOW())
           THEN course_enrollments.starts_at ELSE NOW() END,
         expires_at = CASE
           WHEN EXCLUDED.expires_at IS NULL THEN NULL
           WHEN course_enrollments.status IN ('active','completed') AND course_enrollments.expires_at IS NULL THEN NULL
           WHEN course_enrollments.status IN ('active','completed') AND course_enrollments.expires_at > EXCLUDED.expires_at
             THEN course_enrollments.expires_at
           ELSE EXCLUDED.expires_at END,
         updated_at = NOW()
       RETURNING id, user_id, expires_at, status`,
      [userIds, courseId, expiresAt],
    );
    return rows;
  }

  async function transaction(work) {
    const client = await database.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function grantCourseEnrollments(courseIdValue, input = {}) {
    const courseId = positiveId(courseIdValue, "courseId");
    const userIds = normalizeUserIds(input.userIds);
    const emails = normalizeEmails(input.emails);
    if (!userIds.length && !emails.length) {
      fail(422, "ENROLLMENT_TARGET_REQUIRED", "Nhập ít nhất một email hoặc chọn học viên.");
    }
    if (userIds.length + emails.length > MAX_GRANT_TARGETS) {
      fail(422, "ENROLLMENT_TOO_MANY_TARGETS", `Tối đa ${MAX_GRANT_TARGETS} học viên mỗi lần cấp.`);
    }
    const expiresAt = resolveExpiry(input);
    return transaction(async (client) => {
      await ensureCourse(courseId, client);
      const { rows: users } = await client.query(
        `SELECT id, email, full_name FROM users
          WHERE is_active = TRUE AND (id = ANY($1::int[]) OR LOWER(email) = ANY($2::text[]))`,
        [userIds, emails],
      );
      const foundEmails = new Set(users.map((user) => String(user.email || "").toLowerCase()));
      const notFoundEmails = emails.filter((email) => !foundEmails.has(email));
      const saved = await upsertAdminEnrollments(client, courseId, users.map((user) => Number(user.id)), expiresAt);
      const expiryByUser = new Map(saved.map((row) => [Number(row.user_id), row.expires_at]));
      return {
        grantedCount: saved.length,
        grantedUsers: users.map((user) => ({
          id: Number(user.id), email: user.email, fullName: user.full_name || null,
          expiresAt: expiryByUser.get(Number(user.id)) || null,
        })),
        notFoundEmails,
      };
    });
  }

  async function revokeCourseEnrollment(courseIdValue, enrollmentIdValue) {
    const courseId = positiveId(courseIdValue, "courseId");
    const enrollmentId = positiveId(enrollmentIdValue, "enrollmentId");
    const { rows } = await database.query(
      `UPDATE course_enrollments SET status = 'revoked', updated_at = NOW()
        WHERE id = $1 AND course_id = $2 RETURNING id`,
      [enrollmentId, courseId],
    );
    if (!rows[0]) fail(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy quyền học này.");
    return { id: Number(rows[0].id), status: "revoked" };
  }

  async function getUserCourseAccess(userIdValue) {
    const userId = positiveId(userIdValue, "userId");
    const user = (await database.query("SELECT id FROM users WHERE id = $1", [userId])).rows[0];
    if (!user) fail(404, "USER_NOT_FOUND", "User không tồn tại.");
    const [enrollments, courses] = await Promise.all([
      database.query(
        `SELECT e.id, e.course_id, e.source, ${EFFECTIVE_STATUS_SQL} AS status, e.starts_at, e.expires_at,
                c.title, c.slug, c.subject_code, ${PROGRESS_SQL}
           FROM course_enrollments e JOIN courses c ON c.id = e.course_id
          WHERE e.user_id = $1
          ORDER BY e.updated_at DESC, e.id DESC`,
        [userId],
      ),
      database.query(
        `SELECT id, title, subject_code, status, access_type FROM courses
          WHERE status <> 'archived' ORDER BY (status = 'published') DESC, updated_at DESC, id DESC LIMIT 300`,
      ),
    ]);
    return {
      enrollments: enrollments.rows.map((row) => ({
        id: Number(row.id), courseId: Number(row.course_id), title: row.title, slug: row.slug,
        subjectCode: row.subject_code, source: row.source, status: row.status,
        progressPercent: progressPercent(row), expiresAt: row.expires_at || null, enrolledAt: row.starts_at || null,
      })),
      courses: courses.rows.map((row) => ({
        id: Number(row.id), title: row.title, subjectCode: row.subject_code, status: row.status, accessType: row.access_type,
      })),
    };
  }

  async function grantUserCourseAccess(userIdValue, input = {}) {
    const userId = positiveId(userIdValue, "userId");
    const result = await grantCourseEnrollments(input.courseId, { ...input, userIds: [userId], emails: [] });
    if (!result.grantedCount) fail(404, "USER_NOT_FOUND", "User không tồn tại hoặc đã bị khóa.");
    return result;
  }

  async function revokeUserCourseAccess(userIdValue, enrollmentIdValue) {
    const userId = positiveId(userIdValue, "userId");
    const enrollmentId = positiveId(enrollmentIdValue, "enrollmentId");
    const { rows } = await database.query(
      `UPDATE course_enrollments SET status = 'revoked', updated_at = NOW()
        WHERE id = $1 AND user_id = $2 RETURNING id`,
      [enrollmentId, userId],
    );
    if (!rows[0]) fail(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy quyền học này.");
    return { id: Number(rows[0].id), status: "revoked" };
  }

  return {
    listCourseEnrollments, grantCourseEnrollments, revokeCourseEnrollment,
    getUserCourseAccess, grantUserCourseAccess, revokeUserCourseAccess,
  };
}

module.exports = { createCourseEnrollmentAdminService, resolveExpiry, normalizeEmails };
