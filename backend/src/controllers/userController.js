const User = require("../models/User");
const bcrypt = require("bcrypt");
const db = require("../config/database");
const coinService = require("../services/coinService");
const DeviceSessionService = require("../services/deviceSessionService");

const SUBJECT_ALIASES = {
  toan: "MATH",
  math: "MATH",
  "vat-ly": "PHYSICS",
  vatly: "PHYSICS",
  physics: "PHYSICS",
  hoa: "CHEMISTRY",
  "hoa-hoc": "CHEMISTRY",
  hoahoc: "CHEMISTRY",
  chemistry: "CHEMISTRY",
  "tiengtrung-xahoi": "CHINESE_SOC",
  "tieng-trung-xh": "CHINESE_SOC",
  "tieng-trung-xahoi": "CHINESE_SOC",
  chinese_soc: "CHINESE_SOC",
  "tiengtrung-tunhien": "CHINESE_SCI",
  "tieng-trung-tn": "CHINESE_SCI",
  "tieng-trung-tunhien": "CHINESE_SCI",
  chinese_sci: "CHINESE_SCI",
};

function normalizeSubjectCode(value) {
  const key = String(value || "").trim();
  if (!key) return null;
  return SUBJECT_ALIASES[key.toLowerCase()] || key.toUpperCase();
}

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Public
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, username, full_name, avatar, role, created_at
       FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/:id
 * @access  Private (own profile only)
 */
exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, bio, target_score, display_name } = req.body;

    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: "Bạn chỉ có thể cập nhật profile của chính mình" });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (target_score !== undefined) updates.target_score = target_score;
    if (display_name !== undefined) updates.display_name = display_name;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Không có thông tin để cập nhật" });
    }

    const updatedUser = await User.update(id, updates);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({ success: true, message: "Cập nhật profile thành công", data: { user: updatedUser } });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Update user avatar
 * @route   POST /api/users/:id/avatar
 * @access  Private (own profile only)
 */
exports.updateAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const { avatar } = req.body;

    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: "Bạn chỉ có thể cập nhật avatar của chính mình" });
    }
    if (!avatar) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp avatar URL" });
    }

    const updatedUser = await User.update(id, { avatar });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({ success: true, message: "Cập nhật avatar thành công", data: { user: updatedUser } });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Get user stats
 * @route   GET /api/users/:id/stats
 * @access  Public
 */
exports.getUserStats = async (req, res) => {
  try {
    const { id } = req.params;

    let totalExams = 0, avgScore = 0, highestScore = 0, totalPosts = 0;

    try {
      const examRes = await db.query(
        `SELECT COUNT(*) as total,
                ROUND(AVG(total_score)::numeric, 1) as avg_score,
                MAX(total_score) as highest_score
         FROM exam_attempts WHERE user_id = $1 AND status = 'completed'`, [id]
      );
      if (examRes.rows[0]) {
        totalExams = parseInt(examRes.rows[0].total) || 0;
        avgScore = parseFloat(examRes.rows[0].avg_score) || 0;
        highestScore = parseFloat(examRes.rows[0].highest_score) || 0;
      }
    } catch (_) { }

    try {
      const postRes = await db.query(`SELECT COUNT(*) as total FROM posts WHERE user_id = $1`, [id]);
      totalPosts = parseInt(postRes.rows[0]?.total) || 0;
    } catch (_) { }

    res.json({
      success: true,
      data: { total_exams: totalExams, avg_score: avgScore, highest_score: highestScore, total_posts: totalPosts, total_comments: 0 },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Change user password
 * @route   POST /api/users/:id/change-password
 * @access  Private (own profile only)
 */
exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: "Không có quyền thực hiện" });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 8 ký tự" });
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 1 chữ cái và 1 số" });
    }

    const result = await db.query('SELECT id, password FROM users WHERE id = $1', [id]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    if (!user.password) {
      return res.status(400).json({ success: false, message: "Tài khoản này đăng nhập bằng Google, không có mật khẩu" });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải khác mật khẩu cũ" });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [newHash, id]);

    // Đổi mật khẩu phải thu hồi các phiên khác để token bị lộ trước đó không
    // tiếp tục truy cập tài khoản. Giữ lại phiên hiện tại để người dùng không
    // bị đá khỏi màn hình vừa thao tác.
    await DeviceSessionService.removeAllUserSessions(id, {
      exceptJti: req.user.jti,
    });

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server, vui lòng thử lại" });
  }
};

/**
 * @desc    Get user roadmap progress
 * @route   GET /api/users/roadmap
 * @access  Private
 */
exports.getUserRoadmap = async (req, res) => {
  try {
    const userId = req.user.id;
    const subjectCode = normalizeSubjectCode(req.query.subject);
    const params = [userId];
    let subjectJoin = "";
    let subjectWhere = "";

    if (subjectCode) {
      params.push(subjectCode);
      subjectJoin = "JOIN exams e ON e.id = ea.exam_id JOIN subjects s ON s.id = e.subject_id";
      subjectWhere = `AND s.code = $${params.length}`;
    }

    // Get attempts statistics
    const examRes = await db.query(
      `SELECT
         COUNT(*) as total_completed,
         ROUND(AVG(ea.total_score)::numeric, 1) as avg_score,
         MAX(ea.submit_time) as last_submit_time
       FROM exam_attempts ea
       ${subjectJoin}
       WHERE ea.user_id = $1
         AND ea.status = 'completed'
         ${subjectWhere}`,
      params,
    );

    const trendRes = await db.query(
      `SELECT
         ROUND(AVG(ea.total_score) FILTER (WHERE ea.submit_time >= NOW() - INTERVAL '7 days')::numeric, 1) as avg_7d,
         ROUND(AVG(ea.total_score) FILTER (WHERE ea.submit_time < NOW() - INTERVAL '7 days' AND ea.submit_time >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_prev
       FROM exam_attempts ea
       ${subjectJoin}
       WHERE ea.user_id = $1
         AND ea.status = 'completed'
         ${subjectWhere}`,
      params,
    );
    
    const attempts = parseInt(examRes.rows[0]?.total_completed) || 0;
    const avgScore = parseFloat(examRes.rows[0]?.avg_score) || 0;
    const avg7d = parseFloat(trendRes.rows[0]?.avg_7d) || 0;
    const avgPrev = parseFloat(trendRes.rows[0]?.avg_prev) || 0;
    const weeklyChange = avg7d && avgPrev ? Math.round((avg7d - avgPrev) * 10) / 10 : 0;

    let rows = [];
    try {
      const milestonesResult = await db.query(
        `SELECT
           id,
           title,
           description,
           min_attempts,
           min_avg_score,
           icon,
           color,
           sort_order
         FROM roadmap_milestones
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`,
      );
      rows = milestonesResult.rows;
    } catch (err) {
      rows = [
        { id: 1, title: "Khởi đầu vững chắc", description: "Hoàn thành bài đánh giá năng lực đầu vào.", min_attempts: 1, min_avg_score: 0, icon: "FaFlagCheckered", color: "bg-green-500" },
        { id: 2, title: "Vượt chướng ngại vật", description: "Đang ôn tập kiến thức cơ bản nền tảng (Yêu cầu: Giải 5 đề).", min_attempts: 5, min_avg_score: 0, icon: "FaMountain", color: "bg-blue-500" },
        { id: 3, title: "Tăng tốc chạy lướt", description: "Luyện đề vận dụng cao (Yêu cầu: Giải 15 đề, điểm TB >= 6.0).", min_attempts: 15, min_avg_score: 6.0, icon: "FaRunning", color: "bg-orange-500" },
        { id: 4, title: "Về đích huy hoàng", description: "Thi thử áp lực 180 phút phòng VIP (Yêu cầu: Giải 30 đề, điểm TB >= 8.0).", min_attempts: 30, min_avg_score: 8.0, icon: "FaTrophy", color: "bg-purple-500" },
      ];
    }
    let currentAssigned = false;
    const milestones = rows.map((row) => {
      const minAttempts = parseInt(row.min_attempts) || 0;
      const minAvgScore = parseFloat(row.min_avg_score) || 0;
      const completed = attempts >= minAttempts && avgScore >= minAvgScore;

      let status = "locked";
      if (completed) {
        status = "completed";
      } else if (!currentAssigned) {
        status = "current";
        currentAssigned = true;
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status,
        icon: row.icon || "FiTarget",
        color: row.color || "bg-indigo-500",
      };
    });

    res.json({
      success: true,
      data: {
        stats: {
          attempts,
          avgScore,
          subjectCode,
          weeklyChange,
          lastSubmitTime: examRes.rows[0]?.last_submit_time || null,
        },
        milestones
      }
    });
  } catch (error) {
    console.error("Get roadmap error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Record daily activity to update streak
 * @route   POST /api/users/record-activity
 * @access  Private
 */
exports.recordActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch current streak
    const result = await db.query(
      `SELECT current_streak, longest_streak, last_active_date 
       FROM users WHERE id = $1`, [userId]
    );
    
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    
    const user = result.rows[0];
    
    // Get current date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh or UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    let lastActive = user.last_active_date ? new Date(user.last_active_date) : null;
    if (lastActive) lastActive.setHours(0, 0, 0, 0);

    const diffDays = lastActive 
      ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    if (diffDays === 0) {
      // Đã ghi nhận hôm nay rồi
      return res.json({ 
        success: true, 
        data: { streak: user.current_streak || 0, increased: false } 
      });
    }

    let newStreak = user.current_streak || 0;
    let newLongest = user.longest_streak || 0;

    if (diffDays === 1) {
      // Liên tiếp
      newStreak += 1;
    } else {
      // Đứt chuỗi hoặc lần đầu tiên
      newStreak = 1;
    }

    newLongest = Math.max(newStreak, newLongest);

    await db.query(
      `UPDATE users 
       SET current_streak = $1, longest_streak = $2, last_active_date = CURRENT_DATE 
       WHERE id = $3`,
      [newStreak, newLongest, userId]
    );

    return res.json({ 
      success: true, 
      message: "Đã ghi nhận chuỗi ngày học",
      data: { streak: newStreak, increased: true } 
    });
  } catch (error) {
    console.error("Record activity error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Get daily quests
 * @route   GET /api/users/quests
 * @access  Private
 */
exports.getDailyQuests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if quests exist for today
    const questsRes = await db.query(
      `SELECT id, quest_type, target, progress, is_completed, reward_coins
       FROM user_quests
       WHERE user_id = $1 AND date = CURRENT_DATE
       ORDER BY id ASC`,
      [userId]
    );

    if (questsRes.rows.length === 0) {
      // Generate new quests for today
      // 1. Đăng nhập (login) - target: 1
      // 2. Làm 1 đề thi (do_exam) - target: 1
      // 3. Học từ vựng (learn_vocab) - target: 10
      await db.query(
        `INSERT INTO user_quests (user_id, quest_type, target, reward_coins, date) VALUES
         ($1, 'login', 1, 10, CURRENT_DATE),
         ($1, 'do_exam', 1, 20, CURRENT_DATE),
         ($1, 'learn_vocab', 10, 15, CURRENT_DATE),
         ($1, 'game_play', 1, 12, CURRENT_DATE),
         ($1, 'game_accuracy', 1, 18, CURRENT_DATE),
         ($1, 'rank_win', 1, 30, CURRENT_DATE)
         ON CONFLICT (user_id, quest_type, date) DO NOTHING`,
        [userId]
      );
      
      // Update login progress immediately if generated today
      await db.query(
        `UPDATE user_quests SET progress = 1 WHERE user_id = $1 AND quest_type = 'login' AND date = CURRENT_DATE AND progress = 0`,
        [userId]
      );

      const newQuestsRes = await db.query(
        `SELECT id, quest_type, target, progress, is_completed, reward_coins
         FROM user_quests
         WHERE user_id = $1 AND date = CURRENT_DATE
         ORDER BY id ASC`,
        [userId]
      );
      return res.json({ success: true, data: { quests: newQuestsRes.rows } });
    }

    return res.json({ success: true, data: { quests: questsRes.rows } });
  } catch (error) {
    console.error("Get daily quests error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * @desc    Claim quest reward
 * @route   POST /api/users/quests/:id/claim
 * @access  Private
 */
exports.claimQuest = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await client.query('BEGIN');
    const questRes = await client.query(
      `SELECT id, target, progress, is_completed, reward_coins
       FROM user_quests
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [id, userId],
    );

    if (questRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Không tìm thấy nhiệm vụ" });
    }

    const quest = questRes.rows[0];
    if (quest.is_completed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: "Nhiệm vụ này đã nhận thưởng rồi" });
    }
    if (quest.progress < quest.target) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: "Nhiệm vụ chưa hoàn thành" });
    }

    await client.query(`UPDATE user_quests SET is_completed = TRUE WHERE id = $1`, [id]);
    const ledger = await coinService.credit(userId, quest.reward_coins, "daily_quest", {
      description: "Nhận thưởng nhiệm vụ hằng ngày",
      metadata: { questId: Number(id) },
      idempotencyKey: `quest:${id}:claim`,
      client,
    });
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Nhận thành công ${quest.reward_coins} xu!`,
      data: { reward_coins: quest.reward_coins, balance: ledger.balance_after },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Claim quest error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server",
      code: error.code,
    });
  } finally {
    client.release();
  }
};

