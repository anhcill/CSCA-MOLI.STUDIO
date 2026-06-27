-- ============================================================
-- Device login replacement requests
-- ============================================================

CREATE TABLE IF NOT EXISTS device_login_requests (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_token    VARCHAR(96) UNIQUE NOT NULL,
  device_type        VARCHAR(20) NOT NULL DEFAULT 'desktop',
  new_device_info    VARCHAR(500),
  new_user_agent     TEXT,
  new_ip_address     VARCHAR(45),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by_jti    VARCHAR(64),
  approved_at        TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_login_requests_token
  ON device_login_requests(challenge_token);

CREATE INDEX IF NOT EXISTS idx_device_login_requests_user_status
  ON device_login_requests(user_id, status, expires_at DESC);
