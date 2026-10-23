"use strict";

const db = require("../config/database");
const DeviceSessionService = require("../services/deviceSessionService");
const { hasPaidEntitlementHistory } = require("../services/paidEntitlementService");

const userIdOf = (req) => Number.parseInt(req.params.userId, 10);

async function listDevices(req, res) {
  const userId = userIdOf(req);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ success: false, message: "User không hợp lệ." });
  try {
    const [userResult, paid] = await Promise.all([
      db.query(`SELECT id, email, full_name, role, is_active, is_banned, ban_reason,
                       COALESCE(device_limit_attempts, 0) AS device_limit_attempts,
                       device_limit_locked_at
                FROM users WHERE id = $1`, [userId]),
      hasPaidEntitlementHistory(userId),
    ]);
    if (!userResult.rows[0]) return res.status(404).json({ success: false, message: "User không tồn tại." });

    // Existing paid sessions become visible as remembered devices immediately,
    // without waiting for the user to sign in again after this feature shipped.
    if (paid) await DeviceSessionService.hydrateRememberedDevices(userId);

    const [devices, sessions] = await Promise.all([
      DeviceSessionService.getRememberedDevices(userId, { includeRevoked: true }),
      DeviceSessionService.getActiveSessions(userId),
    ]);
    return res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        policy: { paid, maxDevices: paid ? 2 : null },
        rememberedDevices: devices.map(({ device_key, user_agent, ...device }) => ({
          ...device,
          deviceKey: device_key,
          browser: String(user_agent || '').slice(0, 180),
        })),
        activeSessions: sessions.map(({ jti, ...session }) => session),
      },
    });
  } catch (error) {
    console.error("Admin list devices error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách thiết bị." });
  }
}

async function revokeDevice(req, res) {
  const userId = userIdOf(req);
  const deviceId = Number.parseInt(req.params.deviceId, 10);
  if (!Number.isInteger(userId) || !Number.isInteger(deviceId)) return res.status(400).json({ success: false, message: "Thiết bị không hợp lệ." });
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE user_remembered_devices
       SET revoked_at = NOW(), revoked_by = $3
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id, device_key`,
      [deviceId, userId, req.user.id],
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị đang được ghi nhớ." });
    }
    const sessions = await client.query(
      `DELETE FROM user_sessions
       WHERE user_id = $1 AND device_key = $2
       RETURNING jti, user_id, expires_at`,
      [userId, result.rows[0].device_key],
    );
    for (const session of sessions.rows) {
      await client.query(
        `INSERT INTO token_blacklist (token_jti, user_id, expires_at)
         VALUES ($1, $2, COALESCE($3, NOW() + INTERVAL '1 day'))
         ON CONFLICT (token_jti) DO NOTHING`,
        [session.jti, session.user_id, session.expires_at],
      );
    }
    await client.query("COMMIT");
    return res.json({ success: true, message: "Đã xóa thiết bị ghi nhớ và thu hồi phiên của thiết bị." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Admin revoke device error:", error);
    return res.status(500).json({ success: false, message: "Không thể xóa thiết bị." });
  } finally {
    client.release();
  }
}

async function resetDevicesAndUnlock(req, res) {
  const userId = userIdOf(req);
  if (!Number.isInteger(userId)) return res.status(400).json({ success: false, message: "User không hợp lệ." });
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const sessions = await client.query(
      `DELETE FROM user_sessions WHERE user_id = $1 RETURNING jti, user_id, expires_at`, [userId],
    );
    for (const session of sessions.rows) {
      await client.query(
        `INSERT INTO token_blacklist (token_jti, user_id, expires_at)
         VALUES ($1, $2, COALESCE($3, NOW() + INTERVAL '1 day'))
         ON CONFLICT (token_jti) DO NOTHING`,
        [session.jti, session.user_id, session.expires_at],
      );
    }
    await client.query(`UPDATE user_remembered_devices SET revoked_at = NOW(), revoked_by = $2 WHERE user_id = $1 AND revoked_at IS NULL`, [userId, req.user.id]);
    await DeviceSessionService.clearDeviceLimitLock(userId, client);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Đã xóa toàn bộ thiết bị ghi nhớ và mở khóa giới hạn thiết bị." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Admin reset devices error:", error);
    return res.status(500).json({ success: false, message: "Không thể reset thiết bị." });
  } finally {
    client.release();
  }
}

module.exports = { listDevices, revokeDevice, resetDevicesAndUnlock };
