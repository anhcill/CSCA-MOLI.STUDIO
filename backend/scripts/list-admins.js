require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(
  "SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE role = 'admin' ORDER BY created_at DESC LIMIT 10"
)
  .then(r => {
    console.log("Admin users found:", r.rows.length);
    console.log(JSON.stringify(r.rows, null, 2));
    pool.end();
  })
  .catch(e => {
    console.error("Error:", e.message);
    pool.end();
  });
