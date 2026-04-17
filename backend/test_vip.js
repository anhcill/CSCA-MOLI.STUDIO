const { pool } = require('./src/config/database');

async function test() {
  try {
    const res = await pool.query("SELECT is_vip, vip_expires_at FROM users LIMIT 1");
    console.log("users table has VIP columns:", Object.keys(res.rows[0] || { is_vip: true, vip_expires_at: true }));

    const res2 = await pool.query("SELECT COUNT(*) FROM transactions");
    console.log("transactions table exists, row count:", res2.rows[0].count);
    
    console.log("ALL GOOD");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    pool.end();
  }
}
test();
