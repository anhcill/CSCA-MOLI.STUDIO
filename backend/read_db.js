/**
 * Read data from Railway PostgreSQL using connection from run_migrations.js
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway',
  ssl: { rejectUnauthorized: false }
});

async function readData() {
  try {
    // Get all tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('=== TABLES ===');
    tables.rows.forEach(r => console.log(' ', r.table_name));

    // Get row counts for each table
    console.log('\n=== ROW COUNTS ===');
    for (const row of tables.rows) {
      const count = await pool.query(`SELECT COUNT(*)::int FROM "${row.table_name}"`);
      console.log(` ${row.table_name}: ${count.rows[0].count} rows`);
    }

    // Show sample data from main tables
    const mainTables = ['users', 'vip_packages', 'user_sessions', 'user_otps', 'vip_reminder_logs', 'vip_features_comparison'];

    for (const table of mainTables) {
      try {
        const result = await pool.query(`SELECT * FROM "${table}" LIMIT 10`);
        if (result.rows.length > 0) {
          console.log(`\n=== ${table} ===`);
          console.log('Columns:', result.fields.map(f => f.name).join(', '));
          console.log(JSON.stringify(result.rows, null, 2));
        }
      } catch (e) {
        console.log(`\n=== ${table} === (table may not exist: ${e.message})`);
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

readData();
