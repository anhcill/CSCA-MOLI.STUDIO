const Post = require("../models/Post");
const logger = require("../config/logger");
const { hasAnyPermission } = require("../services/rbacService");
const db = require("../config/database");

/**
 * C4 — Strip HTML tags to prevent XSS stored in DB.
 * Plain text only: <script>alert(1)</script>hello → hello
 */
function stripTags(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}
const Notification = require("../models/Notification");

// Get all posts (feed)
exports.getPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user?.id || null;

    const [posts, totalResult] = await Promise.all([
      Post.getAll(limit, offset, userId),
      db.query("SELECT COUNT(*)::int AS total FROM posts"),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        limit,
        offset,
        total: totalResult.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    logger.error("Get posts error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải bài viết",
      error: error.message,
    });
  }
};

// Create new post
exports.createPost = async (req, res) => {
  try {
    console.log("Create post request:", {
      user: req.user,
      body: req.body,
      headers: req.headers.authorization ? "Token present" : "No token",
    });

    const { content, image_url } = req.body;
    const userId = req.user.id;
    const cleanContent = stripTags(content);

    if (!cleanContent || cleanContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bài viết không được để trống",
      });
    }

    const post = await Post.create(userId, cleanContent, image_url);
    const fullPost = await Post.getById(post.id, userId);

    logger.info("Post created", { postId: post.id, userId });

    res.status(201).json({
      success: true,
      message: "Tạo bài viết thành công",
      data: fullPost,
    });
  } catch (error) {
    logger.error("Create post error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo bài viết",
      error: error.message,
    });
  }
};

// Create official forum announcement (forum.post_as_admin)
exports.createAnnouncement = async (req, res) => {
  try {
    const { content, image_url } = req.body;
    const userId = req.user.id;
    const cleanContent = stripTags(content);

    if (!cleanContent || cleanContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nội dung thông báo không được để trống",
      });
    }

    const post = await Post.create(userId, cleanContent, image_url, {
      postType: "announcement",
      isOfficial: true,
    });
    const fullPost = await Post.getById(post.id, userId);

    logger.info("Announcement created", { postId: post.id, userId });

    return res.status(201).json({
      success: true,
      message: "Đăng thông báo thành công",
      data: fullPost,
    });
  } catch (error) {
    logger.error("Create announcement error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đăng thông báo",
      error: error.message,
    });
  }
};

// Moderation list for admin forum screen
exports.getModerationPosts = async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 20;
    const offset = Number.isInteger(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;
    const search = (req.query.search || "").trim();

    const params = [limit, offset];
    let whereClause = "";
    let totalWhereClause = "";
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE p.content ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length}`;
      totalWhereClause = "WHERE p.content ILIKE $1 OR u.full_name ILIKE $1 OR u.email ILIKE $1";
    }

    const dataQuery = `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.post_type,
        p.is_official,
        p.created_at,
        u.full_name AS author_name,
        u.email AS author_email,
        COUNT(DISTINCT pl.id)::int AS like_count,
        COUNT(DISTINCT pc.id)::int AS comment_count
      FROM posts p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id
      ${whereClause}
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM posts p
      INNER JOIN users u ON u.id = p.user_id
      ${totalWhereClause}
    `;

    const totalParams = search ? [params[2]] : [];

    const [dataResult, totalResult] = await Promise.all([
      db.query(dataQuery, params),
      db.query(totalQuery, totalParams),
    ]);

    return res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        limit,
        offset,
        total: totalResult.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    logger.error("Get moderation posts error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tải danh sách moderation",
      error: error.message,
    });
  }
};

// Delete post (owner or admin)
exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const isLegacyAdmin = req.user.role === "admin";
    let canModerateForum = isLegacyAdmin;
    if (!canModerateForum) {
      try {
        canModerateForum = await hasAnyPermission(userId, [
          "forum.manage",
          "system.manage",
        ]);
      } catch (authzError) {
        logger.warn("RBAC check failed, falling back to owner-only delete", {
          userId,
          error: authzError.message,
        });
      }
    }

    let deletedPost;
    if (canModerateForum) {
      // Moderator path: delete any post regardless of owner
      const result = await db.query(
        "DELETE FROM posts WHERE id = $1 RETURNING *",
        [postId],
      );
      deletedPost = result.rows[0];
    } else {
      deletedPost = await Post.delete(postId, userId);
    }

    if (!deletedPost) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết hoặc bạn không có quyền xóa",
      });
    }

    res.json({
      success: true,
      message: "Xóa bài viết thành công",
    });
  } catch (error) {
    logger.error("Delete post error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa bài viết",
      error: error.message,
    });
  }
};

// Update post
exports.updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { content, image_url } = req.body;
    const cleanContent = stripTags(content);

    if (!cleanContent || cleanContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bài viết không được để trống",
      });
    }

    const updatedPost = await Post.update(
      postId,
      userId,
      cleanContent,
      image_url,
    );
    const fullPost = updatedPost ? await Post.getById(postId, userId) : null;

    if (!updatedPost) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết hoặc bạn không có quyền sửa",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật bài viết thành công",
      data: fullPost,
    });
  } catch (error) {
    logger.error("Update post error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật bài viết",
      error: error.message,
    });
  }
};

// Like post
exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const likeCount = await Post.like(postId, userId);

    // Notify post owner (non-blocking)
    Post.getById(postId)
      .then((post) => {
        if (post && post.user_id !== userId) {
          Notification.create({
            recipientId: post.user_id,
            actorId: userId,
            type: "like_post",
            postId,
          });
        }
      })
      .catch(() => { });

    res.json({
      success: true,
      message: "Đã thích bài viết",
      data: { like_count: likeCount },
    });
  } catch (error) {
    logger.error("Like post error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi thích bài viết",
      error: error.message,
    });
  }
};

// Unlike post
exports.unlikePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    // unlike() now returns the updated like count directly (1 query instead of 2)
    const likeCount = await Post.unlike(postId, userId);

    res.json({
      success: true,
      message: "Đã bỏ thích bài viết",
      data: { like_count: likeCount },
    });
  } catch (error) {
    logger.error("Unlike post error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi bỏ thích bài viết",
      error: error.message,
    });
  }
};

// Get comments
exports.getComments = async (req, res) => {
  try {
    const postId = req.params.id;
    const comments = await Post.getComments(postId);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    logger.error("Get comments error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải bình luận",
      error: error.message,
    });
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    const cleanContent = stripTags(content);
    if (!cleanContent || cleanContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bình luận không được để trống",
      });
    }

    const comment = await Post.addComment(postId, userId, cleanContent);
    const commentCount = await Post.getCommentCount(postId);

    // Notify post owner (non-blocking)
    Post.getById(postId)
      .then((post) => {
        if (post && post.user_id !== userId) {
          Notification.create({
            recipientId: post.user_id,
            actorId: userId,
            type: "comment_post",
            postId,
            commentId: comment.id,
          });
        }
      })
      .catch(() => { });

    res.status(201).json({
      success: true,
      message: "Thêm bình luận thành công",
      data: {
        comment,
        comment_count: commentCount,
      },
    });
  } catch (error) {
    logger.error("Add comment error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm bình luận",
      error: error.message,
    });
  }
};
