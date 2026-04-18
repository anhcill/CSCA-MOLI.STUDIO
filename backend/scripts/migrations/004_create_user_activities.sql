-- Migration: Create user_activities table
-- Mục đích: Ghi lại log hành vi của user trong hệ thống

BEGIN;

CREATE TABLE IF NOT EXISTS user_activities (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    metadata        JSONB DEFAULT '{}',
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để query nhanh theo user và thời gian
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

COMMENT ON TABLE user_activities IS 'Bảng ghi log hành vi người dùng: đăng nhập, đăng xuất, thi, admin thay đổi...';
COMMENT ON COLUMN user_activities.action IS 'Loại hành vi: login, logout, register, google_login, exam_start, exam_submit, admin.change_user_status, admin.delete_user';

COMMIT;
