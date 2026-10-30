const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const APPLY = process.argv.includes("--apply");
const MATCH_SQL = `
  FROM questions q
  JOIN exams e ON e.id = q.exam_id
  LEFT JOIN subjects s ON s.id = e.subject_id
  CROSS JOIN LATERAL (
    VALUES (q.question_text), (q.question_text_cn), (q.question_text_en)
  ) value(text)
  WHERE q.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND q.question_type IN ('single_choice', 'reading_item')
    AND value.text IS NOT NULL
    AND (
      value.text ~ '[(][[:space:] ]*[)][[:space:] ]*$'
      OR value.text ~ '（[[:space:] ]*）[[:space:] ]*$'
    )
`;

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!connectionString) throw new Error("DATABASE_URL or DATABASE_PUBLIC_URL is required");

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const before = await client.query(`
      SELECT
        s.name AS subject,
        CASE
          WHEN e.is_premium OR COALESCE(NULLIF(lower(e.vip_tier), ''), 'basic') != 'basic'
            THEN COALESCE(NULLIF(lower(e.vip_tier), ''), 'vip')
          ELSE 'basic'
        END AS tier,
        COUNT(DISTINCT q.id)::int AS questions,
        COUNT(*)::int AS fields
      ${MATCH_SQL}
      GROUP BY s.name, tier
      ORDER BY s.name, tier
    `);

    const migrationPath = path.resolve(
      __dirname,
      "../../../database/migrations/071_remove_trailing_empty_question_markers.sql",
    );
    const updated = await client.query(fs.readFileSync(migrationPath, "utf8"));
    const after = await client.query(`
      SELECT COUNT(DISTINCT q.id)::int AS questions, COUNT(*)::int AS fields
      ${MATCH_SQL}
    `);

    if (after.rows[0].questions !== 0 || after.rows[0].fields !== 0) {
      throw new Error(`Cleanup verification failed: ${JSON.stringify(after.rows[0])}`);
    }

    if (APPLY) await client.query("COMMIT");
    else await client.query("ROLLBACK");

    console.log(JSON.stringify({
      mode: APPLY ? "applied" : "dry-run",
      updatedQuestions: updated.rowCount,
      before: before.rows,
      after: after.rows[0],
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
