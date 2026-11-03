-- Dedicated report-center permissions and assignable admin role.

INSERT INTO permissions (code, name, description)
VALUES
  ('reports.view', 'Report Center View', 'Xem danh sách và chi tiết báo cáo, góp ý, hỗ trợ'),
  ('reports.manage', 'Report Center Manage', 'Phân công và xử lý báo cáo, góp ý, hỗ trợ')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO roles (code, name, description, is_system)
VALUES (
  'report_admin',
  'Report Admin',
  'Quản trị viên chuyên tiếp nhận và xử lý báo cáo người dùng',
  TRUE
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'report_admin'
  AND p.code IN ('admin.dashboard.view', 'reports.view', 'reports.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'super_admin'
  AND p.code IN ('reports.view', 'reports.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
