/**
 * AI Config — Cấu hình tập trung cho tất cả AI models
 *
 * Muốn đổi model/API? Chỉ cần sửa file này!
 *
 * Providers:
 *   - beeknoee  : Beeknoee proxy → DeepSeek R1 (mặc định)
 *   - gemini    : Google Gemini (fallback)
 *   - openai    : OpenAI compatible (ChatGPT, etc.)
 */

const config = {
  // ── Provider mặc định ─────────────────────────────────────────────
  provider: process.env.AI_PROVIDER || 'beeknoee',

  // ── Beeknoee (OpenAI-compatible) ───────────────────────────────────────────
  // Endpoint: https://platform.beeknoee.com/api/v1/v1/chat/completions
  beeknoee: {
    apiKeys: [
      process.env.BEEKNOEE_API_KEY    || 'sk-bee-d32a3f4bc08544b4945bee85e9bb3ff82f3ca9a6bb1c42fd8c2dc4ef5e7a2e9a',
      process.env.BEEKNOEE_API_KEY_1 || 'sk-bee-d32a3f4bc08544b4945bee85e9bb3ff87f8ef41543cb46d19a7552bb9b00e01c',
      process.env.BEEKNOEE_API_KEY_2 || 'sk-bee-d32a3f4bc08544b4945bee85e9bb3ff835601c6fd9904ddfa85a9b3f377943e2',
    ],
    model:       process.env.BEEKNOEE_MODEL     || 'gpt-5.4-mini',
    baseUrl:     'https://platform.beeknoee.com/api/v1',
    timeout:     60000,
    maxTokens:   4000,
    temperature: 0.3,
    // Round-robin: đợi bao lâu giữa 2 request (ms) để tránh rate limit
    delayBetweenRequests: 500,
  },

  // ── Gemini (Google) ───────────────────────────────────────────────
  gemini: {
    apiKey:   process.env.GEMINI_API_KEY  || '',
    model:    process.env.GEMINI_MODEL     || 'gpt-5.4-mini',
    timeout:  30000,
  },

  // ── OpenAI compatible ─────────────────────────────────────────────
  openai: {
    apiKey:   process.env.OPENAI_API_KEY  || '',
    model:    process.env.OPENAI_MODEL     || 'gpt-5.4-mini',
    baseUrl:  process.env.OPENAI_BASE_URL  || 'https://api.openai.com/v1',
    timeout:  30000,
  },

  // ── Cài đặt chung ───────────────────────────────────────────────
  general: {
    // Fallback: dùng khi không có API key
    fallbackToRules: true,
    // Cache AI response trong DB (24h)
    cacheTTLHours: 24,
    // Rate limit global (ms)
    globalBackoffMs: 90_000,
  },
};

module.exports = config;
