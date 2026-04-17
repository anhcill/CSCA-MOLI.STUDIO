const User = require("../models/User");
const bcrypt = require("bcrypt");
const db = require("../config/database");

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
    // Get attempts statistics
    const examRes = await db.query(
      `SELECT COUNT(*) as total_completed, ROUND(AVG(total_score)::numeric, 1) as avg_score
       FROM exam_attempts WHERE user_id = $1 AND status = 'completed'`, [userId]
    );
    
    const attempts = parseInt(examRes.rows[0]?.total_completed) || 0;
    const avgScore = parseFloat(examRes.rows[0]?.avg_score) || 0;

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
        stats: { attempts, avgScore },
        milestones
      }
    });
  } catch (error) {
    console.error("Get roadmap error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
