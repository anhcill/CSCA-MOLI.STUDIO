const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { validateRegister, validateLogin } = require("../utils/validators");

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

module.exports = router;
