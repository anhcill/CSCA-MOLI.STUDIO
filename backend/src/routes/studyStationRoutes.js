const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const {
  getStationChats,
  createStationChat,
  getStudyRooms,
  getStudyRoomByCode,
  createStudyRoom,
  syncRoomPresence,
  leaveStudyRoom,
  deleteStudyRoom,
  getRoomMessages,
  createRoomMessage,
} = require('../controllers/studyStationController');

// ── Motivation Station Community Chat (Trạm Động Lực / TikTok chat feed) ──
router.get('/chats', getStationChats);
router.post('/chats', optionalAuth, createStationChat);

// ── Virtual Study Rooms (Phòng Học Ảo) ──
router.get('/rooms', getStudyRooms);
router.post('/rooms', optionalAuth, createStudyRoom);
router.get('/rooms/:code', getStudyRoomByCode);
router.post('/rooms/:code/presence', optionalAuth, syncRoomPresence);
router.post('/rooms/:code/leave', optionalAuth, leaveStudyRoom);
router.delete('/rooms/:code', optionalAuth, deleteStudyRoom);
router.get('/rooms/:code/messages', getRoomMessages);
router.post('/rooms/:code/messages', optionalAuth, createRoomMessage);

module.exports = router;
