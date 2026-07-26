const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS = [
  "052_csca_courses_core.sql",
  "053_csca_course_progress.sql",
  "054_csca_video_assets.sql",
  "055_csca_course_package_access.sql",
];

const EXPECTED_TABLES = [
  "course_enrollments",
  "course_package_access",
  "course_instructors",
  "course_lessons",
  "course_outcomes",
  "course_related_items",
  "course_requirements",
  "course_sections",
  "courses",
  "lesson_progress",
  "lesson_resources",
  "video_assets",
  "video_upload_sessions",
  "video_variants",
];

const EXPECTED_CONSTRAINTS = [
  "fk_course_lessons_video_asset",
  "fk_courses_preview_video_asset",
  "fk_lesson_progress_lesson_course",
  "chk_courses_access_type",
  "chk_course_enrollments_source",
];

function connectionString() {
  const value = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required");
  return value;
}

async function verifyPrerequisites(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS users_exists,
      to_regclass('public.materials') IS NOT NULL AS materials_exists,
      to_regclass('public.vip_packages') IS NOT NULL AS vip_packages_exists,
      to_regprocedure('public.update_updated_at_column()') IS NOT NULL AS trigger_function_exists
  `);
  const missing = Object.entries(result.rows[0])
    .filter(([, exists]) => !exists)
    .map(([name]) => name.replace(/_exists$/, ""));
  if (missing.length) throw new Error(`Missing database prerequisites: ${missing.join(", ")}`);
}

async function verifyCourseSchema(client) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [EXPECTED_TABLES],
  );
  const presentTables = tables.rows.map((row) => row.table_name);
  const missingTables = EXPECTED_TABLES.filter((name) => !presentTables.includes(name));

  const constraints = await client.query(
    `SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[]) ORDER BY conname`,
    [EXPECTED_CONSTRAINTS],
  );
  const presentConstraints = constraints.rows.map((row) => row.conname);
  const missingConstraints = EXPECTED_CONSTRAINTS.filter((name) => !presentConstraints.includes(name));

  const readiness = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_courses_catalog'
      ) AS catalog_index,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_video_variants_ready'
      ) AS video_index,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_course_package_access_package'
      ) AS package_access_index,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'video_assets'
          AND column_name = 'hls_master_object_key'
      ) AS hls_master_column,
      EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public' AND event_object_table = 'courses'
          AND trigger_name = 'update_courses_updated_at'
      ) AS course_update_trigger
  `);
  const missingReadiness = Object.entries(readiness.rows[0])
    .filter(([, exists]) => !exists)
    .map(([name]) => name);

  if (missingTables.length || missingConstraints.length || missingReadiness.length) {
    throw new Error([
      missingTables.length ? `tables: ${missingTables.join(", ")}` : null,
      missingConstraints.length ? `constraints: ${missingConstraints.join(", ")}` : null,
      missingReadiness.length ? `readiness checks: ${missingReadiness.join(", ")}` : null,
    ].filter(Boolean).join("; "));
  }

  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM courses) AS courses,
      (SELECT COUNT(*)::int FROM course_lessons) AS lessons,
      (SELECT COUNT(*)::int FROM video_assets) AS video_assets
  `);
  return { tables: presentTables.length, constraints: presentConstraints.length, rows: counts.rows[0] };
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
    const target = await client.query("SELECT current_database() AS database, current_user AS role");
    console.log(`Connected to database ${target.rows[0].database} as ${target.rows[0].role}.`);
    await verifyPrerequisites(client);
    console.log("Database prerequisites: PASS");

    if (verifyOnly) {
      const verification = await verifyCourseSchema(client);
      console.log(`Schema verification: PASS (${verification.tables} tables, ${verification.constraints} critical constraints)`);
      console.log(`Current course rows: ${JSON.stringify(verification.rows)}`);
      return;
    }

    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('csca-course-migrations-052-055'))");
    for (const filename of MIGRATIONS) {
      const sqlPath = path.resolve(__dirname, "../../database/migrations", filename);
      const sql = fs.readFileSync(sqlPath, "utf8");
      await client.query(sql);
      console.log(`Applied ${filename}`);
    }
    const verification = await verifyCourseSchema(client);
    await client.query("COMMIT");
    console.log(`Schema verification: PASS (${verification.tables} tables, ${verification.constraints} critical constraints)`);
    console.log(`Current course rows: ${JSON.stringify(verification.rows)}`);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error(`Course migration failed and was rolled back: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { EXPECTED_CONSTRAINTS, EXPECTED_TABLES, verifyCourseSchema, verifyPrerequisites };
