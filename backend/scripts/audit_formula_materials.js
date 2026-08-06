const { Client } = require('pg');

async function main() {
  const connectionString = process.env.FORMULA_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('FORMULA_DB_URL or DATABASE_URL is required.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'materials'
      ORDER BY ordinal_position
    `);
    const materials = await client.query(`
      SELECT
        id,
        title,
        description,
        category,
        subject,
        topic,
        file_type,
        is_active,
        content_source,
        LEFT(COALESCE(content_text, ''), 500) AS content_preview,
        LEFT(COALESCE(content_html, ''), 300) AS html_preview
      FROM materials
      WHERE category = $1
      ORDER BY id
    `, ['cong-thuc-on-thi']);

    process.stdout.write(`${JSON.stringify({
      columns: columns.rows,
      count: materials.rowCount,
      materials: materials.rows,
    }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
