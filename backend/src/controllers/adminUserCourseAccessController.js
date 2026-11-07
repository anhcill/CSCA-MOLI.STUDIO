"use strict";

const { createCourseEnrollmentAdminService } = require("../services/courseEnrollmentAdminService");
const { sendCourseError, sendData } = require("../utils/courseResponses");

const service = () => createCourseEnrollmentAdminService();
const action = (handler) => async (req, res) => {
  try {
    return sendData(res, await handler(req));
  } catch (error) {
    return sendCourseError(res, error);
  }
};

module.exports = {
  getAccess: action((req) => service().getUserCourseAccess(req.params.userId)),
  grantAccess: action((req) => service().grantUserCourseAccess(req.params.userId, req.body || {})),
  revokeAccess: action((req) => service().revokeUserCourseAccess(req.params.userId, req.params.enrollmentId)),
};
