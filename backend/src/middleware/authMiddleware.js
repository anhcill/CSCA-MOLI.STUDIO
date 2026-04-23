const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { getAuthorizationContext } = require("../services/rbacService");

/**
 * Auth Middleware
 * Verifies the JWT, checks blacklist, and attaches decoded payload to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // Check authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      // Fallback to query param for direct download/iframe links
      token = req.query.token;
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

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || "student",
        jti: decoded.jti,
        exp: decoded.exp,
        is_vip: decoded.is_vip === true,
        vip_expires_at: decoded.vip_expires_at || null,
        subscription_tier: decoded.subscription_tier || 'basic',
      };

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
 * Optional authentication — does NOT fail if token is absent.
 * ✅ P1 fix: No DB query.
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role || "student",
          is_vip: decoded.is_vip === true,
          vip_expires_at: decoded.vip_expires_at || null,
          subscription_tier: decoded.subscription_tier || 'basic',
        };
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
 * Handles both req.user (decoded JWT) and DB user objects.
 */
const checkVipAccess = (user) => {
  if (!user) return false;
  const isVip = user.is_vip === true || user.subscription_tier === 'vip' || user.subscription_tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return isVip && notExpired;
};

module.exports = {
  authenticate: authMiddleware,
  optionalAuth,
  authorize,
  authorizePermission,
  authorizeAnyPermission,
  checkVipAccess,
};
