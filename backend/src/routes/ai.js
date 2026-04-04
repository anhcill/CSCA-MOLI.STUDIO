const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/ai/analyze
 * Phân tích toàn diện: điểm yếu, lộ trình, gợi ý tài liệu
 */
router.get("/analyze", aiController.analyzeUserPerformance);

/**
 * POST /api/ai/refresh
 * Force refresh analysis (xóa cache)
 */
router.post("/refresh", aiController.refreshAnalysis);

module.exports = router;
