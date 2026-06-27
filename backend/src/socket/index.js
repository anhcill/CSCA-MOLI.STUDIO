const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { ADMIN_ROOM } = require('./riskCenterRealtime');

/**
 * Initialize Socket.io server
 * @param {import('http').Server} httpServer - The HTTP server instance
 */
function initSocket(httpServer) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://csca-moli-studio.vercel.app',
    'https://molystudio.online',
    'https://www.molystudio.online',
    'https://moli.studio',
    'https://www.moli.studio',
  ];

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow no-origin (mobile apps, etc.)
        const allowed = allowedOrigins.some(
          pattern => {
            if (pattern.includes('*')) {
              const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
              return regex.test(origin);
            }
            return origin === pattern;
          }
        );
        if (allowed) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Auth Middleware ────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.id) {
        return next(new Error('Invalid token'));
      }

      // Check blacklist
      if (decoded.jti) {
        const { rows } = await db.query(
          'SELECT 1 FROM token_blacklist WHERE token_jti = $1 LIMIT 1',
          [decoded.jti]
        );
        if (rows.length > 0) {
          return next(new Error('Token has been revoked'));
        }
      }

      socket.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'student',
        is_vip: decoded.is_vip === true,
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      return next(new Error('Authentication failed'));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`[Socket] User ${userId} connected (${socket.id})`);

    // Join personal room for receiving private messages
    socket.join(`user:${userId}`);

    // ─── Admin Risk Center room ───────────────────────────────────────────
    socket.on('join_admin_risk_center', () => {
      if (['admin', 'super_admin'].includes(socket.user.role)) {
        socket.join(ADMIN_ROOM);
        socket.emit('admin_risk_center_joined');
      }
    });

    socket.on('leave_admin_risk_center', () => {
      socket.leave(ADMIN_ROOM);
    });

    socket.on('join_exam_monitor', async (examId) => {
      const parsedExamId = parseInt(examId, 10);
      if (!Number.isFinite(parsedExamId) || parsedExamId <= 0) return;

      try {
        const { rows } = await db.query(
          `SELECT 1
           FROM exam_rooms room
           JOIN exam_proctor_assignments epa ON epa.room_id = room.id
           WHERE room.exam_id = $1 AND epa.proctor_id = $2
           LIMIT 1`,
          [parsedExamId, userId],
        );
        const canJoin = socket.user.role === 'admin' || rows.length > 0;
        if (canJoin) {
          socket.join(`exam-monitor:${parsedExamId}`);
          socket.emit('exam_monitor_joined', { examId: parsedExamId });
        }
      } catch (error) {
        socket.emit('exam_monitor_error', { message: 'Unable to join exam monitor' });
      }
    });

    socket.on('leave_exam_monitor', (examId) => {
      const parsedExamId = parseInt(examId, 10);
      if (Number.isFinite(parsedExamId) && parsedExamId > 0) {
        socket.leave(`exam-monitor:${parsedExamId}`);
      }
    });

    // Join conversation rooms
    socket.on('join_conversation', async (partnerId) => {
      const roomName = getConversationRoom(userId, parseInt(partnerId));
      socket.join(roomName);
      console.log(`[Socket] User ${userId} joined room: ${roomName}`);
    });

    socket.on('leave_conversation', (partnerId) => {
      const roomName = getConversationRoom(userId, parseInt(partnerId));
      socket.leave(roomName);
    });

    // ─── Typing indicator ───────────────────────────────────────────────
    socket.on('typing_start', (partnerId) => {
      const roomName = getConversationRoom(userId, parseInt(partnerId));
      socket.to(roomName).emit('user_typing', { userId, partnerId });
    });

    socket.on('typing_stop', (partnerId) => {
      const roomName = getConversationRoom(userId, parseInt(partnerId));
      socket.to(roomName).emit('user_stopped_typing', { userId, partnerId });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${userId} disconnected: ${reason}`);
    });

    // ─── Ping/Pong for keep-alive ─────────────────────────────────────────
    socket.on('ping_server', () => {
      socket.emit('pong_server', { timestamp: Date.now() });
    });
  });

  return io;
}

/**
 * Get unique room name for a conversation between two users
 * Ensures same room name regardless of who initiates
 */
function getConversationRoom(userA, userB) {
  const [a, b] = [Math.min(userA, userB), Math.max(userA, userB)];
  return `conv:${a}:${b}`;
}

/**
 * Emit a new message event to the appropriate conversation room
 * Call this from messageController after saving a message to DB
 */
function emitNewMessage(io, senderId, receiverId, message) {
  const roomName = getConversationRoom(senderId, receiverId);
  io.to(roomName).emit('new_message', message);

  // Also emit to receiver's personal room (for when they're not in the conversation)
  io.to(`user:${receiverId}`).emit('message_notification', {
    type: 'new_message',
    message,
    fromUserId: senderId,
  });
}

/**
 * Emit unread count update to a specific user
 */
function emitUnreadCount(io, userId, count) {
  io.to(`user:${userId}`).emit('unread_count_update', { count });
}

/**
 * Emit a notification event to a specific user
 */
function emitNotification(io, userId, notification) {
  io.to(`user:${userId}`).emit('notification', notification);
}

module.exports = {
  initSocket,
  emitNewMessage,
  emitUnreadCount,
  emitNotification,
  getConversationRoom,
};
