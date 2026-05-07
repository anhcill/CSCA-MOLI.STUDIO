const db = require("../config/database");

/**
 * Get all pending reports
 * @route   GET /api/admin/forum/reports
 * @access  Admin/Mod
 */
exports.getReports = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const validStatuses = ['pending', 'resolved', 'dismissed'];
    const statusFilter = validStatuses.includes(status) ? status : 'pending';

    const result = await db.query(`
      SELECT
        r.id,
        r.reporter_id,
        r.reported_user_id,
        r.reason,
        r.status,
        r.resolved_by,
        r.resolved_at,
        r.created_at,
        reporter.username as reporter_username,
        reporter.full_name as reporter_full_name,
        reporter.avatar as reporter_avatar,
        reporter.avatar_url as reporter_avatar_url,
        reported.username as reported_username,
        reported.full_name as reported_full_name,
        reported.avatar as reported_avatar,
        reported.avatar_url as reported_avatar_url,
        reported.is_vip,
        reported.subscription_tier,
        reported.role as reported_role,
        (
          SELECT COUNT(*)::INTEGER FROM forum_reports
          WHERE reported_user_id = r.reported_user_id AND status = 'pending'
        ) as user_pending_count
      FROM forum_reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [statusFilter, limit, offset]);

    const countRes = await db.query(`
      SELECT COUNT(*)::INTEGER as total FROM forum_reports WHERE status = $1
    `, [statusFilter]);

    const statsRes = await db.query(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending,
        COUNT(*) FILTER (WHERE status = 'resolved')::INTEGER as resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed')::INTEGER as dismissed
      FROM forum_reports
    `);

    res.json({
      success: true,
      data: {
        reports: result.rows,
        stats: statsRes.rows[0],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countRes.rows[0].total),
          totalPages: Math.ceil(countRes.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get report detail
 * @route   GET /api/admin/forum/reports/:id
 * @access  Admin/Mod
 */
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        r.*,
        reporter.username as reporter_username,
        reporter.full_name as reporter_full_name,
        reporter.email as reporter_email,
        reporter.avatar as reporter_avatar,
        reporter.avatar_url as reporter_avatar_url,
        reported.username as reported_username,
        reported.full_name as reported_full_name,
        reported.email as reported_email,
        reported.avatar as reported_avatar,
        reported.avatar_url as reported_avatar_url,
        reported.is_vip,
        reported.subscription_tier,
        reported.role as reported_role,
        reported.created_at as reported_user_created_at,
        (
          SELECT COUNT(*)::INTEGER FROM forum_reports
          WHERE reported_user_id = r.reported_user_id AND status = 'pending'
        ) as user_pending_count
      FROM forum_reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      WHERE r.id = $1
    `, [id]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Report không tồn tại" });
    }

    res.json({ success: true, data: { report: result.rows[0] } });
  } catch (error) {
    console.error("Get report by id error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Resolve a report (resolve / dismiss)
 * @route   PUT /api/admin/forum/reports/:id
 * @access  Admin/Mod
 */
exports.resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'resolve' | 'dismiss'
    const adminId = req.user.id;

    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action phải là 'resolve' hoặc 'dismiss'" });
    }

    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

    // Update report
    const result = await db.query(`
      UPDATE forum_reports
      SET status = $1, resolved_by = $2, resolved_at = NOW()
      WHERE id = $3
      RETURNING reported_user_id, reporter_id
    `, [newStatus, adminId, id]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Report không tồn tại" });
    }

    const { reported_user_id, reporter_id } = result.rows[0];

    // If resolving (action taken), also block the user
    if (action === 'resolve') {
      // Block reported user from reporter (prevent further contact)
      await db.query(`
        INSERT INTO forum_blocks (blocker_id, blocked_id)
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [reporter_id, reported_user_id]);

      // Block reporter from reported user too (symmetric block)
      await db.query(`
        INSERT INTO forum_blocks (blocker_id, blocked_id)
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [reported_user_id, reporter_id]);

      // ── Auto-block check: if user has 3+ pending reports, ban them ──
      const reportCountRes = await db.query(`
        SELECT COUNT(*)::INTEGER as cnt FROM forum_reports
        WHERE reported_user_id = $1 AND status = 'pending'
      `, [reported_user_id]);

      const pendingCount = parseInt(reportCountRes.rows[0].cnt);

      if (pendingCount >= 3) {
        // Get reporter info for admin notification
        const reporterRes = await db.query(`SELECT full_name FROM users WHERE id = $1`, [reporter_id]);
        const reporterName = reporterRes.rows[0]?.full_name || 'Unknown';

        // Block ALL users who reported this person (symmetric blocks)
        const allReporters = await db.query(`
          SELECT DISTINCT reporter_id FROM forum_reports
          WHERE reported_user_id = $1 AND status = 'pending'
        `, [reported_user_id]);

        for (const row of allReporters.rows) {
          await db.query(`
            INSERT INTO forum_blocks (blocker_id, blocked_id)
            VALUES ($1, $2)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
          `, [row.reporter_id, reported_user_id]);
          await db.query(`
            INSERT INTO forum_blocks (blocker_id, blocked_id)
            VALUES ($1, $2)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
          `, [reported_user_id, row.reporter_id]);
        }

        // Mark all pending reports as resolved
        await db.query(`
          UPDATE forum_reports
          SET status = 'resolved', resolved_by = $1, resolved_at = NOW()
          WHERE reported_user_id = $2 AND status = 'pending'
        `, [adminId, reported_user_id]);

        // Notify admin
        const adminUsers = await db.query(`
          SELECT id FROM users WHERE role IN ('admin', 'super_admin')
        `);
        for (const admin of adminUsers.rows) {
          await db.query(`
            INSERT INTO notifications (recipient_id, actor_id, type)
            VALUES ($1, $2, 'system_alert')
          `, [admin.id, adminId]);
        }
      }

      // Notify reporter that action was taken
      await db.query(`
        INSERT INTO notifications (recipient_id, actor_id, type)
        VALUES ($1, $2, 'report_resolved')
      `, [reporter_id, adminId]);

      // Notify reported user if they exist
      await db.query(`
        INSERT INTO notifications (recipient_id, actor_id, type)
        VALUES ($1, $2, 'system_alert')
      `, [reported_user_id, adminId]);
    }

    res.json({
      success: true,
      message: action === 'resolve'
        ? pendingCount >= 3
          ? "Đã xử lý report. Người dùng đã bị chặn toàn bộ do nhận 3+ reports."
          : "Đã xử lý report. Người dùng đã bị chặn."
        : "Đã bỏ qua report.",
    });
  } catch (error) {
    console.error("Resolve report error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Bulk resolve reports
 * @route   POST /api/admin/forum/reports/bulk
 * @access  Admin/Mod
 */
exports.bulkResolve = async (req, res) => {
  try {
    const { report_ids, action } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(report_ids) || report_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách report_ids rỗng" });
    }

    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action không hợp lệ" });
    }

    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

    const result = await db.query(`
      UPDATE forum_reports
      SET status = $1, resolved_by = $2, resolved_at = NOW()
      WHERE id = ANY($3::int[]) AND status = 'pending'
      RETURNING id
    `, [newStatus, adminId, report_ids]);

    // If resolving, check auto-block for each unique reported user
    if (action === 'resolve') {
      // Get all unique reported users from these reports
      const usersRes = await db.query(`
        SELECT DISTINCT reported_user_id FROM forum_reports
        WHERE id = ANY($1::int[]) AND status = 'resolved'
      `, [report_ids]);

      for (const { reported_user_id } of usersRes.rows) {
        const countRes = await db.query(`
          SELECT COUNT(*)::INTEGER as cnt FROM forum_reports
          WHERE reported_user_id = $1 AND status = 'pending'
        `, [reported_user_id]);

        if (parseInt(countRes.rows[0].cnt) >= 3) {
          // Auto-block: all reporters block this user
          const reporters = await db.query(`
            SELECT DISTINCT reporter_id FROM forum_reports
            WHERE reported_user_id = $1 AND status = 'pending'
          `, [reported_user_id]);

          for (const row of reporters.rows) {
            await db.query(`
              INSERT INTO forum_blocks (blocker_id, blocked_id) VALUES ($1, $2)
              ON CONFLICT (blocker_id, blocked_id) DO NOTHING
            `, [row.reporter_id, reported_user_id]);
            await db.query(`
              INSERT INTO forum_blocks (blocker_id, blocked_id) VALUES ($1, $2)
              ON CONFLICT (blocker_id, blocked_id) DO NOTHING
            `, [reported_user_id, row.reporter_id]);
          }

          await db.query(`
            UPDATE forum_reports
            SET status = 'resolved', resolved_by = $1, resolved_at = NOW()
            WHERE reported_user_id = $2 AND status = 'pending'
          `, [adminId, reported_user_id]);

          // Notify admins
          const admins = await db.query(`SELECT id FROM users WHERE role IN ('admin', 'super_admin')`);
          for (const admin of admins.rows) {
            await db.query(`INSERT INTO notifications (recipient_id, actor_id, type) VALUES ($1, $2, 'system_alert')`, [admin.id, adminId]);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Đã xử lý ${result.rowCount} report`,
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Bulk resolve error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get auto-block list (users blocked due to 3+ reports)
 * @route   GET /api/admin/forum/reports/auto-blocks
 * @access  Admin/Mod
 */
exports.getAutoBlocks = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.avatar,
        u.avatar_url,
        u.role,
        u.is_vip,
        u.created_at,
        COUNT(r.id)::INTEGER as pending_report_count
      FROM users u
      JOIN forum_reports r ON u.id = r.reported_user_id AND r.status = 'pending'
      GROUP BY u.id, u.username, u.full_name, u.email, u.avatar, u.avatar_url, u.role, u.is_vip, u.created_at
      HAVING COUNT(r.id) >= 3
      ORDER BY pending_report_count DESC
    `);

    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    console.error("Get auto blocks error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
