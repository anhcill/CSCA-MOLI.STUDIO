/**
 * Middleware to restrict access to VIP users only
 */
const requireVip = (req, res, next) => {
  try {
    const user = req.user; // Assuming req.user is set by auth middleware

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please login." });
    }

    // Admin users can always access premium content
    if (user.role === 'admin') {
      return next();
    }

    if (!user.is_vip) {
      return res.status(403).json({
        success: false,
        message: "Tính năng này chỉ dành cho tài khoản VIP/Pro. Vui lòng nâng cấp để tiếp tục.",
        code: "VIP_REQUIRED"
      });
    }

    // Check if VIP is expired
    if (user.vip_expires_at) {
      const expirationDate = new Date(user.vip_expires_at);
      const currentDate = new Date();
      if (currentDate > expirationDate) {
         return res.status(403).json({
          success: false,
          message: "Gói VIP của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục.",
          code: "VIP_EXPIRED"
        });
      }
    }

    next();
  } catch (error) {
    console.error("Require VIP Middleware Error:", error);
    res.status(500).json({ success: false, message: "Server error checking VIP status" });
  }
};

module.exports = { requireVip };
