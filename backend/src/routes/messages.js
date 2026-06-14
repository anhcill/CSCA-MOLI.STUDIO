const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../middleware/authMiddleware");
const messageController = require("../controllers/messageController");
const blockController = require("../controllers/blockController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chi chap nhan file anh JPG, PNG, GIF, WEBP"));
  },
});

// All routes require authentication
router.use(authenticate);

// GET  /api/messages              - List all conversations
router.get("/", messageController.getConversations);

// GET  /api/messages/unread-count - Get unread count
router.get("/unread-count", messageController.getUnreadCount);

// POST /api/messages/upload-image - Upload image for private chat
router.post("/upload-image", upload.single("image"), messageController.uploadMessageImage);

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
