const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const blockController = require("../controllers/blockController");
const messageController = require("../controllers/messageController");

// All routes require authentication
router.use(authenticate);

// Block/Unblock
router.post("/:id/block", blockController.blockUser);

// Report user
router.post("/:id/report", blockController.reportUser);

// Block list
router.get("/me/blocks", blockController.getBlockList);

module.exports = router;
