const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
const User = require("../models/User");
const UserActivity = require("../models/UserActivity");
const { OAuth2Client } = require("google-auth-library");
const emailService = require("../services/emailService");
const DeviceSessionService = require("../services/deviceSessionService");
const db = require("../config/database");
const { getAuthorizationContext } = require("../services/rbacService");
const adminMfaService = require("../services/adminMfaService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getGooglePayloadFromCredential = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

const getGooglePayloadFromAccessToken = async (accessToken) => {
  const tokenInfo = await googleClient.getTokenInfo(accessToken);
  const audience = tokenInfo.audience || tokenInfo.aud;
  const validAudience = Array.isArray(audience)
    ? audience.includes(process.env.GOOGLE_CLIENT_ID)
    : audience === process.env.GOOGLE_CLIENT_ID;

  if (!validAudience) {
    throw new Error("Invalid Google token audience");
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Google userinfo request failed");
  }

  return response.json();
};

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

// ─── OTP helpers ──────────────────────────────────────────────────────────────
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 phút
const OTP_LENGTH = 6;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 chữ số
}

async function storeOtp(userId, email, reason) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  // Lưu hash OTP (không lưu OTP plain)
  const otpHash = await bcrypt.hash(otp, 10);

  await db.query(
    `INSERT INTO user_otps (user_id, email, otp_hash, reason, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, reason)
     DO UPDATE SET otp_hash = $3, expires_at = $5, created_at = NOW(), is_used = FALSE`,
    [userId, email, otpHash, reason, expiresAt]
  );
  return otp; // Trả plain OTP để gửi email
}

async function verifyOtp(userId, otp, reason) {
  const result = await db.query(
    `SELECT otp_hash, expires_at, is_used FROM user_otps
     WHERE user_id = $1 AND reason = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, reason]
  );
  if (!result.rows[0]) return { valid: false, reason: 'no_otp' };

  const { otp_hash, expires_at, is_used } = result.rows[0];
  if (is_used) return { valid: false, reason: 'already_used' };
  if (new Date(expires_at) < new Date()) return { valid: false, reason: 'expired' };

  const match = await bcrypt.compare(otp, otp_hash);
  if (!match) return { valid: false, reason: 'invalid' };

  // Đánh dấu OTP đã dùng
  await db.query(
    `UPDATE user_otps SET is_used = TRUE WHERE user_id = $1 AND reason = $2`,
    [userId, reason]
  );
  return { valid: true };
}

// ─── Parse user agent ────────────────────────────────────────────────────────
function parseUserAgent(ua) {
  if (!ua) return 'Thiết bị không xác định';
  if (/mobile/i.test(ua)) return 'Điện thoại di động';
  if (/tablet|ipad/i.test(ua)) return 'Máy tính bảng';
  if (/bot|crawler|spider/i.test(ua)) return 'Trình duyệt tự động';
  return 'Máy tính';
}

// ─── Get client IP ───────────────────────────────────────────────────────────
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    '127.0.0.1'
  );
}

// ─── Token generation ─────────────────────────────────────────────────────────
const generateToken = (payload) => {
  const jti = payload?.jti || crypto.randomBytes(16).toString("hex"); // unique token ID
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
  (user.is_vip === true ||
    user.subscription_tier === 'vip' ||
    user.subscription_tier === 'premium') &&
  (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

const buildTokenPayload = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role || "student",
  is_vip: isVipActive(user),
  vip_expires_at: user.vip_expires_at || null,
  jti: user.jti || null,
  subscription_tier: user.subscription_tier || 'basic',
  vip_package_id: user.vip_package_id || null,
  vip_allowed_subjects: user.vip_allowed_subjects || [],
});

const MODULE_ROLE_CODES = ['user_admin', 'exam_admin', 'content_admin', 'forum_admin', 'roadmap_admin', 'course_teacher'];
const ADMIN_MFA_TOKEN_AUDIENCE = "admin-mfa";

const isAdminUser = (user) => user?.role === "admin";

const generateAdminMfaToken = (user, stage = "verify") =>
  jwt.sign(
    { id: user.id, email: user.email, purpose: "admin_mfa", stage },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ADMIN_MFA_TOKEN_TTL || "10m",
      issuer: "csca-app",
      audience: ADMIN_MFA_TOKEN_AUDIENCE,
    },
  );

const verifyAdminMfaToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: "csca-app",
    audience: ADMIN_MFA_TOKEN_AUDIENCE,
  });
  if (decoded?.purpose !== "admin_mfa" || !decoded.id) {
    throw new Error("Invalid admin MFA token");
  }
  const user = await User.findById(decoded.id);
  if (!user || !user.is_active || !isAdminUser(user)) {
    throw new Error("Invalid admin MFA user");
  }
  return user;
};

const buildSafeUser = (user, authz, avatarFallback = null) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  full_name: user.full_name,
  avatar: user.avatar || user.avatar_url || avatarFallback,
  avatar_url: user.avatar_url || avatarFallback,
  role: user.role || "student",
  bio: user.bio,
  is_vip: isVipActive(user),
  subscription_tier: user.subscription_tier || "basic",
  vip_expires_at: user.vip_expires_at || null,
  vip_package_id: user.vip_package_id || null,
  vip_allowed_subjects: user.vip_allowed_subjects || [],
  roles: authz.roles,
  permissions: authz.permissions,
  created_at: user.created_at,
});

const buildTokenPayloadWithMfa = (user, jti) => {
  const payload = buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || "basic" });
  if (isAdminUser(user)) {
    payload.admin_mfa = true;
    payload.admin_mfa_at = Math.floor(Date.now() / 1000);
  }
  return payload;
};

const buildRefreshPayloadWithMfa = (user, jti = null) => {
  const payload = { id: user.id };
  if (jti) payload.jti = jti;
  if (isAdminUser(user)) {
    payload.admin_mfa = true;
  }
  return payload;
};

const createDeviceLimitPayload = (error) => ({
  success: false,
  code: "DEVICE_LIMIT_REACHED",
  message: error.message || "Bạn đã dùng hết slot thiết bị.",
  data: {
    deviceType: error.deviceType,
    maxDevices: error.maxDevices,
    sessions: error.sessions || [],
    requestToken: error.requestToken || null,
    approveUrl: error.approveUrl || null,
    expiresAt: error.expiresAt || null,
  },
});

const isDeviceLimitError = (error) => error?.code === "DEVICE_LIMIT_REACHED";

const getFrontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const buildDeviceApprovalUrl = (challengeToken) =>
  `${getFrontendUrl()}/login?deviceApproval=${encodeURIComponent(challengeToken)}`;

const maskEmail = (email = "") => {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "email tài khoản";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
};

const buildCompletedAuthData = async (user, jti) => {
  const authz = await resolveAuthorizationContext(user);
  return {
    user: buildSafeUser(user, authz),
    token: generateToken(buildTokenPayloadWithMfa(user, jti)),
    refreshToken: generateRefreshToken(buildRefreshPayloadWithMfa(user, jti)),
  };
};

const completeDeviceLoginRequest = async (req, request) => {
  const user = await User.findById(request.user_id);
  if (!user || !user.is_active) {
    const err = new Error("Tài khoản không hợp lệ hoặc đã bị khóa.");
    err.statusCode = 403;
    throw err;
  }

  const jti = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRES_MS || "604800000", 10)));
  await DeviceSessionService.registerSession({
    userId: user.id,
    jti,
    deviceInfo: request.new_device_info || req.get("User-Agent")?.substring(0, 200) || "Unknown",
    deviceType: request.device_type || DeviceSessionService.getDeviceTypeFromUserAgent(request.new_user_agent),
    ipAddress: request.new_ip_address || getClientIp(req),
    userAgent: request.new_user_agent || req.get("User-Agent"),
    expiresAt,
  });

  await DeviceSessionService.markLoginRequestCompleted(request.challenge_token);

  return buildCompletedAuthData(user, jti);
};

const createAdminMfaRequiredResponse = async (user) => {
  const enabled = await adminMfaService.isMfaEnabled(user.id);
  return {
    success: true,
    message: enabled
      ? "Vui lòng nhập mã Microsoft Authenticator để hoàn tất đăng nhập admin."
      : "Admin cần bật Microsoft Authenticator để tiếp tục.",
    requiresAdminMfa: enabled,
    requiresAdminMfaSetup: !enabled,
    mfaToken: generateAdminMfaToken(user, enabled ? "verify" : "setup"),
    adminEmail: user.email,
  };
};

const completeLoginForUser = async (req, user, deviceInfo = "Unknown", activityAction = "login", avatarFallback = null) => {
  const jti = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRES_MS || "604800000", 10)));
  try {
    await DeviceSessionService.registerSession({
      userId: user.id,
      jti,
      deviceInfo: req.get("User-Agent")?.substring(0, 200) || deviceInfo,
      ipAddress: getClientIp(req),
      userAgent: req.get("User-Agent"),
      expiresAt,
    });
  } catch (error) {
    if (!isDeviceLimitError(error)) throw error;
    const deviceRequest = await DeviceSessionService.createLoginRequest({
      userId: user.id,
      deviceType: error.deviceType || DeviceSessionService.getDeviceTypeFromUserAgent(req.get("User-Agent")),
      deviceInfo: req.get("User-Agent")?.substring(0, 200) || deviceInfo,
      ipAddress: getClientIp(req),
      userAgent: req.get("User-Agent"),
    });
    error.requestToken = deviceRequest.challengeToken;
    error.approveUrl = buildDeviceApprovalUrl(deviceRequest.challengeToken);
    error.expiresAt = deviceRequest.expiresAt;
    throw error;
  }

  UserActivity.log(user.id, activityAction, {
    ip: getClientIp(req),
    userAgent: req.get("User-Agent"),
  });

  const authz = await resolveAuthorizationContext(user);
  const token = generateToken(buildTokenPayloadWithMfa(user, jti));
  const refreshToken = generateRefreshToken(buildRefreshPayloadWithMfa(user, jti));

  return {
    user: buildSafeUser(user, authz, avatarFallback),
    token,
    refreshToken,
  };
};

const respondWithCompletedLogin = async (req, res, user, message, activityAction = "login", avatarFallback = null) => {
  const data = await completeLoginForUser(req, user, "Unknown", activityAction, avatarFallback);
  return res.json({
    success: true,
    message,
    data,
  });
};

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
    // Send welcome + verification email (non-blocking)
    Promise.all([
      emailService.sendWelcomeEmail(email, user.full_name || username),
      emailService.sendVerificationEmail(email, user.full_name || username, verifyUrl),
    ]).catch((err) => {
      console.error(`❌ Error sending welcome/verification email: ${err.message}`);
    });

    // Register the initial session.
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

    // Log hành vi đăng ký
    UserActivity.log(user.id, 'register', {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    const token = generateToken(buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || 'basic' }));
    const refreshToken = generateRefreshToken(buildRefreshPayloadWithMfa({ ...user, jti }, jti));

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
          vip_package_id: null,
          vip_allowed_subjects: [],
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
        .json({ success: false, message: "Vui lòng nhập email/tên đăng nhập và mật khẩu" });
    }

    // Accept email or username as identifier
    const identifier = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (isEmail) {
      if (!validateEmail(identifier)) {
        return res
          .status(400)
          .json({ success: false, message: "Email không hợp lệ" });
      }
    }

    // Rate limit check
    const { blocked, remainingMin } = checkRateLimit(identifier);
    if (blocked) {
      return res.status(429).json({
        success: false,
        message: `Quá nhiều lần thử sai. Vui lòng thử lại sau ${remainingMin} phút`,
      });
    }

    const user = isEmail
      ? await User.findByEmail(identifier)
      : await User.findByUsername(identifier);

    if (!user || !user.password) {
      // Don't reveal whether email exists
      recordFailedAttempt(identifier);
      return res
        .status(401)
        .json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị vô hiệu hóa" });
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(identifier);
      return res
        .status(401)
        .json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    // Success - clear attempts
    clearAttempts(identifier);

    const deviceType = DeviceSessionService.getDeviceTypeFromUserAgent(req.get('User-Agent'));
    const hasMatchingDeviceSession = await DeviceSessionService.hasMatchingDeviceSession({
      userId: user.id,
      deviceType,
      deviceInfo: req.get('User-Agent')?.substring(0, 200) || 'Unknown',
      ipAddress: getClientIp(req),
      userAgent: req.get('User-Agent'),
    });
    const loginAllowed = await DeviceSessionService.checkLoginAllowed(user.id, deviceType);
    // Admins must finish email OTP + Authenticator before receiving a device
    // replacement challenge. This prevents email-only replacement from
    // bypassing the stronger admin MFA requirement.
    if (!isAdminUser(user) && !loginAllowed.allowed && !hasMatchingDeviceSession) {
      const deviceRequest = await DeviceSessionService.createLoginRequest({
        userId: user.id,
        deviceType,
        deviceInfo: req.get('User-Agent')?.substring(0, 200) || 'Unknown',
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent'),
      });
      return res.status(409).json(createDeviceLimitPayload({
        code: "DEVICE_LIMIT_REACHED",
        message: loginAllowed.reason,
        deviceType: loginAllowed.deviceType,
        maxDevices: loginAllowed.maxDevices,
        sessions: loginAllowed.sessions,
        requestToken: deviceRequest.challengeToken,
        approveUrl: buildDeviceApprovalUrl(deviceRequest.challengeToken),
        expiresAt: deviceRequest.expiresAt,
      }));
    }

    // ── OTP: gửi mã khi đăng nhập ────────────────────────────────────────
    const otp = await storeOtp(user.id, user.email, 'login');
    const clientIp = getClientIp(req);
    const device = parseUserAgent(req.get('User-Agent'));

    Promise.all([
      emailService.sendOtpEmail({
        email: user.email,
        name: user.full_name || user.username,
        otp,
        reason: 'login',
      }),
      emailService.sendSecurityAlert({
        email: user.email,
        name: user.full_name || user.username,
        event: 'login',
        ip: clientIp,
        location: null,
        device,
        time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      }),
    ]).catch(err => console.error('Login email error:', err.message));

    // Gửi OTP + security alert thành công → yêu cầu xác thực OTP
    return res.json({
      success: true,
      requiresOtp: true,
      userId: user.id,
      message: 'Đã gửi mã OTP đến email của bạn. Vui lòng nhập mã để đăng nhập.',
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
    
    // Tạo token mới để đồng bộ các thuộc tính như is_vip, subscription_tier
    const token = generateToken(buildTokenPayloadWithMfa({ ...user, jti: req.user.jti }, req.user.jti));

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
          avatar_url: user.avatar_url,
          role: user.role,
          bio: user.bio,
          phone: user.phone,
          study_goal: user.study_goal,
          target_score: user.target_score,
          is_verified: user.is_verified,
          is_active: user.is_active,
          is_vip: isVipActive(user),
          subscription_tier: user.subscription_tier || 'basic',
          vip_expires_at: user.vip_expires_at || null,
          vip_package_id: user.vip_package_id || null,
          vip_allowed_subjects: user.vip_allowed_subjects || [],
          coins: user.coins || 0,
          current_streak: user.current_streak || 0,
          longest_streak: user.longest_streak || 0,
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
        token, // Gửi về frontend token mới
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

    if (isAdminUser(user) && decoded.admin_mfa !== true) {
      return res.status(401).json({
        success: false,
        message: "Admin can dang nhap lai va xac minh Microsoft Authenticator.",
        code: "ADMIN_MFA_REQUIRED",
      });
    }

    let sessionJti = decoded.jti;
    if (sessionJti) {
      const activeSession = await DeviceSessionService.assertActiveSession(sessionJti, user.id);
      if (!activeSession) {
        return res.status(401).json({
          success: false,
          message: "Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại",
          code: "SESSION_REVOKED",
        });
      }
      await DeviceSessionService.touchSession(sessionJti, user.id).catch(() => {});
    } else {
      const sessions = await DeviceSessionService.getActiveSessions(user.id);
      sessionJti = sessions[0]?.jti;
      if (!sessionJti) {
        return res.status(401).json({
          success: false,
          message: "Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại",
          code: "SESSION_REVOKED",
        });
      }
    }

    const newToken = generateToken(buildTokenPayloadWithMfa(user, sessionJti));
    const newRefreshToken = generateRefreshToken(buildRefreshPayloadWithMfa(user, sessionJti));

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

// ─── Facebook OAuth (Authorization Code Flow) ───────────────────────────────
const FACEBOOK_OAUTH_VERSION = process.env.FACEBOOK_OAUTH_VERSION || 'v21.0';

const getBackendBaseUrl = (req) => {
  const configured = process.env.BACKEND_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const getFacebookRedirectUri = (req) => {
  return `${getBackendBaseUrl(req)}/api/auth/facebook/callback`;
};

const getFrontendCallbackUrl = () => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)[0] || 'http://localhost:3000';
  return `${frontendUrl.replace(/\/$/, '')}/auth/facebook/callback`;
};

const getAllowedFacebookRedirectOrigins = () => {
  const configured = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(url => url.trim())
    .filter(Boolean);

  return new Set([
    'http://localhost:3000',
    'https://molystudio.online',
    'https://www.molystudio.online',
    'https://moli.studio',
    'https://www.moli.studio',
    ...configured,
  ].map(url => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }).filter(Boolean));
};

const isSafeRedirectUrl = (redirectUrl, fallbackUrl) => {
  try {
    const requested = new URL(redirectUrl);
    const fallback = new URL(fallbackUrl);
    return requested.pathname === '/auth/facebook/callback'
      && (requested.origin === fallback.origin || getAllowedFacebookRedirectOrigins().has(requested.origin));
  } catch {
    return false;
  }
};

const createFacebookState = (redirectUrl) => {
  return jwt.sign({ redirect: redirectUrl }, process.env.JWT_SECRET, {
    expiresIn: '10m',
    issuer: 'csca-app',
    audience: 'facebook-oauth',
  });
};

const parseFacebookState = (state, fallbackUrl) => {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET, {
      issuer: 'csca-app',
      audience: 'facebook-oauth',
    });
    if (decoded?.redirect) return decoded.redirect;
  } catch {
    // Ignore invalid/expired state
  }
  return fallbackUrl;
};

const getOAuthConfig = async (req, res) => {
  return res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      facebookEnabled: Boolean(process.env.FACEBOOK_APP_ID),
    },
  });
};

const buildRedirectWithHash = (baseUrl, params) => {
  const cleanBase = baseUrl.split('#')[0];
  const hash = new URLSearchParams(params).toString();
  return hash ? `${cleanBase}#${hash}` : cleanBase;
};

const facebookAuthStart = async (req, res) => {
  try {
    const facebookAppId = process.env.FACEBOOK_APP_ID;

    if (!facebookAppId) {
      return res
        .status(500)
        .json({ success: false, message: 'Thiếu cấu hình Facebook App' });
    }

    const fallbackRedirect = getFrontendCallbackUrl();
    const requestedRedirect = typeof req.query.redirect === 'string' ? req.query.redirect : '';
    const redirectTarget =
      requestedRedirect && isSafeRedirectUrl(requestedRedirect, fallbackRedirect)
        ? requestedRedirect
        : fallbackRedirect;

    const state = createFacebookState(redirectTarget);
    const redirectUri = getFacebookRedirectUri(req);

    const authUrl = `https://www.facebook.com/${FACEBOOK_OAUTH_VERSION}/dialog/oauth?client_id=${encodeURIComponent(
      facebookAppId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(
      state,
    )}&scope=email,public_profile&response_type=code`;

    return res.redirect(authUrl);
  } catch (error) {
    console.error('Facebook auth start error:', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể khởi tạo đăng nhập Facebook' });
  }
};

const facebookAuthCallback = async (req, res) => {
  const fallbackRedirect = getFrontendCallbackUrl();
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const redirectTarget = state ? parseFacebookState(state, fallbackRedirect) : fallbackRedirect;

  try {
    const { code, error, error_description } = req.query;
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;

    if (error) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: String(error),
          message: String(error_description || 'Facebook login failed'),
        }),
      );
    }

    if (!facebookAppId || !facebookAppSecret) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'missing_config',
          message: 'Thiếu cấu hình Facebook App',
        }),
      );
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'missing_code',
          message: 'Thiếu mã xác thực Facebook',
        }),
      );
    }

    const redirectUri = getFacebookRedirectUri(req);
    const tokenUrl = `https://graph.facebook.com/${FACEBOOK_OAUTH_VERSION}/oauth/access_token?client_id=${encodeURIComponent(
      facebookAppId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(
      facebookAppSecret,
    )}&code=${encodeURIComponent(code)}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData?.access_token) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'token_exchange_failed',
          message: 'Không thể lấy access token từ Facebook',
        }),
      );
    }

    const accessToken = tokenData.access_token;
    const profileUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
      accessToken,
    )}`;
    const profileRes = await fetch(profileUrl);
    const profileData = await profileRes.json();

    if (!profileRes.ok || !profileData?.id) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'profile_fetch_failed',
          message: 'Không thể xác thực Facebook',
        }),
      );
    }

    const { id: facebookId, email, name, picture } = profileData;
    const avatarUrl = picture?.data?.url || null;
    const displayName = name || email;

    if (!email) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'missing_email',
          message: 'Facebook không cung cấp email. Vui lòng cho phép quyền email.',
        }),
      );
    }

    let user = await User.findByFacebookId(facebookId);

    if (!user) {
      const existingUser = await User.findByEmail(email);

      if (existingUser) {
        user = await User.linkFacebookAccount(existingUser.id, facebookId, avatarUrl);
      } else {
        user = await User.createFromFacebook({ facebookId, email, name: displayName, picture: avatarUrl });
        emailService.sendWelcomeEmail(email, displayName).catch(() => {});
      }
    }

    if (!user.is_active) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'account_disabled',
          message: 'Tài khoản đã bị vô hiệu hóa',
        }),
      );
    }

    if (isAdminUser(user)) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'admin_mfa_required',
          message: 'Admin vui long dang nhap bang Google hoac email de xac minh Microsoft Authenticator.',
        }),
      );
    }

    const data = await completeLoginForUser(req, user, "Facebook OAuth", "facebook_login", avatarUrl);

    return res.redirect(
      buildRedirectWithHash(redirectTarget, {
        token: data.token,
        refreshToken: data.refreshToken,
      }),
    );
  } catch (error) {
    console.error('Facebook auth callback error:', error.message);
    if (isDeviceLimitError(error)) {
      return res.redirect(
        buildRedirectWithHash(redirectTarget, {
          error: 'device_limit_reached',
          message: error.message,
          requestToken: error.requestToken,
        }),
      );
    }
    return res.redirect(
      buildRedirectWithHash(redirectTarget, {
        error: 'server_error',
        message: 'Đăng nhập Facebook thất bại, vui lòng thử lại',
      }),
    );
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────
const googleAuth = async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
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
      payload = credential
        ? await getGooglePayloadFromCredential(credential)
        : await getGooglePayloadFromAccessToken(accessToken);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Google token không hợp lệ" });
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;
    const isGoogleEmailVerified = email_verified === true || email_verified === 'true';

    if (!isGoogleEmailVerified) {
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

    if (isAdminUser(user)) {
      const mfaResponse = await createAdminMfaRequiredResponse(user);
      return res.json(mfaResponse);
    }

    const data = await completeLoginForUser(req, user, "Google OAuth", "google_login", picture);

    return res.json({
      success: true,
      message: "Đăng nhập Google thành công",
      data,
    });
  } catch (error) {
    if (isDeviceLimitError(error)) {
      return res.status(409).json(createDeviceLimitPayload(error));
    }
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

// ─── Verify OTP ────────────────────────────────────────────────────────────────
const verifyOtpController = async (req, res) => {
  try {
    const { userId, otp, reason = 'login' } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'Thiếu userId hoặc OTP.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const result = await verifyOtp(userId, otp, reason);
    if (!result.valid) {
      const msgs = {
        no_otp: 'Không tìm thấy mã OTP. Vui lòng yêu cầu mã mới.',
        expired: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
        already_used: 'Mã OTP đã được sử dụng. Vui lòng yêu cầu mã mới.',
        invalid: 'Mã OTP không đúng. Vui lòng thử lại.',
      };
      return res.status(400).json({ success: false, message: msgs[result.reason] || 'OTP không hợp lệ.' });
    }

    if (isAdminUser(user) && reason === 'login') {
      const mfaResponse = await createAdminMfaRequiredResponse(user);
      return res.json(mfaResponse);
    }

    // Xác thực thành công — tạo token
    const jti = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRES_MS || '604800000')));
    await DeviceSessionService.registerSession({
      userId: user.id,
      jti,
      deviceInfo: req.get('User-Agent')?.substring(0, 200) || 'Unknown',
      ipAddress: getClientIp(req),
      userAgent: req.get('User-Agent'),
      expiresAt,
    });

    const token = generateToken(buildTokenPayload({ ...user, jti, subscription_tier: user.subscription_tier || 'basic' }));
    const refreshToken = generateRefreshToken(buildRefreshPayloadWithMfa({ ...user, jti }, jti));
    const authz = await resolveAuthorizationContext(user);

    return res.json({
      success: true,
      message: 'Xác thực OTP thành công',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          avatar: user.avatar,
          avatar_url: user.avatar_url,
          role: user.role,
          bio: user.bio,
          is_vip: isVipActive(user),
          subscription_tier: user.subscription_tier || 'basic',
          vip_expires_at: user.vip_expires_at || null,
          vip_package_id: user.vip_package_id || null,
          vip_allowed_subjects: user.vip_allowed_subjects || [],
          roles: authz.roles,
          permissions: authz.permissions,
          created_at: user.created_at,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    if (isDeviceLimitError(error)) {
      return res.status(409).json(createDeviceLimitPayload(error));
    }
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực OTP.' });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
const adminMfaSetupStart = async (req, res) => {
  try {
    const { mfaToken } = req.body;
    if (!mfaToken) {
      return res.status(400).json({ success: false, message: "Thieu token MFA." });
    }

    const user = await verifyAdminMfaToken(mfaToken);
    const enabled = await adminMfaService.isMfaEnabled(user.id);
    if (enabled) {
      return res.status(400).json({
        success: false,
        message: "Admin da bat Microsoft Authenticator. Hay nhap ma de dang nhap.",
      });
    }

    const setup = await adminMfaService.createSetupChallenge(user);
    return res.json({
      success: true,
      message: "Quet QR bang Microsoft Authenticator roi nhap ma 6 so.",
      data: setup,
    });
  } catch (error) {
    console.error("Admin MFA setup start error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Phien MFA khong hop le hoac da het han. Vui long dang nhap lai.",
      code: "ADMIN_MFA_TOKEN_INVALID",
    });
  }
};

const adminMfaSetupConfirm = async (req, res) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, message: "Thieu token MFA hoac ma xac minh." });
    }

    const user = await verifyAdminMfaToken(mfaToken);
    const result = await adminMfaService.confirmSetup(user, code);
    if (!result.success) {
      return res.status(400).json(result);
    }

    const data = await completeLoginForUser(req, user, "Microsoft Authenticator", "admin_mfa_setup");
    return res.json({
      success: true,
      message: "Da bat Microsoft Authenticator. Hay luu ma du phong.",
      data,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    if (isDeviceLimitError(error)) {
      return res.status(409).json(createDeviceLimitPayload(error));
    }
    console.error("Admin MFA setup confirm error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Phien MFA khong hop le hoac da het han. Vui long dang nhap lai.",
      code: "ADMIN_MFA_TOKEN_INVALID",
    });
  }
};

const adminMfaVerify = async (req, res) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, message: "Thieu token MFA hoac ma xac minh." });
    }

    const user = await verifyAdminMfaToken(mfaToken);
    const result = await adminMfaService.verifyLoginCode(user, code);
    if (!result.success) {
      return res.status(400).json(result);
    }

    const data = await completeLoginForUser(req, user, "Microsoft Authenticator", "admin_mfa_login");
    return res.json({
      success: true,
      message: result.usedBackupCode
        ? `Dang nhap thanh cong bang ma du phong. Con ${result.remainingBackupCodes} ma.`
        : "Xac minh Microsoft Authenticator thanh cong.",
      data,
    });
  } catch (error) {
    if (isDeviceLimitError(error)) {
      return res.status(409).json(createDeviceLimitPayload(error));
    }
    console.error("Admin MFA verify error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Phien MFA khong hop le hoac da het han. Vui long dang nhap lai.",
      code: "ADMIN_MFA_TOKEN_INVALID",
    });
  }
};

const getDeviceLoginRequestStatus = async (req, res) => {
  try {
    const request = await DeviceSessionService.getLoginRequest(req.params.token);
    if (!request) {
      return res.status(404).json({ success: false, message: "Yêu cầu thay thiết bị không tồn tại." });
    }
    if (new Date(request.expires_at) < new Date() && request.status === "pending") {
      await DeviceSessionService.expireLoginRequest(request.challenge_token);
      return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
    }
    if (request.status === "completed" && request.replacement_jti) {
      if (new Date(request.expires_at) < new Date()) {
        return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
      }
      const user = await User.findById(request.user_id);
      const active = await DeviceSessionService.assertActiveSession(request.replacement_jti, request.user_id);
      if (!user || !active) {
        return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Phiên đăng nhập mới không còn hiệu lực." });
      }
      const data = await buildCompletedAuthData(user, request.replacement_jti);
      return res.json({ success: true, status: "completed", data });
    }
    if (request.status === "approved") {
      const data = await completeDeviceLoginRequest(req, request);
      return res.json({ success: true, status: "completed", data });
    }
    const sessions = (await DeviceSessionService.getActiveSessions(request.user_id))
      .filter((session) => (session.device_type || "desktop") === request.device_type);
    const maxDevices = await DeviceSessionService.getUserMaxDevices(request.user_id, request.device_type);
    return res.json({
      success: true,
      status: request.status,
      expiresAt: request.expires_at,
      deviceType: request.device_type,
      deviceLimit: request.status === "pending" ? {
        deviceType: request.device_type,
        maxDevices,
        sessions,
        requestToken: request.challenge_token,
        approveUrl: buildDeviceApprovalUrl(request.challenge_token),
        expiresAt: request.expires_at,
        targetSessionJti: request.target_session_jti || null,
      } : undefined,
    });
  } catch (error) {
    console.error("Device login status error:", error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Không kiểm tra được yêu cầu thay thiết bị." });
  }
};

const getDeviceLoginRequestQr = async (req, res) => {
  try {
    const request = await DeviceSessionService.getLoginRequest(req.params.token);
    if (!request || request.status !== "pending" || new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
    }
    const svg = await QRCode.toString(buildDeviceApprovalUrl(request.challenge_token), {
      type: "svg",
      margin: 1,
      width: 180,
      errorCorrectionLevel: "M",
    });
    res.set("Cache-Control", "no-store");
    return res.type("image/svg+xml").send(svg);
  } catch (error) {
    console.error("Device approval QR error:", error.message);
    return res.status(500).json({ success: false, message: "Không thể tạo mã QR." });
  }
};

const selectDeviceLoginTarget = async (req, res) => {
  try {
    const { sessionJti } = req.body || {};
    if (!sessionJti) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn thiết bị cần đăng xuất." });
    }
    const request = await DeviceSessionService.setLoginRequestTarget(req.params.token, sessionJti);
    if (!request) {
      return res.status(409).json({ success: false, code: "DEVICE_TARGET_INVALID", message: "Thiết bị đã chọn không còn khả dụng hoặc yêu cầu đã hết hạn." });
    }
    return res.json({ success: true, message: "Đã chọn thiết bị cần thay.", targetSessionJti: request.target_session_jti });
  } catch (error) {
    console.error("Select device target error:", error.message);
    return res.status(500).json({ success: false, message: "Không thể chọn thiết bị cần thay." });
  }
};

const approveDeviceLoginRequest = async (req, res) => {
  try {
    const request = await DeviceSessionService.getLoginRequest(req.params.token);
    if (!request) {
      return res.status(404).json({ success: false, message: "Yêu cầu thay thiết bị không tồn tại." });
    }
    if (request.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền duyệt yêu cầu này." });
    }
    if (request.status !== "pending" || new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
    }

    const newJti = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_MS || "604800000", 10));
    await DeviceSessionService.approveLoginRequestWithSession(
      request.challenge_token,
      req.user.id,
      req.user.jti,
      newJti,
      expiresAt,
    );
    return res.json({ success: true, message: "Đã duyệt thiết bị mới. Thiết bị hiện tại sẽ đăng xuất." });
  } catch (error) {
    console.error("Device login approve error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || "Không thể duyệt thiết bị mới.",
    });
  }
};

const sendDeviceReplacementOtp = async (req, res) => {
  try {
    const request = await DeviceSessionService.getLoginRequest(req.params.token);
    if (!request || request.status !== "pending" || new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
    }
    if (!request.target_session_jti) {
      return res.status(400).json({ success: false, code: "DEVICE_TARGET_REQUIRED", message: "Vui lòng chọn thiết bị cần đăng xuất trước." });
    }
    if (request.otp_sent_at && Date.now() - new Date(request.otp_sent_at).getTime() < 60000) {
      const retryAfterSeconds = Math.ceil((60000 - (Date.now() - new Date(request.otp_sent_at).getTime())) / 1000);
      return res.status(429).json({ success: false, code: "OTP_RESEND_TOO_SOON", message: `Vui lòng đợi ${retryAfterSeconds} giây trước khi gửi lại OTP.`, retryAfterSeconds });
    }
    const user = await User.findById(request.user_id);
    if (!user || !user.email) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản." });
    }
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    const stored = await DeviceSessionService.storeLoginRequestOtp(request.challenge_token, otpHash, otpExpiresAt);
    if (!stored) {
      return res.status(410).json({ success: false, code: "DEVICE_REQUEST_EXPIRED", message: "Yêu cầu thay thiết bị đã hết hạn." });
    }
    await emailService.sendOtpEmail({
      email: user.email,
      name: user.full_name || user.username,
      otp,
      reason: "device_replace",
    });
    return res.json({
      success: true,
      message: `Đã gửi OTP đến ${maskEmail(user.email)}.`,
      maskedEmail: maskEmail(user.email),
      retryAfterSeconds: 60,
    });
  } catch (error) {
    console.error("Device replacement OTP error:", error.message);
    return res.status(500).json({ success: false, message: "Không thể gửi OTP thay thiết bị." });
  }
};

const verifyDeviceReplacementOtp = async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (!/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({ success: false, message: "OTP phải gồm đúng 6 chữ số." });
    }
    const jti = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_MS || "604800000", 10));
    const request = await DeviceSessionService.replaceSessionWithOtp({
      challengeToken: req.params.token,
      otp: String(otp),
      newJti: jti,
      expiresAt,
    });
    const user = await User.findById(request.user_id);
    const data = await buildCompletedAuthData(user, jti);
    emailService.sendSecurityAlert({
      email: user.email,
      name: user.full_name || user.username,
      event: "device_replaced",
      ip: request.new_ip_address || getClientIp(req),
      location: null,
      device: parseUserAgent(request.new_user_agent),
      time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    }).catch(() => {});
    return res.json({ success: true, message: "Đã xác minh và đăng nhập thiết bị mới.", data });
  } catch (error) {
    console.error("Device replacement verify error:", error.message);
    return res.status(error.statusCode || 500).json({ success: false, code: error.code, message: error.message || "Không thể xác minh thay thiết bị." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { userId, reason = 'login' } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Thiếu userId.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    const otp = await storeOtp(userId, user.email, reason);
    await emailService.sendOtpEmail({
      email: user.email,
      name: user.full_name || user.username,
      otp,
      reason,
    });

    return res.json({ success: true, message: 'Đã gửi lại mã OTP.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi gửi lại OTP.' });
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
  getOAuthConfig,
  googleAuth,
  facebookAuthStart,
  facebookAuthCallback,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyOtp: verifyOtpController,
  getDeviceLoginRequestStatus,
  getDeviceLoginRequestQr,
  selectDeviceLoginTarget,
  approveDeviceLoginRequest,
  sendDeviceReplacementOtp,
  verifyDeviceReplacementOtp,
  adminMfaSetupStart,
  adminMfaSetupConfirm,
  adminMfaVerify,
  resendOtp,
};
