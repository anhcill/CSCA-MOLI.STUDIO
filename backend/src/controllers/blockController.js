const db = require("../config/database");

/**
 * Block a user
 * @route   POST /api/users/:id/block
 * @access  Private
 */
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = parseInt(req.params.id);

    if (blockerId === blockedId) {
      return res.status(400).json({ success: false, message: "Không thể tự chặn mình" });
    }

    // Check user exists
    const userCheck = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [blockedId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Toggle: if already blocked, unblock
    const existing = await db.query(`
      SELECT id FROM forum_blocks WHERE blocker_id = $1 AND blocked_id = $2
    `, [blockerId, blockedId]);

    if (existing.rows.length > 0) {
      // Unblock
      await db.query(`DELETE FROM forum_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
      return res.json({
        success: true,
        message: "Đã bỏ chặn người dùng",
        blocked: false,
        data: { blocked: false, userId: blockedId },
      });
    }

    // Block
    await db.query(`
      INSERT INTO forum_blocks (blocker_id, blocked_id) VALUES ($1, $2)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `, [blockerId, blockedId]);

    res.json({
      success: true,
      message: "Đã chặn người dùng",
      blocked: true,
      data: { blocked: true, userId: blockedId },
    });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Report a user
 * @route   POST /api/users/:id/report
 * @access  Private
 */
exports.reportUser = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const reportedId = parseInt(req.params.id);
    const { reason } = req.body;

    if (reporterId === reportedId) {
      return res.status(400).json({ success: false, message: "Không thể tự report mình" });
    }

    if (!reason || reason.trim().length < 5 || reason.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Lý do report phải từ 5-500 ký tự" });
    }

    // Check user exists
    const userCheck = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [reportedId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Check if already reported by this user recently (within 1 hour)
    const recentCheck = await db.query(`
      SELECT id FROM forum_reports
      WHERE reporter_id = $1 AND reported_user_id = $2 AND created_at > NOW() - INTERVAL '1 hour'
    `, [reporterId, reportedId]);

    if (recentCheck.rows.length > 0) {
      return res.status(429).json({ success: false, message: "Bạn đã report người này gần đây. Vui lòng chờ." });
    }

    const result = await db.query(`
      INSERT INTO forum_reports (reporter_id, reported_user_id, reason)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `, [reporterId, reportedId, reason.trim()]);

    // Auto-block if user has 3+ reports
    const reportCount = await db.query(`
      SELECT COUNT(*)::INTEGER as cnt FROM forum_reports
      WHERE reported_user_id = $1 AND status = 'pending'
    `, [reportedId]);

    if (reportCount.rows[0].cnt >= 3) {
      // Notify admins
      const admins = await db.query(`SELECT id FROM users WHERE role IN ('admin', 'moderator') LIMIT 5`);
      for (const admin of admins.rows) {
        await db.query(`
          INSERT INTO notifications (recipient_id, actor_id, type)
          VALUES ($1, $2, 'system_alert')
        `, [admin.id, 0]);
      }
    }

    res.status(201).json({ success: true, message: "Đã gửi report. Cảm ơn bạn!", data: { reportId: result.rows[0].id } });
  } catch (error) {
    console.error("Report user error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get my block list
 * @route   GET /api/users/me/blocks
 * @access  Private
 */
exports.getBlockList = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT
        fb.id,
        fb.blocked_id,
        fb.created_at,
        u.username,
        u.full_name,
        u.avatar,
        u.avatar_url,
        u.is_vip
      FROM forum_blocks fb
      JOIN users u ON fb.blocked_id = u.id
      WHERE fb.blocker_id = $1
      ORDER BY fb.created_at DESC
    `, [userId]);

    res.json({ success: true, data: { blocks: result.rows } });
  } catch (error) {
    console.error("Get block list error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Report a message
 * @route   POST /api/messages/:id/report
 * @access  Private
 */
exports.reportMessage = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const messageId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5 || reason.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Lý do report phải từ 5-500 ký tự" });
    }

    // Verify the message exists in a conversation with this reporter.
    const msgRes = await db.query(`
      SELECT id, sender_id, receiver_id
      FROM forum_messages
      WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)
    `, [messageId, reporterId]);

    if (!msgRes.rows[0]) {
      return res.status(404).json({ success: false, message: "Tin nhắn không tồn tại" });
    }

    const reportedId = msgRes.rows[0].sender_id;
    if (reportedId === reporterId) {
      return res.status(400).json({ success: false, message: "Không thể report tin nhắn của chính mình" });
    }

    const result = await db.query(`
      INSERT INTO forum_reports (reporter_id, reported_user_id, reason)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [reporterId, reportedId, `[Tin nhắn #${messageId}] ${reason.trim()}`]);

    res.status(201).json({ success: true, message: "Đã report tin nhắn", data: { reportId: result.rows[0].id } });
  } catch (error) {
    console.error("Report message error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
