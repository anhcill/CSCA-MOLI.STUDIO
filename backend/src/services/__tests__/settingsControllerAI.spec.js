jest.mock('../siteSettingsService', () => ({
  ensureSettingsTable: jest.fn().mockResolvedValue(),
  getSettings: jest.fn(),
  updateSettings: jest.fn().mockResolvedValue(),
}));
jest.mock('../aiService', () => ({
  testAIModel: jest.fn(),
}));

const siteSettingsService = require('../siteSettingsService');
const aiService = require('../aiService');
const controller = require('../../controllers/settingsController');

const currentSettings = {
  exam_date: '2026-06-10T08:00:00.000Z',
  public_ai_provider: '9router',
  premium_ai_provider: '9router',
  premium_ai_deepseek_model: 'deepseek-v4-pro',
  public_ai_9router_model: 'ag/gemini-4-argon-low',
  public_ai_free_9router_model: 'ag/gemini-3.8-flash-low',
  public_ai_fallback_provider: 'deepseek',
  admin_question_review_model: 'ag/gemini-4-argon-low',
  admin_question_review_fallback_model: 'ag/gemini-3.8-flash-low',
  welcome_settings: '{}',
};

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

describe('settings controller AI safety', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'settings-controller-test-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    siteSettingsService.getSettings.mockResolvedValue({ ...currentSettings });
    aiService.testAIModel.mockResolvedValue({ latencyMs: 420, preview: 'OK' });
  });

  test('rejects a cross-provider model test', async () => {
    const res = responseMock();
    await controller.testAIModel(
      { user: { id: 7 }, body: { provider: 'deepseek', model: 'ag/gemini-4-argon-low' } },
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(aiService.testAIModel).not.toHaveBeenCalled();
  });

  test('requires a successful test token before changing an AI model', async () => {
    const denied = responseMock();
    await controller.updateSettings(
      { user: { id: 7 }, body: { public_ai_free_9router_model: 'ag/gemini-3-flash' } },
      denied,
    );
    expect(denied.statusCode).toBe(400);
    expect(denied.body.code).toBe('AI_MODEL_TEST_REQUIRED');

    const probe = responseMock();
    await controller.testAIModel(
      { user: { id: 7 }, body: { provider: '9router', model: 'ag/gemini-3-flash' } },
      probe,
    );

    const saved = responseMock();
    await controller.updateSettings(
      {
        user: { id: 7 },
        body: {
          public_ai_free_9router_model: 'ag/gemini-3-flash',
          ai_model_test_tokens: [probe.body.data.testToken],
        },
      },
      saved,
    );
    expect(saved.statusCode).toBe(200);
    expect(siteSettingsService.updateSettings).toHaveBeenCalledWith({
      public_ai_free_9router_model: 'ag/gemini-3-flash',
    });
  });
});
