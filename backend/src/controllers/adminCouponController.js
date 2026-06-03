const db = require('../config/database');
const UserActivity = require('../models/UserActivity');

const PROMOTION_THEMES = new Set(['gold', 'violet', 'emerald', 'rose', 'blue']);

function normalizeOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePromotionPayload(body, { requireContent = false } = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const couponCode = typeof body.coupon_code === 'string' && body.coupon_code.trim()
    ? body.coupon_code.trim().toUpperCase()
    : null;
  const theme = PROMOTION_THEMES.has(body.theme) ? body.theme : 'gold';
  const placement = typeof body.placement === 'string' && body.placement.trim()
    ? body.placement.trim()
    : 'checkout';
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;

  if (requireContent && (!title || !content)) {
    return { error: 'Tiêu đề và nội dung quảng cáo là bắt buộc' };
  }

  return {
    title,
    content,
    coupon_code: couponCode,
    cta_text: typeof body.cta_text === 'string' && body.cta_text.trim() ? body.cta_text.trim() : 'Dùng mã ngay',
    badge_text: typeof body.badge_text === 'string' && body.badge_text.trim() ? body.badge_text.trim() : null,
    theme,
    placement,
    priority,
    starts_at: normalizeOptionalDate(body.starts_at),
    ends_at: normalizeOptionalDate(body.ends_at),
    is_active: body.is_active !== false,
  };
}

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
        whereClauses.push(`(LOWER(c.code) LIKE LOWER($1) OR LOWER(COALESCE(c.description, '')) LIKE LOWER($1))`);
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
        db.query('SELECT COUNT(*)::int as count FROM coupons'),
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

      UserActivity.log(req.user.id, 'admin.create_coupon', { couponId: result.rows[0].id, code, ip: req.ip, userAgent: req.headers['user-agent'] });
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

      // Normalize array fields before use
      const normalizedPackages = Array.isArray(applicable_packages)
        ? (applicable_packages.length > 0 ? applicable_packages.map(Number) : null)
        : null;
      const normalizedTiers = Array.isArray(applicable_tiers)
        ? (applicable_tiers.length > 0 ? applicable_tiers.map(String) : ['all'])
        : ['all'];

      const map = {
        code: { sql: `code = $${idx++}`, val: code ? code.trim().toUpperCase() : undefined },
        description: { sql: `description = $${idx++}`, val: description },
        discount_type: { sql: `discount_type = $${idx++}`, val: discount_type },
        discount_value: { sql: `discount_value = $${idx++}`, val: discount_value != null ? Number(discount_value) : null },
        min_order_amount: { sql: `min_order_amount = $${idx++}`, val: min_order_amount != null ? Number(min_order_amount) : null },
        max_uses: { sql: `max_uses = $${idx++}`, val: max_uses != null ? Number(max_uses) : null },
        user_limit: { sql: `user_limit = $${idx++}`, val: user_limit != null ? Number(user_limit) : null },
        valid_from: { sql: `valid_from = $${idx++}`, val: valid_from ? new Date(valid_from) : null },
        valid_until: { sql: `valid_until = $${idx++}`, val: valid_until ? new Date(valid_until) : null },
        is_active: { sql: `is_active = $${idx++}`, val: typeof is_active === 'boolean' ? is_active : undefined },
        applicable_packages: { sql: `applicable_packages = $${idx++}`, val: normalizedPackages },
        applicable_tiers: { sql: `applicable_tiers = $${idx++}`, val: normalizedTiers },
      };

      for (const [, v] of Object.entries(map)) {
        if (v.val != null) {
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

      UserActivity.log(req.user.id, 'admin.update_coupon', { couponId: id, updates: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
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
      UserActivity.log(req.user.id, 'admin.delete_coupon', { couponId: id, code: result.rows[0].code, ip: req.ip, userAgent: req.headers['user-agent'] });
      res.json({ success: true, message: `Đã xóa mã "${result.rows[0].code}"` });
    } catch (err) {
      console.error('AdminCouponController.delete error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa coupon' });
    }
  },

  /**
   * GET /api/admin/coupons/promotions
   * List promotion banners (admin)
   */
  async getPromotions(req, res) {
    try {
      const result = await db.query(
        `SELECT pb.*, u.full_name as created_by_name,
                c.discount_type, c.discount_value, c.valid_until as coupon_valid_until
         FROM promotion_banners pb
         LEFT JOIN users u ON pb.created_by = u.id
         LEFT JOIN coupons c ON UPPER(c.code) = UPPER(pb.coupon_code)
         ORDER BY pb.priority DESC, pb.updated_at DESC, pb.created_at DESC`
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('AdminCouponController.getPromotions error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy quảng cáo khuyến mãi' });
    }
  },

  /**
   * POST /api/admin/coupons/promotions
   * Create promotion banner (admin)
   */
  async createPromotion(req, res) {
    try {
      const payload = normalizePromotionPayload(req.body, { requireContent: true });
      if (payload.error) {
        return res.status(400).json({ success: false, message: payload.error });
      }

      const result = await db.query(
        `INSERT INTO promotion_banners
          (title, content, coupon_code, cta_text, badge_text, theme, placement, priority, starts_at, ends_at, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          payload.title,
          payload.content,
          payload.coupon_code,
          payload.cta_text,
          payload.badge_text,
          payload.theme,
          payload.placement,
          payload.priority,
          payload.starts_at,
          payload.ends_at,
          payload.is_active,
          req.user.id,
        ]
      );

      UserActivity.log(req.user.id, 'admin.create_promotion_banner', {
        promotionId: result.rows[0].id,
        couponCode: payload.coupon_code,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, message: 'Đã tạo quảng cáo khuyến mãi', data: result.rows[0] });
    } catch (err) {
      console.error('AdminCouponController.createPromotion error:', err);
      res.status(500).json({ success: false, message: 'Lỗi tạo quảng cáo khuyến mãi' });
    }
  },

  /**
   * PUT /api/admin/coupons/promotions/:id
   * Update promotion banner (admin)
   */
  async updatePromotion(req, res) {
    try {
      const { id } = req.params;
      const payload = normalizePromotionPayload(req.body);
      const fields = [];
      const values = [];
      let idx = 1;

      const addField = (field, value) => {
        fields.push(`${field} = $${idx++}`);
        values.push(value);
      };

      if ('title' in req.body) {
        if (!payload.title) return res.status(400).json({ success: false, message: 'Tiêu đề không được để trống' });
        addField('title', payload.title);
      }
      if ('content' in req.body) {
        if (!payload.content) return res.status(400).json({ success: false, message: 'Nội dung không được để trống' });
        addField('content', payload.content);
      }
      if ('coupon_code' in req.body) addField('coupon_code', payload.coupon_code);
      if ('cta_text' in req.body) addField('cta_text', payload.cta_text);
      if ('badge_text' in req.body) addField('badge_text', payload.badge_text);
      if ('theme' in req.body) addField('theme', payload.theme);
      if ('placement' in req.body) addField('placement', payload.placement);
      if ('priority' in req.body) addField('priority', payload.priority);
      if ('starts_at' in req.body) addField('starts_at', payload.starts_at);
      if ('ends_at' in req.body) addField('ends_at', payload.ends_at);
      if ('is_active' in req.body) addField('is_active', req.body.is_active !== false);

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'Không có trường nào được cập nhật' });
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      const result = await db.query(
        `UPDATE promotion_banners SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Quảng cáo không tồn tại' });
      }

      UserActivity.log(req.user.id, 'admin.update_promotion_banner', {
        promotionId: id,
        updates: req.body,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, message: 'Đã cập nhật quảng cáo khuyến mãi', data: result.rows[0] });
    } catch (err) {
      console.error('AdminCouponController.updatePromotion error:', err);
      res.status(500).json({ success: false, message: 'Lỗi cập nhật quảng cáo khuyến mãi' });
    }
  },

  /**
   * DELETE /api/admin/coupons/promotions/:id
   * Delete promotion banner (admin)
   */
  async deletePromotion(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'DELETE FROM promotion_banners WHERE id = $1 RETURNING id, title',
        [id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Quảng cáo không tồn tại' });
      }

      UserActivity.log(req.user.id, 'admin.delete_promotion_banner', {
        promotionId: id,
        title: result.rows[0].title,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, message: `Đã xóa quảng cáo "${result.rows[0].title}"` });
    } catch (err) {
      console.error('AdminCouponController.deletePromotion error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa quảng cáo khuyến mãi' });
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
