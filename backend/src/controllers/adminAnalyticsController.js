const adminAnalyticsService = require("../services/adminAnalyticsService");

const handleError = (res, error, label) => {
  console.error(`${label} error:`, error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server error",
  });
};

exports.getAnalytics = async (req, res) => {
  try {
    const data = await adminAnalyticsService.getAnalytics(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Admin analytics");
  }
};

exports.getAdminPerformance = async (req, res) => {
  try {
    const data = await adminAnalyticsService.getAdminPerformance(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Admin performance analytics");
  }
};

exports.getExamReport = async (req, res) => {
  try {
    const data = await adminAnalyticsService.getExamReport(req.params.examId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Admin exam report");
  }
};

exports.exportDataset = async (req, res) => {
  try {
    const { filename, csv } = await adminAnalyticsService.exportDataset(req.params.dataset, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    handleError(res, error, "Admin export");
  }
};

