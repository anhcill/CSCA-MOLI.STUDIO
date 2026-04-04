const express = require("express");
const router = express.Router();
const { getOverview } = require("../controllers/statsController");

// GET /api/stats/overview - Public, no auth required
router.get("/overview", getOverview);

module.exports = router;
