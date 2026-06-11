/**
 * Central AI configuration.
 *
 * The production provider is Beeknoee, using OpenAI-compatible endpoints.
 * Keep real API keys in environment variables only.
 */

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function floatEnv(name, fallback) {
  const value = Number.parseFloat(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function parseApiKeys() {
  const combined = process.env.BEEKNOEE_API_KEYS || '';
  const fromCombined = combined
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

  const legacy = Object.entries(process.env)
    .filter(([name, value]) => /^BEEKNOEE_API_KEY(?:_\d+)?$/.test(name) && Boolean(value))
    .sort(([left], [right]) => getApiKeyEnvIndex(left) - getApiKeyEnvIndex(right))
    .map(([, key]) => key.trim())
    .filter(Boolean);

  return [...new Set([...fromCombined, ...legacy])];
}

function normalizeBeeknoeeModel(model) {
  const value = String(model || '').trim();
  if (!value) return value;
  if (/^gemini-/i.test(value)) return `google/${value}`;
  return value;
}

function getApiKeyEnvIndex(name) {
  if (name === 'BEEKNOEE_API_KEY') return 0;
  const match = name.match(/_(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

const config = {
  provider: process.env.AI_PROVIDER || 'beeknoee',

  beeknoee: {
    apiKeys: parseApiKeys(),
    model: process.env.BEEKNOEE_MODEL || 'gpt-5.4-mini',
    ocrModel: process.env.BEEKNOEE_OCR_MODEL || process.env.BEEKNOEE_MODEL || 'gpt-5.4-mini',
    importModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    importFallbackModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_IMPORT_FALLBACK_MODEL || process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    reviewModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_REVIEW_MODEL || process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    petChatModel: process.env.BEEKNOEE_PET_CHAT_MODEL || 'google/gemini-2.5-flash-lite',
    baseUrl: (process.env.BEEKNOEE_BASE_URL || 'https://platform.beeknoee.com/api/v1').replace(/\/+$/, ''),
    timeout: intEnv('BEEKNOEE_TIMEOUT_MS', 90000),
    ocrTimeout: intEnv('BEEKNOEE_OCR_TIMEOUT_MS', intEnv('BEEKNOEE_TIMEOUT_MS', 90000)),
    maxTokens: intEnv('BEEKNOEE_MAX_TOKENS', 4000),
    examAnalysisMaxTokens: intEnv('AI_EXAM_ANALYSIS_MAX_TOKENS', 6000),
    explanationMaxTokens: intEnv('AI_EXPLANATION_MAX_TOKENS', 1800),
    essayMaxTokens: intEnv('AI_ESSAY_MAX_TOKENS', 3000),
    lessonMaxTokens: intEnv('AI_LESSON_MAX_TOKENS', 3000),
    chatMaxTokens: intEnv('AI_CHAT_MAX_TOKENS', 2200),
    petChatMaxTokens: intEnv('MOLI_PET_MAX_TOKENS', 700),
    temperature: floatEnv('BEEKNOEE_TEMPERATURE', 0.3),
    delayBetweenRequests: intEnv('AI_REQUEST_SPACING_MS', 300),
    maxConcurrent: intEnv('AI_MAX_CONCURRENT', 3),
  },

  general: {
    fallbackToRules: true,
    cacheTTLHours: intEnv('AI_CACHE_TTL_HOURS', 24),
    globalBackoffMs: intEnv('AI_GLOBAL_BACKOFF_MS', 90000),
  },
};

module.exports = config;
