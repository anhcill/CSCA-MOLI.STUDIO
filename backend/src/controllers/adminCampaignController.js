const pool = require('../config/database');
const emailService = require('../services/emailService');
const UserActivity = require('../models/UserActivity');

const cleanText = (value, max) => String(value || '').trim().slice(0, max);

const AdminCampaignController = {
  async getAudienceStats(req, res) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) FILTER (
           WHERE is_active IS DISTINCT FROM FALSE AND email IS NOT NULL AND email <> ''
         )::int AS active_users
         FROM users`
      );
      return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[admin campaign stats]', error);
      return res.status(500).json({ success: false, message: 'Không thể lấy số người nhận' });
    }
  },

  async send(req, res) {
    try {
      const mode = req.body?.mode === 'single' ? 'single' : 'all';
      const userId = Number.parseInt(req.body?.userId, 10);
      const subject = cleanText(req.body?.subject, 160);
      const content = cleanText(req.body?.content, 10000);
      const discountCode = cleanText(req.body?.discountCode, 80);
      const actionLabel = cleanText(req.body?.actionLabel, 80);
      const actionUrl = cleanText(req.body?.actionUrl, 500);

      if (subject.length < 3 || content.length < 3) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung email' });
      }
      if (mode === 'single' && (!Number.isInteger(userId) || userId <= 0)) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn người nhận' });
      }
      if (actionUrl) {
        try {
          const url = new URL(actionUrl);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
        } catch {
          return res.status(400).json({ success: false, message: 'Đường dẫn nút hành động không hợp lệ' });
        }
      }

      const params = [];
      let where = `email IS NOT NULL AND email <> '' AND is_active IS DISTINCT FROM FALSE`;
      if (mode === 'single') {
        params.push(userId);
        where += ' AND id = $1';
      }
      const result = await pool.query(
        `SELECT id, email, COALESCE(NULLIF(full_name, ''), username, email) AS name
         FROM users WHERE ${where} ORDER BY id`,
        params
      );
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người nhận hợp lệ' });
      }

      const html = emailService.buildAdminCampaignEmail({
        subject, content, discountCode, actionLabel, actionUrl,
      });
      const text = [content, discountCode ? `Mã ưu đãi: ${discountCode}` : '', actionUrl]
        .filter(Boolean).join('\n\n');
      const delivery = await emailService.sendCampaignBatch({
        recipients: result.rows, subject, html, text,
      });

      await UserActivity.log(req.user.id, 'admin.send_email_campaign', {
        mode,
        targetUserId: mode === 'single' ? userId : null,
        recipientCount: delivery.sent,
        subject,
        discountCode: discountCode || null,
      });
      return res.json({
        success: true,
        message: `Đã gửi email thành công đến ${delivery.sent} người nhận`,
        data: { sent: delivery.sent },
      });
    } catch (error) {
      console.error('[admin campaign send]', error?.response?.data || error);
      const configMissing = error.message === 'BREVO_API_KEY not configured';
      return res.status(configMissing ? 503 : 500).json({
        success: false,
        message: configMissing ? 'Hệ thống gửi email chưa được cấu hình' : 'Gửi email thất bại. Vui lòng thử lại.',
      });
    }
  },
};

module.exports = AdminCampaignController;
