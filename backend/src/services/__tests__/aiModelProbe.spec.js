jest.mock('axios', () => ({ post: jest.fn() }));

const originalEnv = { ...process.env };
process.env.ADMIN_EXAM_AI_BASE_URL = 'https://router.example/v1';
process.env.ADMIN_EXAM_AI_API_KEYS = 'router-key';
process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example/v1';
process.env.DEEPSEEK_API_KEYS = 'deepseek-key';

const axios = require('axios');
const { testAIModel } = require('../aiService');

describe('admin AI model probe', () => {
  beforeEach(() => {
    axios.post.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('probes exactly the selected 9Router model without fallback', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'OK' } }] } });
    const result = await testAIModel({
      provider: '9router',
      model: 'ag/gemini-4-argon-low',
      userId: 1,
    });

    expect(result.preview).toBe('OK');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toMatchObject({
      model: 'ag/gemini-4-argon-low',
      max_tokens: 64,
      temperature: 0,
    });
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe('Bearer router-key');
  });

  test('rejects a model that belongs to another provider before making a request', async () => {
    await expect(testAIModel({ provider: 'deepseek', model: 'ag/gemini-4-argon-low' }))
      .rejects.toMatchObject({ providerCode: 'AI_MODEL_NOT_ALLOWED', statusCode: 400 });
    expect(axios.post).not.toHaveBeenCalled();
  });
});
