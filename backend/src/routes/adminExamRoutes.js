const express = require("express");
const router = express.Router();
const {
	authenticate,
	authorizePermission,
} = require("../middleware/authMiddleware");
const AdminExamController = require("../controllers/adminExamController");

// All routes require authentication and exam management permission
router.use(authenticate);
router.use(authorizePermission("exams.manage"));

// Exam CRUD
router.get("/", AdminExamController.getAllExams);
router.post("/", AdminExamController.createExam);
router.put("/:examId", AdminExamController.updateExam);
router.delete("/:examId", AdminExamController.deleteExam);
router.get("/:examId/edit", AdminExamController.getExamWithQuestions);

// Question CRUD
router.post("/:examId/questions", AdminExamController.addQuestion);
router.put("/questions/:questionId", AdminExamController.updateQuestion);
router.delete("/questions/:questionId", AdminExamController.deleteQuestion);

// ── Ngày 11-12: Schedule management (Live / Upcoming) ────────────────────────
router.get("/:examId/schedule", AdminExamController.getSchedule);
router.put("/:examId/schedule", AdminExamController.setSchedule);
router.delete("/:examId/schedule", AdminExamController.clearSchedule);

module.exports = router;
