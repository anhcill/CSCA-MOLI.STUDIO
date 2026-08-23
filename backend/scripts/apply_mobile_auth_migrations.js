const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS = [
  "058_auth_challenge_hardening.sql",
  "059_mobile_push_tokens.sql",
  "060_auth_legal_email_verification.sql",
];

function connectionString() {
  const value = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required");
  return value;
}

async function verifySchema(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.mobile_push_tokens') IS NOT NULL AS mobile_push_tokens,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_mobile_push_tokens_user_active'
      ) AS mobile_push_tokens_index,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'terms_accepted_at'
      ) AS terms_accepted_at,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'terms_version'
      ) AS terms_version,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'privacy_version'
      ) AS privacy_version,
      to_regclass('public.auth_challenges') IS NOT NULL AS auth_challenges
  `);
  const missing = Object.entries(result.rows[0])
    .filter(([, exists]) => !exists)
    .map(([name]) => name);
  if (missing.length) throw new Error(`Missing schema objects: ${missing.join(", ")}`);
  return result.rows[0];
}

async function main() {
  const verifyOnly = process.argv.includes("--verify-only");
  const client = new Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  try {
    await client.connect();
    const target = await client.query(
      "SELECT current_database() AS database, current_user AS role",
    );
    console.log(
      `Connected to database ${target.rows[0].database} as ${target.rows[0].role}.`,
    );

    if (verifyOnly) {
      await verifySchema(client);
      console.log("Mobile/auth schema verification: PASS");
      return;
    }

    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('csca-mobile-auth-migrations-058-060'))",
    );
    for (const filename of MIGRATIONS) {
      const sqlPath = path.resolve(
        __dirname,
        "../../database/migrations",
        filename,
      );
      await client.query(fs.readFileSync(sqlPath, "utf8"));
      console.log(`Applied ${filename}`);
    }
    await verifySchema(client);
    await client.query("COMMIT");
    console.log("Mobile/auth schema verification: PASS");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error(`Mobile/auth migration failed and was rolled back: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { MIGRATIONS, verifySchema };
