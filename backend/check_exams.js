const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const exams = await pool.query(`
    SELECT e.id, e.title, e.status, e.subject_id, s.slug as subject_slug, s.name as subject_name
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    ORDER BY e.id
  `);
  console.log('=== EXAMS ===');
  console.log(JSON.stringify(exams.rows, null, 2));

  const vipExams = await pool.query(`
    SELECT e.id, e.title, e.status, e.subject_id, e.is_premium, s.slug as subject_slug, s.name as subject_name
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    WHERE e.is_premium = TRUE
    ORDER BY e.id
  `);
  console.log('\n=== PREMIUM EXAMS ===');
  console.log(JSON.stringify(vipExams.rows, null, 2));

  await pool.end();
}

check();
