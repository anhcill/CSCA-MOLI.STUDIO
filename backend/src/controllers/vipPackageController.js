const db = require('../config/database');
const { cache, TTL } = require('../config/cache');

const PACKAGE_CACHE_KEY = 'vip:packages:active';
const COMPARISON_CACHE_KEY = 'vip:comparison';

const VipPackageController = {
  /**
   * GET /api/vip/packages
   * Lấy danh sách gói VIP (public - cho trang mua VIP)
   */
  async getPackages(req, res) {
    try {
      const cached = cache.get(PACKAGE_CACHE_KEY);
      if (cached) {
        return res.json({ success: true, data: cached, fromCache: true });
      }
      const result = await db.query(
        `SELECT id, name, tier, duration_days, price, original_price, price_note, original_price_note, subject_prices, subject_original_prices, allowed_subjects, requires_subject_choice, description, features, is_active, sort_order, created_at
         FROM vip_packages
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, price ASC`
      );
      cache.set(PACKAGE_CACHE_KEY, result.rows, TTL.LONG);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('getPackages error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách gói VIP' });
    }
  },

  /**
   * GET /api/vip/packages/all
   * Lấy tất cả gói VIP (admin - kể cả inactive)
   */
  async getAllPackages(req, res) {
    try {
      const result = await db.query(
        `SELECT id, name, tier, duration_days, price, original_price, price_note, original_price_note, subject_prices, subject_original_prices, allowed_subjects, requires_subject_choice, description, features, is_active, sort_order, created_at
         FROM vip_packages
         ORDER BY sort_order ASC, price ASC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('getAllPackages error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách gói VIP' });
    }
  },

  /**
   * POST /api/vip/packages
   * Tạo gói VIP mới (admin)
   */
  async createPackage(req, res) {
    try {
      const { name, tier, duration_days, price, original_price, price_note, original_price_note, subject_prices, subject_original_prices, allowed_subjects, requires_subject_choice, description, features, sort_order } = req.body;

      if (!name || !tier || !duration_days || price === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu trường bắt buộc' });
      }

      const result = await db.query(
        `INSERT INTO vip_packages (name, tier, duration_days, price, original_price, price_note, original_price_note, subject_prices, subject_original_prices, allowed_subjects, requires_subject_choice, description, features, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [name, tier, duration_days, price, original_price || null, price_note || null, original_price_note || null, subject_prices || {}, subject_original_prices || {}, allowed_subjects || [], requires_subject_choice === true, description || '', features || [], sort_order || 0]
      );

      cache.del(PACKAGE_CACHE_KEY);

      res.json({ success: true, message: 'Đã tạo gói VIP', data: result.rows[0] });
    } catch (err) {
      console.error('createPackage error:', err);
      res.status(500).json({ success: false, message: 'Lỗi tạo gói VIP' });
    }
  },

  /**
   * PUT /api/vip/packages/:id
   * Cập nhật gói VIP (admin)
   */
  async updatePackage(req, res) {
    try {
      const { id } = req.params;
      const { name, tier, duration_days, price, original_price, price_note, original_price_note, subject_prices, subject_original_prices, allowed_subjects, requires_subject_choice, description, features, is_active, sort_order } = req.body;

      const fields = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
      if (tier !== undefined) { fields.push(`tier = $${idx++}`); values.push(tier); }
      if (duration_days !== undefined) { fields.push(`duration_days = $${idx++}`); values.push(duration_days); }
      if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(price); }
      if (original_price !== undefined) { fields.push(`original_price = $${idx++}`); values.push(original_price || null); }
      if (price_note !== undefined) { fields.push(`price_note = $${idx++}`); values.push(price_note || null); }
      if (original_price_note !== undefined) { fields.push(`original_price_note = $${idx++}`); values.push(original_price_note || null); }
      if (subject_prices !== undefined) { fields.push(`subject_prices = $${idx++}`); values.push(subject_prices || {}); }
      if (subject_original_prices !== undefined) { fields.push(`subject_original_prices = $${idx++}`); values.push(subject_original_prices || {}); }
      if (allowed_subjects !== undefined) { fields.push(`allowed_subjects = $${idx++}`); values.push(Array.isArray(allowed_subjects) ? allowed_subjects : []); }
      if (requires_subject_choice !== undefined) { fields.push(`requires_subject_choice = $${idx++}`); values.push(requires_subject_choice === true); }
      if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
      if (features !== undefined) { fields.push(`features = $${idx++}`); values.push(features); }
      if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
      if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(sort_order); }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có trường nào được cập nhật' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(
        `UPDATE vip_packages SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Gói VIP không tồn tại' });
      }

      cache.del(PACKAGE_CACHE_KEY);
      res.json({ success: true, message: 'Đã cập nhật gói VIP', data: result.rows[0] });
    } catch (err) {
      console.error('updatePackage error:', err);
      res.status(500).json({ success: false, message: 'Lỗi cập nhật gói VIP' });
    }
  },

  /**
   * DELETE /api/vip/packages/:id
   * Xóa gói VIP (admin)
   */
  async deletePackage(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        `DELETE FROM vip_packages WHERE id = $1 RETURNING id, name`,
        [id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Gói VIP không tồn tại' });
      }
      cache.del(PACKAGE_CACHE_KEY);
      res.json({ success: true, message: `Đã xóa gói "${result.rows[0].name}"` });
    } catch (err) {
      console.error('deletePackage error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa gói VIP' });
    }
  },

  // ─── SO SÁNH TÍNH NĂNG ───────────────────────────────────────────────────

  /**
   * GET /api/vip/comparison
   * Lấy danh sách tính năng so sánh (public)
   */
  async getComparisonFeatures(req, res) {
    try {
      const cached = cache.get(COMPARISON_CACHE_KEY);
      if (cached) {
        return res.json({ success: true, data: cached, fromCache: true });
      }
      const result = await db.query(
        `SELECT id, feature_name, COALESCE(basic_has, false) as basic_has, COALESCE(vip_has, false) as vip_has, COALESCE(premium_has, false) as premium_has, sort_order
         FROM vip_features_comparison
         ORDER BY sort_order ASC, id ASC`
      );
      cache.set(COMPARISON_CACHE_KEY, result.rows, TTL.LONG);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('getComparisonFeatures error:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy danh sách so sánh tính năng' });
    }
  },

  /**
   * POST /api/vip/comparison
   * Thêm tính năng so sánh mới (admin)
   */
  async createComparisonFeature(req, res) {
    try {
      const { feature_name, basic_has, vip_has, premium_has, sort_order } = req.body;
      if (!feature_name) {
        return res.status(400).json({ success: false, message: 'Thiếu tên tính năng' });
      }

      const result = await db.query(
        `INSERT INTO vip_features_comparison (feature_name, basic_has, vip_has, premium_has, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [feature_name, basic_has || false, vip_has || false, premium_has || false, sort_order || 0]
      );
      cache.del(COMPARISON_CACHE_KEY);
      res.json({ success: true, message: 'Đã thêm tính năng', data: result.rows[0] });
    } catch (err) {
      console.error('createComparisonFeature error:', err);
      res.status(500).json({ success: false, message: 'Lỗi thêm tính năng so sánh' });
    }
  },

  /**
   * PUT /api/vip/comparison/:id
   * Sửa tính năng so sánh (admin)
   */
  async updateComparisonFeature(req, res) {
    try {
      const { id } = req.params;
      const { feature_name, basic_has, vip_has, premium_has, sort_order } = req.body;

      const fields = [];
      const values = [];
      let idx = 1;

      if (feature_name !== undefined) { fields.push(`feature_name = $${idx++}`); values.push(feature_name); }
      if (basic_has !== undefined) { fields.push(`basic_has = $${idx++}`); values.push(basic_has); }
      if (vip_has !== undefined) { fields.push(`vip_has = $${idx++}`); values.push(vip_has); }
      if (premium_has !== undefined) { fields.push(`premium_has = $${idx++}`); values.push(premium_has); }
      if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(sort_order); }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có trường nào được cập nhật' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(
        `UPDATE vip_features_comparison SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Tính năng không tồn tại' });
      }

      cache.del(COMPARISON_CACHE_KEY);
      res.json({ success: true, message: 'Đã cập nhật tính năng', data: result.rows[0] });
    } catch (err) {
      console.error('updateComparisonFeature error:', err);
      res.status(500).json({ success: false, message: 'Lỗi cập nhật tính năng so sánh' });
    }
  },

  /**
   * DELETE /api/vip/comparison/:id
   * Xóa tính năng so sánh (admin)
   */
  async deleteComparisonFeature(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        `DELETE FROM vip_features_comparison WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Tính năng không tồn tại' });
      }
      cache.del(COMPARISON_CACHE_KEY);
      res.json({ success: true, message: 'Đã xóa tính năng' });
    } catch (err) {
      console.error('deleteComparisonFeature error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa tính năng so sánh' });
    }
  },
};

module.exports = VipPackageController;
