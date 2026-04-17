const express = require("express");
const router = express.Router();
const { getOverview, getRoadmap } = require("../controllers/statsController");
const { authenticate } = require("../middleware/authMiddleware");

// GET /api/stats/overview - Public, no auth required
router.get("/overview", getOverview);

// GET /api/stats/roadmap - Protected
router.get("/roadmap", authenticate, getRoadmap);

module.exports = router;
