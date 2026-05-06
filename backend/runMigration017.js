const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway'
});

async function migrate() {
  await client.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '../database/migrations/017_passage_group_id.sql'),
    'utf8'
  );

  try {
    await client.query(sql);
    console.log('✅ Migration 017 chạy thành công');
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log('⚠️  Migration 017 đã có, bỏ qua');
    } else {
      console.error('❌ Lỗi:', err.message);
    }
  }

  // Verify
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'questions'
      AND column_name = 'passage_group_id'
  `);
  console.log(res.rows[0] ? `✅ passage_group_id: ${res.rows[0].data_type}` : '❌ chưa có');

  await client.end();
}

migrate().catch(console.error);
