const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATION_FILE = path.join(__dirname, '../../database/migrations/067_video_commerce_foundation.sql');
const TABLES = ['video_packages', 'video_package_courses', 'combo_packages', 'user_video_entitlements',
  'video_entitlement_courses', 'video_commerce_audit'];

async function applyMigration(client) {
  const required = ['users', 'vip_packages', 'courses', 'transactions'];
  for (const table of required) {
    const result = await client.query('SELECT to_regclass($1) AS relation', [table]);
    if (!result.rows[0].relation) throw new Error(`Missing prerequisite table: ${table}`);
  }
  await client.query('BEGIN');
  try {
    await client.query(fs.readFileSync(MIGRATION_FILE, 'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!['--check', '--apply'].includes(process.argv[2]) || process.argv.length !== 3) {
    throw new Error('Usage: node scripts/apply_video_commerce_migration.js --check|--apply');
  }
  // Require an explicit target; never silently load a production .env file.
  if (!process.env.VIDEO_COMMERCE_DATABASE_URL) throw new Error('Set VIDEO_COMMERCE_DATABASE_URL to the intended database.');
  const client = new Client({ connectionString: process.env.VIDEO_COMMERCE_DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    if (process.argv[2] === '--apply') await applyMigration(client);
    const result = await client.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1::text[])', [TABLES]);
    const present = result.rows.map(row => row.table_name);
    const missing = TABLES.filter(table => !present.includes(table));
    console.log(JSON.stringify({ migration: path.basename(MIGRATION_FILE), ready: missing.length === 0, missing }, null, 2));
    if (missing.length) process.exitCode = 1;
  } finally { await client.end(); }
}

if (require.main === module) main().catch(error => {
  // Database errors can contain connection details. Print only a safe diagnostic.
  console.error(error.code ? `Migration failed (${error.code}).` : 'Migration failed. Check arguments, explicit target and prerequisites.');
  process.exitCode = 1;
});

module.exports = { applyMigration, MIGRATION_FILE, TABLES };
