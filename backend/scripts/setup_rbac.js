require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/config/database");

const MIGRATION_DIR = path.join(__dirname, "../../database/migrations");
const SEED_FILE = path.join(__dirname, "../../database/seed_rbac.sql");

const RBAC_MIGRATIONS = [
  "001_create_roles.sql",
  "002_create_permissions.sql",
  "003_create_role_permissions.sql",
  "004_create_user_roles.sql",
  "005_create_audit_logs.sql",
];

function parseFlags(argv) {
  const migrateOnly = argv.includes("--migrate-only");
  const seedOnly = argv.includes("--seed-only");

  if (migrateOnly && seedOnly) {
    throw new Error("Khong the dung dong thoi --migrate-only va --seed-only");
  }

  return { migrateOnly, seedOnly };
}

function readSql(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Khong tim thay file: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, "utf8").trim();
  if (!sql) {
    throw new Error(`File SQL rong: ${filePath}`);
  }

  return sql;
}

async function runSqlFile(filePath, label) {
  const sql = readSql(filePath);
  console.log(`\n-> Dang chay: ${label}`);
  await db.query(sql);
  console.log(`   OK: ${label}`);
}

async function runMigrations() {
  for (const filename of RBAC_MIGRATIONS) {
    const fullPath = path.join(MIGRATION_DIR, filename);
    await runSqlFile(fullPath, `migration ${filename}`);
  }
}

async function runSeed() {
  await runSqlFile(SEED_FILE, "seed_rbac.sql");
}

async function main() {
  try {
    const { migrateOnly, seedOnly } = parseFlags(process.argv.slice(2));

    console.log("=== RBAC Setup Started ===");

    if (!seedOnly) {
      await runMigrations();
    }

    if (!migrateOnly) {
      await runSeed();
    }

    console.log("\n=== RBAC Setup Completed ===");
    process.exit(0);
  } catch (error) {
    console.error("\nRBAC setup failed:", error.message);
    process.exit(1);
  }
}

main();
