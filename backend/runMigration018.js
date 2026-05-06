/**
 * Run VIP migration: create vip_packages + vip_features_comparison tables
 * and seed with default data (VIP + Premium plans only)
 *
 * Usage: node runMigration018.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 018: vip_packages + vip_features_comparison...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS vip_packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        tier VARCHAR(20) NOT NULL DEFAULT 'vip',
        duration_days INTEGER NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        features TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ vip_packages table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS vip_features_comparison (
        id SERIAL PRIMARY KEY,
        feature_name VARCHAR(255) NOT NULL,
        basic_has BOOLEAN DEFAULT false,
        vip_has BOOLEAN DEFAULT false,
        premium_has BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ vip_features_comparison table created');

    // ── Seed vip_packages ──────────────────────────────────────────
    // Delete existing and insert fresh (2 plans only: VIP + Premium)
    await client.query(`DELETE FROM vip_packages;`);

    const vipPackages = [
      {
        name: 'Gói VIP 30 ngày',
        tier: 'vip',
        duration_days: 30,
        price: 199000,
        description: 'Truy cập toàn bộ đề thi VIP, phân tích AI, lịch sử thi chi tiết',
        features: JSON.stringify([
          'Truy cập tất cả đề thi VIP',
          'AI phân tích kết quả bài thi',
          'Lịch sử thi không giới hạn',
          'Phân tích theo chủ đề',
          'Gợi ý đề tiếp theo phù hợp',
        ]),
        sort_order: 1,
      },
      {
        name: 'Gói VIP 90 ngày',
        tier: 'vip',
        duration_days: 90,
        price: 499000,
        description: 'Tiết kiệm 17% so với mua lẻ — đủ thời gian ôn tập toàn diện',
        features: JSON.stringify([
          'Truy cập tất cả đề thi VIP',
          'AI phân tích kết quả bài thi',
          'Lịch sử thi không giới hạn',
          'Phân tích theo chủ đề',
          'Gợi ý đề tiếp theo phù hợp',
          'Hỗ trợ ưu tiên qua email',
        ]),
        sort_order: 2,
      },
      {
        name: 'Gói VIP 365 ngày',
        tier: 'vip',
        duration_days: 365,
        price: 1499000,
        description: 'Gói năm — cam kết học tập dài hạn, tiết kiệm tối đa',
        features: JSON.stringify([
          'Truy cập tất cả đề thi VIP',
          'AI phân tích kết quả bài thi',
          'Lịch sử thi không giới hạn',
          'Phân tích theo chủ đề',
          'Gợi ý đề tiếp theo phù hợp',
          'Hỗ trợ ưu tiên qua email',
          'Báo cáo tiến bộ hàng tháng',
        ]),
        sort_order: 3,
      },
      {
        name: 'Gói Premium 30 ngày',
        tier: 'premium',
        duration_days: 30,
        price: 399000,
        description: 'Bao gồm video giải đề + đội ngũ cố vấn hỗ trợ 1-1',
        features: JSON.stringify([
          'Tất cả tính năng VIP',
          'Video giải đề chi tiết từng câu',
          'Đội ngũ cố vấn hỗ trợ 1-1',
          'Phân tích AI nâng cao',
          'Lộ trình học cá nhân hóa',
        ]),
        sort_order: 10,
      },
      {
        name: 'Gói Premium 90 ngày',
        tier: 'premium',
        duration_days: 90,
        price: 999000,
        description: 'Tiết kiệm 17% — đủ thời gian học chuyên sâu',
        features: JSON.stringify([
          'Tất cả tính năng VIP',
          'Video giải đề chi tiết từng câu',
          'Đội ngũ cố vấn hỗ trợ 1-1',
          'Phân tích AI nâng cao',
          'Lộ trình học cá nhân hóa',
          'Workshop hàng tuần',
        ]),
        sort_order: 11,
      },
      {
        name: 'Gói Premium 365 ngày',
        tier: 'premium',
        duration_days: 365,
        price: 2999000,
        description: 'Gói năm Premium — trải nghiệm đầy đủ nhất, tiết kiệm tối đa',
        features: JSON.stringify([
          'Tất cả tính năng Premium',
          'Video giải đề chi tiết từng câu',
          'Đội ngũ cố vấn hỗ trợ 1-1',
          'Phân tích AI nâng cao',
          'Lộ trình học cá nhân hóa',
          'Workshop hàng tuần',
          'Báo cáo tiến bộ hàng tháng',
          'Ưu tiên truy cập đề mới',
        ]),
        sort_order: 12,
      },
    ];

    for (const pkg of vipPackages) {
      await client.query(
        `INSERT INTO vip_packages (name, tier, duration_days, price, description, features, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pkg.name, pkg.tier, pkg.duration_days, pkg.price, pkg.description, pkg.features, pkg.sort_order]
      );
      console.log(`  ✅ Inserted: ${pkg.name} (${pkg.tier})`);
    }

    // ── Seed vip_features_comparison ──────────────────────────────
    await client.query(`DELETE FROM vip_features_comparison;`);

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
    console.log(`  ✅ Inserted ${features.length} comparison features`);

    console.log('\n✅ Migration 018 completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
