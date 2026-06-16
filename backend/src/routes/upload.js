const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const upload = require("../middleware/uploadMiddleware");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");

router.use(
  "/upload",
  authenticate,
  authorizeAnyPermission("content.manage", "exams.manage"),
);

router.post(
  "/upload/question-image",
  upload.single("image"),
  uploadController.uploadQuestionImage,
);

router.post(
  "/upload/question-images",
  upload.array("images", 10),
  uploadController.uploadMultipleImages,
);

router.delete(
  "/upload/question-image/:publicId",
  uploadController.deleteImage,
);

module.exports = router;
