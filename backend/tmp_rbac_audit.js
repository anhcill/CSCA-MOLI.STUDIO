const db = require('./src/config/database');

async function main() {
  const sql = `
    WITH role_perm AS (
      SELECT
        ur.user_id,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.code), NULL) AS role_codes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.code), NULL) AS permission_codes
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      GROUP BY ur.user_id
    )
    SELECT
      u.id,
      u.username,
      u.email,
      u.role AS legacy_role,
      COALESCE(rp.role_codes, '{}'::text[]) AS role_codes,
      COALESCE(rp.permission_codes, '{}'::text[]) AS permission_codes,
      (
        'admin.dashboard.view' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'system.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'users.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'exams.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'content.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'forum.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
        OR 'roadmap.manage' = ANY(COALESCE(rp.permission_codes, '{}'::text[]))
      ) AS can_access_admin
    FROM users u
    LEFT JOIN role_perm rp ON rp.user_id = u.id
    ORDER BY u.id;
  `;

  const { rows } = await db.query(sql);
  console.log(JSON.stringify(rows, null, 2));

  const mismatches = rows.filter((r) => {
    const hasAdminRoleCode = (r.role_codes || []).some((code) => code !== 'student');
    return (r.legacy_role === 'admin' && !r.can_access_admin)
      || (r.legacy_role === 'student' && hasAdminRoleCode)
      || (r.legacy_role === 'admin' && !hasAdminRoleCode);
  });

  console.log('\nMISMATCH_COUNT=' + mismatches.length);
  if (mismatches.length) {
    console.log(JSON.stringify(mismatches, null, 2));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
