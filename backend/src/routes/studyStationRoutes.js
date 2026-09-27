const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const {
  getStationChats,
  createStationChat,
  getStudyRooms,
  createStudyRoom,
  getRoomMessages,
  createRoomMessage,
} = require('../controllers/studyStationController');

// ── Motivation Station Community Chat (Trạm Động Lực / TikTok chat feed) ──
router.get('/chats', getStationChats);
router.post('/chats', optionalAuth, createStationChat);

// ── Virtual Study Rooms (Phòng Học Ảo) ──
router.get('/rooms', getStudyRooms);
router.post('/rooms', optionalAuth, createStudyRoom);
router.get('/rooms/:code/messages', getRoomMessages);
router.post('/rooms/:code/messages', optionalAuth, createRoomMessage);

module.exports = router;
