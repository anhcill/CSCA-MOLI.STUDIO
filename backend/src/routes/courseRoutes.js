const express = require("express");
const controller = require("../controllers/courseController");
const { authenticate, optionalAuth } = require("../middleware/authMiddleware");
const { enrollmentLimiter } = require("./courseRateLimiters");
const reviews = require('../services/courseReviewService');
const { sendData, sendCourseError } = require('../utils/courseResponses');

const router = express.Router();

// Public metadata. optionalAuth enriches access/enrollment without requiring login.
router.get("/", optionalAuth, controller.listCatalog);
router.get('/:slug/reviews', optionalAuth, async (req, res) => {
  try { return sendData(res, await reviews.list(req.params.slug, req.user)); }
  catch (error) { return sendCourseError(res, error); }
});
router.put('/:slug/reviews/me', enrollmentLimiter, authenticate, async (req, res) => {
  try { return sendData(res, await reviews.save(req.params.slug, req.user, req.body)); }
  catch (error) { return sendCourseError(res, error); }
});
router.get("/:slug", optionalAuth, controller.getCourseLanding);

router.post("/:courseId/enroll", enrollmentLimiter, authenticate, controller.enroll);

module.exports = router;
