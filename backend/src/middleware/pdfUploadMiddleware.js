const multer = require("multer");

const storage = multer.memoryStorage();
const allowedPdfMimeTypes = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);
const allowedDocxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/octet-stream",
]);
const allowedDocMimeTypes = new Set([
  "application/msword",
  "application/octet-stream",
]);

const fileFilter = (req, file, cb) => {
  const extension = String(file.originalname || "").toLowerCase().split(".").pop();
  const isPdf = extension === "pdf" && allowedPdfMimeTypes.has(file.mimetype);
  const isDocx = extension === "docx" && allowedDocxMimeTypes.has(file.mimetype);
  const isDoc = extension === "doc" && allowedDocMimeTypes.has(file.mimetype);

  if (isPdf || isDocx || isDoc) {
    cb(null, true);
    return;
  }

  cb(new Error("Chi cho phep upload file PDF hoac Word .doc/.docx"));
};

const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = uploadPdf;
