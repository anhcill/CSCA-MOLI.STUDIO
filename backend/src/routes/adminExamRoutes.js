const express = require("express");
const router = express.Router();
const {
	authenticate,
	authorizePermission,
} = require("../middleware/authMiddleware");
const AdminExamController = require("../controllers/adminExamController");
const adminFillBlankGroupController = require("../controllers/adminFillBlankGroupController");
const officialExamController = require("../controllers/officialExamController");
const {
	examWriteLimiter,
	examImportPreviewLimiter,
	examAiReviewCooldown,
	examImageOcrLimiter,
	examDeleteLimiter,
	scheduleLimiter,
} = require("./adminExamLimiter");
const uploadPdf = require("../middleware/pdfUploadMiddleware");
const uploadImage = require("../middleware/uploadMiddleware");

function handlePdfUpload(req, res, next) {
	uploadPdf.single("pdf")(req, res, (error) => {
		if (!error) {
			next();
			return;
		}

		if (error.code === "LIMIT_FILE_SIZE") {
			res.status(413).json({ message: "File must be 25MB or smaller" });
			return;
		}

		res.status(400).json({ message: error.message || "Invalid import file upload" });
	});
}

function handleImageOcrUpload(req, res, next) {
	uploadImage.single("image")(req, res, (error) => {
		if (!error) {
			next();
			return;
		}

		if (error.code === "LIMIT_FILE_SIZE") {
			res.status(413).json({ message: "Ảnh tối đa 8MB sau khi tối ưu." });
			return;
		}

		res.status(400).json({ message: error.message || "Ảnh upload không hợp lệ" });
	});
}

// All routes require authentication and exam management permission
router.use(authenticate);
router.use(authorizePermission("exams.manage"));

// Counts (place before /:examId to avoid route conflict) — no rate limit needed
router.get("/counts", AdminExamController.getCounts);
router.get("/stats", AdminExamController.getStats);
router.get("/analytics", AdminExamController.getAnalytics);
router.get("/import/pdf/review-ledger", AdminExamController.getImportReviewLedger);
router.post("/import/pdf/review-ledger", examWriteLimiter, AdminExamController.saveImportReviewLedger);
router.post("/import/pdf/preview", examImportPreviewLimiter, handlePdfUpload, AdminExamController.previewPdfImport);
router.post("/import/pdf/review", examImportPreviewLimiter, examAiReviewCooldown, AdminExamController.reviewImportedItems);
router.post("/import/pdf/apply-review-fixes", examImportPreviewLimiter, examAiReviewCooldown, AdminExamController.applyImportedReviewFixes);
router.post("/import/image/ocr", examImageOcrLimiter, handleImageOcrUpload, AdminExamController.ocrSingleQuestionImage);
router.post("/normalize-formulas", examWriteLimiter, AdminExamController.normalizeManyExamFormulas);

// Exam CRUD — rate limited for write operations
router.get("/", AdminExamController.getAllExams);
router.post("/", examWriteLimiter, AdminExamController.createExam);
router.put("/:examId", examWriteLimiter, AdminExamController.updateExam);
router.delete("/:examId/permanent", examDeleteLimiter, AdminExamController.permanentDeleteExam);
router.delete("/:examId", examDeleteLimiter, AdminExamController.deleteExam);
router.post("/:examId/delete-request/approve", examWriteLimiter, AdminExamController.approveDeleteRequest);
router.post("/:examId/delete-request/reject", examWriteLimiter, AdminExamController.rejectDeleteRequest);
router.post("/:examId/restore", examWriteLimiter, AdminExamController.restoreExam);
router.get("/:examId/edit", AdminExamController.getExamWithQuestions);
router.get("/:examId/source-file", AdminExamController.listExamSourceFiles);
router.post("/:examId/source-file", examWriteLimiter, handlePdfUpload, AdminExamController.uploadExamSourceFile);
router.post("/:examId/exam-paper", examWriteLimiter, handlePdfUpload, AdminExamController.uploadExamPaper);
router.delete("/:examId/source-file/:sourceFileId", examDeleteLimiter, AdminExamController.deleteExamSourceFile);
router.post("/:examId/normalize-formulas", examWriteLimiter, AdminExamController.normalizeExamFormulas);
router.post("/:examId/review-quality", examWriteLimiter, examAiReviewCooldown, AdminExamController.reviewExamQuality);
router.post("/:examId/questions/:questionId/ai-review", examWriteLimiter, examAiReviewCooldown, AdminExamController.reviewQuestionQuality);
router.post("/:examId/questions/:questionId/fix-explanation", examWriteLimiter, examAiReviewCooldown, AdminExamController.fixQuestionExplanation);
router.post("/:examId/apply-ai-review-fixes", examWriteLimiter, examAiReviewCooldown, AdminExamController.applyExamReviewFixes);
router.post("/:examId/apply-display-format-fixes", examWriteLimiter, examAiReviewCooldown, AdminExamController.applyExamDisplayFormatFixes);
router.post("/:examId/generate-missing-explanations", examWriteLimiter, AdminExamController.generateMissingExplanations);
router.post("/:examId/polish-explanations", examWriteLimiter, examAiReviewCooldown, AdminExamController.polishExplanations);

// Question insertion at specific position
router.post("/:examId/questions/insert", examWriteLimiter, AdminExamController.insertQuestion);

// Question CRUD — all write operations are rate limited
router.post("/:examId/questions", examWriteLimiter, AdminExamController.addQuestion);
router.post("/:examId/questions/bulk-import", examWriteLimiter, AdminExamController.bulkImportQuestions);
router.put("/questions/:questionId", examWriteLimiter, AdminExamController.updateQuestion);
router.delete("/questions/:questionId", examWriteLimiter, AdminExamController.deleteQuestion);

// Schedule management — separate rate limit
router.get("/:examId/schedule", AdminExamController.getSchedule);
router.put("/:examId/schedule", scheduleLimiter, AdminExamController.setSchedule);
router.delete("/:examId/schedule", scheduleLimiter, AdminExamController.clearSchedule);

// Official exam workflow
router.get("/:examId/official/monitor", officialExamController.getMonitor);
router.get("/:examId/registrations", officialExamController.listRegistrations);
router.put("/:examId/registrations/:registrationId", examWriteLimiter, officialExamController.updateRegistrationStatus);

router.get("/:examId/rooms", officialExamController.listRooms);
router.post("/:examId/rooms", examWriteLimiter, officialExamController.createRoom);
router.put("/:examId/rooms/:roomId", examWriteLimiter, officialExamController.updateRoom);
router.delete("/:examId/rooms/:roomId", examDeleteLimiter, officialExamController.deleteRoom);
router.post("/:examId/rooms/auto-assign", examWriteLimiter, officialExamController.autoAssignRooms);
router.post("/:examId/rooms/:roomId/students", examWriteLimiter, officialExamController.assignStudentToRoom);
router.delete("/:examId/rooms/:roomId/students/:registrationId", examWriteLimiter, officialExamController.removeStudentFromRoom);
router.post("/:examId/rooms/:roomId/proctors", examWriteLimiter, officialExamController.assignProctor);
router.delete("/:examId/rooms/:roomId/proctors/:assignmentId", examWriteLimiter, officialExamController.removeProctor);

router.get("/:examId/violations", officialExamController.listViolations);
router.get("/:examId/certificates", officialExamController.listCertificates);
router.post("/:examId/certificates/generate", examWriteLimiter, officialExamController.generateCertificates);

// ── Question reordering ──────────────────────────────────────────────────────
router.put("/:examId/questions/reorder", examWriteLimiter, AdminExamController.reorderQuestions);

// ── Fill blank group (pool + sub-items) ───────────────────────────────────
router.post("/:examId/fill-blank-group", examWriteLimiter, adminFillBlankGroupController.insertFillBlankGroup);
router.put("/:examId/fill-blank-group/:groupId", examWriteLimiter, adminFillBlankGroupController.updateFillBlankGroup);
router.delete("/:examId/fill-blank-group/:groupId", examWriteLimiter, adminFillBlankGroupController.deleteFillBlankGroup);

// ── Reading passage group (passage + sub-questions) ─────────────────────────
router.post("/:examId/reading-passage-group", examWriteLimiter, AdminExamController.insertReadingPassageGroup);
router.put("/:examId/reading-passage-group/:groupId", examWriteLimiter, AdminExamController.updateReadingPassageGroup);
router.delete("/:examId/reading-passage-group/:groupId", examWriteLimiter, AdminExamController.deleteReadingPassageGroup);

module.exports = router;
