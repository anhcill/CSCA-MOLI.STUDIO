const pool = require('../config/database');
const emailService = require('../services/emailService');
const UserActivity = require('../models/UserActivity');

const cleanText = (value, max) => String(value || '').trim().slice(0, max);

const AdminCampaignController = {
  async getAudienceStats(req, res) {
    try {
      const result = await pool.query(
        `SELECT
         COUNT(*) FILTER (WHERE u.is_active IS DISTINCT FROM FALSE)::int AS active_accounts,
         COUNT(*) FILTER (
           WHERE u.is_active IS DISTINCT FROM FALSE
             AND u.email IS NOT NULL
             AND u.email <> ''
             AND u.email_verified IS TRUE
             AND COALESCE(ep.marketing_enabled, TRUE) IS TRUE
             AND es.email IS NULL
         )::int AS active_users
         FROM users u
         LEFT JOIN user_email_preferences ep ON ep.user_id = u.id
         LEFT JOIN email_suppressions es ON LOWER(es.email) = LOWER(u.email)`
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
      const content = cleanText(req.body?.content, 10000).replace(/\*+/g, '');
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
      let where = `u.email IS NOT NULL AND u.email <> '' AND u.is_active IS DISTINCT FROM FALSE`;
      if (mode === 'single') {
        params.push(userId);
        where += ' AND u.id = $1';
      }
      const result = await pool.query(
        `SELECT u.id, u.email, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS name
         FROM users u
         LEFT JOIN user_email_preferences ep ON ep.user_id = u.id
         LEFT JOIN email_suppressions es ON LOWER(es.email) = LOWER(u.email)
         WHERE ${where}
           AND u.email_verified IS TRUE
           AND COALESCE(ep.marketing_enabled, TRUE) IS TRUE
           AND es.email IS NULL
         ORDER BY u.id`,
        params
      );
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người nhận hợp lệ' });
      }

      const text = [content, discountCode ? `Mã ưu đãi: ${discountCode}` : '', actionUrl]
        .filter(Boolean).join('\n\n');
      const recipients = result.rows.map(recipient => ({
        ...recipient,
        html: emailService.buildAdminCampaignEmail({
          subject,
          content,
          discountCode,
          actionLabel,
          actionUrl,
          recipientName: recipient.name,
        }),
        text: `Chào ${recipient.name || 'bạn'},\n\n${text}`,
      }));
      const delivery = await emailService.sendCampaignBatch({
        recipients,
        subject,
        html: recipients[0].html,
        text,
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

  async sendNotification(req, res) {
    try {
      const mode = req.body?.mode === 'single' ? 'single' : 'all';
      const userId = Number.parseInt(req.body?.userId, 10);
      const title = cleanText(req.body?.title, 200);
      const content = cleanText(req.body?.content, 5000).replace(/\*+/g, '');
      const discountCode = cleanText(req.body?.discountCode, 80);
      const link = cleanText(req.body?.link, 500);

      if (title.length < 3 || content.length < 3) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung thông báo' });
      }
      if (mode === 'single' && (!Number.isInteger(userId) || userId <= 0)) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn người nhận' });
      }
      if (link && !link.startsWith('/')) {
        try {
          const url = new URL(link);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
        } catch {
          return res.status(400).json({ success: false, message: 'Đường dẫn thông báo không hợp lệ' });
        }
      }

      const message = discountCode ? `${content}\nMã dành cho bạn: ${discountCode}` : content;
      const params = [req.user.id, title, message, link || null];
      let targetClause = `u.is_active IS DISTINCT FROM FALSE`;
      if (mode === 'single') {
        params.push(userId);
        targetClause += ` AND u.id = $5`;
      }

      const result = await pool.query(
        `INSERT INTO notifications
           (recipient_id, actor_id, type, title, message, link, is_read)
         SELECT u.id, $1, 'admin_announcement', $2, $3, $4, false
         FROM users u
         WHERE ${targetClause}
         RETURNING *`,
        params
      );
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người nhận hợp lệ' });
      }

      const { getIO } = require('../socket/singleton');
      const { emitNotification } = require('../socket');
      const io = getIO();
      if (io) {
        result.rows.forEach(notification => {
          emitNotification(io, notification.recipient_id, notification);
        });
      }

      await UserActivity.log(req.user.id, 'admin.send_user_notification', {
        mode,
        targetUserId: mode === 'single' ? userId : null,
        recipientCount: result.rowCount,
        title,
      });
      return res.json({
        success: true,
        message: `Đã gửi thông báo đến ${result.rowCount} người nhận`,
        data: { sent: result.rowCount },
      });
    } catch (error) {
      console.error('[admin notification send]', error);
      return res.status(500).json({ success: false, message: 'Gửi thông báo thất bại. Vui lòng thử lại.' });
    }
  },
};

module.exports = AdminCampaignController;
