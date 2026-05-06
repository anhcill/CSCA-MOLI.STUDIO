const db = require("../config/database");

/**
 * Get public profile of any user (enriched with stats, posts, badges)
 * @route   GET /api/users/:id/profile
 * @access  Public
 */
exports.getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id ? parseInt(req.user.id) : null;
    const viewerIdParam = viewerId || -1;

    const result = await db.query(`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.avatar,
        u.avatar_url,
        u.role,
        u.bio,
        u.is_vip,
        u.subscription_tier,
        u.is_verified,
        u.created_at,
        COALESCE(us.total_exams_taken, 0)::INTEGER as total_exams,
        COALESCE(us.total_exams_completed, 0)::INTEGER as total_completed,
        COALESCE(us.average_score, 0)::DECIMAL as avg_score,
        COALESCE(us.highest_score, 0)::DECIMAL as highest_score,
        COALESCE(us.current_streak, 0)::INTEGER as current_streak,
        COALESCE(us.longest_streak, 0)::INTEGER as longest_streak,
        (
          SELECT COUNT(*)::INTEGER FROM posts p
          WHERE p.user_id = u.id AND p.moderation_status = 'approved'
        ) as total_posts,
        (
          SELECT COUNT(*)::INTEGER FROM post_likes pl
          JOIN posts p2 ON pl.post_id = p2.id
          WHERE p2.user_id = u.id
        ) as total_likes_received
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      WHERE u.id = $1 AND u.is_active = true
    `, [id]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const user = result.rows[0];

    // Check if viewer blocked this user
    let isBlocked = false;
    let isBlockedBy = false;
    if (viewerId && viewerId !== parseInt(id)) {
      const blockRes = await db.query(`
        SELECT 1 FROM forum_blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
        LIMIT 1
      `, [viewerId, parseInt(id)]);
      if (blockRes.rows.length > 0) {
        const selfBlock = await db.query(`
          SELECT 1 FROM forum_blocks
          WHERE blocker_id = $1 AND blocked_id = $2
          LIMIT 1
        `, [viewerId, parseInt(id)]);
        isBlocked = selfBlock.rows.length > 0;
        isBlockedBy = !isBlocked;
      }
    }

    // Recent posts
    const recentPosts = await db.query(`
      SELECT
        p.id,
        p.content,
        p.created_at,
        COALESCE((SELECT COUNT(*) FROM post_likes WHERE post_id = p.id), 0)::INTEGER as likes_count,
        COALESCE((SELECT COUNT(*) FROM post_comments WHERE post_id = p.id), 0)::INTEGER as comments_count
      FROM posts p
      WHERE p.user_id = $1 AND p.moderation_status = 'approved'
      ORDER BY p.created_at DESC
      LIMIT 5
    `, [id]);

    // Determine badges
    const badges = [];
    if (user.is_vip || user.subscription_tier === 'vip') badges.push({ type: 'vip', label: 'VIP' });
    if (user.subscription_tier === 'premium') badges.push({ type: 'premium', label: 'Premium' });
    if (user.role === 'admin') badges.push({ type: 'admin', label: 'Admin' });
    if (user.role === 'moderator') badges.push({ type: 'moderator', label: 'Mod' });
    if (parseInt(user.current_streak) >= 30) badges.push({ type: 'streak', label: `${user.current_streak} ngày` });
    if (parseInt(user.highest_score) >= 8) badges.push({ type: 'top_scorer', label: 'Top điểm' });

    res.json({
      success: true,
      data: {
        profile: {
          ...user,
          badges,
          isBlocked,
          isBlockedBy,
        },
        recentPosts: recentPosts.rows,
      },
    });
  } catch (error) {
    console.error("Get public profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Get posts by a specific user
 * @route   GET /api/users/:id/posts
 * @access  Public
 */
exports.getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT
        p.id,
        p.content,
        p.image_url,
        p.created_at,
        p.post_type,
        COALESCE((SELECT COUNT(*) FROM post_likes WHERE post_id = p.id), 0)::INTEGER as likes_count,
        COALESCE((SELECT COUNT(*) FROM post_comments WHERE post_id = p.id), 0)::INTEGER as comments_count,
        u.username,
        u.full_name,
        u.avatar,
        u.avatar_url,
        u.role,
        u.is_vip,
        u.subscription_tier
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1 AND p.moderation_status = 'approved'
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const countRes = await db.query(`
      SELECT COUNT(*)::INTEGER as total FROM posts
      WHERE user_id = $1 AND moderation_status = 'approved'
    `, [id]);

    res.json({
      success: true,
      data: {
        posts: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countRes.rows[0].total),
          totalPages: Math.ceil(countRes.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user posts error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * Update own bio
 * @route   PUT /api/users/me/bio
 * @access  Private
 */
exports.updateBio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio } = req.body;

    if (bio !== undefined && (bio.length > 500)) {
      return res.status(400).json({ success: false, message: "Bio tối đa 500 ký tự" });
    }

    await db.query(`
      UPDATE users SET bio = $1, updated_at = NOW()
      WHERE id = $2
    `, [bio || null, userId]);

    res.json({ success: true, message: "Cập nhật bio thành công" });
  } catch (error) {
    console.error("Update bio error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
