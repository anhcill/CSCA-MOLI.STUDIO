const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'csca_db',
});

const MODULE_ROLE_CODES = ['user_admin', 'exam_admin', 'content_admin', 'forum_admin', 'roadmap_admin'];

async function cleanupSuperAdmin() {
  const client = await pool.connect();
  try {
    // Tìm users có cả super_admin VÀ ít nhất 1 module role
    const { rows: polluted } = await client.query(`
      SELECT DISTINCT u.id, u.email, u.full_name,
        array_agg(DISTINCT r.code) FILTER (WHERE r.code != 'student') AS all_roles
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.code = ANY($1::text[])
        AND EXISTS (
          SELECT 1 FROM user_roles ur2
          JOIN roles r2 ON r2.id = ur2.role_id
          WHERE ur2.user_id = u.id AND r2.code = 'super_admin'
        )
      GROUP BY u.id, u.email, u.full_name
    `, [MODULE_ROLE_CODES]);

    if (polluted.length === 0) {
      console.log('✅ Không có user nào bị lỗi phân quyền. Sạch rồi!');
      return;
    }

    console.log(`⚠️  Tìm thấy ${polluted.length} user bị gán super_admin thừa:\n`);
    for (const u of polluted) {
      console.log(`  User #${u.id} | ${u.email} | roles hiện tại: [${u.all_roles.join(', ')}]`);
    }

    // Xóa super_admin khỏi những user này
    const ids = polluted.map(u => u.id);
    const result = await client.query(`
      DELETE FROM user_roles
      WHERE user_id = ANY($1::int[])
        AND role_id = (SELECT id FROM roles WHERE code = 'super_admin')
    `, [ids]);

    console.log(`\n✅ Đã xóa super_admin thừa khỏi ${result.rowCount} user.`);
    console.log('Roles còn lại của các user này giữ nguyên (exam_admin, forum_admin, v.v.)');
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupSuperAdmin();
