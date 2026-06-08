const multer = require("multer");

// Sử dụng memory storage để upload lên Cloudinary thay vì lưu local
const storage = multer.memoryStorage();

// File filter - chỉ cho phép ảnh
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const extname = allowedTypes.test(
    file.originalname.toLowerCase().split(".").pop(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Chỉ cho phép upload file ảnh (jpeg, jpg, png, gif, svg, webp)",
      ),
    );
  }
};

// Cấu hình multer - memory storage cho Cloudinary
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // Gioi han 8MB cho OCR anh ro hon
  },
  fileFilter: fileFilter,
});

module.exports = upload;
