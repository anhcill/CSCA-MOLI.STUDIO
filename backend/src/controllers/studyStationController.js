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

/**
 * GET /api/study-station/rooms
 * Lấy danh sách các phòng học trực tuyến đang hoạt động
 */
async function getStudyRooms(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT 
        id,
        code,
        name,
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

    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      hostName: r.host_name,
      hostAvatar: r.host_avatar,
      subject: r.subject,
      goal: r.goal,
      memberCount: r.member_count,
      maxMembers: r.max_members,
      isPrivate: r.is_private,
      createdAt: new Date(r.created_at).getTime(),
    }));

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
 * POST /api/study-station/rooms
 * Tạo phòng học mới
 */
async function createStudyRoom(req, res) {
  try {
    const user = req.user || null;
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên phòng không được để trống' });
    }

    const hostName = user ? (user.full_name || user.username || 'Học viên CSCA') : (req.body.hostName || 'Bạn học CSCA');
    const hostAvatar = user ? (user.avatar_url || user.avatar || null) : null;
    const hostId = user ? user.id : null;
    const subject = String(req.body.subject || 'Toán học CSCA').trim();
    const goal = String(req.body.goal || '').trim();
    const maxMembers = Math.min(Math.max(parseInt(req.body.maxMembers, 10) || 6, 2), 16);
    const isPrivate = Boolean(req.body.isPrivate);

    // Generate readable code: e.g. CSCA-8899
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = (req.body.code ? String(req.body.code).trim().toUpperCase() : `ROOM-${randomSuffix}`).replace(/[^A-Z0-9-]/g, '');
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
    `, [code, `Chào mừng bạn đến phòng học "${name}". Chúc các bạn buổi học năng suất!`]);

    const created = rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        code: created.code,
        name: created.name,
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
  createStudyRoom,
  getRoomMessages,
  createRoomMessage,
};
