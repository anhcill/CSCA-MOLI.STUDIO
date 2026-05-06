const { pool } = require('./src/config/database');

async function main() {
  const result = await pool.query('SELECT id, name, code, slug FROM subjects ORDER BY id');
  console.table(result.rows);
}

main().finally(() => process.exit(0));
