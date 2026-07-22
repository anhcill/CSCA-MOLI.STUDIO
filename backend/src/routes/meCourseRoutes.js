const express = require("express");
const controller = require("../controllers/learningController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/course-enrollments", authenticate, controller.listMyEnrollments);

module.exports = router;
