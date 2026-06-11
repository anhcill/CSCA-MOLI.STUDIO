-- Persist admin PDF import AI review ledgers so fixed/skipped logs are not re-sent to AI.

CREATE TABLE IF NOT EXISTS admin_import_review_ledgers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ledger_key TEXT NOT NULL,
  source JSONB DEFAULT '{}'::jsonb,
  question_count INTEGER DEFAULT 0,
  ledger JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ledger_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_import_review_ledgers_user_updated
  ON admin_import_review_ledgers(user_id, updated_at DESC);
