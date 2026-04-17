const { pool } = require('./src/config/database');

async function runMigration() {
  try {
    console.log("Updating mock data for Live Exams...");
    await pool.query(`
      UPDATE exams 
      SET 
        start_time = NOW() - INTERVAL '30 minutes',
        end_time = NOW() + INTERVAL '1.5 hours',
        max_participants = 5000
      WHERE id IN (
        SELECT id FROM exams ORDER BY id ASC LIMIT 2
      );
    `);
    
    console.log("Updating mock data for Upcoming Exams...");
    await pool.query(`
      UPDATE exams 
      SET 
        start_time = NOW() + INTERVAL '5 hours',
        end_time = NOW() + INTERVAL '7 hours',
        max_participants = 2000
      WHERE id IN (
        SELECT id FROM exams ORDER BY id ASC OFFSET 2 LIMIT 3
      );
    `);

    console.log("Migration executed successfully!");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    pool.end();
  }
}
runMigration();
