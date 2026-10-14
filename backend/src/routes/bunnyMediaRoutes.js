const express = require('express');
const { authenticate, authorizeAnyPermission } = require('../middleware/authMiddleware');
const { mediaUploadLimiter } = require('./courseRateLimiters');
const { sendData, sendCourseError } = require('../utils/courseResponses');
const { createBunnyMediaService } = require('../services/bunnyMediaService');
const router = express.Router();
router.use(authenticate, authorizeAnyPermission('content.manage','courses.manage_assigned'));
router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
const handle = work => async (req,res) => {
  try { return sendData(res,await work(createBunnyMediaService(),req)); }
  catch (error) { return sendCourseError(res,error); }
};
router.get('/assets/:assetId',handle((s,r)=>s.status(r.params.assetId,r.user)));
router.post('/uploads',mediaUploadLimiter,handle((s,r)=>s.create(r.body || {},r.user)));
router.post('/assets/:assetId/authorization',mediaUploadLimiter,handle((s,r)=>s.authorization(r.params.assetId,r.user)));
router.post('/assets/:assetId/sync',mediaUploadLimiter,handle((s,r)=>s.sync(r.params.assetId,r.user)));
router.post('/assets/:assetId/recover',mediaUploadLimiter,handle((s,r)=>s.recover(r.params.assetId,r.body?.videoId,r.user)));
module.exports = router;
