const { Client } = require('pg');
const client = new Client('postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway');

async function run() {
  await client.connect();

  // 1. Questions table schema
  const q = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'questions'
    ORDER BY ordinal_position
  `);
  console.log('=== QUESTIONS TABLE ===');
  console.log(JSON.stringify(q.rows, null, 2));

  // 2. Answers table schema
  const a = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'answers'
    ORDER BY ordinal_position
  `);
  console.log('\n=== ANSWERS TABLE ===');
  console.log(JSON.stringify(a.rows, null, 2));

  // 3. User_answers table schema
  const ua = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_answers'
    ORDER BY ordinal_position
  `);
  console.log('\n=== USER_ANSWERS TABLE ===');
  console.log(JSON.stringify(ua.rows, null, 2));

  // 4. Sample essay question if any
  const essay = await client.query(`SELECT * FROM questions WHERE question_type = 'essay' LIMIT 1`);
  console.log('\n=== SAMPLE ESSAY ===');
  console.log(JSON.stringify(essay.rows[0], null, 2));

  // 5. Check all question types available
  const types = await client.query(`SELECT DISTINCT question_type FROM questions`);
  console.log('\n=== ALL QUESTION TYPES ===');
  console.log(JSON.stringify(types.rows, null, 2));

  await client.end();
}
run().catch(console.error);
