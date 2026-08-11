const multer = require("multer");

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, callback) => {
    let mime = String(file.mimetype || "").toLowerCase();
    if (!mime || mime === "application/octet-stream") {
      const extension = String(file.originalname || "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
      const inferred = { ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }[extension];
      if (inferred) { file.mimetype = inferred; mime = inferred; }
    }
    if (ALLOWED_MIME_TYPES.has(mime)) return callback(null, true);
    const error = new Error("Chỉ hỗ trợ ảnh, PDF, DOC hoặc DOCX.");
    error.code = "COURSE_FILE_TYPE_NOT_ALLOWED";
    return callback(error);
  },
});

function startsWith(buffer, bytes) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasValidSignature(file) {
  const mime = String(file.mimetype || "").toLowerCase();
  const buffer = file.buffer || Buffer.alloc(0);
  if (mime === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "image/heic" || mime === "image/heif") return buffer.subarray(4, 12).toString("ascii").includes("ftyp");
  if (mime === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mime === "application/msword") {
    return /\.doc$/i.test(file.originalname || "") && startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return /\.docx$/i.test(file.originalname || "") && startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  }
  return false;
}

function courseFiles(field = "files") {
  return (req, res, next) => upload.array(field, MAX_FILES)(req, res, (error) => {
    if (!error) {
      const files = req.files || [];
      const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
      if (totalBytes > MAX_TOTAL_BYTES) {
        return res.status(413).json({ success: false, code: "COURSE_FILES_TOTAL_TOO_LARGE", message: "Tổng dung lượng mỗi lần tải tối đa 100 MB." });
      }
      if (files.some((file) => !hasValidSignature(file))) {
        return res.status(422).json({ success: false, code: "COURSE_FILE_SIGNATURE_INVALID", message: "Có file sai định dạng hoặc phần mở rộng không khớp nội dung." });
      }
      return next();
    }
    const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    const tooMany = error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT";
    return res.status(tooLarge ? 413 : 422).json({
      success: false,
      code: tooLarge ? "COURSE_FILE_TOO_LARGE" : (tooMany ? "COURSE_TOO_MANY_FILES" : "COURSE_FILE_INVALID"),
      message: tooLarge
        ? "Mỗi file tối đa 25 MB."
        : (tooMany ? `Mỗi lần tải tối đa ${MAX_FILES} file.` : error.message),
    });
  });
}

module.exports = { courseFiles, hasValidSignature, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, ALLOWED_MIME_TYPES };
