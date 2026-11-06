const jwt = require('jsonwebtoken');
const {
  ensureSettingsTable,
  getSettings,
  updateSettings: saveSettings,
} = require('../services/siteSettingsService');
const aiService = require('../services/aiService');
const { PROVIDERS, normalizeProvider, isAllowedModel } = require('../config/aiModelPolicy');

const PUBLIC_KEYS = ['exam_date', 'welcome_settings'];
const AI_KEYS = [
  'public_ai_provider',
  'premium_ai_provider',
  'premium_ai_deepseek_model',
  'public_ai_9router_model',
  'public_ai_free_9router_model',
  'public_ai_fallback_provider',
  'admin_question_review_model',
  'admin_question_review_fallback_model',
];
const ADMIN_KEYS = ['exam_date', ...AI_KEYS, 'welcome_settings'];

ensureSettingsTable().catch((error) => console.error('initSettings error:', error.message));

function normalizeModel(value) {
  return String(value || '').trim();
}

function parseWelcomeSettings(data) {
  try {
    return data.welcome_settings ? JSON.parse(data.welcome_settings) : null;
  } catch {
    return null;
  }
}

function modelTestSecret() {
  const secret = process.env.AI_MODEL_TEST_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('AI_MODEL_TEST_SECRET_NOT_CONFIGURED');
  return secret;
}

function createModelTestToken(userId, provider, model) {
  return jwt.sign(
    { scope: 'ai-model-test', userId: String(userId), provider, model },
    modelTestSecret(),
    { expiresIn: '10m' },
  );
}

function verifyModelTestTokens(tokens, userId, requiredPairs) {
  const verified = new Set();
  for (const token of Array.isArray(tokens) ? tokens : []) {
    try {
      const payload = jwt.verify(token, modelTestSecret());
      if (payload.scope !== 'ai-model-test' || String(payload.userId) !== String(userId)) continue;
      verified.add(`${payload.provider}:${payload.model}`);
    } catch {}
  }
  return requiredPairs.every(({ provider, model }) => verified.has(`${provider}:${model}`));
}

function addRequiredPair(pairs, provider, model) {
  const key = `${provider}:${model}`;
  if (!pairs.some((item) => `${item.provider}:${item.model}` === key)) pairs.push({ provider, model });
}

async function getPublicSettings(req, res) {
  try {
    const data = await getSettings(PUBLIC_KEYS);
    res.json({ success: true, data: { exam_date: data.exam_date, welcome_settings: parseWelcomeSettings(data) } });
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getAdminSettings(req, res) {
  try {
    const data = await getSettings(ADMIN_KEYS);
    res.json({ success: true, data: { ...data, welcome_settings: parseWelcomeSettings(data) } });
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function testAIModel(req, res) {
  const provider = normalizeProvider(req.body?.provider, '');
  const model = normalizeModel(req.body?.model);
  if (!provider || !isAllowedModel(provider, model)) {
    return res.status(400).json({ success: false, message: 'Provider hoặc model không hợp lệ.' });
  }

  try {
    const result = await aiService.testAIModel({ provider, model, userId: req.user.id });
    return res.json({
      success: true,
      data: {
        provider,
        model,
        latencyMs: result.latencyMs,
        preview: result.preview,
        testToken: createModelTestToken(req.user.id, provider, model),
      },
    });
  } catch (error) {
    console.error('testAIModel error:', error.providerCode || error.message);
    return res.status(error.statusCode || 502).json({
      success: false,
      message: 'Model không phản hồi thành công. Kiểm tra cấu hình hoặc thử model khác.',
      code: error.providerCode || 'AI_MODEL_TEST_FAILED',
      latencyMs: error.latencyMs,
    });
  }
}

async function updateSettings(req, res) {
  try {
    const current = await getSettings(ADMIN_KEYS);
    const next = {};
    const requiredTests = [];

    if (req.body.exam_date !== undefined) {
      if (!req.body.exam_date || Number.isNaN(Date.parse(req.body.exam_date))) {
        return res.status(400).json({ success: false, message: 'Ngày thi không hợp lệ.' });
      }
      next.exam_date = req.body.exam_date;
    }

    if (req.body.public_ai_provider !== undefined) {
      if (normalizeProvider(req.body.public_ai_provider, '') !== PROVIDERS.NINE_ROUTER) {
        return res.status(400).json({ success: false, message: 'User thường chỉ dùng 9Router.' });
      }
      next.public_ai_provider = PROVIDERS.NINE_ROUTER;
    }

    const premiumProvider = req.body.premium_ai_provider !== undefined
      ? normalizeProvider(req.body.premium_ai_provider, '')
      : normalizeProvider(current.premium_ai_provider);
    if (!premiumProvider) {
      return res.status(400).json({ success: false, message: 'Provider VIP/Premium không hợp lệ.' });
    }
    if (req.body.premium_ai_provider !== undefined) next.premium_ai_provider = premiumProvider;

    const modelFields = [
      ['public_ai_9router_model', PROVIDERS.NINE_ROUTER],
      ['public_ai_free_9router_model', PROVIDERS.NINE_ROUTER],
      ['premium_ai_deepseek_model', PROVIDERS.DEEPSEEK],
      ['admin_question_review_model', PROVIDERS.NINE_ROUTER],
      ['admin_question_review_fallback_model', PROVIDERS.NINE_ROUTER],
    ];
    for (const [field, provider] of modelFields) {
      if (req.body[field] === undefined) continue;
      const model = normalizeModel(req.body[field]);
      if (!isAllowedModel(provider, model)) {
        return res.status(400).json({ success: false, message: `Model không hợp lệ cho ${provider}: ${model}` });
      }
      next[field] = model;
      if (String(current[field]) !== model) addRequiredPair(requiredTests, provider, model);
    }

    if (req.body.public_ai_fallback_provider !== undefined) {
      const fallbackProvider = normalizeProvider(req.body.public_ai_fallback_provider, '');
      if (!fallbackProvider) {
        return res.status(400).json({ success: false, message: 'Fallback provider không hợp lệ.' });
      }
      next.public_ai_fallback_provider = fallbackProvider;
    }

    const premiumModel = premiumProvider === PROVIDERS.DEEPSEEK
      ? (next.premium_ai_deepseek_model || current.premium_ai_deepseek_model)
      : (next.public_ai_9router_model || current.public_ai_9router_model);
    if (!isAllowedModel(premiumProvider, premiumModel)) {
      return res.status(400).json({ success: false, message: 'Model VIP/Premium không khớp provider.' });
    }
    if (String(current.premium_ai_provider) !== premiumProvider) {
      addRequiredPair(requiredTests, premiumProvider, premiumModel);
    }

    if (req.body.welcome_settings !== undefined) {
      next.welcome_settings = typeof req.body.welcome_settings === 'string'
        ? req.body.welcome_settings
        : JSON.stringify(req.body.welcome_settings);
    }

    if (!Object.keys(next).length) {
      return res.status(400).json({ success: false, message: 'Không có cài đặt cần lưu.' });
    }
    if (requiredTests.length && !verifyModelTestTokens(req.body.ai_model_test_tokens, req.user.id, requiredTests)) {
      return res.status(400).json({
        success: false,
        code: 'AI_MODEL_TEST_REQUIRED',
        message: 'Hãy test thành công từng model đã thay đổi trước khi lưu.',
        requiredModels: requiredTests,
      });
    }

    await saveSettings(next);
    const data = await getSettings(ADMIN_KEYS);
    return res.json({
      success: true,
      message: 'Cập nhật thành công',
      data: { ...data, welcome_settings: parseWelcomeSettings(data) },
    });
  } catch (error) {
    console.error('updateSettings error:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = { getPublicSettings, getAdminSettings, testAIModel, updateSettings };
