const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { v2: cloudinary } = require("cloudinary");
const materialsController = require("../controllers/materialsController");
const { extractPdfWebContent } = require("../services/materialContentService");
const { getMaterialPdfUploadError, uploadPdfToCloudinary } = require("../services/materialPdfUploadService");
const {
  getR2KeyFromUrl,
  getR2ObjectSignedUrl,
  getR2PdfUrl,
  uploadPdfToR2,
} = require("../services/materialR2StorageService");
const {
  ensureMaterialPdfBlobTable,
  findMaterialByStoredPdfToken,
  getStoredPdfByToken,
  getStoredPdfTokenFromUrl,
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
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS all_display_order INTEGER`,
    );
    await db.query(
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT TRUE`,
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

function getSingleByteRange(value) {
  const range = String(value || "").trim();
  return /^bytes=(?:\d+-\d*|-\d+)$/.test(range) ? range : "";
}

function resolveBufferRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || size <= 0) return undefined;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return undefined;
    end = Math.min(end, size - 1);
  }

  if (start < 0 || start >= size || end < start) return undefined;
  return { start, end };
}

function sendStoredPdf(res, storedPdf, disposition, title, rangeHeader = "") {
  const data = storedPdf?.data;
  if (!data) {
    return res.status(404).json({ success: false, message: "Không tìm thấy file PDF" });
  }

  const size = data.length;
  const range = resolveBufferRange(rangeHeader, size);
  if (rangeHeader && range === undefined) {
    res.setHeader("Content-Range", `bytes */${size}`);
    return res.status(416).end();
  }
  const body = range ? data.subarray(range.start, range.end + 1) : data;

  if (range) {
    res.status(206);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  }
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", storedPdf.mime_type || "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${getPdfDownloadName(title, storedPdf.original_name)}"`);
  res.setHeader("Cache-Control", "private, max-age=1800");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
  res.setHeader("Content-Length", String(body.length));
  return res.end(body);
}

async function streamStoredPdfByToken(res, token, disposition, title, rangeHeader = "") {
  const storedPdf = await getStoredPdfByToken(token);
  if (!storedPdf) {
    return res.status(404).json({ success: false, message: "Không tìm thấy file PDF" });
  }
  return sendStoredPdf(res, storedPdf, disposition, title, rangeHeader);
}

async function findMaterialByR2Key(key) {
  const r2Url = getR2PdfUrl(key);
  const result = await db.query(
    `SELECT id, title, is_premium, is_active, allow_download
     FROM materials
     WHERE file_url = $1 OR file_url LIKE $2
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [r2Url, `%${r2Url}`],
  );
  return result.rows[0] || null;
}

async function streamR2PdfByKey(res, key, disposition, title) {
  // Keep Railway in the authorization path, but send the PDF bytes directly
  // from R2 to the browser so Railway does not pay egress for the file body.
  const signedUrl = await getR2ObjectSignedUrl(key, {
    disposition,
    fileName: title || path.basename(key),
  });
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, signedUrl);
}

function canUseR2PdfFallback(uploadError) {
  return [
    "PDF_TOO_LARGE_FOR_STORAGE",
    "CLOUDINARY_CONFIG_MISSING",
    "CLOUDINARY_AUTH_FAILED",
    "PDF_STORAGE_UPLOAD_FAILED",
    "PDF_UPLOAD_REJECTED",
  ].includes(uploadError.code);
}

async function uploadPdfWithStorageFallback(req) {
  const r2ThresholdBytes = Number(process.env.MATERIAL_R2_MIN_MB || 10) * 1024 * 1024;
  if (Number(req.file?.size || 0) > r2ThresholdBytes) {
    const stored = await uploadPdfToR2({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
    return {
      url: stored.url,
      publicId: stored.publicId,
      storage: "r2",
      bytes: stored.fileSize,
      warning: "File lớn hơn 10MB nên đã lưu vào Cloudflare R2.",
    };
  }

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
    if (!canUseR2PdfFallback(uploadError)) throw error;

    console.warn("[materials] Cloudinary PDF upload R2 fallback:", {
      code: uploadError.code,
      message: error?.message,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });

    const stored = await uploadPdfToR2({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    return {
      url: stored.url,
      publicId: stored.publicId,
      storage: "r2",
      bytes: stored.fileSize,
      warning: "Cloudinary giới hạn dung lượng PDF, file đã lưu vào Cloudflare R2.",
    };
  }
}

router.get("/", materialsController.getMaterials);

// Helper: stream PDF from Cloudinary signed URL with given disposition
async function streamPdf(res, id, disposition, user, rangeHeader = "") {
  const result = await db.query(
    "SELECT file_url, title, is_premium, allow_download FROM materials WHERE id = $1 AND (is_active IS NULL OR is_active = TRUE)",
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
  if (disposition === "attachment" && material.allow_download === false) {
    return res.status(403).json({
      success: false,
      message: "Tài liệu này không cho phép tải xuống",
      code: "DOWNLOAD_DISABLED",
    });
  }

  const { file_url: fileUrl, title } = material;
  res.setHeader("X-Material-Allow-Download", material.allow_download === false ? "false" : "true");
  res.setHeader("Access-Control-Expose-Headers", "X-Material-Allow-Download");
  const storedPdfToken = getStoredPdfTokenFromUrl(fileUrl);
  if (storedPdfToken) {
    return streamStoredPdfByToken(res, storedPdfToken, disposition, title, rangeHeader);
  }

  const r2Key = getR2KeyFromUrl(fileUrl);
  if (r2Key) {
    return streamR2PdfByKey(res, r2Key, disposition, title, rangeHeader);
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
    proto.get(url, { headers: rangeHeader ? { Range: rangeHeader } : {} }, (upstream) => {
      const { statusCode, headers } = upstream;
      if ([301, 302, 307, 308].includes(statusCode) && headers.location) { upstream.resume(); return streamFromUrl(headers.location, hops + 1); }
      if (statusCode === 401 || statusCode === 403) { upstream.resume(); if (!res.headersSent) res.status(401).json({ success: false, message: "Không có quyền" }); return; }
      if (statusCode < 200 || statusCode >= 300) { upstream.resume(); if (!res.headersSent) res.status(502).json({ success: false, message: `Lỗi ${statusCode}` }); return; }
      res.setHeader("Content-Type", "application/pdf");
      if (statusCode === 206) res.status(206);
      res.setHeader("Accept-Ranges", headers["accept-ranges"] || "bytes");
      if (headers["content-range"]) res.setHeader("Content-Range", headers["content-range"]);
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
  if (disposition === "attachment" && material?.allow_download === false) {
    return res.status(403).json({
      success: false,
      message: "Tài liệu này không cho phép tải xuống",
      code: "DOWNLOAD_DISABLED",
    });
  }

  return streamStoredPdfByToken(res, token, disposition, material?.title, getSingleByteRange(req.headers.range));
}

router.get("/blob/:token", optionalAuth, async (req, res) => {
  try { await streamStoredPdfBlobRoute(req, res, "inline"); }
  catch (error) { console.error("[PDF Blob] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

router.get("/blob/:token/download", optionalAuth, async (req, res) => {
  try { await streamStoredPdfBlobRoute(req, res, "attachment"); }
  catch (error) { console.error("[PDF Blob Download] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

async function streamR2PdfRoute(req, res, disposition) {
  const key = getR2KeyFromUrl(`/api/materials/r2/${req.params.token}`);
  if (!key) {
    return res.status(400).json({ success: false, message: "Token R2 không hợp lệ" });
  }

  const material = await findMaterialByR2Key(key);
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
  if (disposition === "attachment" && material?.allow_download === false) {
    return res.status(403).json({
      success: false,
      message: "Tài liệu này không cho phép tải xuống",
      code: "DOWNLOAD_DISABLED",
    });
  }

  return streamR2PdfByKey(res, key, disposition, material?.title, getSingleByteRange(req.headers.range));
}

router.get("/r2/:token", optionalAuth, async (req, res) => {
  try { await streamR2PdfRoute(req, res, "inline"); }
  catch (error) { console.error("[PDF R2] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

router.get("/r2/:token/download", optionalAuth, async (req, res) => {
  try { await streamR2PdfRoute(req, res, "attachment"); }
  catch (error) { console.error("[PDF R2 Download] Route error:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Lỗi server" }); }
});

const MATERIAL_VIEW_TOKEN_AUDIENCE = "material-pdf-stream";
const MATERIAL_VIEW_TOKEN_ISSUER = "csca-api";

router.post("/pdf/:id/view-session", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title, file_url, is_premium, allow_download
       FROM materials
       WHERE id = $1 AND (is_active IS NULL OR is_active = TRUE)
       LIMIT 1`,
      [req.params.id],
    );
    const material = result.rows[0];
    if (!material) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
    }
    if (material.is_premium && !checkVipAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Tài liệu này chỉ dành cho thành viên VIP",
        code: "VIP_REQUIRED",
        is_vip_required: true,
      });
    }

    const r2Key = getR2KeyFromUrl(material.file_url);
    if (r2Key) {
      const streamUrl = await getR2ObjectSignedUrl(r2Key, {
        disposition: "inline",
        fileName: material.title,
      });
      const downloadUrl = material.allow_download === false
        ? ""
        : await getR2ObjectSignedUrl(r2Key, {
          disposition: "attachment",
          fileName: material.title,
        });
      return res.json({
        success: true,
        data: {
          stream_url: streamUrl,
          download_url: downloadUrl,
          delivery: "r2-direct",
          allow_download: material.allow_download !== false,
        },
      });
    }

    const viewerUser = {
      id: req.user.id,
      is_vip: req.user.is_vip === true,
      subscription_tier: req.user.subscription_tier || "basic",
      vip_expires_at: req.user.vip_expires_at || null,
      vip_package_id: req.user.vip_package_id || null,
      vip_allowed_subjects: req.user.vip_allowed_subjects || [],
    };
    const ticket = jwt.sign(
      { purpose: "material_pdf_view", materialId: Number(material.id), user: viewerUser },
      process.env.JWT_SECRET,
      { expiresIn: "4h", audience: MATERIAL_VIEW_TOKEN_AUDIENCE, issuer: MATERIAL_VIEW_TOKEN_ISSUER },
    );
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      success: true,
      data: {
        stream_url: `/api/materials/pdf/${material.id}/stream?ticket=${encodeURIComponent(ticket)}`,
        allow_download: material.allow_download !== false,
        expires_in_seconds: 14400,
      },
    });
  } catch (error) {
    console.error("[PDF View Session] Route error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

router.get("/pdf/:id/stream", async (req, res) => {
  try {
    const payload = jwt.verify(String(req.query.ticket || ""), process.env.JWT_SECRET, {
      audience: MATERIAL_VIEW_TOKEN_AUDIENCE,
      issuer: MATERIAL_VIEW_TOKEN_ISSUER,
    });
    if (
      payload.purpose !== "material_pdf_view" ||
      Number(payload.materialId) !== Number(req.params.id) ||
      !payload.user?.id
    ) {
      return res.status(401).json({ success: false, message: "Phiên xem PDF không hợp lệ" });
    }
    return streamPdf(
      res,
      req.params.id,
      "inline",
      payload.user,
      getSingleByteRange(req.headers.range),
    );
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Phiên xem PDF đã hết hạn" });
    }
    console.error("[PDF Stream] Route error:", error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// GET /api/materials/pdf/:id — Xem PDF inline (yêu cầu đăng nhập)
router.get("/pdf/:id", authenticate, async (req, res) => {
  try { await streamPdf(res, req.params.id, "inline", req.user, getSingleByteRange(req.headers.range)); }
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
