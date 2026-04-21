const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway',
  ssl: { rejectUnauthorized: false },
});

const migrationPath = 'c:\\Users\\anhci\\Downloads\\Web tiếng trung\\database\\migrations\\m002_learning_insights.sql';

async function run() {
  try {
    console.log('🔌 Kết nối Railway database...');
    await client.connect();
    console.log('✅ Kết nối thành công!');

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Đang chạy migration...');
    await client.query(sql);
    console.log('✅ Migration hoàn tất!');

    // Verify tables created
    console.log('\n📋 Kiểm tra các bảng đã tạo:');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'user_learning_insights',
          'user_learning_patterns',
          'user_study_plans',
          'user_recommended_exams',
          'daily_learning_summaries'
        )
      ORDER BY table_name
    `);

    if (result.rows.length === 0) {
      console.log('❌ Chưa tạo được bảng nào');
    } else {
      console.log(`✅ Tìm thấy ${result.rows.length} bảng:`);
      result.rows.forEach(r => console.log(`   - ${r.table_name}`));
    }

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Đã đóng kết nối');
  }
}

run();
