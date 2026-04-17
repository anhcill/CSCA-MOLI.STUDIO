const db = require('../config/database');

const AdminVipController = {
  /**
   * GET /api/admin/vip/users
   * Danh sách users có/từng có VIP, với filter và pagination
   */
  async getVipUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = (page - 1) * limit;
      const filter = req.query.filter || 'all'; // all | active | expired
      const search = (req.query.search || '').trim();

      let whereClause = '';
      const params = [];

      if (filter === 'active') {
        whereClause = "WHERE u.is_vip = TRUE AND (u.vip_expires_at IS NULL OR u.vip_expires_at > NOW())";
      } else if (filter === 'expired') {
        whereClause = "WHERE u.is_vip = TRUE AND u.vip_expires_at <= NOW()";
      } else {
        whereClause = "WHERE (u.is_vip = TRUE OR EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.status = 'completed'))";
      }

      if (search) {
        params.push(`%${search}%`);
        whereClause += ` AND (u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
      }

      const countParams = [...params];
      const dataParams = [...params, limit, offset];

      const [countRes, dataRes] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS total FROM users u ${whereClause}`, countParams),
        db.query(
          `SELECT u.id, u.email, u.full_name, u.avatar_url, u.role, u.is_vip, u.vip_expires_at, u.created_at,
                  (SELECT SUM(amount) FROM transactions WHERE user_id = u.id AND status = 'completed') AS total_paid,
                  (SELECT COUNT(*)::int FROM transactions WHERE user_id = u.id) AS total_transactions
           FROM users u
           ${whereClause}
           ORDER BY u.vip_expires_at DESC NULLS LAST, u.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          dataParams
        ),
      ]);

      res.json({
        success: true,
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total: countRes.rows[0]?.total || 0,
          totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limit),
        },
      });
    } catch (err) {
      console.error('Admin getVipUsers error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách VIP users' });
    }
  },

  /**
   * POST /api/admin/vip/users/:userId/grant
   * Cấp VIP thủ công cho user
   */
  async grantVip(req, res) {
    try {
      const { userId } = req.params;
      const { durationDays, reason } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.full_name || `Admin#${adminId}`;

      if (!durationDays || durationDays < 1) {
        return res.status(400).json({ success: false, message: 'durationDays phải >= 1' });
      }

      // Cập nhật VIP
      const result = await db.query(
        `UPDATE users
         SET is_vip = TRUE,
             vip_expires_at = GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + INTERVAL '1 day' * $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, full_name, is_vip, vip_expires_at`,
        [durationDays, userId]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User không tồn tại' });

      // Ghi transaction thủ công
      const pkgDays = [30, 180, 365].find(d => d === parseInt(durationDays)) || parseInt(durationDays);
      const pkgName = pkgDays === 30 ? 'Gói Xem' : pkgDays === 180 ? 'Gói Kiểm tra' : pkgDays === 365 ? 'Gói Làm bài' : `Gói ${pkgDays} ngày`;
      await db.query(
        `INSERT INTO transactions (user_id, amount, payment_method, package_duration, package_name, transaction_code, status)
         VALUES ($1, 0, 'manual', $2, $3, $4, 'completed')`,
        [userId, durationDays, pkgName, `MANUAL_${adminId}_${Date.now()}`]
      );

      console.info(`[VIP] ${adminName} granted ${durationDays}d VIP to user#${userId}. Reason: ${reason || 'N/A'}`);
      res.json({ success: true, message: `Đã cấp ${durationDays} ngày VIP`, data: result.rows[0] });
    } catch (err) {
      console.error('Admin grantVip error:', err);
      res.status(500).json({ success: false, message: 'Lỗi cấp VIP' });
    }
  },

  /**
   * POST /api/admin/vip/users/:userId/revoke
   * Thu hồi VIP của user
   */
  async revokeVip(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;
      const adminName = req.user.full_name || `Admin#${adminId}`;

      const result = await db.query(
        `UPDATE users SET is_vip = FALSE, vip_expires_at = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING id, email, full_name`,
        [userId]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User không tồn tại' });

      console.info(`[VIP] ${adminName} revoked VIP from user#${userId}`);
      res.json({ success: true, message: 'Đã thu hồi VIP', data: result.rows[0] });
    } catch (err) {
      console.error('Admin revokeVip error:', err);
      res.status(500).json({ success: false, message: 'Lỗi thu hồi VIP' });
    }
  },

  /**
   * GET /api/admin/vip/transactions
   * Toàn bộ lịch sử giao dịch với filter
   */
  async getTransactions(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const offset = (page - 1) * limit;
      const status = req.query.status || '';
      const search = (req.query.search || '').trim();

      const params = [];
      const conditions = [];
      if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
      if (search) { params.push(`%${search}%`); conditions.push(`(u.email ILIKE $${params.length} OR t.transaction_code ILIKE $${params.length})`); }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

      const [countRes, dataRes] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS total FROM transactions t LEFT JOIN users u ON u.id = t.user_id ${where}`, params),
        db.query(
          `SELECT t.*, u.email, u.full_name, u.avatar_url
           FROM transactions t
           LEFT JOIN users u ON u.id = t.user_id
           ${where}
           ORDER BY t.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        ),
      ]);

      res.json({
        success: true,
        data: dataRes.rows,
        pagination: {
          page, limit,
          total: countRes.rows[0]?.total || 0,
          totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limit),
        },
      });
    } catch (err) {
      console.error('Admin getTransactions error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách giao dịch' });
    }
  },

  /**
   * GET /api/admin/vip/stats
   * Thống kê nhanh cho admin dashboard VIP
   */
  async getStats(req, res) {
    try {
      const [users, revenue, pending] = await Promise.all([
        db.query(`SELECT
          SUM(CASE WHEN is_vip = TRUE AND (vip_expires_at IS NULL OR vip_expires_at > NOW()) THEN 1 ELSE 0 END)::int AS active_vip,
          SUM(CASE WHEN is_vip = TRUE AND vip_expires_at <= NOW() THEN 1 ELSE 0 END)::int AS expired_vip
         FROM users`),
        db.query(`SELECT
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END)::bigint AS total_revenue,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND status = 'completed' THEN 1 END)::int AS last_30d_count,
          SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND status = 'completed' THEN amount ELSE 0 END)::bigint AS last_30d_revenue
         FROM transactions`),
      ]);

      res.json({
        success: true,
        data: {
          ...users.rows[0],
          ...revenue.rows[0],
        },
      });
    } catch (err) {
      console.error('Admin VIP stats error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy thống kê VIP' });
    }
  },
};

module.exports = AdminVipController;
