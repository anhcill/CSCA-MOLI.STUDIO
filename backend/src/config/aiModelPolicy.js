const PROVIDERS = Object.freeze({
  NINE_ROUTER: '9router',
  DEEPSEEK: 'deepseek',
});

const MODELS = Object.freeze({
  PREMIUM: 'ag/gemini-4-argon-low',
  FREE: 'ag/gemini-3.8-flash-low',
  MOLI_PET: 'ag/gemini-3-flash',
});

const NINE_ROUTER_MODELS = Object.freeze([
  MODELS.PREMIUM,
  MODELS.FREE,
  MODELS.MOLI_PET,
  'ag/gemini-3.5-flash-lite',
  'ag/gemini-3.1-flash-lite',
  'ag/gemini-2.5-flash',
  'ag/gemini-2.5-flash-thinking',
]);

const DEEPSEEK_MODELS = Object.freeze([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-reasoner',
]);

function normalizeProvider(value, fallback = PROVIDERS.NINE_ROUTER) {
  const provider = String(value || '').trim().toLowerCase();
  return Object.values(PROVIDERS).includes(provider) ? provider : fallback;
}

function getAllowedModels(provider) {
  return normalizeProvider(provider) === PROVIDERS.DEEPSEEK
    ? DEEPSEEK_MODELS
    : NINE_ROUTER_MODELS;
}

function isAllowedModel(provider, model) {
  return getAllowedModels(provider).includes(String(model || '').trim());
}

function getDefaultModel(provider, tier = 'premium') {
  if (normalizeProvider(provider) === PROVIDERS.DEEPSEEK) return 'deepseek-v4-pro';
  return tier === 'free' ? MODELS.FREE : MODELS.PREMIUM;
}

module.exports = {
  PROVIDERS,
  MODELS,
  NINE_ROUTER_MODELS,
  DEEPSEEK_MODELS,
  normalizeProvider,
  getAllowedModels,
  isAllowedModel,
  getDefaultModel,
};
