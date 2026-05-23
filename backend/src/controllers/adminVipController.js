const db = require('../config/database');
const emailService = require('../services/emailService');
const UserActivity = require('../models/UserActivity');
const DeviceSessionService = require('../services/deviceSessionService');

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

      const vipCondition = "(u.is_vip = TRUE OR u.subscription_tier IN ('vip', 'premium'))";
      const activeCondition = `(${vipCondition} AND (u.vip_expires_at IS NULL OR u.vip_expires_at > NOW()))`;

      if (filter === 'active') {
        whereClause = `WHERE ${activeCondition}`;
      } else if (filter === 'expired') {
        whereClause = `WHERE ${vipCondition} AND u.vip_expires_at <= NOW()`;
      } else {
        whereClause = `WHERE (${vipCondition} OR EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.status = 'completed'))`;
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
          `SELECT u.id, u.email, u.full_name, u.avatar_url, u.role, u.is_vip, COALESCE(u.subscription_tier, 'basic') as subscription_tier, u.vip_expires_at, u.created_at,
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
   * Cấp VIP thủ công cho user — chọn gói từ danh sách packages
   */
  async grantVip(req, res) {
    try {
      const { email, durationDays, reason, packageId, tier } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.full_name || `Admin#${adminId}`;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email người dùng.' });
      }

      // Tìm user theo email
      const userRes = await db.query(
        `SELECT id, email, full_name, username FROM users WHERE email = $1`,
        [email.trim()]
      );

      if (!userRes.rows[0]) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng với email này.' });
      }

      const userObj = userRes.rows[0];
      const userId = userObj.id;

      let pkgId = null, pkgName = null, pkgDays = null, pkgTier = 'vip';

      if (packageId) {
        const pkgRes = await db.query(
          `SELECT id, name, duration_days, COALESCE(tier, 'vip') as tier FROM vip_packages WHERE id = $1`,
          [packageId]
        );
        if (!pkgRes.rows[0]) {
          return res.status(400).json({ success: false, message: 'Gói VIP không tồn tại.' });
        }
        pkgId = pkgRes.rows[0].id;
        pkgName = pkgRes.rows[0].name;
        pkgDays = pkgRes.rows[0].duration_days;
        pkgTier = pkgRes.rows[0].tier || 'vip';
      } else if (durationDays && durationDays >= 1) {
        pkgDays = parseInt(durationDays);
        pkgTier = ['vip', 'premium'].includes(tier) ? tier : 'vip';
        pkgName = `Gói ${pkgTier === 'premium' ? 'Pre' : 'VIP'} ${pkgDays} ngày`;
      } else {
        return res.status(400).json({ success: false, message: 'Cần cung cấp packageId hoặc durationDays.' });
      }

      // Cập nhật VIP với tier chính xác
      const result = await db.query(
        `UPDATE users
         SET is_vip = TRUE,
             subscription_tier = $3,
             vip_expires_at = GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + INTERVAL '1 day' * $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, full_name, is_vip, subscription_tier, vip_expires_at`,
        [pkgDays, userId, pkgTier]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User không tồn tại' });

      const grantedUser = result.rows[0];

      // Gửi email kích hoạt VIP
      const name = grantedUser.full_name || userObj.username || 'bạn';
      emailService.sendVipActivatedEmail({
        email: grantedUser.email,
        name,
        packageName: pkgName,
        durationDays: pkgDays,
        expiresAt: grantedUser.vip_expires_at,
      }).catch(err => console.error('Admin grant VIP email error:', err.message));

      // Ghi transaction thủ công
      await db.query(
        `INSERT INTO transactions (user_id, amount, payment_method, package_id, package_duration, package_name, transaction_code, status)
         VALUES ($1, 0, 'manual', $2, $3, $4, $5, 'completed')`,
        [userId, pkgId, pkgDays, pkgName, `MANUAL_${adminId}_${Date.now()}`]
      );

      UserActivity.log(req.user.id, 'admin.grant_vip', { userId, packageId: pkgId, durationDays: pkgDays, reason, ip: req.ip, userAgent: req.headers['user-agent'] });
      console.info(`[VIP] ${adminName} granted "${pkgName}" (${pkgDays}d) to user#${userId} (${email}). Reason: ${reason || 'N/A'}`);
      res.json({ success: true, message: `Đã cấp "${pkgName}" (${pkgDays} ngày) cho người dùng ${email}`, data: result.rows[0] });
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

      // ── Revoke VIP: set is_vip=FALSE, subscription_tier='basic', clear expiry ──
      // Set subscription_tier to 'basic' (not NULL) for DB consistency
      const result = await db.query(
        `UPDATE users SET is_vip = FALSE, subscription_tier = 'basic', vip_expires_at = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING id, email, full_name, subscription_tier`,
        [userId]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User không tồn tại' });

      // Revoke ALL active sessions for this user → tokens become invalid immediately
      await DeviceSessionService.removeAllUserSessions(userId);

      UserActivity.log(req.user.id, 'admin.revoke_vip', { userId, ip: req.ip, userAgent: req.headers['user-agent'] });
      console.info(`[VIP] ${adminName} revoked VIP from user#${userId} (all sessions killed)`);
      res.json({ success: true, message: 'Đã thu hồi VIP và đăng xuất tất cả thiết bị', data: result.rows[0] });
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
          SUM(CASE WHEN (is_vip = TRUE OR subscription_tier IN ('vip', 'premium')) AND (vip_expires_at IS NULL OR vip_expires_at > NOW()) THEN 1 ELSE 0 END)::int AS active_vip,
          SUM(CASE WHEN (is_vip = TRUE OR subscription_tier IN ('vip', 'premium')) AND vip_expires_at <= NOW() THEN 1 ELSE 0 END)::int AS expired_vip
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
