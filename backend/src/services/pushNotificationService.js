const webpush = require("web-push");
const db = require("../config/database");

let configured = false;

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || "mailto:support@moli.studio";
  return { publicKey, privateKey, subject };
}

function configureWebPush() {
  if (configured) return true;
  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function isPushConfigured() {
  const { publicKey, privateKey } = getVapidConfig();
  return Boolean(publicKey && privateKey);
}

function getPublicKey() {
  return getVapidConfig().publicKey;
}

async function saveSubscription(userId, subscription, userAgent = "") {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    const error = new Error("Push subscription không hợp lệ");
    error.status = 400;
    throw error;
  }

  const result = await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, is_active, updated_at, last_error)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NULL)
     ON CONFLICT (endpoint) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         is_active = TRUE,
         updated_at = NOW(),
         last_error = NULL
     RETURNING id`,
    [userId, endpoint, p256dh, auth, userAgent],
  );

  return result.rows[0];
}

async function disableSubscription(userId, endpoint) {
  if (!endpoint) return;
  await db.query(
    `UPDATE push_subscriptions
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint],
  );
}

async function getUserStatus(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS active_count
     FROM push_subscriptions
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId],
  );
  return {
    configured: isPushConfigured(),
    publicKey: getPublicKey(),
    activeCount: result.rows[0]?.active_count || 0,
  };
}

async function sendToUser(userId, payload) {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: true, message: "VAPID chưa cấu hình" };
  }

  const result = await db.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId],
  );

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload || {});

  for (const row of result.rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, body);
      sent += 1;
      await db.query(
        `UPDATE push_subscriptions
         SET last_sent_at = NOW(), last_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    } catch (error) {
      failed += 1;
      const shouldDisable = error?.statusCode === 404 || error?.statusCode === 410;
      await db.query(
        `UPDATE push_subscriptions
         SET is_active = CASE WHEN $2 THEN FALSE ELSE is_active END,
             last_error = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, shouldDisable, String(error?.message || error).slice(0, 500)],
      );
    }
  }

  return { sent, failed, skipped: false };
}

async function sendStudyReminder(userId, options = {}) {
  return sendToUser(userId, {
    title: options.title || "Đến giờ ôn CSCA",
    body: options.body || "Làm vài câu hôm nay để giữ nhịp học nhé.",
    url: options.url || "/exam-room",
    tag: options.tag || "study-reminder",
  });
}

async function sendExamReminder(userId, exam = {}) {
  const title = exam.title ? `Sắp đến giờ thi: ${exam.title}` : "Sắp đến giờ thi";
  return sendToUser(userId, {
    title,
    body: exam.startsAt ? `Lịch thi bắt đầu lúc ${exam.startsAt}.` : "Mở app để kiểm tra lịch thi.",
    url: exam.url || (exam.id ? `/exam/${exam.id}` : "/exam-room"),
    tag: exam.id ? `exam-reminder-${exam.id}` : "exam-reminder",
  });
}

async function wasReminderSent(userId, reminderKey) {
  const result = await db.query(
    `SELECT 1 FROM push_reminder_logs WHERE user_id = $1 AND reminder_key = $2 LIMIT 1`,
    [userId, reminderKey],
  );
  return result.rows.length > 0;
}

async function markReminderSent(userId, reminderKey) {
  await db.query(
    `INSERT INTO push_reminder_logs (user_id, reminder_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id, reminder_key) DO NOTHING`,
    [userId, reminderKey],
  );
}

async function sendStudyReminders(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
  const dateKey = options.dateKey || new Date().toISOString().slice(0, 10);
  const reminderKey = `study:${dateKey}`;

  const result = await db.query(
    `SELECT DISTINCT ps.user_id
     FROM push_subscriptions ps
     INNER JOIN users u ON u.id = ps.user_id
     WHERE ps.is_active = TRUE
       AND COALESCE(u.is_active, TRUE) = TRUE
     ORDER BY ps.user_id
     LIMIT $1`,
    [limit],
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of result.rows) {
    if (await wasReminderSent(row.user_id, reminderKey)) {
      skipped += 1;
      continue;
    }
    const delivery = await sendStudyReminder(row.user_id, options);
    sent += delivery.sent || 0;
    failed += delivery.failed || 0;
    if ((delivery.sent || 0) > 0) {
      await markReminderSent(row.user_id, reminderKey);
    }
  }

  return { users: result.rows.length, sent, failed, skipped, reminderKey };
}

async function sendUpcomingExamReminders(options = {}) {
  const windowMinutes = Math.min(Math.max(Number(options.windowMinutes) || 60, 5), 24 * 60);
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);

  const result = await db.query(
    `SELECT DISTINCT er.user_id, e.id AS exam_id, e.title, e.start_time
     FROM exam_registrations er
     INNER JOIN exams e ON e.id = er.exam_id
     INNER JOIN users u ON u.id = er.user_id
     INNER JOIN push_subscriptions ps ON ps.user_id = er.user_id AND ps.is_active = TRUE
     WHERE er.status IN ('registered', 'approved', 'checked_in')
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND e.deleted_at IS NULL
       AND e.start_time IS NOT NULL
       AND e.start_time > NOW()
       AND e.start_time <= NOW() + ($1::int * INTERVAL '1 minute')
     ORDER BY e.start_time ASC
     LIMIT $2`,
    [windowMinutes, limit],
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of result.rows) {
    const reminderKey = `exam:${row.exam_id}:before:${windowMinutes}m`;
    if (await wasReminderSent(row.user_id, reminderKey)) {
      skipped += 1;
      continue;
    }

    const delivery = await sendExamReminder(row.user_id, {
      id: row.exam_id,
      title: row.title,
      startsAt: row.start_time ? new Date(row.start_time).toLocaleString("vi-VN") : null,
      url: `/exam/${row.exam_id}`,
    });
    sent += delivery.sent || 0;
    failed += delivery.failed || 0;
    if ((delivery.sent || 0) > 0) {
      await markReminderSent(row.user_id, reminderKey);
    }
  }

  return { users: result.rows.length, sent, failed, skipped, windowMinutes };
}

module.exports = {
  getPublicKey,
  getUserStatus,
  saveSubscription,
  disableSubscription,
  sendToUser,
  sendStudyReminder,
  sendExamReminder,
  sendStudyReminders,
  sendUpcomingExamReminders,
  isPushConfigured,
};
