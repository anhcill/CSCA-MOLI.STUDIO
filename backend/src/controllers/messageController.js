const db = require("../config/database");
const { getIO } = require("../socket/singleton");
const { emitNewMessage, emitUnreadCount } = require("../socket");

/**
 * Get conversation list — all users this user has messaged with
 * @route   GET /api/messages
 * @access  Private
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get all unique conversation partners with last message
    const result = await db.query(`
      WITH latest AS (
        SELECT
          CASE
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as partner_id,
          id,
          content,
          is_read,
          is_deleted,
          sender_id,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
            ORDER BY created_at DESC
          ) as rn
        FROM forum_messages
        WHERE sender_id = $1 OR receiver_id = $1
      )
      SELECT
        u.id as partner_id,
        u.username,
        u.full_name,
        u.avatar,
        u.avatar_url,
        u.role,
        u.is_vip,
        u.subscription_tier,
        l.id as last_message_id,
        CASE
          WHEN l.is_deleted = TRUE THEN 'Tin nhắn đã được thu hồi'
          ELSE l.content
        END as last_message_content,
        l.is_deleted as last_message_is_deleted,
        l.is_read,
        l.sender_id,
        l.created_at as last_message_at,
        COALESCE(
          (SELECT COUNT(*) FROM forum_messages
           WHERE sender_id = l.partner_id AND receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE),
          0
        )::INTEGER as unread_count
      FROM latest l
      JOIN users u ON u.id = l.partner_id
      WHERE l.rn = 1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Total count
    const countRes = await db.query(`
      SELECT COUNT(DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END) as total
      FROM forum_messages
      WHERE sender_id = $1 OR receiver_id = $1
    `, [userId]);

    res.json({
      success: true,
      data: {
        conversations: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countRes.rows[0].total),
          totalPages: Math.ceil(countRes.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get messages with a specific user
 * @route   GET /api/messages/:userId
 * @access  Private
 */
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.userId);
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    if (userId === partnerId) {
      return res.status(400).json({ success: false, message: "Không thể nhắn tin cho chính mình" });
    }

    // Check if either has blocked the other
    const blockCheck = await db.query(`
      SELECT blocker_id, blocked_id FROM forum_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
    `, [userId, partnerId]);

    if (blockCheck.rows.length > 0) {
      const blockedByMe = blockCheck.rows.some(row => row.blocker_id === userId && row.blocked_id === partnerId);
      const blockedMe = blockCheck.rows.some(row => row.blocker_id === partnerId && row.blocked_id === userId);
      return res.status(403).json({
        success: false,
        message: blockedByMe ? "Bạn đã chặn người dùng này" : "Không thể nhắn tin: bạn đã bị chặn",
        data: { blockedByMe, blockedMe },
      });
    }

    // Get messages
    const result = await db.query(`
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.is_read,
        m.created_at,
        m.is_deleted,
        m.reply_to_id,
        rm.content as reply_content,
        rm.is_deleted as reply_is_deleted,
        ru.full_name as reply_sender_name
      FROM forum_messages m
      LEFT JOIN forum_messages rm ON m.reply_to_id = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, partnerId, limit, offset]);

    // Mark messages as read
    await db.query(`
      UPDATE forum_messages
      SET is_read = TRUE
      WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
    `, [userId, partnerId]);

    try {
      const unreadRes = await db.query(`
        SELECT COUNT(*)::INTEGER as cnt
        FROM forum_messages
        WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
      `, [userId]);
      emitUnreadCount(getIO(), userId, parseInt(unreadRes.rows[0].cnt));
    } catch (socketErr) {
      console.warn('[Socket] Failed to emit unread count after open:', socketErr.message);
    }

    // Total count
    const countRes = await db.query(`
      SELECT COUNT(*) as total FROM forum_messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
    `, [userId, partnerId]);

    res.json({
      success: true,
      data: {
        messages: result.rows.reverse(), // oldest first for chat display
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countRes.rows[0].total),
          totalPages: Math.ceil(countRes.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Send a message
 * @route   POST /api/messages
 * @access  Private
 */
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, content, reply_to_id } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin" });
    }

    const receiverId = parseInt(receiver_id);

    if (senderId === receiverId) {
      return res.status(400).json({ success: false, message: "Không thể nhắn tin cho chính mình" });
    }

    if (content.trim().length === 0 || content.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "Tin nhắn phải từ 1-2000 ký tự" });
    }

    // Check if receiver exists
    const userCheck = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [receiverId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Check block
    const blockCheck = await db.query(`
      SELECT 1 FROM forum_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1
    `, [senderId, receiverId]);

    if (blockCheck.rows.length > 0) {
      return res.status(403).json({ success: false, message: "Không thể nhắn tin: đã bị chặn" });
    }

    // Rate limit: max 20 messages per minute
    const rateCheck = await db.query(`
      SELECT COUNT(*) as cnt FROM forum_messages
      WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '1 minute'
    `, [senderId]);

    if (parseInt(rateCheck.rows[0].cnt) >= 20) {
      return res.status(429).json({ success: false, message: "Bạn gửi tin nhắn quá nhanh. Vui lòng chờ một chút." });
    }

    let replyToId = null;
    if (reply_to_id) {
      replyToId = parseInt(reply_to_id);
      if (!Number.isInteger(replyToId)) {
        return res.status(400).json({ success: false, message: "Tin nhắn trả lời không hợp lệ" });
      }

      const replyCheck = await db.query(`
        SELECT id
        FROM forum_messages
        WHERE id = $1
          AND (
            (sender_id = $2 AND receiver_id = $3)
            OR (sender_id = $3 AND receiver_id = $2)
          )
        LIMIT 1
      `, [replyToId, senderId, receiverId]);

      if (replyCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: "Không thể trả lời tin nhắn không thuộc cuộc trò chuyện này" });
      }
    }

    const result = await db.query(`
      INSERT INTO forum_messages (sender_id, receiver_id, content, reply_to_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, sender_id, receiver_id, content, is_read, created_at, is_deleted, reply_to_id
    `, [senderId, receiverId, content.trim(), replyToId]);

    const msg = result.rows[0];

    // Fetch reply info explicitly if present
    if (msg.reply_to_id) {
      const replyRes = await db.query(`
        SELECT rm.content as reply_content, rm.is_deleted as reply_is_deleted, ru.full_name as reply_sender_name 
        FROM forum_messages rm
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE rm.id = $1
      `, [msg.reply_to_id]);
      if (replyRes.rows.length > 0) {
        msg.reply_content = replyRes.rows[0].reply_content;
        msg.reply_is_deleted = replyRes.rows[0].reply_is_deleted;
        msg.reply_sender_name = replyRes.rows[0].reply_sender_name;
      }
    }

    // Create notification for receiver
    await db.query(`
      INSERT INTO notifications (recipient_id, actor_id, type, message_id)
      VALUES ($1, $2, 'new_message', $3)
    `, [receiverId, senderId, msg.id]);

    // ── Socket.io: emit real-time message ───────────────────────────────────
    try {
      emitNewMessage(getIO(), senderId, receiverId, msg);

      // Update unread count for receiver
      const countRes = await db.query(`
        SELECT COUNT(*)::INTEGER as cnt FROM forum_messages
        WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
      `, [receiverId]);
      emitUnreadCount(getIO(), receiverId, parseInt(countRes.rows[0].cnt));
    } catch (socketErr) {
      console.warn('[Socket] Failed to emit message event:', socketErr.message);
    }

    res.status(201).json({ success: true, data: { message: msg } });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Mark message as read
 * @route   PUT /api/messages/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);

    const result = await db.query(`
      UPDATE forum_messages
      SET is_read = TRUE
      WHERE id = $1 AND receiver_id = $2
      RETURNING id
    `, [messageId, userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn" });
    }

    // Emit unread count update to receiver
    const countRes = await db.query(`
      SELECT COUNT(*)::INTEGER as cnt FROM forum_messages
      WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
    `, [userId]);
    try {
      emitUnreadCount(getIO(), userId, parseInt(countRes.rows[0].cnt));
    } catch (socketErr) {
      console.warn('[Socket] Failed to emit unread count:', socketErr.message);
    }

    res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get unread message count
 * @route   GET /api/messages/unread-count
 * @access  Private
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM forum_messages
      WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
    `, [userId]);

    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Recall/Delete a message
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);

    const result = await db.query(`
      UPDATE forum_messages
      SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND sender_id = $2 AND is_deleted = FALSE
      RETURNING id, sender_id, receiver_id, is_deleted
    `, [messageId, userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn hoặc bạn không có quyền thu hồi" });
    }

    const msg = result.rows[0];

    const receiverUnreadRes = await db.query(`
      SELECT COUNT(*)::INTEGER as cnt
      FROM forum_messages
      WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE
    `, [msg.receiver_id]);

    // Emit event back to sender and receiver
    try {
      getIO().to(`user:${msg.receiver_id}`).emit("message_deleted", { messageId: msg.id, senderId: msg.sender_id });
      getIO().to(`user:${msg.sender_id}`).emit("message_deleted", { messageId: msg.id, senderId: msg.sender_id });
      emitUnreadCount(getIO(), msg.receiver_id, parseInt(receiverUnreadRes.rows[0].cnt));
    } catch (socketErr) {
      console.warn('[Socket] Failed to emit delete message event:', socketErr.message);
    }

    res.json({ success: true, message: "Tin nhắn đã được thu hồi", data: { id: msg.id } });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
