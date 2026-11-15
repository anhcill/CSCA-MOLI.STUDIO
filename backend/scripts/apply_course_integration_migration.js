const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATION_FILE = path.join(
  __dirname,
  "../../database/migrations/076_moly_course_integration_foundation.sql",
);
const MIGRATION_FILES = [
  MIGRATION_FILE,
  path.join(__dirname, "../../database/migrations/077_moly_payment_outbox_sync.sql"),
  path.join(__dirname, "../../database/migrations/078_moly_course_sso.sql"),
  path.join(__dirname, "../../database/migrations/079_moly_sso_browser_transactions.sql"),
  path.join(__dirname, "../../database/migrations/080_moly_integration_day5_ops.sql"),
  path.join(__dirname, "../../database/migrations/081_moly_course_full_sync_foundation.sql"),
];

const TABLES = [
  "external_identities",
  "external_course_mappings",
  "external_entitlements",
  "integration_inbox",
  "integration_outbox",
  "integration_conflicts",
  "integration_sso_codes",
  "integration_sso_link_requests",
  "integration_sso_browser_txs",
  "integration_reconciliation_runs",
  "integration_reconciliation_actions",
  "course_profile_projections",
  "course_sync_checkpoints",
  "moly_course_sync_inbox",
  "course_unit_projections",
  "course_file_projections",
  "course_progress_projections",
  "course_assessment_projections",
  "course_note_projections",
  "moly_trusted_browser_devices",
];

async function applyMigration(client) {
  const required = ["users", "courses"];
  for (const table of required) {
    const result = await client.query("SELECT to_regclass($1) AS relation", [table]);
    if (!result.rows[0].relation) {
      throw new Error(`Missing prerequisite table: ${table}`);
    }
  }
  await client.query("BEGIN");
  try {
    for (const file of MIGRATION_FILES) {
      await client.query(fs.readFileSync(file, "utf8"));
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!["--check", "--apply"].includes(process.argv[2]) || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/apply_course_integration_migration.js --check|--apply");
  }
  // Require an explicit target; never silently load a production .env file.
  const targetUrl = process.env.COURSE_INTEGRATION_DATABASE_URL;
  if (!targetUrl) {
    throw new Error("Set COURSE_INTEGRATION_DATABASE_URL to the intended database.");
  }
  const client = new Client({
    connectionString: targetUrl,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    if (process.argv[2] === "--apply") {
      await applyMigration(client);
    }
    const result = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = ANY($1::text[])`,
      [TABLES],
    );
    const present = result.rows.map((row) => row.table_name);
    const missing = TABLES.filter((table) => !present.includes(table));
    console.log(
      JSON.stringify(
        { migration: path.basename(MIGRATION_FILE), ready: missing.length === 0, missing },
        null,
        2,
      ),
    );
    if (missing.length) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error.code
        ? `Migration failed (${error.code}).`
        : `Migration failed: ${error.message}`,
    );
    process.exitCode = 1;
  });
}

module.exports = { applyMigration, MIGRATION_FILE, MIGRATION_FILES, TABLES };
