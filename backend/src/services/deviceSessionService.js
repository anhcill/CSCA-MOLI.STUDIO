const db = require("../config/database");

/**
 * DeviceSessionService
 * Manages user sessions for device limit enforcement.
 * VIP: max 2 devices | Premium: max 3 devices | Basic: 1 device
 */
class DeviceSessionService {
  /**
   * Get device limit based on subscription tier
   */
  static getDeviceLimit(tier) {
    switch (tier) {
      case 'premium': return 3;
      case 'vip': return 2;
      default: return 1;
    }
  }

  /**
   * Get current active session count for a user
   */
  static async getActiveSessionCount(userId) {
    const { rows } = await db.query(
      `SELECT COUNT(*) as count FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );
    return parseInt(rows[0].count);
  }

  /**
   * Get all active sessions for a user
   */
  static async getActiveSessions(userId) {
    const { rows } = await db.query(
      `SELECT id, jti, device_info, ip_address, last_active, expires_at, created_at
       FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_active DESC`,
      [userId]
    );
    return rows;
  }

  /**
   * Register a new session (called on login)
   */
  static async registerSession({ userId, jti, deviceInfo, ipAddress, userAgent, expiresAt }) {
    const maxDevices = await this.getUserMaxDevices(userId);
    const currentCount = await this.getActiveSessionCount(userId);

    // If at limit, remove the oldest session
    if (currentCount >= maxDevices) {
      const oldest = await db.query(
        `SELECT id FROM user_sessions
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY last_active ASC LIMIT 1`,
        [userId]
      );
      if (oldest.rows.length > 0) {
        await db.query(
          `DELETE FROM user_sessions WHERE id = $1`,
          [oldest.rows[0].id]
        );
      }
    }

    await db.query(
      `INSERT INTO user_sessions (user_id, jti, device_info, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (jti) DO UPDATE
       SET last_active = NOW(), device_info = COALESCE($3, user_sessions.device_info),
           ip_address = COALESCE($4, user_sessions.ip_address)`,
      [userId, jti, deviceInfo, ipAddress, userAgent, expiresAt]
    );
  }

  /**
   * Refresh session activity (called on each authenticated request)
   */
  static async touchSession(jti) {
    await db.query(
      `UPDATE user_sessions SET last_active = NOW() WHERE jti = $1`,
      [jti]
    );
  }

  /**
   * Remove a session (logout)
   */
  static async removeSession(jti) {
    await db.query(`DELETE FROM user_sessions WHERE jti = $1`, [jti]);
  }

  /**
   * Remove all sessions for a user (logout everywhere)
   */
  static async removeAllUserSessions(userId) {
    await db.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
  }

  /**
   * Clean up expired sessions (called periodically)
   */
  static async cleanupExpired() {
    await db.query(`DELETE FROM user_sessions WHERE expires_at < NOW()`);
  }

  /**
   * Get user's max devices from subscription tier
   */
  static async getUserMaxDevices(userId) {
    const { rows } = await db.query(
      `SELECT subscription_tier, is_vip, vip_expires_at, max_devices FROM users WHERE id = $1`,
      [userId]
    );
    if (rows.length === 0) return 1;

    const user = rows[0];

    // If user has a custom max_devices setting, use it
    if (user.max_devices && user.max_devices > 0) return user.max_devices;

    // Check subscription tier
    if (user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date())) {
      return this.getDeviceLimit(user.subscription_tier || 'vip');
    }

    return 1;
  }

  /**
   * Check if login is allowed (not over device limit)
   * Returns { allowed: true } or { allowed: false, reason: string, sessions: [...] }
   */
  static async checkLoginAllowed(userId) {
    const maxDevices = await this.getUserMaxDevices(userId);
    const sessions = await this.getActiveSessions(userId);
    const currentCount = sessions.length;

    if (currentCount >= maxDevices) {
      return {
        allowed: false,
        reason: `Tài khoản đã đăng nhập trên ${maxDevices} thiết bị. Vui lòng đăng xuất một thiết bị khác trước khi đăng nhập mới.`,
        sessions,
        maxDevices,
      };
    }

    return { allowed: true, maxDevices };
  }
}

module.exports = DeviceSessionService;
