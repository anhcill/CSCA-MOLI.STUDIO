const express = require("express");
const controller = require("../controllers/learningController");
const videoPlaybackController = require("../controllers/videoPlaybackController");
const { authenticate, optionalAuth } = require("../middleware/authMiddleware");
const { playbackLimiter, progressLimiter } = require("./courseRateLimiters");
const { courseFiles } = require("../middleware/courseFileUpload");
const { parseFeatureFlag } = require("../utils/courseFeatureConfig");
const { isDelegatedLearningKillSwitchActive } = require("../utils/integrationLogger");

const router = express.Router();

function requireDelegatedLearningEnabled(req, res, next) {
  const enabled = parseFeatureFlag(
    process.env.COURSE_DELEGATED_LEARNING_ENABLED,
    "COURSE_DELEGATED_LEARNING_ENABLED",
  );
  if (!enabled || isDelegatedLearningKillSwitchActive(process.env)) {
    return res.status(503).json({
      success: false,
      code: "DELEGATED_LEARNING_DISABLED",
      errorCode: "DELEGATED_LEARNING_DISABLED",
      message: "Delegated course learning is not enabled.",
    });
  }
  return next();
}

// Keep the new Moly-hosted CSCA-Course workspace dark until the rollout flag is
// explicitly enabled. Native Moly lessons and the existing CSCA-Course SSO path
// remain available while this gate is closed.
router.use("/external", requireDelegatedLearningEnabled);

// Day 3 external CSCA-Course workspace routes: optionalAuth allows public preview units
// without login while non-preview access and delegated minting require live authenticated entitlement.
router.get("/external/courses/:courseSlugOrId/workspace", optionalAuth, controller.getExternalWorkspace);
router.get("/external/offerings/:profileId/units/:unitId", optionalAuth, controller.getExternalUnit);
router.get(
  "/external/offerings/:profileId/units/:unitId/files/:fileId/stream",
  optionalAuth,
  controller.streamExternalFile,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/videos/:videoId/playback-token",
  authenticate,
  playbackLimiter,
  controller.getExternalVideoPlaybackToken,
);
router.put(
  "/external/offerings/:profileId/units/:unitId/videos/:videoId/progress",
  authenticate,
  progressLimiter,
  controller.updateExternalVideoProgress,
);

router.use(authenticate);

// Day 6: External delegated quizzes & assignments
router.get(
  "/external/offerings/:profileId/units/:unitId/quizzes/:quizId",
  controller.getExternalQuiz,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/quizzes/:quizId/attempts/start",
  progressLimiter,
  controller.startExternalQuizAttempt,
);
router.put(
  "/external/offerings/:profileId/units/:unitId/quizzes/attempts/:attemptId/answers",
  progressLimiter,
  controller.saveExternalQuizAnswers,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/quizzes/attempts/:attemptId/submit",
  progressLimiter,
  controller.submitExternalQuizAttempt,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/quizzes/:quizId/essay-assets",
  progressLimiter,
  courseFiles("files"),
  controller.uploadExternalQuizEssayAssets,
);
router.get(
  "/external/offerings/:profileId/units/:unitId/submission-assets/:assetId",
  controller.streamExternalSubmissionAsset,
);
router.get(
  "/external/offerings/:profileId/units/:unitId/assignments/:assignmentId",
  controller.getExternalAssignment,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/assignments/:assignmentId/submit",
  progressLimiter,
  courseFiles("files"),
  controller.submitExternalAssignment,
);

// Day 7: External delegated notes, bookmarks & Q&A
router.get(
  "/external/offerings/:profileId/units/:unitId/notes",
  controller.listExternalNotes,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/notes",
  progressLimiter,
  controller.createExternalNote,
);
router.put(
  "/external/offerings/:profileId/units/:unitId/notes/:noteId",
  progressLimiter,
  controller.updateExternalNote,
);
router.delete(
  "/external/offerings/:profileId/units/:unitId/notes/:noteId",
  progressLimiter,
  controller.deleteExternalNote,
);

router.get(
  "/external/offerings/:profileId/units/:unitId/bookmarks",
  controller.listExternalBookmarks,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/bookmarks",
  progressLimiter,
  controller.createExternalBookmark,
);
router.delete(
  "/external/offerings/:profileId/units/:unitId/bookmarks/:bookmarkId",
  progressLimiter,
  controller.deleteExternalBookmark,
);

router.get(
  "/external/offerings/:profileId/units/:unitId/qa",
  controller.listExternalQaThreads,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/qa",
  progressLimiter,
  controller.createExternalQaThread,
);
router.post(
  "/external/offerings/:profileId/units/:unitId/qa/:threadId/replies",
  progressLimiter,
  controller.replyExternalQaThread,
);
router.patch(
  "/external/offerings/:profileId/units/:unitId/qa/:threadId/status",
  progressLimiter,
  controller.updateExternalQaThreadStatus,
);
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
