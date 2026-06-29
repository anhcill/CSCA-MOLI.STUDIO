const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const materialsController = require("../controllers/materialsController");
const { extractPdfWebContent } = require("../services/materialContentService");
const { getMaterialPdfUploadError, uploadPdfToCloudinary } = require("../services/materialPdfUploadService");
const {
  ensureMaterialPdfBlobTable,
  findMaterialByStoredPdfToken,
  getStoredPdfByToken,
  getStoredPdfTokenFromUrl,
  storePdfFileInDatabase,
} = require("../services/materialStoredPdfService");
const {
  authenticate,
  authorizePermission,
  checkVipAccess,
  optionalAuth,
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
    await ensureMaterialPdfBlobTable();
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
const MATERIAL_UPLOAD_TMP_DIR = path.join(os.tmpdir(), "csca-material-uploads");
fs.mkdirSync(MATERIAL_UPLOAD_TMP_DIR, { recursive: true });

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MATERIAL_UPLOAD_TMP_DIR),
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "material.pdf").replace(/[^\w.-]+/g, "_");
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`);
    },
  }),
  limits: { fileSize: MAX_MATERIAL_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "application/x-pdf", "application/octet-stream"];
    if (allowed.includes(file.mimetype) || /\.pdf$/i.test(file.originalname || "")) cb(null, true);
    else cb(new Error("Chi chap nhan file PDF"));
  },
});

// Multer: memory storage for image upload
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MATERIAL_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file PDF hoặc ảnh"));
  },
});

// ── Public routes ─────────────────────────────────────────────────────────────
function runUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) return next();
      const isSizeLimit = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      return res.status(isSizeLimit ? 413 : 400).json({
        success: false,
        message: isSizeLimit
          ? `File khong duoc lon hon ${MAX_MATERIAL_UPLOAD_MB}MB`
          : error.message || "File upload khong hop le",
      });
    });
  };
}

function removeTempFile(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
}

function getPdfDownloadName(title, originalName) {
  const source = String(title || originalName || "document").replace(/\.pdf$/i, "").trim() || "document";
  return `${encodeURIComponent(source)}.pdf`;
}

function sendStoredPdf(res, storedPdf, disposition, title) {
  const data = storedPdf?.data;
  if (!data) {
    return res.status(404).json({ success: false, message: "Không tìm thấy file PDF" });
  }

  res.setHeader("Content-Type", storedPdf.mime_type || "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${getPdfDownloadName(title, storedPdf.original_name)}"`);
  res.setHeader("Cache-Control", "private, max-age=1800");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
  res.setHeader("Content-Length", String(storedPdf.file_size || data.length));
  return res.end(data);
}

async function streamStoredPdfByToken(res, token, disposition, title) {
  const storedPdf = await getStoredPdfByToken(token);
  if (!storedPdf) {
    return res.status(404).json({ success: false, message: "Không tìm thấy file PDF" });
  }
  return sendStoredPdf(res, storedPdf, disposition, title);
}

function canUseDatabasePdfFallback(uploadError) {
  return [
    "PDF_TOO_LARGE_FOR_STORAGE",
    "CLOUDINARY_CONFIG_MISSING",
    "CLOUDINARY_AUTH_FAILED",
    "PDF_STORAGE_UPLOAD_FAILED",
    "PDF_UPLOAD_REJECTED",
  ].includes(uploadError.code);
}

async function uploadPdfWithStorageFallback(req) {
  try {
    const result = await uploadPdfToCloudinary(req.file.path, { fileSize: req.file.size });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      storage: "cloudinary",
      bytes: result.bytes || req.file.size,
      warning: null,
    };
  } catch (error) {
    const uploadError = getMaterialPdfUploadError(error);
    if (!canUseDatabasePdfFallback(uploadError)) throw error;

    console.warn("[materials] Cloudinary PDF upload fallback:", {
      code: uploadError.code,
      message: error?.message,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });

    const stored = await storePdfFileInDatabase({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user?.id,
    });

    return {
      url: stored.url,
      publicId: stored.token,
      storage: "database",
      bytes: stored.fileSize,
      warning: "Cloudinary giới hạn dung lượng PDF, file đã được lưu bằng kho nội bộ.",
    };
  }
}

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
  const storedPdfToken = getStoredPdfTokenFromUrl(fileUrl);
  if (storedPdfToken) {
    return streamStoredPdfByToken(res, storedPdfToken, disposition, title);
  }

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

async function streamStoredPdfBlobRoute(req, res, disposition) {
  const token = getStoredPdfTokenFromUrl(`/api/materials/blob/${req.params.token}`);
  if (!token) {
    return res.status(400).json({ success: false, message: "Token PDF không hợp lệ" });
  }

  const material = await findMaterialByStoredPdfToken(token);
  if (material && material.is_active === false) {
    return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
  }
  if (material?.is_premium && !checkVipAccess(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Tài liệu này chỉ dành cho thành viên VIP",
      code: "VIP_REQUIRED",
      is_vip_required: true,
    });
  }

  return streamStoredPdfByToken(res, token, disposition, material?.title);
}

router.get("/blob/:token", optionalAuth, async (req, res) => {
  try { await streamStoredPdfBlobRoute(req, res, "inline"); }
  catch (error) { console.error("[PDF Blob] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

router.get("/blob/:token/download", optionalAuth, async (req, res) => {
  try { await streamStoredPdfBlobRoute(req, res, "attachment"); }
  catch (error) { console.error("[PDF Blob Download] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

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
  runUpload(pdfUpload.single("file")),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Không có file" });

      const uploadResult = await uploadPdfWithStorageFallback(req);

      let webContent = null;
      let parseWarning = null;
      const fileSizeMb = req.file.size / (1024 * 1024);
      const uploadMode = String(req.body?.mode || "").trim().toLowerCase();
      const shouldExtractWebContent = uploadMode === "web";

      if (!shouldExtractWebContent) {
        parseWarning = null;
      } else if (fileSizeMb <= MAX_SYNC_PDF_PARSE_MB) {
        try {
          const pdfBuffer = await fs.promises.readFile(req.file.path);
          webContent = await extractPdfWebContent(pdfBuffer);
        } catch (parseError) {
          parseWarning = "Không chuyển được PDF sang nội dung web, vẫn giữ file PDF.";
          console.warn("[materials] PDF content extraction failed:", parseError.message);
        }
      } else {
        parseWarning = `File ${fileSizeMb.toFixed(1)}MB đã upload xong; bỏ qua chuyển PDF sang web để tránh timeout.`;
      }

      const warnings = [uploadResult.warning, parseWarning].filter(Boolean);
      const contentMeta = {
        ...(webContent?.meta || {}),
        uploadBytes: uploadResult.bytes || req.file.size,
        storage: uploadResult.storage,
        storagePublicId: uploadResult.publicId,
        skippedSyncParse: shouldExtractWebContent && fileSizeMb > MAX_SYNC_PDF_PARSE_MB,
        importMode: shouldExtractWebContent ? "web" : "pdf",
      };

      removeTempFile(req.file?.path);
      res.json({
        success: true,
        data: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          storage: uploadResult.storage,
          content_text: webContent?.contentText || "",
          content_html: webContent?.contentHtml || "",
          content_meta: contentMeta,
          content_source: webContent?.contentHtml ? "pdf_extract" : "file",
        },
        warnings,
        message: webContent?.contentHtml ? "Upload PDF và chuyển sang bài web thành công" : "Upload PDF thành công",
      });
    } catch (error) {
      const uploadError = getMaterialPdfUploadError(error);
      console.error("PDF upload error:", {
        code: uploadError.code,
        status: uploadError.status,
        message: error?.message,
        httpCode: error?.http_code,
        primaryMessage: error?.primaryUploadError?.message,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
      });
      removeTempFile(req.file?.path);
      res.status(uploadError.status).json({
        success: false,
        code: uploadError.code,
        message: uploadError.message,
      });
    }
  },
);

router.post(
  "/upload-images",
  authenticate,
  authorizePermission("content.manage"),
  runUpload(imageUpload.array("files", 40)),
  async (req, res) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ success: false, message: "Không có file ảnh" });
      }

      const images = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file.mimetype?.startsWith("image/")) {
          return res.status(400).json({ success: false, message: "Chỉ chấp nhận file ảnh" });
        }

        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "csca/materials/images",
              resource_type: "image",
              access_mode: "public",
              type: "upload",
            },
            (err, r) => (err ? reject(err) : resolve(r)),
          );
          stream.end(file.buffer);
        });

        images.push({
          url: result.secure_url,
          publicId: result.public_id,
          caption: "",
          order: index + 1,
          width: result.width || null,
          height: result.height || null,
        });
      }

      res.json({
        success: true,
        data: { images },
        message: "Upload ảnh thành công",
      });
    } catch (error) {
      console.error("Material images upload error:", error);
      res.status(500).json({ success: false, message: "Lỗi upload ảnh" });
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
