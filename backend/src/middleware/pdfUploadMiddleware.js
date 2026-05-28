const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = String(file.originalname || "").toLowerCase().split(".").pop();
  const isPdf = extension === "pdf" && file.mimetype === "application/pdf";

  if (isPdf) {
    cb(null, true);
    return;
  }

  cb(new Error("Chi cho phep upload file PDF"));
};

const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = uploadPdf;
