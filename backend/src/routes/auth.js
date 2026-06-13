const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { validateRegister, validateLogin } = require("../utils/validators");
const DeviceSessionService = require("../services/deviceSessionService");

const otpLimiter = rateLimit({
  windowMs: Number(process.env.OTP_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  max: Number(process.env.OTP_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = String(req.body?.userId || "").trim();
    return `${ipKeyGenerator(req.ip)}:${userId || "unknown"}`;
  },
  message: {
    success: false,
    message: "Ban nhap OTP qua nhieu lan. Vui long doi vai phut roi thu lai.",
  },
});

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);
router.post("/refresh", authController.refreshToken);
router.get("/oauth-config", authController.getOAuthConfig);
router.post("/google", authController.googleAuth);
router.get("/facebook", authController.facebookAuthStart);
router.get("/facebook/callback", authController.facebookAuthCallback);

// Password reset (public - no auth needed)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.post("/verify-email", authController.verifyEmail);

// OTP routes
router.post("/otp/verify", otpLimiter, authController.verifyOtp);
router.post("/otp/resend", otpLimiter, authController.resendOtp);

// Device session management
router.get("/sessions", authenticate, async (req, res) => {
  try {
    const sessions = await DeviceSessionService.getActiveSessions(req.user.id);
    const maxDevices = await DeviceSessionService.getUserMaxDevices(req.user.id);
    res.json({
      success: true,
      data: {
        sessions,
        maxDevices,
        currentJti: req.user.jti,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách thiết bị" });
  }
});

router.delete("/sessions/:jti", authenticate, async (req, res) => {
  try {
    await DeviceSessionService.removeSession(req.params.jti);
    res.json({ success: true, message: "Đã đăng xuất thiết bị" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đăng xuất thiết bị" });
  }
});

router.delete("/sessions", authenticate, async (req, res) => {
  try {
    await DeviceSessionService.removeAllUserSessions(req.user.id);
    res.json({ success: true, message: "Đã đăng xuất tất cả thiết bị" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đăng xuất tất cả thiết bị" });
  }
});

module.exports = router;
