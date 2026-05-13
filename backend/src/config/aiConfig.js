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

  const legacy = [
    process.env.BEEKNOEE_API_KEY,
    process.env.BEEKNOEE_API_KEY_1,
    process.env.BEEKNOEE_API_KEY_2,
  ].filter(Boolean);

  return [...new Set([...fromCombined, ...legacy])];
}

const config = {
  provider: process.env.AI_PROVIDER || 'beeknoee',

  beeknoee: {
    apiKeys: parseApiKeys(),
    model: process.env.BEEKNOEE_MODEL || 'gpt-5.4-mini',
    baseUrl: (process.env.BEEKNOEE_BASE_URL || 'https://platform.beeknoee.com/api/v1').replace(/\/+$/, ''),
    timeout: intEnv('BEEKNOEE_TIMEOUT_MS', 90000),
    maxTokens: intEnv('BEEKNOEE_MAX_TOKENS', 4000),
    examAnalysisMaxTokens: intEnv('AI_EXAM_ANALYSIS_MAX_TOKENS', 6000),
    explanationMaxTokens: intEnv('AI_EXPLANATION_MAX_TOKENS', 1800),
    essayMaxTokens: intEnv('AI_ESSAY_MAX_TOKENS', 3000),
    lessonMaxTokens: intEnv('AI_LESSON_MAX_TOKENS', 3000),
    chatMaxTokens: intEnv('AI_CHAT_MAX_TOKENS', 2200),
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
