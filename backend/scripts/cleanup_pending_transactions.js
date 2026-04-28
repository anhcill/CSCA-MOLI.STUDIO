/**
 * Cleanup Stale Pending Transactions
 * Chạy mỗi giờ (recommended) hoặc mỗi ngày
 *
 * Xóa các transactions ở trạng thái 'pending' quá 24 giờ.
 * Coupon usage đã được rollback khi payment thất bại — chỉ cleanup transaction record.
 *
 * Cách chạy:
 *   1. Thủ công: node scripts/cleanup_pending_transactions.js
 *   2. Railway/Heroku: thêm cron job trong dashboard
 *      - Schedule: "0 * * * *" (mỗi giờ, giờ UTC)
 *      - Command: node scripts/cleanup_pending_transactions.js
 */
require('dotenv').config();
const db = require('../src/config/database');

const PENDING_THRESHOLD_HOURS = 24;

async function cleanupStalePendingTransactions() {
  console.log(`[Cleanup] Bắt đầu dọn pending transactions cũ hơn ${PENDING_THRESHOLD_HOURS} giờ...`);

  // Lấy số lượng trước khi xóa
  const countResult = await db.query(`
    SELECT COUNT(*) as count FROM transactions
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '${PENDING_THRESHOLD_HOURS} hours'
  `);
  const staleCount = parseInt(countResult.rows[0].count);

  if (staleCount === 0) {
    console.log('[Cleanup] Không có pending transaction nào cần dọn.');
    return { deleted: 0 };
  }

  // Lấy chi tiết trước khi xóa (để log)
  const staleTx = await db.query(`
    SELECT id, transaction_code, user_id, package_name, amount, created_at,
           NOW() - created_at as age
    FROM transactions
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '${PENDING_THRESHOLD_HOURS} hours'
    ORDER BY created_at ASC
    LIMIT 10
  `);

  console.log(`[Cleanup] Tìm thấy ${staleCount} pending transaction cần xóa. Chi tiết (top 10):`);
  for (const tx of staleTx.rows) {
    const ageHours = Math.round((Date.now() - new Date(tx.created_at).getTime()) / 3600000);
    console.log(`  - [${tx.id}] ${tx.transaction_code} | ${tx.package_name} | ${tx.amount.toLocaleString('vi-VN')}đ | User#${tx.user_id} | ${ageHours}h trước`);
  }

  // Xóa
  const deleteResult = await db.query(`
    DELETE FROM transactions
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '${PENDING_THRESHOLD_HOURS} hours'
    RETURNING id, transaction_code
  `);

  console.log(`[Cleanup] ✅ Đã xóa ${deleteResult.rowCount} pending transaction.`);
  return { deleted: deleteResult.rowCount };
}

cleanupStalePendingTransactions()
  .then(({ deleted }) => {
    if (deleted > 0) {
      console.log(`[Cleanup] Hoàn thành: đã xóa ${deleted} records.`);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('[Cleanup] Lỗi nghiêm trọng:', err);
    process.exit(1);
  });
