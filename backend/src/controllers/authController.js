const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/User");
const UserActivity = require("../models/UserActivity");
const { OAuth2Client } = require("google-auth-library");
const emailService = require("../services/emailService");
const DeviceSessionService = require("../services/deviceSessionService");
const db = require("../config/database");
const { getAuthorizationContext } = require("../services/rbacService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Rate limiting (in-memory, dùng Redis nếu scale) ─────────────────────────
const loginAttempts = new Map(); // email -> { count, lastAttempt }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 phút

function checkRateLimit(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const attempts = loginAttempts.get(key);

  if (attempts) {
    // Reset nếu đã qua thời gian lockout
    if (now - attempts.lastAttempt > LOCKOUT_DURATION_MS) {
      loginAttempts.delete(key);
      return { blocked: false };
    }
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const remainingMs = LOCKOUT_DURATION_MS - (now - attempts.lastAttempt);
      const remainingMin = Math.ceil(remainingMs / 60000);
      return { blocked: true, remainingMin };
    }
  }
  return { blocked: false };
}

function recordFailedAttempt(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = now;
  } else {
    loginAttempts.set(key, { count: 1, lastAttempt: now });
  }
}

function clearAttempts(email) {
  loginAttempts.delete(email.toLowerCase());
}

// ─── Input validation ─────────────────────────────────────────────────────────
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  if (!password || password.length < 8)
    return "Mật khẩu phải có ít nhất 8 ký tự";
  if (!/[A-Za-z]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ cái";
  if (!/[0-9]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ số";
  return null; // valid
}

// ─── Token generation ─────────────────────────────────────────────────────────
const generateToken = (payload) => {
  const jti = crypto.randomBytes(16).toString("hex"); // unique token ID
  return jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    issuer: "csca-app",
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    issuer: "csca-app",
  });
};

// VIP helper — checks both flag and expiry
const isVipActive = (user) =>
  user &&
  user.is_vip === true &&
  (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

const buildTokenPayload = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role || "student",
  is_vip: isVipActive(user),
  vip_expires_at: user.vip_expires_at || null,
  jti: user.jti || null,
  subscription_tier: user.subscription_tier || 'basic',
});

const MODULE_ROLE_CODES = ['user_admin', 'exam_admin', 'content_admin', 'forum_admin', 'roadmap_admin'];

const resolveAuthorizationContext = async (user) => {
  let authz = { roles: [], permissions: [] };

  try {
    authz = await getAuthorizationContext(user.id);
  } catch (error) {
    console.error("Get auth context error:", error.message);
  }

  // Legacy fallback: chỉ áp dụng nếu user HOÀN TOÀN không có RBAC roles
  // Không được ghi đè roles module-specific (exam_admin, forum_admin, v.v.)
  const hasAnyModuleRole = authz.roles.some(r => MODULE_ROLE_CODES.includes(r) || r === 'super_admin');

  if (!hasAnyModuleRole && user.role === 'admin') {
    // User admin cũ chưa được migrate RBAC roles → fallback tạm thời
    console.warn(`[RBAC] User #${user.id} (${user.email}) is 'admin' but has no RBAC roles — applying legacy fallback. Please re-assign admin roles.`);
    authz.roles = ['super_admin'];
    authz.permissions = ['*'];
  }

  return authz;
};

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }

    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email không hợp lệ" });
    }

    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ success: false, message: "Tên đăng nhập phải từ 3-30 ký tự" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới",
        });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ success: false, message: pwError });
    }

    // Check duplicates
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res
        .status(409)
        .json({ success: false, message: "Email này đã được đăng ký" });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res
        .status(409)
        .json({ success: false, message: "Tên đăng nhập đã được sử dụng" });
    }

    // Create user
    const user = await User.create({ username, email, password, full_name });

    // ── Email verification (S11) ──────────────────────────────────────────────
    const rawVerifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto
      .createHash("sha256")
      .update(rawVerifyToken)
      .digest("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
      "UPDATE users SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3",
      [verifyTokenHash, verifyExpires, user.id],
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawVerifyToken}&id=${user.id}`;
    // Send non-blocking (don't fail registration if email fails)
    emailService
      .sendVerificationEmail(email, user.full_name || username, verifyUrl)
      .catch(() => {});

    // Log hành vi đăng ký
    UserActivity.log(user.id, 'register', {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    const token = generateToken(buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || 'vip' }));
    const refreshToken = generateRefreshToken({ id: user.id });

    const authz = await resolveAuthorizationContext(user);

    return res.status(201).json({
      success: true,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          avatar: user.avatar,
          role: user.role,
          is_verified: false,
          is_vip: false,
          vip_expires_at: null,
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
        token,
        refreshToken,
        emailVerificationSent: true,
      },
    });
  } catch (error) {
    console.error("Register error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Đăng ký thất bại, vui lòng thử lại" });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    }

    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email không hợp lệ" });
    }

    // Rate limit check
    const { blocked, remainingMin } = checkRateLimit(email);
    if (blocked) {
      return res.status(429).json({
        success: false,
        message: `Quá nhiều lần thử sai. Vui lòng thử lại sau ${remainingMin} phút`,
      });
    }

    const user = await User.findByEmail(email);

    if (!user || !user.password) {
      // Don't reveal whether email exists
      recordFailedAttempt(email);
      return res
        .status(401)
        .json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(email);
      return res
        .status(401)
        .json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }

    // Success - clear attempts
    clearAttempts(email);

    // Check device limit for this user
    const { allowed, reason, sessions, maxDevices } = await DeviceSessionService.checkLoginAllowed(user.id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: reason,
        code: 'DEVICE_LIMIT_EXCEEDED',
        sessions: sessions.map(s => ({
          device_info: s.device_info,
          last_active: s.last_active,
          ip_address: s.ip_address,
        })),
        maxDevices,
      });
    }

    const jti = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRES_MS || '604800000')));

    await DeviceSessionService.registerSession({
      userId: user.id,
      jti,
      deviceInfo: req.get('User-Agent')?.substring(0, 200) || 'Unknown',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      expiresAt,
    });

    // Log hành vi đăng nhập
    UserActivity.log(user.id, 'login', {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    const token = generateToken(buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || 'vip' }));
    const refreshToken = generateRefreshToken({ id: user.id });

    const authz = await resolveAuthorizationContext(user);

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          avatar: user.avatar,
          role: user.role,
          bio: user.bio,
          target_score: user.target_score,
          is_vip: isVipActive(user),
          vip_expires_at: user.vip_expires_at || null,
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Đăng nhập thất bại, vui lòng thử lại",
      });
  }
};

// ─── Get current user ─────────────────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }
    // Chỉ trả về các field an toàn, không bao giờ trả password hay reset token
    const authz = await resolveAuthorizationContext(user);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          display_name: user.full_name,
          avatar: user.avatar,
          role: user.role,
          bio: user.bio,
          phone: user.phone,
          study_goal: user.study_goal,
          target_score: user.target_score,
          is_verified: user.is_verified,
          is_active: user.is_active,
          is_vip: isVipActive(user),
          vip_expires_at: user.vip_expires_at || null,
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    console.error("Get current user error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi lấy thông tin người dùng" });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const { jti, exp, id } = req.user || {};

    // Log hành vi đăng xuất
    if (id) {
      UserActivity.log(id, 'logout', {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
      });
    }

    if (jti && exp) {
      const expiresAt = new Date(exp * 1000);
      await db.query(
        "INSERT INTO token_blacklist (token_jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_jti) DO NOTHING",
        [jti, id, expiresAt],
      );
      // Also remove from device sessions
      await DeviceSessionService.removeSession(jti).catch(() => {});
      db.query("DELETE FROM token_blacklist WHERE expires_at < NOW()").catch(
        () => {},
      );
    }
    return res.json({ success: true, message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.json({ success: true, message: "Đăng xuất thành công" }); // still succeed client-side
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token không được để trống" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: "csca-app",
      });
    } catch (err) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Refresh token không hợp lệ hoặc đã hết hạn",
        });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    // Touch active sessions for this user to keep them alive
    await db.query(
      `UPDATE user_sessions SET last_active = NOW()
       WHERE user_id = $1 AND expires_at > NOW()`,
      [user.id]
    ).catch(() => {}); // non-blocking

    const newToken = generateToken(buildTokenPayload(user));
    const newRefreshToken = generateRefreshToken({ id: user.id });

    return res.json({
      success: true,
      data: { token: newToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi làm mới token" });
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────
const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Google credential không được để trống",
        });
    }

    // Verify Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Google token không hợp lệ" });
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res
        .status(400)
        .json({ success: false, message: "Email Google chưa được xác thực" });
    }

    // 1. Tìm theo Google ID (user đã đăng nhập Google trước)
    let user = await User.findByGoogleId(googleId);

    if (!user) {
      // 2. Tìm theo email
      const existingUser = await User.findByEmail(email);

      if (existingUser) {
        // Email đã tồn tại với password → Link Google vào account đó
        user = await User.linkGoogleAccount(existingUser.id, googleId, picture);
      } else {
        // 3. Tạo user mới từ Google
        user = await User.createFromGoogle({ googleId, email, name, picture });

        // Gửi email chào mừng (không block response)
        emailService.sendWelcomeEmail(email, name).catch(() => {});
      }
    }

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    // Check device limit for Google login too
    const deviceCheck = await DeviceSessionService.checkLoginAllowed(user.id);
    if (!deviceCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: deviceCheck.reason,
        code: 'DEVICE_LIMIT_EXCEEDED',
        sessions: deviceCheck.sessions.map(s => ({
          device_info: s.device_info,
          last_active: s.last_active,
          ip_address: s.ip_address,
        })),
        maxDevices: deviceCheck.maxDevices,
      });
    }

    const googleJti = crypto.randomBytes(16).toString("hex");
    await DeviceSessionService.registerSession({
      userId: user.id,
      jti: googleJti,
      deviceInfo: req.get('User-Agent')?.substring(0, 200) || 'Google OAuth',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      expiresAt: new Date(Date.now() + 604800000),
    });

    // Log hành vi đăng nhập Google
    UserActivity.log(user.id, 'google_login', {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    const token = generateToken(buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || 'vip' }));
    const refreshToken = generateRefreshToken({ id: user.id });

    const authz = await resolveAuthorizationContext(user);

    return res.json({
      success: true,
      message: "Đăng nhập Google thành công",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          avatar: user.avatar || user.avatar_url || picture,
          role: user.role || "student",
          is_vip: isVipActive(user),
          vip_expires_at: user.vip_expires_at || null,
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Đăng nhập Google thất bại, vui lòng thử lại",
      });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email không hợp lệ" });
    }

    // Always return 200 to prevent user enumeration
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      return res.json({
        success: true,
        message:
          "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
      });
    }

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [tokenHash, expiresAt, user.id],
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&id=${user.id}`;

    try {
      await emailService.sendPasswordResetEmail(email, resetUrl);
    } catch (emailErr) {
      console.error("❌ Failed to send reset email:", emailErr.message);
    }

    return res.json({
      success: true,
      message:
        "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server, vui lòng thử lại" });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, userId, newPassword } = req.body;

    if (!token || !userId || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu phải có ít nhất 8 ký tự" });
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Mật khẩu phải có ít nhất 1 chữ cái và 1 số",
        });
    }

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const result = await db.query(
      `SELECT id FROM users
       WHERE id = $1
         AND password_reset_token = $2
         AND password_reset_expires > NOW()`,
      [userId, tokenHash],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
        });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password, clear token (one-time use only)
    await db.query(
      `UPDATE users
       SET password = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newHash, userId],
    );

    return res.json({
      success: true,
      message:
        "Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server, vui lòng thử lại" });
  }
};

// ─── Verify Email ─────────────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin xác nhận" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const result = await db.query(
      `SELECT id FROM users
       WHERE id = $1
         AND email_verify_token = $2
         AND email_verify_expires > NOW()`,
      [userId, tokenHash],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Liên kết xác nhận không hợp lệ hoặc đã hết hạn",
        });
    }

    await db.query(
      `UPDATE users
       SET is_verified = true,
           email_verified = true,
           email_verify_token = NULL,
           email_verify_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );

    return res.json({
      success: true,
      message:
        "Email đã được xác nhận thành công! Bạn có thể đăng nhập bình thường.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server, vui lòng thử lại" });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  refreshToken,
  googleAuth,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
