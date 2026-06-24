/**
 * AI Service — Tất cả 7 features AI cho hệ thống thi CSCA
 *
 * Models are configured in src/config/aiConfig.js via Beeknoee env vars.
 * Muốn đổi model? Sửa src/config/aiConfig.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const aiConfig = require('../config/aiConfig');
const { DEFAULT_SETTINGS, getSettings } = require('./siteSettingsService');

// ─── Rate limiting (global, file-based) ─────────────────────────────────────────
const RATE_LIMIT_FILE = path.join(__dirname, '../../.ai_ratelimit');
let rateLimitedUntil = 0;
let lastRequestTime = 0;

try {
  const saved = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
  if (saved.until > Date.now()) {
    rateLimitedUntil = saved.until;
    console.log(`📋 AI rate limit còn ${Math.ceil((saved.until - Date.now()) / 1000)}s`);
  }
} catch { /* first run */ }

function isRateLimited() { return Date.now() < rateLimitedUntil; }
function setRateLimit(ms) {
  rateLimitedUntil = Date.now() + ms;
  try { fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ until: rateLimitedUntil })); } catch {}
}
function getRateLimitRemaining() { return Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000)); }

// ─── Round-robin API key pool ────────────────────────────────────────────────
const BEE = aiConfig.beeknoee;
const ADMIN_EXAM_AI = aiConfig.adminExam || {};
const PUBLIC_AI_UNAVAILABLE_MESSAGE = 'Xin lỗi, AI đang gặp sự cố tạm thời. Bên mình sẽ kiểm tra và khắc phục sớm, bạn thử lại sau nhé.';
const PUBLIC_AI_BUSY_MESSAGE = 'AI đang bận lúc này. Bạn thử lại sau nhé.';
const PRIVATE_AI_PROVIDER_ERROR_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\b(?:beeknoee|beegnoee|benoke|bennoke|9router|openrouter)\b/i,
  /\b(?:insufficient|balance|billing|payment|credit|credits|quota|recharge|top\s*up|api\s*key|api-key|apikey|no\s+api\s+key|not\s+enough|resource\s+exhausted)\b/i,
  /\b(?:so\s*du|nap\s*tien|tai\s*khoan|het\s*tien|het\s*credit)\b/i,
  /余额|账户|充值|额度|欠费/,
];
const AI_ACCURACY_PROMPT_RULES = `- Đọc kỹ đề gốc, đáp án và giải thích admin trước khi suy luận.
- Giữ nguyên ký hiệu toán/logic và điều kiện trong đề: <, <=, ≤, >, >=, ≥, =, ≠, ∈, ∉, ∪, ∩, ∅, |.
- Không đổi ≤ thành <, ≥ thành >, không đổi dấu âm, số mũ, chỉ số, miền xác định, tập nghiệm hoặc đáp án.
- Với câu Toán/Khoa học, đối chiếu lại điều kiện gốc và các lựa chọn trước khi kết luận.
- Nếu thiếu dữ kiện, thiếu hình/bảng/biểu đồ hoặc đáp án không khớp dữ liệu, nói rõ phần thiếu; không đoán.`;
let currentKeyIndex = 0;
let adminExamKeyIndex = 0;
let adminExamRateLimitedUntil = 0;
let adminExamLastRequestTime = 0;

function getNextKey() {
  const keys = BEE.apiKeys.filter(Boolean);
  if (keys.length === 0) return null;
  const keyNumber = (currentKeyIndex % keys.length) + 1;
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex++;
  console.log(`AI request using Beeknoee key #${keyNumber}/${keys.length}`);
  return key;
}

function getChatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/(?:v1|api\/v1)$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function getNextAdminExamKey() {
  const keys = (ADMIN_EXAM_AI.apiKeys || []).filter(Boolean);
  if (keys.length === 0) return null;
  const keyNumber = (adminExamKeyIndex % keys.length) + 1;
  const key = keys[adminExamKeyIndex % keys.length];
  adminExamKeyIndex++;
  console.log(`Admin exam AI request using ${ADMIN_EXAM_AI.provider || 'custom'} key #${keyNumber}/${keys.length}`);
  return { key, keyNumber, total: keys.length };
}

function isAdminExamProviderEnabled() {
  return Boolean(ADMIN_EXAM_AI.baseUrl);
}

function isAdminExamRateLimited() {
  return Date.now() < adminExamRateLimitedUntil;
}

function setAdminExamRateLimit(ms) {
  adminExamRateLimitedUntil = Date.now() + ms;
}

function getAdminExamRateLimitRemaining() {
  return Math.max(0, Math.ceil((adminExamRateLimitedUntil - Date.now()) / 1000));
}

function isNineRouterAdminExam() {
  const provider = String(ADMIN_EXAM_AI.provider || '').toLowerCase();
  const baseUrl = String(ADMIN_EXAM_AI.baseUrl || '').toLowerCase();
  return provider.includes('9router') || provider.includes('ninerouter') || baseUrl.includes('9router');
}

function isUsableAdminExamRouterModel(model) {
  const value = String(model || '').trim();
  if (!value) return false;
  if (!isNineRouterAdminExam()) return true;

  // This project wires admin exam AI to Codex/Antigravity accounts in 9router.
  // Plain google/* models require separate Google API-key credentials in 9router.
  return value.startsWith('cx/') || value.startsWith('ag/');
}

function getAdminExamModelCandidates(options = {}) {
  const configured = [
    ...(Array.isArray(options.models) ? options.models : []),
    options.model,
    ADMIN_EXAM_AI.model,
  ]
    .map(model => String(model || '').trim())
    .filter(Boolean);
  const filtered = configured.filter(isUsableAdminExamRouterModel);
  if (isNineRouterAdminExam()) return [...new Set(filtered)];
  const candidates = filtered.length ? filtered : configured;
  return [...new Set(candidates)];
}

function createAdminExamAIError(message = 'ADMIN_EXAM_AI_UNAVAILABLE', err) {
  const error = new Error(message);
  error.provider = ADMIN_EXAM_AI.provider || 'admin-exam-ai';
  error.providerStatus = err?.providerStatus ?? err?.response?.status;
  error.providerCode = err?.providerCode ?? err?.code;
  error.providerMessage = err ? getProviderResponseMessage(err) : 'Admin exam AI provider is unavailable';
  return error;
}

function getProviderResponseMessage(err) {
  const data = err?.response?.data;
  const message =
    data?.error?.message ||
    data?.message ||
    data?.error ||
    err?.message ||
    'AI provider request failed';

  if (typeof message === 'string') {
    return message.slice(0, 500);
  }

  try {
    return JSON.stringify(message).slice(0, 500);
  } catch {
    return 'AI provider request failed';
  }
}

function stringifyAIErrorValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return [
      value.message,
      value.providerMessage,
      value.providerCode,
      value.code,
      value.response?.data,
    ].map(stringifyAIErrorValue).filter(Boolean).join(' ');
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeAIErrorText(value) {
  return stringifyAIErrorValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasPrivateAIProviderDetails(value) {
  const text = normalizeAIErrorText(value);
  return Boolean(text) && PRIVATE_AI_PROVIDER_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

function getPublicAIErrorMessage(error, fallback = PUBLIC_AI_UNAVAILABLE_MESSAGE) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (['INSUFFICIENT_COINS', 'PREMIUM_REQUIRED'].includes(error?.code)) return message || fallback;
  if (error?.message === 'RATE_LIMITED') return PUBLIC_AI_BUSY_MESSAGE;
  if (error?.message === 'AI_PROVIDER_ERROR' || error?.message === 'AI_TIMEOUT') return PUBLIC_AI_UNAVAILABLE_MESSAGE;
  if (error?.providerMessage || error?.providerCode) return PUBLIC_AI_UNAVAILABLE_MESSAGE;
  if (hasPrivateAIProviderDetails(error)) return PUBLIC_AI_UNAVAILABLE_MESSAGE;

  return message || fallback;
}

function getPublicProviderStreamError(data) {
  if (!data || data === '[DONE]') return '';

  try {
    const parsed = JSON.parse(data);
    const content = parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content;
    if (content) return '';
    if (parsed?.error || parsed?.message || parsed?.detail) {
      return PUBLIC_AI_UNAVAILABLE_MESSAGE;
    }
  } catch {
    if (hasPrivateAIProviderDetails(data)) return PUBLIC_AI_UNAVAILABLE_MESSAGE;
  }

  return '';
}

function writeAIStreamPublicError(res, message = PUBLIC_AI_UNAVAILABLE_MESSAGE) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

function extractOpenAICompatibleText(data) {
  if (!data) return '';
  if (typeof data !== 'string') {
    const messageText = data?.choices?.[0]?.message?.content;
    if (typeof messageText === 'string') return messageText.trim();
    const deltaText = data?.choices?.[0]?.delta?.content;
    if (typeof deltaText === 'string') return deltaText.trim();
    return '';
  }

  const text = data.trim();
  if (!text) return '';
  if (!text.startsWith('data:')) {
    try {
      return extractOpenAICompatibleText(JSON.parse(text));
    } catch {
      return text;
    }
  }

  let out = '';
  for (const line of text.split(/\r?\n/)) {
    const payload = line.trim().replace(/^data:\s*/, '');
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      out += chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || '';
    } catch {}
  }
  return out.trim();
}

function createSafeProviderError(err) {
  const status = err?.response?.status;
  const error = new Error('AI_PROVIDER_ERROR');
  error.providerStatus = Number.isFinite(status) ? status : undefined;
  error.providerCode = err?.code;
  error.providerMessage = getProviderResponseMessage(err);
  return error;
}

function isAbortError(err, signal) {
  return signal?.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('AI_REQUEST_ABORTED');
  error.providerCode = 'ERR_CANCELED';
  throw error;
}

async function waitBetweenRequests() {
  const delay = BEE.delayBetweenRequests || 500;
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < delay) {
    const wait = delay - elapsed;
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

async function waitAdminExamBetweenRequests() {
  const delay = ADMIN_EXAM_AI.delayBetweenRequests || BEE.delayBetweenRequests || 500;
  const elapsed = Date.now() - adminExamLastRequestTime;
  if (elapsed < delay) {
    await new Promise(r => setTimeout(r, delay - elapsed));
  }
  adminExamLastRequestTime = Date.now();
}

// Global concurrency: max 3 concurrent AI requests
let concurrentCount = 0;
const MAX_CONCURRENT = BEE.maxConcurrent || 3;

async function withConcurrency(fn) {
  while (concurrentCount >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 500));
  }
  concurrentCount++;
  try {
    return await fn();
  } finally {
    concurrentCount--;
  }
}

// ─── AI Core: Gọi Beeknoee  ───────────────────────────────────────
async function callBeeknoeeMessages(messages, options = {}) {
  if (isRateLimited()) {
    const e = new Error('RATE_LIMITED');
    e.retryAfter = getRateLimitRemaining();
    throw e;
  }

  await waitBetweenRequests();

  const {
    maxTokens = BEE.maxTokens,
    temperature = BEE.temperature,
    model = BEE.model,
    timeout = BEE.timeout,
    signal,
  } = options;
  throwIfAborted(signal);
  const apiKey = getNextKey();

  if (!apiKey) {
    throw new Error('Không có API key nào được cấu hình');
  }

  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  return withConcurrency(async () => {
    try {
      const response = await axios.post(
        `${BEE.baseUrl}/chat/completions`,
        payload,
        {
          timeout,
          signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      // OpenAI-compatible response, including SSE text from local routers.
      const text = extractOpenAICompatibleText(response.data);
      return text || JSON.stringify(response.data);
    } catch (err) {
      if (isAbortError(err, signal)) {
        throwIfAborted(signal);
      }
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        const e = new Error('AI_TIMEOUT');
        throw e;
      }
      if (err.response?.status === 429) {
        // Key bị rate limit → chuyển sang key khác ngay
        const keyCount = BEE.apiKeys.filter(Boolean).length || 1;
        console.warn(`Beeknoee key #${currentKeyIndex % keyCount} hit rate limit, backing off...`);
        currentKeyIndex++;
        setRateLimit(aiConfig.general.globalBackoffMs);
        const e = new Error('RATE_LIMITED');
        e.retryAfter = getRateLimitRemaining();
        throw e;
      }
      throw createSafeProviderError(err);
    }
  });
}

async function callBeeknoee(prompt, options = {}) {
  return callBeeknoeeMessages([{ role: 'user', content: prompt }], options);
}

async function callAdminExamAIMessages(messages, options = {}) {
  const modelCandidates = getAdminExamModelCandidates(options);

  if (!isAdminExamProviderEnabled()) {
    throw createAdminExamAIError('ADMIN_EXAM_AI_NOT_CONFIGURED');
  }

  if (isAdminExamRateLimited()) {
    const error = createAdminExamAIError('ADMIN_EXAM_AI_RATE_LIMITED');
    error.retryAfter = getAdminExamRateLimitRemaining();
    throw error;
  }

  if (!modelCandidates.length) {
    throw createAdminExamAIError('ADMIN_EXAM_AI_NO_USABLE_MODEL');
  }

  const {
    maxTokens = ADMIN_EXAM_AI.maxTokens || BEE.maxTokens,
    temperature = ADMIN_EXAM_AI.temperature ?? BEE.temperature,
    timeout = ADMIN_EXAM_AI.timeout || BEE.timeout,
    fallbackOnTimeout = true,
    signal,
  } = options;
  throwIfAborted(signal);
  let lastError = null;

  for (const model of modelCandidates) {
    const keyCount = (ADMIN_EXAM_AI.apiKeys || []).filter(Boolean).length;
    const attempts = Math.max(1, keyCount);

    for (let attempt = 0; attempt < attempts; attempt++) {
      await waitAdminExamBetweenRequests();
      throwIfAborted(signal);

      const keyInfo = getNextAdminExamKey();
      const headers = { 'Content-Type': 'application/json' };
      if (keyInfo?.key) headers.Authorization = `Bearer ${keyInfo.key}`;

      const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };

      try {
        return await withConcurrency(async () => {
          const response = await axios.post(
            getChatCompletionsUrl(ADMIN_EXAM_AI.baseUrl),
            payload,
            { timeout, signal, headers },
          );
          const text = extractOpenAICompatibleText(response.data);
          return text || JSON.stringify(response.data);
        });
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const message = getProviderResponseMessage(err);
        const keyLabel = keyInfo ? `key #${keyInfo.keyNumber}/${keyInfo.total}` : 'no key';
        if (isAbortError(err, signal)) {
          throwIfAborted(signal);
        }
        const timedOut = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
        if (timedOut && fallbackOnTimeout === false) {
          const timeoutError = new Error('AI_TIMEOUT');
          timeoutError.providerCode = err.code;
          timeoutError.providerMessage = message;
          throw timeoutError;
        }
        if ([401, 403, 429].includes(status)) {
          console.warn(`${ADMIN_EXAM_AI.provider || 'Admin exam AI'} ${keyLabel} model ${model} blocked/quota limited, trying next key/model:`, message);
        } else {
          console.warn(`${ADMIN_EXAM_AI.provider || 'Admin exam AI'} ${keyLabel} model ${model} failed, trying next key/model:`, message);
        }
      }
    }
  }

  console.warn(`${ADMIN_EXAM_AI.provider || 'Admin exam AI'} exhausted model chain; admin exam AI will not fall back to Beeknoee.`);
  setAdminExamRateLimit(ADMIN_EXAM_AI.backoffMs || aiConfig.general.globalBackoffMs);
  throw createAdminExamAIError('ADMIN_EXAM_AI_EXHAUSTED', lastError);
}

async function callAdminExamAI(prompt, options = {}) {
  return callAdminExamAIMessages([{ role: 'user', content: prompt }], options);
}

const PUBLIC_AI_SETTING_KEYS = [
  'public_ai_provider',
  'public_ai_9router_model',
  'public_ai_beeknoee_model',
  'public_ai_fallback_provider',
];

async function getPublicAISettings() {
  try {
    const settings = await getSettings(PUBLIC_AI_SETTING_KEYS);
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.warn('Public AI settings unavailable, using env/defaults:', error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function normalizeRuntimeProvider(provider, fallback = '9router') {
  const value = String(provider || '').trim().toLowerCase();
  return ['9router', 'beeknoee'].includes(value) ? value : fallback;
}

function getPublicAIModel(provider, settings) {
  if (provider === '9router') {
    return settings.public_ai_9router_model || process.env.PUBLIC_AI_9ROUTER_MODEL || DEFAULT_SETTINGS.public_ai_9router_model;
  }
  return settings.public_ai_beeknoee_model || process.env.PUBLIC_AI_BEEKNOEE_MODEL || BEE.model || DEFAULT_SETTINGS.public_ai_beeknoee_model;
}

function getPublicAIBaseUrl(provider) {
  if (provider === '9router') return process.env.PUBLIC_AI_9ROUTER_BASE_URL || ADMIN_EXAM_AI.baseUrl || '';
  return BEE.baseUrl;
}

function getPublicAIKey(provider) {
  if (provider === '9router') return getNextAdminExamKey()?.key || '';
  return getNextKey() || '';
}

async function getPublicAIRuntime(preferredProvider) {
  const settings = await getPublicAISettings();
  const primary = normalizeRuntimeProvider(
    preferredProvider || settings.public_ai_provider || process.env.PUBLIC_AI_PROVIDER,
    DEFAULT_SETTINGS.public_ai_provider,
  );
  const fallback = normalizeRuntimeProvider(
    settings.public_ai_fallback_provider || process.env.PUBLIC_AI_FALLBACK_PROVIDER,
    DEFAULT_SETTINGS.public_ai_fallback_provider,
  );
  return { primary, fallback, settings };
}

function createPublicAIProviderError(provider, err, fallbackMessage = 'AI_PROVIDER_ERROR') {
  const error = new Error(fallbackMessage);
  error.provider = provider;
  error.providerStatus = err?.providerStatus ?? err?.response?.status;
  error.providerCode = err?.providerCode ?? err?.code;
  error.providerMessage = err ? getProviderResponseMessage(err) : `${provider} provider is unavailable`;
  return error;
}

async function callOpenAICompatibleMessages(provider, messages, options, settings) {
  const {
    maxTokens = BEE.maxTokens,
    temperature = BEE.temperature,
    timeout = provider === '9router' ? (ADMIN_EXAM_AI.timeout || BEE.timeout) : BEE.timeout,
    signal,
  } = options || {};
  const model = options?.model || getPublicAIModel(provider, settings);
  const baseUrl = getPublicAIBaseUrl(provider);
  const apiKey = getPublicAIKey(provider);

  if (!baseUrl || !apiKey) throw createPublicAIProviderError(provider, null, 'PUBLIC_AI_NOT_CONFIGURED');

  throwIfAborted(signal);
  const response = await axios.post(
    getChatCompletionsUrl(baseUrl),
    { model, messages, max_tokens: maxTokens, temperature },
    {
      timeout,
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  const text = extractOpenAICompatibleText(response.data);
  return text || JSON.stringify(response.data);
}

async function callPublicAIMessages(messages, options = {}) {
  if (isRateLimited()) {
    const e = new Error('RATE_LIMITED');
    e.retryAfter = getRateLimitRemaining();
    throw e;
  }

  await waitBetweenRequests();
  const runtime = await getPublicAIRuntime(options.provider);
  const providers = [...new Set([runtime.primary, runtime.fallback].filter(Boolean))];
  let lastError = null;

  for (const provider of providers) {
    try {
      return await withConcurrency(() => callOpenAICompatibleMessages(provider, messages, options, runtime.settings));
    } catch (err) {
      lastError = err;
      if (isAbortError(err, options.signal)) throwIfAborted(options.signal);
      if (err.response?.status === 429 && provider === 'beeknoee') {
        currentKeyIndex++;
        setRateLimit(aiConfig.general.globalBackoffMs);
      }
      console.warn(`Public AI ${provider} failed, trying fallback if available:`, getProviderResponseMessage(err));
    }
  }

  throw createPublicAIProviderError(runtime.primary, lastError);
}

async function callPublicAI(prompt, options = {}) {
  return callPublicAIMessages([{ role: 'user', content: prompt }], options);
}

// ─── Parse JSON từ AI response ────────────────────────────────────────────────
function getAnswerText(options, key) {
  if (!options || !key) return '';
  const opt = options.find(o => o.key === key);
  return opt ? (opt.text || opt.text_cn || '') : '';
}
function parseAIMaybeJSON(text) {
  try { return JSON.parse(text); } catch {}
  // Thử tìm JSON block trong markdown
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  if (text) {
    console.warn('AI JSON parse failed. Preview:', String(text).slice(0, 500));
  }
  return null;
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function compactText(value, maxLength) {
  const text = asString(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value.filter(item => item !== null && item !== undefined) : fallback;
}

function compactStringArray(value, fallback = [], limit = 3, maxItemLength = 160) {
  return asArray(value, fallback)
    .map(v => compactText(v, maxItemLength))
    .filter(Boolean)
    .slice(0, limit);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeGradeColor(value, fallback = 'blue') {
  return ['emerald', 'blue', 'amber', 'red'].includes(value) ? value : fallback;
}

function normalizeExamAnalysis(ai, fallback, percentage) {
  const source = ai && typeof ai === 'object' ? ai : {};
  return {
    ...fallback,
    ...source,
    score: percentage,
    grade: asString(source.grade, fallback.grade),
    gradeColor: normalizeGradeColor(source.gradeColor, fallback.gradeColor),
    summary: compactText(source.summary || fallback.summary, 260),
    strengths: compactStringArray(source.strengths, fallback.strengths, 2, 120),
    weaknesses: compactStringArray(source.weaknesses, fallback.weaknesses, 3, 140),
    analysis: compactText(source.analysis || fallback.analysis, 360),
    overallAdvice: compactText(source.overallAdvice || fallback.overallAdvice, 260),
    priorityTopics: compactStringArray(source.priorityTopics, fallback.priorityTopics, 3, 80),
    studyPlan: compactText(source.studyPlan || fallback.studyPlan, 220),
    examTips: compactStringArray(source.examTips, fallback.examTips, 3, 110),
    commonMistakes: compactStringArray(source.commonMistakes, fallback.commonMistakes, 3, 120),
    nextExamSuggestion: compactText(source.nextExamSuggestion || fallback.nextExamSuggestion, 160),
  };
}

function normalizeExplanationResult(ai, wrongQuestions) {
  const explanations = asArray(ai?.explanations).map((item, index) => ({
    questionNumber: asNumber(item?.questionNumber, wrongQuestions[index]?.question_number || index + 1),
    yourAnswer: asString(item?.yourAnswer),
    correctAnswer: asString(item?.correctAnswer),
    whyWrong: asString(item?.whyWrong),
    knowledgeNote: asString(item?.knowledgeNote),
    tip: asString(item?.tip),
    vocabulary: asArray(item?.vocabulary).map(v => ({
      word: asString(v?.word),
      pinyin: asString(v?.pinyin),
      meaning: asString(v?.meaning),
    })).filter(v => v.word || v.meaning),
  })).filter(item => item.whyWrong || item.knowledgeNote || item.tip);

  return { explanations };
}

function normalizeEssayGrade(ai) {
  return {
    success: true,
    totalScore: Math.max(0, Math.min(10, asNumber(ai?.totalScore, 0))),
    gradingCriteria: asArray(ai?.gradingCriteria).map(item => ({
      criterion: asString(item?.criterion, 'Tiêu chí'),
      score: Math.max(0, Math.min(10, asNumber(item?.score, 0))),
      maxScore: Math.max(1, asNumber(item?.maxScore, 10)),
      comment: asString(item?.comment),
    })),
    errors: asArray(ai?.errors).map(item => ({
      original: asString(item?.original),
      correct: asString(item?.correct),
      reason: asString(item?.reason),
      type: asString(item?.type, 'grammar'),
    })),
    modelAnswer: asString(ai?.modelAnswer),
    feedback: asString(ai?.feedback),
    suggestions: asArray(ai?.suggestions).map(v => asString(v)).filter(Boolean),
  };
}

function normalizeGrammarLesson(ai) {
  return {
    success: true,
    title: asString(ai?.title, 'Bài học ngữ pháp'),
    grammarRule: asString(ai?.grammarRule),
    examples: asArray(ai?.examples).map(item => ({
      chinese: asString(item?.chinese),
      pinyin: asString(item?.pinyin),
      vietnamese: asString(item?.vietnamese),
      usage: asString(item?.usage),
    })).filter(item => item.chinese || item.vietnamese),
    memoryTips: asArray(ai?.memoryTips).map(v => asString(v)).filter(Boolean),
    commonMistakes: asArray(ai?.commonMistakes).map(v => asString(v)).filter(Boolean),
    relatedTopics: asArray(ai?.relatedTopics).map(v => asString(v)).filter(Boolean),
  };
}

// ─── Fallback rule-based analysis ─────────────────────────────────────────────
function ruleBasedExamAnalysis(attemptData) {
  const { totalScore, totalQuestions, correctCount, subjectName, questions } = attemptData;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const isPassing = percentage >= 60;
  const isExcellent = percentage >= 85;
  const wrongCount = totalQuestions - correctCount;

  return {
    score: percentage,
    grade: isExcellent ? 'Tuyệt vời!' : isPassing ? 'Đạt yêu cầu' : 'Cần cố gắng',
    gradeColor: isExcellent ? 'emerald' : isPassing ? 'blue' : 'red',
    summary: isExcellent
      ? `Bạn làm rất tốt với ${correctCount}/${totalQuestions} câu đúng! Kiến thức của bạn vững chắc.`
      : isPassing
      ? `Bạn đạt ${percentage}% - kết quả đạt yêu cầu. Cần ôn luyện thêm để cải thiện điểm số.`
      : `Bạn đạt ${percentage}% - cần học kỹ hơn. Hãy ôn lại lý thuyết và làm nhiều bài tập hơn.`,
    analysis: isExcellent
      ? `Bạn làm rất tốt! Kiến thức vững chắc.`
      : isPassing
      ? `Kết quả đạt yêu cầu. Cần ôn luyện thêm để cải thiện.`
      : `Bạn cần học kỹ hơn. Hãy ôn lại từ đầu, chia nhỏ từng chủ đề.`,
    strengths: isExcellent
      ? [`Bạn nắm vững kiến thức cơ bản`, `Làm bài nhanh và chính xác`, `Hiểu rõ các khái niệm quan trọng`]
      : isPassing
      ? [`Bạn nắm được một phần kiến thức`, `Có nền tảng cơ bản để phát triển`]
      : [`Bạn đã bắt đầu tiếp cận nội dung`, `Vẫn có thể cải thiện nhanh nếu chăm chỉ`],
    weaknesses: isPassing
      ? [`Còn sai ở một số câu hỏi khó`, `Cần ôn thêm phần nâng cao`]
      : [`Cần ôn lại toàn bộ kiến thức cơ bản`, `Chưa nắm vững các khái niệm trọng tâm`, `Cần luyện tập nhiều hơn`],
    overallAdvice: isExcellent
      ? 'Tiếp tục duy trì và thử thách bản thân với các đề khó hơn. Hãy tập trung vào những phần hiếm khi sai.'
      : isPassing
      ? 'Hãy tập trung vào những phần bạn sai, ôn lại kiến thức cơ bản và làm thêm bài tập.'
      : 'Học lại từ đầu, chia nhỏ từng chủ đề và luyện tập đều đặn mỗi ngày. Đừng nản lòng!',
    priorityTopics: ['Củng cố kiến thức cơ bản', 'Luyện tập theo chủ đề'],
    studyPlan: isExcellent
      ? 'Duy trì thói quen học tập, mỗi tuần làm 1-2 đề thi thử để giữ nhịp. Tập trung vào đề khó hơn.'
      : isPassing
      ? 'Tuần 1-2: Ôn lại các phần sai. Tuần 3-4: Làm đề luyện tập. Tuần 5+: Kiểm tra lại kết quả.'
      : 'Tuần 1: Học lại lý thuyết từ đầu. Tuần 2-3: Luyện bài tập cơ bản. Tuần 4+: Làm đề thi thử.',
    examTips: ['Đọc kỹ đề bài trước khi trả lời', 'Làm những câu dễ trước', 'Kiểm tra lại bài trước khi nộp'],
    commonMistakes: ['Đọc đề vội vàng dẫn đến hiểu sai', 'Chọn đáp án đầu tiên mà không xem hết các lựa chọn'],
    nextExamSuggestion: isPassing
      ? 'Nên thử đề có độ khó trung bình-cao để thử thách bản thân.'
      : 'Hãy bắt đầu với đề cơ bản để củng cố kiến thức trước.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: Phân tích kết quả bài thi
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Phân tích kết quả 1 bài thi cụ thể
 * @param {Object} attemptData - { totalScore, totalQuestions, correctCount, subjectName, duration, questions }
 */
async function analyzeExamResult(attemptData) {
  const { questions = [] } = attemptData;
  const { correctCount, totalQuestions } = attemptData;
  const safeTotal = Number(totalQuestions) || questions.length || 1;
  const safeCorrect = Number(correctCount) || 0;
  const percentage = Math.round((safeCorrect / safeTotal) * 100);
  const examAnalysisMaxTokens = Math.min(BEE.examAnalysisMaxTokens || 1600, 1800);
  const examAnalysisModel = BEE.examAnalysisModel || BEE.ocrModel || BEE.importModel || BEE.model;

  // Nếu không có câu hỏi chi tiết → rule-based
  if (!questions.length || questions.length < 3) {
    return ruleBasedExamAnalysis(attemptData);
  }

  // Phân loại câu sai theo loại
  const wrongQuestions = questions.filter(q => !q.is_correct && q.selected_answer_key);
  const unansweredQuestions = questions.filter(q => !q.selected_answer_key);
  const focusQuestions = [...wrongQuestions, ...unansweredQuestions].slice(0, 45);
  const correctSamples = [];
  const usedCorrectNumbers = new Set();
  ['hard', 'medium', 'easy'].forEach(level => {
    const sample = questions.find(q => q.is_correct && q.difficulty === level);
    if (sample && !usedCorrectNumbers.has(sample.question_number)) {
      correctSamples.push(sample);
      usedCorrectNumbers.add(sample.question_number);
    }
  });
  questions.forEach(q => {
    if (correctSamples.length >= 4) return;
    if (q.is_correct && !usedCorrectNumbers.has(q.question_number)) {
      correctSamples.push(q);
      usedCorrectNumbers.add(q.question_number);
    }
  });

  const easyCorrect = questions.filter(q => q.difficulty === 'easy' && q.is_correct).length;
  const mediumCorrect = questions.filter(q => q.difficulty === 'medium' && q.is_correct).length;
  const hardCorrect = questions.filter(q => q.difficulty === 'hard' && q.is_correct).length;
  const easyTotal = questions.filter(q => q.difficulty === 'easy').length;
  const mediumTotal = questions.filter(q => q.difficulty === 'medium').length;
  const hardTotal = questions.filter(q => q.difficulty === 'hard').length;

  const difficultyBreakdown = {
    easy:   { correct: easyCorrect,   total: easyTotal,   rate: easyTotal ? Math.round(easyCorrect / easyTotal * 100) : 0 },
    medium: { correct: mediumCorrect, total: mediumTotal, rate: mediumTotal ? Math.round(mediumCorrect / mediumTotal * 100) : 0 },
    hard:   { correct: hardCorrect,   total: hardTotal,   rate: hardTotal ? Math.round(hardCorrect / hardTotal * 100) : 0 },
  };

  // Xây dựng prompt ngắn hơn: thống kê toàn bài + câu sai/bỏ trống + vài câu đúng mẫu.
  const prevAttempt = attemptData.previousAttempt;
  const compactQuestion = (q) => {
    const status = q.is_correct ? 'ĐÚNG' : (q.selected_answer_key ? 'SAI' : 'BỎ TRỐNG');
    const userAnswer = q.selected_answer_key
      ? `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`
      : 'CHƯA TRẢ LỜI';
    const correctKey = q.correct_answer_key || '?';
    const correctAnswerText = getAnswerText(q.options, correctKey);
    return `Câu ${q.question_number}: [${status}]
Loại: ${q.question_type || 'single_choice'} | Độ khó: ${q.difficulty || 'medium'}
Đề: ${q.question_text || q.question_text_cn || ''}
Bạn chọn: ${userAnswer}
Đáp án đúng: ${correctKey}. ${correctAnswerText || ''}
Gợi ý có sẵn: ${q.explanation || q.explanation_cn || 'Không có'}
${q.passage_text ? `Đoạn văn: ${q.passage_text.substring(0, 160)}` : ''}`.substring(0, 520);
  };
  const focusQuestionsText = focusQuestions.map(compactQuestion).join('\n\n') || 'Không có câu sai hoặc bỏ trống.';
  const correctSamplesText = correctSamples.map(compactQuestion).join('\n\n') || 'Không có mẫu câu đúng.';

  // Phân loại câu sai để AI có thêm context
  const typeBreakdown = {};
  questions.forEach(q => {
    const type = q.question_type || 'single_choice';
    if (!typeBreakdown[type]) typeBreakdown[type] = { total: 0, wrong: 0, unanswered: 0 };
    typeBreakdown[type].total++;
    if (!q.selected_answer_key) typeBreakdown[type].unanswered++;
    else if (!q.is_correct) typeBreakdown[type].wrong++;
  });
  const typeBreakdownText = Object.entries(typeBreakdown)
    .map(([type, stat]) => `- ${type}: sai ${stat.wrong}, bỏ trống ${stat.unanswered}, tổng ${stat.total}`)
    .join('\n') || '- Không có dữ liệu';

  const prompt = `Bạn là giáo viên giỏi. Phân tích bài thi bằng TIẾNG VIỆT, đủ chi tiết nhưng gọn.

Nguyên tắc:
${AI_ACCURACY_PROMPT_RULES}
- Dựa trên thống kê toàn bài và danh sách câu sai/bỏ trống bên dưới.
- Không bịa câu hỏi/chủ đề ngoài dữ liệu. Nếu chưa đủ dữ liệu, nói rõ "cần xem thêm".
- Khi nêu điểm yếu, chỉ rõ câu hoặc nhóm câu làm căn cứ.
- Ưu tiên lời khuyên học được ngay, không viết chung chung.
- Trả về JSON hợp lệ duy nhất, không markdown, không chữ ngoài JSON.

THÔNG TIN BÀI THI:
- Môn: ${attemptData.subjectName || 'Tiếng Trung'}
- Đúng: ${safeCorrect}/${safeTotal} (${percentage}%)
- Số câu sai: ${wrongQuestions.length}
- Số câu bỏ trống: ${unansweredQuestions.length}
${prevAttempt ? `
SO SÁNH VỚI LẦN TRƯỚC:
- Lần trước: ${prevAttempt.score}%
- Lần này: ${percentage}%
- Thay đổi: ${prevAttempt.delta >= 0 ? '+' : ''}${prevAttempt.delta}%
${prevAttempt.delta >= 0 ? '→ Bạn đã TIẾN BỘ!' : '→ Bạn cần ÔN THÊM.'}
` : ''}

PHÂN TÍCH THEO ĐỘ KHÓ:
- Dễ: ${difficultyBreakdown.easy.rate}% đúng (${difficultyBreakdown.easy.correct}/${difficultyBreakdown.easy.total})
- TB: ${difficultyBreakdown.medium.rate}% đúng (${difficultyBreakdown.medium.correct}/${difficultyBreakdown.medium.total})
- Khó: ${difficultyBreakdown.hard.rate}% đúng (${difficultyBreakdown.hard.correct}/${difficultyBreakdown.hard.total})

THỐNG KÊ THEO LOẠI CÂU:
${typeBreakdownText}

CÂU CẦN PHÂN TÍCH (${focusQuestions.length}/${wrongQuestions.length + unansweredQuestions.length} câu sai/bỏ trống):
${focusQuestionsText}

MỘT SỐ CÂU ĐÚNG ĐỂ SO SÁNH CÁCH LÀM:
${correctSamplesText}

TRẢ VỀ JSON. Mỗi trường text dùng \\n để tách ý.
{
  "score": ${percentage},
  "grade": "Đánh giá ngắn 1 câu",
  "gradeColor": "emerald|blue|amber|red",
  "summary": "2 dòng: điểm số và vấn đề chính.",
  "strengths": ["Điểm mạnh 1: 1 câu có căn cứ", "Điểm mạnh 2: 1 câu có căn cứ"],
  "weaknesses": ["Điểm yếu 1: nêu câu/nhóm câu liên quan", "Điểm yếu 2: nêu câu/nhóm câu liên quan"],
  "analysis": "3 dòng: sai phần nào, vì sao sai, học lại gì trước.",
  "overallAdvice": "3 ý ngắn: học gì trước, luyện gì, kiểm tra lại ra sao.",
  "priorityTopics": ["Chủ đề ưu tiên 1", "Chủ đề ưu tiên 2", "Chủ đề ưu tiên 3"],
  "studyPlan": "3 ý ngắn: hôm nay, tuần này, lần làm đề tới.",
  "examTips": ["Mẹo 1 sát dữ liệu bài thi", "Mẹo 2", "Mẹo 3"],
  "commonMistakes": ["Lỗi sai 1 và cách tránh", "Lỗi sai 2 và cách tránh"],
  "nextExamSuggestion": "1-2 dòng: nên làm đề mức nào tiếp theo và lý do."
}`;

  try {
    const fallback = ruleBasedExamAnalysis(attemptData);
    const raw = await callBeeknoee(prompt, {
      model: examAnalysisModel,
      temperature: 0.2,
      maxTokens: examAnalysisMaxTokens,
    });
    const ai = parseAIMaybeJSON(raw);

    return {
      ...normalizeExamAnalysis(ai, fallback, percentage),
      difficultyBreakdown,
      wrongCount: wrongQuestions.length,
      unansweredCount: unansweredQuestions.length,
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    console.error('AI exam analysis failed, using rule-based:', err.message);
    return ruleBasedExamAnalysis(attemptData);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: Giải thích câu sai
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Giải thích chi tiết các câu sai cho 1 bài thi
 * @param {Array} questions - Mảng câu hỏi đã làm
 */
async function explainWrongAnswers(questions) {
  const wrongQuestions = questions.filter(q => !q.is_correct && q.selected_answer_key);
  if (!wrongQuestions.length) return { explanations: [], message: 'Bạn không có câu sai!' };

  const fallbackExplanations = () => ({
    explanations: wrongQuestions.map((q, i) => ({
      questionNumber: q.question_number || i + 1,
      yourAnswer: `${q.selected_answer_key}. ${getAnswerText(q.options, q.selected_answer_key)}`,
      correctAnswer: `${q.correct_answer_key}. ${getAnswerText(q.options, q.correct_answer_key)}`,
      whyWrong: 'Hãy ôn lại phần này và làm lại bài.',
      knowledgeNote: q.explanation || q.explanation_cn || '',
      tip: 'Đọc kỹ đề bài, so sánh từng lựa chọn và ghi lại kiến thức liên quan.',
      vocabulary: [],
    })),
  });

  async function explainBatch(batch, offset) {
    const questionsText = batch.map((q, i) => {
    const optionsText = (q.options || [])
      .slice(0, 8)
      .map(o => `${o.key}. ${o.text || o.text_cn || ''}`)
      .join(' | ');
    return `[Câu ${offset + i + 1}]
Đề bài: ${q.question_text || q.question_text_cn || ''}
Lựa chọn: ${optionsText}
Bạn chọn: ${q.selected_answer_key || '?'}. ${getAnswerText(q.options, q.selected_answer_key)}
Đúng: ${q.correct_answer_key || '?'}. ${getAnswerText(q.options, q.correct_answer_key)}
Giải thích admin: ${q.explanation || q.explanation_cn || 'Không có'}
Loại câu: ${q.question_type || 'single_choice'}`;
    }).join('\n\n');

    const prompt = `Bạn là giáo viên tiếng Trung. Giải thích bằng TIẾNG VIỆT.

YÊU CẦU:
${AI_ACCURACY_PROMPT_RULES}
- Viết plain text thuần túy, không dùng **bold**, không dùng ##, không dùng bất kỳ ký hiệu markdown phức tạp nào
- Mỗi phần phải đủ ý: vì sao đáp án học sinh sai, vì sao đáp án đúng đúng, kiến thức cần ôn
- Từ tiếng Trung mới → ghi kèm pinyin ngay sau, ví dụ: 电脑 (diàn nǎo)
- Đi thẳng vào vấn đề, không lặp đề bài
- Viết tự nhiên như đang giảng cho học sinh
- Chỉ dựa trên dữ liệu câu hỏi, đáp án và giải thích admin được cung cấp

CÁC CÂU SAI:
${questionsText}

TRẢ VỀ JSON:
{
  "explanations": [
    {
      "questionNumber": 1,
      "yourAnswer": "Bạn chọn: ...",
      "correctAnswer": "Đáp án đúng: ...",
      "whyWrong": "Giải thích 1-2 câu tại sao sai",
      "knowledgeNote": "Kiến thức liên quan 1-2 câu",
      "tip": "Mẹo nhớ 1 câu",
      "vocabulary": [
        { "word": "từ vựng tiếng Trung", "pinyin": "pinyin của từ", "meaning": "nghĩa tiếng Việt" }
      ]
    }
  ]
}`;

    const raw = await callPublicAI(prompt, { temperature: 0.35, maxTokens: BEE.explanationMaxTokens || 1800 });
    const ai = parseAIMaybeJSON(raw);
    return normalizeExplanationResult(ai, batch).explanations;
  }

  try {
    const batchSize = 6;
    const explanations = [];
    for (let i = 0; i < wrongQuestions.length; i += batchSize) {
      const batch = wrongQuestions.slice(i, i + batchSize);
      explanations.push(...await explainBatch(batch, i));
    }
    return explanations.length ? { explanations } : fallbackExplanations();
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    console.error('AI wrong-answer explanation failed, using fallback:', err.message);
    return fallbackExplanations();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Phân tích theo chủ đề (Topic Analysis)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Phân tích điểm mạnh/yếu theo môn/chủ đề qua nhiều bài thi
 * @param {Array} examAttempts - Lịch sử làm bài
 */
async function analyzeTopics(examAttempts) {
  if (!examAttempts || examAttempts.length === 0) {
    return { hasEnoughData: false, message: 'Cần ít nhất 1 bài thi để phân tích.' };
  }

  // Tính stats theo subject
  const subjectStats = {};
  examAttempts.forEach(attempt => {
    const subject = attempt.subject_name || attempt.subject || 'Tổng hợp';
    const percentage = attempt.total_questions > 0
      ? (attempt.total_correct / attempt.total_questions) * 100
      : parseFloat(attempt.total_score) || 0;
    if (!subjectStats[subject]) subjectStats[subject] = { scores: [], count: 0 };
    subjectStats[subject].scores.push(percentage);
    subjectStats[subject].count += 1;
    subjectStats[subject].total = subjectStats[subject].scores.reduce((a, b) => a + b, 0);
  });

  const subjects = Object.entries(subjectStats).map(([name, stats]) => ({
    name,
    average: Math.round(stats.total / stats.count),
    count: stats.count,
    trend: stats.count > 1
      ? Math.round(stats.scores[stats.count - 1] - stats.scores[0])
      : 0,
    history: stats.scores,
  }));

  // Phân loại mạnh/yếu
  const strengths = subjects.filter(s => s.average >= 75).sort((a, b) => b.average - a.average);
  const weaknesses = subjects.filter(s => s.average < 75).sort((a, b) => a.average - b.average);

  const prompt = `Phân tích kết quả học tập qua ${examAttempts.length} bài thi. Viết TIẾNG VIỆT, mỗi phần ngắn gọn.

KẾT QUẢ THEO MÔN:
${subjects.map(s => `- ${s.name}: ${s.average}% (${s.count} lần)`).join('\n')}

TRẢ VỀ JSON:
{
  "strengths": [{"name": "...", "average": 87, "advice": "1 câu"}],
  "weaknesses": [{"name": "...", "average": 45, "advice": "1 câu"}],
  "topRecommendations": ["Gợi ý 1", "Gợi ý 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, {
      model: BEE.insightModel || BEE.ocrModel || BEE.importModel || BEE.model,
      temperature: 0.3,
      maxTokens: 1800,
    });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      hasEnoughData: true,
      totalAttempts: examAttempts.length,
      subjects,
      strengths: ai.strengths || strengths.map(s => ({
        name: s.name, average: s.average,
        advice: 'Bạn làm tốt phần này! Tiếp tục duy trì.',
      })),
      weaknesses: ai.weaknesses || weaknesses.map(s => ({
        name: s.name, average: s.average,
        advice: 'Cần ôn luyện thêm phần này.',
      })),
      topRecommendations: ai.topRecommendations || [],
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      hasEnoughData: true,
      totalAttempts: examAttempts.length,
      subjects,
      strengths: strengths.map(s => ({
        name: s.name, average: s.average,
        advice: 'Bạn làm tốt phần này!',
      })),
      weaknesses: weaknesses.map(s => ({
        name: s.name, average: s.average,
        advice: 'Cần ôn luyện thêm.',
      })),
      topRecommendations: ['Học đều các chủ đề', 'Làm nhiều bài tập', 'Ôn lại từ vựng thường xuyên'],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: Gợi ý luyện tập (Practice Recommendations)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gợi ý bài học và dạng bài cần luyện dựa trên điểm yếu
 */
async function getPracticeRecommendations(weaknesses, availableExams = []) {
  const weakSubjects = (weaknesses || []).map(w => w.name || w.subject || '').filter(Boolean);

  if (!weakSubjects.length) {
    return {
      recommendations: [{
        type: 'maintenance',
        title: 'Tiếp tục duy trì',
        description: 'Bạn đang học rất tốt! Hãy tiếp tục ôn luyện đều đặn.',
        priority: 'high',
        suggestedExams: availableExams.slice(0, 3),
      }],
    };
  }

  const prompt = `Gợi ý bài học dựa trên điểm yếu. Viết TIẾNG VIỆT, mỗi phần ngắn gọn.

ĐIỂM YẾU: ${weakSubjects.join(', ')}

TRẢ VỀ JSON:
{
  "recommendations": [
    {
      "type": "vocabulary|grammar|reading",
      "title": "Tiêu đề ngắn gọn",
      "description": "1-2 câu mô tả tại sao cần học phần này",
      "priority": "high|medium|low",
      "actionSteps": ["Bước 1", "Bước 2", "Bước 3"]
    }
  ],
  "studyPlan": "Lịch học 1-2 câu"
}`;

  try {
    const raw = await callBeeknoee(prompt, {
      model: BEE.insightModel || BEE.ocrModel || BEE.importModel || BEE.model,
      temperature: 0.4,
      maxTokens: 1600,
    });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      recommendations: ai.recommendations || [],
      studyPlan: ai.studyPlan || '',
      basedOnWeaknesses: weakSubjects,
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      recommendations: weakSubjects.slice(0, 3).map((w, i) => ({
        type: 'grammar',
        title: `Ôn luyện: ${w}`,
        description: `Cần cải thiện phần ${w}`,
        priority: i === 0 ? 'high' : 'medium',
        estimatedTime: '30-60 phút',
        actionSteps: ['Đọc lý thuyết', 'Làm 10 câu bài tập', 'Review lại đáp án'],
      })),
      studyPlan: 'Học đều đặn 30 phút mỗi ngày',
      basedOnWeaknesses: weakSubjects,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: Chatbot hỏi đáp AI
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Chatbot trả lời câu hỏi của user về bài thi/kiến thức
 * @param {string} question - Câu hỏi của user
 * @param {Object} context  - Ngữ cảnh (attemptData, questions, etc.)
 */
function getQuestionStatus(q) {
  if (q.status) return q.status;
  if (!q.selected_answer_key) return 'unanswered';
  return q.is_correct ? 'correct' : 'incorrect';
}

function formatAIQuestionLine(q) {
  const status = getQuestionStatus(q);
  const statusLabel = status === 'correct' ? 'đúng' : status === 'unanswered' ? 'bỏ qua' : 'sai';
  const selected = q.selected_answer_key
    ? `${q.selected_answer_key}. ${q.selected_answer_text || ''}`.trim()
    : 'bỏ qua';
  const correct = q.correct_answer_key
    ? `${q.correct_answer_key}. ${q.correct_answer_text || ''}`.trim()
    : q.correct_answer_text || 'chưa có';
  return `Câu ${q.question_number} (${statusLabel}): ${q.question_text || q.question_text_cn || ''}\n- Học sinh chọn: ${selected}\n- Đáp án đúng: ${correct}`;
}

function buildReviewQuestionContext(questions = []) {
  if (!questions.length) return '(không có)';
  const groups = [
    ['Câu sai cần sửa', questions.filter((q) => getQuestionStatus(q) === 'incorrect').slice(0, 6)],
    ['Câu bỏ qua cần hướng dẫn', questions.filter((q) => getQuestionStatus(q) === 'unanswered').slice(0, 6)],
    ['Câu đúng có thể củng cố', questions.filter((q) => getQuestionStatus(q) === 'correct').slice(0, 4)],
  ];
  return groups
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}:\n${items.map(formatAIQuestionLine).join('\n')}`)
    .join('\n\n') || '(không có)';
}

function buildConversationHistoryContext(conversationHistory = []) {
  if (!Array.isArray(conversationHistory)) return '(không có)';

  const items = conversationHistory
    .filter((item) => ['user', 'ai'].includes(item?.role) && typeof item?.content === 'string' && item.content.trim())
    .slice(-8)
    .map((item) => {
      const role = item.role === 'user' ? 'Học sinh' : 'AI';
      return `${role}: ${item.content.trim().slice(0, 800)}`;
    });

  return items.length ? items.join('\n') : '(không có)';
}

function buildVisionUserMessage(prompt, imageDataUrl, note = '') {
  if (!imageDataUrl) return { role: 'user', content: prompt };
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `${prompt}\n\n${note || 'User pasted an image. Read the image directly and answer based on both text and image. If the image is unclear, say exactly what is unclear.'}`,
      },
      {
        type: 'image_url',
        image_url: { url: imageDataUrl },
      },
    ],
  };
}

function buildAIChatPrompt(question, context = {}) {
  const { examTitle, subjectName, questions = [], userScore, questionStats, conversationHistory = [] } = context;

  const contextText = [
    examTitle && `Đề thi: ${examTitle}`,
    subjectName && `Môn: ${subjectName}`,
    userScore !== undefined && `Điểm của bạn: ${userScore}%`,
    questions.length > 0 && `Số câu: ${questions.length}`,
    questionStats && `Tổng quan: đúng ${questionStats.correct || 0}, sai ${questionStats.incorrect || 0}, bỏ qua ${questionStats.unanswered || 0}`,
  ].filter(Boolean).join('\n');

  const reviewQuestionContext = buildReviewQuestionContext(questions);
  const conversationContext = buildConversationHistoryContext(conversationHistory);

  return `Bạn là trợ lý AI học tập CSCA đa môn thân thiện. Trả lời bằng TIẾNG VIỆT có dấu.

YÊU CẦU:
- CÓ THỂ dùng bullet (dấu -) để liệt kê cho dễ đọc. Không dùng ký hiệu markdown phức tạp.
- Viết tự nhiên như đang nhắn tin hướng dẫn.
- Câu hỏi ngắn → trả lời ngắn gọn.
- Cần giải thích → giải thích đầy đủ nhưng không lan man, chia thành các ý nhỏ.
- Nếu là tiếng Trung: từ mới phải ghi kèm pinyin ngay sau, ví dụ: 学习 (xué xí) = học.
- Nếu là Toán/Khoa học: dùng công thức KaTeX-compatible trong \\( ... \\), ví dụ \\( y=\\frac{2x+3}{x-1} \\). Không viết công thức thành ảnh.
${AI_ACCURACY_PROMPT_RULES}
- Nếu là môn khác: giải thích đúng trọng tâm môn đó, không ép thành tiếng Trung.
- Đưa ví dụ cụ thể trong đời thường khi cần.
- Nếu học sinh hỏi về câu đúng, hãy củng cố vì sao đúng và chỉ ra dấu hiệu nhận biết.
- Nếu học sinh hỏi về câu bỏ qua, hãy hướng dẫn cách suy luận từ đầu, không trách người học.
- Nếu học sinh hỏi tiếp bằng "ý trên", "câu đó", "giải thích kỹ hơn", hãy dựa vào lịch sử hội thoại gần đây.

TRÁNH:
- KHÔNG lặp lại câu hỏi của user.
- KHÔNG bịa dữ liệu ngoài ngữ cảnh bài thi. Nếu thiếu dữ liệu, nói rõ và hướng dẫn cách tự kiểm tra.

Ngữ cảnh bài thi (nếu có):
${contextText || '(không có)'}
Các câu trong bài để tham chiếu:
${reviewQuestionContext}
Lịch sử hội thoại gần đây:
${conversationContext}

Câu hỏi: ${question}`;
}

async function askAI(question, context = {}) {
  const prompt = buildAIChatPrompt(question, context);

  try {
    const response = await callPublicAIMessages(
      [buildVisionUserMessage(prompt, context.imageDataUrl)],
      { temperature: 0.5, maxTokens: BEE.chatMaxTokens || 2200 },
    );
    return {
      answer: response,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      answer: getPublicAIErrorMessage(err),
      timestamp: new Date().toISOString(),
      error: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5b: Chatbot hỏi đáp AI (Streaming)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Chatbot trả lời câu hỏi của user về bài thi/kiến thức (Stream qua SSE)
 * @param {string} question - Câu hỏi của user
 * @param {Object} context  - Ngữ cảnh (attemptData, questions, etc.)
 * @param {Object} res - Express Response object (để pipe SSE)
 */
function buildMoliPetPrompt(message, context = {}) {
  const {
    petName = 'Moly',
    userName = 'ban',
    page = '/',
    pageType = 'hoc tap chung',
    subject = '',
    routeHint = '',
    localTime = '',
    mood = 'friendly',
    conversationHistory = [],
  } = context;
  const history = buildConversationHistoryContext(conversationHistory);

  return `Ban la ${petName}, mot pet hoc tap cuc de thuong cua CSCA MOLI.STUDIO.
Tra loi bang tieng Viet co dau, tu nhien, thong minh, am ap, ngan gon va chinh xac.

Tinh cach:
${AI_ACCURACY_PROMPT_RULES}
- Xung ho minh/ban, co the them mot cau hoi tham nhe neu hop ngu canh.
- Noi nhu ban dong hanh nho: dang yeu nhung khong nham nhi, khong lam mau qua da.
- Biet bam vao mon hoc/trang hien tai de goi y dung viec user dang lam.
- Neu user hoi bai tap: tom tat y chinh, giai tung buoc ngan, chi ra loi hay sai, va neu thieu du kien thi hoi lai.
- Neu user hoi tu vung/tieng Trung: co nghia, pinyin neu can, vi du ngan, meo nho.
- Neu user hoi ke hoach hoc: dua 2-4 viec cu the co the lam ngay.
- Neu user hoi ngoai hoc tap: tra loi lich su, ngan gon, an toan.
- Khong noi minh la AI model. Khong nhac quota/model/key.
- Khong bia diem so, loi sai, ho so, hoac du lieu rieng neu khong co trong ngu canh.

Quy tac chinh xac bat buoc:
- Neu khong co du kien trong cau hoi/ngu canh, noi ro "minh chua co du kien" va hoi lai; khong doan so lieu, gia, lich, thong tin hoc vien, de thi, dap an, uu dai, hay chinh sach.
- Voi Toan/Ly/Hoa: kiem tra lai phep tinh, dau bat dang thuc, don vi, dieu kien, tap xac dinh va ket luan cuoi cung truoc khi tra loi.
- Voi tieng Trung: neu viet pinyin thi viet dung thanh dieu; neu khong chac nghia/ngu phap thi noi khong chac thay vi khang dinh.
- Voi cau hoi dung/sai: neu menh de sai, noi sai o dau bang 1 cau ro rang.
- Voi cau hoi ve CSCA MOLI.STUDIO: chi dung thong tin co trong ngu canh hien tai; neu khong co thi noi minh chua co du lieu.
- Khong tao link, ten tai lieu, cau truc de, diem chuan, ngay thi, thong ke, hay noi dung rieng neu khong duoc cung cap.

Gioi han:
- Mac dinh toi da 5 cau ngan. Neu can giai bai, dung cac buoc 1-3 ngan gon.
- Khong dung markdown phuc tap; duoc dung bullet ngan khi can.
- Khong bia thong tin ca nhan cua user.
- Neu cau tra loi co dap an so/cu phap, dat dap an cuoi cung that ro o cau dau hoac cau cuoi.

Ngu canh:
- Ten user: ${userName || 'ban'}
- Trang hien tai: ${page || '/'}
- Loai trang: ${pageType || 'hoc tap chung'}
- Mon hoc: ${subject || '(chua ro)'}
- Goi y UI hien tai: ${routeHint || '(khong co)'}
- Gio dia phuong user: ${localTime || '(khong ro)'}
- Tam trang pet: ${mood || 'friendly'}
- Lich su gan day:
${history || '(khong co)'}

User noi: ${message}`;
}

async function askMoliPet(message, context = {}) {
  const prompt = buildMoliPetPrompt(message, context);
  const model = BEE.petChatModel || BEE.model;
  const maxTokens = Math.min(BEE.petChatMaxTokens || 700, 900);

  try {
    const response = await callBeeknoeeMessages(
      [buildVisionUserMessage(prompt, context.imageDataUrl, 'User pasted an image into MolyPet chat. Read the image and answer warmly, briefly, and accurately.')],
      {
        model,
        temperature: 0.35,
        maxTokens,
        timeout: Math.min(BEE.timeout || 90000, 45000),
      },
    );
    return {
      answer: response,
      model,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      answer: 'Moly dang hoi met xiu. Ban cho minh mot chut roi noi tiep nhe.',
      timestamp: new Date().toISOString(),
      error: true,
    };
  }
}

function getDailyGiftFallback(giftDate = '') {
  const titles = [
    'Một lá thư nhỏ cho ngày học mới',
    'Gói năng lượng pastel đã tới',
    'Hộp quà học tập từ Moly',
    'Một chút may mắn cho hôm nay',
  ];
  const encouragements = [
    'Hôm nay bạn không cần học thật nhiều mới tính là tiến bộ. Chỉ cần hiểu thêm một công thức Toán, nhớ thêm vài từ tiếng Trung, hoặc sửa lại một lỗi nhỏ trong bài CSCA là đã có điểm cộng rất xinh rồi.',
    'Mỗi trang lý thuyết, mỗi câu từ vựng và mỗi bài toán bạn chạm vào đều đang xây thêm một viên gạch cho mục tiêu CSCA. Cứ đi chậm mà chắc, Moly tin bạn đang làm tốt.',
    'Có những ngày não hơi đầy, nhưng một phiên học ngắn vẫn có thể giữ nhịp rất tốt. Bạn chỉ cần bắt đầu bằng phần dễ nhất, rồi để sự tập trung kéo mình đi tiếp.',
    'CSCA là hành trình nhiều mảnh ghép: ngôn ngữ, Toán, tư duy và thói quen. Hôm nay mình nhặt một mảnh nhỏ thôi, nhưng nhặt đều thì bức tranh sẽ rõ dần.',
  ];
  const reminders = [
    'Nhắc nhẹ hôm nay: chọn 1 mục tiêu nhỏ, học 20 phút thật gọn rồi đánh dấu hoàn thành nhé.',
    'Nhắc nhẹ hôm nay: ôn lại 5 từ hoặc 1 dạng bài vừa sai, đừng để lỗi cũ trốn trong vở nha.',
    'Nhắc nhẹ hôm nay: làm một câu dễ trước để khởi động, sau đó mới xử lý phần khó hơn.',
    'Nhắc nhẹ hôm nay: uống nước, mở bài học, và cho bản thân một lượt tập trung không bị chen ngang.',
  ];
  const blessings = [
    'Chúc bạn gặp đúng dạng bài mình đã ôn và giữ được cái đầu thật sáng.',
    'Chúc bạn học đâu nhớ đó, làm bài bình tĩnh và may mắn ghé vai.',
    'Chúc hôm nay của bạn nhẹ nhàng, có tiến bộ nhỏ và nhiều tự tin hơn hôm qua.',
    'Chúc bạn gom đủ năng lượng, đủ kiên nhẫn và đủ may mắn cho buổi học này.',
  ];
  const seed = String(giftDate || new Date().toISOString().slice(0, 10))
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    title: titles[seed % titles.length],
    greeting: 'Gửi bạn học viên chăm chỉ,',
    encouragement: encouragements[seed % encouragements.length],
    study_reminder: reminders[(seed + 1) % reminders.length],
    blessing: blessings[(seed + 2) % blessings.length],
    mood: ['sparkly', 'soft', 'focus', 'lucky'][seed % 4],
    source_model: 'fallback',
    raw_payload: { fallback: true, giftDate },
  };
}

function normalizeDailyGiftLetter(value, giftDate) {
  const fallback = getDailyGiftFallback(giftDate);
  const safe = value && typeof value === 'object' ? value : {};

  return {
    title: asString(safe.title, fallback.title).slice(0, 140),
    greeting: asString(safe.greeting, fallback.greeting).slice(0, 180),
    encouragement: asString(safe.encouragement, fallback.encouragement).slice(0, 700),
    study_reminder: asString(safe.study_reminder || safe.studyReminder, fallback.study_reminder).slice(0, 280),
    blessing: asString(safe.blessing, fallback.blessing).slice(0, 240),
    mood: asString(safe.mood, fallback.mood).slice(0, 60),
  };
}

function buildDailyGiftLetterPrompt(giftDate, recentLetters = []) {
  const recentContext = recentLetters.length
    ? recentLetters.map((item, index) => {
        return `${index + 1}. ${item.title || ''} | ${item.encouragement || ''} | ${item.study_reminder || ''}`;
      }).join('\n')
    : '(chua co thu gan day)';

  return `Ban la Moly, pet hoc tap cua CSCA MOLI.STUDIO.
Hay viet mot Daily Gift Letter bang tieng Viet co dau cho hoc vien on thi CSCA.

Yeu cau:
- Giong van cute, am ap, thong minh, pastel infographic hoc tap: mem, sach, de thuong nhung khong tre con qua.
- Noi ve hanh trinh CSCA, ngon ngu/tieng Trung, Toan, tu duy logic, va thoi quen hoc deu.
- Dong vien that cu the: tien bo nho, hoc 15-25 phut, on loi sai, nho tu moi, lam 1 cau de khoi dong.
- Khong sao chep y/cau/nhan vat/an du tu cac thu gan day.
- Khong hua diem cao, khong bia so lieu hoc vien, lich thi, hoc bong, gia khoa hoc, ho so rieng, hay thong tin khong co ngu canh.
- Khong nhac minh la AI/model/API.
- Khong dung markdown.
- Moi truong frontend se tu chen ten hoc vien, vi vay greeting de dang goi chung.
- Do dai vua phai, khong lan man, moi truong toi da 4 cau.
- Co the them cam giac cute bang hinh anh nho nhu sao, sticker, but chi, sach, meo, nhung chi trong loi van; khong can emoji qua nhieu.
- Loi nhac hoc phai nhe nhang, khong tao ap luc, co hanh dong ro trong hom nay.
- Blessing phai may man, sang sua, hop voi hoc tap.

Ngay sinh noi dung: ${giftDate}
Thu gan day can tranh trung lap:
${recentContext}

Tra ve JSON hop le duy nhat, dung schema:
{
  "title": "tieu de cute toi da 10 tu",
  "greeting": "loi chao chung, chua can ten rieng",
  "encouragement": "doan dong vien 3-4 cau ve CSCA/ngon ngu/Toan, cute va khong trung lap",
  "study_reminder": "mot cau nhac hoc nhe nhang hom nay",
  "blessing": "mot cau chuc may man",
  "mood": "sparkly|soft|focus|lucky"
}`;
}

async function generateDailyGiftLetter(giftDate, context = {}) {
  const model = BEE.petChatModel || BEE.model;
  const prompt = buildDailyGiftLetterPrompt(giftDate, context.recentLetters || []);

  try {
    const raw = await callBeeknoee(prompt, {
      model,
      temperature: 0.72,
      maxTokens: 650,
      timeout: Math.min(BEE.timeout || 90000, 45000),
    });
    const parsed = parseAIMaybeJSON(raw);
    const letter = normalizeDailyGiftLetter(parsed, giftDate);
    return {
      ...letter,
      source_model: model,
      raw_payload: parsed || { raw: String(raw || '').slice(0, 1200) },
    };
  } catch (err) {
    const fallback = getDailyGiftFallback(giftDate);
    return {
      ...fallback,
      raw_payload: {
        ...fallback.raw_payload,
        error: err.message || 'DAILY_GIFT_GENERATION_FAILED',
      },
    };
  }
}

async function askAIStream(question, context = {}, res) {
  const prompt = buildAIChatPrompt(question, context);

  try {
    const answer = await callPublicAIMessages(
      [buildVisionUserMessage(prompt, context.imageDataUrl)],
      { temperature: 0.5, maxTokens: BEE.chatMaxTokens || 2200 },
    );
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: answer } }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  } catch (err) {
    console.error('Public AI stream failed:', err.message);
    writeAIStreamPublicError(res, getPublicAIErrorMessage(err));
    return;
  }

  if (isRateLimited()) {
    writeAIStreamPublicError(res, PUBLIC_AI_BUSY_MESSAGE);
    return;
  }

  await waitBetweenRequests();

  const apiKey = getNextKey();
  if (!apiKey) {
    writeAIStreamPublicError(res);
    return;
  }

  const BEE = aiConfig.beeknoee;
  const payload = {
    model: BEE.model,
    messages: [buildVisionUserMessage(prompt, context.imageDataUrl)],
    max_tokens: BEE.chatMaxTokens || 2200,
    temperature: 0.5,
    stream: true
  };

  try {
    await withConcurrency(async () => {
      const response = await axios.post(
        `${BEE.baseUrl}/chat/completions`,
        payload,
        {
          timeout: BEE.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          responseType: 'stream'
        }
      );

      let buffer = '';
      let sentDone = false;

      await new Promise((resolve) => {
        let streamFinished = false;
        let settled = false;
        const resolveOnce = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const finishWithPublicError = (message = PUBLIC_AI_UNAVAILABLE_MESSAGE) => {
          if (streamFinished) return;
          console.warn('AI provider stream returned an error; hiding provider details from user.');
          streamFinished = true;
          writeAIStreamPublicError(res, message);
          response.data.destroy();
          resolveOnce();
        };

        response.data.on('data', chunk => {
          if (streamFinished) return;
          buffer += chunk.toString('utf8');
          const parts = buffer.split(/\r?\n/);
          buffer = parts.pop() || '';

          for (const line of parts) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') {
              sentDone = true;
              res.write(`data: ${data}\n\n`);
              continue;
            }
            const publicError = getPublicProviderStreamError(data);
            if (publicError) {
              finishWithPublicError(publicError);
              break;
            }
            res.write(`data: ${data}\n\n`);
          }
        });

        response.data.on('end', () => {
          if (streamFinished) return resolveOnce();
          if (!sentDone) {
            res.write('data: [DONE]\n\n');
          }
          streamFinished = true;
          res.end();
          resolveOnce();
        });

        response.data.on('error', err => {
          if (streamFinished) return resolveOnce();
          console.error('AI Stream Error:', err);
          streamFinished = true;
          writeAIStreamPublicError(res);
          resolveOnce();
        });
      });
    });
  } catch (err) {
    console.error('Lỗi khi stream AI:', err.message);
    if (err.response?.status === 429) {
      console.warn(`⚠️ Key bị rate limit, chuyển key`);
      currentKeyIndex++;
      setRateLimit(aiConfig.general?.globalBackoffMs || 60000);
    }
    writeAIStreamPublicError(res, getPublicAIErrorMessage(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 6: Phân tích tiến bộ (Progress Analysis)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * So sánh kết quả giữa các lần thi, nhận xét tiến bộ/thụt lùi
 * @param {Array} examAttempts - Lịch sử thi (đã sort theo thời gian)
 */
async function analyzeProgress(examAttempts) {
  if (!examAttempts || examAttempts.length < 2) {
    return {
      hasEnoughData: false,
      message: 'Cần ít nhất 2 bài thi để so sánh tiến bộ.',
    };
  }

  const sorted = [...examAttempts]
    .filter(a => a.total_questions > 0)
    .sort((a, b) => new Date(a.submit_time) - new Date(b.submit_time));

  if (sorted.length < 2) {
    return { hasEnoughData: false, message: 'Cần ít nhất 2 bài thi đã nộp.' };
  }

  // Tính score % từng lần
  const history = sorted.map(a => ({
    examId: a.exam_id,
    examTitle: a.exam_title || a.title || 'Đề thi',
    date: a.submit_time,
    score: a.total_questions > 0
      ? Math.round((a.total_correct / a.total_questions) * 100)
      : parseFloat(a.total_score) || 0,
    correct: a.total_correct,
    total: a.total_questions,
  }));

  const first = history[0].score;
  const last = history[history.length - 1].score;
  const delta = last - first;
  const avg = Math.round(history.reduce((s, h) => s + h.score, 0) / history.length);

  const prompt = `So sánh tiến bộ qua ${history.length} bài thi. Viết TIẾNG VIỆT, ngắn gọn.

LỊCH SỬ (theo thời gian):
${history.map((h, i) => `${i + 1}. ${h.examTitle}: ${h.score}% (${h.correct}/${h.total})`).join('\n')}

Hiện tại: ${last}% | Trung bình: ${avg}% | Thay đổi: ${delta > 0 ? '+' : ''}${delta}%

TRẢ VỀ JSON:
{
  "delta": ${delta},
  "trend": "improving|declining|stable",
  "summary": "Tổng kết 2-3 câu về xu hướng",
  "improvementNotes": ["Ghi chú 1", "Ghi chú 2"],
  "warningNotes": ["Cảnh báo"] (nếu có)
}`;

  try {
    const raw = await callBeeknoee(prompt, {
      model: BEE.insightModel || BEE.ocrModel || BEE.importModel || BEE.model,
      temperature: 0.3,
      maxTokens: 1400,
    });
    const ai = parseAIMaybeJSON(raw);
    if (!ai) throw new Error('Parse failed');

    return {
      ...ai,
      history: history.map(h => ({
        ...h,
        date: new Date(h.date).toLocaleDateString('vi-VN'),
      })),
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      hasEnoughData: true,
      totalAttempts: history.length,
      history: history.map(h => ({
        ...h,
        date: new Date(h.date).toLocaleDateString('vi-VN'),
      })),
      delta,
      trend: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable',
      summary: delta > 0
        ? `Bạn đã tiến bộ ${delta}% so với lần thi đầu tiên. Hãy tiếp tục!`
        : delta < 0
        ? `Điểm giảm ${Math.abs(delta)}%. Đừng nản, hãy ôn lại và thử lại!`
        : 'Điểm ổn định. Hãy cố gắng cải thiện thêm!',
      improvementNotes: ['Tiếp tục ôn luyện đều đặn'],
      warningNotes: delta < 0 ? ['Cần xem lại phần kiến thức yếu'] : [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 7: Gợi ý đề thi tiếp theo
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gợi ý đề thi phù hợp với trình độ hiện tại
 * @param {Object} context - { userLevel, weaknesses, strongSubjects, allExams }
 */
async function recommendNextExam(context = {}) {
  const { userScore, subjectName, allExams = [] } = context;

  if (!allExams.length) {
    return { recommendations: [], message: 'Không có đề thi nào để gợi ý.' };
  }

  // Lọc đề phù hợp
  const level = userScore >= 80 ? 'hard' : userScore >= 60 ? 'medium' : 'easy';
  const recommendations = allExams
    .filter(e => e.status === 'published' || e.is_published)
    .filter(e => !subjectName || e.subject_name === subjectName)
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      title: e.title,
      titleCn: e.title_cn,
      subjectName: e.subject_name,
      difficultyLevel: e.difficulty_level || 'medium',
      totalQuestions: e.total_questions,
      duration: e.duration,
      isRecommended: e.difficulty_level === level,
    }));

  const prompt = `Gợi ý đề thi tiếp theo phù hợp. Viết TIẾNG VIỆT, ngắn gọn.

TRÌNH ĐỘ: ${level} (${userScore || 'N/A'}%)
MÔN: ${subjectName || 'Tổng hợp'}

ĐỀ CÓ SẴN:
${recommendations.map(e => `- "${e.title}" (${e.difficultyLevel}, ${e.totalQuestions} câu)`).join('\n')}

TRẢ VỀ JSON:
{
  "recommendedExam": { "id": ..., "reason": "1-2 câu tại sao gợi ý đề này" },
  "studyAdvice": "Lời khuyên ngắn trước khi làm đề tiếp theo"
}`;

  try {
    const raw = await callBeeknoee(prompt, {
      model: BEE.insightModel || BEE.ocrModel || BEE.importModel || BEE.model,
      temperature: 0.35,
      maxTokens: 900,
    });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    // Merge AI recommendation với data thực
    const rec = recommendations.find(e => e.id === ai.recommendedExam?.id) || recommendations[0];

    return {
      recommendedExam: rec ? { ...rec, reason: ai.recommendedExam?.reason || '' } : null,
      alternativeExams: ai.alternativeExams || recommendations.slice(1, 4),
      studyAdvice: ai.studyAdvice || '',
    };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      recommendedExam: recommendations.find(e => e.difficultyLevel === level) || recommendations[0],
      alternativeExams: recommendations.slice(1, 4),
      studyAdvice: 'Hãy ôn lại những phần yếu trước khi làm đề mới.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: Phân tích toàn diện (tổng hợp tất cả)
// ─────────────────────────────────────────────────────────────────────────────
async function generateFullAnalysis(examAttempts, allExams = []) {
  const [topicResult, progressResult] = await Promise.allSettled([
    analyzeTopics(examAttempts),
    analyzeProgress(examAttempts),
  ]);

  const topics = topicResult.status === 'fulfilled' ? topicResult.value : null;
  const progress = progressResult.status === 'fulfilled' ? progressResult.value : null;

  const latestAttempt = examAttempts?.[0] || examAttempts?.[examAttempts.length - 1];
  const recResult = await Promise.allSettled([
    getPracticeRecommendations(topics?.weaknesses || [], allExams),
  ]);
  const recs = recResult[0].status === 'fulfilled'
    ? recResult[0].value
    : {
        recommendations: (topics?.weaknesses || []).slice(0, 3).map((w, i) => ({
          title: `Ôn luyện: ${w.name || w.subject || 'chủ đề yếu'}`,
          description: w.advice || 'Ôn lại lý thuyết, làm thêm bài tập và xem lại lỗi sai gần đây.',
          priority: i === 0 ? 'high' : 'medium',
          actionSteps: ['Đọc lại lý thuyết', 'Làm 10 câu liên quan', 'Ghi chú lỗi sai'],
        })),
        studyPlan: 'Học đều 30 phút mỗi ngày và ưu tiên sửa các lỗi sai gần đây.',
      };
  const weaknesses = (topics?.weaknesses || []).map((w) => ({
    subject: w.subject || w.name || 'Chủ đề cần cải thiện',
    percentage: Number(w.percentage ?? w.average ?? 0),
    advice: w.advice || 'Cần ôn luyện thêm phần này.',
  }));
  const strengths = (topics?.strengths || []).map((s) => ({
    subject: s.subject || s.name || 'Điểm mạnh',
    percentage: Number(s.percentage ?? s.average ?? 0),
    praise: s.praise || s.advice || 'Bạn đang làm tốt phần này.',
  }));
  const roadmap = (recs?.recommendations || []).slice(0, 5).map((r, i) => ({
    phase: i + 1,
    days: `${i * 3 + 1}-${i * 3 + 3}`,
    title: r.title || 'Ôn luyện cá nhân',
    description: r.description || r.reason || 'Tiếp tục luyện tập theo điểm yếu đã phát hiện.',
    tasks: r.actionSteps || r.tasks || ['Đọc lại lý thuyết', 'Làm bài tập liên quan', 'Review lỗi sai'],
  }));
  const suggestions = [
    ...(topics?.topRecommendations || []),
    ...(recs?.recommendations || []).map((r) => r.description || r.title).filter(Boolean),
  ].slice(0, 5);

  return {
    // Legacy shape used by AIInsights UI.
    totalExams: examAttempts?.length || 0,
    subjectStats: topics?.subjects || [],
    weaknesses,
    strengths,
    suggestions,
    roadmap,
    recommendedMaterials: [],
    analyzedAt: new Date().toISOString(),

    // Structured shape used by newer consumers.
    topics,
    progress,
    recommendations: recs,
    nextExam: await recommendNextExam({
      userScore: latestAttempt?.total_questions > 0
        ? Math.round((latestAttempt.total_correct / latestAttempt.total_questions) * 100)
        : parseFloat(latestAttempt?.total_score) || 60,
      subjectName: latestAttempt?.subject_name,
      allExams,
    }).catch(() => ({
      recommendedExam: null,
      alternativeExams: [],
      studyAdvice: 'Hãy làm lại các câu sai gần đây và chọn một đề chưa làm để tiếp tục luyện.',
    })),
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports (giữ tương thích với code cũ)
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeWeaknesses(examAttempts) {
  const result = await analyzeTopics(examAttempts);
  return result;
}

async function generateRoadmap(weaknesses) {
  const recs = await getPracticeRecommendations(weaknesses);
  const roadmap = recs.recommendations.slice(0, 5).map((r, i) => ({
    phase: i + 1,
    days: `${i * 3 + 1}-${i * 3 + 3}`,
    title: r.title,
    description: r.description,
    tasks: r.actionSteps || [],
  }));
  return { roadmap };
}

async function recommendMaterials(weaknesses, allMaterials) {
  return allMaterials.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 8: Chấm điểm tự luận / Dịch thuật
// ─────────────────────────────────────────────────────────────────────────────
/**
 * AI chấm điểm câu trả lời tự luận hoặc bài dịch
 * @param {Object} params - { questionText, questionTextCn, userAnswer, correctAnswer, questionType }
 */
async function gradeEssay({ questionText, questionTextCn, userAnswer, correctAnswer, questionType = 'essay' }) {
  const isTranslation = questionType === 'translation';

  const prompt = `Bạn là giáo viên tiếng Trung chấm bài. Chấm bằng TIẾNG VIỆT.

YÊU CẦU:
- Đánh giá chi tiết từng khía cạnh
- Tìm lỗi sai cụ thể, gạch chân từ/phrase bị sai trong câu trả lời
- Đề xuất câu trả lời chuẩn, đúng ngữ pháp
- Cho điểm từng phần và tổng điểm (thang 10)
- Không cho điểm cao nếu câu trả lời quá ngắn, lạc đề, bỏ ý chính hoặc chỉ sao chép một phần đáp án
- Nhận xét phải nêu rõ lỗi ngữ pháp/từ vựng/diễn đạt và cách sửa thực tế

CÂU HỎI:
${questionText || ''}
${questionTextCn ? `Tiếng Trung: ${questionTextCn}` : ''}
${isTranslation ? '\n(Dạng: Dịch thuật)' : '\n(Dạng: Tự luận)'}

CÂU TRẢ LỜI CỦA HỌC SINH:
${userAnswer}

ĐÁP ÁN THAM KHẢO:
${correctAnswer || 'Không có'}

TRẢ VỀ JSON:
{
  "totalScore": 0-10,
  "gradingCriteria": [
    { "criterion": "Tiêu chí", "score": 0-10, "maxScore": 10, "comment": "Nhận xét" }
  ],
  "errors": [
    { "original": "từ/cụm sai", "correct": "sửa lại", "reason": "tại sao sai", "type": "grammar|vocabulary|typo" }
  ],
  "modelAnswer": "Câu trả lời mẫu chuẩn",
  "feedback": "Nhận xét tổng quát 2-3 câu",
  "suggestions": ["Gợi ý cải thiện 1", "Gợi ý 2"]
}`;

  try {
    const raw = await callBeeknoee(prompt, { temperature: 0.25, maxTokens: BEE.essayMaxTokens || 3000 });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    return normalizeEssayGrade(ai);
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      success: true,
      totalScore: 0,
      gradingCriteria: [],
      errors: [],
      modelAnswer: '',
      feedback: 'Không thể chấm bài lúc này. Bạn hãy thử lại sau nhé!',
      suggestions: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 9: Giảng lại lý thuyết (Mini-lesson)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * AI tạo bài giảng ngắn về ngữ pháp/kiến thức liên quan đến câu hỏi sai
 * @param {Object} params - { question, topic, wrongAnswer, correctAnswer, userLevel }
 */
async function teachGrammar({ question, topic, wrongAnswer, correctAnswer, userLevel = 'beginner' }) {
  const levelMap = { beginner: 'sơ cấp', intermediate: 'trung cấp', advanced: 'nâng cao' };
  const levelText = levelMap[userLevel] || 'sơ cấp';
  const lessonMaxTokens = Math.min(BEE.lessonMaxTokens || 1600, 1800);

  const prompt = `Bạn là gia sư giỏi, giải thích bằng TIẾNG VIỆT cho học sinh trình độ ${levelText}.

Ngữ cảnh:
- Câu hỏi: ${question || ''}
- Môn/chủ đề: ${topic || 'không rõ'}
- Học sinh chọn: ${wrongAnswer || 'không có'}
- Đáp án đúng: ${correctAnswer || 'không có'}

Nhiệm vụ:
- Xác định đúng điểm kiến thức cần học từ câu hỏi và đáp án đúng.
- Nếu là tiếng Trung: giải thích ngữ pháp/từ vựng/cách dùng; ví dụ phải có tiếng Trung, pinyin, nghĩa Việt.
- Nếu không phải tiếng Trung: giải thích kiến thức môn đó, không ép thành ngữ pháp tiếng Trung.
- Trong "grammarRule", nêu vì sao đáp án đúng đúng và vì sao đáp án học sinh chọn sai.
- Viết ngắn, chính xác, đủ ý; không lan man; không dùng markdown.
- Trả về JSON hợp lệ duy nhất, không thêm chữ ngoài JSON.

Độ dài bắt buộc:
- title: tối đa 12 từ
- grammarRule: 4-6 câu
- examples: đúng 2 ví dụ
- memoryTips: đúng 2 ý
- commonMistakes: đúng 2 ý
- relatedTopics: đúng 2 ý

JSON schema:
{
  "title": "Tiêu đề bài học",
  "grammarRule": "Giải thích trọng tâm, đáp án đúng, lỗi sai",
  "examples": [
    { "chinese": "ví dụ/công thức/câu mẫu", "pinyin": "pinyin nếu là tiếng Trung, nếu không thì để rỗng", "vietnamese": "nghĩa hoặc lời giải tiếng Việt", "usage": "dùng khi nào" }
  ],
  "memoryTips": ["Mẹo 1", "Mẹo 2"],
  "commonMistakes": ["Lỗi thường gặp 1", "Lỗi thường gặp 2"],
  "relatedTopics": ["Chủ đề liên quan 1", "Chủ đề liên quan 2"]
}`;

  try {
    const raw = await callPublicAI(prompt, { temperature: 0.25, maxTokens: lessonMaxTokens });
    const ai = parseAIMaybeJSON(raw);

    if (!ai) throw new Error('Parse failed');

    return normalizeGrammarLesson(ai);
  } catch (err) {
    if (err.message === 'RATE_LIMITED') throw err;
    return {
      success: false,
      title: 'Bài học ngữ pháp',
      grammarRule: 'Không thể tải bài giảng lúc này. Bạn hãy thử lại sau nhé!',
      examples: [],
      memoryTips: [],
      commonMistakes: [],
      relatedTopics: [],
    };
  }
}

module.exports = {
  PUBLIC_AI_UNAVAILABLE_MESSAGE,
  PUBLIC_AI_BUSY_MESSAGE,
  getPublicAIErrorMessage,
  hasPrivateAIProviderDetails,
  // Core functions
  callBeeknoee,
  callBeeknoeeMessages,
  callAdminExamAI,
  callAdminExamAIMessages,
  isRateLimited,
  getRateLimitRemaining,
  // Features
  analyzeExamResult,
  explainWrongAnswers,
  analyzeTopics,
  getPracticeRecommendations,
  askAI,
  askAIStream,
  askMoliPet,
  generateDailyGiftLetter,
  getDailyGiftFallback,
  analyzeProgress,
  recommendNextExam,
  generateFullAnalysis,
  gradeEssay,
  teachGrammar,
  // Legacy
  analyzeWeaknesses,
  generateRoadmap,
  recommendMaterials,
};
