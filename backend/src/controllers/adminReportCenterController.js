const db = require('../config/database');

const VALID_SOURCES = new Set(['forum', 'question', 'feedback', 'qa', 'contact']);

const ITEMS_CTE = `
  WITH report_center_items AS (
    SELECT
      'forum:' || r.id AS key,
      'forum'::text AS source,
      r.id AS source_id,
      COALESCE(r.target_type, 'user')::text AS type,
      CASE WHEN r.archived_at IS NOT NULL THEN 'archived'
           WHEN r.status = 'resolved' THEN 'resolved'
           WHEN r.status = 'dismissed' THEN 'ignored'
           ELSE 'pending' END AS status,
      r.status::text AS raw_status,
      CASE WHEN pending_counts.pending_count >= 3 THEN 'high' ELSE 'normal' END AS priority,
      CASE WHEN r.target_type = 'message' THEN 'Báo cáo tin nhắn' ELSE 'Báo cáo người dùng' END AS title,
      r.reason::text AS summary,
      r.reporter_id,
      reporter.full_name::text AS reporter_name,
      reporter.email::text AS reporter_email,
      COALESCE(r.target_type, 'user')::text AS target_type,
      COALESCE(r.target_id, r.reported_user_id) AS target_id,
      reported.full_name::text AS target_label,
      NULL::text AS reference_url,
      r.resolved_by AS assigned_to,
      assignee.full_name::text AS assigned_to_name,
      assignee.email::text AS assigned_to_email,
      r.created_at,
      COALESCE(r.updated_at, r.resolved_at, r.created_at) AS updated_at,
      COALESCE(r.evidence, '{}'::jsonb) || jsonb_build_object(
        'reportedUserId', r.reported_user_id,
        'adminNote', r.admin_note,
        'pendingCount', pending_counts.pending_count,
        'archivedAt', r.archived_at
      ) AS metadata
    FROM forum_reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    JOIN users reported ON reported.id = r.reported_user_id
    LEFT JOIN users assignee ON assignee.id = r.resolved_by
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS pending_count
      FROM forum_reports r2
      WHERE r2.reported_user_id = r.reported_user_id AND r2.status = 'pending'
    ) pending_counts ON TRUE

    UNION ALL

    SELECT
      'question:' || qr.id,
      'question',
      qr.id,
      qr.report_type::text,
      CASE WHEN qr.archived_at IS NOT NULL THEN 'archived' ELSE CASE qr.status
        WHEN 'open' THEN 'pending'
        WHEN 'reviewing' THEN 'in_progress'
        WHEN 'fixed' THEN 'resolved'
        WHEN 'ignored' THEN 'ignored'
        WHEN 'escalated' THEN 'escalated'
        ELSE qr.status
      END END,
      qr.status::text,
      qr.severity::text,
      COALESCE(e.title, 'Đề thi') || ' · Câu ' || COALESCE(q.question_number::text, qr.question_id::text),
      COALESCE(qr.description, qr.report_type),
      qr.reporter_id,
      reporter.full_name::text,
      reporter.email::text,
      'question',
      qr.question_id,
      COALESCE(q.question_text, 'Câu #' || qr.question_id),
      '/admin/exams/' || qr.exam_id || '?questionId=' || qr.question_id,
      qr.resolved_by,
      assignee.full_name::text,
      assignee.email::text,
      qr.created_at,
      qr.updated_at,
      COALESCE(qr.metadata, '{}'::jsonb) || jsonb_build_object(
        'examId', qr.exam_id,
        'examTitle', e.title,
        'questionNumber', q.question_number,
        'adminNote', qr.admin_note,
        'archivedAt', qr.archived_at
      )
    FROM question_reports qr
    LEFT JOIN users reporter ON reporter.id = qr.reporter_id
    LEFT JOIN users assignee ON assignee.id = qr.resolved_by
    LEFT JOIN questions q ON q.id = qr.question_id
    LEFT JOIN exams e ON e.id = qr.exam_id

    UNION ALL

    SELECT
      CASE WHEN t.category = 'exam_question' THEN 'qa:' ELSE 'feedback:' END || t.id,
      CASE WHEN t.category = 'exam_question' THEN 'qa' ELSE 'feedback' END,
      t.id,
      t.category::text,
      CASE WHEN t.deleted_at IS NOT NULL THEN 'archived'
           WHEN t.status = 'answered' THEN 'in_progress'
           WHEN t.status = 'closed' THEN 'closed'
           ELSE 'pending' END,
      t.status::text,
      t.priority::text,
      CASE WHEN t.category = 'exam_question' THEN 'Hỏi đáp học viên' ELSE 'Góp ý người dùng' END,
      COALESCE(NULLIF(t.content, ''), '(Có ảnh đính kèm)'),
      t.user_id,
      owner.full_name::text,
      owner.email::text,
      'support_ticket',
      t.id,
      t.category::text,
      t.reference_url::text,
      t.assigned_to,
      assignee.full_name::text,
      assignee.email::text,
      t.created_at,
      t.updated_at,
      jsonb_build_object(
        'category', t.category,
        'imageUrl', t.image_url,
        'adminNote', t.admin_note,
        'replyCount', (SELECT COUNT(*)::int FROM support_replies sr WHERE sr.ticket_id = t.id),
        'archivedAt', t.deleted_at
      )
    FROM support_tickets t
    JOIN users owner ON owner.id = t.user_id
    LEFT JOIN users assignee ON assignee.id = t.assigned_to

    UNION ALL

    SELECT
      'contact:' || c.id,
      'contact',
      c.id,
      'contact',
      CASE c.status WHEN 'resolved' THEN 'resolved' WHEN 'dismissed' THEN 'ignored' WHEN 'closed' THEN 'closed' ELSE c.status END,
      c.status::text,
      c.priority::text,
      c.subject::text,
      c.message::text,
      NULL::integer,
      c.name::text,
      c.email::text,
      'contact',
      c.id,
      c.phone::text,
      NULL::text,
      c.assigned_to,
      assignee.full_name::text,
      assignee.email::text,
      c.created_at,
      c.updated_at,
      jsonb_build_object(
        'phone', c.phone,
        'emailStatus', c.email_status,
        'emailError', c.email_error,
        'adminNote', c.admin_note
      )
    FROM contact_submissions c
    LEFT JOIN users assignee ON assignee.id = c.assigned_to
  )
`;

const toItem = (row) => ({
  key: row.key,
  source: row.source,
  source_id: row.source_id,
  type: row.type,
  status: row.status,
  raw_status: row.raw_status,
  priority: row.priority,
  title: row.title,
  summary: row.summary,
  reporter: {
    id: row.reporter_id,
    name: row.reporter_name,
    email: row.reporter_email,
  },
  target: {
    type: row.target_type,
    id: row.target_id,
    label: row.target_label,
  },
  reference_url: row.reference_url,
  assigned_to: row.assigned_to ? {
    id: row.assigned_to,
    name: row.assigned_to_name,
    email: row.assigned_to_email,
  } : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  metadata: row.metadata || {},
});

exports.getSummary = async (_req, res) => {
  try {
    const result = await db.query(`${ITEMS_CTE}
      SELECT source, status, COUNT(*)::int AS count
      FROM report_center_items
      GROUP BY source, status
      ORDER BY source, status
    `);
    const sources = {};
    const statuses = {};
    let total = 0;
    for (const row of result.rows) {
      total += row.count;
      sources[row.source] = (sources[row.source] || 0) + row.count;
      statuses[row.status] = (statuses[row.status] || 0) + row.count;
    }
    res.json({
      success: true,
      data: {
        total,
        pending: statuses.pending || 0,
        in_progress: statuses.in_progress || 0,
        resolved: (statuses.resolved || 0) + (statuses.closed || 0),
        ignored: statuses.ignored || 0,
        sources,
        statuses,
      },
    });
  } catch (error) {
    console.error('Report center summary error:', error);
    res.status(500).json({ success: false, message: 'Không tải được tổng quan báo cáo.' });
  }
};
exports.getItems = async (req, res) => {
  try {
    const source = String(req.query.source || '').trim();
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim().slice(0, 200);
    if (source && !VALID_SOURCES.has(source)) {
      return res.status(400).json({ success: false, message: 'Nguồn báo cáo không hợp lệ.' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const result = await db.query(`${ITEMS_CTE}
      SELECT *, COUNT(*) OVER()::int AS total_count
      FROM report_center_items
      WHERE ($1 = '' OR source = $1)
        AND ($2 = '' OR status = $2 OR raw_status = $2)
        AND ($3 = '' OR CONCAT_WS(' ', title, summary, reporter_name, reporter_email, target_label) ILIKE '%' || $3 || '%')
      ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        updated_at DESC
      LIMIT $4 OFFSET $5
    `, [source, status, search, limit, offset]);

    const total = result.rows[0]?.total_count || 0;
    res.json({
      success: true,
      data: result.rows.map(toItem),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Report center list error:', error);
    res.status(500).json({ success: false, message: 'Không tải được danh sách báo cáo.' });
  }
};
async function getSourceDetail(source, id) {
  if (source === 'forum') {
    const result = await db.query(`
      SELECT r.*, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
             reported.full_name AS reported_name, reported.email AS reported_email,
             resolver.full_name AS resolved_by_name
      FROM forum_reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      JOIN users reported ON reported.id = r.reported_user_id
      LEFT JOIN users resolver ON resolver.id = r.resolved_by
      WHERE r.id = $1
    `, [id]);
    return result.rows[0];
  }
  if (source === 'question') {
    const report = await db.query(`
      SELECT qr.*, q.question_number, q.question_text, q.question_text_cn, q.image_url AS question_image,
             e.title AS exam_title, reporter.full_name AS reporter_name, reporter.email AS reporter_email
      FROM question_reports qr
      LEFT JOIN questions q ON q.id = qr.question_id
      LEFT JOIN exams e ON e.id = qr.exam_id
      LEFT JOIN users reporter ON reporter.id = qr.reporter_id
      WHERE qr.id = $1
    `, [id]);
    if (!report.rows[0]) return null;
    const related = await db.query(`
      SELECT id, report_type, description, status, severity, reporter_id, created_at
      FROM question_reports WHERE question_id = $1 ORDER BY created_at DESC LIMIT 100
    `, [report.rows[0].question_id]);
    return { ...report.rows[0], relatedReports: related.rows };
  }
  if (source === 'feedback' || source === 'qa') {
    const categories = source === 'qa'
      ? ['exam_question']
      : ['question', 'issue', 'feature_request', 'upgrade_request', 'experience', 'other', 'general'];
    const ticket = await db.query(`
      SELECT t.*, u.full_name AS reporter_name, u.email AS reporter_email
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE t.id = $1 AND t.category = ANY($2::text[])
    `, [id, categories]);
    if (!ticket.rows[0]) return null;
    const replies = await db.query(`
      SELECT r.*, u.full_name AS sender_name, u.email AS sender_email
      FROM support_replies r LEFT JOIN users u ON u.id = r.sender_id
      WHERE r.ticket_id = $1 ORDER BY r.created_at ASC
    `, [id]);
    return { ...ticket.rows[0], replies: replies.rows };
  }
  if (source === 'contact') {
    const result = await db.query('SELECT * FROM contact_submissions WHERE id = $1', [id]);
    return result.rows[0];
  }
  return null;
}

exports.getItemDetail = async (req, res) => {
  try {
    const source = String(req.params.source || '');
    const id = parseInt(req.params.id, 10);
    if (!VALID_SOURCES.has(source) || !Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Báo cáo không hợp lệ.' });
    }
    const detail = await getSourceDetail(source, id);
    if (!detail) return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    const base = await db.query(`${ITEMS_CTE}
      SELECT * FROM report_center_items WHERE source = $1 AND source_id = $2 LIMIT 1
    `, [source, id]);
    if (!base.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    const item = toItem(base.rows[0]);
    item.metadata = { ...(item.metadata || {}), detail };
    res.json({ success: true, data: { item } });
  } catch (error) {
    console.error('Report center detail error:', error);
    res.status(500).json({ success: false, message: 'Không tải được chi tiết báo cáo.' });
  }
};

exports.actionItem = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const source = String(req.params.source || '');
    const id = parseInt(req.params.id, 10);
    const action = String(req.body.action || '').trim();
    const note = String(req.body.note || req.body.reason || '').trim().slice(0, 4000) || null;
    if (!VALID_SOURCES.has(source) || !Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Báo cáo không hợp lệ.' });
    }
    if (!['resolve', 'dismiss', 'ignore', 'reopen', 'close', 'archive'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Thao tác không hợp lệ.' });
    }

    await client.query('BEGIN');
    let result;
    if (source === 'forum') {
      const status = action === 'resolve' ? 'resolved' : action === 'reopen' ? 'pending' : 'dismissed';
      result = await client.query(`
        UPDATE forum_reports
        SET status = $2, resolved_by = CASE WHEN $2 = 'pending' THEN NULL ELSE $3 END,
            resolved_at = CASE WHEN $2 = 'pending' THEN NULL ELSE NOW() END,
            admin_note = COALESCE($4, admin_note),
            archived_at = CASE WHEN $5 THEN NOW() WHEN $6 THEN NULL ELSE archived_at END,
            archived_by = CASE WHEN $5 THEN $3 WHEN $6 THEN NULL ELSE archived_by END,
            updated_at = NOW()
        WHERE id = $1 RETURNING *
      `, [id, status, req.user.id, note, action === 'archive', action === 'reopen']);
      if (result.rows[0] && action === 'resolve') {
        await client.query(`
          INSERT INTO forum_blocks (blocker_id, blocked_id)
          VALUES ($1, $2), ($2, $1)
          ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        `, [result.rows[0].reporter_id, result.rows[0].reported_user_id]);
      }
    } else if (source === 'question') {
      const status = action === 'resolve' ? 'fixed' : action === 'reopen' ? 'open' : 'ignored';
      const current = await client.query('SELECT question_id FROM question_reports WHERE id = $1', [id]);
      if (current.rows[0] && action === 'resolve') {
        result = await client.query(`
          UPDATE question_reports
          SET status = 'fixed', resolved_by = $2, resolved_at = NOW(),
              admin_note = COALESCE(admin_note || E'\\n', '') || COALESCE($3, 'Đã sửa'), updated_at = NOW()
          WHERE question_id = $1 AND status IN ('open', 'reviewing', 'escalated')
          RETURNING *
        `, [current.rows[0].question_id, req.user.id, note]);
      } else {
        result = await client.query(`
          UPDATE question_reports
          SET status = $2, resolved_by = CASE WHEN $2 = 'open' THEN NULL ELSE $3 END,
              resolved_at = CASE WHEN $2 = 'open' THEN NULL ELSE NOW() END,
              admin_note = COALESCE($4, admin_note),
              archived_at = CASE WHEN $5 THEN NOW() WHEN $6 THEN NULL ELSE archived_at END,
              archived_by = CASE WHEN $5 THEN $3 WHEN $6 THEN NULL ELSE archived_by END,
              updated_at = NOW()
          WHERE id = $1 RETURNING *
        `, [id, status, req.user.id, note, action === 'archive', action === 'reopen']);
      }
    } else if (source === 'feedback' || source === 'qa') {
      const categories = source === 'qa'
        ? ['exam_question']
        : ['question', 'issue', 'feature_request', 'upgrade_request', 'experience', 'other', 'general'];
      if (action === 'archive') {
        result = await client.query(`
          UPDATE support_tickets SET deleted_at = NOW(), deleted_by = $2, admin_note = COALESCE($3, admin_note), updated_at = NOW()
          WHERE id = $1 AND category = ANY($4::text[]) AND deleted_at IS NULL RETURNING *
        `, [id, req.user.id, note, categories]);
      } else {
        const status = action === 'reopen' ? 'pending' : action === 'resolve' || action === 'close' ? 'closed' : 'closed';
        result = await client.query(`
          UPDATE support_tickets
          SET status = $2, admin_note = COALESCE($3, admin_note),
              deleted_at = CASE WHEN $5 THEN NULL ELSE deleted_at END,
              deleted_by = CASE WHEN $5 THEN NULL ELSE deleted_by END,
              updated_at = NOW()
          WHERE id = $1 AND category = ANY($4::text[]) RETURNING *
        `, [id, status, note, categories, action === 'reopen']);
      }
    } else {
      const status = action === 'resolve'
        ? 'resolved'
        : action === 'reopen'
          ? 'pending'
          : action === 'close'
            ? 'closed'
            : action === 'archive'
              ? 'archived'
              : 'dismissed';
      result = await client.query(`
        UPDATE contact_submissions
        SET status = $2, admin_note = COALESCE($3, admin_note),
            resolved_by = CASE WHEN $2 = 'pending' THEN NULL ELSE $4 END,
            resolved_at = CASE WHEN $2 = 'pending' THEN NULL ELSE NOW() END,
            updated_at = NOW()
        WHERE id = $1 RETURNING *
      `, [id, status, note, req.user.id]);
    }

    if (!result?.rows?.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    }
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], affected: result.rowCount });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Report center action error:', error);
    res.status(500).json({ success: false, message: 'Không xử lý được báo cáo.' });
  } finally {
    client.release();
  }
};

