const express = require("express");
const controller = require("../controllers/courseController");
const { authenticate, optionalAuth } = require("../middleware/authMiddleware");
const { enrollmentLimiter } = require("./courseRateLimiters");
const { requireCoursePreviewAdmin } = require("../middleware/coursePreviewMiddleware");

const router = express.Router();

// Public metadata. optionalAuth enriches access/enrollment without requiring login.
router.get("/", optionalAuth, requireCoursePreviewAdmin, controller.listCatalog);
router.get("/:slug", optionalAuth, requireCoursePreviewAdmin, controller.getCourseLanding);

router.post("/:courseId/enroll", enrollmentLimiter, authenticate, requireCoursePreviewAdmin, controller.enroll);

module.exports = router;
