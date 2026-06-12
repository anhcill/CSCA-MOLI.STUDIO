const Notification = require("../models/Notification");
const pushNotificationService = require("../services/pushNotificationService");

function assertCronSecret(req) {
  const expected = process.env.NOTIFICATION_CRON_SECRET || process.env.CRON_SECRET || "";
  const provided = req.get("x-cron-secret") || req.body?.secret || req.query?.secret || "";
  if (!expected) {
    const error = new Error("Chưa cấu hình NOTIFICATION_CRON_SECRET");
    error.status = 503;
    throw error;
  }
  if (provided !== expected) {
    const error = new Error("Không có quyền chạy lịch nhắc");
    error.status = 401;
    throw error;
  }
}

/** GET /api/notifications?limit=30&offset=0 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    const [notifications, unreadCount] = await Promise.all([
      Notification.getForUser(userId, limit, offset),
      Notification.countUnread(userId),
    ]);

    res.json({ success: true, data: notifications, unread_count: unreadCount });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tải thông báo" });
  }
};

/** GET /api/notifications/unread-count */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countUnread(req.user.id);
    res.json({ success: true, unread_count: count });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/** PATCH /api/notifications/:id/read */
exports.markRead = async (req, res) => {
  try {
    await Notification.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/** PATCH /api/notifications/read-all */
exports.markAllRead = async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.getPushStatus = async (req, res) => {
  try {
    const status = await pushNotificationService.getUserStatus(req.user.id);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error("getPushStatus error:", error);
    res.status(500).json({ success: false, message: "Không thể tải trạng thái thông báo" });
  }
};

exports.savePushSubscription = async (req, res) => {
  try {
    if (!pushNotificationService.isPushConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Thông báo đẩy chưa được cấu hình VAPID trên server",
      });
    }

    const saved = await pushNotificationService.saveSubscription(
      req.user.id,
      req.body?.subscription,
      req.get("user-agent") || "",
    );
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error("savePushSubscription error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể lưu thiết bị nhận thông báo",
    });
  }
};

exports.disablePushSubscription = async (req, res) => {
  try {
    await pushNotificationService.disableSubscription(req.user.id, req.body?.endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error("disablePushSubscription error:", error);
    res.status(500).json({ success: false, message: "Không thể tắt thông báo trên thiết bị này" });
  }
};

exports.sendPushTest = async (req, res) => {
  try {
    const result = await pushNotificationService.sendToUser(req.user.id, {
      title: "CSCA MOLI",
      body: "Thông báo thử đã bật thành công.",
      url: "/profile",
      tag: "csca-push-test",
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("sendPushTest error:", error);
    res.status(500).json({ success: false, message: "Không thể gửi thông báo thử" });
  }
};

exports.sendStudyReminderCron = async (req, res) => {
  try {
    assertCronSecret(req);
    const result = await pushNotificationService.sendStudyReminders({
      limit: req.body?.limit,
      title: req.body?.title,
      body: req.body?.body,
      url: req.body?.url,
      tag: req.body?.tag,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("sendStudyReminderCron error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể gửi nhắc học",
    });
  }
};

exports.sendExamReminderCron = async (req, res) => {
  try {
    assertCronSecret(req);
    const result = await pushNotificationService.sendUpcomingExamReminders({
      limit: req.body?.limit,
      windowMinutes: req.body?.windowMinutes,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("sendExamReminderCron error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể gửi nhắc lịch thi",
    });
  }
};
