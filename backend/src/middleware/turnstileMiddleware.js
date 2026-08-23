const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const getTurnstileSecret = () =>
  process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";

const getClientIp = (req) =>
  req.headers["cf-connecting-ip"] ||
  req.headers["true-client-ip"] ||
  req.headers["x-real-ip"] ||
  req.ip;

const isProduction = () => process.env.NODE_ENV === "production";

const allowFailOpen = () =>
  process.env.TURNSTILE_ALLOW_FAIL_OPEN === "true" && !isProduction();

const getAllowedHostnames = () => {
  const configured =
    process.env.TURNSTILE_ALLOWED_HOSTNAMES || process.env.FRONTEND_URL || "";
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).hostname.toLowerCase();
      } catch {
        return value.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      }
    })
    .filter(Boolean);
};

const hostnameMatches = (hostname, allowed) => {
  if (!hostname || !allowed) return false;
  if (allowed.startsWith("*.")) {
    const suffix = allowed.slice(1);
    return hostname.endsWith(suffix) && hostname !== suffix.slice(1);
  }
  return hostname === allowed;
};

const verifyTurnstile = async (req, res, next) => {
  const secret = getTurnstileSecret();
  const disabled = process.env.TURNSTILE_DISABLED === "true";
  if ((!secret || disabled) && (allowFailOpen() || !isProduction())) {
    return next();
  }
  if (!secret || disabled) {
    return res.status(503).json({
      success: false,
      message: "Dịch vụ xác minh đang được cấu hình, vui lòng thử lại sau.",
      code: "TURNSTILE_NOT_CONFIGURED",
    });
  }

  const token =
    req.body?.turnstileToken ||
    req.body?.cfTurnstileToken ||
    req.headers["cf-turnstile-response"];

  if (!token || typeof token !== "string") {
    return res.status(403).json({
      success: false,
      message: "Vui lòng xác nhận Cloudflare trước khi tiếp tục.",
      code: "TURNSTILE_REQUIRED",
    });
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const remoteIp = getClientIp(req);
    if (remoteIp) form.set("remoteip", String(remoteIp));

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Turnstile verify HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      return res.status(403).json({
        success: false,
        message: "Xác minh Cloudflare thất bại. Vui lòng thử lại.",
        code: "TURNSTILE_FAILED",
      });
    }

    const allowedHostnames = getAllowedHostnames();
    if (
      allowedHostnames.length > 0 &&
      !hostnameMatches(String(data.hostname || "").toLowerCase(), allowedHostnames)
    ) {
      return res.status(403).json({
        success: false,
        message: "Phiên xác minh Cloudflare không thuộc website này.",
        code: "TURNSTILE_HOSTNAME_MISMATCH",
      });
    }

    const expectedAction = String(process.env.TURNSTILE_EXPECTED_ACTION || "").trim();
    if (expectedAction && data.action !== expectedAction) {
      return res.status(403).json({
        success: false,
        message: "Phiên xác minh Cloudflare không hợp lệ.",
        code: "TURNSTILE_ACTION_MISMATCH",
      });
    }

    return next();
  } catch (error) {
    console.error("Turnstile verify error:", error.message);
    return res.status(503).json({
      success: false,
      message: "Chưa xác minh được Cloudflare. Vui lòng thử lại sau.",
      code: "TURNSTILE_UNAVAILABLE",
    });
  }
};

module.exports = {
  verifyTurnstile,
};
