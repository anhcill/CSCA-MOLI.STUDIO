const db = require("./src/config/database");

async function main() {
  try {
    await db.query(`
      ALTER TABLE forum_messages
      ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES forum_messages(id) ON DELETE SET NULL;
    `);
    console.log("Migration added is_recalled and reply_to_id successfully.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
main();