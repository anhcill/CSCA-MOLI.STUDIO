const pool = require('../config/database');

class Post {
  // Get all posts for feed with user info, like count, comment count
  static async getAll(limit = 20, offset = 0, currentUserId = null) {
    const query = `
      SELECT 
        p.*,
        u.full_name as author_name,
        u.avatar as author_avatar,
        u.email as author_email,
        COUNT(DISTINCT pl.id) as like_count,
        COUNT(DISTINCT pc.id) as comment_count,
        ${currentUserId ? `EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3) as is_liked` : 'false as is_liked'}
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      LEFT JOIN post_comments pc ON p.id = pc.post_id
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const params = currentUserId ? [limit, offset, currentUserId] : [limit, offset];
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Create new post
  static async create(userId, content, imageUrl = null, options = {}) {
    const postType = options.postType || 'community';
    const isOfficial = options.isOfficial === true;
    const query = `
      INSERT INTO posts (user_id, content, image_url, post_type, is_official)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [userId, content, imageUrl, postType, isOfficial]);
    return result.rows[0];
  }

  // Get post by ID
  static async getById(postId, currentUserId = null) {
    const query = `
      SELECT 
        p.*,
        u.full_name as author_name,
        u.avatar as author_avatar,
        u.email as author_email,
        COUNT(DISTINCT pl.id) as like_count,
        COUNT(DISTINCT pc.id) as comment_count,
        ${currentUserId ? `EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2) as is_liked` : 'false as is_liked'}
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      LEFT JOIN post_comments pc ON p.id = pc.post_id
      WHERE p.id = $1
      GROUP BY p.id, u.id
    `;
    const params = currentUserId ? [postId, currentUserId] : [postId];
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Delete post (owner only)
  static async delete(postId, userId) {
    const query = 'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING *';
    const result = await pool.query(query, [postId, userId]);
    return result.rows[0];
  }

  // Update post (owner only)
  static async update(postId, userId, content, imageUrl = null) {
    const query = `
      UPDATE posts 
      SET content = $1, image_url = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [content, imageUrl, postId, userId]);
    return result.rows[0];
  }

  // Like post — returns like count in same query (no extra round-trip)
  static async like(postId, userId) {
    try {
      const query = `
                WITH inserted AS (
                    INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)
                    ON CONFLICT (post_id, user_id) DO NOTHING
                )
                SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = $1
            `;
      const result = await pool.query(query, [postId, userId]);
      return parseInt(result.rows[0].like_count);
    } catch (error) {
      throw error;
    }
  }

  // Unlike post — returns like count in same query (no extra round-trip)
  static async unlike(postId, userId) {
    const query = `
            WITH deleted AS (
                DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2
            )
            SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = $1
        `;
    const result = await pool.query(query, [postId, userId]);
    return parseInt(result.rows[0].like_count);
  }

  // Get like count (kept for backward compatibility)
  static async getLikeCount(postId) {
    const query = 'SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1';
    const result = await pool.query(query, [postId]);
    return parseInt(result.rows[0].count);
  }

  // Get comments for post
  static async getComments(postId) {
    const query = `
      SELECT 
        pc.*,
        u.full_name as author_name,
        u.avatar as author_avatar
      FROM post_comments pc
      INNER JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = $1
      ORDER BY pc.created_at ASC
    `;
    const result = await pool.query(query, [postId]);
    return result.rows;
  }

  // Add comment
  static async addComment(postId, userId, content) {
    const query = `
      INSERT INTO post_comments (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [postId, userId, content]);
    return result.rows[0];
  }

  // Get comment count
  static async getCommentCount(postId) {
    const query = 'SELECT COUNT(*) as count FROM post_comments WHERE post_id = $1';
    const result = await pool.query(query, [postId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Post;
