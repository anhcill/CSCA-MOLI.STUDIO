const rateLimit = require("express-rate-limit");

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
  examImageOcrLimiter,
  examDeleteLimiter,
  scheduleLimiter,
};
