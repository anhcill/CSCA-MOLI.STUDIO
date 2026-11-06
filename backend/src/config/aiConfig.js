/**
 * Central AI configuration.
 *
 * Production AI is routed through 9Router or DeepSeek.
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

function parseDeepSeekApiKeys() {
  const combined = process.env.DEEPSEEK_API_KEYS || '';
  const fromCombined = combined
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
  const indexed = parseIndexedKeys('DEEPSEEK_API_KEY');

  return [...new Set([...fromCombined, ...indexed])];
}

function normalizeModel(model) {
  const value = String(model || '').trim();
  if (!value) return value;
  if (/^gemini-/i.test(value)) return `google/${value}`;
  return value;
}

function normalizeModelList(...values) {
  const models = values
    .flatMap(value => String(value || '').split(','))
    .map(model => normalizeModel(model))
    .filter(Boolean);

  return [...new Set(models)];
}

function normalizeModelEnvList(listValue, ...fallbackValues) {
  return String(listValue || '').trim()
    ? normalizeModelList(listValue)
    : normalizeModelList(...fallbackValues);
}

function getApiKeyEnvIndex(name) {
  const match = name.match(/_(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

const config = {
  provider: process.env.AI_PROVIDER || '9router',

  runtime: {
    timeout: intEnv('AI_TIMEOUT_MS', 90000),
    ocrTimeout: intEnv('AI_OCR_TIMEOUT_MS', intEnv('AI_TIMEOUT_MS', 90000)),
    maxTokens: intEnv('AI_MAX_TOKENS', 4000),
    examAnalysisMaxTokens: intEnv('AI_EXAM_ANALYSIS_MAX_TOKENS', 1600),
    explanationMaxTokens: intEnv('AI_EXPLANATION_MAX_TOKENS', 1800),
    essayMaxTokens: intEnv('AI_ESSAY_MAX_TOKENS', 3000),
    lessonMaxTokens: intEnv('AI_LESSON_MAX_TOKENS', 3000),
    chatMaxTokens: intEnv('AI_CHAT_MAX_TOKENS', 2200),
    petChatMaxTokens: intEnv('MOLI_PET_MAX_TOKENS', 3000),
    temperature: floatEnv('AI_TEMPERATURE', 0.3),
    delayBetweenRequests: intEnv('AI_REQUEST_SPACING_MS', 300),
    maxConcurrent: intEnv('AI_MAX_CONCURRENT', 3),
  },

  moliPet: {
    provider: process.env.MOLI_PET_PROVIDER || '9router',
    model: process.env.MOLI_PET_MODEL || 'ag/gemini-3-flash',
    maxTokens: intEnv('MOLI_PET_MAX_TOKENS', 3000),
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
    model: normalizeModel(process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-4-argon-low'),
    ocrModel: normalizeModel(process.env.ADMIN_EXAM_AI_OCR_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-3.8-flash-low'),
    importModel: normalizeModel(process.env.ADMIN_EXAM_AI_IMPORT_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-3.8-flash-low'),
    importFallbackModel: normalizeModel(process.env.ADMIN_EXAM_AI_IMPORT_FALLBACK_MODEL || process.env.ADMIN_EXAM_AI_IMPORT_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-3-flash'),
    reviewModel: normalizeModel(process.env.ADMIN_EXAM_AI_REVIEW_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-4-argon-low'),
    fixModel: normalizeModel(process.env.ADMIN_EXAM_AI_FIX_MODEL || process.env.ADMIN_EXAM_AI_REVIEW_MODEL || process.env.ADMIN_EXAM_AI_MODEL || process.env.NINEROUTER_MODEL || 'ag/gemini-4-argon-low'),
    ocrModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_OCR_MODELS, process.env.ADMIN_EXAM_AI_OCR_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'ag/gemini-3.8-flash-low'),
    importModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_IMPORT_MODELS, process.env.ADMIN_EXAM_AI_IMPORT_MODEL, process.env.ADMIN_EXAM_AI_IMPORT_FALLBACK_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'ag/gemini-3.8-flash-low', 'ag/gemini-3-flash'),
    reviewModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_REVIEW_MODELS, process.env.ADMIN_EXAM_AI_REVIEW_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'ag/gemini-4-argon-low'),
    fixModels: normalizeModelEnvList(process.env.ADMIN_EXAM_AI_FIX_MODELS, process.env.ADMIN_EXAM_AI_FIX_MODEL, process.env.ADMIN_EXAM_AI_REVIEW_MODEL, process.env.ADMIN_EXAM_AI_MODEL, process.env.NINEROUTER_MODEL, 'ag/gemini-4-argon-low'),
    timeout: intEnv('ADMIN_EXAM_AI_TIMEOUT_MS', intEnv('AI_TIMEOUT_MS', 90000)),
    ocrTimeout: intEnv('ADMIN_EXAM_AI_OCR_TIMEOUT_MS', intEnv('AI_OCR_TIMEOUT_MS', intEnv('AI_TIMEOUT_MS', 90000))),
    maxTokens: intEnv('ADMIN_EXAM_AI_MAX_TOKENS', intEnv('AI_MAX_TOKENS', 4000)),
    temperature: floatEnv('ADMIN_EXAM_AI_TEMPERATURE', floatEnv('AI_TEMPERATURE', 0.3)),
    delayBetweenRequests: intEnv('ADMIN_EXAM_AI_REQUEST_SPACING_MS', intEnv('AI_REQUEST_SPACING_MS', 300)),
    backoffMs: intEnv('ADMIN_EXAM_AI_BACKOFF_MS', intEnv('AI_GLOBAL_BACKOFF_MS', 90000)),
  },

  deepseek: {
    apiKeys: parseDeepSeekApiKeys(),
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    chatModel: process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-pro',
    lessonModel: process.env.DEEPSEEK_LESSON_MODEL || 'deepseek-v4-flash',
    explanationModel: process.env.DEEPSEEK_EXPLANATION_MODEL || 'deepseek-v4-pro',
    chatMaxTokens: intEnv('DEEPSEEK_CHAT_MAX_TOKENS', 2200),
    lessonMaxTokens: intEnv('DEEPSEEK_LESSON_MAX_TOKENS', 1400),
    explanationMaxTokens: intEnv('DEEPSEEK_EXPLANATION_MAX_TOKENS', 5000),
    explanationSingleMaxTokens: intEnv('DEEPSEEK_EXPLANATION_SINGLE_MAX_TOKENS', 1400),
    timeout: intEnv('DEEPSEEK_TIMEOUT_MS', 50000),
    chatThinking: process.env.DEEPSEEK_CHAT_THINKING || 'disabled',
    lessonThinking: process.env.DEEPSEEK_LESSON_THINKING || 'disabled',
    explanationThinking: process.env.DEEPSEEK_EXPLANATION_THINKING || 'disabled',
    reasoningEffort: process.env.DEEPSEEK_REASONING_EFFORT || 'low',
  },

  general: {
    fallbackToRules: true,
    cacheTTLHours: intEnv('AI_CACHE_TTL_HOURS', 24),
    globalBackoffMs: intEnv('AI_GLOBAL_BACKOFF_MS', 90000),
  },
};

module.exports = config;
