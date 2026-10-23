-- Paid accounts keep two remembered device slots across logout and session expiry.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS device_limit_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_limit_locked_at TIMESTAMPTZ;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS device_key VARCHAR(128);

CREATE TABLE IF NOT EXISTS user_remembered_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key VARCHAR(128) NOT NULL,
  device_type VARCHAR(20) NOT NULL DEFAULT 'desktop',
  device_info VARCHAR(500),
  user_agent TEXT,
  ip_address VARCHAR(45),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_user_remembered_devices_user_active
  ON user_remembered_devices(user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device_key
  ON user_sessions(user_id, device_key)
  WHERE device_key IS NOT NULL;
