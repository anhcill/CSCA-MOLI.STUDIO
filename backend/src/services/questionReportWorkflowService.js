const { pool } = require('../config/database');
const AuditLog = require('../utils/auditLog');

async function resolve({ id, user, reason, req }) {
  const current = await pool.query(
    'SELECT question_id FROM question_reports WHERE id = $1',
    [id],
  );
  if (!current.rows[0]) return null;

  const safeReason = String(reason || 'Đã sửa').slice(0, 2000);
  const result = await pool.query(`
    UPDATE question_reports
    SET status = 'fixed', resolved_by = $1, resolved_at = NOW(),
        admin_note = COALESCE(admin_note || E'\\n', '') || $2,
        archived_at = NULL, archived_by = NULL, updated_at = NOW()
    WHERE question_id = $3 AND status IN ('open', 'reviewing', 'escalated')
    RETURNING *
  `, [user.id, `[FIXED] ${new Date().toISOString()} ${user.email}: ${safeReason}`, current.rows[0].question_id]);

  await AuditLog.log({
    adminId: user.id,
    action: 'resolve_question_report',
    entityType: 'question_report',
    entityId: Number(id),
    afterData: { status: 'fixed', resolvedCount: result.rowCount },
    reason: safeReason,
    ...AuditLog.reqMeta(req),
  });

  return { data: result.rows[0] || null, resolvedCount: result.rowCount };
}

async function ignore({ id, user, reason, req }) {
  const safeReason = String(reason || 'Bỏ qua').slice(0, 2000);
  const result = await pool.query(`
    UPDATE question_reports
    SET status = 'ignored', resolved_by = $2, resolved_at = NOW(),
        admin_note = COALESCE(admin_note || E'\\n', '') || $3,
        archived_at = NULL, archived_by = NULL, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, user.id, `[IGNORED] ${new Date().toISOString()} ${user.email}: ${safeReason}`]);
  if (!result.rows[0]) return null;

  await AuditLog.log({
    adminId: user.id,
    action: 'ignore_question_report',
    entityType: 'question_report',
    entityId: Number(id),
    afterData: { status: 'ignored' },
    reason: safeReason,
    ...AuditLog.reqMeta(req),
  });

  return { data: result.rows[0] };
}

module.exports = { resolve, ignore };
