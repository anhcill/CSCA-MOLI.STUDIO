const pool = require('../config/database');

// Lazy-load to avoid circular dependency at startup
let _realtime = null;
function getRealtime() {
  if (!_realtime) {
    try { _realtime = require('../socket/riskCenterRealtime').RiskCenterRealtime; } catch { _realtime = null; }
  }
  return _realtime;
}

/**
 * Admin Audit Log Helper
 * Standardized audit logging for all strong actions in Risk Center
 */

const AuditLog = {
  /**
   * Log an admin action with before/after data
   * @param {object} opts
   * @param {number} opts.adminId - Admin performing action
   * @param {string} opts.action - Action code (e.g. 'lock_attempt', 'invalidate_attempt')
   * @param {string} opts.entityType - Entity type (e.g. 'exam_attempt', 'user', 'transaction')
   * @param {number} opts.entityId - Entity ID
   * @param {object} [opts.beforeData] - State before action
   * @param {object} [opts.afterData] - State after action
   * @param {string} [opts.reason] - Admin-provided reason
   * @param {string} [opts.ipAddress] - Request IP
   * @param {string} [opts.userAgent] - Request User-Agent
   */
  async log({
    adminId,
    action,
    entityType,
    entityId,
    beforeData = null,
    afterData = null,
    reason = null,
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      await pool.query(
        `INSERT INTO admin_audit_logs
           (admin_id, action, entity_type, entity_id, before_data, after_data, reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)`,
        [
          adminId,
          action,
          entityType,
          entityId,
          beforeData ? JSON.stringify(beforeData) : null,
          afterData ? JSON.stringify(afterData) : null,
          reason,
          ipAddress,
          userAgent,
        ]
      );
      // Push realtime audit event
      const rt = getRealtime();
      if (rt) rt.emitAuditEvent({ action, entityType, entityId, adminId });
    } catch (error) {
      console.error('[AuditLog] Failed to log:', action, error.message);
    }
  },

  /**
   * Create admin notification
   */
  async notify({
    type,
    severity = 'low',
    title,
    message = null,
    entityType = null,
    entityId = null,
    userId = null,
    metadata = {},
  }) {
    try {
      const result = await pool.query(
        `INSERT INTO admin_notifications
           (type, severity, title, message, entity_type, entity_id, user_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING *`,
        [type, severity, title, message, entityType, entityId, userId, JSON.stringify(metadata)]
      );
      // Push realtime notification
      const rt = getRealtime();
      if (rt && result.rows[0]) {
        rt.emitNotification(result.rows[0]);
      }
      return result.rows[0]?.id;
    } catch (error) {
      console.error('[AuditLog] Failed to notify:', title, error.message);
      return null;
    }
  },

  /**
   * Helper: extract request metadata
   */
  reqMeta(req) {
    return {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
    };
  },
};

module.exports = AuditLog;
