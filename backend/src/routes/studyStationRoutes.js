const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const {
  getStationVideos,
  createStationVideo,
  likeStationVideo,
  deleteStationVideo,
  recordStudySession,
  getStudyLeaderboard,
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

// ── Shared Motivation TikTok Videos (SQL persistence across all users) ──
router.get('/videos', getStationVideos);
router.post('/videos', optionalAuth, createStationVideo);
router.post('/videos/:id/like', optionalAuth, likeStationVideo);
router.delete('/videos/:id', optionalAuth, deleteStationVideo);

// ── Study Sessions & Live Leaderboard (Bảng vàng Chăm Chỉ) ──
router.post('/sessions', optionalAuth, recordStudySession);
router.get('/leaderboard', optionalAuth, getStudyLeaderboard);

// ── Motivation Station Community Chat (Trạm Động Lực / TikTok chat feed) ──
router.get('/chats', getStationChats);
router.post('/chats', optionalAuth, createStationChat);

// ── Virtual Study Rooms (Phòng Học Ảo) ──
router.get('/rooms', optionalAuth, getStudyRooms);
router.post('/rooms', optionalAuth, createStudyRoom);
router.get('/rooms/:code', getStudyRoomByCode);
router.post('/rooms/:code/presence', optionalAuth, syncRoomPresence);
router.post('/rooms/:code/leave', optionalAuth, leaveStudyRoom);
router.delete('/rooms/:code', optionalAuth, deleteStudyRoom);
router.get('/rooms/:code/messages', getRoomMessages);
router.post('/rooms/:code/messages', optionalAuth, createRoomMessage);

module.exports = router;
