const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const upload = require("../middleware/uploadMiddleware");
const { authenticate } = require("../middleware/authMiddleware");

// Upload single image
router.post(
  "/upload/question-image",
  authenticate,
  upload.single("image"),
  uploadController.uploadQuestionImage,
);

// Upload multiple images
router.post(
  "/upload/question-images",
  authenticate,
  upload.array("images", 10), // Tối đa 10 ảnh
  uploadController.uploadMultipleImages,
);

// Delete image
router.delete(
  "/upload/question-image/:publicId",
  authenticate,
  uploadController.deleteImage,
);

module.exports = router;
