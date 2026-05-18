const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
const { pool } = require('../../backend/src/config/database');
async function run() {
  const res1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='post_comments'");
  console.log('post_comments columns:', res1.rows.map(r => r.column_name));
  const res2 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name='comment_likes'");
  console.log('comment_likes table exists:', res2.rows.length > 0);
  process.exit(0);
}
run();
