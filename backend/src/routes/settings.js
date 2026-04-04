const express = require("express");
const router = express.Router();
const { getPublicSettings, updateSettings } = require("../controllers/settingsController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

// GET /api/settings/public — Public
router.get("/public", getPublicSettings);

// PUT /api/settings — Admin only
router.put("/", authenticate, authorize("admin"), updateSettings);

module.exports = router;
