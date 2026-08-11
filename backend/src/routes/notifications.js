const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/", authenticate, ctrl.getNotifications);
router.get("/unread-count", authenticate, ctrl.getUnreadCount);
router.get("/push/status", authenticate, ctrl.getPushStatus);
router.post("/push/subscribe", authenticate, ctrl.savePushSubscription);
router.post("/push/unsubscribe", authenticate, ctrl.disablePushSubscription);
router.post("/push/mobile/register", authenticate, ctrl.saveMobilePushToken);
router.post("/push/mobile/unregister", authenticate, ctrl.disableMobilePushToken);
router.post("/push/test", authenticate, ctrl.sendPushTest);
router.post("/push/reminders/study", ctrl.sendStudyReminderCron);
router.post("/push/reminders/exams", ctrl.sendExamReminderCron);
router.patch("/read-all", authenticate, ctrl.markAllRead);
router.patch("/:id/read", authenticate, ctrl.markRead);

module.exports = router;
