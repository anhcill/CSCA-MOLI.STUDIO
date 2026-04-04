const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadStream } = require("../config/cloudinary");
const postController = require("../controllers/postController");
const { authenticate, optionalAuth } = require("../middleware/authMiddleware");

// Multer memory storage for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file ảnh"));
  },
});

// Upload image for post
router.post(
  "/upload-image",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Không có file" });
      }

      const result = await uploadStream(req.file.buffer, {
        folder: "csca/forum",
        resource_type: "image",
      });

      res.json({
        success: true,
        data: { url: result.secure_url, publicId: result.public_id },
        message: "Upload ảnh thành công",
      });
    } catch (error) {
      console.error("Forum image upload error:", error);
      res.status(500).json({ success: false, message: "Lỗi upload ảnh" });
    }
  },
);

// Get all posts (feed) - optional auth to show liked status
router.get("/", optionalAuth, postController.getPosts);

// Create new post - requires auth
router.post("/", authenticate, postController.createPost);

// Like/Unlike post - requires auth (must be before /:id routes)
router.post("/:id/like", authenticate, postController.likePost);
router.delete("/:id/like", authenticate, postController.unlikePost);

// Comments - get doesn't require auth, add requires auth (must be before /:id routes)
router.get("/:id/comments", postController.getComments);
router.post("/:id/comments", authenticate, postController.addComment);

// Update post - requires auth (must be before DELETE /:id)
router.put("/:id", authenticate, postController.updatePost);

// Delete post - requires auth
router.delete("/:id", authenticate, postController.deletePost);

module.exports = router;
