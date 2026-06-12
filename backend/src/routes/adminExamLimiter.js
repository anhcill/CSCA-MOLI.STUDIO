const rateLimit = require("express-rate-limit");

const aiReviewCooldowns = new Map();
const AI_REVIEW_COOLDOWN_MS = Number(process.env.ADMIN_AI_REVIEW_COOLDOWN_MS || 15_000);

function getLimiterKey(req) {
  return req.user?.id?.toString() || req.ip;
}

function examAiReviewCooldown(req, res, next) {
  const key = getLimiterKey(req);
  const now = Date.now();
  const current = aiReviewCooldowns.get(key);

  if (current?.inFlight) {
    return res.status(429).json({
      message: "AI đang soát đề. Vui lòng chờ kết quả, đừng bấm lại để tránh tốn phí.",
      retryAfter: Math.ceil(AI_REVIEW_COOLDOWN_MS / 1000),
    });
  }

  if (current?.until && current.until > now) {
    return res.status(429).json({
      message: "Bạn vừa chạy AI soát đề. Chờ một chút rồi thử lại để tránh spam.",
      retryAfter: Math.ceil((current.until - now) / 1000),
    });
  }

  const startedAt = now;
  aiReviewCooldowns.set(key, { inFlight: true, startedAt });

  let released = false;
  const releaseAiReviewLock = () => {
    if (released) return;
    released = true;
    const record = aiReviewCooldowns.get(key);
    if (record?.startedAt !== startedAt) return;

    const until = Date.now() + AI_REVIEW_COOLDOWN_MS;
    aiReviewCooldowns.set(key, { inFlight: false, startedAt, until });
    setTimeout(() => {
      const latest = aiReviewCooldowns.get(key);
      if (latest?.startedAt === startedAt && !latest.inFlight) {
        aiReviewCooldowns.delete(key);
      }
    }, AI_REVIEW_COOLDOWN_MS + 1000);
  };

  res.once("finish", releaseAiReviewLock);
  res.once("close", releaseAiReviewLock);

  next();
}

/** Cảnh báo admin spam tạo/sửa đề thi */
const examWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30,              // Tối đa 30 request/phút (tạo đề, thêm câu hỏi, cập nhật...)
  message: {
    error: "Too many exam write requests. Please wait a moment.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
});

/** Giới hạn nghiêm ngặt cho xóa đề */
const examImportPreviewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    message: "Bạn đang import đề quá nhanh. Vui lòng đợi vài phút rồi thử lại để tránh tốn phí AI.",
    retryAfter: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
});

const examImageOcrLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: {
    message: "Bạn đang OCR ảnh quá nhanh. Vui lòng đợi vài phút rồi thử lại.",
    retryAfter: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
});

const examDeleteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10,              // Tối đa 10 lần xóa/phút
  message: {
    error: "Too many delete requests. Please wait a moment.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
});

/** Giới hạn cho thao tác lịch thi (ít thay đổi hơn) */
const scheduleLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 20,
  message: {
    error: "Too many schedule requests. Please wait.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
});

module.exports = {
  examWriteLimiter,
  examImportPreviewLimiter,
  examAiReviewCooldown,
  examImageOcrLimiter,
  examDeleteLimiter,
  scheduleLimiter,
};
