-- ====================================================
-- Migration: 002_create_permissions
-- Tạo bảng permissions cho hệ thống RBAC
-- ====================================================

CREATE TABLE IF NOT EXISTS permissions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(100) UNIQUE NOT NULL,         -- users.manage, exams.manage, ...
    name        VARCHAR(120) NOT NULL,                 -- Tên hiển thị
    description TEXT,                                 -- Mô tả quyền
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho code lookup
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
