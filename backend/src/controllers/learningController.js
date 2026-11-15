const learningService = require("../services/learningService");
const assignmentService = require("../services/courseAssignmentService");
const discussionService = require("../services/courseDiscussionService");
const courseIntegrationRuntime = require("../services/courseIntegrationRuntime");
const { sendData, sendCourseError } = require("../utils/courseResponses");

function handler(action) {
  return async (req, res) => {
    try {
      return sendData(res, await action(req));
    } catch (error) {
      return sendCourseError(res, error);
    }
  };
}

const listMyEnrollments = handler((req) => learningService.listMyEnrollments(req.user));
const getLearningCourse = handler((req) => learningService.getLearningCourse(req.params.courseId, req.user));
const getLearningLesson = handler((req) => learningService.getLearningLesson(req.params.lessonId, req.user));
const updateLessonProgress = handler((req) => learningService.updateLessonProgress(req.params.lessonId, req.body || {}, req.user));
const completeLesson = handler((req) => learningService.completeLesson(req.params.lessonId, req.user));
const getCourseProgress = handler((req) => learningService.getCourseProgress(req.params.courseId, req.user));
const submitAssignment = handler((req) => assignmentService.submitAssignment(
  req.params.lessonId, req.body || {}, req.files || [], req.user,
));
const listLessonQuestions = handler((req) => discussionService.listLearnerQuestions(req.params.lessonId, req.user));
const createLessonQuestion = handler((req) => discussionService.createLearnerQuestion(
  req.params.lessonId, req.body || {}, req.files || [], req.user,
));
const replyLessonQuestion = handler((req) => discussionService.replyAsLearner(
  req.params.lessonId, req.params.threadId, req.body || {}, req.files || [], req.user,
));

const getExternalWorkspace = handler((req) =>
  courseIntegrationRuntime.workspace.getExternalCourseWorkspace({
    courseSlugOrId: req.params.courseSlugOrId,
    profileId: req.query?.profileId || req.query?.profile_id || null,
    unitId: req.query?.unitId || req.query?.unit_id || null,
    user: req.user || null,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

const getExternalUnit = handler((req) =>
  courseIntegrationRuntime.workspace.getExternalUnitDetail({
    profileId: req.params.profileId,
    unitId: req.params.unitId,
    courseSlugOrId: req.query?.courseId || req.query?.courseSlug || null,
    user: req.user || null,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

module.exports = {
  listMyEnrollments, getLearningCourse, getLearningLesson,
  updateLessonProgress, completeLesson, getCourseProgress,
  submitAssignment,
  listLessonQuestions, createLessonQuestion, replyLessonQuestion, getExternalWorkspace, getExternalUnit,
};
