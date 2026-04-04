const express = require("express");
const router = express.Router();
const multer = require("multer");
const https = require("https");
const http = require("http");
const { v2: cloudinary } = require("cloudinary");
const materialsController = require("../controllers/materialsController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
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

// GET /api/materials/pdf/:id - Stream PDF qua backend (dùng Admin API download URL)
router.get("/pdf/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT file_url, title FROM materials WHERE id = $1 AND (is_active IS NULL OR is_active = TRUE)",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });

    const { file_url: fileUrl, title } = result.rows[0];

    // Extract public_id VÀ version từ Cloudinary URL
    // Ví dụ: https://res.cloudinary.com/cloud/raw/upload/v1773142934/csca/materials/abc.pdf
    const urlParts = fileUrl.match(/\/upload\/v(\d+)\/(.+)$/);
    if (!urlParts) {
      return res.status(400).json({ success: false, message: "URL file không hợp lệ" });
    }
    const version = parseInt(urlParts[1]);  // 1773142934
    const publicId = urlParts[2];            // "csca/materials/abc.pdf" — CÓ .pdf vì là raw resource

    // Tạo signed URL kèm đúng version → Cloudinary tìm đúng resource
    // (access_mode: public nhưng vẫn cần sign để bypass lỗi 401 Cloudinary CDN)
    const downloadUrl = cloudinary.url(publicId, {
      resource_type: "raw",
      type: "upload",
      version,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      secure: true,
    });
    console.log("[PDF] Signed URL:", downloadUrl);

    // Stream về client, follow redirect
    function streamFromUrl(url, hops = 0) {
      if (hops > 5) {
        if (!res.headersSent) res.status(502).json({ success: false, message: "Quá nhiều redirect" });
        return;
      }
      const proto = url.startsWith("https") ? https : http;
      proto.get(url, (upstream) => {
        const { statusCode, headers } = upstream;

        // Follow redirect (Cloudinary API hay redirect sang CDN)
        if ([301, 302, 307, 308].includes(statusCode) && headers.location) {
          upstream.resume();
          return streamFromUrl(headers.location, hops + 1);
        }

        if (statusCode === 401 || statusCode === 403) {
          upstream.resume();
          console.error("[PDF] Auth failed for:", publicId, "status:", statusCode);
          if (!res.headersSent) res.status(401).json({ success: false, message: "Không có quyền truy cập file" });
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          upstream.resume();
          console.error("[PDF] Bad status:", statusCode, "for:", publicId);
          if (!res.headersSent) res.status(502).json({ success: false, message: `Lỗi tải PDF: ${statusCode}` });
          return;
        }

        // Stream thành công
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(title || "document")}.pdf"`);
        res.setHeader("Cache-Control", "public, max-age=1800");
        res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
        if (headers["content-length"]) res.setHeader("Content-Length", headers["content-length"]);
        upstream.pipe(res);

      }).on("error", (err) => {
        console.error("[PDF] Stream error:", err.message);
        if (!res.headersSent) res.status(502).json({ success: false, message: "Lỗi kết nối tải PDF" });
      });
    }

    console.log("[PDF] Downloading:", publicId);
    streamFromUrl(downloadUrl);

  } catch (error) {
    console.error("[PDF] Route error:", error);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" });
  }
});


// ── Admin routes ──────────────────────────────────────────────────────────────
// Upload PDF to Cloudinary and return URL
router.post(
  "/upload-pdf",
  authenticate,
  authorize("admin"),
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
  authorize("admin"),
  materialsController.createMaterial,
);
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  materialsController.updateMaterial,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  materialsController.deleteMaterial,
);

module.exports = router;
