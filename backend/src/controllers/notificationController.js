const Notification = require("../models/Notification");

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
