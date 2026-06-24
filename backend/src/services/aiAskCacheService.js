const crypto = require('crypto');
const db = require('../config/database');

const CACHE_VERSION = 'ai-ask-v1';
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

function buildAskCacheKey({ question, context }) {
  const payload = {
    version: CACHE_VERSION,
    question: compactQuestion(question),
    context: {
      examTitle: context?.examTitle || '',
      subjectName: context?.subjectName || '',
      userScore: context?.userScore ?? null,
      questionStats: context?.questionStats || null,
      questions: Array.isArray(context?.questions)
        ? context.questions.map((item) => ({
            question_number: item.question_number ?? null,
            question_text: item.question_text || '',
            question_type: item.question_type || '',
            selected_answer_key: item.selected_answer_key || '',
            selected_answer_text: item.selected_answer_text || '',
            correct_answer_key: item.correct_answer_key || '',
            correct_answer_text: item.correct_answer_text || '',
            status: item.status || '',
            is_correct: Boolean(item.is_correct),
          }))
        : [],
    },
  };
  return sha256(stableJson(payload));
}

async function getCachedAskAnswer({ question, context }) {
  await ensureAskCacheTable();
  const cacheKey = buildAskCacheKey({ question, context });
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

async function saveAskAnswer({ question, context, answer, userId, attemptId }) {
  const safeAnswer = String(answer || '').trim();
  if (!safeAnswer) return null;
  await ensureAskCacheTable();
  const cacheKey = buildAskCacheKey({ question, context });
  const metadata = {
    version: CACHE_VERSION,
    examTitle: context?.examTitle || '',
    subjectName: context?.subjectName || '',
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
