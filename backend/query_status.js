const { pool } = require('./src/config/database');

async function run() {
  try {
    const res = await pool.query('SELECT DISTINCT status FROM exams;');
    console.log("EXAMS STATUS:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
