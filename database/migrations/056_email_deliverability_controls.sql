BEGIN;

CREATE TABLE IF NOT EXISTS user_email_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_source VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_email_preferences_marketing
  ON user_email_preferences (marketing_enabled, user_id);

CREATE TABLE IF NOT EXISTS email_suppressions (
  email VARCHAR(320) PRIMARY KEY,
  reason VARCHAR(40) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'system',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason
  ON email_suppressions (reason, updated_at DESC);

COMMENT ON TABLE user_email_preferences IS
  'Per-user permission for optional marketing email. Transactional email is handled separately.';

COMMENT ON TABLE email_suppressions IS
  'Addresses excluded from bulk email after unsubscribe, hard bounce, complaint, or manual suppression.';

COMMIT;
