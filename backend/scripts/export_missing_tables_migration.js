require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "database", "migrations", "020_sync_railway_missing_tables.sql");
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
    if (path.resolve(file) === OUTPUT) continue;
    const text = fs.readFileSync(file, "utf8");
    let match;
    while ((match = pattern.exec(text))) found.add(match[1]);
  }
  return found;
}

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function typeForColumn(col) {
  if (col.data_type === "ARRAY") {
    const element = col.udt_name?.startsWith("_") ? col.udt_name.slice(1) : "text";
    return `${element}[]`;
  }
  if (col.data_type === "character varying") {
    return col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : "VARCHAR";
  }
  if (col.data_type === "character") {
    return col.character_maximum_length ? `CHAR(${col.character_maximum_length})` : "CHAR";
  }
  if (col.data_type === "numeric") {
    if (col.numeric_precision && col.numeric_scale !== null) {
      return `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
    }
    return "NUMERIC";
  }
  if (col.data_type === "timestamp without time zone") return "TIMESTAMP";
  if (col.data_type === "timestamp with time zone") return "TIMESTAMPTZ";
  if (col.data_type === "USER-DEFINED") return col.udt_name;
  return col.data_type.toUpperCase();
}

function serialType(col) {
  const expectedSeq = `nextval('${col.table_name}_${col.column_name}_seq'::regclass)`;
  if (col.column_default !== expectedSeq) return null;
  if (col.data_type === "integer") return "SERIAL";
  if (col.data_type === "bigint") return "BIGSERIAL";
  return null;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const localTables = getLocalCreateTables();
  const remoteTablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const missingTables = remoteTablesResult.rows
    .map((row) => row.table_name)
    .filter((table) => !localTables.has(table));

  const columnsResult = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable,
           column_default, character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1)
    ORDER BY table_name, ordinal_position
  `, [missingTables]);

  const constraintsResult = await client.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      kcu.ordinal_position,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    LEFT JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = ANY($1)
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `, [missingTables]);

  const indexesResult = await client.query(`
    SELECT tablename AS table_name, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1)
    ORDER BY tablename, indexname
  `, [missingTables]);

  const columnsByTable = new Map();
  for (const col of columnsResult.rows) {
    if (!columnsByTable.has(col.table_name)) columnsByTable.set(col.table_name, []);
    columnsByTable.get(col.table_name).push(col);
  }

  const constraintsByTable = new Map();
  for (const row of constraintsResult.rows) {
    if (!constraintsByTable.has(row.table_name)) constraintsByTable.set(row.table_name, new Map());
    const tableConstraints = constraintsByTable.get(row.table_name);
    if (!tableConstraints.has(row.constraint_name)) {
      tableConstraints.set(row.constraint_name, {
        name: row.constraint_name,
        type: row.constraint_type,
        columns: [],
        foreignTable: row.foreign_table_name,
        foreignColumn: row.foreign_column_name,
        deleteRule: row.delete_rule,
        updateRule: row.update_rule,
      });
    }
    if (row.column_name && !tableConstraints.get(row.constraint_name).columns.includes(row.column_name)) {
      tableConstraints.get(row.constraint_name).columns.push(row.column_name);
    }
  }

  const lines = [
    "-- Sync tables that exist on Railway but were missing from local SQL files.",
    "-- Generated from information_schema. Review before running on production.",
    "",
  ];

  for (const table of missingTables) {
    const constraints = [...(constraintsByTable.get(table)?.values() || [])];
    const pk = constraints.find((constraint) => constraint.type === "PRIMARY KEY");
    const uniqueConstraints = constraints.filter((constraint) => constraint.type === "UNIQUE");
    const columns = columnsByTable.get(table) || [];

    lines.push(`CREATE TABLE IF NOT EXISTS ${qIdent(table)} (`);
    const defs = columns.map((col) => {
      const serial = serialType(col);
      const parts = [`  ${qIdent(col.column_name)}`, serial || typeForColumn(col)];
      if (!serial && col.column_default !== null) parts.push(`DEFAULT ${col.column_default}`);
      if (col.is_nullable === "NO") parts.push("NOT NULL");
      return parts.join(" ");
    });
    if (pk) defs.push(`  CONSTRAINT ${qIdent(pk.name)} PRIMARY KEY (${pk.columns.map(qIdent).join(", ")})`);
    for (const uq of uniqueConstraints) {
      defs.push(`  CONSTRAINT ${qIdent(uq.name)} UNIQUE (${uq.columns.map(qIdent).join(", ")})`);
    }
    lines.push(defs.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  for (const table of missingTables) {
    const constraints = [...(constraintsByTable.get(table)?.values() || [])];
    for (const fk of constraints.filter((constraint) => constraint.type === "FOREIGN KEY")) {
      const clauses = [
        `ALTER TABLE ${qIdent(table)} ADD CONSTRAINT ${qIdent(fk.name)}`,
        `FOREIGN KEY (${fk.columns.map(qIdent).join(", ")})`,
        `REFERENCES ${qIdent(fk.foreignTable)}(${qIdent(fk.foreignColumn)})`,
      ];
      if (fk.deleteRule && fk.deleteRule !== "NO ACTION") clauses.push(`ON DELETE ${fk.deleteRule}`);
      if (fk.updateRule && fk.updateRule !== "NO ACTION") clauses.push(`ON UPDATE ${fk.updateRule}`);

      lines.push("DO $$");
      lines.push("BEGIN");
      lines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.name.replace(/'/g, "''")}') THEN`);
      lines.push(`    ${clauses.join(" ")};`);
      lines.push("  END IF;");
      lines.push("END $$;");
      lines.push("");
    }
  }

  for (const idx of indexesResult.rows) {
    if (idx.indexname.endsWith("_pkey")) continue;
    lines.push(`${idx.indexdef.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS").replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS")};`);
  }
  lines.push("");

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ output: OUTPUT, missingTables }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
