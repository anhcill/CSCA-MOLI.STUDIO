const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  console.log('Connected!');

  const perms = await client.query("SELECT code, name FROM permissions WHERE code LIKE 'admin%' ORDER BY code");
  console.log('\n=== PERMISSIONS (admin.*) ===');
  console.table(perms.rows);

  const rolePerm = await client.query(`
    SELECT r.code as role, p.code as permission
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.code = 'super_admin'
    ORDER BY p.code
  `);
  console.log('\n=== super_admin PERMISSIONS ===');
  console.table(rolePerm.rows);

  const roles = await client.query('SELECT id, code, name FROM roles ORDER BY code');
  console.log('\n=== ALL ROLES ===');
  console.table(roles.rows);

  await client.end();
}

check().catch(e => { console.error(e); process.exit(1); });
