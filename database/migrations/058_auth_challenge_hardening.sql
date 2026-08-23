-- Harden public OTP authentication challenges.
-- The client receives only an opaque challenge token; user_id/reason stay server-side.

CREATE TABLE IF NOT EXISTS auth_challenges (
  id BIGSERIAL PRIMARY KEY,
  challenge_hash CHAR(64) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(32) NOT NULL DEFAULT 'login',
  otp_hash VARCHAR(255) NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  otp_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts SMALLINT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_purpose
  ON auth_challenges(user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expiry
  ON auth_challenges(otp_expires_at)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE auth_challenges IS 'Opaque, short-lived server-side challenges for public OTP flows';
