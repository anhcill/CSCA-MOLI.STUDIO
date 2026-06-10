const Exam = require("../models/Exam");
const ExamAttempt = require("../models/ExamAttempt");
const UserActivity = require("../models/UserActivity");
const { cache, TTL } = require("../config/cache");
const { checkVipContentAccess } = require("../middleware/authMiddleware");
const insightService = require("../services/insightService");

function sanitizeQuestionForAttempt(question) {
  const {
    explanation,
    explanation_cn,
    explanation_en,
    correct_answer,
    correct_answer_key,
    ...safeQuestion
  } = question;

  return {
    ...safeQuestion,
    answers: (question.answers || []).map((answer) => {
      const { is_correct, ...safeAnswer } = answer;
      return safeAnswer;
    }),
  };
}

function getRequiredVipTier(exam) {
  const tier = String(exam?.vip_tier || '').trim().toLowerCase();
  if (tier === 'premium' || tier === 'pre') return 'premium';
  if (tier === 'vip') return 'vip';
  return exam?.is_premium ? 'vip' : 'basic';
}

function getExamAllowDownload(requiredTier) {
  return requiredTier === 'basic';
}

function buildVipAccessError(requiredTier) {
  return {
    success: false,
    message: requiredTier === 'premium'
      ? "Noi dung nay chi danh cho thanh vien Premium"
      : "Noi dung nay chi danh cho thanh vien VIP dung mon",
    code: requiredTier === 'premium' ? "PREMIUM_REQUIRED" : "VIP_REQUIRED",
    is_vip_required: true,
  };
}

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
      const includeAnswers = false;

      const exam = await Exam.getById(examId, includeAnswers);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      const requiredTier = getRequiredVipTier(exam);
      if (!checkVipContentAccess(req.user, requiredTier, exam.subject_code)) {
        return res.status(403).json(buildVipAccessError(requiredTier));
      }

      exam.allow_download = getExamAllowDownload(requiredTier);
      exam.questions = (exam.questions || []).map(sanitizeQuestionForAttempt);

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
  async getExamPreflight(req, res) {
    try {
      const parsedId = parseInt(req.params.examId, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID de thi khong hop le",
        });
      }

      const exam = await Exam.getSummaryForUser(parsedId, req.user.id);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Khong tim thay de thi",
        });
      }

      const requiredTier = getRequiredVipTier(exam);
      if (!checkVipContentAccess(req.user, requiredTier, exam.subject_code)) {
        return res.status(403).json(buildVipAccessError(requiredTier));
      }

      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      console.error("Get exam preflight error:", error);
      res.status(500).json({
        success: false,
        message: "Loi khi lay thong tin de thi",
        error: error.message,
      });
    }
  },

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
      const restart = req.body?.restart === true || req.body?.mode === "restart";
      const practiceMode = req.body?.practiceMode === true || req.body?.mode === "practice";

      // Guard: reject NaN / non-integer IDs before touching the DB
      const parsedId = parseInt(examId, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID đề thi không hợp lệ",
        });
      }

      // Get exam details with questions
      const exam = await Exam.getById(parsedId, false);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đề thi",
        });
      }

      const requiredTier = getRequiredVipTier(exam);
      if (!checkVipContentAccess(req.user, requiredTier, exam.subject_code)) {
        return res.status(403).json(buildVipAccessError(requiredTier));
      }

      if (exam.start_time) {
        const db = require("../config/database");
        const registrationResult = await db.query(
          `SELECT er.status, room.room_name, room.location, ers.seat_number
           FROM exam_registrations er
           LEFT JOIN exam_room_students ers ON ers.registration_id = er.id
           LEFT JOIN exam_rooms room ON room.id = ers.room_id
           WHERE er.exam_id = $1 AND er.user_id = $2
           LIMIT 1`,
          [parsedId, userId],
        );
        const registration = registrationResult.rows[0];
        const allowedStatuses = new Set(["approved", "checked_in"]);
        if (!registration || !allowedStatuses.has(registration.status)) {
          return res.status(403).json({
            success: false,
            message: "Bạn cần đăng ký và được duyệt trước khi vào kỳ thi chính thức",
            code: "OFFICIAL_REGISTRATION_REQUIRED",
            registration,
          });
        }

        const now = Date.now();
        const startsAt = new Date(exam.start_time).getTime();
        const endsAt = exam.end_time ? new Date(exam.end_time).getTime() : null;
        if (Number.isFinite(startsAt) && now < startsAt) {
          return res.status(403).json({
            success: false,
            message: "Kỳ thi chưa đến giờ bắt đầu",
            code: "EXAM_NOT_STARTED",
            registration,
          });
        }
        if (endsAt && Number.isFinite(endsAt) && now > endsAt) {
          return res.status(403).json({
            success: false,
            message: "Kỳ thi đã kết thúc",
            code: "EXAM_ENDED",
            registration,
          });
        }
      }

      const existingAttempt = !restart && !practiceMode
        ? await ExamAttempt.getInProgress(userId, parsedId)
        : null;
      const attempt = await ExamAttempt.start(userId, parsedId, { restart, practiceMode });
      const savedAnswers = existingAttempt
        ? await ExamAttempt.getSavedAnswers(attempt.id)
        : [];
      const elapsedSeconds = attempt.start_time
        ? Math.max(0, Math.floor((Date.now() - new Date(attempt.start_time).getTime()) / 1000))
        : 0;
      const timeLeftSeconds = practiceMode
        ? null
        : Math.max(0, (Number(exam.duration) || 0) * 60 - elapsedSeconds);

      // Log hành vi bắt đầu thi
      UserActivity.log(userId, 'exam_start', {
        examId: parsedId,
        examTitle: exam.title,
        attemptId: attempt.id,
      });

      // Shuffle questions if exam has shuffle_mode enabled
      let questions = (exam.questions || [])
        .filter((q) => q.question_type !== 'reading_passage' && q.question_type !== 'fill_blank_pool')
        .map(sanitizeQuestionForAttempt);
      if (exam.shuffle_mode) {
        // Fisher-Yates shuffle
        questions = [...questions];
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        // Also shuffle answer options for each question
        questions = questions.map((q) => ({
          ...q,
          answers: q.answers
            ? [...q.answers].sort(() => Math.random() - 0.5)
            : [],
        }));
      }

      const { questions: _rawQuestions, ...safeExam } = exam;
      safeExam.allow_download = getExamAllowDownload(requiredTier);

      res.json({
        success: true,
        message: "Bắt đầu làm bài",
        data: {
          attemptId: attempt.id,
          exam: safeExam,
          questions: questions,
          savedAnswers,
          isResume: Boolean(existingAttempt),
          practiceMode,
          timeLeftSeconds,
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
      const { questionId, answerKey, timeSpent, essayAnswer, practiceMode } = req.body;
      const parsedAttemptId = parseInt(attemptId, 10);
      const parsedQuestionId = parseInt(questionId, 10);

      if (!Number.isFinite(parsedAttemptId) || parsedAttemptId <= 0 || !Number.isFinite(parsedQuestionId) || parsedQuestionId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Du lieu luu cau tra loi khong hop le",
        });
      }

      console.log('Save answer request:', { attemptId, questionId, answerKey, timeSpent });

      const answer = await ExamAttempt.saveAnswer(
        parsedAttemptId,
        parsedQuestionId,
        answerKey,
        timeSpent || 0,
        essayAnswer ?? null,
        req.user.id
      );

      let feedback = null;
      if (practiceMode) {
        const db = require("../config/database");
        const feedbackResult = await db.query(
          `SELECT
             q.explanation,
             q.explanation_cn,
             q.explanation_image_url,
             a.answer_key AS correct_answer_key,
             a.answer_text AS correct_answer_text,
             a.answer_text_cn AS correct_answer_text_cn
           FROM questions q
           LEFT JOIN answers a ON a.question_id = q.id AND a.is_correct = TRUE
           WHERE q.id = $1
           LIMIT 1`,
          [parsedQuestionId]
        );

        feedback = {
          is_correct: answer.is_correct,
          ...(feedbackResult.rows[0] || {}),
        };
      }

      res.json({
        success: true,
        message: "Lưu câu trả lời thành công",
        data: practiceMode ? { ...answer, feedback } : answer,
      });
    } catch (error) {
      console.error("Save answer error:", error);
      console.error("Error details:", error.message);
      res.status(error.statusCode || 500).json({
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
      const parsedAttemptId = parseInt(attemptId, 10);

      if (!Number.isFinite(parsedAttemptId) || parsedAttemptId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID lan thi khong hop le",
        });
      }

      console.log('Submit exam request:', { attemptId });

      const result = await ExamAttempt.submit(parsedAttemptId, req.user.id);

      // Log hành vi nộp bài
      if (!result.already_completed) {
        UserActivity.log(req.user.id, 'exam_submit', {
          examId: result.exam_id,
          attemptId: parsedAttemptId,
          score: result.total_score,
          status: result.status,
        });

        insightService.onExamSubmitted(req.user.id, parsedAttemptId).catch((err) => {
          console.error("Failed to update learning insights after submit:", err);
        });
      }

      // Cập nhật tiến độ nhiệm vụ "do_exam"
      if (!result.already_completed) {
        try {
          const db = require("../config/database");
          await db.query(
            `UPDATE user_quests SET progress = progress + 1
             WHERE user_id = $1 AND quest_type = 'do_exam' AND date = CURRENT_DATE AND progress < target`,
            [req.user.id]
          );
        } catch (err) {
          console.error("Failed to update quest progress for do_exam:", err);
        }
      }

      res.json({
        success: true,
        message: "Nộp bài thành công",
        data: result,
      });
    } catch (error) {
      console.error("Submit exam error:", error);
      console.error("Error details:", error.message);
      res.status(error.statusCode || 500).json({
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

      const exam = await Exam.delete(examId, req.user.id, req.body?.reason || req.query?.reason || null);

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
