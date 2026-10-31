const db = require('../config/database');

let tablesEnsured = false;

const DEFAULT_MOTIVATION_VIDEOS = [
  {
    id: '7289808453412588806',
    title: 'Kỷ luật bản thân: Thức dậy khi người khác còn đang ngủ',
    creator: 'Chiến Binh Kỷ Luật',
    creatorHandle: '@chienthankykl',
    category: 'discipline',
    tags: ['#kyluat', '#hocdem', '#csca2026'],
    likes: 12480,
    message: 'Nỗi đau của kỷ luật bao giờ cũng nhẹ hơn nỗi đau của sự hối hận. Cố lên bạn ơi!',
  },
  {
    id: '7189104033379208474',
    title: 'Những đêm 2h sáng ôn thi: Cái giá của sự đỗ đạt',
    creator: 'Cú Đêm Ôn Thi',
    creatorHandle: '@cudem_study',
    category: 'exam',
    tags: ['#onthi', '#studywithme', '#hocbong'],
    likes: 15300,
    message: 'Khi bạn thấy mệt mỏi muốn gục ngã, hãy nhớ về lý do vì sao ngày đầu tiên bạn bắt đầu!',
  },
  {
    id: '7301031948817452293',
    title: 'Phương pháp Pomodoro & Deep Work: Học 4 tiếng không mỏi',
    creator: 'Góc Học Thông Minh',
    creatorHandle: '@gochocthongminh',
    category: 'tips',
    tags: ['#pomodoro', '#meohoctap', '#taptrung'],
    likes: 8210,
    message: 'Học thông minh quan trọng hơn học vất vả. Tập trung 100% trong 25 phút mang lại hiệu quả gấp 3 lần.',
  },
  {
    id: '7207435168051940613',
    title: 'Gửi bạn đang tự ti về xuất phát điểm của mình',
    creator: 'Động Lực Mỗi Ngày',
    creatorHandle: '@dongluc_moingay',
    category: 'discipline',
    tags: ['#noLuc', '#vuotlenchinhminh', '#csca'],
    likes: 21900,
    message: 'Xuất phát điểm của bạn ở đâu không quyết định vạch đích của bạn. Chỉ có sự bền bỉ mới tạo nên kỳ tích.',
  },
  {
    id: '7268800977259203846',
    title: 'Ngày cầm giấy báo trúng tuyển trường mơ ước',
    creator: 'Thanh Xuân Du Học',
    creatorHandle: '@thanhxuan_duhoc',
    category: 'scholarship',
    tags: ['#duhoctrungquoc', '#hocbongcsc', '#thanhcong'],
    likes: 18400,
    message: 'Cảm giác cầm tờ giấy báo trúng tuyển trên tay sẽ xóa tan mọi giọt mồ hôi và nước mắt hôm nay.',
  },
];

async function ensureTablesExist() {
  if (tablesEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS study_station_chats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sender_name VARCHAR(100) NOT NULL,
        sender_avatar TEXT,
        badge VARCHAR(100),
        badge_color VARCHAR(150),
        text TEXT NOT NULL,
        video_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS study_rooms (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(40) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        host_name VARCHAR(100) NOT NULL,
        host_avatar TEXT,
        subject VARCHAR(100) NOT NULL DEFAULT 'Toán học CSCA',
        goal TEXT,
        member_count INTEGER NOT NULL DEFAULT 1,
        max_members INTEGER NOT NULL DEFAULT 6,
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS study_room_messages (
        id SERIAL PRIMARY KEY,
        room_code VARCHAR(40) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sender_name VARCHAR(100) NOT NULL,
        sender_avatar TEXT,
        text TEXT NOT NULL,
        message_type VARCHAR(30) NOT NULL DEFAULT 'text',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS study_station_videos (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        creator VARCHAR(100) NOT NULL DEFAULT 'Chiến Binh CSCA',
        creator_handle VARCHAR(100) NOT NULL DEFAULT '@csca.motivation',
        category VARCHAR(40) NOT NULL DEFAULT 'discipline',
        tags JSONB DEFAULT '["#dongluc", "#csca"]'::jsonb,
        likes INTEGER NOT NULL DEFAULT 1,
        message TEXT,
        original_url TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const v of DEFAULT_MOTIVATION_VIDEOS) {
      await db.query(
        `
        INSERT INTO study_station_videos (id, title, creator, creator_handle, category, tags, likes, message)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          v.id,
          v.title,
          v.creator,
          v.creatorHandle,
          v.category,
          JSON.stringify(v.tags),
          v.likes,
          v.message,
        ]
      );
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS study_station_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(100) NOT NULL,
        user_avatar TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 25,
        subject VARCHAR(100) DEFAULT 'Tự học CSCA',
        dream_university VARCHAR(150),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    tablesEnsured = true;
  } catch (err) {
    console.error('ensureTablesExist error:', err);
  }
}

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
 * GET /api/study-station/videos
 * Lấy danh sách video TikTok truyền động lực từ SQL database
 */
async function getStationVideos(req, res) {
  try {
    await ensureTablesExist();
    const { rows } = await db.query(`
      SELECT
        id,
        title,
        creator,
        creator_handle,
        category,
        tags,
        likes,
        message,
        original_url,
        created_by,
        created_at
      FROM study_station_videos
      ORDER BY created_at DESC
      LIMIT 60
    `);

    const data = rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      creator: r.creator,
      creatorHandle: r.creator_handle,
      category: r.category || 'discipline',
      tags: Array.isArray(r.tags) ? r.tags : ['#dongluc', '#csca'],
      likes: Number(r.likes) || 0,
      message: r.message || '',
      originalUrl: r.original_url || undefined,
      createdBy: r.created_by,
      isCustom: Boolean(r.created_by || r.original_url),
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('getStationVideos error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách video động lực' });
  }
}

/**
 * POST /api/study-station/videos
 * Chia sẻ video TikTok mới lên Trạm Động Lực (lưu dùng chung cho toàn bộ học viên)
 */
async function createStationVideo(req, res) {
  try {
    await ensureTablesExist();
    const id = String(req.body.id || '').trim();
    const title = String(req.body.title || '').trim();
    if (!id || !title) {
      return res.status(400).json({ success: false, message: 'Mã video và tiêu đề không được để trống' });
    }

    const user = req.user || null;
    const creator = String(
      req.body.creator || (user ? user.full_name || user.username : '') || 'Chiến Binh CSCA'
    )
      .trim()
      .slice(0, 80);
    const creatorHandle = String(
      req.body.creatorHandle ||
        (user?.username ? `@${user.username}` : '@csca.motivation')
    )
      .trim()
      .slice(0, 80);
    const validCategories = ['discipline', 'exam', 'tips', 'scholarship'];
    const category = validCategories.includes(req.body.category)
      ? req.body.category
      : 'discipline';
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.slice(0, 6).map((t) => String(t))
      : ['#dongluc', '#csca', '#studywithme'];
    const message = String(
      req.body.message ||
        'Video truyền động lực được chia sẻ bởi thành viên cộng đồng CSCA. Cùng cố gắng nhé!'
    )
      .trim()
      .slice(0, 400);
    const originalUrl = req.body.originalUrl ? String(req.body.originalUrl).trim() : null;
    const createdBy = user ? user.id : null;

    const { rows } = await db.query(
      `
      INSERT INTO study_station_videos (id, title, creator, creator_handle, category, tags, likes, message, original_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 1, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        message = EXCLUDED.message,
        original_url = COALESCE(EXCLUDED.original_url, study_station_videos.original_url)
      RETURNING *
      `,
      [
        id,
        title.slice(0, 250),
        creator,
        creatorHandle,
        category,
        JSON.stringify(tags),
        message,
        originalUrl,
        createdBy,
      ]
    );

    const r = rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: String(r.id),
        title: r.title,
        creator: r.creator,
        creatorHandle: r.creator_handle,
        category: r.category,
        tags: Array.isArray(r.tags) ? r.tags : tags,
        likes: Number(r.likes) || 1,
        message: r.message || '',
        originalUrl: r.original_url || undefined,
        createdBy: r.created_by,
        isCustom: true,
      },
    });
  } catch (err) {
    console.error('createStationVideo error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lưu video động lực' });
  }
}

/**
 * POST /api/study-station/videos/:id/like
 * Thả tim hoặc bỏ tim cho video động lực
 */
async function likeStationVideo(req, res) {
  try {
    await ensureTablesExist();
    const videoId = String(req.params.id || '').trim();
    if (!videoId) {
      return res.status(400).json({ success: false, message: 'Mã video không hợp lệ' });
    }
    const delta = req.body?.delta === -1 ? -1 : 1;

    const { rows } = await db.query(
      `
      UPDATE study_station_videos
      SET likes = GREATEST(0, likes + $1)
      WHERE id = $2
      RETURNING id, likes
      `,
      [delta, videoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy video' });
    }

    res.json({
      success: true,
      data: {
        id: rows[0].id,
        likes: Number(rows[0].likes) || 0,
      },
    });
  } catch (err) {
    console.error('likeStationVideo error:', err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật lượt tim video' });
  }
}

/**
 * DELETE /api/study-station/videos/:id
 * Xóa video động lực (dành cho người đăng hoặc Admin)
 */
async function deleteStationVideo(req, res) {
  try {
    await ensureTablesExist();
    const videoId = String(req.params.id || '').trim();
    const user = req.user || null;

    const { rows } = await db.query('SELECT * FROM study_station_videos WHERE id = $1 LIMIT 1', [
      videoId,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy video' });
    }

    const video = rows[0];
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    const isOwner = user && video.created_by && Number(video.created_by) === Number(user.id);

    if (video.created_by && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người đăng video hoặc Admin mới có quyền xóa video này',
      });
    }

    await db.query('DELETE FROM study_station_videos WHERE id = $1', [videoId]);
    res.json({
      success: true,
      message: 'Đã xóa video thành công',
    });
  } catch (err) {
    console.error('deleteStationVideo error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xóa video' });
  }
}

/**
 * POST /api/study-station/sessions
 * Ghi nhận 1 phiên học Pomodoro hoàn thành và trả về thống kê cá nhân
 */
async function recordStudySession(req, res) {
  try {
    await ensureTablesExist();
    const user = req.user || null;
    const durationMinutes = Math.min(
      Math.max(parseInt(req.body.durationMinutes, 10) || 25, 1),
      240
    );
    const subject = String(req.body.subject || 'Tự học CSCA').trim().slice(0, 100);
    const dreamUniversity = req.body.dreamUniversity
      ? String(req.body.dreamUniversity).trim().slice(0, 150)
      : null;

    const userId = user ? user.id : null;
    const userName = user
      ? user.full_name || user.username || 'Chiến binh CSCA'
      : String(req.body.userName || 'Chiến binh CSCA').trim().slice(0, 80);
    const userAvatar = user ? user.avatar_url || user.avatar || null : null;

    await db.query(
      `
      INSERT INTO study_station_sessions (user_id, user_name, user_avatar, duration_minutes, subject, dream_university)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [userId, userName, userAvatar, durationMinutes, subject, dreamUniversity]
    );

    const filterClause = userId ? 'user_id = $1' : 'user_name = $1';
    const filterParam = userId ? userId : userName;

    const statsRes = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN duration_minutes ELSE 0 END), 0)::int AS today_minutes,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int AS today_sessions,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN duration_minutes ELSE 0 END), 0)::int AS week_minutes
      FROM study_station_sessions
      WHERE ${filterClause}
      `,
      [filterParam]
    );

    const st = statsRes.rows[0] || { today_minutes: durationMinutes, today_sessions: 1, week_minutes: durationMinutes };

    res.status(201).json({
      success: true,
      data: {
        todayMinutes: Number(st.today_minutes) || 0,
        todaySessions: Number(st.today_sessions) || 0,
        weekMinutes: Number(st.week_minutes) || 0,
      },
    });
  } catch (err) {
    console.error('recordStudySession error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lưu phiên học Pomodoro' });
  }
}

/**
 * GET /api/study-station/leaderboard
 * Bảng vàng Chăm Chỉ (Top học viên học nhiều nhất 24h qua và 7 ngày qua)
 */
async function getStudyLeaderboard(req, res) {
  try {
    await ensureTablesExist();
    const user = req.user || null;

    const [todayRes, weekRes] = await Promise.all([
      db.query(`
        SELECT
          MAX(user_id) AS user_id,
          MAX(user_name) AS user_name,
          MAX(user_avatar) AS user_avatar,
          SUM(duration_minutes)::int AS total_minutes,
          COUNT(*)::int AS sessions_count,
          MAX(dream_university) AS dream_university
        FROM study_station_sessions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY COALESCE(CAST(user_id AS TEXT), user_name)
        ORDER BY total_minutes DESC, sessions_count DESC
        LIMIT 10
      `),
      db.query(`
        SELECT
          MAX(user_id) AS user_id,
          MAX(user_name) AS user_name,
          MAX(user_avatar) AS user_avatar,
          SUM(duration_minutes)::int AS total_minutes,
          COUNT(*)::int AS sessions_count,
          MAX(dream_university) AS dream_university
        FROM study_station_sessions
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY COALESCE(CAST(user_id AS TEXT), user_name)
        ORDER BY total_minutes DESC, sessions_count DESC
        LIMIT 10
      `),
    ]);

    let myStats = { todayMinutes: 0, todaySessions: 0, weekMinutes: 0 };
    if (user?.id) {
      const myRes = await db.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN duration_minutes ELSE 0 END), 0)::int AS today_minutes,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int AS today_sessions,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN duration_minutes ELSE 0 END), 0)::int AS week_minutes
        FROM study_station_sessions
        WHERE user_id = $1
        `,
        [user.id]
      );
      if (myRes.rows[0]) {
        myStats = {
          todayMinutes: Number(myRes.rows[0].today_minutes) || 0,
          todaySessions: Number(myRes.rows[0].today_sessions) || 0,
          weekMinutes: Number(myRes.rows[0].week_minutes) || 0,
        };
      }
    }

    const formatRows = (rows) =>
      rows.map((r) => ({
        userId: r.user_id,
        userName: r.user_name,
        userAvatar: r.user_avatar,
        totalMinutes: Number(r.total_minutes) || 0,
        sessionsCount: Number(r.sessions_count) || 0,
        dreamUniversity: r.dream_university || undefined,
      }));

    res.json({
      success: true,
      data: {
        topToday: formatRows(todayRes.rows),
        topWeek: formatRows(weekRes.rows),
        myStats,
      },
    });
  } catch (err) {
    console.error('getStudyLeaderboard error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải bảng xếp hạng học tập' });
  }
}

/**
 * GET /api/study-station/chats
 * Lấy danh sách tin nhắn cộng đồng ở Trạm Động Lực (TikTok Motivation)
 */
async function getStationChats(req, res) {
  try {
    await ensureTablesExist();
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
    await ensureTablesExist();
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
// Map<roomCode, Map<peerId, { peerId, userId, name, avatar, isCameraOn, isMicOn, statusText, isHost, cameraFrame, lastSeen }>>
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
    const user = req.user || null;
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

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

      // Filter out private rooms unless requester is the host or admin
      const isHost = user && r.host_id && Number(r.host_id) === Number(user.id);
      if (r.is_private && !isHost && !isAdmin) {
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
 * Đồng bộ trạng thái thành viên thật đang ở trong phòng (camera, mic, statusText, cameraFrame)
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
    const rawFrame = req.body.cameraFrame;
    const cameraFrame =
      isCameraOn &&
      typeof rawFrame === 'string' &&
      rawFrame.startsWith('data:image/') &&
      rawFrame.length <= 60000
        ? rawFrame
        : null;

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
      cameraFrame,
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
    await ensureTablesExist();
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
    await ensureTablesExist();
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
};
