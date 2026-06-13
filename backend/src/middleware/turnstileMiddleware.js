const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const getTurnstileSecret = () =>
  process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";

const getClientIp = (req) =>
  req.headers["cf-connecting-ip"] ||
  req.headers["true-client-ip"] ||
  req.headers["x-real-ip"] ||
  req.ip;

const verifyTurnstile = async (req, res, next) => {
  const secret = getTurnstileSecret();
  if (!secret || process.env.TURNSTILE_DISABLED === "true") {
    return next();
  }

  const token =
    req.body?.turnstileToken ||
    req.body?.cfTurnstileToken ||
    req.headers["cf-turnstile-response"];

  if (!token || typeof token !== "string") {
    return res.status(403).json({
      success: false,
      message: "Vui long xac nhan Cloudflare truoc khi tiep tuc.",
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
        message: "Xac minh Cloudflare that bai. Vui long thu lai.",
        code: "TURNSTILE_FAILED",
      });
    }

    return next();
  } catch (error) {
    console.error("Turnstile verify error:", error.message);
    return res.status(503).json({
      success: false,
      message: "Chua xac minh duoc Cloudflare. Vui long thu lai sau.",
      code: "TURNSTILE_UNAVAILABLE",
    });
  }
};

module.exports = {
  verifyTurnstile,
};
