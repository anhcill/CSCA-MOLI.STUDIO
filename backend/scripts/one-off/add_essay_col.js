const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();

  // Thêm cột essay_answer nếu chưa có
  try {
    await client.query(`
      ALTER TABLE user_answers
      ADD COLUMN IF NOT EXISTS essay_answer TEXT;
    `);
    console.log('Added essay_answer column');
  } catch (e) {
    console.log('Column might already exist:', e.message);
  }

  // Verify
  const q = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'user_answers'
    ORDER BY ordinal_position
  `);
  console.log('Current user_answers columns:');
  console.log(JSON.stringify(q.rows, null, 2));

  await client.end();
}
run().catch(console.error);
