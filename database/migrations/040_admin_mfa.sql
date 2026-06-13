CREATE TABLE IF NOT EXISTS admin_mfa_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_encrypted TEXT,
  pending_secret_encrypted TEXT,
  backup_codes_hash JSONB NOT NULL DEFAULT '[]'::jsonb,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  last_totp_step BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_enabled
ON admin_mfa_settings(totp_enabled)
WHERE totp_enabled = TRUE;
