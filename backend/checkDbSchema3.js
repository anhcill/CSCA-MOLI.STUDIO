const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function check() {
  await client.connect();

  console.log('\n=== EXAMS TABLE COLUMNS ===');
  const exams = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'exams'
    ORDER BY ordinal_position
  `);
  console.table(exams.rows);

  console.log('\n=== QUESTIONS TABLE COLUMNS ===');
  const questions = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'questions'
    ORDER BY ordinal_position
  `);
  console.table(questions.rows);

  console.log('\n=== ANSWERS TABLE COLUMNS ===');
  const answers = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'answers'
    ORDER BY ordinal_position
  `);
  console.table(answers.rows);

  console.log('\n=== SUBJECTS TABLE COLUMNS ===');
  const subjects = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'subjects'
    ORDER BY ordinal_position
  `);
  console.table(subjects.rows);

  console.log('\n=== SUBJECTS SAMPLE DATA ===');
  const subjData = await client.query('SELECT id, name, code FROM subjects LIMIT 10');
  console.table(subjData.rows);

  await client.end();
}
check().catch(console.error);
