const emailPreferenceService = require('../services/emailPreferenceService');

const EmailPreferenceController = {
  async brevoEvents(req, res) {
    if (!emailPreferenceService.verifyBrevoWebhookSecret(
      req.get('x-brevo-webhook-secret'),
    )) {
      return res.status(401).json({ success: false });
    }

    try {
      const recorded = await emailPreferenceService.recordBrevoEvents(req.body);
      return res.json({ success: true, recorded });
    } catch (error) {
      console.error('[brevo marketing webhook]', error.message);
      return res.status(500).json({ success: false });
    }
  },

  async unsubscribe(req, res) {
    try {
      const result = await emailPreferenceService.unsubscribeByToken(
        req.params.token,
        'one_click',
      );

      if (!result) {
        return res.status(400).json({
          success: false,
          message: 'Liên kết hủy đăng ký không hợp lệ.',
        });
      }

      return res.json({
        success: true,
        message: 'Đã hủy đăng ký email marketing.',
      });
    } catch (error) {
      console.error('[email unsubscribe]', error.message);
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật tùy chọn email.',
      });
    }
  },
};

module.exports = EmailPreferenceController;
