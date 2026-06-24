const FAST_MODEL = process.env.ADMIN_EXAM_AI_FAST_MODEL || 'cx/gpt-5.5';
const DEEP_REVIEW_MODEL = process.env.ADMIN_EXAM_AI_DEEP_REVIEW_MODEL || 'ag/claude-opus-4-6-thinking';
const DEEP_TIMEOUT_MS = Number.parseInt(process.env.ADMIN_EXAM_AI_DEEP_TIMEOUT_MS || '300000', 10);

function normalizeAiQualityMode(value) {
  return String(value || '').trim().toLowerCase() === 'deep' ? 'deep' : 'fast';
}

function isDeepMode(value) {
  return normalizeAiQualityMode(value) === 'deep';
}

function buildAiModeOptions(value) {
  const qualityMode = normalizeAiQualityMode(value);
  return {
    qualityMode,
    fast: {
      reviewModel: FAST_MODEL,
      reviewModels: [FAST_MODEL],
      fixModel: FAST_MODEL,
      fixModels: [FAST_MODEL],
    },
    deep: qualityMode === 'deep'
      ? {
          reviewModel: DEEP_REVIEW_MODEL,
          reviewModels: [DEEP_REVIEW_MODEL],
          aiTimeoutMs: DEEP_TIMEOUT_MS,
        }
      : null,
  };
}

module.exports = {
  normalizeAiQualityMode,
  isDeepMode,
  buildAiModeOptions,
};
