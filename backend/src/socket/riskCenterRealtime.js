const { getIO } = require('../socket/singleton');

/**
 * Risk Center  Phase E: Realtime Admin Notifications
 * Emits events to admin room for live notification updates
 */

const ADMIN_ROOM = 'admin:risk-center';

const RiskCenterRealtime = {
  /**
   * Emit a new admin notification to all connected admins
   * Call this after inserting into admin_notifications
   */
  emitNotification(notification) {
    try {
      const io = getIO();
      if (!io) return;
      io.to(ADMIN_ROOM).emit('admin_notification', notification);
    } catch {
      // Socket not available  silent fail
    }
  },

  /**
   * Emit unread count update
   */
  emitUnreadCount(count) {
    try {
      const io = getIO();
      if (!io) return;
      io.to(ADMIN_ROOM).emit('admin_unread_count', { count });
    } catch {}
  },

  /**
   * Emit risk case update (new case, status change)
   */
  emitRiskCaseUpdate(data) {
    try {
      const io = getIO();
      if (!io) return;
      io.to(ADMIN_ROOM).emit('risk_case_update', data);
    } catch {}
  },

  /**
   * Emit audit log event
   */
  emitAuditEvent(data) {
    try {
      const io = getIO();
      if (!io) return;
      io.to(ADMIN_ROOM).emit('admin_audit_event', data);
    } catch {}
  },
};

module.exports = { RiskCenterRealtime, ADMIN_ROOM };
