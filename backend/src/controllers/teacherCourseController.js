const courseService = require("../services/adminCourseService");
const assignmentService = require("../services/courseAssignmentService");
const { sendCourseError, sendData } = require("../utils/courseResponses");

function action(handler, options = {}) {
  return async (req, res) => {
    try {
      return sendData(res, await handler(req), options);
    } catch (error) {
      return sendCourseError(res, error);
    }
  };
}

const list = action((req) => courseService.listCourses(req.query, req.courseScopeUserId));
const get = action((req) => courseService.getCourse(req.params.courseId));
const getLessonWork = action((req) => assignmentService.getAdminWork(req.params.courseId, req.params.lessonId));
const saveAssignment = action((req) => assignmentService.saveAssignment(
  req.params.courseId, req.params.lessonId, req.body || {}, req.user,
));
const uploadAssignmentAttachments = action((req) => assignmentService.uploadAssignmentAttachments(
  req.params.courseId, req.params.lessonId, req.files || [],
), { status: 201 });
const deleteAssignmentAttachment = action((req) => assignmentService.deleteAssignmentAttachment(
  req.params.courseId, req.params.lessonId, req.params.attachmentId,
));
const gradeSubmission = action((req) => assignmentService.gradeSubmission(
  req.params.courseId, req.params.lessonId, req.params.submissionId, req.body || {}, req.user,
));

module.exports = {
  list, get, getLessonWork, saveAssignment, uploadAssignmentAttachments,
  deleteAssignmentAttachment, gradeSubmission,
};
