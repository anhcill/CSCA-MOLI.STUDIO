const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const adminReportController = require("../controllers/adminReportController");
const {
  authenticate,
  authorizePermission,
} = require("../middleware/authMiddleware");

router.use(authenticate);

// ── Forum Moderation ──────────────────────────────────────────────────────────

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

// ── Report Management ──────────────────────────────────────────────────────────

router.get(
  "/reports",
  authorizePermission("forum.manage"),
  adminReportController.getReports,
);
router.get(
  "/reports/auto-blocks",
  authorizePermission("forum.manage"),
  adminReportController.getAutoBlocks,
);
router.get(
  "/reports/:id",
  authorizePermission("forum.manage"),
  adminReportController.getReportById,
);
router.put(
  "/reports/:id",
  authorizePermission("forum.manage"),
  adminReportController.resolveReport,
);
router.post(
  "/reports/bulk",
  authorizePermission("forum.manage"),
  adminReportController.bulkResolve,
);

module.exports = router;
