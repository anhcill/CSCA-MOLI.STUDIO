const {
  PROVIDERS,
  MODELS,
  getDefaultModel,
  isAllowedModel,
  normalizeProvider,
} = require('../../config/aiModelPolicy');

describe('AI model policy', () => {
  test('keeps the required tier and MoliPet defaults', () => {
    expect(MODELS).toEqual({
      PREMIUM: 'ag/gemini-4-argon-low',
      FREE: 'ag/gemini-3.8-flash-low',
      MOLI_PET: 'ag/gemini-3-flash',
    });
    expect(getDefaultModel(PROVIDERS.NINE_ROUTER, 'premium')).toBe(MODELS.PREMIUM);
    expect(getDefaultModel(PROVIDERS.NINE_ROUTER, 'free')).toBe(MODELS.FREE);
  });

  test('only accepts 9Router and DeepSeek provider/model pairs', () => {
    expect(normalizeProvider('9ROUTER')).toBe(PROVIDERS.NINE_ROUTER);
    expect(normalizeProvider('deepseek')).toBe(PROVIDERS.DEEPSEEK);
    expect(normalizeProvider('legacy-provider')).toBe(PROVIDERS.NINE_ROUTER);
    expect(isAllowedModel(PROVIDERS.NINE_ROUTER, MODELS.PREMIUM)).toBe(true);
    expect(isAllowedModel(PROVIDERS.DEEPSEEK, 'deepseek-v4-pro')).toBe(true);
    expect(isAllowedModel(PROVIDERS.DEEPSEEK, MODELS.PREMIUM)).toBe(false);
  });
});
