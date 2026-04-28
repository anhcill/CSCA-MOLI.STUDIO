-- Migration: 013_create_vip_reminder_logs.sql
-- Mục đích: Tránh gửi email nhắc hết hạn VIP trùng lặp
-- Ngày: 2026-04-29

BEGIN;

CREATE TABLE IF NOT EXISTS vip_reminder_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    days_before INTEGER NOT NULL,          -- 3, 2, hoặc 1 ngày trước khi hết hạn
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ngăn trùng: mỗi user chỉ nhận 1 email cho mỗi mốc ngày
ALTER TABLE vip_reminder_logs
    ADD CONSTRAINT vip_reminder_logs_user_days_unique
    UNIQUE (user_id, days_before);

CREATE INDEX IF NOT EXISTS idx_vip_reminder_logs_user
    ON vip_reminder_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_vip_reminder_logs_sent
    ON vip_reminder_logs (sent_at);

COMMENT ON TABLE vip_reminder_logs IS 'Log gửi email nhắc hết hạn VIP để tránh gửi trùng';

COMMIT;
