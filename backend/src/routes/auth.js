const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { validateRegister, validateLogin } = require("../utils/validators");
const DeviceSessionService = require("../services/deviceSessionService");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);
router.post("/refresh", authController.refreshToken);
router.post("/google", authController.googleAuth);

// Password reset (public - no auth needed)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.post("/verify-email", authController.verifyEmail);

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
