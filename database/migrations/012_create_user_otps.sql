-- Migration: 012_create_user_otps.sql
-- Mục đích: Lưu trữ OTP cho xác thực 2FA (đăng nhập, đổi mật khẩu)
-- Tác giả: CSCA Platform
-- Ngày: 2026-04-29

BEGIN;

-- Bảng lưu OTP
CREATE TABLE IF NOT EXISTS user_otps (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    otp_hash        VARCHAR(255) NOT NULL,
    reason          VARCHAR(50) NOT NULL DEFAULT 'login',
    -- reason: login | password_change | withdrawal | etc.
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index cho việc tra cứu nhanh theo user + reason
CREATE INDEX IF NOT EXISTS idx_user_otps_user_reason
    ON user_otps (user_id, reason, is_used);

-- Index cho việc cleanup expired OTPs
CREATE INDEX IF NOT EXISTS idx_user_otps_expires
    ON user_otps (expires_at) WHERE is_used = FALSE;

COMMENT ON TABLE user_otps IS 'Lưu trữ OTP 2FA cho xác thực người dùng';
COMMENT ON COLUMN user_otps.otp_hash IS 'Hash bcrypt của OTP (không lưu OTP plain)';
COMMENT ON COLUMN user_otps.reason IS 'Mục đích OTP: login, password_change, withdrawal';
COMMENT ON COLUMN user_otps.is_used IS 'Đánh dấu OTP đã được sử dụng (one-time use)';

COMMIT;
