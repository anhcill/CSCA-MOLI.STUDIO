const Exam = require("../models/Exam");
const ExamAttempt = require("../models/ExamAttempt");
const { cache, TTL } = require("../config/cache");
const { checkVipAccess } = require("../middleware/authMiddleware");

const examController = {
  // Lấy dữ liệu sảnh thi (Lobby)
  async getExamLobby(req, res) {
    try {
      // Dùng cache để giảm tải vì sảnh thi ai cũng xem
      const cacheKey = "exams:lobby";
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached, fromCache: true });
      }

      const Exam = require("../models/Exam");
      const lobbyData = await Exam.getLobby();
      cache.set(cacheKey, lobbyData, 60);

      res.json({
        success: true,
        data: lobbyData,
      });
    } catch (error) {
      console.error("Get exam lobby error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy dữ liệu sảnh thi",
        error: error.message,
      });
    }
  },

  // Lấy danh sách đề thi theo môn
  async getExamsBySubject(req, res) {
    try {
      const { subjectCode } = req.params;
      const { subjectSlug } = req.query;
      const userId = req.user?.id;

      // Cache key theo subjectCode/subjectSlug và userId
      const cacheKey = `exams:${subjectSlug || subjectCode}:${userId || "guest"}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached, fromCache: true });
      }

      const exams = await Exam.getBySubject(subjectCode, userId, subjectSlug);

      // Cache 5 phút
      cache.set(cacheKey, exams, TTL.MEDIUM);

      res.json({
        success: true,
        data: exams,
      });
    } catch (error) {
      console.error("Get exams error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách đề thi",
        error: error.message,
      });
    }
  },

  // Lấy chi tiết đề thi (để làm bài)
  async getExamDetail(req, res) {
    try {
      const { examId } = req.params;
      const includeAnswers = req.query.answers === "true";

      const exam = await Exam.getById(examId, includeAnswers);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      // VIP check: premium exams require active VIP
      if (exam.is_premium && !checkVipAccess(req.user)) {
        return res.status(403).json({
          success: false,
          message: "Nội dung này chỉ dành cho thành viên VIP",
          code: "VIP_REQUIRED",
          is_vip_required: true,
        });
      }

      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      console.error("Get exam detail error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy chi tiết đề thi",
        error: error.message,
      });
    }
  },

  // Tạo đề thi mới (Admin only)
  async createExam(req, res) {
    try {
      const examData = {
        ...req.body,
        created_by: req.user.id,
      };

      const exam = await Exam.create(examData);

      // Xóa cache exams vì có dữ liệu mới
      cache.delByPrefix("exams:");

      res.status(201).json({
        success: true,
        message: "Tạo đề thi thành công",
        data: exam,
      });
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tạo đề thi",
        error: error.message,
      });
    }
  },

  // Tạo câu hỏi cho đề thi (Admin only)
  async createQuestion(req, res) {
    try {
      const { examId } = req.params;
      const questionData = {
        ...req.body,
        exam_id: examId,
      };

      const question = await Exam.createQuestion(questionData);

      // Create answers if provided
      if (req.body.answers && Array.isArray(req.body.answers)) {
        for (const answerData of req.body.answers) {
          await Exam.createAnswer({
            ...answerData,
            question_id: question.id,
          });
        }
      }

      res.status(201).json({
        success: true,
        message: "Tạo câu hỏi thành công",
        data: question,
      });
    } catch (error) {
      console.error("Create question error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tạo câu hỏi",
        error: error.message,
      });
    }
  },

  // Bắt đầu làm bài thi
  async startExam(req, res) {
    try {
      const { examId } = req.params;
      const userId = req.user.id;

      // Guard: reject NaN / non-integer IDs before touching the DB
      const parsedId = parseInt(examId, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID đề thi không hợp lệ",
        });
      }

      // Get exam details with questions
      const exam = await Exam.getById(parsedId);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      // VIP check: premium exams require active VIP
      if (exam.is_premium && !checkVipAccess(req.user)) {
        return res.status(403).json({
          success: false,
          message: "Nội dung này chỉ dành cho thành viên VIP",
          code: "VIP_REQUIRED",
          is_vip_required: true,
        });
      }

      const attempt = await ExamAttempt.start(userId, parsedId);

      res.json({
        success: true,
        message: "Bắt đầu làm bài",
        data: {
          attemptId: attempt.id,
          exam: exam,
          questions: exam.questions || [],
        },
      });
    } catch (error) {
      console.error("Start exam error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi bắt đầu làm bài",
        error: error.message,
      });
    }
  },

  // Lưu câu trả lời
  async saveAnswer(req, res) {
    try {
      const { attemptId } = req.params;
      const { questionId, answerKey, timeSpent } = req.body;

      console.log('Save answer request:', { attemptId, questionId, answerKey, timeSpent });

      const answer = await ExamAttempt.saveAnswer(
        attemptId,
        questionId,
        answerKey,
        timeSpent || 0
      );

      res.json({
        success: true,
        message: "Lưu câu trả lời thành công",
        data: answer,
      });
    } catch (error) {
      console.error("Save answer error:", error);
      console.error("Error details:", error.message);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lưu câu trả lời",
        error: error.message,
      });
    }
  },

  // Nộp bài
  async submitExam(req, res) {
    try {
      const { attemptId } = req.params;

      console.log('Submit exam request:', { attemptId });

      const result = await ExamAttempt.submit(attemptId);

      res.json({
        success: true,
        message: "Nộp bài thành công",
        data: result,
      });
    } catch (error) {
      console.error("Submit exam error:", error);
      console.error("Error details:", error.message);
      res.status(500).json({
        success: false,
        message: "Lỗi khi nộp bài",
        error: error.message,
      });
    }
  },

  // Lấy lịch sử làm bài
  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const { subjectCode } = req.query;
      const limit = parseInt(req.query.limit) || 10;

      const history = await ExamAttempt.getUserHistory(
        userId,
        subjectCode,
        limit
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("Get history error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy lịch sử",
        error: error.message,
      });
    }
  },

  // Lấy thống kê theo chủ đề
  async getTopicStats(req, res) {
    try {
      const userId = req.user.id;
      const { subjectCode } = req.params;

      const stats = await ExamAttempt.getUserTopicStats(userId, subjectCode);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get topic stats error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê",
        error: error.message,
      });
    }
  },

  // Lấy chi tiết kết quả một lần thi
  async getAttemptDetail(req, res) {
    try {
      const { attemptId } = req.params;
      const userId = req.user.id;

      const detail = await ExamAttempt.getAttemptDetail(attemptId, userId);

      if (!detail) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy kết quả thi",
        });
      }

      res.json({
        success: true,
        data: detail,
      });
    } catch (error) {
      console.error("Get attempt detail error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy chi tiết kết quả",
        error: error.message,
      });
    }
  },

  // Cập nhật đề thi (Admin only)
  async updateExam(req, res) {
    try {
      const { examId } = req.params;

      const exam = await Exam.update(examId, req.body);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      // Xóa cache exams khi có cập nhật
      cache.delByPrefix("exams:");

      res.json({
        success: true,
        message: "Cập nhật đề thi thành công",
        data: exam,
      });
    } catch (error) {
      console.error("Update exam error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật đề thi",
        error: error.message,
      });
    }
  },

  // Xóa đề thi (Admin only)
  async deleteExam(req, res) {
    try {
      const { examId } = req.params;

      const exam = await Exam.delete(examId);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      // Xóa cache exams khi xóa đề thi
      cache.delByPrefix("exams:");

      res.json({
        success: true,
        message: "Xóa đề thi thành công",
      });
    } catch (error) {
      console.error("Delete exam error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa đề thi",
        error: error.message,
      });
    }
  },
};

module.exports = examController;
