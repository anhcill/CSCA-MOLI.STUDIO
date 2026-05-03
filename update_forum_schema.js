const {pool} = require('./backend/src/config/database');
async function run() {
  try {
    await pool.query(`
      ALTER TABLE post_comments 
      ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES post_comments(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS reply_to_user_id INT REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log('Added parent_id and reply_to_user_id to post_comments');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
          id SERIAL PRIMARY KEY,
          comment_id INT NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(comment_id, user_id)
      );
    `);
    console.log('Created comment_likes table');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
