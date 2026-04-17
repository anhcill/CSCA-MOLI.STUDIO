const express = require("express");
const router = express.Router();
const { getPublicSettings, updateSettings } = require("../controllers/settingsController");
const {
	authenticate,
	authorizePermission,
} = require("../middleware/authMiddleware");

// GET /api/settings/public — Public
router.get("/public", getPublicSettings);

// PUT /api/settings — Admin only
router.put(
	"/",
	authenticate,
	authorizePermission("system.manage"),
	updateSettings,
);

module.exports = router;
