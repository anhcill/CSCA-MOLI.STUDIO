const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function main() {
  const client = await pool.connect();
  try {
    // Get 2 users for testing
    const users = await client.query(`SELECT id, email, full_name FROM users WHERE is_active = true LIMIT 5`);
    console.log('=== TEST USERS ===');
    users.rows.forEach(u => console.log(JSON.stringify(u)));

    // Check tables created
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'forum_%' ORDER BY table_name`);
    console.log('\n=== FORUM TABLES ===');
    tables.rows.forEach(t => console.log(t.table_name));

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
