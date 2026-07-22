class CourseApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "CourseApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendData(res, data, options = {}) {
  const payload = { success: true, data };
  if (options.pagination) payload.pagination = options.pagination;
  if (options.message) payload.message = options.message;
  return res.status(options.status || 200).json(payload);
}

function sendCourseError(res, error) {
  if (error instanceof CourseApiError) {
    const payload = { success: false, code: error.code, message: error.message };
    if (error.details !== undefined) payload.details = error.details;
    return res.status(error.status).json(payload);
  }

  console.error("[courses] Unhandled error:", error);
  return res.status(500).json({
    success: false,
    code: "COURSE_INTERNAL_ERROR",
    message: "Khong the xu ly yeu cau khoa hoc luc nay.",
  });
}

module.exports = { CourseApiError, sendData, sendCourseError };
