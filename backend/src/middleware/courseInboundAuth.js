const crypto = require("crypto");
const { constantTimeEqual } = require("../utils/ssoPathPolicy");

function resolveInboundConfig(config = {}, env = process.env) {
  const maxAge = Number.parseInt(String(config.maxAgeSeconds ?? env.COURSE_INBOUND_MAX_AGE_SECONDS ?? "300"), 10);
  return {
    serviceToken: String(config.serviceToken ?? env.COURSE_INBOUND_SERVICE_TOKEN ?? "").trim(),
    integrationKey: String(config.integrationKey ?? env.COURSE_INBOUND_INTEGRATION_KEY ?? "").trim(),
    hmacSecret: String(config.hmacSecret ?? env.COURSE_INBOUND_HMAC_SECRET ?? "").trim(),
    maxAgeSeconds: Number.isFinite(maxAge) && maxAge > 0 ? Math.min(maxAge, 900) : 300,
  };
}

function createCourseInboundAuth({ config = {}, env = process.env, allowBodylessGet = false } = {}) {
  return function verifyCourseInboundAuth(req, res, next) {
    const cfg = resolveInboundConfig(config, env);
    if (!cfg.serviceToken || !cfg.integrationKey || !cfg.hmacSecret) {
      return res.status(503).json({
        success: false,
        code: "COURSE_INBOUND_AUTH_NOT_CONFIGURED",
        message: "Course inbound SSO authentication is not configured.",
      });
    }

    const authHeader = String(req.get("Authorization") || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const integrationKey = String(req.get("X-Integration-Key") || "").trim();
    const timestamp = String(req.get("X-Event-Timestamp") || req.get("X-Timestamp") || "").trim();
    const signature = String(req.get("X-Signature") || "").trim();
    const correlationId = String(req.get("X-Correlation-ID") || req.body?.correlation_id || "").trim() || null;

    if (!constantTimeEqual(bearerToken, cfg.serviceToken) || !constantTimeEqual(integrationKey, cfg.integrationKey)) {
      return res.status(401).json({
        success: false,
        code: "INVALID_INTEGRATION_CREDENTIALS",
        message: "Invalid integration credentials.",
        correlation_id: correlationId,
      });
    }

    const tsMs = Date.parse(timestamp);
    if (!timestamp || !Number.isFinite(tsMs)) {
      return res.status(401).json({
        success: false,
        code: "INVALID_EVENT_TIMESTAMP",
        message: "Valid timestamp header is required.",
        correlation_id: correlationId,
      });
    }
    if (Math.abs(Date.now() - tsMs) > cfg.maxAgeSeconds * 1000) {
      return res.status(401).json({
        success: false,
        code: "STALE_EVENT_TIMESTAMP",
        message: "Signed request timestamp is outside the permitted window.",
        correlation_id: correlationId,
      });
    }

    const httpMethod = String(req.method || "POST").toUpperCase();
    const isBodylessRead = allowBodylessGet
      && (httpMethod === "GET" || httpMethod === "HEAD")
      && (!Buffer.isBuffer(req.rawBody) || req.rawBody.length === 0);

    let expectedDigest;
    if (isBodylessRead) {
      const canonicalInput = `${httpMethod}\n${req.originalUrl || req.url || "/"}`;
      expectedDigest = crypto
        .createHmac("sha256", cfg.hmacSecret)
        .update(Buffer.from(`${timestamp}.${canonicalInput}`, "utf8"))
        .digest("hex");
    } else {
      if (!Buffer.isBuffer(req.rawBody)) {
        return res.status(400).json({ success: false, code: "RAW_BODY_REQUIRED", message: "Raw JSON bytes are required." });
      }
      const rawBodyBuf = req.rawBody;
      expectedDigest = crypto
        .createHmac("sha256", cfg.hmacSecret)
        .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBodyBuf]))
        .digest("hex");
    }
    const expectedSig = `sha256=${expectedDigest}`;

    if (!constantTimeEqual(signature.toLowerCase(), expectedSig.toLowerCase())) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SIGNATURE",
        message: "HMAC signature verification failed.",
        correlation_id: correlationId,
      });
    }

    req.courseInbound = {
      sourceSystem: "csca-course",
      correlationId,
      timestamp,
    };
    return next();
  };
}

module.exports = {
  createCourseInboundAuth,
};
