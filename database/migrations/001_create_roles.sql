-- ====================================================
-- Migration: 001_create_roles
-- Tạo bảng roles cho hệ thống RBAC
-- ====================================================

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50) UNIQUE NOT NULL,          -- super_admin, user_admin, forum_admin, ...
    name        VARCHAR(100) NOT NULL,                 -- Tên hiển thị
    description TEXT,                                 -- Mô tả vai trò
    is_system   BOOLEAN DEFAULT TRUE,                 -- System role không được xóa
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_roles_updated_at();

-- Index cho code lookup
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
