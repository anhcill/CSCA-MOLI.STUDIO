-- ============================================================
-- Harden device replacement requests and OTP storage
-- ============================================================

ALTER TABLE device_login_requests
  ADD COLUMN IF NOT EXISTS target_session_jti VARCHAR(64),
  ADD COLUMN IF NOT EXISTS replacement_jti VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_device_login_requests_target_session
  ON device_login_requests(user_id, target_session_jti)
  WHERE status = 'pending';

-- storeOtp() uses ON CONFLICT (user_id, reason). Older databases may only
-- have a non-unique lookup index, so deduplicate before adding the constraint.
CREATE TABLE IF NOT EXISTS user_otps (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  reason VARCHAR(50) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DELETE FROM user_otps older
USING user_otps newer
WHERE older.user_id = newer.user_id
  AND older.reason = newer.reason
  AND (
    older.created_at < newer.created_at
    OR (older.created_at = newer.created_at AND older.id < newer.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_otps_user_reason
  ON user_otps(user_id, reason);
