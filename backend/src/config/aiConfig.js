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

function parseIndexedKeys(prefix) {
  return Object.entries(process.env)
    .filter(([name, value]) => new RegExp(`^${prefix}(?:_\\d+)?$`).test(name) && Boolean(value))
    .sort(([left], [right]) => getApiKeyEnvIndex(left) - getApiKeyEnvIndex(right))
    .map(([, key]) => key.trim())
    .filter(Boolean);
}

function parseBeeknoeeApiKeys() {
  const combined = process.env.BEEKNOEE_API_KEYS || '';
  const fromCombined = combined
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

  const legacy = parseIndexedKeys('BEEKNOEE_API_KEY');

  return [...new Set([...fromCombined, ...legacy])];
}

function parseAdminExamApiKeys() {
  const combined = process.env.ADMIN_EXAM_AI_API_KEYS || process.env.NINEROUTER_KEYS || process.env.NINE_ROUTER_API_KEYS || '';
  const fromCombined = combined
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
  const legacy = [
    ...parseIndexedKeys('ADMIN_EXAM_AI_API_KEY'),
    process.env.NINEROUTER_API_KEY,
    process.env.NINEROUTER_KEY,
    process.env.NINE_ROUTER_API_KEY,
  ].map(key => String(key || '').trim()).filter(Boolean);

  return [...new Set([...fromCombined, ...legacy])];
}

function normalizeBeeknoeeModel(model) {
  const value = String(model || '').trim();
  if (!value) return value;
  if (/^gemini-/i.test(value)) return `google/${value}`;
  return value;
}

function normalizeModelList(...values) {
  const models = values
    .flatMap(value => String(value || '').split(','))
    .map(model => normalizeBeeknoeeModel(model))
    .filter(Boolean);

  return [...new Set(models)];
}

function normalizeModelEnvList(listValue, ...fallbackValues) {
  return String(listValue || '').trim()
    ? normalizeModelList(listValue)
    : normalizeModelList(...fallbackValues);
}

function getApiKeyEnvIndex(name) {
  if (name === 'BEEKNOEE_API_KEY') return 0;
  const match = name.match(/_(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

const config = {
  provider: process.env.AI_PROVIDER || 'beeknoee',

  beeknoee: {
    apiKeys: parseBeeknoeeApiKeys(),
    model: process.env.BEEKNOEE_MODEL || 'gpt-5.4-mini',
    ocrModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_OCR_MODEL || 'google/gemini-3.1-flash-lite'),
    examAnalysisModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_EXAM_ANALYSIS_MODEL || process.env.BEEKNOEE_OCR_MODEL || 'google/gemini-3.1-flash-lite'),
    insightModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_INSIGHT_MODEL || process.env.BEEKNOEE_OCR_MODEL || 'google/gemini-3.1-flash-lite'),
    importModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    importFallbackModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_IMPORT_FALLBACK_MODEL || process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    reviewModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_REVIEW_MODEL || process.env.BEEKNOEE_IMPORT_MODEL || 'google/gemini-3.1-flash-lite'),
    petChatModel: normalizeBeeknoeeModel(process.env.BEEKNOEE_PET_CHAT_MODEL || 'google/gemini-3.1-flash-lite'),
    baseUrl: (process.env.BEEKNOEE_BASE_URL || 'https://platform.beeknoee.com/api/v1').replace(/\/+$/, ''),
    timeout: intEnv('BEEKNOEE_TIMEOUT_MS', 90000),
    ocrTimeout: intEnv('BEEKNOEE_OCR_TIMEOUT_MS', intEnv('BEEKNOEE_TIMEOUT_MS', 90000)),
    maxTokens: intEnv('BEEKNOEE_MAX_TOKENS', 4000),
    examAnalysisMaxTokens: intEnv('AI_EXAM_ANALYSIS_MAX_TOKENS', 1600),
    explanationMaxTokens: intEnv('AI_EXPLANATION_MAX_TOKENS', 1800),
    essayMaxTokens: intEnv('AI_ESSAY_MAX_TOKENS', 3000),
    lessonMaxTokens: intEnv('AI_LESSON_MAX_TOKENS', 3000),
    chatMaxTokens: intEnv('AI_CHAT_MAX_TOKENS', 2200),
    petChatMaxTokens: intEnv('MOLI_PET_MAX_TOKENS', 1200),
    temperature: floatEnv('BEEKNOEE_TEMPERATURE', 0.3),
    delayBetweenRequests: intEnv('AI_REQUEST_SPACING_MS', 300),
    maxConcurrent: intEnv('AI_MAX_CONCURRENT', 3),
  },

  moliPet: {
    provider: process.env.MOLI_PET_PROVIDER || '9router',
    model: process.env.MOLI_PET_MODEL || 'ag/gemini-3-flash-agent',
    fallbackProvider: process.env.MOLI_PET_FALLBACK_PROVIDER || 'beeknoee',
    fallbackModel: normalizeBeeknoeeModel(
      process.env.MOLI_PET_FALLBACK_MODEL ||
      process.env.BEEKNOEE_PET_CHAT_MODEL ||
      'google/gemini-3.1-flash-lite',
    ),
    maxTokens: intEnv('MOLI_PET_MAX_TOKENS', 1200),
    timeout: intEnv('MOLI_PET_TIMEOUT_MS', 45000),
  },

  adminExam: {
    provider: process.env.ADMIN_EXAM_AI_PROVIDER || '9router',
    apiKeys: parseAdminExamApiKeys(),
    baseUrl: (
      process.env.ADMIN_EXAM_AI_BASE_URL ||
      process.env.NINEROUTER_BASE_URL ||
      process.env.NINEROUTER_URL ||
      process.env.NINE_ROUTER_BASE_URL ||
      process.env.NINE_ROUTER_URL ||
      ''
    ).replace(/\/+$/, ''),
    model: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.4-mini'),
    ocrModel: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_OCR_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.4-mini'),
    importModel: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_IMPORT_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.4-mini'),
    importFallbackModel: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_IMPORT_FALLBACK_MODEL || process.env.ADMIN_EXAM_AI_IMPORT_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.4'),
    reviewModel: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_REVIEW_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.5'),
    fixModel: normalizeBeeknoeeModel(process.env.ADMIN_EXAM_AI_FIX_MODEL || process.env.ADMIN_EXAM_AI_REVIEW_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'cx/gpt-5.5'),
    ocrModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_OCR_MODELS, process.env.ADMIN_EXAM_AI_OCR_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'cx/gpt-5.4-mini'),
    importModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_IMPORT_MODELS, process.env.ADMIN_EXAM_AI_IMPORT_MODEL, process.env.ADMIN_EXAM_AI_IMPORT_FALLBACK_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'cx/gpt-5.4-mini', 'cx/gpt-5.4'),
    reviewModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_REVIEW_MODELS, process.env.ADMIN_EXAM_AI_REVIEW_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'cx/gpt-5.5'),
    fixModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_FIX_MODELS, process.env.ADMIN_EXAM_AI_FIX_MODEL, process.env.ADMIN_EXAM_AI_REVIEW_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'cx/gpt-5.5'),
    timeout: intEnv('ADMIN_EXAM_AI_TIMEOUT_MS', intEnv('BEEKNOEE_TIMEOUT_MS', 90000)),
    ocrTimeout: intEnv('ADMIN_EXAM_AI_OCR_TIMEOUT_MS', intEnv('BEEKNOEE_OCR_TIMEOUT_MS', intEnv('BEEKNOEE_TIMEOUT_MS', 90000))),
    maxTokens: intEnv('ADMIN_EXAM_AI_MAX_TOKENS', intEnv('BEEKNOEE_MAX_TOKENS', 4000)),
    temperature: floatEnv('ADMIN_EXAM_AI_TEMPERATURE', floatEnv('BEEKNOEE_TEMPERATURE', 0.3)),
    delayBetweenRequests: intEnv('ADMIN_EXAM_AI_REQUEST_SPACING_MS', intEnv('AI_REQUEST_SPACING_MS', 300)),
    backoffMs: intEnv('ADMIN_EXAM_AI_BACKOFF_MS', intEnv('AI_GLOBAL_BACKOFF_MS', 90000)),
  },

  general: {
    fallbackToRules: true,
    cacheTTLHours: intEnv('AI_CACHE_TTL_HOURS', 24),
    globalBackoffMs: intEnv('AI_GLOBAL_BACKOFF_MS', 90000),
  },
};

module.exports = config;
