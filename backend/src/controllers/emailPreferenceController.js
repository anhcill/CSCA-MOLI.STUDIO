const emailPreferenceService = require('../services/emailPreferenceService');

const EmailPreferenceController = {
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
