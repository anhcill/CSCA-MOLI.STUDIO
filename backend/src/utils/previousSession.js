const jwt = require("jsonwebtoken");

// This is only a device identity hint after normal login verification. An
// expired access token must never grant authentication or bypass login OTP.
function getPreviousSessionJti(token, userId) {
  if (typeof token !== "string" || token.length > 8192) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "csca-app",
      algorithms: ["HS256"],
      ignoreExpiration: true,
    });
    if (payload.id !== userId || typeof payload.email !== "string" || payload.aud) return null;
    return typeof payload.jti === "string" && /^[a-f0-9]{32}$/.test(payload.jti)
      ? payload.jti
      : null;
  } catch {
    return null;
  }
}

module.exports = { getPreviousSessionJti };
