const express = require("express");
const controller = require("../controllers/courseMediaController");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const { mediaUploadLimiter } = require("./courseRateLimiters");
const { requireGlobalCourseScope } = require("../middleware/courseManagementScope");

const router = express.Router();
router.use(authenticate, authorizeAnyPermission("content.manage", "courses.manage_assigned"));
router.use(requireGlobalCourseScope);
router.post("/uploads", mediaUploadLimiter, controller.createUpload);
router.post("/uploads/:sessionId/complete", mediaUploadLimiter, controller.completeUpload);
router.post("/assets/:assetId/hls/finalize", mediaUploadLimiter, controller.finalizeHls);
router.delete("/assets/:assetId", mediaUploadLimiter, controller.deleteAsset);

module.exports = router;
