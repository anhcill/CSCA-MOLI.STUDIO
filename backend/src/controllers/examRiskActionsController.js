const { pool } = require('../config/database');
const AuditLog = require('../utils/auditLog');
const UserActivity = require('../models/UserActivity');

/**
 * Risk Center  Phase B: Exam Cheating Actions
 * All strong actions require risk_center.manage permission (enforced in routes)
 */

//  Risk score calculation rules from plan
const RISK_RULES = {
  tab_switch:           { thresholdHigh: 15, severity: 'medium',   scorePerEvent: 2 },
  window_blur:          { thresholdHigh: 25, severity: 'medium',   scorePerEvent: 2 },
  copy:                 { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  copy_attempt:         { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  print:                { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  print_attempt:        { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  print_shortcut:       { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  screenshot_suspected: { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  screenshot_key:       { thresholdHigh: 1, severity: 'critical', scorePerEvent: 30 },
  fullscreen_exit:      { thresholdHigh: 15, severity: 'medium',   scorePerEvent: 2 },
  multi_tab_conflict:   { thresholdHigh: 1, severity: 'high',     scorePerEvent: 20 },
  right_click:          { thresholdHigh: 25, severity: 'low',      scorePerEvent: 1 },
  devtools:             { thresholdHigh: 1, severity: 'critical', scorePerEvent: 40 },
  resize_suspicious:    { thresholdHigh: 15, severity: 'low',      scorePerEvent: 1 },
  multi_touch:          { thresholdHigh: 15, severity: 'low',      scorePerEvent: 1 },
};

function calcSeverity(riskScore) {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 20) return 'medium';
  return 'low';
}

const ExamRiskActions = {
  //  POST /exam-risks/scan  Scan violations  create/update risk cases
  async scanViolations(req, res) {
    try {
      // Aggregate violations per attempt that don't yet have a risk case
      // or have new violations since last scan
      const violations = await pool.query(`
        SELECT
          ev.attempt_id,
          ev.user_id,
          ev.exam_id,
          COUNT(*)::int AS total_violations,
          MAX(ev.created_at) AS last_violation_at,
          jsonb_object_agg(
            ev.violation_type,
            (SELECT COUNT(*)::int FROM exam_violations ev2
             WHERE ev2.attempt_id = ev.attempt_id
               AND ev2.violation_type = ev.violation_type)
          ) AS violation_types
        FROM exam_violations ev
        WHERE ev.attempt_id IS NOT NULL
        GROUP BY ev.attempt_id, ev.user_id, ev.exam_id
        HAVING COUNT(*) >= 2
        ORDER BY MAX(ev.created_at) DESC
        LIMIT 500
      `);

      let created = 0;
      let updated = 0;

      for (const row of violations.rows) {
        // Calculate risk score
        let riskScore = 0;
        const types = row.violation_types || {};
        for (const [type, count] of Object.entries(types)) {
          const rule = RISK_RULES[type] || { scorePerEvent: 5 };
          riskScore += rule.scorePerEvent * Number(count);
        }
        const severity = calcSeverity(riskScore);
        const typeCount = Object.keys(types).length;
        // Multiple violation types bonus
        if (typeCount >= 3) riskScore += 5;
        if (typeCount >= 5) riskScore += 10;

        const summary = Object.entries(types)
          .map(([t, c]) => `${t}: ${c}`)
          .join(', ');

        // Upsert risk case
        const result = await pool.query(`
          INSERT INTO exam_risk_cases
            (attempt_id, user_id, exam_id, severity, risk_score, violation_count,
             violation_types, last_violation_at, summary)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
          ON CONFLICT (attempt_id) WHERE attempt_id IS NOT NULL
          DO UPDATE SET
            severity = EXCLUDED.severity,
            risk_score = EXCLUDED.risk_score,
            violation_count = EXCLUDED.violation_count,
            violation_types = EXCLUDED.violation_types,
            last_violation_at = EXCLUDED.last_violation_at,
            summary = EXCLUDED.summary,
            updated_at = NOW()
          RETURNING id, (xmax = 0) AS is_new
        `, [
          row.attempt_id, row.user_id, row.exam_id,
          severity, riskScore, row.total_violations,
          JSON.stringify(types), row.last_violation_at, summary,
        ]);

        if (result.rows[0]?.is_new) {
          created++;
          // Create notification for high/critical
          if (severity === 'high' || severity === 'critical') {
            await AuditLog.notify({
              type: 'exam_risk',
              severity,
              title: `Vi phạm thi ${severity} - attempt #${row.attempt_id}`,
              message: summary,
              entityType: 'exam_risk_case',
              entityId: result.rows[0].id,
              userId: row.user_id,
              metadata: { attemptId: row.attempt_id, examId: row.exam_id, riskScore },
            });
          }
        } else {
          updated++;
        }
      }

      res.json({ success: true, data: { created, updated, scanned: violations.rows.length } });
    } catch (error) {
      console.error('[RiskCenter] scanViolations error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /exam-risks/:id  Get single risk case detail
  async getExamRiskDetail(req, res) {
    try {
      const { id } = req.params;

      const caseResult = await pool.query(`
        SELECT
          erc.*,
          u.full_name AS user_name, u.email AS user_email, u.avatar_url,
          u.is_active AS user_is_active, u.is_banned AS user_is_banned,
          e.title AS exam_title, e.code AS exam_code,
          ea.status AS attempt_status, ea.total_score, ea.is_locked, ea.is_invalidated,
          ea.start_time AS attempt_start, ea.submit_time AS attempt_submit,
          resolver.full_name AS resolved_by_name
        FROM exam_risk_cases erc
        LEFT JOIN users u ON u.id = erc.user_id
        LEFT JOIN exams e ON e.id = erc.exam_id
        LEFT JOIN exam_attempts ea ON ea.id = erc.attempt_id
        LEFT JOIN users resolver ON resolver.id = erc.resolved_by
        WHERE erc.id = $1
      `, [id]);

      if (!caseResult.rows[0]) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }

      // Get violation timeline
      const violations = await pool.query(`
        SELECT id, violation_type, violation_count, severity, notes, metadata,
               ip_address, user_agent, created_at
        FROM exam_violations
        WHERE attempt_id = $1
        ORDER BY created_at ASC
      `, [caseResult.rows[0].attempt_id]);

      // Get audit history for this case
      const audits = await pool.query(`
        SELECT al.*, adm.full_name AS admin_name
        FROM admin_audit_logs al
        LEFT JOIN users adm ON adm.id = al.admin_id
        WHERE al.entity_type = 'exam_risk_case' AND al.entity_id = $1
        ORDER BY al.created_at DESC
        LIMIT 50
      `, [id]);

      // Check if user has exam access ban
      const examBan = caseResult.rows[0].exam_id ? await pool.query(`
        SELECT id, created_at, reason FROM exam_access_bans
        WHERE user_id = $1 AND exam_id = $2 AND lifted_at IS NULL
        LIMIT 1
      `, [caseResult.rows[0].user_id, caseResult.rows[0].exam_id]) : { rows: [] };

      // User warnings
      const warnings = await pool.query(`
        SELECT id, type, message, created_at FROM user_warnings
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 20
      `, [caseResult.rows[0].user_id]);

      res.json({
        success: true,
        data: {
          ...caseResult.rows[0],
          violations: violations.rows,
          auditHistory: audits.rows,
          examAccessBan: examBan.rows[0] || null,
          userWarnings: warnings.rows,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getExamRiskDetail error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/note  Add admin note
  async addNote(req, res) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      if (!note?.trim()) return res.status(400).json({ success: false, message: 'Note required' });

      const result = await pool.query(`
        UPDATE exam_risk_cases
        SET admin_note = COALESCE(admin_note || E'\\n', '') || $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, admin_note
      `, [id, `[${new Date().toISOString()}] ${req.user.email}: ${note.trim()}`]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'add_note', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { note: note.trim() }, ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] addNote error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/resolve
  async resolve(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const before = await pool.query('SELECT status, severity FROM exam_risk_cases WHERE id = $1', [id]);
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const result = await pool.query(`
        UPDATE exam_risk_cases
        SET status = 'resolved', resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'resolve_case', entityType: 'exam_risk_case',
        entityId: parseInt(id), beforeData: before.rows[0],
        afterData: { status: 'resolved' }, reason, ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] resolve error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/ignore
  async ignore(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE exam_risk_cases
        SET status = 'ignored', resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'ignore_case', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { status: 'ignored' }, reason, ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] ignore error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/escalate
  async escalate(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE exam_risk_cases
        SET status = 'escalated', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'escalate_case', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { status: 'escalated' }, reason, ...meta,
      });

      await AuditLog.notify({
        type: 'exam_risk', severity: 'critical',
        title: `Case #${id} đã được escalate`,
        message: reason || 'Cần admin tổng xử lý',
        entityType: 'exam_risk_case', entityId: parseInt(id),
        userId: result.rows[0].user_id,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] escalate error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/warn-user
  async warnUser(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ success: false, message: 'Warning message required' });

      const riskCase = await pool.query('SELECT user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      await pool.query(`
        INSERT INTO user_warnings (user_id, warned_by, type, message, case_id)
        VALUES ($1, $2, 'exam_cheating', $3, $4)
      `, [riskCase.rows[0].user_id, req.user.id, message.trim(), parseInt(id)]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'warn_user', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { userId: riskCase.rows[0].user_id, message: message.trim() },
        ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] warnUser error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/lock-attempt
  async lockAttempt(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required for strong action' });

      const riskCase = await pool.query('SELECT attempt_id, user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });
      if (!riskCase.rows[0].attempt_id) return res.status(400).json({ success: false, message: 'No attempt linked' });

      const attemptId = riskCase.rows[0].attempt_id;
      const before = await pool.query('SELECT id, status, is_locked FROM exam_attempts WHERE id = $1', [attemptId]);
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (before.rows[0].is_locked) return res.status(409).json({ success: false, message: 'Already locked' });

      await pool.query(`
        UPDATE exam_attempts
        SET is_locked = TRUE, locked_at = NOW(), locked_by = $2
        WHERE id = $1
      `, [attemptId, req.user.id]);

      await pool.query(`
        UPDATE exam_risk_cases SET status = 'reviewing', updated_at = NOW() WHERE id = $1
      `, [id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'lock_attempt', entityType: 'exam_risk_case',
        entityId: parseInt(id), beforeData: { attemptId, is_locked: false },
        afterData: { attemptId, is_locked: true }, reason: reason.trim(), ...meta,
      });

      UserActivity.log(req.user.id, 'admin.lock_attempt', {
        attemptId, caseId: parseInt(id), userId: riskCase.rows[0].user_id,
        ip: meta.ipAddress, userAgent: meta.userAgent,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] lockAttempt error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/force-submit
  async forceSubmit(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const riskCase = await pool.query('SELECT attempt_id, user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]?.attempt_id) return res.status(404).json({ success: false, message: 'Case/attempt not found' });

      const attemptId = riskCase.rows[0].attempt_id;
      const before = await pool.query('SELECT id, status FROM exam_attempts WHERE id = $1', [attemptId]);
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (before.rows[0].status === 'completed') return res.status(409).json({ success: false, message: 'Already completed' });

      // Force submit: calculate score and mark completed
      const stats = await pool.query(`
        SELECT
          COALESCE(COUNT(*), 0)::int AS total_answered,
          COALESCE(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END), 0)::int AS total_correct,
          COALESCE(SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END), 0)::int AS total_incorrect,
          COALESCE(SUM(CASE WHEN ua.is_correct THEN q.points ELSE 0 END), 0) AS total_score
        FROM user_answers ua
        INNER JOIN questions q ON ua.question_id = q.id
        WHERE ua.attempt_id = $1
      `, [attemptId]);

      const s = stats.rows[0];
      const result = await pool.query(`
        UPDATE exam_attempts
        SET status = 'completed', end_time = NOW(), submit_time = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::int,
            total_score = $2, total_correct = $3, total_incorrect = $4,
            is_locked = TRUE, locked_at = NOW(), locked_by = $5
        WHERE id = $1
        RETURNING *
      `, [attemptId, parseFloat(s.total_score) || 0, s.total_correct, s.total_incorrect, req.user.id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'force_submit', entityType: 'exam_risk_case',
        entityId: parseInt(id), beforeData: { attemptId, status: before.rows[0].status },
        afterData: { attemptId, status: 'completed', total_score: result.rows[0].total_score },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] forceSubmit error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/invalidate-attempt
  async invalidateAttempt(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const riskCase = await pool.query('SELECT attempt_id, user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]?.attempt_id) return res.status(404).json({ success: false, message: 'Case/attempt not found' });

      const attemptId = riskCase.rows[0].attempt_id;
      const before = await pool.query(
        'SELECT id, status, total_score, is_invalidated FROM exam_attempts WHERE id = $1', [attemptId]
      );
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (before.rows[0].is_invalidated) return res.status(409).json({ success: false, message: 'Already invalidated' });

      await pool.query(`
        UPDATE exam_attempts
        SET is_invalidated = TRUE, invalidated_at = NOW(), invalidated_by = $2,
            invalidate_reason = $3, total_score = 0
        WHERE id = $1
      `, [attemptId, req.user.id, reason.trim()]);

      await pool.query(`
        UPDATE exam_risk_cases SET status = 'resolved', resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id, req.user.id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'invalidate_attempt', entityType: 'exam_risk_case',
        entityId: parseInt(id),
        beforeData: { attemptId, status: before.rows[0].status, total_score: before.rows[0].total_score },
        afterData: { attemptId, is_invalidated: true, total_score: 0 },
        reason: reason.trim(), ...meta,
      });

      await AuditLog.notify({
        type: 'exam_risk', severity: 'high',
        title: `Attempt #${attemptId} đã bị hủy kết quả`,
        message: reason.trim(),
        entityType: 'exam_risk_case', entityId: parseInt(id),
        userId: riskCase.rows[0].user_id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] invalidateAttempt error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/restore-attempt
  async restoreAttempt(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const riskCase = await pool.query('SELECT attempt_id, user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]?.attempt_id) return res.status(404).json({ success: false, message: 'Case/attempt not found' });

      const attemptId = riskCase.rows[0].attempt_id;
      const before = await pool.query(
        'SELECT id, is_invalidated, is_locked, total_score FROM exam_attempts WHERE id = $1', [attemptId]
      );
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Attempt not found' });

      // Recalculate score
      const stats = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN ua.is_correct THEN q.points ELSE 0 END), 0) AS total_score,
               COALESCE(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END), 0)::int AS total_correct,
               COALESCE(SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END), 0)::int AS total_incorrect
        FROM user_answers ua
        INNER JOIN questions q ON ua.question_id = q.id
        WHERE ua.attempt_id = $1
      `, [attemptId]);

      const s = stats.rows[0];
      await pool.query(`
        UPDATE exam_attempts
        SET is_invalidated = FALSE, invalidated_at = NULL, invalidated_by = NULL,
            invalidate_reason = NULL, is_locked = FALSE, locked_at = NULL, locked_by = NULL,
            total_score = $2, total_correct = $3, total_incorrect = $4
        WHERE id = $1
      `, [attemptId, parseFloat(s.total_score) || 0, s.total_correct, s.total_incorrect]);

      await pool.query(`
        UPDATE exam_risk_cases SET status = 'reverted', updated_at = NOW() WHERE id = $1
      `, [id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'restore_attempt', entityType: 'exam_risk_case',
        entityId: parseInt(id),
        beforeData: { attemptId, is_invalidated: before.rows[0].is_invalidated, total_score: before.rows[0].total_score },
        afterData: { attemptId, is_invalidated: false, total_score: parseFloat(s.total_score) || 0 },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] restoreAttempt error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/ban-exam-access
  async banExamAccess(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const riskCase = await pool.query('SELECT user_id, exam_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });
      if (!riskCase.rows[0].exam_id) return res.status(400).json({ success: false, message: 'No exam linked' });

      const { user_id, exam_id } = riskCase.rows[0];

      await pool.query(`
        INSERT INTO exam_access_bans (user_id, exam_id, banned_by, reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, exam_id) DO UPDATE
        SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason,
            created_at = NOW(), lifted_at = NULL, lifted_by = NULL
      `, [user_id, exam_id, req.user.id, reason.trim()]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'ban_exam_access', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { user_id, exam_id, banned: true },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] banExamAccess error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/suspend-user
  async suspendUser(req, res) {
    try {
      const { id } = req.params;
      const { reason, duration_hours } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });
      const hours = parseInt(duration_hours) || 24;

      const riskCase = await pool.query('SELECT user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const userId = riskCase.rows[0].user_id;
      const before = await pool.query('SELECT is_active, suspended_until FROM users WHERE id = $1', [userId]);

      await pool.query(`
        UPDATE users
        SET suspended_until = NOW() + ($2 || ' hours')::interval,
            suspended_at = NOW(), suspended_by = $3, suspend_reason = $4
        WHERE id = $1
      `, [userId, String(hours), req.user.id, reason.trim()]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'suspend_user', entityType: 'exam_risk_case',
        entityId: parseInt(id),
        beforeData: { userId, suspended_until: before.rows[0]?.suspended_until },
        afterData: { userId, duration_hours: hours },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] suspendUser error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/ban-user
  async banUser(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const riskCase = await pool.query('SELECT user_id FROM exam_risk_cases WHERE id = $1', [id]);
      if (!riskCase.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      const userId = riskCase.rows[0].user_id;
      const before = await pool.query('SELECT is_active, is_banned FROM users WHERE id = $1', [userId]);

      await pool.query(`
        UPDATE users
        SET is_active = FALSE, is_banned = TRUE, banned_at = NOW(),
            banned_by = $2, ban_reason = $3
        WHERE id = $1
      `, [userId, req.user.id, reason.trim()]);

      // Blacklist all active sessions
      await pool.query(`
        INSERT INTO token_blacklist (token_jti, user_id, expires_at)
        SELECT jti, user_id, expires_at FROM user_sessions WHERE user_id = $1
        ON CONFLICT (token_jti) DO NOTHING
      `, [userId]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'ban_user', entityType: 'exam_risk_case',
        entityId: parseInt(id),
        beforeData: { userId, is_active: before.rows[0]?.is_active, is_banned: before.rows[0]?.is_banned },
        afterData: { userId, is_active: false, is_banned: true },
        reason: reason.trim(), ...meta,
      });

      await AuditLog.notify({
        type: 'system', severity: 'critical',
        title: `User #${userId} đã bị ban vĩnh viễn`,
        message: reason.trim(),
        entityType: 'user', entityId: userId, userId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] banUser error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /exam-risks/:id/mark-clean
  async markClean(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE exam_risk_cases
        SET status = 'resolved', severity = 'low', resolved_by = $2, resolved_at = NOW(),
            admin_note = COALESCE(admin_note || E'\\n', '') || $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id, `[CLEAN] ${new Date().toISOString()} ${req.user.email}: ${reason || 'Không gian lận'}`]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Case not found' });

      // Unlock/restore attempt if it was locked
      if (result.rows[0].attempt_id) {
        await pool.query(`
          UPDATE exam_attempts
          SET is_locked = FALSE, locked_at = NULL, locked_by = NULL
          WHERE id = $1 AND is_locked = TRUE
        `, [result.rows[0].attempt_id]);
      }

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'mark_clean', entityType: 'exam_risk_case',
        entityId: parseInt(id), afterData: { status: 'resolved', severity: 'low' },
        reason: reason || 'Không gian lận', ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] markClean error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
};

module.exports = ExamRiskActions;
