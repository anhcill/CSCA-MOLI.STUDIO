const db = require("../config/database");

class Notification {
  /**
   * Create a notification — skip if actor == recipient (no self-notify)
   * and skip duplicates (same actor+type+post within 1 minute).
   */
  static async create({
    recipientId,
    actorId,
    type,
    postId,
    commentId = null,
  }) {
    if (recipientId === actorId) return null; // no self-notification

    // Deduplicate: don't spam the same action within 60 seconds
    const dup = await db.query(
      `SELECT id FROM notifications
       WHERE recipient_id = $1 AND actor_id = $2 AND type = $3 AND post_id = $4
         AND created_at > NOW() - INTERVAL '60 seconds'
       LIMIT 1`,
      [recipientId, actorId, type, postId],
    );
    if (dup.rows.length > 0) return null;

    const { rows } = await db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [recipientId, actorId, type, postId, commentId],
    );
    return rows[0];
  }

  /** Get notifications for a user with actor info, newest first */
  static async getForUser(userId, limit = 30, offset = 0) {
    const { rows } = await db.query(
      `SELECT
         n.id, n.type, n.post_id, n.comment_id, n.is_read, n.created_at,
         u.id        AS actor_id,
         u.full_name AS actor_name,
         u.avatar    AS actor_avatar,
         p.content   AS post_preview
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       LEFT JOIN posts p ON n.post_id = p.id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows;
  }

  /** Count unread */
  static async countUnread(userId) {
    const { rows } = await db.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = $1 AND is_read = false",
      [userId],
    );
    return parseInt(rows[0].count);
  }

  /** Mark one as read */
  static async markRead(notificationId, userId) {
    await db.query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2",
      [notificationId, userId],
    );
  }

  /** Mark all as read */
  static async markAllRead(userId) {
    await db.query(
      "UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND is_read = false",
      [userId],
    );
  }
}

module.exports = Notification;
