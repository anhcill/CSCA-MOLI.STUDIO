const { v2: cloudinary } = require("cloudinary");

const DEFAULT_UPLOAD_FOLDER = "csca/materials";
const DEFAULT_CHUNK_SIZE = 20 * 1024 * 1024;
const LARGE_UPLOAD_THRESHOLD_MB = Number(process.env.CLOUDINARY_UPLOAD_LARGE_THRESHOLD_MB || 90);

function isMissingCloudinaryValue(value, placeholder) {
  const normalized = String(value || "").trim();
  return !normalized || normalized === placeholder || normalized.startsWith("your_cloudinary_");
}

function assertCloudinaryConfigured() {
  if (
    isMissingCloudinaryValue(process.env.CLOUDINARY_CLOUD_NAME, "your_cloudinary_cloud_name") ||
    isMissingCloudinaryValue(process.env.CLOUDINARY_API_KEY, "your_cloudinary_api_key") ||
    isMissingCloudinaryValue(process.env.CLOUDINARY_API_SECRET, "your_cloudinary_api_secret")
  ) {
    const error = new Error("CLOUDINARY_CONFIG_MISSING");
    error.statusCode = 503;
    error.publicMessage = "Kho lưu trữ tài liệu chưa được cấu hình Cloudinary.";
    throw error;
  }
}

function configureCloudinaryFromEnv() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function getPdfUploadOptions(options = {}) {
  return {
    folder: options.folder || DEFAULT_UPLOAD_FOLDER,
    resource_type: "raw",
    access_mode: "public",
    type: "upload",
    use_filename: true,
    unique_filename: true,
  };
}

function uploadRawFile(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      options,
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

function uploadLargeRawFile(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      { ...options, chunk_size: Number(process.env.CLOUDINARY_UPLOAD_CHUNK_BYTES || DEFAULT_CHUNK_SIZE) },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

function shouldTryFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.http_code === 401 || error?.http_code === 403) return false;
  if (message.includes("api key") || message.includes("signature")) return false;
  return true;
}

async function uploadPdfToCloudinary(filePath, options = {}) {
  assertCloudinaryConfigured();
  configureCloudinaryFromEnv();

  const uploadOptions = getPdfUploadOptions(options);
  const fileSizeMb = Number(options.fileSize || 0) / (1024 * 1024);
  const preferLargeUpload = fileSizeMb >= LARGE_UPLOAD_THRESHOLD_MB;

  try {
    return preferLargeUpload
      ? await uploadLargeRawFile(filePath, uploadOptions)
      : await uploadRawFile(filePath, uploadOptions);
  } catch (error) {
    if (!shouldTryFallback(error)) throw error;

    try {
      return preferLargeUpload
        ? await uploadRawFile(filePath, uploadOptions)
        : await uploadLargeRawFile(filePath, uploadOptions);
    } catch (fallbackError) {
      fallbackError.primaryUploadError = error;
      throw fallbackError;
    }
  }
}

function getMaterialPdfUploadError(error) {
  if (error?.message === "MATERIAL_DB_PDF_TOO_LARGE") {
    return {
      status: error.statusCode || 413,
      code: "MATERIAL_DB_PDF_TOO_LARGE",
      message: error.publicMessage || "File PDF quá lớn so với giới hạn kho nội bộ.",
    };
  }

  if (error?.statusCode && error?.publicMessage) {
    return {
      status: error.statusCode,
      code: error.message,
      message: error.publicMessage,
    };
  }

  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (error?.http_code === 401 || lower.includes("unknown api key") || lower.includes("invalid api key")) {
    return {
      status: 503,
      code: "CLOUDINARY_AUTH_FAILED",
      message: "Kho lưu trữ tài liệu đang lỗi xác thực Cloudinary.",
    };
  }

  if (error?.http_code === 413 || lower.includes("too large") || lower.includes("file size")) {
    return {
      status: 413,
      code: "PDF_TOO_LARGE_FOR_STORAGE",
      message: "File PDF quá lớn so với giới hạn kho lưu trữ hiện tại.",
    };
  }

  if (error?.http_code === 400 && (lower.includes("invalid") || lower.includes("format") || lower.includes("resource"))) {
    return {
      status: 400,
      code: "PDF_UPLOAD_REJECTED",
      message: "Cloudinary từ chối file PDF này. Hãy thử đổi tên file không dấu hoặc xuất lại PDF.",
    };
  }

  return {
    status: 502,
    code: "PDF_STORAGE_UPLOAD_FAILED",
    message: "Không upload được PDF lên kho lưu trữ. Vui lòng thử lại.",
  };
}

module.exports = {
  getMaterialPdfUploadError,
  uploadPdfToCloudinary,
};
