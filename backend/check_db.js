const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function main() {
  const client = await pool.connect();

  const tables = ['posts', 'comments', 'post_likes', 'post_comments', 'notifications', 'user_stats'];

  for (const tbl of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tbl]);
    console.log(`\n=== ${tbl.toUpperCase()} ===`);
    cols.rows.forEach(r => console.log(r.column_name, '-', r.data_type));
  }

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
