const { pool } = require('../config/database');
const AuditLog = require('../utils/auditLog');
const { regradeQuestionAnswers } = require('../services/examRegradeService');

const REPORT_TYPE_LABELS = {
  wrong_answer: 'Sai đáp án',
  formula_error: 'Lỗi công thức',
  translation_error: 'Lỗi dịch',
  missing_image: 'Thiếu hình ảnh',
  missing_data: 'Thiếu dữ kiện',
  duplicate_question: 'Trùng câu hỏi',
  answer_mismatch: 'Đề/đáp án không khớp',
  other: 'Lỗi khác',
};

/**
 * Risk Center  Phase D: Question Report Actions
 * User-facing report API + Admin actions
 */

const QuestionReportActions = {
  //  POST /api/question-reports  User submits a report
  // (This is a public user-facing route, added separately)
  async submitReport(req, res) {
    try {
      const { question_id, exam_id, report_type, description } = req.body;
      if (!question_id || !exam_id) {
        return res.status(400).json({ success: false, message: 'question_id and exam_id required' });
      }

      const validTypes = [
        'wrong_answer', 'formula_error', 'translation_error', 'missing_image',
        'missing_data', 'duplicate_question', 'answer_mismatch', 'other',
      ];
      const type = validTypes.includes(report_type) ? report_type : 'other';

      // Check question exists
      const qCheck = await pool.query(
        `SELECT q.id, q.question_number, e.title AS exam_title
         FROM questions q
         LEFT JOIN exams e ON e.id = q.exam_id
         WHERE q.id = $1 AND q.exam_id = $2`,
        [question_id, exam_id]
      );
      if (!qCheck.rows[0]) {
        return res.status(404).json({ success: false, message: 'Question not found' });
      }

      // Check for duplicate report from same user
      const existing = await pool.query(
        `SELECT id FROM question_reports
         WHERE question_id = $1 AND reporter_id = $2 AND status IN ('open', 'reviewing')
         LIMIT 1`,
        [question_id, req.user.id]
      );
      if (existing.rows[0]) {
        return res.status(409).json({ success: false, message: 'Bạn đã báo lỗi câu này rồi' });
      }

      const result = await pool.query(`
        INSERT INTO question_reports (question_id, exam_id, reporter_id, report_type, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [question_id, exam_id, req.user.id, type, description?.trim() || null]);

      // Count total reports for this question
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM question_reports WHERE question_id = $1 AND status IN ('open', 'reviewing')`,
        [question_id]
      );
      const reportCount = countResult.rows[0].count;

      // Notify admins for every new report. The duplicate guard above keeps one
      // user from flooding the same question while the report is still open.
      const reporterResult = await pool.query(
        'SELECT full_name, email FROM users WHERE id = $1 LIMIT 1',
        [req.user.id]
      );
      const reporter = reporterResult.rows[0] || {};
      const reporterName = reporter.full_name || reporter.email || `User #${req.user.id}`;
      const questionNumber = qCheck.rows[0].question_number || question_id;
      const examTitle = qCheck.rows[0].exam_title || `Đề #${exam_id}`;
      const highPriorityTypes = new Set(['wrong_answer', 'formula_error', 'answer_mismatch', 'missing_data']);

      await AuditLog.notify({
        type: 'question_report',
        severity: reportCount >= 5 ? 'critical' : highPriorityTypes.has(type) ? 'high' : 'medium',
        title: `${reporterName} báo lỗi câu #${questionNumber}`,
        message: `${examTitle} · ${REPORT_TYPE_LABELS[type] || type}${description?.trim() ? ` · ${description.trim()}` : ''}`,
        entityType: 'question_report',
        entityId: result.rows[0].id,
        userId: req.user.id,
        metadata: {
          reportId: result.rows[0].id,
          questionId: question_id,
          questionNumber,
          examId: exam_id,
          examTitle,
          reportCount,
          reportType: type,
          reporterEmail: reporter.email || null,
        },
      });

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] submitReport error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /question-reports  Admin list (replaces placeholder)
  async getQuestionReports(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      let idx = 1;

      if (req.query.status) {
        conditions.push(`qr.status = $${idx++}`);
        params.push(req.query.status);
      }
      if (req.query.severity) {
        conditions.push(`qr.severity = $${idx++}`);
        params.push(req.query.severity);
      }
      if (req.query.report_type) {
        conditions.push(`qr.report_type = $${idx++}`);
        params.push(req.query.report_type);
      }
      if (req.query.exam_id) {
        conditions.push(`qr.exam_id = $${idx++}`);
        params.push(parseInt(req.query.exam_id));
      }
      if (req.query.question_id) {
        conditions.push(`qr.question_id = $${idx++}`);
        params.push(parseInt(req.query.question_id));
      }
      if (req.query.from) {
        conditions.push(`qr.created_at >= $${idx++}`);
        params.push(req.query.from);
      }
      if (req.query.to) {
        conditions.push(`qr.created_at <= $${idx++}`);
        params.push(req.query.to + 'T23:59:59.999Z');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countParams = [...params];
      params.push(limit, offset);

      const [rows, countResult] = await Promise.all([
        pool.query(`
          SELECT
            qr.*,
            q.question_number, q.question_text, q.question_text_cn,
            q.question_type, q.is_hidden AS question_is_hidden,
            e.title AS exam_title, e.code AS exam_code,
            reporter.full_name AS reporter_name, reporter.email AS reporter_email,
            resolver.full_name AS resolved_by_name,
            (SELECT COUNT(*)::int FROM question_reports qr2
             WHERE qr2.question_id = qr.question_id AND qr2.status IN ('open', 'reviewing')
            ) AS total_reports
          FROM question_reports qr
          LEFT JOIN questions q ON q.id = qr.question_id
          LEFT JOIN exams e ON e.id = qr.exam_id
          LEFT JOIN users reporter ON reporter.id = qr.reporter_id
          LEFT JOIN users resolver ON resolver.id = qr.resolved_by
          ${whereClause}
          ORDER BY
            CASE qr.severity
              WHEN 'critical' THEN 1 WHEN 'high' THEN 2
              WHEN 'medium' THEN 3 ELSE 4
            END,
            qr.created_at DESC
          LIMIT $${idx++} OFFSET $${idx++}
        `, params),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM question_reports qr ${whereClause}`,
          countParams
        ),
      ]);

      const total = countResult.rows[0].count;

      res.json({
        success: true,
        data: rows.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          limit,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getQuestionReports error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  GET /question-reports/:id  Detail
  async getReportDetail(req, res) {
    try {
      const { id } = req.params;

      const report = await pool.query(`
        SELECT
          qr.*,
          q.question_number, q.question_text, q.question_text_cn,
          q.question_type,
          (
            SELECT STRING_AGG(a.answer_key, ',' ORDER BY a.answer_key)
            FROM answers a
            WHERE a.question_id = q.id AND a.is_correct = TRUE
          ) AS correct_answer,
          q.explanation, q.explanation_cn,
          q.image_url AS question_image, q.points, q.is_hidden AS question_is_hidden,
          e.title AS exam_title, e.code AS exam_code, e.is_hidden AS exam_is_hidden,
          reporter.full_name AS reporter_name, reporter.email AS reporter_email,
          resolver.full_name AS resolved_by_name
        FROM question_reports qr
        LEFT JOIN questions q ON q.id = qr.question_id
        LEFT JOIN exams e ON e.id = qr.exam_id
        LEFT JOIN users reporter ON reporter.id = qr.reporter_id
        LEFT JOIN users resolver ON resolver.id = qr.resolved_by
        WHERE qr.id = $1
      `, [id]);

      if (!report.rows[0]) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      // Get all reports for same question
      const relatedReports = await pool.query(`
        SELECT id, report_type, description, status, reporter_id, created_at
        FROM question_reports
        WHERE question_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [report.rows[0].question_id]);

      // Get answers for the question
      const answers = await pool.query(`
        SELECT id, answer_key, answer_text, answer_text_cn, is_correct
        FROM answers
        WHERE question_id = $1
        ORDER BY answer_key
      `, [report.rows[0].question_id]);

      // Get audit history
      const audits = await pool.query(`
        SELECT al.*, adm.full_name AS admin_name
        FROM admin_audit_logs al
        LEFT JOIN users adm ON adm.id = al.admin_id
        WHERE al.entity_type = 'question_report' AND al.entity_id = $1
        ORDER BY al.created_at DESC
        LIMIT 50
      `, [id]);

      // Get regrade history for this question
      const regrades = await pool.query(`
        SELECT rl.*, adm.full_name AS admin_name
        FROM regrade_logs rl
        LEFT JOIN users adm ON adm.id = rl.regraded_by
        WHERE rl.question_id = $1
        ORDER BY rl.created_at DESC
      `, [report.rows[0].question_id]);

      res.json({
        success: true,
        data: {
          ...report.rows[0],
          relatedReports: relatedReports.rows,
          answers: answers.rows,
          auditHistory: audits.rows,
          regradeHistory: regrades.rows,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getReportDetail error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /question-reports/:id/resolve
  async resolveReport(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE question_reports
        SET status = 'fixed', resolved_by = $2, resolved_at = NOW(),
            admin_note = COALESCE(admin_note || E'\\n', '') || $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id, `[FIXED] ${new Date().toISOString()} ${req.user.email}: ${reason || 'Đã sửa'}`]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Report not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'resolve_question_report', entityType: 'question_report',
        entityId: parseInt(id), afterData: { status: 'fixed' }, reason, ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] resolveReport error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /question-reports/:id/ignore
  async ignoreReport(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(`
        UPDATE question_reports
        SET status = 'ignored', resolved_by = $2, resolved_at = NOW(),
            admin_note = COALESCE(admin_note || E'\\n', '') || $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id, `[IGNORED] ${new Date().toISOString()} ${req.user.email}: ${reason || 'Bỏ qua'}`]);

      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Report not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'ignore_question_report', entityType: 'question_report',
        entityId: parseInt(id), afterData: { status: 'ignored' }, reason, ...meta,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('[RiskCenter] ignoreReport error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /question-reports/:id/hide-question
  async hideQuestion(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const report = await pool.query('SELECT question_id, exam_id FROM question_reports WHERE id = $1', [id]);
      if (!report.rows[0]) return res.status(404).json({ success: false, message: 'Report not found' });

      const questionId = report.rows[0].question_id;
      const before = await pool.query('SELECT is_hidden, question_text FROM questions WHERE id = $1', [questionId]);

      await pool.query(`
        UPDATE questions
        SET is_hidden = TRUE, hidden_at = NOW(), hidden_by = $2, hidden_reason = $3
        WHERE id = $1
      `, [questionId, req.user.id, reason.trim()]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'hide_question', entityType: 'question_report',
        entityId: parseInt(id),
        beforeData: { questionId, is_hidden: before.rows[0]?.is_hidden },
        afterData: { questionId, is_hidden: true },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] hideQuestion error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /question-reports/:id/hide-exam
  async hideExam(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      const report = await pool.query('SELECT exam_id FROM question_reports WHERE id = $1', [id]);
      if (!report.rows[0]) return res.status(404).json({ success: false, message: 'Report not found' });

      const examId = report.rows[0].exam_id;
      const before = await pool.query('SELECT is_hidden, title FROM exams WHERE id = $1', [examId]);

      await pool.query(`
        UPDATE exams
        SET is_hidden = TRUE, hidden_at = NOW(), hidden_by = $2, hidden_reason = $3
        WHERE id = $1
      `, [examId, req.user.id, reason.trim()]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'hide_exam', entityType: 'question_report',
        entityId: parseInt(id),
        beforeData: { examId, is_hidden: before.rows[0]?.is_hidden },
        afterData: { examId, is_hidden: true },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] hideExam error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /question-reports/:id/regrade-affected-attempts
  async regradeAffectedAttempts(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { new_correct_answer, reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });
      if (!new_correct_answer?.trim()) return res.status(400).json({ success: false, message: 'new_correct_answer required' });

      const report = await client.query('SELECT question_id, exam_id FROM question_reports WHERE id = $1', [id]);
      if (!report.rows[0]) {
        client.release();
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      const { question_id, exam_id } = report.rows[0];

      await client.query('BEGIN');

      // Get current correct answer
      const oldAnswer = await client.query(
        `SELECT answer_key FROM answers WHERE question_id = $1 AND is_correct = TRUE LIMIT 1`,
        [question_id]
      );
      const oldKey = oldAnswer.rows[0]?.answer_key;

      // Update correct answer in answers table
      await client.query(
        `UPDATE answers SET is_correct = FALSE WHERE question_id = $1`, [question_id]
      );
      await client.query(
        `UPDATE answers SET is_correct = TRUE WHERE question_id = $1 AND answer_key = $2`,
        [question_id, new_correct_answer.trim().toUpperCase()]
      );

      // Get new correct answer ID
      const newAnswerRow = await client.query(
        `SELECT id FROM answers WHERE question_id = $1 AND answer_key = $2`,
        [question_id, new_correct_answer.trim().toUpperCase()]
      );
      if (!newAnswerRow.rows[0]) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ success: false, message: 'Answer key not found for this question' });
      }

      const regradeResult = await regradeQuestionAnswers(client, question_id, {
        examId: exam_id,
        forceRecalculate: true,
        invalidateAiCache: true,
      });
      const attemptIds = regradeResult.recalculatedAttemptIds;
      const regradeCount = attemptIds.length;

      // Log regrade
      await client.query(`
        INSERT INTO regrade_logs
          (question_id, exam_id, old_answer, new_answer, affected_count, regraded_by, report_id, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `, [
        question_id, exam_id, oldKey, new_correct_answer.trim().toUpperCase(),
        regradeCount, req.user.id, parseInt(id),
        JSON.stringify({
          attemptIds,
          changedAnswerRows: regradeResult.changedAnswerRows,
          aiCacheDeleted: regradeResult.aiCacheDeleted,
          reason: reason.trim(),
        }),
      ]);

      // Mark report as fixed
      await client.query(`
        UPDATE question_reports
        SET status = 'fixed', resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id, req.user.id]);

      await client.query('COMMIT');

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'regrade_attempts', entityType: 'question_report',
        entityId: parseInt(id),
        beforeData: { questionId: question_id, oldAnswer: oldKey },
        afterData: { questionId: question_id, newAnswer: new_correct_answer.trim().toUpperCase(), regradeCount },
        reason: reason.trim(), ...meta,
      });

      await AuditLog.notify({
        type: 'question_report', severity: 'high',
        title: `Đã chấm lại ${regradeCount} bài thi ở câu #${question_id}`,
        message: `Đáp án: ${oldKey} -> ${new_correct_answer.trim().toUpperCase()}. ${reason.trim()}`,
        entityType: 'question', entityId: question_id,
        metadata: { examId: exam_id, regradeCount, oldAnswer: oldKey, newAnswer: new_correct_answer.trim().toUpperCase() },
      });

      res.json({
        success: true,
        data: {
          regradeCount,
          oldAnswer: oldKey,
          newAnswer: new_correct_answer.trim().toUpperCase(),
          affectedAttemptIds: attemptIds,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RiskCenter] regradeAffectedAttempts error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      client.release();
    }
  },
};

module.exports = QuestionReportActions;
