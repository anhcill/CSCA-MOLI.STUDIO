/**
 * Run missing migrations on Railway PostgreSQL
 * Creates tables that are defined in runOptimizations() but may not exist in DB
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway',
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const results = [];

  async function run(sql, description) {
    try {
      await pool.query(sql);
      results.push({ ok: true, desc: description });
      console.log('✅', description);
    } catch (e) {
      if (e.message.includes('already exists')) {
        results.push({ ok: true, desc: description, note: 'already existed' });
        console.log('⏭️ ', description, '(already exists)');
      } else {
        results.push({ ok: false, desc: description, error: e.message });
        console.error('❌', description, '-', e.message);
      }
    }
  }

  try {
    // 1. user_sessions - for device management
    await run(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jti           VARCHAR(64) UNIQUE NOT NULL,
        device_info   VARCHAR(500),
        ip_address    VARCHAR(45),
        user_agent    TEXT,
        last_active   TIMESTAMPTZ DEFAULT NOW(),
        expires_at    TIMESTAMPTZ NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `, 'user_sessions table');

    await run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, last_active DESC)`, 'idx_user_sessions_user');
    await run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti)`, 'idx_user_sessions_jti');

    // 2. user_otps - for OTP login
    await run(`
      CREATE TABLE IF NOT EXISTS user_otps (
        id              BIGSERIAL PRIMARY KEY,
        user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email           VARCHAR(255) NOT NULL,
        otp_hash        VARCHAR(255) NOT NULL,
        reason          VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
        is_used         BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `, 'user_otps table');

    await run(`CREATE INDEX IF NOT EXISTS idx_user_otps_user ON user_otps(user_id)`, 'idx_user_otps_user');
    await run(`CREATE INDEX IF NOT EXISTS idx_user_otps_email ON user_otps(email, reason)`, 'idx_user_otps_email');
    await run(`CREATE INDEX IF NOT EXISTS idx_user_otps_expires ON user_otps(expires_at)`, 'idx_user_otps_expires');

    // 3. vip_reminder_logs - for VIP expiration reminders
    await run(`
      CREATE TABLE IF NOT EXISTS vip_reminder_logs (
        id              BIGSERIAL PRIMARY KEY,
        user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email           VARCHAR(255) NOT NULL,
        reminder_type   VARCHAR(20) NOT NULL,
        days_before     INTEGER,
        sent_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, 'vip_reminder_logs table');

    await run(`CREATE INDEX IF NOT EXISTS idx_vip_reminder_logs_user ON vip_reminder_logs(user_id, sent_at DESC)`, 'idx_vip_reminder_logs_user');

    // 4. user_sessions.max_devices column on users (if missing)
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1`, 'users.max_devices column');
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name_edit VARCHAR(255)`, 'users.full_name_edit column');
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'basic'`, 'users.subscription_tier column');

    // 5. Seed VIP packages if not exist
    const pkgCount = await pool.query('SELECT COUNT(*)::int FROM vip_packages');
    if (pkgCount.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO vip_packages (name, duration_days, price, description, features, sort_order) VALUES
        ('Gói Xem', 30, 199000, 'Truy cập nội dung lý thuyết và tài liệu VIP trong 30 ngày', ARRAY['Truy cập tài liệu VIP', 'Xem giải đề chi tiết', 'Hỗ trợ ưu tiên'], 1),
        ('Gói Kiểm tra', 180, 499000, 'Truy cập đầy đủ trong 6 tháng - tiết kiệm 56%', ARRAY['Truy cập đề thi premium', 'Giải đề chi tiết', 'Phân tích kết quả nâng cao', 'Hỗ trợ 24/7'], 2),
        ('Gói Làm bài', 365, 799000, 'Gói năm - truy cập toàn diện trong 12 tháng', ARRAY['Tất cả tính năng VIP', 'Thống kê học tập', 'Lộ trình cá nhân hóa', 'Hỗ trợ ưu tiên'], 3)
      `);
      console.log('✅ Seeded VIP packages');
    } else {
      console.log('⏭️ VIP packages already seeded');
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`Passed: ${passed}/${results.length}`);
    if (failed > 0) {
      console.log(`Failed: ${failed}`);
      results.filter(r => !r.ok).forEach(r => console.log(' -', r.desc, ':', r.error));
    }

    // Verify
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('user_sessions','user_otps','vip_reminder_logs')
      ORDER BY table_name
    `);
    console.log('\n=== VERIFICATION ===');
    console.log('Tables created:');
    tables.rows.forEach(r => console.log(' ✅', r.table_name));

    if (tables.rows.length < 3) {
      console.log('⚠️  Some tables still missing!');
    }

  } catch (e) {
    console.error('Fatal error:', e.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
