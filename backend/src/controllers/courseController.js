const courseService = require("../services/courseService");
const { sendData, sendCourseError } = require("../utils/courseResponses");

async function listCatalog(req, res) {
  try {
    return sendData(res, await courseService.listCatalog(req.query, req.user));
  } catch (error) {
    return sendCourseError(res, error);
  }
}

async function getCourseLanding(req, res) {
  try {
    return sendData(res, await courseService.getCourseLanding(req.params.slug, req.user));
  } catch (error) {
    return sendCourseError(res, error);
  }
}

async function enroll(req, res) {
  try {
    return sendData(res, await courseService.enroll(req.params.courseId, req.user), {
      status: 201,
      message: "Enrollment is active.",
    });
  } catch (error) {
    return sendCourseError(res, error);
  }
}

module.exports = {
  listCatalog,
  getCourseLanding,
  enroll,
};
