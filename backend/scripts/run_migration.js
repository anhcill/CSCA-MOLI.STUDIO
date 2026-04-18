const { Client } = require('pg');

const SQL = `
CREATE TABLE IF NOT EXISTS user_activities (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    metadata        JSONB DEFAULT '{}',
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

COMMENT ON TABLE user_activities IS 'Bảng ghi log hành vi người dùng: đăng nhập, đăng xuất, thi, admin thay đổi...';
COMMENT ON COLUMN user_activities.action IS 'Loại hành vi: login, logout, register, google_login, exam_start, exam_submit, admin.change_user_status, admin.delete_user';
`;

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL');

    await client.query(SQL);
    console.log('✅ Table user_activities created successfully');

    // Verify
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'user_activities'");
    if (result.rows.length > 0) {
      console.log('✅ Verified: user_activities table exists');
    }

    console.log('\n🎉 Migration completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
