const express = require("express");
const controller = require("../controllers/courseMediaController");
const { authenticate, authorizePermission } = require("../middleware/authMiddleware");
const { mediaUploadLimiter } = require("./courseRateLimiters");

const router = express.Router();
router.use(authenticate, authorizePermission("content.manage"));
router.post("/uploads", mediaUploadLimiter, controller.createUpload);
router.post("/uploads/:sessionId/complete", mediaUploadLimiter, controller.completeUpload);
router.post("/assets/:assetId/hls/finalize", mediaUploadLimiter, controller.finalizeHls);

module.exports = router;
