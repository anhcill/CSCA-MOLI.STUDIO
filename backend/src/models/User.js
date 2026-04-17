const db = require("../config/database");
const bcrypt = require("bcrypt");

/**
 * User Model
 * Handles all database operations related to users
 */

class User {
  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Object|null} User object or null
   */
  static async findById(id) {
    try {
      const result = await db.query(
        "SELECT id, username, email, full_name, full_name as display_name, avatar, role, bio, phone, study_goal, target_score, is_verified, is_active, is_vip, vip_expires_at, created_at, updated_at FROM users WHERE id = $1",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} User object or null
   */
  static async findByEmail(email) {
    try {
      // Include password for auth comparison — callers must NOT forward this to clients
      const result = await db.query(
        `SELECT id, username, email, password, full_name, avatar, role, bio,
                is_active, is_verified, google_id, oauth_provider, is_vip, vip_expires_at
         FROM users WHERE email = $1`,
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Object|null} User object or null
   */
  static async findByUsername(username) {
    try {
      const result = await db.query(
        `SELECT id, username, email, full_name, avatar, role, bio, is_active, is_vip, vip_expires_at
         FROM users WHERE username = $1`,
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by Google ID
   * @param {string} googleId - Google ID
   * @returns {Object|null} User object or null
   */
  static async findByGoogleId(googleId) {
    try {
      const result = await db.query(
        `SELECT id, username, email, full_name, avatar, avatar_url, role, is_active, google_id, is_vip, vip_expires_at
         FROM users WHERE google_id = $1`,
        [googleId]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create user from Google OAuth
   * @param {Object} googleData - Google profile data
   * @returns {Object} Created user
   */
  static async createFromGoogle(googleData) {
    const { googleId, email, name, picture } = googleData;

    try {
      // Generate username from email (before @)
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;

      // Check if username exists, add number suffix if needed
      let counter = 1;
      while (true) {
        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length === 0) break;
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const result = await db.query(
        `INSERT INTO users (username, email, full_name, avatar_url, google_id, oauth_provider, email_verified, avatar, is_active)
         VALUES ($1, $2, $3, $4, $5, 'google', true, $6, true)
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, vip_expires_at, created_at`,
        [
          username,
          email,
          name,
          picture,
          googleId,
          picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`,
        ]
      );

      // Create user stats entry
      await db.query("INSERT INTO user_stats (user_id) VALUES ($1)", [
        result.rows[0].id,
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        // Unique violation
        if (error.constraint === "users_email_key") {
          throw new Error("Email already exists");
        }
      }
      throw error;
    }
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Object} Created user
   */
  static async create(userData) {
    const { username, email, password, full_name, role = "student" } = userData;

    try {
      // Hash password with stronger rounds
      const hashedPassword = await bcrypt.hash(password, 12);

      const result = await db.query(
        `INSERT INTO users (username, email, password, full_name, role, avatar)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, email, full_name, avatar, role, is_active, is_vip, vip_expires_at, created_at`,
        [
          username,
          email,
          hashedPassword,
          full_name || username,
          role,
          `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4F46E5&color=fff`,
        ]
      );

      // Create user stats entry
      await db.query("INSERT INTO user_stats (user_id) VALUES ($1)", [
        result.rows[0].id,
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        if (error.constraint === "users_email_key") throw new Error("Email already exists");
        if (error.constraint === "users_username_key") throw new Error("Username already exists");
      }
      throw error;
    }
  }

  /**
   * Link Google account to existing user
   * @param {number} userId - User ID
   * @param {string} googleId - Google ID
   * @param {string} avatarUrl - Google avatar URL
   * @returns {Object} Updated user
   */
  static async linkGoogleAccount(userId, googleId, avatarUrl) {
    try {
      const result = await db.query(
        `UPDATE users
         SET google_id = $1, oauth_provider = 'google', email_verified = true,
             avatar_url = COALESCE(avatar_url, $2), updated_at = NOW()
         WHERE id = $3
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, vip_expires_at, created_at`,
        [googleId, avatarUrl, userId]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user by ID
   * @param {number} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated user
   */
  static async update(id, updates) {
    try {
      const allowedFields = [
        "full_name",
        "avatar",
        "bio",
        "phone",
        "study_goal",
        "target_score",
      ];

      // Map display_name to full_name
      if (updates.display_name) {
        updates.full_name = updates.display_name;
        delete updates.display_name;
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error("No valid fields to update");
      }

      values.push(id);
      const query = `
        UPDATE users 
        SET ${fields.join(", ")}
        WHERE id = $${paramCount}
        RETURNING id, username, email, full_name, full_name as display_name, avatar, role, bio, phone, study_goal, target_score, is_vip, vip_expires_at, created_at, updated_at
      `;

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update password
   * @param {number} id - User ID
   * @param {string} newPassword - New password
   * @returns {boolean} Success
   */
  static async updatePassword(id, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12); // consistent with create()
      await db.query("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", [
        hashedPassword,
        id,
      ]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update VIP Status
   * @param {number} id - User ID
   * @param {number} durationDays - Number of days to add to VIP expiration
   * @returns {Object} Updated user
   */
  static async updateVipStatus(id, durationDays) {
    try {
      const result = await db.query(
        `UPDATE users 
         SET is_vip = true, 
             vip_expires_at = COALESCE(
                 CASE WHEN vip_expires_at > NOW() THEN vip_expires_at ELSE NOW() END, 
                 NOW()
             ) + INTERVAL '1 day' * $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, is_vip, vip_expires_at`,
        [durationDays, id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Compare password
   * @param {string} candidatePassword - Password to check
   * @param {string} hashedPassword - Hashed password from DB
   * @returns {boolean} Match result
   */
  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  /**
   * Delete user by ID
   * @param {number} id - User ID
   * @returns {boolean} Success
   */
  static async delete(id) {
    try {
      await db.query("DELETE FROM users WHERE id = $1", [id]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all users with pagination
   * @param {number} limit - Limit
   * @param {number} offset - Offset
   * @returns {Array} Users array
   */
  static async findAll(limit = 10, offset = 0) {
    try {
      const result = await db.query(
        `SELECT id, username, email, full_name, avatar, role, bio, target_score, is_vip, vip_expires_at, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
