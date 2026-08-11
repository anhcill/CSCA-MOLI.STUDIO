const db = require("../config/database");
const { CourseApiError } = require("../utils/courseResponses");

function hasGlobalCourseScope(user) {
  return Boolean(user?.rbacRoles?.includes("super_admin") || user?.permissions?.includes("*"));
}

async function isAssigned(userId, courseId) {
  const result = await db.query(
    `SELECT 1 FROM courses c
     WHERE c.id = $1 AND (
       c.instructor_id = $2 OR EXISTS (
         SELECT 1 FROM course_instructors ci WHERE ci.course_id = c.id AND ci.user_id = $2
       )
     ) LIMIT 1`,
    [courseId, userId],
  );
  return result.rows.length > 0;
}

async function assertCanManageCourse(user, courseIdValue) {
  const courseId = Number(courseIdValue);
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    throw new CourseApiError(400, "ADMIN_COURSE_INVALID_ID", "courseId must be a positive integer.");
  }
  if (hasGlobalCourseScope(user) || await isAssigned(user.id, courseId)) return courseId;
  throw new CourseApiError(403, "COURSE_NOT_ASSIGNED", "Bạn chỉ được quản lý các khóa học đã được admin tổng phân công.");
}

function requireGlobalCourseScope(req, res, next) {
  if (hasGlobalCourseScope(req.user)) return next();
  return res.status(403).json({ success: false, code: "GLOBAL_COURSE_ADMIN_REQUIRED", message: "Chỉ admin tổng được phân quyền giáo viên hoặc tạo khóa học." });
}

function scopeCourseList(req, _res, next) {
  req.courseScopeUserId = hasGlobalCourseScope(req.user) ? null : req.user.id;
  return next();
}

async function requireAssignedCourse(req, res, next) {
  try {
    await assertCanManageCourse(req.user, req.params.courseId);
    return next();
  } catch (error) {
    return res.status(error.status || 403).json({ success: false, code: error.code || "COURSE_NOT_ASSIGNED", message: error.message });
  }
}

module.exports = {
  hasGlobalCourseScope, assertCanManageCourse, requireGlobalCourseScope,
  scopeCourseList, requireAssignedCourse,
};
