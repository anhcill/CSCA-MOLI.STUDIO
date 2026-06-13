const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { getAuthorizationContext } = require("../services/rbacService");
const { canAccessVipContent } = require("../utils/vipEntitlements");

const getFreshAuthUser = async (userId) => {
  const { rows } = await db.query(
    `WITH active AS (
       SELECT
         e.user_id,
         BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre') OR '*' = ANY(e.allowed_subjects)) AS has_all,
         BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre')) AS has_premium,
         MAX(e.expires_at) AS max_expires_at,
         (ARRAY_AGG(e.package_id ORDER BY e.created_at DESC, e.id DESC))[1] AS latest_package_id,
         ARRAY_AGG(DISTINCT subject) FILTER (WHERE subject IS NOT NULL AND subject <> '*') AS subjects
       FROM user_vip_entitlements e
       LEFT JOIN LATERAL UNNEST(e.allowed_subjects) AS subject ON true
       WHERE e.user_id = $1
         AND e.is_active = true
         AND (e.expires_at IS NULL OR e.expires_at > NOW())
       GROUP BY e.user_id
     )
     SELECT
       u.id, u.email, u.role, u.is_active,
       CASE WHEN active.user_id IS NOT NULL THEN true ELSE u.is_vip END AS is_vip,
       CASE
         WHEN active.user_id IS NULL THEN COALESCE(u.subscription_tier, 'basic')
         WHEN active.has_premium THEN 'premium'
         ELSE 'vip'
       END AS subscription_tier,
       CASE WHEN active.user_id IS NOT NULL THEN active.max_expires_at ELSE u.vip_expires_at END AS vip_expires_at,
       CASE WHEN active.user_id IS NOT NULL THEN active.latest_package_id ELSE u.vip_package_id END AS vip_package_id,
       CASE
         WHEN active.user_id IS NULL THEN COALESCE(u.vip_allowed_subjects, ARRAY[]::text[])
         WHEN active.has_all THEN ARRAY['*']::text[]
         ELSE COALESCE(active.subjects, ARRAY[]::text[])
       END AS vip_allowed_subjects
     FROM users u
     LEFT JOIN active ON active.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
};

const buildRequestUser = (decoded, freshUser) => ({
  id: freshUser.id,
  email: freshUser.email || decoded.email,
  role: freshUser.role || decoded.role || "student",
  jti: decoded.jti,
  exp: decoded.exp,
  is_vip: freshUser.is_vip === true,
  vip_expires_at: freshUser.vip_expires_at || null,
  subscription_tier: freshUser.subscription_tier || "basic",
  vip_package_id: freshUser.vip_package_id || null,
  vip_allowed_subjects: freshUser.vip_allowed_subjects || [],
});

/**
 * Auth Middleware
 * Verifies the JWT, checks blacklist, and attaches decoded payload to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // Check authorization header.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Authorization denied.",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded.id) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid token payload" });
      }

      // ── Blacklist check ──────────────────────────────────
      if (decoded.jti) {
        const { rows } = await db.query(
          "SELECT id FROM token_blacklist WHERE token_jti = $1 LIMIT 1",
          [decoded.jti],
        );
        if (rows.length > 0) {
          return res.status(401).json({
            success: false,
            message: "Token đã bị thu hồi, vui lòng đăng nhập lại",
            code: "TOKEN_REVOKED",
          });
        }
      }

      // ── Device session touch (keep session alive) ───────────────────────────
      if (decoded.jti) {
        db.query(
          `UPDATE user_sessions SET last_active = NOW() WHERE jti = $1`,
          [decoded.jti]
        ).catch(() => {}); // non-blocking
      }

      const freshUser = await getFreshAuthUser(decoded.id);
      if (!freshUser) {
        return res.status(401).json({ success: false, message: "User not found" });
      }
      if (freshUser.is_active === false) {
        return res.status(403).json({ success: false, message: "Account disabled" });
      }

      if (freshUser.role === "admin" && decoded.admin_mfa !== true) {
        return res.status(401).json({
          success: false,
          message: "Admin cần đăng nhập lại và xác minh Microsoft Authenticator.",
          code: "ADMIN_MFA_REQUIRED",
        });
      }

      req.user = buildRequestUser(decoded, freshUser);

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error in authentication" });
  }
};

/**
 * Role-based authorization — checks req.user.role set by authMiddleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

/**
 * Permission-based authorization (RBAC).
 * Backward compatible: legacy admin role bypasses permission checks.
 */
const authorizePermission = (...permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (permissions.length === 0) {
      return next();
    }

    const legacyAdminBypassEnabled =
      String(process.env.RBAC_LEGACY_ADMIN_BYPASS || "false").toLowerCase() ===
      "true";

    // Legacy compatibility path can be toggled via env during migration only.
    if (legacyAdminBypassEnabled && req.user.role === "admin") {
      req.user.rbacRoles = ["super_admin"];
      req.user.permissions = ["*"];
      return next();
    }

    try {
      const authz = await getAuthorizationContext(req.user.id);
      req.user.rbacRoles = authz.roles;
      req.user.permissions = authz.permissions;

      if (authz.roles.includes("super_admin") || authz.permissions.includes("*")) {
        return next();
      }

      const hasAllPermissions = permissions.every((permission) =>
        authz.permissions.includes(permission),
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Missing required permissions.",
          requiredPermissions: permissions,
        });
      }

      return next();
    } catch (error) {
      console.error("RBAC authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error in authorization",
      });
    }
  };
};

/**
 * OR-logic permission check: passes if user has AT LEAST ONE of the listed permissions.
 * Use when a resource is shared between multiple admin roles.
 * Example: image upload is used by both exam_admin AND content_admin.
 */
const authorizeAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (permissions.length === 0) return next();

    try {
      const authz = await getAuthorizationContext(req.user.id);
      req.user.rbacRoles = authz.roles;
      req.user.permissions = authz.permissions;

      if (authz.roles.includes("super_admin") || authz.permissions.includes("*")) {
        return next();
      }

      const hasAny = permissions.some((p) => authz.permissions.includes(p));
      if (!hasAny) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Requires one of: " + permissions.join(", "),
        });
      }
      return next();
    } catch (error) {
      console.error("RBAC authorizeAnyPermission error:", error);
      return res.status(500).json({ success: false, message: "Server error in authorization" });
    }
  };
};

/**
 * Optional authentication does not fail if token is absent.
 * Hydrates VIP/Pre fields from DB so manual grants work with old tokens.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id) {
        const freshUser = await getFreshAuthUser(decoded.id);
        if (freshUser && freshUser.is_active !== false) {
          req.user = buildRequestUser(decoded, freshUser);
        }
      }
    } catch {
      // Invalid/expired token — just continue without user
    }
    next();
  } catch {
    next();
  }
};

// ─── VIP helper (exported for use in controllers/routes) ─────────────────────
/**
 * Checks if a user object represents an active VIP member.
 * VIP only has AI analysis (no video/chat).
 */
const checkVipAccess = (user, subjectCode = null) => {
  if (!user) return false;
  const isVip =
    user.is_vip === true ||
    user.subscription_tier === 'vip' ||
    user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return isVip && notExpired && canAccessVipContent(user, 'vip', subjectCode);
};

const checkVipContentAccess = canAccessVipContent;

/**
 * Premium = VIP + Video giải đề + Chat giảng viên
 * Premium has ALL features: AI + Video + Chat
 */
const checkPremiumAccess = (user) => {
  if (!user) return false;
  const isPremium = user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return isPremium && notExpired;
};

/**
 * Can use AI features: Premium OR VIP
 */
const canUseAIFeatures = (user) => {
  if (!user) return false;
  const isPremium = checkPremiumAccess(user);
  const isVip = checkVipAccess(user);
  return isPremium || isVip;
};

/**
 * Can watch video explanations: Premium only
 */
const canWatchVideoExplanation = (user) => {
  return checkPremiumAccess(user);
};

/**
 * Can chat with instructor: Premium only
 */
const canChatWithInstructor = (user) => {
  return checkPremiumAccess(user);
};

module.exports = {
  authenticate: authMiddleware,
  optionalAuth,
  authorize,
  authorizePermission,
  authorizeAnyPermission,
  checkVipAccess,
  checkVipContentAccess,
  checkPremiumAccess,
  canUseAIFeatures,
  canWatchVideoExplanation,
  canChatWithInstructor,
};
