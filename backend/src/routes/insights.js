const express = require("express");
const router = express.Router();
const insightsController = require("../controllers/insightsController");
const { authenticate } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/insights/overview
 * Tổng quan: điểm TB, số đề, streak, rank
 */
router.get("/overview", insightsController.getOverview);

/**
 * GET /api/insights/topics
 * Phân tích theo chủ đề: yếu điểm + mạnh điểm
 * Query: ?subject=MATH (optional)
 */
router.get("/topics", insightsController.getTopicAnalysis);

/**
 * GET /api/insights/difficulty
 * Phân tích theo độ khó: easy/medium/hard
 */
router.get("/difficulty", insightsController.getDifficultyAnalysis);

/**
 * GET /api/insights/trend
 * Phân tích xu hướng điểm số
 * Query: ?limit=10
 */
router.get("/trend", insightsController.getTrendAnalysis);

/**
 * GET /api/insights/time
 * Phân tích quản lý thời gian
 */
router.get("/time", insightsController.getTimeAnalysis);

/**
 * GET /api/insights/recommendations
 * Gợi ý đề thi tiếp theo
 */
router.get("/recommendations", insightsController.getRecommendations);

/**
 * GET /api/insights/study-plan
 * Lấy hoặc tạo lịch học 7 ngày
 * Query: ?subject=MATH&force=1
 */
router.get("/study-plan", insightsController.getStudyPlan);

/**
 * GET /api/insights/full
 * Phân tích toàn diện (tất cả module)
 */
router.get("/full", insightsController.getFullAnalysis);

/**
 * GET /api/insights/history
 * Lịch sử thi với chi tiết
 * Query: ?limit=20
 */
router.get("/history", insightsController.getExamHistory);

/**
 * GET /api/insights/exam-type
 * Phân tích theo loại đề: phòng thi vs tự do
 */
router.get("/exam-type", insightsController.getExamTypeAnalysis);

/**
 * GET /api/insights/weekday
 * Heatmap học tập theo ngày trong tuần
 */
router.get("/weekday", insightsController.getWeekdayAnalysis);

/**
 * GET /api/insights/hardest-exams
 * Top đề thi khó nhất
 */
router.get("/hardest-exams", insightsController.getHardestExams);

/**
 * PUT /api/insights/read/:id
 * Đánh dấu insight đã đọc
 */
router.put("/read/:id", insightsController.markRead);

module.exports = router;
