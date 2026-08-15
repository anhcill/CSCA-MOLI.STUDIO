const DEFAULT_FRONTEND_URL = "http://localhost:3000";

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getPrimaryFrontendUrl = (configured = process.env.FRONTEND_URL) => {
  const candidates = String(configured || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const frontendUrl = candidates.find(isHttpUrl) || DEFAULT_FRONTEND_URL;
  return frontendUrl.replace(/\/+$/, "");
};

module.exports = { getPrimaryFrontendUrl };
