const express = require("express");
const router = express.Router();
const { getPublicSettings, getAdminSettings, updateSettings } = require("../controllers/settingsController");
const {
	authenticate,
	authorizePermission,
} = require("../middleware/authMiddleware");

router.get("/public", getPublicSettings);

router.get(
	"/",
	authenticate,
	authorizePermission("system.manage"),
	getAdminSettings,
);

router.put(
	"/",
	authenticate,
	authorizePermission("system.manage"),
	updateSettings,
);

module.exports = router;
