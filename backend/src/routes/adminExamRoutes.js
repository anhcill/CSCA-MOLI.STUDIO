const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const AdminExamController = require("../controllers/adminExamController");

// All routes require authentication AND admin role
router.use(authenticate);
router.use(authorize("admin"));

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

module.exports = router;
