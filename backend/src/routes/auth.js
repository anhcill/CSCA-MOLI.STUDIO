const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { verifyTurnstile } = require("../middleware/turnstileMiddleware");
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
    message: "Bạn nhập OTP quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.",
  },
});

const verificationEmailLimiter = rateLimit({
  windowMs: Number(process.env.VERIFICATION_EMAIL_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.VERIFICATION_EMAIL_RATE_LIMIT_MAX || 3),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${ipKeyGenerator(req.ip)}:${email || "unknown"}`;
  },
  message: {
    success: false,
    message: "Bạn đã yêu cầu quá nhiều lần. Vui lòng đợi 10 phút rồi thử lại.",
  },
});

router.post("/register", verifyTurnstile, validateRegister, authController.register);
router.post("/login", verifyTurnstile, validateLogin, authController.login);
// Ứng dụng di động không thể nhúng widget Turnstile của trình duyệt. Dùng
// cùng controller (mật khẩu, tài khoản, phiên thiết bị và OTP) qua endpoint
// có giới hạn tốc độ riêng, không làm yếu luồng đăng nhập trên web.
router.post("/mobile-login", validateLogin, authController.login);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);
router.post("/refresh", authController.refreshToken);
router.get("/oauth-config", authController.getOAuthConfig);
router.post("/google", authController.googleAuth);
router.get("/facebook", authController.facebookAuthStart);
router.get("/facebook/callback", authController.facebookAuthCallback);

// Password reset (public - no auth needed)
router.post("/forgot-password", verifyTurnstile, authController.forgotPassword);
router.post("/reset-password", verifyTurnstile, authController.resetPassword);

router.post("/verify-email", authController.verifyEmail);
router.post(
  "/resend-verification-email",
  verificationEmailLimiter,
  verifyTurnstile,
  authController.resendVerificationEmail,
);

// OTP routes
router.post("/otp/verify", otpLimiter, authController.verifyOtp);
router.post("/otp/resend", otpLimiter, authController.resendOtp);

// Admin Microsoft Authenticator MFA. Public because admin has no auth token yet.
router.post("/admin-mfa/setup/start", otpLimiter, authController.adminMfaSetupStart);
router.post("/admin-mfa/setup/confirm", otpLimiter, authController.adminMfaSetupConfirm);
router.post("/admin-mfa/verify", otpLimiter, authController.adminMfaVerify);

// Device replacement login requests
router.get("/device-login-requests/:token/status", authController.getDeviceLoginRequestStatus);
router.get("/device-login-requests/:token/qr", authController.getDeviceLoginRequestQr);
router.post("/device-login-requests/:token/target", otpLimiter, authController.selectDeviceLoginTarget);
router.post("/device-login-requests/:token/approve", authenticate, authController.approveDeviceLoginRequest);
router.post("/device-login-requests/:token/otp", otpLimiter, authController.sendDeviceReplacementOtp);
router.post("/device-login-requests/:token/otp/verify", otpLimiter, authController.verifyDeviceReplacementOtp);

// Device session management
router.get("/sessions", authenticate, async (req, res) => {
  try {
    const sessions = await DeviceSessionService.getActiveSessions(req.user.id);
    const limits = await DeviceSessionService.getDeviceLimits(req.user.id);
    const usage = sessions.reduce((acc, session) => {
      const type = session.device_type || "desktop";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, { mobile: 0, desktop: 0 });
    res.json({
      success: true,
      data: {
        sessions,
        limits: { mobile: limits.mobile, desktop: limits.desktop },
        usage,
        maxDevices: limits.mobile + limits.desktop,
        currentJti: req.user.jti,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách thiết bị" });
  }
});

router.delete("/sessions/:jti", authenticate, async (req, res) => {
  try {
    const removed = await DeviceSessionService.removeSession(req.params.jti, req.user.id);
    if (!removed) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị" });
    }
    res.json({ success: true, message: "Đã đăng xuất thiết bị" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đăng xuất thiết bị" });
  }
});

router.delete("/sessions", authenticate, async (req, res) => {
  try {
    const removed = await DeviceSessionService.removeAllUserSessions(req.user.id, { exceptJti: req.user.jti });
    res.json({ success: true, message: "Đã đăng xuất tất cả thiết bị khác", data: { removed } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đăng xuất thiết bị khác" });
  }
});

module.exports = router;
