const service = require("../services/adminCourseService");
const assignmentService = require("../services/courseAssignmentService");
const { sendCourseError, sendData } = require("../utils/courseResponses");

function action(handler, options = {}) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      return sendData(res, data, options);
    } catch (error) {
      return sendCourseError(res, error);
    }
  };
}

const list = action((req) => service.listCourses(req.query, req.courseScopeUserId));
const get = action((req) => service.getCourse(req.params.courseId));
const create = action((req) => service.createCourse(req.body || {}), { status: 201 });
const update = action((req) => service.updateCourse(req.params.courseId, req.body || {}));
const createSection = action(
  (req) => service.createSection(req.params.courseId, req.body || {}),
  { status: 201 },
);
const updateSection = action((req) => service.updateSection(
  req.params.courseId,
  req.params.sectionId,
  req.body || {},
));
const createLesson = action(
  (req) => service.createLesson(req.params.courseId, req.body || {}),
  { status: 201 },
);
const updateLesson = action((req) => service.updateLesson(
  req.params.courseId,
  req.params.lessonId,
  req.body || {},
));
const getLessonWork = action((req) => assignmentService.getAdminWork(req.params.courseId, req.params.lessonId));
const uploadLessonResources = action((req) => assignmentService.uploadLessonResources(
  req.params.courseId, req.params.lessonId, req.files || [],
), { status: 201 });
const deleteLessonResource = action((req) => assignmentService.deleteLessonResource(
  req.params.courseId, req.params.lessonId, req.params.resourceId,
));
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
const listTeacherOptions = action(() => service.listTeacherOptions());
const listCourseTeachers = action((req) => service.listCourseTeachers(req.params.courseId));
const replaceCourseTeachers = action((req) => service.replaceCourseTeachers(
  req.params.courseId, req.body?.userIds || [], req.user,
));
const publish = action((req) => service.publishCourse(req.params.courseId));
const unpublish = action((req) => service.unpublishCourse(req.params.courseId));
const archive = action((req) => service.archiveCourse(req.params.courseId));

module.exports = {
  list, get, create, update, createSection, updateSection,
  createLesson, updateLesson, publish, unpublish, archive,
  getLessonWork, uploadLessonResources, deleteLessonResource, saveAssignment,
  uploadAssignmentAttachments, deleteAssignmentAttachment, gradeSubmission,
  listTeacherOptions, listCourseTeachers, replaceCourseTeachers,
};
