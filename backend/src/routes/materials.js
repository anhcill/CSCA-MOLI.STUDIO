const express = require("express");
const router = express.Router();
const multer = require("multer");
const https = require("https");
const http = require("http");
const { v2: cloudinary } = require("cloudinary");
const materialsController = require("../controllers/materialsController");
const { extractPdfWebContent } = require("../services/materialContentService");
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
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content_text TEXT`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content_html TEXT`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content_source VARCHAR(30) DEFAULT 'file'`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content_meta JSONB DEFAULT '{}'::jsonb`,
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

const MAX_MATERIAL_UPLOAD_MB = Number(process.env.MATERIAL_UPLOAD_MAX_MB || 500);
const MAX_SYNC_PDF_PARSE_MB = Number(process.env.MATERIAL_SYNC_PARSE_MAX_MB || 12);

// Multer: memory storage for PDF upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MATERIAL_UPLOAD_MB * 1024 * 1024 },
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
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
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

      const uploadOptions = {
        folder: "csca/materials",
        resource_type: "raw",
        format: "pdf",
        access_mode: "public",
        type: "upload",
      };
      const result = await new Promise((resolve, reject) => {
        const useLargeStream = req.file.size > 20 * 1024 * 1024 && typeof cloudinary.uploader.upload_large_stream === "function";
        const uploadFn = useLargeStream ? cloudinary.uploader.upload_large_stream : cloudinary.uploader.upload_stream;
        const stream = uploadFn.call(
          cloudinary.uploader,
          useLargeStream ? { ...uploadOptions, chunk_size: 6 * 1024 * 1024 } : uploadOptions,
          (err, r) => (err ? reject(err) : resolve(r)),
        );
        stream.end(req.file.buffer);
      });

      let webContent = null;
      let parseWarning = null;
      const fileSizeMb = req.file.size / (1024 * 1024);
      const uploadMode = String(req.body?.mode || "").trim().toLowerCase();
      const shouldExtractWebContent = uploadMode === "web";

      if (!shouldExtractWebContent) {
        parseWarning = null;
      } else if (fileSizeMb <= MAX_SYNC_PDF_PARSE_MB) {
        try {
          webContent = await extractPdfWebContent(req.file.buffer);
        } catch (parseError) {
          parseWarning = "Không chuyển được PDF sang nội dung web, vẫn giữ file PDF.";
          console.warn("[materials] PDF content extraction failed:", parseError.message);
        }
      } else {
        parseWarning = `File ${fileSizeMb.toFixed(1)}MB đã upload xong; bỏ qua chuyển PDF sang web để tránh timeout.`;
      }

      res.json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          content_text: webContent?.contentText || "",
          content_html: webContent?.contentHtml || "",
          content_meta: webContent?.meta || { uploadBytes: req.file.size, skippedSyncParse: shouldExtractWebContent && fileSizeMb > MAX_SYNC_PDF_PARSE_MB, importMode: shouldExtractWebContent ? "web" : "pdf" },
          content_source: webContent?.contentHtml ? "pdf_extract" : "file",
        },
        warnings: parseWarning ? [parseWarning] : [],
        message: webContent?.contentHtml ? "Upload PDF và chuyển sang bài web thành công" : "Upload PDF thành công",
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
