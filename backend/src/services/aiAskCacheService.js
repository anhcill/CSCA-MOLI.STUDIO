const crypto = require('crypto');
const db = require('../config/database');

const CACHE_VERSION = 'ai-ask-v2';
let initPromise = null;

function stableJson(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function compactQuestion(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 1000);
}

function compactText(value, maxLength = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function parseQuestionNumbers(question) {
  const text = String(question || '').toLowerCase();
  const numbers = new Set();
  const patterns = [
    /\bc[aâ]u\s*[:#.]?\s*(\d{1,3})\b/g,
    /\bquestion\s*[:#.]?\s*(\d{1,3})\b/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) numbers.add(value);
    }
  }
  return [...numbers];
}

function normalizeQuestionForCache(item) {
  return {
    question_id: item.question_id ?? item.id ?? null,
    question_number: item.question_number ?? null,
    sub_question_number: item.sub_question_number ?? null,
    question_text: compactText(item.question_text, 1200),
    question_type: item.question_type || '',
    selected_answer_key: item.selected_answer_key || '',
    selected_answer_text: compactText(item.selected_answer_text, 500),
    correct_answer_key: item.correct_answer_key || '',
    correct_answer_text: compactText(item.correct_answer_text, 500),
    status: item.status || '',
    is_correct: Boolean(item.is_correct),
  };
}

function normalizeExplicitCacheContext(cacheContext = {}) {
  if (!cacheContext || typeof cacheContext !== 'object') return null;
  const questionId = cacheContext.questionId ?? cacheContext.question_id ?? cacheContext.id ?? null;
  const questionNumber = cacheContext.questionNumber ?? cacheContext.question_number ?? null;
  const questionText = compactText(cacheContext.questionText || cacheContext.question_text, 1200);
  if (!questionId && !questionNumber && !questionText) return null;

  return {
    mode: compactText(cacheContext.mode || 'ask', 40),
    ai_tier: compactText(cacheContext.aiTier || cacheContext.ai_tier, 20),
    exam_id: cacheContext.examId ?? cacheContext.exam_id ?? null,
    question_id: questionId,
    question_number: questionNumber,
    sub_question_number: cacheContext.subQuestionNumber ?? cacheContext.sub_question_number ?? null,
    language_mode: compactText(cacheContext.languageMode || cacheContext.language_mode, 20),
    subject_name: compactText(cacheContext.subjectName || cacheContext.subject_name, 120),
    topic: compactText(cacheContext.topic, 180),
    status: compactText(cacheContext.status, 40),
    question_text: questionText,
    selected_answer_key: compactText(cacheContext.selectedAnswerKey || cacheContext.selected_answer_key, 20),
    selected_answer_text: compactText(cacheContext.selectedAnswerText || cacheContext.selected_answer_text, 500),
    correct_answer_key: compactText(cacheContext.correctAnswerKey || cacheContext.correct_answer_key, 20),
    correct_answer_text: compactText(cacheContext.correctAnswerText || cacheContext.correct_answer_text, 500),
  };
}

function getRelevantQuestionsForCache(question, context) {
  const questions = Array.isArray(context?.questions) ? context.questions : [];
  if (!questions.length) return [];

  const numbers = parseQuestionNumbers(question);
  const relevant = numbers.length
    ? questions.filter((item) => numbers.includes(Number(item.question_number)))
    : questions.slice(0, 12);

  return relevant.slice(0, 12).map(normalizeQuestionForCache);
}

function hasConversationHistory(history) {
  return Array.isArray(history) && history.some((item) => String(item?.content || '').trim());
}

function shouldUseAskCache({ imageDataUrl, conversationHistory }) {
  return !imageDataUrl && !hasConversationHistory(conversationHistory);
}

async function ensureAskCacheTable() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ai_ask_cache (
          cache_key    TEXT PRIMARY KEY,
          question     TEXT NOT NULL,
          answer       TEXT NOT NULL,
          metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
          user_id      INTEGER,
          attempt_id   TEXT,
          hit_count    INTEGER NOT NULL DEFAULT 0,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_hit_at  TIMESTAMPTZ
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_ask_cache_attempt_id ON ai_ask_cache (attempt_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_ask_cache_updated_at ON ai_ask_cache (updated_at DESC)`);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

function buildAskCacheKey({ question, context, cacheContext }) {
  const explicitContext = normalizeExplicitCacheContext(cacheContext);
  const payload = {
    version: CACHE_VERSION,
    question: compactQuestion(question),
    explicitContext,
    context: explicitContext ? null : {
      examTitle: context?.examTitle || '',
      subjectName: context?.subjectName || '',
      aiTier: context?.aiTier || '',
      questions: getRelevantQuestionsForCache(question, context),
    },
  };
  return sha256(stableJson(payload));
}

async function getCachedAskAnswer({ question, context, cacheContext }) {
  await ensureAskCacheTable();
  const cacheKey = buildAskCacheKey({ question, context, cacheContext });
  const result = await db.query(
    `UPDATE ai_ask_cache
     SET hit_count = hit_count + 1, last_hit_at = NOW()
     WHERE cache_key = $1
     RETURNING answer, metadata, created_at, hit_count`,
    [cacheKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    cacheKey,
    answer: row.answer,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    hitCount: row.hit_count,
  };
}

async function saveAskAnswer({ question, context, cacheContext, answer, userId, attemptId }) {
  const safeAnswer = typeof answer === 'string'
    ? answer.trim()
    : JSON.stringify(answer || {});
  if (!safeAnswer) return null;
  await ensureAskCacheTable();
  const cacheKey = buildAskCacheKey({ question, context, cacheContext });
  const metadata = {
    version: CACHE_VERSION,
    examTitle: context?.examTitle || '',
    subjectName: context?.subjectName || '',
    cacheContext: normalizeExplicitCacheContext(cacheContext),
    questionStats: context?.questionStats || null,
  };
  await db.query(
    `INSERT INTO ai_ask_cache (cache_key, question, answer, metadata, user_id, attempt_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (cache_key) DO UPDATE
     SET answer = EXCLUDED.answer,
         metadata = EXCLUDED.metadata,
         user_id = COALESCE(ai_ask_cache.user_id, EXCLUDED.user_id),
         attempt_id = COALESCE(ai_ask_cache.attempt_id, EXCLUDED.attempt_id),
         updated_at = NOW()`,
    [
      cacheKey,
      compactQuestion(question),
      safeAnswer,
      JSON.stringify(metadata),
      userId || null,
      attemptId ? String(attemptId) : null,
    ],
  );
  return cacheKey;
}

module.exports = {
  shouldUseAskCache,
  getCachedAskAnswer,
  saveAskAnswer,
  buildAskCacheKey,
  ensureAskCacheTable,
};
