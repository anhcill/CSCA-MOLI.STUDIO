const { checkVipAccess } = require("../middleware/authMiddleware");
const reviewService = require("../services/vocabularyReviewService");

const getFilters = (req) => ({
  subject: req.query.subject,
  topic: req.query.topic,
  search: req.query.search,
  limit: req.query.limit,
  isVip: checkVipAccess(req.user),
});

const handleError = (res, error, label) => {
  console.error(`${label} error:`, error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode === 404 ? "Không tìm thấy từ vựng" : "Lỗi server",
  });
};

exports.getDashboard = async (req, res) => {
  try {
    const data = await reviewService.getDashboard(req.user.id, getFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Vocabulary review dashboard");
  }
};

exports.getQueue = async (req, res) => {
  try {
    const data = await reviewService.getReviewQueue(req.user.id, getFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Vocabulary review queue");
  }
};

exports.recordReview = async (req, res) => {
  try {
    const data = await reviewService.recordReview(
      req.user.id,
      Number(req.params.id),
      req.body.quality,
    );
    res.json({ success: true, data, message: "Da luu ket qua on tap" });
  } catch (error) {
    handleError(res, error, "Vocabulary record review");
  }
};

exports.getMiniTest = async (req, res) => {
  try {
    const data = await reviewService.getMiniTest(req.user.id, getFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Vocabulary mini test");
  }
};

exports.submitMiniTest = async (req, res) => {
  try {
    const data = await reviewService.submitMiniTest(req.user.id, req.body.answers);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Vocabulary submit mini test");
  }
};

exports.getAdminReviewStats = async (_req, res) => {
  try {
    const data = await reviewService.getAdminReviewStats();
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Vocabulary admin review stats");
  }
};

