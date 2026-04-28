/**
 * VIP Expiration Reminder Cron Script
 * Chạy mỗi ngày (nên chạy vào lúc 8h sáng)
 *
 * Cách chạy:
 *   1. Chạy thủ công: node scripts/vip_expiration_reminder.js
 *   2. Tự động (Railway/Heroku): thêm cron job trong Railway
 *      - Schedule: "0 1 * * *" (chạy 1h sáng mỗi ngày, giờ UTC = 8h VN)
 *      - Command: node scripts/vip_expiration_reminder.js
 *   3. Hoặc dùng node-cron: npm install node-cron
 *      - Xem file: scripts/vip_expiration_cron.js
 */
require('dotenv').config();
const db = require('../src/config/database');
const emailService = require('../src/services/emailService');

async function sendExpirationReminders() {
  const DAYS_BEFORE = [3, 2, 1]; // Nhắc trước 3, 2, 1 ngày

  console.log(`[VIP Reminder] Bắt đầu gửi email nhắc hết hạn VIP...`);

  let totalSent = 0;
  let totalFailed = 0;

  for (const days of DAYS_BEFORE) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);

    // Tìm users sắp hết hạn trong ngày đó (chưa nhắn)
    const result = await db.query(`
      SELECT u.id, u.email, u.full_name, u.username, u.vip_expires_at,
             t.package_name, t.package_duration
      FROM users u
      LEFT JOIN LATERAL (
        SELECT package_name, package_duration
        FROM transactions
        WHERE user_id = u.id AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 1
      ) t ON TRUE
      WHERE u.is_vip = TRUE
        AND u.vip_expires_at IS NOT NULL
        AND u.vip_expires_at >= $1
        AND u.vip_expires_at <= $2
        AND NOT EXISTS (
          SELECT 1 FROM vip_reminder_logs l
          WHERE l.user_id = u.id AND l.days_before = $3
        )
    `, [targetStart, targetEnd, days]);

    if (result.rows.length === 0) {
      console.log(`[VIP Reminder] Không có user nào hết hạn trong ${days} ngày.`);
      continue;
    }

    console.log(`[VIP Reminder] Gửi nhắc ${days} ngày cho ${result.rows.length} user...`);

    for (const user of result.rows) {
      const name = user.full_name || user.username || 'bạn';
      const expiresAt = user.vip_expires_at;

      try {
        await emailService.sendVipExpirationReminder({
          email: user.email,
          name,
          daysLeft: days,
          expiresAt,
        });

        // Ghi log đã gửi để tránh gửi trùng
        await db.query(`
          INSERT INTO vip_reminder_logs (user_id, days_before, expires_at, sent_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING
        `, [user.id, days, expiresAt]);

        totalSent++;
        console.log(`  ✅ Đã gửi: ${user.email} (${days} ngày)`);
      } catch (err) {
        totalFailed++;
        console.error(`  ❌ Lỗi gửi cho ${user.email}: ${err.message}`);
      }

      // Delay nhẹ để tránh spam Brevo API
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Cleanup old logs (giữ lại 60 ngày)
  await db.query(`
    DELETE FROM vip_reminder_logs
    WHERE sent_at < NOW() - INTERVAL '60 days'
  `).catch(() => {}); // non-blocking

  console.log(`[VIP Reminder] Hoàn thành: ${totalSent} gửi thành công, ${totalFailed} thất bại.`);
}

sendExpirationReminders()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[VIP Reminder] Lỗi nghiêm trọng:', err);
    process.exit(1);
  });
