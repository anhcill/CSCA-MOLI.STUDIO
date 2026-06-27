const pool = require('../config/database');

/**
 * Risk Center Controller  Phase A
 * Summary dashboard + CRUD for notifications, audit logs, exam risk cases
 */

const RiskCenterController = {
  //  GET /api/admin/risk-center/summary
  async getSummary(req, res) {
    try {
      const [critical, paymentPending, examReports, todayViolations, questionReports] = await Promise.all([
        // Critical open cases
        pool.query(
          `SELECT COUNT(*)::int AS count FROM exam_risk_cases WHERE status = 'open' AND severity = 'critical'`
        ),
        // Payment pending > 10 min
        pool.query(
          `SELECT COUNT(*)::int AS count FROM transactions WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'`
        ),
        // Open exam risk cases (proxy for reports)
        pool.query(
          `SELECT COUNT(*)::int AS count FROM exam_risk_cases WHERE status IN ('open', 'reviewing')`
        ),
        // Today violations
        pool.query(
          `SELECT COUNT(*)::int AS count FROM exam_risk_cases WHERE created_at >= CURRENT_DATE`
        ),
        // Open question reports
        pool.query(
          `SELECT COUNT(*)::int AS count FROM question_reports WHERE status IN ('open', 'reviewing')`
        ).catch(() => ({ rows: [{ count: 0 }] })),
      ]);

      // Unread admin notifications
      const unreadNotif = await pool.query(
        `SELECT COUNT(*)::int AS count FROM admin_notifications WHERE read_at IS NULL`
      );

      res.json({
        success: true,
        data: {
          criticalOpen: critical.rows[0].count,
          paymentPending: paymentPending.rows[0].count,
          examReports: examReports.rows[0].count,
          questionReports: questionReports.rows[0].count,
          todayViolations: todayViolations.rows[0].count,
          unreadNotifications: unreadNotif.rows[0].count,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getSummary error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/exam-risks
  async getExamRisks(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      let idx = 1;

      if (req.query.status) {
        conditions.push(`erc.status = $${idx++}`);
        params.push(req.query.status);
      }
      if (req.query.severity) {
        conditions.push(`erc.severity = $${idx++}`);
        params.push(req.query.severity);
      }
      if (req.query.user_id) {
        conditions.push(`erc.user_id = $${idx++}`);
        params.push(parseInt(req.query.user_id));
      }
      if (req.query.exam_id) {
        conditions.push(`erc.exam_id = $${idx++}`);
        params.push(parseInt(req.query.exam_id));
      }
      if (req.query.from) {
        conditions.push(`erc.created_at >= $${idx++}`);
        params.push(req.query.from);
      }
      if (req.query.to) {
        conditions.push(`erc.created_at <= $${idx++}`);
        params.push(req.query.to + 'T23:59:59.999Z');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        pool.query(
          `SELECT
             erc.*,
             u.full_name AS user_name,
             u.email AS user_email,
             e.title AS exam_title,
             resolver.full_name AS resolved_by_name
           FROM exam_risk_cases erc
           LEFT JOIN users u ON u.id = erc.user_id
           LEFT JOIN exams e ON e.id = erc.exam_id
           LEFT JOIN users resolver ON resolver.id = erc.resolved_by
           ${whereClause}
           ORDER BY
             CASE erc.severity
               WHEN 'critical' THEN 1
               WHEN 'high' THEN 2
               WHEN 'medium' THEN 3
               ELSE 4
             END,
             erc.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          params
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM exam_risk_cases erc ${whereClause}`,
          countParams
        ),
      ]);

      const total = countResult.rows[0].count;

      res.json({
        success: true,
        data: rows.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          limit,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getExamRisks error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/notifications
  async getNotifications(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      let idx = 1;

      if (req.query.type) {
        conditions.push(`an.type = $${idx++}`);
        params.push(req.query.type);
      }
      if (req.query.severity) {
        conditions.push(`an.severity = $${idx++}`);
        params.push(req.query.severity);
      }
      if (req.query.unread === 'true') {
        conditions.push(`an.read_at IS NULL`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        pool.query(
          `SELECT
             an.*,
             u.full_name AS user_name,
             u.email AS user_email
           FROM admin_notifications an
           LEFT JOIN users u ON u.id = an.user_id
           ${whereClause}
           ORDER BY an.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          params
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM admin_notifications an ${whereClause}`,
          countParams
        ),
      ]);

      res.json({
        success: true,
        data: rows.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          total: countResult.rows[0].count,
          limit,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getNotifications error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /api/admin/risk-center/notifications/:id/read
  async markNotificationRead(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE admin_notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL RETURNING id`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Notification not found or already read' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] markNotificationRead error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /api/admin/risk-center/notifications/read-all
  async markAllNotificationsRead(req, res) {
    try {
      const result = await pool.query(
        `UPDATE admin_notifications SET read_at = NOW() WHERE read_at IS NULL`
      );
      res.json({ success: true, updated: result.rowCount });
    } catch (error) {
      console.error('[RiskCenter] markAllNotificationsRead error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/audit-logs
  async getAuditLogs(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      let idx = 1;

      if (req.query.admin_id) {
        conditions.push(`al.admin_id = $${idx++}`);
        params.push(parseInt(req.query.admin_id));
      }
      if (req.query.action) {
        conditions.push(`al.action = $${idx++}`);
        params.push(req.query.action);
      }
      if (req.query.entity_type) {
        conditions.push(`al.entity_type = $${idx++}`);
        params.push(req.query.entity_type);
      }
      if (req.query.from) {
        conditions.push(`al.created_at >= $${idx++}`);
        params.push(req.query.from);
      }
      if (req.query.to) {
        conditions.push(`al.created_at <= $${idx++}`);
        params.push(req.query.to + 'T23:59:59.999Z');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        pool.query(
          `SELECT
             al.*,
             adm.full_name AS admin_name,
             adm.email AS admin_email
           FROM admin_audit_logs al
           LEFT JOIN users adm ON adm.id = al.admin_id
           ${whereClause}
           ORDER BY al.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          params
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM admin_audit_logs al ${whereClause}`,
          countParams
        ),
      ]);

      res.json({
        success: true,
        data: rows.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          total: countResult.rows[0].count,
          limit,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getAuditLogs error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/payment-risks
  async getPaymentRisks(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions = [
        `(t.status IN ('pending', 'failed') OR t.created_at < NOW() - INTERVAL '10 minutes' AND t.status = 'pending')`
      ];
      const params = [];
      let idx = 1;

      if (req.query.status) {
        conditions.push(`t.status = $${idx++}`);
        params.push(req.query.status);
      }
      if (req.query.user_id) {
        conditions.push(`t.user_id = $${idx++}`);
        params.push(parseInt(req.query.user_id));
      }
      if (req.query.from) {
        conditions.push(`t.created_at >= $${idx++}`);
        params.push(req.query.from);
      }
      if (req.query.to) {
        conditions.push(`t.created_at <= $${idx++}`);
        params.push(req.query.to + 'T23:59:59.999Z');
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        pool.query(
          `SELECT
             t.*,
             u.full_name AS user_name,
             u.email AS user_email,
             vp.name AS package_display_name
           FROM transactions t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN vip_packages vp ON vp.id = t.package_id
           ${whereClause}
           ORDER BY t.created_at DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          params
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM transactions t ${whereClause}`,
          countParams
        ),
      ]);

      res.json({
        success: true,
        data: rows.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          total: countResult.rows[0].count,
          limit,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getPaymentRisks error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/question-reports
  async getQuestionReports(req, res) {
    try {
      // Placeholder  will be built out in Phase D
      // For now return empty with structure
      res.json({
        success: true,
        data: [],
        pagination: { currentPage: 1, totalPages: 0, total: 0, limit: 20 },
      });
    } catch (error) {
      console.error('[RiskCenter] getQuestionReports error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /api/admin/risk-center/notifications/unread-count
  async getUnreadCount(req, res) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM admin_notifications WHERE read_at IS NULL`
      );
      res.json({ success: true, count: result.rows[0].count });
    } catch (error) {
      console.error('[RiskCenter] getUnreadCount error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
};

module.exports = RiskCenterController;
