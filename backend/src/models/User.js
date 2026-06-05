const db = require("../config/database");
const bcrypt = require("bcrypt");
const { ALL_SUBJECTS, normalizeSubjectList } = require("../utils/vipEntitlements");

const normalizeSubscriptionTier = (tier) => {
  const value = String(tier || "").trim().toLowerCase();
  if (value === "premium" || value === "pre") return "premium";
  return "vip";
};

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
        `WITH active AS (
           SELECT
             e.user_id,
             BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre') OR '*' = ANY(e.allowed_subjects)) AS has_all,
             BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre')) AS has_premium,
             MAX(e.expires_at) AS max_expires_at,
             (ARRAY_AGG(e.package_id ORDER BY e.created_at DESC, e.id DESC))[1] AS latest_package_id,
             ARRAY_AGG(DISTINCT subject) FILTER (WHERE subject IS NOT NULL AND subject <> '*') AS subjects
           FROM user_vip_entitlements e
           LEFT JOIN LATERAL UNNEST(e.allowed_subjects) AS subject ON true
           WHERE e.user_id = $1
             AND e.is_active = true
             AND (e.expires_at IS NULL OR e.expires_at > NOW())
           GROUP BY e.user_id
         )
         SELECT
           u.id, u.username, u.email, u.full_name, u.full_name as display_name,
           u.avatar, u.avatar_url, u.role, u.bio, u.phone, u.study_goal, u.target_score,
           u.is_verified, u.is_active,
           CASE WHEN active.user_id IS NOT NULL THEN true ELSE u.is_vip END AS is_vip,
           CASE
             WHEN active.user_id IS NULL THEN COALESCE(u.subscription_tier, 'basic')
             WHEN active.has_premium THEN 'premium'
             ELSE 'vip'
           END AS subscription_tier,
           CASE WHEN active.user_id IS NOT NULL THEN active.max_expires_at ELSE u.vip_expires_at END AS vip_expires_at,
           CASE WHEN active.user_id IS NOT NULL THEN active.latest_package_id ELSE u.vip_package_id END AS vip_package_id,
           CASE
             WHEN active.user_id IS NULL THEN COALESCE(u.vip_allowed_subjects, ARRAY[]::text[])
             WHEN active.has_all THEN ARRAY['*']::text[]
             ELSE COALESCE(active.subjects, ARRAY[]::text[])
           END AS vip_allowed_subjects,
           COALESCE(u.coins, 0)::int AS coins,
           COALESCE(u.current_streak, 0)::int AS current_streak,
           COALESCE(u.longest_streak, 0)::int AS longest_streak,
           COALESCE(u.exp, 0)::int AS exp,
           u.created_at, u.updated_at
         FROM users u
         LEFT JOIN active ON active.user_id = u.id
         WHERE u.id = $1`,
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
        `SELECT id, username, email, password, full_name, avatar, avatar_url, role, bio,
                is_active, is_verified, google_id, oauth_provider, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects
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
        `SELECT id, username, email, full_name, avatar, role, bio, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects
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
        `SELECT id, username, email, full_name, avatar, avatar_url, role, is_active, google_id, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects
         FROM users WHERE google_id = $1`,
        [googleId]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by Facebook ID
   * @param {string} facebookId - Facebook ID
   * @returns {Object|null} User object or null
   */
  static async findByFacebookId(facebookId) {
    try {
      const result = await db.query(
        `SELECT id, username, email, full_name, avatar, avatar_url, role, is_active, facebook_id, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects
         FROM users WHERE facebook_id = $1`,
        [facebookId]
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
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
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
   * Create user from Facebook OAuth
   * @param {Object} facebookData - Facebook profile data
   * @returns {Object} Created user
   */
  static async createFromFacebook(facebookData) {
    const { facebookId, email, name, picture } = facebookData;

    try {
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;

      let counter = 1;
      while (true) {
        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length === 0) break;
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const result = await db.query(
        `INSERT INTO users (username, email, full_name, avatar_url, facebook_id, oauth_provider, email_verified, avatar, is_active)
         VALUES ($1, $2, $3, $4, $5, 'facebook', true, $6, true)
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
        [
          username,
          email,
          name,
          picture,
          facebookId,
          picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877F2&color=fff`,
        ]
      );

      await db.query("INSERT INTO user_stats (user_id) VALUES ($1)", [
        result.rows[0].id,
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
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
         RETURNING id, username, email, full_name, avatar, role, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
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
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
        [googleId, avatarUrl, userId]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Link Facebook account to existing user
   * @param {number} userId - User ID
   * @param {string} facebookId - Facebook ID
   * @param {string} avatarUrl - Facebook avatar URL
   * @returns {Object} Updated user
   */
  static async linkFacebookAccount(userId, facebookId, avatarUrl) {
    try {
      const result = await db.query(
        `UPDATE users
         SET facebook_id = $1, oauth_provider = 'facebook', email_verified = true,
             avatar_url = COALESCE(avatar_url, $2), updated_at = NOW()
         WHERE id = $3
         RETURNING id, username, email, full_name, avatar, avatar_url, role, is_active, is_vip, subscription_tier, vip_expires_at, vip_package_id, vip_allowed_subjects, created_at`,
        [facebookId, avatarUrl, userId]
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
        RETURNING id, username, email, full_name, full_name as display_name, avatar, avatar_url, role, bio, phone, study_goal, target_score, is_vip, subscription_tier, vip_expires_at, created_at, updated_at
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
   * @param {number} durationDays - Number of days to add (0 = permanent/no expiry change, null = permanent VIP)
   * @param {string} tier - Subscription tier ('vip' or 'premium')
   * @returns {Object} Updated user
   */
  static async recalculateVipSummary(id, client = db) {
    const summary = await client.query(
      `WITH active AS (
         SELECT
           e.user_id,
           BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre') OR '*' = ANY(e.allowed_subjects)) AS has_all,
           BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre')) AS has_premium,
           MAX(e.expires_at) AS max_expires_at,
           (ARRAY_AGG(e.package_id ORDER BY e.created_at DESC, e.id DESC))[1] AS latest_package_id,
           ARRAY_AGG(DISTINCT subject) FILTER (WHERE subject IS NOT NULL AND subject <> '*') AS subjects
         FROM user_vip_entitlements e
         LEFT JOIN LATERAL UNNEST(e.allowed_subjects) AS subject ON true
         WHERE e.user_id = $1
           AND e.is_active = true
           AND (e.expires_at IS NULL OR e.expires_at > NOW())
         GROUP BY e.user_id
       )
       UPDATE users u
       SET is_vip = true,
           subscription_tier = CASE WHEN active.has_premium THEN 'premium' ELSE 'vip' END,
           vip_expires_at = active.max_expires_at,
           vip_package_id = active.latest_package_id,
           vip_allowed_subjects = CASE
             WHEN active.has_all THEN ARRAY['*']::text[]
             ELSE COALESCE(active.subjects, ARRAY[]::text[])
           END,
           updated_at = NOW()
       FROM active
       WHERE u.id = $1
       RETURNING u.id, u.is_vip, u.vip_expires_at, u.subscription_tier, u.vip_package_id, u.vip_allowed_subjects`,
      [id]
    );

    if (summary.rows[0]) return summary.rows[0];

    const cleared = await client.query(
      `UPDATE users
       SET is_vip = false,
           subscription_tier = 'basic',
           vip_expires_at = NULL,
           vip_package_id = NULL,
           vip_allowed_subjects = ARRAY[]::text[],
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_vip, vip_expires_at, subscription_tier, vip_package_id, vip_allowed_subjects`,
      [id]
    );
    return cleared.rows[0] || null;
  }

  static async grantVipEntitlement(id, durationDays, tier = 'vip', options = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const normalizedTier = normalizeSubscriptionTier(tier);
      const safeSubjects = normalizedTier === 'premium'
        ? [ALL_SUBJECTS]
        : normalizeSubjectList(options.allowedSubjects || options.allowed_subjects);
      const allowedSubjects = safeSubjects.length > 0 ? safeSubjects : [ALL_SUBJECTS];

      let expiresAt = null;
      if (durationDays === null || durationDays < 0) {
        expiresAt = null;
      } else if (durationDays === 0) {
        const existing = await client.query(
          `SELECT vip_expires_at FROM users WHERE id = $1 FOR UPDATE`,
          [id]
        );
        expiresAt = existing.rows[0]?.vip_expires_at || null;
      } else {
        const safeDays = parseInt(durationDays, 10);
        if (!Number.isFinite(safeDays) || safeDays <= 0) {
          throw new Error('Invalid VIP duration');
        }
        expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
      }

      const entitlement = await client.query(
        `INSERT INTO user_vip_entitlements (
           user_id, package_id, transaction_id, tier, allowed_subjects, starts_at, expires_at, source
         )
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
         RETURNING id`,
        [
          id,
          options.packageId || options.package_id || null,
          options.transactionId || options.transaction_id || null,
          normalizedTier,
          allowedSubjects,
          expiresAt,
          options.source || 'payment',
        ]
      );

      const result = await User.recalculateVipSummary(id, client);
      await client.query('COMMIT');
      return { ...result, entitlement_id: entitlement.rows[0]?.id || null };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateVipStatus(id, durationDays, tier = 'vip') {
    try {
      const normalizedTier = normalizeSubscriptionTier(tier);
      // durationDays === null or < 0 → VIP vĩnh viễn (vip_expires_at = NULL, is_vip = TRUE)
      // durationDays === 0     → giữ nguyên vip_expires_at, chỉ update tier
      // durationDays > 0      → cộng dồn
      const params = [id, normalizedTier];
      let expiresAtExpr;
      if (durationDays === null || durationDays < 0) {
        expiresAtExpr = 'NULL';
      } else if (durationDays === 0) {
        expiresAtExpr = 'vip_expires_at';
      } else {
        const safeDays = parseInt(durationDays, 10);
        if (!Number.isFinite(safeDays) || safeDays <= 0) {
          throw new Error('Invalid VIP duration');
        }
        params.unshift(safeDays);
        expiresAtExpr = `GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + ($1::int * INTERVAL '1 day')`;
      }

      const idParamIndex = params.length === 3 ? 2 : 1;
      const tierParamIndex = params.length === 3 ? 3 : 2;
      const result = await db.query(
        `UPDATE users
         SET is_vip = TRUE,
             subscription_tier = $${tierParamIndex},
             vip_expires_at = ${expiresAtExpr},
             updated_at = NOW()
         WHERE id = $${idParamIndex}
         RETURNING id, is_vip, vip_expires_at, subscription_tier`,
        params
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
        `SELECT id, username, email, full_name, avatar, avatar_url, role, bio, target_score, is_vip, subscription_tier, vip_expires_at, created_at
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
