const express = require("express");
const router = express.Router();
const multer = require("multer");
const { cloudinary, uploadStream } = require("../config/cloudinary");
const userController = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");

// Multer memory storage for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for avatars
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WEBP)"));
  },
});

// POST /api/users/upload-avatar - Upload avatar to Cloudinary
router.post(
  "/upload-avatar",
  authenticate,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Không có file" });
      }

      const result = await uploadStream(req.file.buffer, {
        folder: "csca/avatars",
        resource_type: "image",
      });

      res.json({
        success: true,
        data: { url: result.secure_url, publicId: result.public_id },
        message: "Upload avatar thành công",
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ success: false, message: "Lỗi upload avatar" });
    }
  },
);

// GET  /api/users/:id/stats
router.get("/:id/stats", userController.getUserStats);

// POST /api/users/:id/avatar
router.post("/:id/avatar", authenticate, userController.updateAvatar);

// POST /api/users/:id/change-password
router.post(
  "/:id/change-password",
  authenticate,
  userController.changePassword,
);

// GET /api/users/roadmap
router.get("/roadmap", authenticate, userController.getUserRoadmap);

// GET  /api/users/:id
router.get("/:id", userController.getUserById);

// PUT  /api/users/:id
router.put("/:id", authenticate, userController.updateProfile);

module.exports = router;
