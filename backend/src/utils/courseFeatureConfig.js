function parseFeatureFlag(rawValue, name = "feature flag") {
  if (rawValue === undefined || rawValue === null || rawValue === "" || rawValue === "false") {
    return false;
  }
  if (rawValue === "true") return true;
  throw new Error(`${name} must be exactly "true" or "false"`);
}

function getHttpOrigin(rawValue, { requireHttps = false } = {}) {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (requireHttps && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

module.exports = { getHttpOrigin, parseFeatureFlag };
