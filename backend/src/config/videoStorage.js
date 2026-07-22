const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;
const DEFAULT_PLAYBACK_TTL_SECONDS = 4 * 60 * 60;

function integerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function getVideoStorageConfig() {
  return {
    accountId: String(process.env.VIDEO_R2_ACCOUNT_ID || "").trim(),
    endpoint: String(process.env.VIDEO_R2_ENDPOINT || "").trim().replace(/\/+$/, ""),
    accessKeyId: String(process.env.VIDEO_R2_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: String(process.env.VIDEO_R2_SECRET_ACCESS_KEY || "").trim(),
    bucket: String(process.env.VIDEO_R2_BUCKET || "").trim(),
    gatewayBaseUrl: String(process.env.VIDEO_GATEWAY_BASE_URL || "").trim().replace(/\/+$/, ""),
    playbackTokenSecret: String(process.env.VIDEO_PLAYBACK_TOKEN_SECRET || "").trim(),
    playbackTokenIssuer: String(process.env.VIDEO_PLAYBACK_TOKEN_ISSUER || "csca-api").trim(),
    playbackTokenAudience: String(process.env.VIDEO_PLAYBACK_TOKEN_AUDIENCE || "csca-video-gateway").trim(),
    uploadTtlSeconds: integerEnv("VIDEO_UPLOAD_TTL_SECONDS", DEFAULT_UPLOAD_TTL_SECONDS, 60, 3600),
    playbackTtlSeconds: integerEnv("VIDEO_PLAYBACK_TTL_SECONDS", DEFAULT_PLAYBACK_TTL_SECONDS, 15 * 60, 6 * 60 * 60),
  };
}

function assertUploadConfig(config = getVideoStorageConfig()) {
  if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    const error = new Error("VIDEO_UPLOAD_CONFIG_MISSING");
    error.code = "VIDEO_UPLOAD_CONFIG_MISSING";
    error.statusCode = 503;
    throw error;
  }
  return config;
}

function assertPlaybackConfig(config = getVideoStorageConfig()) {
  if (!config.gatewayBaseUrl || !config.playbackTokenSecret || config.playbackTokenSecret.length < 32) {
    const error = new Error("VIDEO_PLAYBACK_CONFIG_MISSING");
    error.statusCode = 503;
    throw error;
  }
  return config;
}

module.exports = { assertPlaybackConfig, assertUploadConfig, getVideoStorageConfig };
