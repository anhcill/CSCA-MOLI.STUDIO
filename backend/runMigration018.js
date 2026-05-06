/**
 * Run VIP migration 018 (v3): update existing vip_packages + seed features
 * Usage: node backend/runMigration018.js
 */

const { Client } = require('pg');
const pool = new Client({ connectionString: 'postgresql://postgres:yREnxOwrFSmIQCSdRDghFjAcSFAhoorK@nozomi.proxy.rlwy.net:47269/railway' });

async function run() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 018 (v3): update vip_packages...\n');

    // 1. Add tier column to existing vip_packages table
    try {
      await client.query(`ALTER TABLE vip_packages ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'vip';`);
      console.log('✅ Added tier column to vip_packages');
    } catch (e) { /* column may already exist */ }

    // 2. Update existing packages: set tier appropriately
    await client.query(`UPDATE vip_packages SET tier = 'vip' WHERE id IN (1, 2);`);
    await client.query(`UPDATE vip_packages SET tier = 'premium' WHERE id = 3;`);
    console.log('✅ Updated tier for existing packages (id 1,2 → vip; id 3 → premium)');

    // 3. Insert additional packages (only if they don't exist)
    const additionalPackages = [
      {
        name: 'VIP 90 ngày',
        tier: 'vip',
        duration_days: 90,
        price: 499000,
        description: 'Tiết kiệm 17% so với mua lẻ — đủ thời gian ôn tập toàn diện',
        features: ["Truy cập tất cả đề thi VIP", "AI phân tích kết quả bài thi", "Lịch sử thi không giới hạn", "Phân tích theo chủ đề", "Gợi ý đề tiếp theo phù hợp", "Hỗ trợ ưu tiên qua email"],
        sort_order: 2,
      },
      {
        name: 'VIP 365 ngày',
        tier: 'vip',
        duration_days: 365,
        price: 1499000,
        description: 'Gói năm — cam kết học tập dài hạn, tiết kiệm tối đa',
        features: ["Truy cập tất cả đề thi VIP", "AI phân tích kết quả bài thi", "Lịch sử thi không giới hạn", "Phân tích theo chủ đề", "Gợi ý đề tiếp theo phù hợp", "Hỗ trợ ưu tiên qua email", "Báo cáo tiến bộ hàng tháng"],
        sort_order: 3,
      },
      {
        name: 'Pre 90 ngày',
        tier: 'premium',
        duration_days: 90,
        price: 999000,
        description: 'Tiết kiệm 17% — đủ thời gian học chuyên sâu',
        features: ["Tất cả tính năng VIP", "Video giải đề chi tiết từng câu", "Đội ngũ cố vấn hỗ trợ 1-1", "Phân tích AI nâng cao", "Lộ trình học cá nhân hóa", "Workshop hàng tuần"],
        sort_order: 11,
      },
      {
        name: 'Pre 365 ngày',
        tier: 'premium',
        duration_days: 365,
        price: 2999000,
        description: 'Gói năm Premium — trải nghiệm đầy đủ nhất, tiết kiệm tối đa',
        features: ["Tất cả tính năng Premium", "Video giải đề chi tiết từng câu", "Đội ngũ cố vấn hỗ trợ 1-1", "Phân tích AI nâng cao", "Lộ trình học cá nhân hóa", "Workshop hàng tuần", "Báo cáo tiến bộ hàng tháng", "Ưu tiên truy cập đề mới"],
        sort_order: 12,
      },
    ];

    for (const pkg of additionalPackages) {
      try {
        await client.query(
          `INSERT INTO vip_packages (name, tier, duration_days, price, description, features, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [pkg.name, pkg.tier, pkg.duration_days, pkg.price, pkg.description, pkg.features, pkg.sort_order]
        );
        console.log(`  ✅ Inserted: ${pkg.name}`);
      } catch (e) {
        if (e.code === '23505') console.log(`  ⏭️  Skipped (already exists): ${pkg.name}`);
        else throw e;
      }
    }

    // 4. Seed vip_features_comparison (wipe + re-insert)
    await client.query(`DELETE FROM vip_features_comparison;`);
    console.log('✅ Cleared vip_features_comparison');

    const features = [
      { feature_name: 'Đề thi cơ bản', basic_has: true, vip_has: true, premium_has: true, sort_order: 1 },
      { feature_name: 'Đề thi VIP/Premium', basic_has: false, vip_has: true, premium_has: true, sort_order: 2 },
      { feature_name: 'AI phân tích kết quả', basic_has: false, vip_has: true, premium_has: true, sort_order: 3 },
      { feature_name: 'Lịch sử thi chi tiết', basic_has: false, vip_has: true, premium_has: true, sort_order: 4 },
      { feature_name: 'Phân tích theo chủ đề', basic_has: false, vip_has: true, premium_has: true, sort_order: 5 },
      { feature_name: 'Gợi ý đề tiếp theo', basic_has: false, vip_has: true, premium_has: true, sort_order: 6 },
      { feature_name: 'Video giải đề', basic_has: false, vip_has: false, premium_has: true, sort_order: 7 },
      { feature_name: 'Cố vấn 1-1', basic_has: false, vip_has: false, premium_has: true, sort_order: 8 },
      { feature_name: 'Lộ trình cá nhân hóa', basic_has: false, vip_has: false, premium_has: true, sort_order: 9 },
      { feature_name: 'Workshop hàng tuần', basic_has: false, vip_has: false, premium_has: true, sort_order: 10 },
      { feature_name: 'Báo cáo tháng', basic_has: false, vip_has: true, premium_has: true, sort_order: 11 },
      { feature_name: 'Hỗ trợ ưu tiên', basic_has: false, vip_has: true, premium_has: true, sort_order: 12 },
    ];

    for (const feat of features) {
      await client.query(
        `INSERT INTO vip_features_comparison (feature_name, basic_has, vip_has, premium_has, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [feat.feature_name, feat.basic_has, feat.vip_has, feat.premium_has, feat.sort_order]
      );
    }
    console.log(`✅ Inserted ${features.length} comparison features`);

    // 5. Verify
    const final = await client.query(`SELECT id, name, tier, duration_days, price, is_active FROM vip_packages ORDER BY sort_order, id`);
    console.log('\n=== Final vip_packages ===');
    console.table(final.rows);

    console.log('\n✅ Migration 018 (v3) completed!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
