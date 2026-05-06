const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. forum_messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ forum_messages created');

    // 2. forum_blocks
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(blocker_id, blocked_id)
      );
    `);
    console.log('✓ forum_blocks created');

    // 3. forum_reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL CHECK (char_length(reason) > 0),
        status VARCHAR(20) DEFAULT 'pending',
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ forum_reports created');

    // 4. Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON forum_messages(sender_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON forum_messages(receiver_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created ON forum_messages(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON forum_blocks(blocker_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON forum_blocks(blocked_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON forum_reports(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_reported ON forum_reports(reported_user_id);`);
    console.log('✓ indexes created');

    // 5. Notifications: add type for messages
    await client.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS message_id INTEGER REFERENCES forum_messages(id) ON DELETE SET NULL;
    `);
    console.log('✓ notifications.message_id added');

    // 6. Ensure users has bio
    await client.query(`
      ALTER TABLE users
      ALTER COLUMN bio SET DATA TYPE TEXT;
    `);
    console.log('✓ users.bio verified');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
