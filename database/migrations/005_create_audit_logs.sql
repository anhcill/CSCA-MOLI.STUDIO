-- ====================================================
-- Migration: 005_create_audit_logs
-- Tạo bảng audit_logs cho hệ thống RBAC
-- Ghi lại mọi thay đổi về phân quyền
-- ====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- User bị tác động
    actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- Ai thực hiện
    action       VARCHAR(50) NOT NULL,                             -- assign_role, revoke_role, login, ...
    target_type  VARCHAR(50),                                       -- user, role, permission
    target_id    INTEGER,                                          -- ID của target bị thay đổi
    old_value    JSONB,                                            -- Giá trị cũ
    new_value    JSONB,                                            -- Giá trị mới
    ip_address   VARCHAR(45),                                      -- IPv6 compatible
    user_agent   TEXT,
    metadata     JSONB,                                            -- Dữ liệu bổ sung
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho các truy vấn phổ biến
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Trigger tự động xóa log cũ hơn 1 năm (giữ lại 365 ngày)
-- Chạy manual: SELECT cleanup_audit_logs(365);
CREATE OR REPLACE FUNCTION cleanup_audit_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % audit log entries older than % days', deleted_count, days_to_keep;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
