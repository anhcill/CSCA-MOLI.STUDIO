const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway'
});

async function migrate() {
  await client.connect();

  const sqlFiles = [
    '../database/migrations/015_exam_question_types.sql',
    '../database/migrations/016_question_types_v2.sql',
  ];

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    try {
      await client.query(sql);
      console.log(`✅ ${path.basename(file)}`);
    } catch (err) {
      if (err.code === '42710' || err.code === '23505' || err.message.includes('duplicate')) {
        console.log(`⚠️  ${path.basename(file)} - đã có, bỏ qua`);
      } else {
        console.error(`❌ ${path.basename(file)}: ${err.message}`);
      }
    }
  }

  // Verify
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'questions'
      AND column_name IN ('linked_options', 'sub_question_number', 'question_type')
    ORDER BY column_name
  `);
  console.log('\n📋 Bảng questions (relevant columns):');
  console.table(res.rows);

  await client.end();
}

migrate().catch(console.error);
