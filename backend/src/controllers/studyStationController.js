const db = require('../config/database');

/**
 * Helper to compute badge for chat messages
 */
function getBadgeInfo(user, customBadge) {
  if (customBadge) {
    return {
      badge: customBadge,
      badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    };
  }

  if (!user) {
    return {
      badge: 'Bạn học CSCA',
      badgeColor: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
    };
  }

  if (user.role === 'admin') {
    return {
      badge: '👑 Quản trị viên',
      badgeColor: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    };
  }

  if (user.subscription_tier === 'premium' || user.is_premium) {
    return {
      badge: '⭐ Học viên Premium',
      badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    };
  }

  if (user.is_vip) {
    return {
      badge: '🔥 Chiến binh VIP',
      badgeColor: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
    };
  }

  return {
    badge: 'Chiến binh CSCA',
    badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  };
}

/**
 * GET /api/study-station/chats
 * Lấy danh sách tin nhắn cộng đồng ở Trạm Động Lực (TikTok Motivation)
 */
async function getStationChats(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const videoId = req.query.videoId || null;

    let queryText = `
      SELECT 
        c.id,
        c.user_id,
        c.sender_name,
        c.sender_avatar,
        c.badge,
        c.badge_color,
        c.text,
        c.video_id,
        c.created_at,
        u.role,
        u.is_vip,
        u.subscription_tier
      FROM study_station_chats c
      LEFT JOIN users u ON u.id = c.user_id
    `;
    const params = [];

    if (videoId) {
      params.push(videoId);
      queryText += ` WHERE c.video_id = $${params.length}`;
    }

    params.push(limit);
    queryText += ` ORDER BY c.created_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(queryText, params);

    // Reverse to return in chronological order (oldest to newest)
    const formatted = rows.reverse().map((row) => ({
      id: String(row.id),
      userId: row.user_id,
      sender: row.sender_name,
      avatar: row.sender_avatar,
      badge: row.badge,
      badgeColor: row.badge_color,
      text: row.text,
      videoId: row.video_id,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error('getStationChats error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn trạm động lực' });
  }
}

/**
 * POST /api/study-station/chats
 * Gửi tin nhắn mới lên Trạm Động Lực
 */
async function createStationChat(req, res) {
  try {
    const rawText = String(req.body.text || '').trim();
    if (!rawText) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }
    if (rawText.length > 500) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn tối đa 500 ký tự' });
    }

    const videoId = req.body.videoId ? String(req.body.videoId).trim() : null;
    const user = req.user || null;

    let senderName = 'Bạn học CSCA';
    let senderAvatar = null;
    let userId = null;

    if (user) {
      userId = user.id;
      senderName = user.full_name || user.username || 'Chiến binh CSCA';
      senderAvatar = user.avatar_url || user.avatar || null;
    } else if (req.body.senderName) {
      senderName = String(req.body.senderName).trim().slice(0, 50);
    }

    const { badge, badgeColor } = getBadgeInfo(user, req.body.customBadge);

    const insertSql = `
      INSERT INTO study_station_chats (user_id, sender_name, sender_avatar, badge, badge_color, text, video_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, sender_name, sender_avatar, badge, badge_color, text, video_id, created_at
    `;
    const { rows } = await db.query(insertSql, [
      userId,
      senderName,
      senderAvatar,
      badge,
      badgeColor,
      rawText,
      videoId,
    ]);

    const created = rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: String(created.id),
        userId: created.user_id,
        sender: created.sender_name,
        avatar: created.sender_avatar,
        badge: created.badge,
        badgeColor: created.badge_color,
        text: created.text,
        videoId: created.video_id,
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    console.error('createStationChat error:', err);
    res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn' });
  }
}

// ── In-memory real-time presence tracking per room code ─────────────────────
// Map<roomCode, Map<peerId, { peerId, userId, name, avatar, isCameraOn, isMicOn, statusText, isHost, lastSeen }>>
const roomParticipantsMap = new Map();
const PRESENCE_TTL_MS = 40 * 1000; // 40s heartbeat TTL

function getActiveParticipants(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  const roomMap = roomParticipantsMap.get(code);
  if (!roomMap) return [];
  const now = Date.now();
  const active = [];
  for (const [peerId, p] of roomMap.entries()) {
    if (now - p.lastSeen > PRESENCE_TTL_MS) {
      roomMap.delete(peerId);
    } else {
      active.push(p);
    }
  }
  if (roomMap.size === 0) {
    roomParticipantsMap.delete(code);
  }
  return active;
}

/**
 * GET /api/study-station/rooms
 * Lấy danh sách các phòng học trực tuyến đang hoạt động
 */
async function getStudyRooms(req, res) {
  try {
    await ensureTablesExist();

    // Auto-clean stale rooms older than 12 hours that have 0 active participants
    const { rows } = await db.query(`
      SELECT 
        id,
        code,
        name,
        host_id,
        host_name,
        host_avatar,
        subject,
        goal,
        member_count,
        max_members,
        is_private,
        created_at
      FROM study_rooms
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 30
    `);

    const data = [];
    for (const r of rows) {
      const code = String(r.code).toUpperCase();
      const activePeers = getActiveParticipants(code);
      const ageHours = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);

      // If room is older than 12 hours and nobody is in it, mark inactive
      if (ageHours > 12 && activePeers.length === 0) {
        db.query('UPDATE study_rooms SET is_active = false WHERE id = $1', [r.id]).catch(() => {});
        continue;
      }

      const liveCount = activePeers.length > 0 ? activePeers.length : Math.max(0, r.member_count || 0);

      data.push({
        id: r.id,
        code: r.code,
        name: r.name,
        hostId: r.host_id,
        hostName: r.host_name,
        hostAvatar: r.host_avatar,
        subject: r.subject,
        goal: r.goal,
        memberCount: liveCount,
        maxMembers: r.max_members,
        isPrivate: r.is_private,
        createdAt: new Date(r.created_at).getTime(),
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('getStudyRooms error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách phòng học' });
  }
}

/**
 * GET /api/study-station/rooms/:code
 * Lấy thông tin chi tiết 1 phòng học theo mã phòng
 */
async function getStudyRoomByCode(req, res) {
  try {
    await ensureTablesExist();
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không hợp lệ' });
    }

    const { rows } = await db.query(
      `SELECT * FROM study_rooms WHERE UPPER(code) = $1 AND is_active = true LIMIT 1`,
      [rawCode]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng học với mã này hoặc phòng đã đóng' });
    }

    const r = rows[0];
    const activePeers = getActiveParticipants(rawCode);

    res.json({
      success: true,
      data: {
        id: r.id,
        code: r.code,
        name: r.name,
        hostId: r.host_id,
        hostName: r.host_name,
        hostAvatar: r.host_avatar,
        subject: r.subject,
        goal: r.goal,
        memberCount: activePeers.length > 0 ? activePeers.length : Math.max(1, r.member_count || 1),
        maxMembers: r.max_members,
        isPrivate: r.is_private,
        createdAt: new Date(r.created_at).getTime(),
        participants: activePeers,
      },
    });
  } catch (err) {
    console.error('getStudyRoomByCode error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tìm kiếm phòng học' });
  }
}

/**
 * POST /api/study-station/rooms
 * Tạo phòng học mới
 */
async function createStudyRoom(req, res) {
  try {
    await ensureTablesExist();
    const user = req.user || null;
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên phòng không được để trống' });
    }

    const hostName = user
      ? (user.full_name || user.username || 'Học viên CSCA')
      : (req.body.hostName || req.body.host_name || 'Bạn học CSCA');
    const hostAvatar = user ? (user.avatar_url || user.avatar || null) : null;
    const hostId = user ? user.id : null;
    const subject = String(req.body.subject || 'Toán học CSCA').trim();
    const goal = String(req.body.goal || '').trim();
    const rawMax = req.body.maxMembers ?? req.body.max_members ?? 6;
    const maxMembers = Math.min(Math.max(parseInt(rawMax, 10) || 6, 2), 16);
    const isPrivate = Boolean(req.body.isPrivate ?? req.body.is_private ?? false);

    // Generate readable code: e.g. CSCA-8899
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = (req.body.code ? String(req.body.code).trim().toUpperCase() : `CSCA-${randomSuffix}`).replace(/[^A-Z0-9-]/g, '');
    const roomId = `room-${Date.now()}-${randomSuffix}`;

    const insertSql = `
      INSERT INTO study_rooms (id, code, name, host_id, host_name, host_avatar, subject, goal, member_count, max_members, is_private)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
      RETURNING *
    `;
    const { rows } = await db.query(insertSql, [
      roomId,
      code,
      name,
      hostId,
      hostName,
      hostAvatar,
      subject,
      goal,
      maxMembers,
      isPrivate,
    ]);

    // Seed initial greeting message
    await db.query(`
      INSERT INTO study_room_messages (room_code, sender_name, text, message_type)
      VALUES ($1, 'Hệ thống', $2, 'system')
    `, [code, `Phòng học "${name}" đã mở. Chúc các bạn có buổi tự học thật tập trung và hiệu quả!`]);

    const created = rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        code: created.code,
        name: created.name,
        hostId: created.host_id,
        hostName: created.host_name,
        hostAvatar: created.host_avatar,
        subject: created.subject,
        goal: created.goal,
        memberCount: created.member_count,
        maxMembers: created.max_members,
        isPrivate: created.is_private,
        createdAt: new Date(created.created_at).getTime(),
      },
    });
  } catch (err) {
    console.error('createStudyRoom error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tạo phòng học' });
  }
}

/**
 * POST /api/study-station/rooms/:code/presence
 * Đồng bộ trạng thái thành viên thật đang ở trong phòng (camera, mic, statusText)
 */
async function syncRoomPresence(req, res) {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không hợp lệ' });
    }

    const user = req.user || null;
    const peerId = String(req.body.peerId || (user ? `user-${user.id}` : `guest-${req.ip}`)).slice(0, 80);
    const name = user
      ? (user.full_name || user.username || 'Sĩ tử CSCA')
      : String(req.body.name || 'Sĩ tử CSCA').trim().slice(0, 50);
    const avatar = user ? (user.avatar_url || user.avatar || null) : (req.body.avatar || null);
    const isCameraOn = Boolean(req.body.isCameraOn);
    const isMicOn = Boolean(req.body.isMicOn);
    const statusText = String(req.body.statusText || 'Đang tập trung học').trim().slice(0, 100);
    const isHost = Boolean(req.body.isHost);

    if (!roomParticipantsMap.has(rawCode)) {
      roomParticipantsMap.set(rawCode, new Map());
    }
    const roomMap = roomParticipantsMap.get(rawCode);
    roomMap.set(peerId, {
      peerId,
      userId: user ? user.id : null,
      name,
      avatar,
      isCameraOn,
      isMicOn,
      statusText,
      isHost,
      lastSeen: Date.now(),
    });

    const activePeers = getActiveParticipants(rawCode);
    // Update DB member_count asynchronously
    db.query('UPDATE study_rooms SET member_count = $1 WHERE UPPER(code) = $2', [
      activePeers.length,
      rawCode,
    ]).catch(() => {});

    res.json({
      success: true,
      data: {
        roomCode: rawCode,
        memberCount: activePeers.length,
        participants: activePeers,
      },
    });
  } catch (err) {
    console.error('syncRoomPresence error:', err);
    res.status(500).json({ success: false, message: 'Lỗi đồng bộ trạng thái phòng học' });
  }
}

/**
 * POST /api/study-station/rooms/:code/leave
 * Rời phòng học
 */
async function leaveStudyRoom(req, res) {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    const user = req.user || null;
    const peerId = String(req.body?.peerId || (user ? `user-${user.id}` : '')).slice(0, 80);

    const roomMap = roomParticipantsMap.get(rawCode);
    if (roomMap && peerId) {
      roomMap.delete(peerId);
    }

    const activePeers = getActiveParticipants(rawCode);
    await db.query('UPDATE study_rooms SET member_count = $1 WHERE UPPER(code) = $2', [
      activePeers.length,
      rawCode,
    ]).catch(() => {});

    res.json({
      success: true,
      data: {
        roomCode: rawCode,
        memberCount: activePeers.length,
      },
    });
  } catch (err) {
    console.error('leaveStudyRoom error:', err);
    res.status(500).json({ success: false, message: 'Lỗi rời phòng học' });
  }
}

/**
 * DELETE /api/study-station/rooms/:code
 * Đóng / xóa phòng học (dành cho chủ phòng hoặc Admin)
 */
async function deleteStudyRoom(req, res) {
  try {
    await ensureTablesExist();
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không hợp lệ' });
    }

    const user = req.user || null;
    const { rows } = await db.query('SELECT * FROM study_rooms WHERE UPPER(code) = $1 LIMIT 1', [rawCode]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng học' });
    }

    const room = rows[0];
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    const isHost = user && room.host_id && Number(room.host_id) === Number(user.id);

    // If room was created by a logged-in user, only that host or an admin can delete it
    if (room.host_id && !isHost && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Chỉ chủ phòng hoặc Admin mới có quyền đóng phòng này' });
    }

    roomParticipantsMap.delete(rawCode);
    await db.query('DELETE FROM study_room_messages WHERE UPPER(room_code) = $1', [rawCode]);
    await db.query('DELETE FROM study_rooms WHERE UPPER(code) = $1', [rawCode]);

    res.json({
      success: true,
      message: 'Đã đóng và xóa phòng học thành công',
    });
  } catch (err) {
    console.error('deleteStudyRoom error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xóa phòng học' });
  }
}

/**
 * GET /api/study-station/rooms/:code/messages
 * Lấy lịch sử chat của một phòng học cụ thể
 */
async function getRoomMessages(req, res) {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không hợp lệ' });
    }

    const { rows } = await db.query(`
      SELECT 
        id,
        room_code,
        user_id,
        sender_name,
        sender_avatar,
        text,
        message_type,
        created_at
      FROM study_room_messages
      WHERE UPPER(room_code) = $1
      ORDER BY created_at ASC
      LIMIT 100
    `, [rawCode]);

    const formatted = rows.map((r) => {
      const dt = new Date(r.created_at);
      const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
      return {
        id: String(r.id),
        roomCode: r.room_code,
        userId: r.user_id,
        sender: r.sender_name,
        avatar: r.sender_avatar,
        text: r.text,
        messageType: r.message_type,
        time: timeStr,
        createdAt: r.created_at,
      };
    });

    res.json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error('getRoomMessages error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn phòng' });
  }
}

/**
 * POST /api/study-station/rooms/:code/messages
 * Gửi tin nhắn vào phòng học
 */
async function createRoomMessage(req, res) {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không hợp lệ' });
    }

    const rawText = String(req.body.text || '').trim();
    if (!rawText) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }
    if (rawText.length > 500) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn tối đa 500 ký tự' });
    }

    const messageType = ['text', 'cheer', 'system'].includes(req.body.messageType)
      ? req.body.messageType
      : 'text';

    const user = req.user || null;
    let senderName = 'Bạn học CSCA';
    let senderAvatar = null;
    let userId = null;

    if (user) {
      userId = user.id;
      senderName = user.full_name || user.username || 'Tôi (Bạn)';
      senderAvatar = user.avatar_url || user.avatar || null;
    } else if (req.body.senderName) {
      senderName = String(req.body.senderName).trim().slice(0, 50);
    }

    const insertSql = `
      INSERT INTO study_room_messages (room_code, user_id, sender_name, sender_avatar, text, message_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await db.query(insertSql, [
      rawCode,
      userId,
      senderName,
      senderAvatar,
      rawText,
      messageType,
    ]);

    const created = rows[0];
    const dt = new Date(created.created_at);
    const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;

    res.status(201).json({
      success: true,
      data: {
        id: String(created.id),
        roomCode: created.room_code,
        userId: created.user_id,
        sender: created.sender_name,
        avatar: created.sender_avatar,
        text: created.text,
        messageType: created.message_type,
        time: timeStr,
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    console.error('createRoomMessage error:', err);
    res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn phòng' });
  }
}

module.exports = {
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
};
