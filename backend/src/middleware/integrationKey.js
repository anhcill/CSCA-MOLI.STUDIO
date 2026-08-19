const crypto = require("node:crypto");

function requireIntegrationKey(req, res, next) {
  const expected = String(process.env.INTEGRATION_API_KEY || "").trim();
  const provided = String(req.get("X-Integration-Key") || "").trim();

  // Không bật endpoint nếu Railway chưa có secret; tránh accidental public export.
  if (!expected) {
    return res.status(503).json({
      success: false,
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "Integration endpoint is not configured.",
    });
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  const validLength = expectedBuffer.length === providedBuffer.length;
  const validKey = validLength && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!validKey) {
    return res.status(401).json({
      success: false,
      code: "INVALID_INTEGRATION_KEY",
      message: "Integration key is invalid.",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return next();
}

module.exports = { requireIntegrationKey };
