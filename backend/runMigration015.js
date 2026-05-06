const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway'
});

async function migrate() {
  await client.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '../database/migrations/015_exam_question_types.sql'),
    'utf8'
  );

  try {
    await client.query(sql);
    console.log('✅ Migration 015 chạy thành công');
  } catch (err) {
    console.error('❌ Migration lỗi:', err.message);
  }

  // Verify
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'questions'
      AND column_name IN ('linked_options', 'sub_question_number')
    ORDER BY column_name
  `);
  console.table(res.rows);
  await client.end();
}

migrate().catch(console.error);
