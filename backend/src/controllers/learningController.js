const learningService = require("../services/learningService");
const assignmentService = require("../services/courseAssignmentService");
const discussionService = require("../services/courseDiscussionService");
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

module.exports = {
  listMyEnrollments, getLearningCourse, getLearningLesson,
  updateLessonProgress, completeLesson, getCourseProgress,
  submitAssignment,
  listLessonQuestions, createLessonQuestion, replyLessonQuestion,
};
