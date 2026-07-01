-- Track AI token usage per request for cost analytics
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,            -- 'beeknoee', 'deepseek', '9router'
  model VARCHAR(120) NOT NULL,
  feature VARCHAR(80) NOT NULL DEFAULT 'unknown', -- 'chat', 'exam_analysis', 'moli_pet', 'grade_essay', 'teach_grammar', 'explain', 'progress', 'admin_exam_ai', etc.
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
  prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0, -- estimated cost in USD
  duration_ms INTEGER,                       -- how long the request took
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_token_usage ADD COLUMN IF NOT EXISTS prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_token_usage ADD COLUMN IF NOT EXISTS prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON ai_token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_provider ON ai_token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_feature ON ai_token_usage(feature);
