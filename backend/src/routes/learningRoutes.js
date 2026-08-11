const express = require("express");
const controller = require("../controllers/learningController");
const videoPlaybackController = require("../controllers/videoPlaybackController");
const { authenticate } = require("../middleware/authMiddleware");
const { playbackLimiter, progressLimiter } = require("./courseRateLimiters");
const { requireCoursePreviewAdmin } = require("../middleware/coursePreviewMiddleware");
const { courseFiles } = require("../middleware/courseFileUpload");

const router = express.Router();

router.use(authenticate);
router.use(requireCoursePreviewAdmin);
router.get("/courses/:courseId", controller.getLearningCourse);
router.get("/courses/:courseId/progress", controller.getCourseProgress);
router.get("/lessons/:lessonId", controller.getLearningLesson);
router.post("/lessons/:lessonId/playback-session", playbackLimiter, videoPlaybackController.createPlaybackSession);
router.put("/lessons/:lessonId/progress", progressLimiter, controller.updateLessonProgress);
router.post("/lessons/:lessonId/complete", progressLimiter, controller.completeLesson);
router.post("/lessons/:lessonId/submission", courseFiles("files"), controller.submitAssignment);
router.get("/lessons/:lessonId/questions", controller.listLessonQuestions);
router.post("/lessons/:lessonId/questions", courseFiles("files"), controller.createLessonQuestion);
router.post("/lessons/:lessonId/questions/:threadId/replies", courseFiles("files"), controller.replyLessonQuestion);

module.exports = router;
