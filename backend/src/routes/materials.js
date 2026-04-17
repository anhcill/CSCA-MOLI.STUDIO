const express = require("express");
const router = express.Router();
const multer = require("multer");
const https = require("https");
const http = require("http");
const { v2: cloudinary } = require("cloudinary");
const materialsController = require("../controllers/materialsController");
const {
  authenticate,
  authorizePermission,
  checkVipAccess,
} = require("../middleware/authMiddleware");
const db = require("../config/database");

// Auto-migrate: add missing columns if not exist
(async () => {
  try {
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS topic VARCHAR(100)`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS uploaded_by INTEGER`,
    );
    // silent init
  } catch (e) {
    console.error("[materials] Migration error:", e.message);
  }
})();

// Cloudinary already configured in imageRoutes, just use it
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: memory storage for PDF upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for PDFs
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file PDF hoặc ảnh"));
  },
});

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/", materialsController.getMaterials);

// Helper: stream PDF from Cloudinary signed URL with given disposition
async function streamPdf(res, id, disposition, user) {
  const result = await db.query(
    "SELECT file_url, title, is_premium FROM materials WHERE id = $1 AND (is_active IS NULL OR is_active = TRUE)",
    [id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });

  const material = result.rows[0];

  // VIP check: premium materials require active VIP
  if (material.is_premium && !checkVipAccess(user)) {
    return res.status(403).json({
      success: false,
      message: "Tài liệu này chỉ dành cho thành viên VIP",
      code: "VIP_REQUIRED",
      is_vip_required: true,
    });
  }

  const { file_url: fileUrl, title } = material;
  const urlParts = fileUrl.match(/\/upload\/v(\d+)\/(.+)$/);
  if (!urlParts)
    return res.status(400).json({ success: false, message: "URL file không hợp lệ" });

  const version = parseInt(urlParts[1]);
  const publicId = urlParts[2];
  const downloadUrl = cloudinary.url(publicId, {
    resource_type: "raw", type: "upload", version,
    sign_url: true, expires_at: Math.floor(Date.now() / 1000) + 3600, secure: true,
  });

  function streamFromUrl(url, hops = 0) {
    if (hops > 5) { if (!res.headersSent) res.status(502).json({ success: false, message: "Quá nhiều redirect" }); return; }
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, (upstream) => {
      const { statusCode, headers } = upstream;
      if ([301, 302, 307, 308].includes(statusCode) && headers.location) { upstream.resume(); return streamFromUrl(headers.location, hops + 1); }
      if (statusCode === 401 || statusCode === 403) { upstream.resume(); if (!res.headersSent) res.status(401).json({ success: false, message: "Không có quyền" }); return; }
      if (statusCode < 200 || statusCode >= 300) { upstream.resume(); if (!res.headersSent) res.status(502).json({ success: false, message: `Lỗi ${statusCode}` }); return; }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(title || "document")}.pdf"`);
      res.setHeader("Cache-Control", "public, max-age=1800");
      res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
      if (headers["content-length"]) res.setHeader("Content-Length", headers["content-length"]);
      upstream.pipe(res);
    }).on("error", (err) => { if (!res.headersSent) res.status(502).json({ success: false, message: "Lỗi kết nối" }); });
  }
  streamFromUrl(downloadUrl);
}

// GET /api/materials/pdf/:id — Xem PDF inline (yêu cầu đăng nhập)
router.get("/pdf/:id", authenticate, async (req, res) => {
  try { await streamPdf(res, req.params.id, "inline", req.user); }
  catch (error) { console.error("[PDF] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

// GET /api/materials/pdf/:id/download — Tải xuống PDF (yêu cầu đăng nhập)
router.get("/pdf/:id/download", authenticate, async (req, res) => {
  try { await streamPdf(res, req.params.id, "attachment", req.user); }
  catch (error) { console.error("[PDF Download] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

// ── Admin routes ──────────────────────────────────────────────────────────────
// Upload PDF to Cloudinary and return URL
router.post(
  "/upload-pdf",
  authenticate,
  authorizePermission("content.manage"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Không có file" });

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "csca/materials", resource_type: "raw", format: "pdf", access_mode: "public", type: "upload" },
          (err, r) => (err ? reject(err) : resolve(r)),
        );
        stream.end(req.file.buffer);
      });

      res.json({
        success: true,
        data: { url: result.secure_url, publicId: result.public_id },
        message: "Upload PDF thành công",
      });
    } catch (error) {
      console.error("PDF upload error:", error);
      res.status(500).json({ success: false, message: "Lỗi upload PDF" });
    }
  },
);

router.post(
  "/",
  authenticate,
  authorizePermission("content.manage"),
  materialsController.createMaterial,
);
router.put(
  "/:id",
  authenticate,
  authorizePermission("content.manage"),
  materialsController.updateMaterial,
);
router.delete(
  "/:id",
  authenticate,
  authorizePermission("content.manage"),
  materialsController.deleteMaterial,
);

module.exports = router;
