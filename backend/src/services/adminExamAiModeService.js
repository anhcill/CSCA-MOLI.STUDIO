const FAST_MODEL = process.env.ADMIN_EXAM_AI_FAST_MODEL || 'cx/gpt-5.5';
const OPUS_46_MODEL = 'ag/claude-opus-4-6-thinking';
const DEEP_REVIEW_MODEL = process.env.ADMIN_EXAM_AI_DEEP_REVIEW_MODEL || OPUS_46_MODEL;
const DEEP_TIMEOUT_MS = Number.parseInt(process.env.ADMIN_EXAM_AI_DEEP_TIMEOUT_MS || '300000', 10);
const FAST_MODEL_OPTIONS = [...new Set([FAST_MODEL, OPUS_46_MODEL, DEEP_REVIEW_MODEL])];

function normalizeAiQualityMode(value) {
  return String(value || '').trim().toLowerCase() === 'deep' ? 'deep' : 'fast';
}

function isDeepMode(value) {
  return normalizeAiQualityMode(value) === 'deep';
}

function normalizeFastModel(value) {
  const model = String(value || '').trim();
  return FAST_MODEL_OPTIONS.includes(model) ? model : FAST_MODEL;
}

function buildAiModeOptions(value, fastModelValue) {
  const qualityMode = normalizeAiQualityMode(value);
  const fastModel = normalizeFastModel(fastModelValue);
  return {
    qualityMode,
    fast: {
      reviewModel: fastModel,
      reviewModels: [fastModel],
      fixModel: fastModel,
      fixModels: [fastModel],
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
  normalizeFastModel,
  isDeepMode,
  buildAiModeOptions,
};
