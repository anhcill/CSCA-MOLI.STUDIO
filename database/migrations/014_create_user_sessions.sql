-- Migration: 014_create_user_sessions.sql
-- Mục đích: Quản lý phiên đăng nhập theo thiết bị cho giới hạn đăng nhập đa thiết bị (VIP/Premium)
-- Tác giả: CSCA Platform
-- Ngày: 2026-04-29

BEGIN;

-- Bảng user_sessions: lưu các phiên đăng nhập đang hoạt động theo thiết bị
CREATE TABLE IF NOT EXISTS user_sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti           VARCHAR(64) UNIQUE NOT NULL,
    device_info   VARCHAR(500),
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    last_active   TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index cho truy vấn nhanh theo user và jti
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti);

-- Thêm cột max_devices vào users (số thiết bị tối đa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;

COMMIT;
