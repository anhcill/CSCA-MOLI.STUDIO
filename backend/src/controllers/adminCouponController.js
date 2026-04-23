const db = require('../config/database');

const AdminCouponController = {
  /**
   * GET /api/admin/coupons
   * Get all coupons (admin)
   */
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const active = req.query.active; // 'active' | 'expired' | 'all'

      let whereClauses = [];
      if (search) {
        whereClauses.push(`(LOWER(c.code) LIKE LOWER($$1) OR LOWER(c.description) LIKE LOWER($$1))`);
      }
      if (active === 'active') {
        whereClauses.push(`c.is_active = TRUE`);
        whereClauses.push(`(c.valid_until IS NULL OR c.valid_until > NOW())`);
        whereClauses.push(`(c.max_uses IS NULL OR c.used_count < c.max_uses)`);
      } else if (active === 'expired') {
        whereClauses.push(`(c.valid_until < NOW() OR (c.max_uses IS NOT NULL AND c.used_count >= c.max_uses))`);
      }

      const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

      const countRes = await db.query(
        `SELECT COUNT(*)::int as total FROM coupons c ${whereStr}`,
        search ? [`%${search}%`] : []
      );
      const total = parseInt(countRes.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const result = await db.query(
        `SELECT c.*, u.full_name as created_by_name,
                CASE WHEN c.max_uses IS NULL THEN NULL ELSE c.max_uses - c.used_count END as remaining_uses
         FROM coupons c
         LEFT JOIN users u ON c.created_by = u.id
         ${whereStr}
         ORDER BY c.created_at DESC
         LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
        search ? [`%${search}%`, limit, offset] : [limit, offset]
      );

      res.json({
        data: result.rows,
        pagination: { page, limit, total, totalPages }
      });
    } catch (err) {
      console.error('AdminCouponController.getAll error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách coupon' });
    }
  },

  /**
   * GET /api/admin/coupons/stats
   * Get coupon statistics (admin)
   */
  async getStats(req, res) {
    try {
      const [totalRes, activeRes, totalDiscountRes, usageRes] = await Promise.all([
        db.query('SELECT COUNT(*)::int as count FROM coupons WHERE is_active = TRUE'),
        db.query(`SELECT COUNT(*)::int as count FROM coupons WHERE is_active = TRUE AND (valid_until IS NULL OR valid_until > NOW()) AND (max_uses IS NULL OR used_count < max_uses)`),
        db.query('SELECT COALESCE(SUM(discount_amount), 0)::int as total FROM coupon_usages'),
        db.query('SELECT COUNT(*)::int as count FROM coupon_usages'),
      ]);

      const last30d = await db.query(
        `SELECT COUNT(*)::int as count, COALESCE(SUM(discount_amount), 0)::int as total
         FROM coupon_usages
         WHERE used_at > NOW() - INTERVAL '30 days'`
      );

      res.json({
        success: true,
        data: {
          total_coupons: parseInt(totalRes.rows[0].count),
          active_coupons: parseInt(activeRes.rows[0].count),
          total_discount_given: parseInt(totalDiscountRes.rows[0].count),
          total_usages: parseInt(usageRes.rows[0].count),
          last_30d_usages: parseInt(last30d.rows[0].count),
          last_30d_discount: parseInt(last30d.rows[0].total),
        }
      });
    } catch (err) {
      console.error('AdminCouponController.getStats error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy thống kê coupon' });
    }
  },

  /**
   * POST /api/admin/coupons
   * Create new coupon (admin)
   */
  async create(req, res) {
    try {
      const {
        code, description, discount_type, discount_value,
        min_order_amount, max_uses, user_limit,
        valid_from, valid_until, is_active,
        applicable_packages, applicable_tiers,
      } = req.body;

      if (!code || !discount_type || discount_value === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu trường bắt buộc: code, discount_type, discount_value' });
      }
      if (!['percentage', 'fixed'].includes(discount_type)) {
        return res.status(400).json({ success: false, message: 'discount_type phải là "percentage" hoặc "fixed"' });
      }
      if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
        return res.status(400).json({ success: false, message: 'Phần trăm giảm giá phải từ 1 đến 100' });
      }

      // Check duplicate code
      const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)', [code.trim()]);
      if (existing.rows[0]) {
        return res.status(400).json({ success: false, message: 'Mã coupon đã tồn tại' });
      }

      const result = await db.query(
        `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_uses, user_limit, valid_from, valid_until, is_active, applicable_packages, applicable_tiers, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          code.trim().toUpperCase(),
          description || null,
          discount_type,
          discount_value,
          min_order_amount || 0,
          max_uses || null,
          user_limit || 1,
          valid_from ? new Date(valid_from) : null,
          valid_until ? new Date(valid_until) : null,
          is_active !== false,
          applicable_packages || null,
          applicable_tiers || ['all'],
          req.user.id,
        ]
      );

      res.status(201).json({ success: true, message: 'Đã tạo mã giảm giá', data: result.rows[0] });
    } catch (err) {
      console.error('AdminCouponController.create error:', err);
      res.status(500).json({ success: false, message: 'Lỗi tạo coupon' });
    }
  },

  /**
   * PUT /api/admin/coupons/:id
   * Update coupon (admin)
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        code, description, discount_type, discount_value,
        min_order_amount, max_uses, user_limit,
        valid_from, valid_until, is_active,
        applicable_packages, applicable_tiers,
      } = req.body;

      if (discount_type && !['percentage', 'fixed'].includes(discount_type)) {
        return res.status(400).json({ success: false, message: 'discount_type không hợp lệ' });
      }
      if (discount_type === 'percentage' && discount_value && (discount_value < 1 || discount_value > 100)) {
        return res.status(400).json({ success: false, message: 'Phần trăm giảm giá phải từ 1 đến 100' });
      }

      // Check duplicate code (exclude self)
      if (code) {
        const existing = await db.query('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1) AND id != $2', [code.trim(), id]);
        if (existing.rows[0]) {
          return res.status(400).json({ success: false, message: 'Mã coupon đã tồn tại' });
        }
      }

      const fields = [];
      const values = [];
      let idx = 1;

      const map = {
        code: { sql: `code = $${idx++}`, val: code ? code.trim().toUpperCase() : undefined },
        description: { sql: `description = $${idx++}`, val: description },
        discount_type: { sql: `discount_type = $${idx++}`, val: discount_type },
        discount_value: { sql: `discount_value = $${idx++}`, val: discount_value },
        min_order_amount: { sql: `min_order_amount = $${idx++}`, val: min_order_amount },
        max_uses: { sql: `max_uses = $${idx++}`, val: max_uses },
        user_limit: { sql: `user_limit = $${idx++}`, val: user_limit },
        valid_from: { sql: `valid_from = $${idx++}`, val: valid_from ? new Date(valid_from) : null },
        valid_until: { sql: `valid_until = $${idx++}`, val: valid_until ? new Date(valid_until) : null },
        is_active: { sql: `is_active = $${idx++}`, val: is_active },
        applicable_packages: { sql: `applicable_packages = $${idx++}::integer[]`, val: applicable_packages },
        applicable_tiers: { sql: `applicable_tiers = $${idx++}::text[]`, val: applicable_tiers },
      };

      for (const [, v] of Object.entries(map)) {
        if (v.val !== undefined) {
          fields.push(v.sql);
          values.push(v.val);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có trường nào được cập nhật' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(
        `UPDATE coupons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Coupon không tồn tại' });
      }

      res.json({ success: true, message: 'Đã cập nhật mã giảm giá', data: result.rows[0] });
    } catch (err) {
      console.error('AdminCouponController.update error:', err);
      res.status(500).json({ success: false, message: 'Lỗi cập nhật coupon' });
    }
  },

  /**
   * DELETE /api/admin/coupons/:id
   * Delete coupon (admin)
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'DELETE FROM coupons WHERE id = $1 RETURNING id, code',
        [id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Coupon không tồn tại' });
      }
      res.json({ success: true, message: `Đã xóa mã "${result.rows[0].code}"` });
    } catch (err) {
      console.error('AdminCouponController.delete error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa coupon' });
    }
  },

  /**
   * GET /api/admin/coupons/:id/usage
   * Get coupon usage history (admin)
   */
  async getUsage(req, res) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const countRes = await db.query(
        'SELECT COUNT(*)::int as total FROM coupon_usages WHERE coupon_id = $1',
        [id]
      );
      const total = parseInt(countRes.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const result = await db.query(
        `SELECT cu.*, u.full_name, u.email, t.transaction_code, t.status as tx_status
         FROM coupon_usages cu
         LEFT JOIN users u ON cu.user_id = u.id
         LEFT JOIN transactions t ON cu.transaction_id = t.id
         WHERE cu.coupon_id = $1
         ORDER BY cu.used_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset]
      );

      res.json({
        data: result.rows,
        pagination: { page, limit, total, totalPages }
      });
    } catch (err) {
      console.error('AdminCouponController.getUsage error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy lịch sử sử dụng' });
    }
  },
};

module.exports = AdminCouponController;
