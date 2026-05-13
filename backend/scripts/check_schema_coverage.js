require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ROOT = path.resolve(__dirname, "../..");
const SEARCH_DIRS = [
  path.join(ROOT, "database"),
  path.join(ROOT, "backend", "scripts"),
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (/\.(sql|js)$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function getLocalCreateTables() {
  const found = new Set();
  const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"public"|public)\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\(/gi;

  for (const file of SEARCH_DIRS.flatMap((dir) => walk(dir))) {
    const text = fs.readFileSync(file, "utf8");
    let match;
    while ((match = pattern.exec(text))) {
      found.add(match[1]);
    }
  }

  return found;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const remoteTables = result.rows.map((row) => row.table_name);
  const localTables = getLocalCreateTables();
  const missingLocally = remoteTables.filter((table) => !localTables.has(table));
  const localOnly = [...localTables].filter((table) => !remoteTables.includes(table)).sort();

  console.log(JSON.stringify({
    remoteTableCount: remoteTables.length,
    localCreateTableCount: localTables.size,
    missingLocally,
    localOnly,
  }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
