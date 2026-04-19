const db = require('../config/database');

const VipPackageController = {
  /**
   * GET /api/vip/packages
   * Lấy danh sách gói VIP (public - cho trang mua VIP)
   */
  async getPackages(req, res) {
    try {
      const result = await db.query(
        `SELECT id, name, duration_days, price, description, features, is_active, sort_order, created_at
         FROM vip_packages
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, price ASC`
      );
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
        `SELECT id, name, duration_days, price, description, features, is_active, sort_order, created_at
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
      const { name, duration_days, price, description, features, sort_order } = req.body;

      if (!name || !duration_days || price === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu trường bắt buộc' });
      }

      const result = await db.query(
        `INSERT INTO vip_packages (name, duration_days, price, description, features, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, duration_days, price, description || '', features || [], sort_order || 0]
      );

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
      const { name, duration_days, price, description, features, is_active, sort_order } = req.body;

      const fields = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
      if (duration_days !== undefined) { fields.push(`duration_days = $${idx++}`); values.push(duration_days); }
      if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(price); }
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
      res.json({ success: true, message: `Đã xóa gói "${result.rows[0].name}"` });
    } catch (err) {
      console.error('deletePackage error:', err);
      res.status(500).json({ success: false, message: 'Lỗi xóa gói VIP' });
    }
  },
};

module.exports = VipPackageController;
