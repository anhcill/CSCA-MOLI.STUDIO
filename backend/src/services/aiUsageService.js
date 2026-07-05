const db = require('../config/database');
const { getCurrentUserId } = require('./aiRequestContext');

const PRICING = {
  'deepseek-v4-flash': { input: 0.14, inputCached: 0.0028, output: 0.28 },
  'deepseek-v4-pro': { input: 0.435, inputCached: 0.003625, output: 0.87 },
  'deepseek-chat': { input: 0.14, inputCached: 0.0028, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, inputCached: 0.0055, output: 2.19 },
  'google/gemini-3.1-flash-lite': { input: 0, inputCached: 0, output: 0 },
  'google/gemini-3.1-flash': { input: 0.15, inputCached: 0.0375, output: 0.6 },
  'google/gemini-3.0-flash': { input: 0.1, inputCached: 0.025, output: 0.4 },
  'ag/gemini-3-flash-agent': { input: 0.1, inputCached: 0.025, output: 0.4 },
  'gpt-5.4-mini': { input: 0.15, inputCached: 0.075, output: 0.6 },
  'gpt-5.4': { input: 2.5, inputCached: 1.25, output: 10 },
  'gpt-5.5': { input: 3, inputCached: 1.5, output: 12 },
  'cx/gpt-5.4-mini': { input: 0.15, inputCached: 0.075, output: 0.6 },
  'cx/gpt-5.4': { input: 2.5, inputCached: 1.25, output: 10 },
  'cx/gpt-5.5': { input: 3, inputCached: 1.5, output: 12 },
  'ag/claude-opus-4-6-thinking': { input: 15, inputCached: 1.875, output: 75 },
  'ag/claude-sonnet-4': { input: 3, inputCached: 0.3, output: 15 },
  'ag/claude-sonnet-4-6': { input: 3, inputCached: 0.3, output: 15 },
};

function intValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getModelPricing(model) {
  const normalized = String(model || '').trim().toLowerCase();
  if (PRICING[normalized]) return PRICING[normalized];
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (normalized.includes(key) || key.includes(normalized)) return pricing;
  }
  return { input: 0.15, inputCached: 0.075, output: 0.6 };
}

function normalizeUsageTokens(usage = {}) {
  const promptTokens = intValue(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens);
  const completionTokens = intValue(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens);
  const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
  const promptCacheHitTokens = intValue(
    usage.prompt_cache_hit_tokens
      ?? usage.cache_read_input_tokens
      ?? details.cached_tokens
      ?? details.cache_read_tokens,
  );
  const promptCacheMissTokens = intValue(
    usage.prompt_cache_miss_tokens
      ?? usage.cache_creation_input_tokens
      ?? details.cache_miss_tokens,
  );
  const totalTokens = intValue(usage.total_tokens ?? usage.totalTokens, promptTokens + completionTokens);
  return {
    promptTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens,
    totalTokens,
  };
}

function calculateCostUsd(model, promptTokens, completionTokens, cached = false, promptCacheHitTokens = 0, promptCacheMissTokens = 0) {
  const pricing = getModelPricing(model);
  const prompt = Math.max(0, intValue(promptTokens));
  const completion = Math.max(0, intValue(completionTokens));
  const hit = Math.max(0, intValue(promptCacheHitTokens));
  const miss = Math.max(0, intValue(promptCacheMissTokens));
  const uncategorized = Math.max(0, prompt - hit - miss);
  const uncategorizedInputPrice = cached && !hit && !miss ? pricing.inputCached : pricing.input;
  return (
    hit * pricing.inputCached
    + miss * pricing.input
    + uncategorized * uncategorizedInputPrice
    + completion * pricing.output
  ) / 1_000_000;
}

async function logUsage({
  userId = null,
  provider = 'unknown',
  model = 'unknown',
  feature = 'unknown',
  promptTokens = 0,
  promptCacheHitTokens = 0,
  promptCacheMissTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  cached = false,
  durationMs = null,
}) {
  try {
    const prompt = Math.max(0, intValue(promptTokens));
    const completion = Math.max(0, intValue(completionTokens));
    const cacheHit = Math.max(0, intValue(promptCacheHitTokens));
    const cacheMiss = Math.max(0, intValue(promptCacheMissTokens));
    const total = Math.max(0, intValue(totalTokens, prompt + completion));
    const hasCacheHit = Boolean(cached || cacheHit > 0);
    const costUsd = calculateCostUsd(model, prompt, completion, hasCacheHit, cacheHit, cacheMiss);
    const resolvedUserId = userId || getCurrentUserId();

    await db.query(
      `INSERT INTO ai_token_usage
       (user_id, provider, model, feature, prompt_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens,
        completion_tokens, total_tokens, cached, cost_usd, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        resolvedUserId,
        provider,
        model,
        feature,
        prompt,
        cacheHit,
        cacheMiss,
        completion,
        total,
        hasCacheHit,
        costUsd,
        durationMs,
      ],
    );
  } catch (error) {
    console.error('Failed to log AI usage:', error.message);
  }
}

function logUsageFromResponse(responseData, context = {}) {
  if (!responseData?.usage) return;
  const tokens = normalizeUsageTokens(responseData.usage);
  logUsage({
    userId: context.userId,
    provider: context.provider,
    model: context.model,
    feature: context.feature,
    durationMs: context.durationMs,
    cached: tokens.promptCacheHitTokens > 0,
    ...tokens,
  }).catch(() => {});
}

function buildFilters({ from, to, userId } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  if (from) {
    conditions.push(`t.created_at >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`t.created_at <= $${paramIndex++}`);
    params.push(to);
  }
  if (userId) {
    conditions.push(`t.user_id = $${paramIndex++}`);
    params.push(userId);
  }
  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function getUsageStats({ from, to, userId, limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(200, intValue(limit, 50)));
  const { where, params } = buildFilters({ from, to, userId });

  const overallResult = await db.query(
    `SELECT
       COUNT(*)::int AS total_requests,
       COALESCE(SUM(prompt_tokens), 0)::bigint AS total_prompt_tokens,
       COALESCE(SUM(prompt_cache_hit_tokens), 0)::bigint AS total_cache_hit_tokens,
       COALESCE(SUM(prompt_cache_miss_tokens), 0)::bigint AS total_cache_miss_tokens,
       COALESCE(SUM(completion_tokens), 0)::bigint AS total_completion_tokens,
       COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(cost_usd), 0)::numeric AS total_cost_usd,
       COUNT(DISTINCT user_id)::int AS unique_users
     FROM ai_token_usage t
     ${where}`,
    params,
  );

  const perUserResult = await db.query(
    `SELECT
       t.user_id,
       u.full_name,
       u.email,
       u.role,
       COUNT(*)::int AS requests,
       COALESCE(SUM(t.prompt_tokens), 0)::bigint AS prompt_tokens,
       COALESCE(SUM(t.prompt_cache_hit_tokens), 0)::bigint AS cache_hit_tokens,
       COALESCE(SUM(t.prompt_cache_miss_tokens), 0)::bigint AS cache_miss_tokens,
       COALESCE(SUM(t.completion_tokens), 0)::bigint AS completion_tokens,
       COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(t.cost_usd), 0)::numeric AS cost_usd,
       MAX(t.created_at) AS last_used_at
     FROM ai_token_usage t
     LEFT JOIN users u ON t.user_id = u.id
     ${where}
     GROUP BY t.user_id, u.full_name, u.email, u.role
     ORDER BY cost_usd DESC
     LIMIT ${safeLimit}`,
    params,
  );

  const perUserModelResult = await db.query(
    `SELECT
       t.user_id,
       t.provider,
       t.model,
       COUNT(*)::int AS requests,
       COALESCE(SUM(t.prompt_tokens), 0)::bigint AS prompt_tokens,
       COALESCE(SUM(t.prompt_cache_hit_tokens), 0)::bigint AS cache_hit_tokens,
       COALESCE(SUM(t.prompt_cache_miss_tokens), 0)::bigint AS cache_miss_tokens,
       COALESCE(SUM(t.completion_tokens), 0)::bigint AS completion_tokens,
       COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(t.cost_usd), 0)::numeric AS cost_usd
     FROM ai_token_usage t
     ${where}
     GROUP BY t.user_id, t.provider, t.model
     ORDER BY t.user_id NULLS LAST, cost_usd DESC`,
    params,
  );

  const perModelResult = await db.query(
    `SELECT
       t.provider,
       t.model,
       COUNT(*)::int AS requests,
       COALESCE(SUM(t.prompt_tokens), 0)::bigint AS prompt_tokens,
       COALESCE(SUM(t.prompt_cache_hit_tokens), 0)::bigint AS cache_hit_tokens,
       COALESCE(SUM(t.prompt_cache_miss_tokens), 0)::bigint AS cache_miss_tokens,
       COALESCE(SUM(t.completion_tokens), 0)::bigint AS completion_tokens,
       COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(t.cost_usd), 0)::numeric AS cost_usd
     FROM ai_token_usage t
     ${where}
     GROUP BY t.provider, t.model
     ORDER BY cost_usd DESC`,
    params,
  );

  const perFeatureResult = await db.query(
    `SELECT
       t.feature,
       COUNT(*)::int AS requests,
       COALESCE(SUM(t.prompt_tokens), 0)::bigint AS prompt_tokens,
       COALESCE(SUM(t.completion_tokens), 0)::bigint AS completion_tokens,
       COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(t.cost_usd), 0)::numeric AS cost_usd
     FROM ai_token_usage t
     ${where}
     GROUP BY t.feature
     ORDER BY cost_usd DESC`,
    params,
  );

  const dailyResult = await db.query(
    `SELECT
       DATE(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS date,
       COUNT(*)::int AS requests,
       COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens,
       COALESCE(SUM(t.cost_usd), 0)::numeric AS cost_usd,
       COUNT(DISTINCT t.user_id)::int AS unique_users
     FROM ai_token_usage t
     ${where}
     GROUP BY DATE(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
     ORDER BY date DESC
     LIMIT 30`,
    params,
  );

  const modelsByUser = new Map();
  for (const row of perUserModelResult.rows) {
    const key = row.user_id === null || row.user_id === undefined ? '__unknown__' : String(row.user_id);
    const pricing = getModelPricing(row.model);
    const current = modelsByUser.get(key) || [];
    current.push({
      ...row,
      pricing,
    });
    modelsByUser.set(key, current);
  }

  const perUser = perUserResult.rows.map((row) => {
    const key = row.user_id === null || row.user_id === undefined ? '__unknown__' : String(row.user_id);
    return {
      ...row,
      models: (modelsByUser.get(key) || []).slice(0, 5),
    };
  });

  return {
    overview: overallResult.rows[0] || {},
    perUser,
    perModel: perModelResult.rows,
    perFeature: perFeatureResult.rows,
    daily: dailyResult.rows,
    pricing: PRICING,
  };
}

module.exports = {
  PRICING,
  calculateCostUsd,
  getModelPricing,
  getUsageStats,
  logUsage,
  logUsageFromResponse,
  normalizeUsageTokens,
};
