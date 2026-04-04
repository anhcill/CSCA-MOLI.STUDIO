const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, ctrl.getNotifications);
router.get("/unread-count", authenticate, ctrl.getUnreadCount);
router.patch("/read-all", authenticate, ctrl.markAllRead);
router.patch("/:id/read", authenticate, ctrl.markRead);

module.exports = router;
