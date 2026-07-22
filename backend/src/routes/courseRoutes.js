const express = require("express");
const controller = require("../controllers/courseController");
const { authenticate, optionalAuth } = require("../middleware/authMiddleware");
const { enrollmentLimiter } = require("./courseRateLimiters");

const router = express.Router();

// Public metadata. optionalAuth enriches access/enrollment without requiring login.
router.get("/", optionalAuth, controller.listCatalog);
router.get("/:slug", optionalAuth, controller.getCourseLanding);

router.post("/:courseId/enroll", enrollmentLimiter, authenticate, controller.enroll);

module.exports = router;
