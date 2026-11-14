const fs = require("fs");
const path = require("path");
const { createCourseIntegrationMappingService } = require("../src/services/courseIntegrationMappingService");

/**
 * Applies explicit manual course mappings from an array of { sourceSystem, externalCourseId, localCourseId } entries.
 * Never auto-matches by title or slug.
 */
async function applyManualMappingsFromList(database, entries = []) {
  if (!Array.isArray(entries)) {
    throw new Error("Mapping file must contain a JSON array of manual mapping definitions.");
  }
  const service = createCourseIntegrationMappingService(database);
  const results = [];
  for (const entry of entries) {
    results.push(await service.upsertManualCourseMapping(entry));
  }
  return results;
}

async function main() {
  const targetUrl = process.env.COURSE_INTEGRATION_DATABASE_URL;
  if (!targetUrl) throw new Error("Set COURSE_INTEGRATION_DATABASE_URL to the intended database.");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: targetUrl, connectionTimeoutMillis: 10000 });
  const db = { pool, query: (text, values) => pool.query(text, values) };
  try {
    const fileIndex = process.argv.indexOf("--file");
    const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : "";
    if (!filePath) {
      throw new Error("Usage: node scripts/seed_manual_course_mappings.js --file <mappings.json>");
    }
    const resolved = path.resolve(process.cwd(), filePath);
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    const saved = await applyManualMappingsFromList(db, parsed);
    console.log(JSON.stringify({ applied: saved.length, mappings: saved }, null, 2));
  } finally {
    await db.pool.end().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[seed_manual_course_mappings] Failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { applyManualMappingsFromList };
