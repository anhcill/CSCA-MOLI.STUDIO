const { Client } = require('pg');
const pool = new Client({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function run() {
  const client = await pool.connect();
  try {
    // Step 1: Drop FK temporarily
    await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_package_id_fkey`);
    console.log('✅ Đã drop FK constraint');

    // Step 2: Xóa tất cả gói cũ
    await client.query(`DELETE FROM vip_packages`);
    console.log('✅ Đã xóa toàn bộ vip_packages');

    // Step 3: Insert chỉ 2 gói
    await client.query(`
      INSERT INTO vip_packages (name, tier, duration_days, price, description, features, sort_order, is_active)
      VALUES
        ('Gói VIP', 'vip', 365, 1499000,
         'Truy cập toàn bộ đề thi VIP, AI phân tích kết quả, lịch sử thi chi tiết',
         ARRAY['Truy cập tất cả đề thi VIP','AI phân tích kết quả bài thi','Lịch sử thi không giới hạn','Phân tích theo chủ đề','Gợi ý đề tiếp theo phù hợp','Hỗ trợ ưu tiên qua email','Báo cáo tiến bộ hàng tháng'],
         1, true),
        ('Gói Premium', 'premium', 365, 2999000,
         'Bao gồm video giải đề + đội ngũ cố vấn hỗ trợ 1-1',
         ARRAY['Tất cả tính năng VIP','Video giải đề chi tiết từng câu','Đội ngũ cố vấn hỗ trợ 1-1','Phân tích AI nâng cao','Lộ trình học cá nhân hóa','Workshop hàng tuần','Báo cáo tiến bộ hàng tháng','Ưu tiên truy cập đề mới'],
         2, true)
    `);
    console.log('✅ Đã tạo 2 gói mới');

    // Step 4: Update transactions to NULL
    await client.query(`UPDATE transactions SET package_id = NULL`);
    console.log('✅ Đã set null package_id trong transactions');

    // Step 5: Restore FK
    await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_package_id_fkey FOREIGN KEY (package_id) REFERENCES vip_packages(id) ON DELETE SET NULL`);
    console.log('✅ Đã restore FK constraint');

    const r = await client.query(`SELECT id, name, tier, price, is_active FROM vip_packages ORDER BY id`);
    console.log('\n=== Kết quả cuối ===');
    console.table(r.rows);
    console.log('\n✅ Xong 2 gói: VIP + Premium!');
  } finally {
    await pool.end();
  }
}

run().catch(console.error);
