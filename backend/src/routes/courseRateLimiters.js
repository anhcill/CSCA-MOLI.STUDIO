const rateLimit = require("express-rate-limit");

const isProduction = process.env.NODE_ENV === "production";

function positiveIntegerEnv(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  if (!/^\d+$/.test(rawValue)) throw new Error(`${name} must be a positive integer`);
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const skipOptions = (req) => req.method === "OPTIONS";
const skipReadOnly = (req) => ["OPTIONS", "GET", "HEAD"].includes(req.method);

function createLimiter({ windowEnv, maxEnv, defaultWindowMs, productionMax, developmentMax, skip }) {
  return rateLimit({
    windowMs: positiveIntegerEnv(windowEnv, defaultWindowMs),
    max: positiveIntegerEnv(maxEnv, isProduction ? productionMax : developmentMax),
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
      });
    },
  });
}

const enrollmentLimiter = createLimiter({
  windowEnv: "COURSE_ENROLL_RATE_LIMIT_WINDOW_MS",
  maxEnv: "COURSE_ENROLL_RATE_LIMIT_MAX",
  defaultWindowMs: 15 * 60 * 1000,
  productionMax: 10,
  developmentMax: 100,
  skip: skipOptions,
});

const progressLimiter = createLimiter({
  windowEnv: "COURSE_PROGRESS_RATE_LIMIT_WINDOW_MS",
  maxEnv: "COURSE_PROGRESS_RATE_LIMIT_MAX",
  defaultWindowMs: 60 * 1000,
  productionMax: 180,
  developmentMax: 1000,
  skip: skipOptions,
});

const playbackLimiter = createLimiter({
  windowEnv: "COURSE_PLAYBACK_RATE_LIMIT_WINDOW_MS",
  maxEnv: "COURSE_PLAYBACK_RATE_LIMIT_MAX",
  defaultWindowMs: 5 * 60 * 1000,
  productionMax: 30,
  developmentMax: 300,
  skip: skipOptions,
});

const adminWriteLimiter = createLimiter({
  windowEnv: "COURSE_ADMIN_RATE_LIMIT_WINDOW_MS",
  maxEnv: "COURSE_ADMIN_RATE_LIMIT_MAX",
  defaultWindowMs: 15 * 60 * 1000,
  productionMax: 60,
  developmentMax: 600,
  skip: skipReadOnly,
});

const mediaUploadLimiter = createLimiter({
  windowEnv: "COURSE_MEDIA_RATE_LIMIT_WINDOW_MS",
  maxEnv: "COURSE_MEDIA_RATE_LIMIT_MAX",
  defaultWindowMs: 15 * 60 * 1000,
  productionMax: 30,
  developmentMax: 300,
  skip: skipOptions,
});

module.exports = {
  adminWriteLimiter,
  enrollmentLimiter,
  mediaUploadLimiter,
  playbackLimiter,
  progressLimiter,
};
