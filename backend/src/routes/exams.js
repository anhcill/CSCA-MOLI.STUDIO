const express = require("express");
const router = express.Router();
const examController = require("../controllers/examController");
const {
  authenticate,
  authorizePermission,
} = require("../middleware/authMiddleware");

// Public routes
router.get("/exams/lobby", examController.getExamLobby);
router.get("/subjects/:subjectCode/exams", examController.getExamsBySubject);
router.get("/exams/:examId", examController.getExamDetail);

// Protected routes - Require authentication
router.post("/exams/:examId/start", authenticate, examController.startExam);
router.post(
  "/attempts/:attemptId/answers",
  authenticate,
  examController.saveAnswer
);
router.post(
  "/attempts/:attemptId/submit",
  authenticate,
  examController.submitExam
);
router.get("/history", authenticate, examController.getHistory);
router.get(
  "/attempts/:attemptId",
  authenticate,
  examController.getAttemptDetail
);
router.get(
  "/subjects/:subjectCode/stats",
  authenticate,
  examController.getTopicStats
);

// Admin routes - Require exam management permission
router.post(
  "/exams",
  authenticate,
  authorizePermission("exams.manage"),
  examController.createExam,
);
router.put(
  "/exams/:examId",
  authenticate,
  authorizePermission("exams.manage"),
  examController.updateExam,
);
router.delete(
  "/exams/:examId",
  authenticate,
  authorizePermission("exams.manage"),
  examController.deleteExam,
);
router.post(
  "/exams/:examId/questions",
  authenticate,
  authorizePermission("exams.manage"),
  examController.createQuestion
);

module.exports = router;
