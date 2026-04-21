/**
 * INSIGHTS CONTROLLER
 * API endpoints cho phân tích học tập cá nhân hóa
 */

const insightService = require("../services/insightService");

// ─── GET /api/insights/overview ──────────────────────────────────────────────

async function getOverview(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.getOverview(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Insights Overview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy tổng quan học tập",
    });
  }
}

// ─── GET /api/insights/topics ─────────────────────────────────────────────────

async function getTopicAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const { subject } = req.query;
    const data = await insightService.analyzeTopics(userId, subject || null);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Topic Analysis Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích theo chủ đề",
    });
  }
}

// ─── GET /api/insights/difficulty ─────────────────────────────────────────────

async function getDifficultyAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.analyzeDifficulty(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Difficulty Analysis Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích theo độ khó",
    });
  }
}

// ─── GET /api/insights/trend ──────────────────────────────────────────────────

async function getTrendAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const data = await insightService.analyzeTrend(userId, limit);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Trend Analysis Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích xu hướng",
    });
  }
}

// ─── GET /api/insights/time ───────────────────────────────────────────────────

async function getTimeAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.analyzeTimeManagement(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Time Analysis Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích thời gian",
    });
  }
}

// ─── GET /api/insights/recommendations ───────────────────────────────────────

async function getRecommendations(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.recommendNextExams(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Recommendations Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy gợi ý",
    });
  }
}

// ─── GET /api/insights/study-plan ─────────────────────────────────────────────

async function getStudyPlan(req, res) {
  try {
    const userId = req.user.id;
    const { subject } = req.query;

    // Nếu có force=1 thì tạo mới
    if (req.query.force === "1") {
      const data = await insightService.generateStudyPlan(userId, subject || null);
      return res.json({
        success: true,
        data,
      });
    }

    // Thử lấy plan đang active
    const existing = await insightService.getActiveStudyPlan(userId);

    if (existing) {
      return res.json({
        success: true,
        data: existing,
        cached: true,
      });
    }

    // Chưa có → tạo mới
    const data = await insightService.generateStudyPlan(userId, subject || null);
    return res.json({
      success: true,
      data,
      cached: false,
    });
  } catch (error) {
    console.error("Study Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy kế hoạch học tập",
    });
  }
}

// ─── GET /api/insights/full ───────────────────────────────────────────────────

async function getFullAnalysis(req, res) {
  try {
    const userId = req.user.id;

    // Check nếu đã có đủ dữ liệu (>= 2 exam)
    const overview = await insightService.getOverview(userId);

    if (overview.completedExams < 1) {
      return res.json({
        success: true,
        hasEnoughData: false,
        message: "Bạn cần hoàn thành ít nhất 1 đề thi để xem phân tích chi tiết.",
        data: { overview },
      });
    }

    const data = await insightService.getFullAnalysis(userId);

    return res.json({
      success: true,
      hasEnoughData: true,
      data,
    });
  } catch (error) {
    console.error("Full Analysis Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích toàn diện",
    });
  }
}

// ─── PUT /api/insights/read/:id ───────────────────────────────────────────────

async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await insightService.markInsightRead(parseInt(id), userId);

    return res.json({
      success: true,
      message: "Đã đánh dấu đã đọc",
    });
  } catch (error) {
    console.error("Mark Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật",
    });
  }
}

// ─── GET /api/insights/history ─────────────────────────────────────────────────

async function getExamHistory(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const { pool } = require("../config/database");

    const query = `
      SELECT
        ea.id,
        ea.total_score as score,
        ea.total_correct,
        ea.total_incorrect,
        ea.total_unanswered,
        ea.duration_seconds,
        ea.submit_time,
        e.id as exam_id,
        e.title as exam_title,
        e.code as exam_code,
        e.total_questions,
        e.difficulty_level,
        s.name as subject_name,
        s.code as subject_code
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      ORDER BY ea.submit_time DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);

    const history = result.rows.map((r) => ({
      id: r.id,
      examId: r.exam_id,
      examTitle: r.exam_title,
      examCode: r.exam_code,
      subjectName: r.subject_name,
      subjectCode: r.subject_code,
      score: parseFloat(r.score) || 0,
      totalCorrect: parseInt(r.total_correct),
      totalIncorrect: parseInt(r.total_incorrect),
      totalUnanswered: parseInt(r.total_unanswered),
      totalQuestions: r.total_questions,
      durationSeconds: parseInt(r.duration_seconds),
      difficultyLevel: r.difficulty_level,
      submitTime: r.submit_time,
    }));

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Exam History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử thi",
    });
  }
}

// ─── GET /api/insights/exam-type ──────────────────────────────────────────────

async function getExamTypeAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.analyzeByExamType(userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Exam Type Analysis Error:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi phân tích theo loại đề" });
  }
}

// ─── GET /api/insights/weekday ─────────────────────────────────────────────────

async function getWeekdayAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.analyzeWeekdayPattern(userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Weekday Analysis Error:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi phân tích theo ngày" });
  }
}

// ─── GET /api/insights/hardest-exams ───────────────────────────────────────────

async function getHardestExams(req, res) {
  try {
    const userId = req.user.id;
    const data = await insightService.getHardestExams(userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Hardest Exams Error:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi lấy đề khó nhất" });
  }
}

module.exports = {
  getOverview,
  getTopicAnalysis,
  getDifficultyAnalysis,
  getTrendAnalysis,
  getTimeAnalysis,
  getRecommendations,
  getStudyPlan,
  getFullAnalysis,
  markRead,
  getExamHistory,
  getExamTypeAnalysis,
  getWeekdayAnalysis,
  getHardestExams,
};
