const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const messageController = require("../controllers/messageController");
const blockController = require("../controllers/blockController");

// All routes require authentication
router.use(authenticate);

// GET  /api/messages              - List all conversations
router.get("/", messageController.getConversations);

// GET  /api/messages/unread-count - Get unread count
router.get("/unread-count", messageController.getUnreadCount);

// GET  /api/messages/:userId     - Get messages with specific user
router.get("/:userId", messageController.getMessages);

// POST /api/messages             - Send a message
router.post("/", messageController.sendMessage);

// PUT  /api/messages/:id/read    - Mark as read
router.put("/:id/read", messageController.markAsRead);

// DELETE /api/messages/:id       - Recall/Delete a message
router.delete("/:id", messageController.deleteMessage);

// POST /api/messages/:id/report - Report a message
router.post("/:id/report", blockController.reportMessage);

module.exports = router;
