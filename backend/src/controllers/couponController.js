const db = require('../config/database');

const CouponController = {
  /**
   * GET /api/coupons/validate?code=XXX&package_id=1
   * Validate coupon and calculate discount (public)
   */
  async validate(req, res) {
    try {
      const { code, package_id } = req.query;
      if (!code) {
        return res.status(400).json({ success: false, message: 'Thiếu mã coupon' });
      }

      const coupon = await db.query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
        [code.trim()]
      );

      if (!coupon.rows[0]) {
        return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });
      }

      const c = coupon.rows[0];
      const now = new Date();

      // Check validity period
      if (c.valid_from && new Date(c.valid_from) > now) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá chưa có hiệu lực' });
      }
      if (c.valid_until && new Date(c.valid_until) < now) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn' });
      }

      // Check usage limit
      if (c.max_uses !== null && c.used_count >= c.max_uses) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
      }

      // Check package applicability
      let originalAmount = null;
      let discountAmount = 0;
      let finalAmount = null;
      let packageName = null;

      if (package_id) {
        const pkg = await db.query(
          `SELECT id, name, price, duration_days FROM vip_packages WHERE id = $1 AND is_active = TRUE`,
          [package_id]
        );
        if (!pkg.rows[0]) {
          return res.status(404).json({ success: false, message: 'Gói VIP không tồn tại' });
        }

        originalAmount = pkg.rows[0].price;
        packageName = pkg.rows[0].name;

        // Check package applicability
        if (c.applicable_packages && c.applicable_packages.length > 0 && !c.applicable_packages.includes('all')) {
          if (!c.applicable_packages.includes(package_id)) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho gói này' });
          }
        }

        // Check tier applicability
        const pkgTier = pkg.rows[0].name.toLowerCase().includes('premium') ? 'premium' : 'vip';
        if (c.applicable_tiers && c.applicable_tiers.length > 0 && !c.applicable_tiers.includes('all')) {
          if (!c.applicable_tiers.includes(pkgTier)) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho cấp bậc này' });
          }
        }

        // Check min order amount
        if (c.min_order_amount && c.min_order_amount > originalAmount) {
          return res.status(400).json({
            success: false,
            message: `Giá trị đơn hàng tối thiểu là ${c.min_order_amount.toLocaleString('vi-VN')}đ`
          });
        }

        // Calculate discount
        if (c.discount_type === 'percentage') {
          discountAmount = Math.floor(originalAmount * c.discount_value / 100);
        } else {
          discountAmount = Math.min(c.discount_value, originalAmount);
        }
        finalAmount = originalAmount - discountAmount;
      }

      res.json({
        success: true,
        data: {
          code: c.code,
          description: c.description,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          discount_amount: discountAmount,
          original_amount: originalAmount,
          final_amount: finalAmount,
          package_name: packageName,
          valid_until: c.valid_until,
        }
      });
    } catch (err) {
      console.error('validate coupon error:', err);
      res.status(500).json({ success: false, message: 'Lỗi kiểm tra mã giảm giá' });
    }
  },

  /**
   * POST /api/coupons/apply
   * Apply coupon to a package for a user (authenticated)
   * Creates coupon_usages record
   */
  async apply(req, res) {
    try {
      const { code, package_id } = req.body;
      const userId = req.user.id;

      if (!code || !package_id) {
        return res.status(400).json({ success: false, message: 'Thiếu mã coupon hoặc package_id' });
      }

      // Validate coupon first
      const coupon = await db.query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
        [code.trim()]
      );

      if (!coupon.rows[0]) {
        return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });
      }

      const c = coupon.rows[0];
      const now = new Date();

      if (c.valid_from && new Date(c.valid_from) > now) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá chưa có hiệu lực' });
      }
      if (c.valid_until && new Date(c.valid_until) < now) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn' });
      }
      if (c.max_uses !== null && c.used_count >= c.max_uses) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
      }

      // Get package
      const pkg = await db.query(
        `SELECT id, name, price, duration_days FROM vip_packages WHERE id = $1 AND is_active = TRUE`,
        [package_id]
      );
      if (!pkg.rows[0]) {
        return res.status(404).json({ success: false, message: 'Gói VIP không tồn tại' });
      }

      const originalAmount = pkg.rows[0].price;
      const pkgTier = pkg.rows[0].name.toLowerCase().includes('premium') ? 'premium' : 'vip';

      // Check applicability
      if (c.applicable_packages && c.applicable_packages.length > 0 && !c.applicable_packages.includes('all')) {
        if (!c.applicable_packages.includes(package_id)) {
          return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho gói này' });
        }
      }
      if (c.applicable_tiers && c.applicable_tiers.length > 0 && !c.applicable_tiers.includes('all')) {
        if (!c.applicable_tiers.includes(pkgTier)) {
          return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho cấp bậc này' });
        }
      }
      if (c.min_order_amount && c.min_order_amount > originalAmount) {
        return res.status(400).json({
          success: false,
          message: `Giá trị đơn hàng tối thiểu là ${c.min_order_amount.toLocaleString('vi-VN')}đ`
        });
      }

      // Check user usage limit
      const userUsage = await db.query(
        `SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2`,
        [c.id, userId]
      );
      if (userUsage.rows[0].count >= c.user_limit) {
        return res.status(400).json({ success: false, message: 'Bạn đã sử dụng mã giảm giá này rồi' });
      }

      // Calculate discount
      let discountAmount = 0;
      if (c.discount_type === 'percentage') {
        discountAmount = Math.floor(originalAmount * c.discount_value / 100);
      } else {
        discountAmount = Math.min(c.discount_value, originalAmount);
      }
      const finalAmount = originalAmount - discountAmount;

      res.json({
        success: true,
        data: {
          coupon_id: c.id,
          code: c.code,
          package_id: pkg.rows[0].id,
          package_name: pkg.rows[0].name,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          final_amount: finalAmount,
          savings: discountAmount,
        }
      });
    } catch (err) {
      console.error('apply coupon error:', err);
      res.status(500).json({ success: false, message: 'Lỗi áp dụng mã giảm giá' });
    }
  },
};

module.exports = CouponController;
