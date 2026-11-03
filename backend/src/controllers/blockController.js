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
  const client = await db.pool.connect();
  try {
    const reporterId = req.user.id;
    const reportedId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!Number.isInteger(reportedId)) {
      return res.status(400).json({ success: false, message: "Người dùng không hợp lệ" });
    }

    if (reporterId === reportedId) {
      return res.status(400).json({ success: false, message: "Không thể tự report mình" });
    }

    if (!reason || reason.trim().length < 5 || reason.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Lý do report phải từ 5-500 ký tự" });
    }

    // Check user exists
    const userCheck = await client.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [reportedId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Check if already reported by this user recently (within 1 hour)
    const recentCheck = await client.query(`
      SELECT id FROM forum_reports
      WHERE reporter_id = $1 AND reported_user_id = $2 AND created_at > NOW() - INTERVAL '1 hour'
    `, [reporterId, reportedId]);

    if (recentCheck.rows.length > 0) {
      return res.status(429).json({ success: false, message: "Bạn đã report người này gần đây. Vui lòng chờ." });
    }

    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO forum_reports
        (reporter_id, reported_user_id, reason, target_type, target_id, evidence, updated_at)
      VALUES ($1, $2, $3, 'user', $2, $4::jsonb, NOW())
      RETURNING id, created_at
    `, [reporterId, reportedId, reason.trim(), JSON.stringify({ reportedUserId: reportedId })]);

    // Auto-block if user has 3+ reports
    const reportCount = await client.query(`
      SELECT COUNT(*)::INTEGER as cnt FROM forum_reports
      WHERE reported_user_id = $1 AND status = 'pending'
    `, [reportedId]);

    if (reportCount.rows[0].cnt >= 3) {
      // Notify admins
      const admins = await client.query(`
        SELECT id FROM users
        WHERE role IN ('admin', 'super_admin', 'moderator') AND is_active = true
        LIMIT 20
      `);
      for (const admin of admins.rows) {
        await client.query(`
          INSERT INTO notifications (recipient_id, actor_id, type, title, message, link)
          VALUES ($1, NULL, 'system_alert', $2, $3, '/admin/report-center?source=forum')
        `, [admin.id, 'Người dùng nhận nhiều báo cáo', `User #${reportedId} đang có ${reportCount.rows[0].cnt} báo cáo chờ xử lý.`]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, message: "Đã gửi report. Cảm ơn bạn!", data: { reportId: result.rows[0].id } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Report user error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
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
  const client = await db.pool.connect();
  try {
    const reporterId = req.user.id;
    const messageId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5 || reason.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Lý do report phải từ 5-500 ký tự" });
    }

    // Verify the message exists in a conversation with this reporter.
    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ success: false, message: "Tin nhắn không hợp lệ" });
    }

    const msgRes = await client.query(`
      SELECT id, sender_id, receiver_id, content, created_at, is_deleted
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

    const recentCheck = await client.query(`
      SELECT id FROM forum_reports
      WHERE reporter_id = $1
        AND target_type = 'message'
        AND target_id = $2
        AND created_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `, [reporterId, messageId]);
    if (recentCheck.rows[0]) {
      return res.status(429).json({ success: false, message: "Bạn đã báo cáo tin nhắn này gần đây." });
    }

    await client.query('BEGIN');
    const evidence = {
      messageId,
      senderId: msgRes.rows[0].sender_id,
      receiverId: msgRes.rows[0].receiver_id,
      content: msgRes.rows[0].content,
      messageCreatedAt: msgRes.rows[0].created_at,
      wasDeleted: Boolean(msgRes.rows[0].is_deleted),
    };
    const result = await client.query(`
      INSERT INTO forum_reports
        (reporter_id, reported_user_id, reason, target_type, target_id, evidence, updated_at)
      VALUES ($1, $2, $3, 'message', $4, $5::jsonb, NOW())
      RETURNING id
    `, [reporterId, reportedId, reason.trim(), messageId, JSON.stringify(evidence)]);

    await client.query('COMMIT');

    res.status(201).json({ success: true, message: "Đã report tin nhắn", data: { reportId: result.rows[0].id } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Report message error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};
