const express = require("express");
const router = express.Router();
const examController = require("../controllers/examController");
const officialExamController = require("../controllers/officialExamController");
const {
  authenticate,
  authorizePermission,
} = require("../middleware/authMiddleware");

// Public routes
router.get("/exams/lobby", examController.getExamLobby);
router.get("/subjects/:subjectCode/exams", examController.getExamsBySubject);
router.get("/exams/:examId", examController.getExamDetail);

// Protected routes - Require authentication
router.get("/exams/:examId/preflight", authenticate, examController.getExamPreflight);
router.post("/exams/:examId/start", authenticate, examController.startExam);
router.get(
  "/exams/:examId/registration",
  authenticate,
  officialExamController.getMyRegistration,
);
router.get(
  "/exams/:examId/admission-ticket",
  authenticate,
  officialExamController.getMyAdmissionTicket,
);
router.post(
  "/exams/:examId/register",
  authenticate,
  officialExamController.register,
);
router.delete(
  "/exams/:examId/register",
  authenticate,
  officialExamController.cancelRegistration,
);
router.post(
  "/attempts/:attemptId/answers/batch",
  authenticate,
  examController.saveAnswersBatch
);
router.post(
  "/attempts/:attemptId/answers",
  authenticate,
  examController.saveAnswer
);
router.post(
  "/attempts/:attemptId/violations",
  authenticate,
  officialExamController.logViolation,
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
  "/certificates/me",
  authenticate,
  officialExamController.getMyCertificates,
);
router.get(
  "/certificates/verify/:code",
  officialExamController.verifyCertificate,
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
