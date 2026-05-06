const db = require('../config/database');
const aiService = require('../services/aiService');
const { cache, TTL } = require('../config/cache');
const { canUseAIFeatures } = require('../middleware/authMiddleware');

// ─── Per-user cooldown ──────────────────────────────────────────────────────────────
const userCooldowns = new Map();
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

// ─── In-flight deduplication ────────────────────────────────────────────────────
const inFlightRequests = new Map();

// ─── Shared helpers ───────────────────────────────────────────────────────────────
async function getStaleCache(userId, insightType = 'full_analysis') {
  const r = await db.query(
    `SELECT data, created_at FROM ai_insights
     WHERE user_id = $1 AND insight_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, insightType],
  );
  return r.rows[0] || null;
}

async function handleRateLimit(res, userId, retryAfter, message) {
  const stale = await getStaleCache(userId);
  if (stale) {
    const age = Math.floor((Date.now() - new Date(stale.created_at)) / 60000);
    return res.json({
      success: true, cached: true, cacheSource: 'stale',
      cacheAge: age, rateLimited: true, retryAfter,
      message, data: stale.data,
    });
  }
  return res.json({ success: false, rateLimited: true, retryAfter, message });
}

// ─── FEATURE 1: Phân tích kết quả bài thi ───────────────────────────────────────
/**
 * POST /api/ai/exam-result
 * Phân tích kết quả 1 bài thi cụ thể (hiển thị ngay sau khi nộp bài)
 */
async function analyzeExamResult(req, res) {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Thiếu attemptId' });
    }

    // Lấy chi tiết bài thi
    const attemptResult = await db.query(
      `SELECT
         ea.id, ea.total_score, ea.total_correct, ea.total_incorrect,
         ea.start_time, ea.submit_time,
         e.id as exam_id, e.title as exam_title, e.title_cn,
         e.subject_id, e.total_questions, e.duration,
         s.name as subject_name, s.name_cn
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE ea.id = $1 AND ea.user_id = $2`,
      [attemptId, userId],
    );

    if (!attemptResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài thi' });
    }

    const attempt = attemptResult.rows[0];
    const duration = attempt.submit_time && attempt.start_time
      ? Math.round((new Date(attempt.submit_time) - new Date(attempt.start_time)) / 60000)
      : null;

    // Lấy câu hỏi chi tiết
    let questions = [];
    try {
      const questionsResult = await db.query(
        `SELECT
           q.id, q.question_number, q.question_text, q.question_text_cn,
           q.question_type, q.difficulty,
           q.points, q.explanation, q.explanation_cn,
           ua.selected_answer_key,
           ua.is_correct as user_is_correct,
           ca.answer_key as correct_answer_key,
           ca.answer_text as correct_answer_text
         FROM user_answers ua
         JOIN questions q ON ua.question_id = q.id
         LEFT JOIN answers ca ON ca.question_id = q.id AND ca.is_correct = true
         WHERE ua.attempt_id = $1
         ORDER BY q.question_number`,
        [attemptId],
      );
      questions = questionsResult.rows.map(q => ({
        question_number: q.question_number,
        question_text: q.question_text,
        question_text_cn: q.question_text_cn,
        question_type: q.question_type,
        difficulty: q.difficulty,
        points: q.points,
        selected_answer_key: q.selected_answer_key,
        correct_answer_key: q.correct_answer_key,
        correct_answer_text: q.correct_answer_text,
        is_correct: q.user_is_correct,
        options: [],
      }));
    } catch {
      // Fallback: dùng dữ liệu attempt thuần
    }

    const attemptData = {
      attemptId: attempt.id,
      examTitle: attempt.exam_title,
      subjectName: attempt.subject_name,
      totalScore: parseFloat(attempt.total_score) || 0,
      totalQuestions: attempt.total_questions,
      correctCount: attempt.total_correct,
      duration,
      questions,
    };

    // Gọi AI
    if (aiService.isRateLimited()) {
      const retryAfter = aiService.getRateLimitRemaining();
      return res.json({
        success: true, rateLimited: true, retryAfter,
        data: { ...attemptData, aiAnalysis: { score: Math.round((attempt.total_correct / attempt.total_questions) * 100) } },
        message: 'AI đang bận, hiển thị kết quả cơ bản.',
      });
    }

    const aiAnalysis = await aiService.analyzeExamResult(attemptData);

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        examTitle: attempt.exam_title,
        subjectName: attempt.subject_name,
        totalScore: attempt.total_score,
        totalQuestions: attempt.total_questions,
        correctCount: attempt.total_correct,
        duration,
        submittedAt: attempt.submit_time,
      },
      aiAnalysis,
    });
  } catch (error) {
    console.error('analyzeExamResult error:', error);
    res.status(500).json({ success: false, message: 'Lỗi phân tích bài thi' });
  }
}

// ─── FEATURE 2: Giải thích câu sai ─────────────────────────────────────────────
/**
 * GET /api/ai/exam/:attemptId/explanations
 * Giải thích chi tiết từng câu sai
 */
async function explainWrongAnswers(req, res) {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const attemptResult = await db.query(
      `SELECT ea.id, e.title as exam_title, e.subject_id
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       WHERE ea.id = $1 AND ea.user_id = $2`,
      [attemptId, userId],
    );
    if (!attemptResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài thi' });
    }

    // Lấy tất cả câu hỏi + đáp án + câu trả lời user
    const questionsResult = await db.query(
      `SELECT
         q.id, q.question_number,
         q.question_text, q.question_text_cn,
         q.question_type, q.difficulty,
         q.explanation, q.explanation_cn,
         q.points,
         ua.selected_answer_key,
         ua.is_correct,
         ca.answer_key as correct_answer_key,
         ca.answer_text as correct_answer_text
       FROM user_answers ua
       JOIN questions q ON ua.question_id = q.id
       LEFT JOIN answers ca ON ca.question_id = q.id AND ca.is_correct = true
       WHERE ua.attempt_id = $1
       ORDER BY q.question_number`,
      [attemptId],
    );

    // Lấy answers cho mỗi câu
    const questions = await Promise.all(questionsResult.rows.map(async (q) => {
      const answersResult = await db.query(
        `SELECT answer_key, answer_text, answer_text_cn, is_correct
         FROM answers WHERE question_id = $1
         ORDER BY answer_key`,
        [q.id],
      ).catch(() => ({ rows: [] }));

      return {
        ...q,
        options: answersResult.rows.map(a => ({
          key: a.answer_key,
          text: a.answer_text,
          text_cn: a.answer_text_cn,
          is_correct: a.is_correct,
        })),
      };
    }));

    const wrongCount = questions.filter(q => !q.is_correct && q.selected_answer_key).length;

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        data: { explanations: [], wrongCount },
        message: 'AI đang bận, hiển thị kết quả cơ bản.',
      });
    }

    const explanations = await aiService.explainWrongAnswers(questions);

    res.json({
      success: true,
      wrongCount,
      questions,
      explanations,
    });
  } catch (error) {
    console.error('explainWrongAnswers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi giải thích câu sai' });
  }
}

// ─── FEATURE 3: Phân tích theo chủ đề ───────────────────────────────────────────
/**
 * POST /api/ai/topics
 * Phân tích điểm mạnh/yếu theo môn từ nhiều bài thi
 */
async function analyzeTopics(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const attempts = await db.query(
      `SELECT ea.id, ea.total_score, ea.total_correct, ea.total_incorrect,
              ea.submit_time, e.title as exam_title, e.total_questions,
              s.name as subject_name, s.name_cn
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE ea.user_id = $1 AND ea.status = 'completed'
       ORDER BY ea.submit_time DESC
       LIMIT 50`,
      [userId],
    );

    if (attempts.rows.length === 0) {
      return res.json({ success: true, hasEnoughData: false, message: 'Chưa có bài thi nào.' });
    }

    if (aiService.isRateLimited()) {
      return handleRateLimit(res, userId, aiService.getRateLimitRemaining(), 'AI đang bận.');
    }

    const result = await aiService.analyzeTopics(attempts.rows);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('analyzeTopics error:', error);
    res.status(500).json({ success: false, message: 'Lỗi phân tích chủ đề' });
  }
}

// ─── FEATURE 4: Gợi ý luyện tập ──────────────────────────────────────────────────
/**
 * POST /api/ai/practice
 * Gợi ý bài học và dạng bài cần luyện
 */
async function getPracticeRecommendations(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { weaknesses, examId } = req.body;

    // Lấy danh sách đề thi để gợi ý
    const exams = await db.query(
      `SELECT e.id, e.title, e.title_cn, e.difficulty_level, e.total_questions,
              e.duration, s.name as subject_name, e.status
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE e.status = 'published'
       ORDER BY e.created_at DESC
       LIMIT 30`,
    );

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        data: { recommendations: [], studyPlan: '' },
      });
    }

    const result = await aiService.getPracticeRecommendations(
      weaknesses || [],
      exams.rows,
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('getPracticeRecommendations error:', error);
    res.status(500).json({ success: false, message: 'Lỗi gợi ý luyện tập' });
  }
}

// ─── FEATURE 5: Chatbot hỏi đáp ────────────────────────────────────────────────
/**
 * POST /api/ai/ask
 * Chatbot AI trả lời câu hỏi của user về bài thi
 */
async function askAI(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { question, attemptId, conversationHistory } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Câu hỏi quá ngắn' });
    }

    // Lấy context từ bài thi nếu có attemptId
    let context = {};
    if (attemptId) {
      const attemptResult = await db.query(
        `SELECT e.title as exam_title, s.name as subject_name,
                ea.total_score, ea.total_correct, ea.total_incorrect
         FROM exam_attempts ea
         JOIN exams e ON ea.exam_id = e.id
         LEFT JOIN subjects s ON e.subject_id = s.id
         WHERE ea.id = $1 AND ea.user_id = $2`,
        [attemptId, userId],
      );
      if (attemptResult.rows[0]) {
        const a = attemptResult.rows[0];
        context.examTitle = a.exam_title;
        context.subjectName = a.subject_name;
        context.userScore = a.total_questions > 0
          ? Math.round((a.total_correct / a.total_questions) * 100)
          : parseFloat(a.total_score) || 0;
      }
    }

    if (aiService.isRateLimited()) {
      return res.json({
        success: false, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        answer: 'Xin lỗi, AI đang bận lúc này. Bạn hãy thử lại sau nhé! 🤖',
      });
    }

    const result = await aiService.askAI(question, context);

    res.json({
      success: true,
      answer: result.answer,
      timestamp: result.timestamp,
      error: result.error || false,
    });
  } catch (error) {
    console.error('askAI error:', error);
    res.status(500).json({ success: false, message: 'Lỗi chatbot AI' });
  }
}

// ─── FEATURE 6: Phân tích tiến bộ ───────────────────────────────────────────────
/**
 * GET /api/ai/progress
 * So sánh kết quả giữa các lần thi
 */
async function analyzeProgress(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const attempts = await db.query(
      `SELECT ea.id, ea.total_score, ea.total_correct, ea.total_incorrect,
              ea.submit_time, e.title as exam_title, e.total_questions
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       WHERE ea.user_id = $1 AND ea.status = 'completed'
       ORDER BY ea.submit_time ASC
       LIMIT 20`,
      [userId],
    );

    if (attempts.rows.length < 2) {
      return res.json({
        success: true,
        hasEnoughData: false,
        message: 'Cần ít nhất 2 bài thi để so sánh tiến bộ.',
        history: attempts.rows.map(a => ({
          examTitle: a.exam_title,
          date: a.submit_time,
          score: a.total_questions > 0
            ? Math.round((a.total_correct / a.total_questions) * 100)
            : parseFloat(a.total_score) || 0,
        })),
      });
    }

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        data: { history: [] },
        message: 'AI đang bận.',
      });
    }

    const result = await aiService.analyzeProgress(attempts.rows);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('analyzeProgress error:', error);
    res.status(500).json({ success: false, message: 'Lỗi phân tích tiến bộ' });
  }
}

// ─── FEATURE 7: Gợi ý đề tiếp theo ─────────────────────────────────────────────
/**
 * GET /api/ai/next-exam
 * Gợi ý đề thi phù hợp với trình độ
 */
async function recommendNextExam(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    // Lấy điểm mới nhất
    const latestAttempt = await db.query(
      `SELECT ea.total_correct, ea.total_score, ea.total_incorrect, e.total_questions,
              e.subject_id, s.name as subject_name
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE ea.user_id = $1 AND ea.status = 'completed'
       ORDER BY ea.submit_time DESC LIMIT 1`,
      [userId],
    );

    const last = latestAttempt.rows[0];
    const userScore = last?.total_questions > 0
      ? Math.round((last.total_correct / last.total_questions) * 100)
      : parseFloat(last?.total_score) || 60;

    // Lấy danh sách đề thi
    const exams = await db.query(
      `SELECT e.id, e.title, e.title_cn, e.difficulty_level, e.total_questions,
              e.duration, e.status, e.is_published, s.name as subject_name
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE e.status = 'published'
       ORDER BY e.created_at DESC
       LIMIT 50`,
    );

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        data: { recommendedExam: null, studyAdvice: 'Hãy thử lại sau.' },
      });
    }

    const result = await aiService.recommendNextExam({
      userScore,
      subjectName: last?.subject_name,
      allExams: exams.rows,
    });

    res.json({ success: true, userScore, ...result });
  } catch (error) {
    console.error('recommendNextExam error:', error);
    res.status(500).json({ success: false, message: 'Lỗi gợi ý đề tiếp theo' });
  }
}

// ─── FULL ANALYSIS (legacy endpoint - vẫn giữ) ─────────────────────────────────
async function analyzeUserPerformance(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const memKey = `ai:full_analysis:${userId}`;

    if (aiService.isRateLimited()) {
      return handleRateLimit(res, userId, aiService.getRateLimitRemaining(),
        'Hệ thống AI đang tạm thời bận.');
    }

    const memCached = cache.get(memKey);
    if (memCached) {
      return res.json({ success: true, cached: true, cacheSource: 'memory', cacheAge: memCached.cacheAge, data: memCached.data });
    }

    const cached = await db.query(
      `SELECT data, created_at FROM ai_insights WHERE user_id = $1 AND insight_type = 'full_analysis'
       AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (cached.rows.length > 0) {
      const age = Math.floor((Date.now() - new Date(cached.rows[0].created_at)) / 60000);
      cache.set(memKey, { data: cached.rows[0].data, cacheAge }, TTL.VERY_LONG);
      return res.json({ success: true, cached: true, cacheSource: 'db', cacheAge: age, data: cached.rows[0].data });
    }

    if (inFlightRequests.has(userId)) {
      const data = await inFlightRequests.get(userId);
      if (data) { cache.set(memKey, { data, cacheAge: 0 }, TTL.VERY_LONG); return res.json({ success: true, cached: true, cacheSource: 'inflight', cacheAge: 0, data }); }
      if (aiService.isRateLimited()) return handleRateLimit(res, userId, aiService.getRateLimitRemaining(), 'AI đang bận.');
    } else {
      let resolveInflight; const inflightPromise = new Promise(r => { resolveInflight = r; });
      inFlightRequests.set(userId, inflightPromise);
      req._resolveInflight = resolveInflight;
      req._inflightPromise = inflightPromise;
    }

    if (aiService.isRateLimited()) {
      if (req._resolveInflight) req._resolveInflight(null);
      return handleRateLimit(res, userId, aiService.getRateLimitRemaining(), 'AI đang bận.');
    }

    const attempts = await db.query(
      `SELECT ea.id, ea.total_score, ea.total_correct, ea.total_incorrect,
              ea.submit_time, e.title as exam_title, e.total_questions,
              s.name as subject_name, s.name_cn
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       LEFT JOIN subjects s ON e.subject_id = s.id
       WHERE ea.user_id = $1 AND ea.status = 'completed'
       ORDER BY ea.submit_time DESC LIMIT 20`,
      [userId],
    );

    if (attempts.rows.length === 0) {
      if (req._resolveInflight) req._resolveInflight(null);
      return res.json({ success: true, hasEnoughData: false, message: 'Chưa có bài thi nào.' });
    }

    const fullAnalysis = await aiService.generateFullAnalysis(attempts.rows, []);

    await db.query(`INSERT INTO ai_insights (user_id, insight_type, data) VALUES ($1, $2, $3)`,
      [userId, 'full_analysis', JSON.stringify(fullAnalysis)]);

    cache.set(memKey, { data: fullAnalysis, cacheAge: 0 }, TTL.VERY_LONG);
    if (req._resolveInflight) req._resolveInflight(fullAnalysis);
    res.json({ success: true, cached: false, cacheSource: 'none', data: fullAnalysis });
  } catch (error) {
    if (req._resolveInflight) req._resolveInflight(null);
    console.error('analyzeUserPerformance error:', error);
    res.status(500).json({ success: false, message: 'Lỗi phân tích.' });
  }
}

async function refreshAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const cooldownUntil = userCooldowns.get(userId) || 0;
    if (Date.now() < cooldownUntil) {
      const remainMin = Math.ceil((cooldownUntil - Date.now()) / 60000);
      return res.json({ success: false, rateLimited: true, message: `Đợi ${remainMin} phút.` });
    }
    userCooldowns.set(userId, Date.now() + REFRESH_COOLDOWN_MS);
    cache.del(`ai:full_analysis:${userId}`);
    await db.query(`DELETE FROM ai_insights WHERE user_id = $1 AND insight_type = 'full_analysis' AND created_at < NOW() - INTERVAL '30 minutes'`, [userId]);
    await analyzeUserPerformance(req, res);
  } catch (error) {
    console.error('refreshAnalysis error:', error);
    res.status(500).json({ success: false, message: 'Lỗi làm mới.' });
  }
}

module.exports = {
  analyzeExamResult,
  explainWrongAnswers,
  analyzeTopics,
  getPracticeRecommendations,
  askAI,
  analyzeProgress,
  recommendNextExam,
  analyzeUserPerformance,
  refreshAnalysis,
};
