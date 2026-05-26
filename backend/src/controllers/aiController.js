const db = require('../config/database');
const aiService = require('../services/aiService');
const { cache, TTL } = require('../config/cache');
const { canUseAIFeatures } = require('../middleware/authMiddleware');
const coinService = require('../services/coinService');

// ─── Per-user cooldown ──────────────────────────────────────────────────────────────
const userCooldowns = new Map();
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
const chatWindows = new Map();
const chatInFlightUsers = new Set();
const AI_CHAT_WINDOW_MS = 60 * 1000;
const AI_CHAT_MAX_PER_WINDOW = 12;
const AI_CHAT_MIN_INTERVAL_MS = 2500;
const AI_CHAT_MAX_QUESTION_LENGTH = 3000;
const INSIGHT_TYPES = {
  fullAnalysis: 'full_analysis',
  examAnalysis: 'exam_analysis',
  wrongAnswerExplanations: 'wrong_answer_explanations',
};

// ─── In-flight deduplication ────────────────────────────────────────────────────
const inFlightRequests = new Map();

// ─── Shared helpers ───────────────────────────────────────────────────────────────
async function getStaleCache(userId, insightType = INSIGHT_TYPES.fullAnalysis, attemptId = null) {
  const params = [userId, insightType];
  const attemptClause = attemptId ? 'AND attempt_id = $3' : '';
  if (attemptId) params.push(String(attemptId));
  const r = await db.query(
    `SELECT data, created_at FROM ai_insights
     WHERE user_id = $1 AND insight_type = $2
     ${attemptClause}
     ORDER BY created_at DESC LIMIT 1`,
    params,
  );
  return r.rows[0] || null;
}

async function handleRateLimit(res, userId, retryAfter, message, insightType = INSIGHT_TYPES.fullAnalysis, attemptId = null) {
  const stale = await getStaleCache(userId, insightType, attemptId);
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

function tryStartAIChat(userId) {
  if (chatInFlightUsers.has(userId)) return false;
  chatInFlightUsers.add(userId);
  return true;
}

function finishAIChat(userId) {
  chatInFlightUsers.delete(userId);
}

function checkAIChatSpam(userId) {
  const now = Date.now();
  const current = chatWindows.get(userId) || { windowStart: now, count: 0, lastAt: 0 };
  const state = now - current.windowStart >= AI_CHAT_WINDOW_MS
    ? { windowStart: now, count: 0, lastAt: current.lastAt || 0 }
    : current;

  const nextAllowedAt = state.lastAt + AI_CHAT_MIN_INTERVAL_MS;
  if (state.lastAt && now < nextAllowedAt) {
    chatWindows.set(userId, state);
    return {
      allowed: false,
      retryAfter: Math.ceil((nextAllowedAt - now) / 1000),
      message: 'Bạn hỏi hơi nhanh. Đợi vài giây rồi gửi tiếp nhé.',
    };
  }

  if (state.count >= AI_CHAT_MAX_PER_WINDOW) {
    chatWindows.set(userId, state);
    return {
      allowed: false,
      retryAfter: Math.ceil((state.windowStart + AI_CHAT_WINDOW_MS - now) / 1000),
      message: `Bạn đã hỏi AI ${AI_CHAT_MAX_PER_WINDOW} lần trong 1 phút. Đợi một chút rồi hỏi tiếp nhé.`,
    };
  }

  state.count += 1;
  state.lastAt = now;
  chatWindows.set(userId, state);
  return { allowed: true };
}

async function getAttemptAIContext(userId, attemptId) {
  const attemptResult = await db.query(
    `SELECT e.title as exam_title, s.name as subject_name,
            ea.total_score, ea.total_correct, ea.total_incorrect, e.total_questions
     FROM exam_attempts ea
     JOIN exams e ON ea.exam_id = e.id
     LEFT JOIN subjects s ON e.subject_id = s.id
     WHERE ea.id = $1 AND ea.user_id = $2`,
    [attemptId, userId],
  );

  if (!attemptResult.rows[0]) return {};

  const a = attemptResult.rows[0];
  const questionsResult = await db.query(
    `SELECT
        q.question_number,
        q.question_text,
        q.question_text_cn,
        q.question_text_en,
        q.question_type,
        ua.selected_answer_key,
        ua.is_correct,
        ca.answer_key AS correct_answer_key,
        COALESCE(ca.answer_text_cn, ca.answer_text) AS correct_answer_text,
        COALESCE(sa.answer_text_cn, sa.answer_text) AS selected_answer_text,
        CASE
          WHEN ua.id IS NULL OR ua.selected_answer_key IS NULL THEN 'unanswered'
          WHEN ua.is_correct = true THEN 'correct'
          ELSE 'incorrect'
        END AS status
     FROM exam_attempts ea
     JOIN questions q ON q.exam_id = ea.exam_id
     LEFT JOIN user_answers ua ON ua.attempt_id = ea.id AND ua.question_id = q.id
     LEFT JOIN LATERAL (
       SELECT answer_key, answer_text, answer_text_cn
       FROM answers
       WHERE question_id = q.id AND is_correct = true
       ORDER BY answer_key
       LIMIT 1
     ) ca ON true
     LEFT JOIN answers sa ON sa.question_id = q.id AND sa.answer_key = ua.selected_answer_key
     WHERE ea.id = $1 AND ea.user_id = $2
     ORDER BY q.question_number
     LIMIT 80`,
    [attemptId, userId],
  );

  const questions = questionsResult.rows.map((q) => ({
    question_number: q.question_number,
    question_text: q.question_text || q.question_text_cn || q.question_text_en || '',
    question_type: q.question_type,
    selected_answer_key: q.selected_answer_key,
    selected_answer_text: q.selected_answer_text,
    correct_answer_key: q.correct_answer_key,
    correct_answer_text: q.correct_answer_text,
    is_correct: q.status === 'correct',
    status: q.status,
  }));

  return {
    examTitle: a.exam_title,
    subjectName: a.subject_name,
    userScore: a.total_questions > 0
      ? Math.round((a.total_correct / a.total_questions) * 100)
      : parseFloat(a.total_score) || 0,
    questions,
    questionStats: {
      correct: questions.filter((q) => q.status === 'correct').length,
      incorrect: questions.filter((q) => q.status === 'incorrect').length,
      unanswered: questions.filter((q) => q.status === 'unanswered').length,
    },
  };
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

    // Lấy câu hỏi chi tiết (ALL questions in exam, with user answer if exists)
    let questions = [];
    try {
      const questionsResult = await db.query(
        `SELECT
           q.id, q.question_number, q.question_text, q.question_text_cn,
           q.question_type, q.difficulty,
           q.points, q.explanation, q.explanation_cn,
           q.passage_text,
           ua.selected_answer_key,
           ua.is_correct as user_is_correct
         FROM questions q
         LEFT JOIN user_answers ua ON ua.question_id = q.id AND ua.attempt_id = $1
         WHERE q.exam_id = $2
         ORDER BY q.question_number`,
        [attemptId, attempt.exam_id],
      );
      // Lấy tất cả options cho exam này trong 1 query
      const answersResult = await db.query(
        `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, a.is_correct
         FROM answers a
         WHERE a.question_id IN (
           SELECT q2.id FROM questions q2 WHERE q2.exam_id = $1
         )
         ORDER BY a.question_id, a.answer_key`,
        [attempt.exam_id],
      );
      // Group answers by question_id
      const answersByQ = {};
      for (const a of answersResult.rows) {
        if (!answersByQ[a.question_id]) answersByQ[a.question_id] = [];
        answersByQ[a.question_id].push({
          key: a.answer_key,
          text: a.answer_text || '',
          text_cn: a.answer_text_cn && a.answer_text_cn !== a.answer_text ? a.answer_text_cn : null,
          is_correct: a.is_correct,
        });
      }
      questions = questionsResult.rows.map(q => {
        const opts = answersByQ[q.id] || [];
        const userKey = q.selected_answer_key;
        const correctOpt = opts.find(o => o.is_correct);
        return {
          question_number: q.question_number,
          question_text: q.question_text,
          question_text_cn: q.question_text_cn,
          question_type: q.question_type,
          difficulty: q.difficulty,
          points: q.points,
          passage_text: q.passage_text,
          selected_answer_key: userKey,
          correct_answer_key: correctOpt?.key || '',
          correct_answer_text: correctOpt ? `${correctOpt.key}. ${correctOpt.text}` : '',
          is_correct: q.user_is_correct || false,
          options: opts,
        };
      });
    } catch (e) {
      console.error('Error fetching questions for AI:', e);
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

    // Lấy lần thi trước để so sánh
    let previousAttempt = null;
    try {
      const prevResult = await db.query(
        `SELECT ea.id, ea.total_score, ea.total_correct, ea.total_incorrect,
                ea.submit_time, e.title as exam_title, e.total_questions
         FROM exam_attempts ea
         JOIN exams e ON ea.exam_id = e.id
         WHERE ea.user_id = $1 AND ea.id != $2 AND ea.status = 'completed'
         ORDER BY ea.submit_time DESC LIMIT 1`,
        [userId, attemptId],
      );
      if (prevResult.rows[0]) {
        const p = prevResult.rows[0];
        const prevPct = p.total_questions > 0
          ? Math.round((p.total_correct / p.total_questions) * 100)
          : parseFloat(p.total_score) || 0;
        const currPct = Math.round((attempt.total_correct / attempt.total_questions) * 100);
        previousAttempt = {
          examTitle: p.exam_title,
          date: p.submit_time,
          score: prevPct,
          correct: p.total_correct,
          total: p.total_questions,
          delta: currPct - prevPct,
        };
      }
    } catch { /* no previous attempt */ }

    // Check cache trong DB trước
    const cacheResult = await db.query(
      `SELECT data, created_at FROM ai_insights
       WHERE user_id = $1 AND insight_type IN ($3, 'full_analysis')
       AND attempt_id = $2
       ORDER BY CASE WHEN insight_type = $3 THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
      [userId, String(attemptId), INSIGHT_TYPES.examAnalysis],
    );
    if (cacheResult.rows[0]) {
      const age = Math.floor((Date.now() - new Date(cacheResult.rows[0].created_at)) / 60000);
      return res.json({
        success: true,
        cached: true,
        cacheAge: age,
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
        previousAttempt,
        aiAnalysis: cacheResult.rows[0].data,
      });
    }

    // Gọi AI
    if (aiService.isRateLimited()) {
      const retryAfter = aiService.getRateLimitRemaining();
      const stale = await getStaleCache(userId, INSIGHT_TYPES.examAnalysis, attemptId);
      if (stale) {
        const age = Math.floor((Date.now() - new Date(stale.created_at)) / 60000);
        return res.json({
          success: true,
          cached: true,
          cacheSource: 'stale',
          cacheAge: age,
          rateLimited: true,
          retryAfter,
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
          previousAttempt,
          aiAnalysis: stale.data,
          message: 'AI đang bận, đang hiển thị phân tích đã lưu.',
        });
      }
      return res.json({
        success: true, rateLimited: true, retryAfter,
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
        previousAttempt,
        aiAnalysis: { score: Math.round((attempt.total_correct / attempt.total_questions) * 100) },
        message: 'AI đang bận, hiển thị kết quả cơ bản.',
      });
    }

    const inflightKey = `${INSIGHT_TYPES.examAnalysis}:${userId}:${attemptId}`;
    let aiAnalysis;
    let fromInflight = false;
    if (inFlightRequests.has(inflightKey)) {
      fromInflight = true;
      aiAnalysis = await inFlightRequests.get(inflightKey);
    } else {
      const analysisPromise = aiService.analyzeExamResult(attemptData)
        .finally(() => inFlightRequests.delete(inflightKey));
      inFlightRequests.set(inflightKey, analysisPromise);
      aiAnalysis = await analysisPromise;
    }

    // Lưu vào DB cache để lần sau không phải gọi AI lại
    try {
      if (!fromInflight) {
        await db.query(
          `INSERT INTO ai_insights (user_id, insight_type, data, attempt_id)
           VALUES ($1, $2, $3, $4)`,
          [userId, INSIGHT_TYPES.examAnalysis, JSON.stringify(aiAnalysis), attemptId],
        );
      }
    } catch (e) {
      console.error('Failed to save AI insight:', e);
    }

    res.json({
      success: true,
      cached: false,
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
      previousAttempt,
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

    const cached = await getStaleCache(userId, INSIGHT_TYPES.wrongAnswerExplanations, attemptId);
    if (cached) {
      const age = Math.floor((Date.now() - new Date(cached.created_at)) / 60000);
      return res.json({
        success: true,
        cached: true,
        cacheAge: age,
        wrongCount,
        questions,
        explanations: cached.data,
      });
    }

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        data: { explanations: [], wrongCount },
        message: 'AI đang bận, hiển thị kết quả cơ bản.',
      });
    }

    const explanations = await aiService.explainWrongAnswers(questions);

    try {
      await db.query(
        `INSERT INTO ai_insights (user_id, insight_type, data, attempt_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, INSIGHT_TYPES.wrongAnswerExplanations, JSON.stringify(explanations), attemptId],
      );
    } catch (e) {
      console.error('Failed to save AI explanations:', e);
    }

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
  let chatLockUserId = null;
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { question, attemptId, conversationHistory } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Câu hỏi quá ngắn' });
    }

    if (question.trim().length > AI_CHAT_MAX_QUESTION_LENGTH) {
      return res.status(400).json({ success: false, message: `Câu hỏi quá dài. Tối đa ${AI_CHAT_MAX_QUESTION_LENGTH} ký tự.` });
    }

    if (!tryStartAIChat(userId)) {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfter: 3,
        answer: 'AI đang trả lời câu trước của bạn. Đợi trả lời xong rồi hỏi tiếp nhé.',
      });
    }
    chatLockUserId = userId;

    const chatLimit = checkAIChatSpam(userId);
    if (!chatLimit.allowed) {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfter: chatLimit.retryAfter,
        answer: chatLimit.message,
      });
    }

    let context = {};
    if (attemptId) {
      context = await getAttemptAIContext(userId, attemptId);
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
    if (error.message === 'RATE_LIMITED') {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfter: error.retryAfter || aiService.getRateLimitRemaining(),
        answer: 'AI đang bận lúc này. Bạn hãy thử lại sau nhé.',
      });
    }
    res.status(500).json({ success: false, message: 'Lỗi chatbot AI' });
  } finally {
    if (chatLockUserId) finishAIChat(chatLockUserId);
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
              e.duration, e.status, s.name as subject_name
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
  let chargedLedger = null;
  let chargeCommittedToInsight = false;
  try {
    const userId = req.user.id;
    const isVip = canUseAIFeatures(req.user);
    const useCoins = req.query.useCoins === 'true';

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
      cache.set(memKey, { data: cached.rows[0].data, cacheAge: age }, TTL.VERY_LONG);
      return res.json({ success: true, cached: true, cacheSource: 'db', cacheAge: age, data: cached.rows[0].data });
    }

    // Nếu không có cache, user phải là VIP hoặc trả 50 Xu
    if (!isVip) {
      if (!useCoins) {
        if (req._resolveInflight) req._resolveInflight(null);
        return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium/VIP hoặc dùng 50 Xu để phân tích.', code: 'PREMIUM_REQUIRED', cost: 50 });
      }

      // Kiểm tra và trừ 50 Xu
      const userRes = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
      const currentCoins = userRes.rows[0]?.coins || 0;
      if (currentCoins < 50) {
        if (req._resolveInflight) req._resolveInflight(null);
        return res.status(403).json({ success: false, message: 'Bạn không đủ 50 Xu.', code: 'INSUFFICIENT_COINS', cost: 50 });
      }

      // Coin charge happens after analysis succeeds.
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
      inFlightRequests.delete(userId);
      return res.json({ success: true, hasEnoughData: false, message: 'Chưa có bài thi nào.' });
    }

    const fullAnalysis = await aiService.generateFullAnalysis(attempts.rows, []);

    if (!isVip) {
      chargedLedger = await coinService.debit(userId, 50, 'ai_analysis', {
        description: 'Dùng 50 xu để phân tích AI',
        metadata: { insightType: 'full_analysis' },
      });
    }

    await db.query(`INSERT INTO ai_insights (user_id, insight_type, data) VALUES ($1, $2, $3)`,
      [userId, 'full_analysis', JSON.stringify(fullAnalysis)]);
    chargeCommittedToInsight = true;

    cache.set(memKey, { data: fullAnalysis, cacheAge: 0 }, TTL.VERY_LONG);
    if (req._resolveInflight) req._resolveInflight(fullAnalysis);
    inFlightRequests.delete(userId);
    res.json({
      success: true,
      cached: false,
      cacheSource: 'none',
      data: fullAnalysis,
      coin_charged: Boolean(chargedLedger),
      coin_balance: chargedLedger?.balance_after,
    });
  } catch (error) {
    if (chargedLedger && !chargeCommittedToInsight) {
      await coinService.credit(req.user.id, Math.abs(Number(chargedLedger.amount) || 50), 'ai_analysis_refund', {
        description: 'Hoàn xu do phân tích AI thất bại',
        metadata: { originalLedgerId: chargedLedger.id, insightType: 'full_analysis' },
        idempotencyKey: `ai_analysis_refund:${chargedLedger.id}`,
      }).catch(refundError => {
        console.error('AI coin refund failed:', refundError);
      });
    }
    if (req._resolveInflight) req._resolveInflight(null);
    inFlightRequests.delete(req.user?.id);
    console.error('analyzeUserPerformance error:', error);
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message || 'Loi phan tich.',
        code: error.code,
      });
    }
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
    await db.query(
      `DELETE FROM ai_insights WHERE user_id = $1 AND insight_type = 'full_analysis'`,
      [userId],
    );
    await analyzeUserPerformance(req, res);
  } catch (error) {
    console.error('refreshAnalysis error:', error);
    res.status(500).json({ success: false, message: 'Lỗi làm mới.' });
  }
}

async function askAIStream(req, res) {
  let chatLockUserId = null;
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { question, attemptId, conversationHistory } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Câu hỏi quá ngắn' });
    }

    if (question.trim().length > AI_CHAT_MAX_QUESTION_LENGTH) {
      return res.status(400).json({ success: false, message: `Câu hỏi quá dài. Tối đa ${AI_CHAT_MAX_QUESTION_LENGTH} ký tự.` });
    }

    if (!tryStartAIChat(userId)) {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfter: 3,
        message: 'AI đang trả lời câu trước của bạn. Đợi trả lời xong rồi hỏi tiếp nhé.',
      });
    }
    chatLockUserId = userId;

    const chatLimit = checkAIChatSpam(userId);
    if (!chatLimit.allowed) {
      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfter: chatLimit.retryAfter,
        message: chatLimit.message,
      });
    }

    let context = {};
    if (attemptId) {
      context = await getAttemptAIContext(userId, attemptId);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    await aiService.askAIStream(question, context, res);
  } catch (error) {
    console.error('askAIStream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi chatbot AI stream' });
    } else {
      res.write(`data: ${JSON.stringify({ error: true, text: 'Lỗi server' })}\n\n`);
      res.end();
    }
  } finally {
    if (chatLockUserId) finishAIChat(chatLockUserId);
  }
}

// ─── FEATURE 8: Chấm điểm tự luận / Dịch thuật ───────────────────────────
/**
 * POST /api/ai/grade-essay
 * AI chấm điểm câu trả lời tự luận hoặc bài dịch
 */
async function gradeEssay(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { questionText, questionTextCn, userAnswer, correctAnswer, questionType } = req.body;

    if (!userAnswer || userAnswer.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Câu trả lời quá ngắn' });
    }

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        totalScore: 0,
        feedback: 'AI đang bận, vui lòng thử lại sau!',
      });
    }

    const result = await aiService.gradeEssay({
      questionText,
      questionTextCn,
      userAnswer,
      correctAnswer,
      questionType,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('gradeEssay error:', error);
    res.status(500).json({ success: false, message: 'Lỗi chấm bài tự luận' });
  }
}

// ─── FEATURE 9: Giảng lại lý thuyết ───────────────────────────────────
/**
 * POST /api/ai/teach-grammar
 * AI tạo bài giảng ngắn về ngữ pháp liên quan đến câu hỏi
 */
async function teachGrammar(req, res) {
  try {
    const userId = req.user.id;

    if (!canUseAIFeatures(req.user)) {
      return res.status(403).json({ success: false, message: 'Cần nâng cấp Premium hoặc VIP để sử dụng tính năng này.', code: 'PREMIUM_REQUIRED' });
    }

    const { question, topic, wrongAnswer, correctAnswer, userLevel } = req.body;

    if (aiService.isRateLimited()) {
      return res.json({
        success: true, rateLimited: true,
        retryAfter: aiService.getRateLimitRemaining(),
        grammarRule: 'AI đang bận, vui lòng thử lại sau!',
      });
    }

    const result = await aiService.teachGrammar({
      question,
      topic,
      wrongAnswer,
      correctAnswer,
      userLevel,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('teachGrammar error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo bài giảng' });
  }
}

module.exports = {
  analyzeExamResult,
  explainWrongAnswers,
  analyzeTopics,
  getPracticeRecommendations,
  askAI,
  askAIStream,
  analyzeProgress,
  recommendNextExam,
  analyzeUserPerformance,
  refreshAnalysis,
  gradeEssay,
  teachGrammar,
};
