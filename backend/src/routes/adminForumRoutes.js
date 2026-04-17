const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const {
  authenticate,
  authorizePermission,
} = require("../middleware/authMiddleware");

router.use(authenticate);

// Moderation list + moderation delete
router.get(
  "/posts",
  authorizePermission("forum.manage"),
  postController.getModerationPosts,
);
router.delete(
  "/posts/:id",
  authorizePermission("forum.manage"),
  postController.deletePost,
);

// Official announcement posting
router.post(
  "/announcements",
  authorizePermission("forum.post_as_admin"),
  postController.createAnnouncement,
);

module.exports = router;
