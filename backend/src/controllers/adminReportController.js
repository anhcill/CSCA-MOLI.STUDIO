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
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const adminId = req.user.id;

    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action phải là 'resolve' hoặc 'dismiss'" });
    }

    await client.query('BEGIN');
    const current = await client.query(`
      SELECT id, reporter_id, reported_user_id, status
      FROM forum_reports
      WHERE id = $1
      FOR UPDATE
    `, [id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Report không tồn tại" });
    }

    const { reported_user_id, reporter_id } = current.rows[0];
    const countResult = await client.query(`
      SELECT COUNT(*)::INTEGER AS cnt
      FROM forum_reports
      WHERE reported_user_id = $1 AND status = 'pending'
    `, [reported_user_id]);
    const pendingCount = Number(countResult.rows[0].cnt || 0);
    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

    await client.query(`
      UPDATE forum_reports
      SET status = $1, resolved_by = $2, resolved_at = NOW(),
          admin_note = COALESCE($4, admin_note), updated_at = NOW()
      WHERE id = $3
    `, [newStatus, adminId, id, String(notes || '').trim() || null]);

    if (action === 'resolve') {
      await client.query(`
        INSERT INTO forum_blocks (blocker_id, blocked_id)
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [reporter_id, reported_user_id]);

      await client.query(`
        INSERT INTO forum_blocks (blocker_id, blocked_id)
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [reported_user_id, reporter_id]);

      if (pendingCount >= 3) {
        const allReporters = await client.query(`
          SELECT DISTINCT reporter_id FROM forum_reports
          WHERE reported_user_id = $1 AND status = 'pending'
        `, [reported_user_id]);

        for (const row of allReporters.rows) {
          await client.query(`
            INSERT INTO forum_blocks (blocker_id, blocked_id)
            VALUES ($1, $2)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
          `, [row.reporter_id, reported_user_id]);
          await client.query(`
            INSERT INTO forum_blocks (blocker_id, blocked_id)
            VALUES ($1, $2)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
          `, [reported_user_id, row.reporter_id]);
        }

        await client.query(`
          UPDATE forum_reports
          SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
          WHERE reported_user_id = $2 AND status = 'pending'
        `, [adminId, reported_user_id]);
      }

      await client.query(`
        INSERT INTO notifications (recipient_id, actor_id, type, title, message, link)
        VALUES ($1, $2, 'report_resolved', 'Báo cáo đã được xử lý', $3, '/profile')
      `, [reporter_id, adminId, 'Đội ngũ quản trị đã xem xét báo cáo của bạn.']);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: action === 'resolve'
        ? pendingCount >= 3
          ? "Đã xử lý các báo cáo và chặn liên hệ với những người đã báo cáo."
          : "Đã xử lý report và chặn liên hệ giữa hai người dùng."
        : "Đã bỏ qua report.",
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Resolve report error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

/**
 * Bulk resolve reports
 * @route   POST /api/admin/forum/reports/bulk
 * @access  Admin/Mod
 */
exports.bulkResolve = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { report_ids, action } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(report_ids) || report_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách report_ids rỗng" });
    }

    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action không hợp lệ" });
    }

    const ids = [...new Set(report_ids.map(Number).filter(Number.isInteger))].slice(0, 200);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách report_ids không hợp lệ" });
    }

    await client.query('BEGIN');
    const selected = await client.query(`
      SELECT id, reporter_id, reported_user_id
      FROM forum_reports
      WHERE id = ANY($1::int[]) AND status = 'pending'
      FOR UPDATE
    `, [ids]);
    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';
    const result = await client.query(`
      UPDATE forum_reports
      SET status = $1, resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
      WHERE id = ANY($3::int[]) AND status = 'pending'
      RETURNING id
    `, [newStatus, adminId, ids]);

    if (action === 'resolve') {
      for (const row of selected.rows) {
        await client.query(`
          INSERT INTO forum_blocks (blocker_id, blocked_id)
          VALUES ($1, $2), ($2, $1)
          ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        `, [row.reporter_id, row.reported_user_id]);
      }

      const grouped = new Map();
      for (const row of selected.rows) {
        const group = grouped.get(row.reported_user_id) || [];
        group.push(row.reporter_id);
        grouped.set(row.reported_user_id, group);
      }
      for (const [reportedUserId, selectedReporters] of grouped) {
        const countRes = await client.query(`
          SELECT COUNT(*)::INTEGER as cnt FROM forum_reports
          WHERE reported_user_id = $1 AND status = 'pending'
        `, [reportedUserId]);
        const totalBeforeAction = Number(countRes.rows[0].cnt || 0) + selectedReporters.length;

        if (totalBeforeAction >= 3) {
          const reporters = await client.query(`
            SELECT DISTINCT reporter_id FROM forum_reports
            WHERE reported_user_id = $1
              AND (status = 'pending' OR id = ANY($2::int[]))
          `, [reportedUserId, ids]);

          for (const reporter of reporters.rows) {
            await client.query(`
              INSERT INTO forum_blocks (blocker_id, blocked_id)
              VALUES ($1, $2), ($2, $1)
              ON CONFLICT (blocker_id, blocked_id) DO NOTHING
            `, [reporter.reporter_id, reportedUserId]);
          }

          await client.query(`
            UPDATE forum_reports
            SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
            WHERE reported_user_id = $2 AND status = 'pending'
          `, [adminId, reportedUserId]);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Đã xử lý ${result.rowCount} report`,
      count: result.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Bulk resolve error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
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
