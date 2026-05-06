const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const userProfileController = require("../controllers/userProfileController");

// Public routes (no auth needed for viewing profiles)
router.get("/:id/profile", userProfileController.getPublicProfile);
router.get("/:id/posts", userProfileController.getUserPosts);

// Private routes
router.put("/me/bio", authenticate, userProfileController.updateBio);

module.exports = router;
