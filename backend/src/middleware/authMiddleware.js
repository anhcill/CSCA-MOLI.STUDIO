const jwt = require("jsonwebtoken");
const db = require("../config/database");

/**
 * Auth Middleware
 * Verifies the JWT, checks blacklist, and attaches decoded payload to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Authorization denied.",
      });
    }

    const token = authHeader.split(" ")[1];
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

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || "student",
        jti: decoded.jti,
        exp: decoded.exp,
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

module.exports = {
  authenticate: authMiddleware,
  optionalAuth,
  authorize,
};
