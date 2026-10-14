const express = require("express");
const controller = require("../controllers/courseMediaController");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const { mediaUploadLimiter } = require("./courseRateLimiters");
const { requireGlobalCourseScope } = require("../middleware/courseManagementScope");

const router = express.Router();
router.use(authenticate, authorizeAnyPermission("content.manage", "courses.manage_assigned"));
router.use(requireGlobalCourseScope);
router.get('/assets/:assetId', async (req,res) => {
  const { sendData, sendCourseError } = require('../utils/courseResponses');
  try { return sendData(res,await require('../services/courseMediaService').createCourseMediaService().getAssetStatus(req.params.assetId,req.user)); }
  catch (error) { return sendCourseError(res,error); }
});
router.post("/uploads", mediaUploadLimiter, controller.createUpload);
router.post("/uploads/:sessionId/complete", mediaUploadLimiter, controller.completeUpload);
router.post("/assets/:assetId/hls/finalize", mediaUploadLimiter, controller.finalizeHls);
router.delete("/assets/:assetId", mediaUploadLimiter, controller.deleteAsset);

module.exports = router;
