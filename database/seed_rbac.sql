-- ====================================================
-- Seed: RBAC bootstrap (roles, permissions, mappings)
-- Safe to run multiple times (idempotent)
-- ====================================================

BEGIN;

-- 1) Roles
INSERT INTO roles (code, name, description, is_system)
VALUES
    ('student', 'Student', 'Default role for normal users', TRUE),
    ('super_admin', 'Super Admin', 'Full access to all modules', TRUE),
    ('user_admin', 'User Admin', 'Manage users and admin assignments', TRUE),
    ('forum_admin', 'Forum Admin', 'Moderate forum content and announcements', TRUE),
    ('roadmap_admin', 'Roadmap Admin', 'Manage roadmap milestones and structure', TRUE),
    ('exam_admin', 'Exam Admin', 'Manage exams, questions and schedules', TRUE),
    ('content_admin', 'Content Admin', 'Manage study materials and vocabulary', TRUE)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- 2) Permissions
INSERT INTO permissions (code, name, description)
VALUES
    ('*', 'All Permissions', 'Wildcard permission for full system access'),
    ('admin.dashboard.view', 'View Admin Dashboard', 'Access admin dashboard and statistics'),
    ('users.manage', 'Manage Users', 'Manage users, roles and VIP status'),
    ('forum.manage', 'Manage Forum', 'Moderate and remove forum posts/comments'),
    ('forum.post_as_admin', 'Post Official Announcement', 'Create official forum announcements'),
    ('roadmap.manage', 'Manage Roadmap', 'Create/update/delete roadmap milestones'),
    ('exams.manage', 'Manage Exams', 'Create/update/delete exams and questions'),
    ('content.manage', 'Manage Content', 'Manage materials, uploads and vocabulary'),
    ('system.manage', 'Manage System Settings', 'Update global system settings')
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 3) Role -> Permission mapping
WITH role_permission_map(role_code, permission_code) AS (
    VALUES
        ('super_admin', '*'),

        ('user_admin', 'admin.dashboard.view'),
        ('user_admin', 'users.manage'),

        ('forum_admin', 'admin.dashboard.view'),
        ('forum_admin', 'forum.manage'),
        ('forum_admin', 'forum.post_as_admin'),

        ('roadmap_admin', 'admin.dashboard.view'),
        ('roadmap_admin', 'roadmap.manage'),

        ('exam_admin', 'admin.dashboard.view'),
        ('exam_admin', 'exams.manage'),

        ('content_admin', 'admin.dashboard.view'),
        ('content_admin', 'content.manage')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_map rpm
JOIN roles r ON r.code = rpm.role_code
JOIN permissions p ON p.code = rpm.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4) Bootstrap user_roles from legacy users.role
-- Keep backward compatibility: existing admin users get super_admin.
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
JOIN roles r ON r.code = 'student'
WHERE COALESCE(u.role, 'student') = 'student'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
JOIN roles r ON r.code = 'super_admin'
WHERE u.role = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
