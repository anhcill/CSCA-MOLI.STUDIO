const db = require("../config/database");

class DeviceLimitError extends Error {
  constructor({ deviceType, maxDevices, sessions }) {
    const label = deviceType === "mobile" ? "điện thoại" : "máy tính";
    super(`Bạn đã dùng hết ${maxDevices} slot ${label}. Vui lòng đăng xuất một ${label} cũ trước khi đăng nhập thiết bị mới.`);
    this.name = "DeviceLimitError";
    this.code = "DEVICE_LIMIT_REACHED";
    this.statusCode = 409;
    this.deviceType = deviceType;
    this.maxDevices = maxDevices;
    this.sessions = sessions;
  }
}

class DeviceSessionService {
  static createChallengeToken() {
    return require("crypto").randomBytes(32).toString("hex");
  }

  static getDeviceTypeFromUserAgent(userAgent = "") {
    const ua = String(userAgent || "").toLowerCase();
    if (/ipad|tablet|mobile|iphone|ipod/.test(ua)) return "mobile";
    if (/android/.test(ua) && !/windows/.test(ua)) return "mobile";
    return "desktop";
  }

  static getDeviceLabel(deviceType) {
    return deviceType === "mobile" ? "Điện thoại" : "Máy tính";
  }

  static async hasActivePackage(userId) {
    const { rows } = await db.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM user_vip_entitlements e
           WHERE e.user_id = u.id
             AND e.is_active = TRUE
             AND (e.expires_at IS NULL OR e.expires_at > NOW())
         ) AS has_entitlement,
         COALESCE(u.is_vip, FALSE)
           AND (u.vip_expires_at IS NULL OR u.vip_expires_at > NOW()) AS has_legacy_vip
       FROM users u
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) return false;
    return rows[0].has_entitlement === true || rows[0].has_legacy_vip === true;
  }

  static async getDeviceLimits(userId) {
    const hasActivePackage = await this.hasActivePackage(userId);
    return {
      mobile: hasActivePackage ? 3 : 2,
      desktop: 2,
      hasActivePackage,
    };
  }

  static async getUserMaxDevices(userId, deviceType = "desktop") {
    const limits = await this.getDeviceLimits(userId);
    return limits[deviceType] || limits.desktop;
  }

  static async getActiveSessionCount(userId, deviceType = null) {
    const params = [userId];
    const deviceFilter = deviceType ? "AND COALESCE(device_type, 'desktop') = $2" : "";
    if (deviceType) params.push(deviceType);

    const { rows } = await db.query(
      `SELECT COUNT(*) AS count
       FROM user_sessions
       WHERE user_id = $1
         AND expires_at > NOW()
         ${deviceFilter}`,
      params,
    );
    return parseInt(rows[0].count, 10);
  }

  static async getActiveSessions(userId) {
    const { rows } = await db.query(
      `SELECT id, jti, device_info, device_type, ip_address, last_active, expires_at, created_at
       FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_active DESC`,
      [userId],
    );
    return rows.map((session) => ({
      ...session,
      device_type: session.device_type || "desktop",
    }));
  }

  static async checkLoginAllowed(userId, deviceType = "desktop") {
    const maxDevices = await this.getUserMaxDevices(userId, deviceType);
    const sessions = (await this.getActiveSessions(userId))
      .filter((session) => (session.device_type || "desktop") === deviceType);

    if (sessions.length >= maxDevices) {
      return {
        allowed: false,
        reason: new DeviceLimitError({ deviceType, maxDevices, sessions }).message,
        sessions,
        maxDevices,
        deviceType,
      };
    }

    return { allowed: true, maxDevices, deviceType };
  }

  static async hasMatchingDeviceSession({ userId, deviceType, deviceInfo, ipAddress, userAgent }) {
    const resolvedDeviceType = deviceType || this.getDeviceTypeFromUserAgent(userAgent || deviceInfo);
    const params = [userId, resolvedDeviceType];
    let matchClause = "";

    if (userAgent && ipAddress) {
      params.push(userAgent, ipAddress);
      matchClause = "AND user_agent = $3 AND ip_address = $4";
    } else if (userAgent) {
      params.push(userAgent);
      matchClause = "AND user_agent = $3";
    } else if (deviceInfo) {
      params.push(deviceInfo);
      matchClause = "AND device_info = $3";
    } else {
      return false;
    }

    const { rows } = await db.query(
      `SELECT 1
       FROM user_sessions
       WHERE user_id = $1
         AND COALESCE(device_type, 'desktop') = $2
         AND expires_at > NOW()
         ${matchClause}
       LIMIT 1`,
      params,
    );

    return rows.length > 0;
  }

  static async registerSession({ userId, jti, deviceInfo, deviceType, ipAddress, userAgent, expiresAt }) {
    const resolvedDeviceType = deviceType || this.getDeviceTypeFromUserAgent(userAgent || deviceInfo);

    const existing = await db.query(
      `SELECT id
       FROM user_sessions
       WHERE jti = $1 AND user_id = $2 AND expires_at > NOW()`,
      [jti, userId],
    );

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE user_sessions
         SET last_active = NOW(),
             ip_address = COALESCE($1, ip_address),
             device_type = COALESCE($2, device_type)
         WHERE jti = $3`,
        [ipAddress, resolvedDeviceType, jti],
      );
      return { deviceType: resolvedDeviceType };
    }

    await this.removeMatchingDeviceSessions({
      userId,
      deviceType: resolvedDeviceType,
      deviceInfo,
      ipAddress,
      userAgent,
    });

    const allowed = await this.checkLoginAllowed(userId, resolvedDeviceType);
    if (!allowed.allowed) {
      throw new DeviceLimitError(allowed);
    }

    await db.query(
      `INSERT INTO user_sessions (user_id, jti, device_info, device_type, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (jti) DO UPDATE
       SET last_active = NOW(),
           device_info = COALESCE($3, user_sessions.device_info),
           device_type = COALESCE($4, user_sessions.device_type),
           ip_address = COALESCE($5, user_sessions.ip_address),
           user_agent = COALESCE($6, user_sessions.user_agent),
           expires_at = COALESCE($7, user_sessions.expires_at)`,
      [userId, jti, deviceInfo, resolvedDeviceType, ipAddress, userAgent, expiresAt],
    );

    return { deviceType: resolvedDeviceType };
  }

  static async createLoginRequest({ userId, deviceType, deviceInfo, ipAddress, userAgent }) {
    const challengeToken = this.createChallengeToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO device_login_requests (
         user_id, challenge_token, device_type, new_device_info, new_ip_address, new_user_agent, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, challengeToken, deviceType, deviceInfo, ipAddress, userAgent, expiresAt],
    );
    return { challengeToken, expiresAt };
  }

  static async getLoginRequest(challengeToken) {
    const { rows } = await db.query(
      `SELECT *
       FROM device_login_requests
       WHERE challenge_token = $1
       LIMIT 1`,
      [challengeToken],
    );
    return rows[0] || null;
  }

  static async markLoginRequestApproved(challengeToken, approverJti) {
    const { rows } = await db.query(
      `UPDATE device_login_requests
       SET status = 'approved', approved_by_jti = $2, approved_at = NOW()
       WHERE challenge_token = $1
         AND status = 'pending'
         AND expires_at > NOW()
       RETURNING *`,
      [challengeToken, approverJti],
    );
    return rows[0] || null;
  }

  static async markLoginRequestCompleted(challengeToken) {
    await db.query(
      `UPDATE device_login_requests
       SET status = 'completed', completed_at = NOW()
       WHERE challenge_token = $1`,
      [challengeToken],
    );
  }

  static async expireLoginRequest(challengeToken) {
    await db.query(
      `UPDATE device_login_requests
       SET status = 'expired'
       WHERE challenge_token = $1 AND status = 'pending'`,
      [challengeToken],
    );
  }

  static async removeOldestSessionForType(userId, deviceType) {
    const { rows } = await db.query(
      `SELECT jti
       FROM user_sessions
       WHERE user_id = $1
         AND COALESCE(device_type, 'desktop') = $2
         AND expires_at > NOW()
       ORDER BY last_active ASC
       LIMIT 1`,
      [userId, deviceType],
    );
    if (!rows[0]?.jti) return false;
    return this.removeSession(rows[0].jti, userId);
  }

  static async touchSession(jti, userId = null) {
    const params = [jti];
    const userFilter = userId ? "AND user_id = $2" : "";
    if (userId) params.push(userId);

    const { rowCount } = await db.query(
      `UPDATE user_sessions
       SET last_active = NOW()
       WHERE jti = $1
         ${userFilter}
         AND expires_at > NOW()`,
      params,
    );
    return rowCount > 0;
  }

  static async assertActiveSession(jti, userId) {
    if (!jti) return false;
    const { rows } = await db.query(
      `SELECT 1
       FROM user_sessions
       WHERE jti = $1
         AND user_id = $2
         AND expires_at > NOW()
       LIMIT 1`,
      [jti, userId],
    );
    return rows.length > 0;
  }

  static async removeSession(jti, userId = null) {
    const params = [jti];
    const userFilter = userId ? "AND user_id = $2" : "";
    if (userId) params.push(userId);

    const { rows } = await db.query(
      `DELETE FROM user_sessions
       WHERE jti = $1 ${userFilter}
       RETURNING jti, user_id, expires_at`,
      params,
    );

    if (rows.length === 0) return false;

    const session = rows[0];
    await db.query(
      `INSERT INTO token_blacklist (token_jti, user_id, expires_at)
       VALUES ($1, $2, COALESCE($3, NOW() + INTERVAL '1 day'))
       ON CONFLICT (token_jti) DO NOTHING`,
      [session.jti, session.user_id, session.expires_at],
    ).catch(() => {});

    return true;
  }

  static async blacklistSessions(sessions) {
    if (!sessions.length) return;

    const values = sessions
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(", ");
    const flat = sessions.flatMap((session) => [session.jti, session.user_id, session.expires_at]);

    await db.query(
      `INSERT INTO token_blacklist (token_jti, user_id, expires_at)
       VALUES ${values}
       ON CONFLICT (token_jti) DO NOTHING`,
      flat,
    ).catch(() => {});
  }

  static async removeMatchingDeviceSessions({ userId, deviceType, deviceInfo, ipAddress, userAgent }) {
    const resolvedDeviceType = deviceType || this.getDeviceTypeFromUserAgent(userAgent || deviceInfo);
    const params = [userId, resolvedDeviceType];
    let matchClause = "";

    if (userAgent && ipAddress) {
      params.push(userAgent, ipAddress);
      matchClause = "AND user_agent = $3 AND ip_address = $4";
    } else if (userAgent) {
      params.push(userAgent);
      matchClause = "AND user_agent = $3";
    } else if (deviceInfo) {
      params.push(deviceInfo);
      matchClause = "AND device_info = $3";
    } else {
      return 0;
    }

    const { rows } = await db.query(
      `DELETE FROM user_sessions
       WHERE user_id = $1
         AND COALESCE(device_type, 'desktop') = $2
         AND expires_at > NOW()
         ${matchClause}
       RETURNING jti, user_id, expires_at`,
      params,
    );

    await this.blacklistSessions(rows);
    return rows.length;
  }

  static async removeAllUserSessions(userId, options = {}) {
    const exceptJti = options.exceptJti || null;
    const params = exceptJti ? [userId, exceptJti] : [userId];
    const exceptFilter = exceptJti ? "AND jti <> $2" : "";

    const sessions = await db.query(
      `DELETE FROM user_sessions
       WHERE user_id = $1 ${exceptFilter}
       RETURNING jti, user_id, expires_at`,
      params,
    );

    if (sessions.rows.length > 0) {
      await this.blacklistSessions(sessions.rows);
    }

    return sessions.rows.length;
  }

  static async removeAllSessions() {
    const sessions = await db.query(
      `DELETE FROM user_sessions
       WHERE expires_at > NOW()
       RETURNING jti, user_id, expires_at`,
    );

    if (sessions.rows.length > 0) {
      await this.blacklistSessions(sessions.rows);
    }

    return sessions.rows.length;
  }

  static async cleanupExpired() {
    await db.query(`DELETE FROM user_sessions WHERE expires_at < NOW()`);
  }
}

DeviceSessionService.DeviceLimitError = DeviceLimitError;

module.exports = DeviceSessionService;
