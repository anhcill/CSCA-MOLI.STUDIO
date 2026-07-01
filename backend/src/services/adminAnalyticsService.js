const db = require("../config/database");

const ALLOWED_EXPORTS = new Set(["users", "attempts", "results", "transactions"]);

function getRange(query = {}) {
  const params = [];
  const conditions = [];
  const addDateFilter = (column) => {
    const clauses = [];
    if (query.from) {
      params.push(query.from);
      clauses.push(`${column} >= $${params.length}`);
    }
    if (query.to) {
      params.push(`${query.to}T23:59:59.999Z`);
      clauses.push(`${column} <= $${params.length}`);
    }
    return clauses.length ? clauses.join(" AND ") : "TRUE";
  };

  return { params, conditions, addDateFilter };
}

function getGranularity(value) {
  return value === "month" ? "month" : "day";
}

function getBucketExpression() {
  return `
    CASE
      WHEN COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100) < 40 THEN '0-39'
      WHEN COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100) < 60 THEN '40-59'
      WHEN COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100) < 80 THEN '60-79'
      ELSE '80-100'
    END
  `;
}

function getSharedDateBounds(query = {}) {
  const params = [];
  let fromRef = null;
  let toRef = null;
  if (query.from) {
    params.push(query.from);
    fromRef = `$${params.length}`;
  }
  if (query.to) {
    params.push(`${query.to}T23:59:59.999Z`);
    toRef = `$${params.length}`;
  }

  const condition = (column) => {
    const clauses = [];
    if (fromRef) clauses.push(`${column} >= ${fromRef}`);
    if (toRef) clauses.push(`${column} <= ${toRef}`);
    return clauses.length ? clauses.join(" AND ") : "TRUE";
  };

  return { params, condition };
}

function getAdminAttributionCte() {
  return `
    admin_users AS (
      SELECT
        u.id,
        u.full_name,
        u.email,
        ARRAY_AGG(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL) AS admin_roles
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code IN ('super_admin', 'exam_admin')
         OR p.code IN ('*', 'exams.manage')
      GROUP BY u.id
    ),
    activity_exam_owner AS (
      SELECT DISTINCT ON (((ua.metadata::jsonb ->> 'examId')::int))
        ((ua.metadata::jsonb ->> 'examId')::int) AS exam_id,
        ua.user_id AS admin_id
      FROM user_activities ua
      WHERE ua.action = 'admin.create_exam'
        AND ua.metadata IS NOT NULL
        AND (ua.metadata::jsonb ->> 'examId') ~ '^[0-9]+$'
      ORDER BY ((ua.metadata::jsonb ->> 'examId')::int), ua.created_at ASC
    ),
    exam_admin_map AS (
      SELECT
        e.id AS exam_id,
        COALESCE(e.created_by, aeo.admin_id) AS admin_id
      FROM exams e
      LEFT JOIN activity_exam_owner aeo ON aeo.exam_id = e.id
    )
  `;
}

async function getRevenueSeries(query) {
  const granularity = getGranularity(query.granularity);
  const range = getRange(query);
  const dateFilter = range.addDateFilter("COALESCE(t.paid_at, t.created_at)");

  const result = await db.query(
    `
      SELECT
        to_char(date_trunc('${granularity}', COALESCE(t.paid_at, t.created_at)), $${range.params.length + 1}) AS period,
        COALESCE(SUM(t.amount), 0)::bigint AS revenue,
        COUNT(*)::int AS transactions
      FROM transactions t
      WHERE t.status = 'completed'
        AND ${dateFilter}
      GROUP BY date_trunc('${granularity}', COALESCE(t.paid_at, t.created_at))
      ORDER BY date_trunc('${granularity}', COALESCE(t.paid_at, t.created_at))
    `,
    [...range.params, granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD"],
  );

  return result.rows.map((row) => ({
    period: row.period,
    revenue: Number(row.revenue || 0),
    transactions: Number(row.transactions || 0),
  }));
}

async function getCompletionStats(query) {
  const range = getRange(query);
  const dateFilter = range.addDateFilter("ea.created_at");

  const overview = await db.query(
    `
      SELECT
        COUNT(*)::int AS total_attempts,
        COUNT(*) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
        COUNT(DISTINCT ea.user_id)::int AS unique_users,
        ROUND(
          COUNT(*) FILTER (WHERE ea.status = 'completed')::decimal / NULLIF(COUNT(*), 0) * 100,
          2
        ) AS completion_rate
      FROM exam_attempts ea
      WHERE ${dateFilter}
    `,
    range.params,
  );

  const bySubject = await db.query(
    `
      SELECT
        s.id AS subject_id,
        s.code AS subject_code,
        s.name AS subject_name,
        COUNT(*)::int AS total_attempts,
        COUNT(*) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
        ROUND(
          COUNT(*) FILTER (WHERE ea.status = 'completed')::decimal / NULLIF(COUNT(*), 0) * 100,
          2
        ) AS completion_rate
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      JOIN subjects s ON s.id = e.subject_id
      WHERE e.deleted_at IS NULL
        AND ${dateFilter}
      GROUP BY s.id
      ORDER BY total_attempts DESC
    `,
    range.params,
  );

  return {
    overview: {
      totalAttempts: Number(overview.rows[0]?.total_attempts || 0),
      completedAttempts: Number(overview.rows[0]?.completed_attempts || 0),
      uniqueUsers: Number(overview.rows[0]?.unique_users || 0),
      completionRate: Number(overview.rows[0]?.completion_rate || 0),
    },
    bySubject: bySubject.rows.map((row) => ({
      subjectId: row.subject_id,
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      totalAttempts: Number(row.total_attempts || 0),
      completedAttempts: Number(row.completed_attempts || 0),
      completionRate: Number(row.completion_rate || 0),
    })),
  };
}

async function getScoreDistribution(query) {
  const range = getRange(query);
  const dateFilter = range.addDateFilter("ea.submit_time");
  const bucketExpr = getBucketExpression();

  const result = await db.query(
    `
      SELECT
        s.code AS subject_code,
        s.name AS subject_name,
        ${bucketExpr} AS bucket,
        COUNT(*)::int AS count
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      JOIN subjects s ON s.id = e.subject_id
      WHERE ea.status = 'completed'
        AND ea.total_score IS NOT NULL
        AND ${dateFilter}
      GROUP BY s.code, s.name, bucket
      ORDER BY s.name, bucket
    `,
    range.params,
  );

  const bySubject = new Map();
  for (const row of result.rows) {
    if (!bySubject.has(row.subject_code)) {
      bySubject.set(row.subject_code, {
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        buckets: { "0-39": 0, "40-59": 0, "60-79": 0, "80-100": 0 },
      });
    }
    bySubject.get(row.subject_code).buckets[row.bucket] = Number(row.count || 0);
  }
  return Array.from(bySubject.values());
}

async function getTopWrongQuestions(query, limit = 20) {
  const range = getRange(query);
  const dateFilter = range.addDateFilter("ea.submit_time");
  let examFilter = "";
  if (query.examId) {
    range.params.push(Number(query.examId));
    examFilter = ` AND e.id = $${range.params.length}`;
  }
  range.params.push(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100));

  const result = await db.query(
    `
      SELECT
        q.id AS question_id,
        q.question_number,
        q.question_text,
        q.difficulty,
        e.id AS exam_id,
        e.title AS exam_title,
        s.name AS subject_name,
        COUNT(ua.id)::int AS answered_count,
        COUNT(ua.id) FILTER (WHERE ua.is_correct = FALSE)::int AS wrong_count,
        ROUND(
          COUNT(ua.id) FILTER (WHERE ua.is_correct = FALSE)::decimal / NULLIF(COUNT(ua.id), 0) * 100,
          2
        ) AS wrong_rate
      FROM user_answers ua
      JOIN exam_attempts ea ON ea.id = ua.attempt_id
      JOIN questions q ON q.id = ua.question_id
      JOIN exams e ON e.id = q.exam_id
      JOIN subjects s ON s.id = e.subject_id
      WHERE ea.status = 'completed'
        AND e.deleted_at IS NULL
        AND ${dateFilter}
        ${examFilter}
      GROUP BY q.id, e.id, s.id
      HAVING COUNT(ua.id) FILTER (WHERE ua.is_correct = FALSE) > 0
      ORDER BY wrong_count DESC, wrong_rate DESC
      LIMIT $${range.params.length}
    `,
    range.params,
  );

  return result.rows.map((row) => ({
    questionId: row.question_id,
    questionNumber: row.question_number,
    questionText: row.question_text,
    difficulty: row.difficulty,
    examId: row.exam_id,
    examTitle: row.exam_title,
    subjectName: row.subject_name,
    answeredCount: Number(row.answered_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    wrongRate: Number(row.wrong_rate || 0),
  }));
}

async function getExamReports(query) {
  const range = getRange(query);
  const dateFilter = range.addDateFilter("ea.created_at");

  const result = await db.query(
    `
      SELECT
        e.id AS exam_id,
        e.title AS exam_title,
        s.name AS subject_name,
        e.total_questions,
        COUNT(ea.id)::int AS total_attempts,
        COUNT(ea.id) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
        COUNT(DISTINCT ea.user_id)::int AS participants,
        ROUND(COUNT(ea.id) FILTER (WHERE ea.status = 'completed')::decimal / NULLIF(COUNT(ea.id), 0) * 100, 2) AS completion_rate,
        ROUND(AVG(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS avg_percentage,
        ROUND(MAX(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS max_percentage,
        ROUND(MIN(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS min_percentage
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ${dateFilter}
      WHERE e.deleted_at IS NULL
      GROUP BY e.id, s.id
      HAVING COUNT(ea.id) > 0
      ORDER BY total_attempts DESC, avg_percentage ASC NULLS LAST
      LIMIT 50
    `,
    range.params,
  );

  return result.rows.map((row) => ({
    examId: row.exam_id,
    examTitle: row.exam_title,
    subjectName: row.subject_name,
    totalQuestions: Number(row.total_questions || 0),
    totalAttempts: Number(row.total_attempts || 0),
    completedAttempts: Number(row.completed_attempts || 0),
    participants: Number(row.participants || 0),
    completionRate: Number(row.completion_rate || 0),
    avgPercentage: Number(row.avg_percentage || 0),
    maxPercentage: Number(row.max_percentage || 0),
    minPercentage: Number(row.min_percentage || 0),
  }));
}

async function getAdminPerformance(query = {}) {
  const bounds = getSharedDateBounds(query);
  const granularity = getGranularity(query.granularity);
  const format = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const examDateFilter = bounds.condition("e.created_at");
  const questionExamDateFilter = bounds.condition("e.created_at");
  const attemptDateFilter = bounds.condition("ea.created_at");
  const deletedDateFilter = bounds.condition("e.deleted_at");
  const requestDateFilter = bounds.condition("e.delete_requested_at");
  const activityDateFilter = bounds.condition("ua.created_at");
  const adminAttributionCte = getAdminAttributionCte();

  const [overview, leaderboard, timeline, recentActivity, deletionRequests, topExams, adminSubjects] = await Promise.all([
    db.query(
      `
        WITH ${adminAttributionCte}
        SELECT
          (SELECT COUNT(DISTINCT id)::int FROM admin_users) AS admins_count,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND ${examDateFilter})::int AS exams_created,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND ${examDateFilter} AND e.status = 'published')::int AS published_exams,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND ${examDateFilter} AND e.status = 'draft')::int AS draft_exams,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND ${examDateFilter} AND e.status = 'archived')::int AS archived_exams,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND e.deleted_at IS NOT NULL AND ${deletedDateFilter})::int AS soft_deleted_exams,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NOT NULL AND e.deletion_status = 'requested' AND ${requestDateFilter})::int AS delete_requests,
          COUNT(DISTINCT e.id) FILTER (WHERE eam.admin_id IS NULL AND ${examDateFilter})::int AS unattributed_exams
        FROM exams e
        LEFT JOIN exam_admin_map eam ON eam.exam_id = e.id
      `,
      bounds.params,
    ),
    db.query(
      `
        WITH ${adminAttributionCte},
        exam_metrics AS (
          SELECT
            eam.admin_id,
            COUNT(*)::int AS exams_created,
            COUNT(*) FILTER (WHERE e.status = 'published')::int AS published_exams,
            COUNT(*) FILTER (WHERE e.status = 'draft')::int AS draft_exams,
            COUNT(*) FILTER (WHERE e.status = 'archived')::int AS archived_exams,
            COUNT(*) FILTER (WHERE e.deleted_at IS NOT NULL)::int AS soft_deleted_exams,
            COUNT(*) FILTER (WHERE e.deletion_status = 'requested')::int AS delete_requests
          FROM exams e
          JOIN exam_admin_map eam ON eam.exam_id = e.id
          WHERE eam.admin_id IS NOT NULL
            AND ${examDateFilter}
          GROUP BY eam.admin_id
        ),
        question_metrics AS (
          SELECT eam.admin_id, COUNT(DISTINCT q.id)::int AS questions_created
          FROM exams e
          JOIN exam_admin_map eam ON eam.exam_id = e.id
          JOIN questions q ON q.exam_id = e.id AND q.question_number > 0 AND q.deleted_at IS NULL
          WHERE eam.admin_id IS NOT NULL
            AND ${questionExamDateFilter}
          GROUP BY eam.admin_id
        ),
        attempt_metrics AS (
          SELECT
            eam.admin_id,
            COUNT(DISTINCT ea.id)::int AS total_attempts,
            COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
            COUNT(DISTINCT ea.user_id)::int AS unique_students,
            ROUND(COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'completed')::decimal / NULLIF(COUNT(DISTINCT ea.id), 0) * 100, 2) AS completion_rate,
            ROUND(AVG(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS avg_percentage
          FROM exams e
          JOIN exam_admin_map eam ON eam.exam_id = e.id
          JOIN exam_attempts ea ON ea.exam_id = e.id
          WHERE eam.admin_id IS NOT NULL
            AND ${attemptDateFilter}
          GROUP BY eam.admin_id
        ),
        activity_metrics AS (
          SELECT
            ua.user_id AS admin_id,
            COUNT(*) FILTER (WHERE ua.action = 'admin.create_exam')::int AS create_actions,
            COUNT(*) FILTER (WHERE ua.action IN ('admin.update_exam', 'admin.update_question', 'admin.add_question', 'admin.insert_question', 'admin.insert_fill_blank_group', 'admin.insert_reading_passage_group'))::int AS update_actions,
            COUNT(*) FILTER (WHERE ua.action IN ('admin.soft_delete_exam', 'admin.request_delete_exam', 'admin.delete_exam'))::int AS delete_actions
          FROM user_activities ua
          WHERE ${activityDateFilter}
          GROUP BY ua.user_id
        )
        SELECT
          au.id AS admin_id,
          au.full_name AS admin_name,
          au.email,
          COALESCE(au.admin_roles, ARRAY[]::varchar[]) AS admin_roles,
          COALESCE(em.exams_created, 0)::int AS exams_created,
          COALESCE(em.published_exams, 0)::int AS published_exams,
          COALESCE(em.draft_exams, 0)::int AS draft_exams,
          COALESCE(em.archived_exams, 0)::int AS archived_exams,
          COALESCE(em.soft_deleted_exams, 0)::int AS soft_deleted_exams,
          COALESCE(em.delete_requests, 0)::int AS delete_requests,
          COALESCE(qm.questions_created, 0)::int AS questions_created,
          COALESCE(am.total_attempts, 0)::int AS total_attempts,
          COALESCE(am.completed_attempts, 0)::int AS completed_attempts,
          COALESCE(am.unique_students, 0)::int AS unique_students,
          COALESCE(am.completion_rate, 0)::decimal AS completion_rate,
          COALESCE(am.avg_percentage, 0)::decimal AS avg_percentage,
          COALESCE(act.create_actions, 0)::int AS create_actions,
          COALESCE(act.update_actions, 0)::int AS update_actions,
          COALESCE(act.delete_actions, 0)::int AS delete_actions
        FROM admin_users au
        LEFT JOIN exam_metrics em ON em.admin_id = au.id
        LEFT JOIN question_metrics qm ON qm.admin_id = au.id
        LEFT JOIN attempt_metrics am ON am.admin_id = au.id
        LEFT JOIN activity_metrics act ON act.admin_id = au.id
        ORDER BY
          (COALESCE(em.published_exams, 0) * 15
           + COALESCE(qm.questions_created, 0) * 0.3
           + COALESCE(am.completed_attempts, 0) * 0.5
           + COALESCE(am.unique_students, 0)
           - COALESCE(em.delete_requests, 0) * 10
           - COALESCE(em.soft_deleted_exams, 0) * 5) DESC,
          COALESCE(em.exams_created, 0) DESC
      `,
      bounds.params,
    ),
    db.query(
      `
        WITH ${adminAttributionCte}
        SELECT
          to_char(date_trunc('${granularity}', e.created_at), $${bounds.params.length + 1}) AS period,
          COUNT(*)::int AS exams_created,
          COUNT(*) FILTER (WHERE e.status = 'published')::int AS published_exams,
          COUNT(*) FILTER (WHERE e.deleted_at IS NOT NULL)::int AS soft_deleted_exams,
          COUNT(*) FILTER (WHERE e.deletion_status = 'requested')::int AS delete_requests
        FROM exams e
        JOIN exam_admin_map eam ON eam.exam_id = e.id
        WHERE eam.admin_id IS NOT NULL
          AND ${examDateFilter}
        GROUP BY date_trunc('${granularity}', e.created_at)
        ORDER BY date_trunc('${granularity}', e.created_at)
      `,
      [...bounds.params, format],
    ),
    db.query(
      `
        SELECT
          ua.id,
          ua.user_id AS admin_id,
          u.full_name AS admin_name,
          ua.action,
          ua.metadata,
          ua.ip_address,
          ua.created_at
        FROM user_activities ua
        JOIN users u ON u.id = ua.user_id
        WHERE ua.action LIKE 'admin.%'
          AND ${activityDateFilter}
        ORDER BY ua.created_at DESC
        LIMIT 30
      `,
      bounds.params,
    ),
    db.query(
      `
        SELECT
          e.id,
          e.title,
          e.status,
          e.deletion_status,
          e.deleted_at,
          e.delete_reason,
          e.delete_requested_at,
          e.delete_request_reason,
          requester.full_name AS requested_by_name,
          deleter.full_name AS deleted_by_name
        FROM exams e
        LEFT JOIN users requester ON requester.id = e.delete_requested_by
        LEFT JOIN users deleter ON deleter.id = e.deleted_by
        WHERE (
            e.deletion_status = 'requested'
            OR e.deleted_at IS NOT NULL
          )
          AND (
            ${requestDateFilter}
            OR ${deletedDateFilter}
          )
        ORDER BY COALESCE(e.delete_requested_at, e.deleted_at) DESC
        LIMIT 50
      `,
      bounds.params,
    ),
    db.query(
      `
        WITH ${adminAttributionCte}
        SELECT
          e.id AS exam_id,
          e.title AS exam_title,
          s.name AS subject_name,
          u.full_name AS admin_name,
          COUNT(DISTINCT ea.id)::int AS total_attempts,
          COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
          COUNT(DISTINCT ea.user_id)::int AS unique_students,
          ROUND(AVG(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS avg_percentage
        FROM exams e
        JOIN exam_admin_map eam ON eam.exam_id = e.id
        JOIN users u ON u.id = eam.admin_id
        LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ${attemptDateFilter}
        WHERE eam.admin_id IS NOT NULL
          AND e.deleted_at IS NULL
        GROUP BY e.id, s.id, u.id
        HAVING COUNT(DISTINCT ea.id) > 0
        ORDER BY total_attempts DESC, completed_attempts DESC
        LIMIT 20
      `,
      bounds.params,
    ),
    db.query(
      `
        WITH ${adminAttributionCte}
        SELECT
          u.id AS admin_id,
          u.full_name AS admin_name,
          u.email,
          s.id AS subject_id,
          COALESCE(s.name, 'Chưa rõ môn') AS subject_name,
          COUNT(DISTINCT e.id)::int AS exams_count,
          COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'published')::int AS published_exams,
          COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'draft')::int AS draft_exams,
          COALESCE(SUM(e.total_questions), 0)::int AS total_questions,
          COALESCE(SUM(attempts.completed_attempts), 0)::int AS completed_attempts,
          ARRAY_AGG(e.title ORDER BY e.created_at DESC) AS exam_titles
        FROM exams e
        JOIN exam_admin_map eam ON eam.exam_id = e.id
        JOIN users u ON u.id = eam.admin_id
        LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS completed_attempts
          FROM exam_attempts ea
          WHERE ea.exam_id = e.id
            AND ea.status = 'completed'
            AND ${attemptDateFilter}
        ) attempts ON TRUE
        WHERE eam.admin_id IS NOT NULL
          AND ${examDateFilter}
        GROUP BY u.id, s.id, s.name
        ORDER BY u.full_name ASC, exams_count DESC, subject_name ASC
      `,
      bounds.params,
    ),
  ]);

  const rows = leaderboard.rows.map((row) => {
    const impactScore = Math.round(
      Number(row.published_exams || 0) * 15
      + Number(row.questions_created || 0) * 0.3
      + Number(row.completed_attempts || 0) * 0.5
      + Number(row.unique_students || 0)
      - Number(row.delete_requests || 0) * 10
      - Number(row.soft_deleted_exams || 0) * 5,
    );
    return {
      adminId: row.admin_id,
      adminName: row.admin_name || `Admin #${row.admin_id}`,
      email: row.email,
      adminRoles: row.admin_roles || [],
      examsCreated: Number(row.exams_created || 0),
      publishedExams: Number(row.published_exams || 0),
      draftExams: Number(row.draft_exams || 0),
      archivedExams: Number(row.archived_exams || 0),
      softDeletedExams: Number(row.soft_deleted_exams || 0),
      deleteRequests: Number(row.delete_requests || 0),
      questionsCreated: Number(row.questions_created || 0),
      totalAttempts: Number(row.total_attempts || 0),
      completedAttempts: Number(row.completed_attempts || 0),
      uniqueStudents: Number(row.unique_students || 0),
      completionRate: Number(row.completion_rate || 0),
      avgPercentage: Number(row.avg_percentage || 0),
      createActions: Number(row.create_actions || 0),
      updateActions: Number(row.update_actions || 0),
      deleteActions: Number(row.delete_actions || 0),
      impactScore,
    };
  });

  const overviewRow = overview.rows[0] || {};
  return {
    overview: {
      adminsCount: Number(overviewRow.admins_count || 0),
      examsCreated: Number(overviewRow.exams_created || 0),
      publishedExams: Number(overviewRow.published_exams || 0),
      draftExams: Number(overviewRow.draft_exams || 0),
      archivedExams: Number(overviewRow.archived_exams || 0),
      softDeletedExams: Number(overviewRow.soft_deleted_exams || 0),
      deleteRequests: Number(overviewRow.delete_requests || 0),
      unattributedExams: Number(overviewRow.unattributed_exams || 0),
      questionsCreated: rows.reduce((sum, row) => sum + row.questionsCreated, 0),
      completedAttempts: rows.reduce((sum, row) => sum + row.completedAttempts, 0),
    },
    leaderboard: rows,
    timeline: timeline.rows.map((row) => ({
      period: row.period,
      examsCreated: Number(row.exams_created || 0),
      publishedExams: Number(row.published_exams || 0),
      softDeletedExams: Number(row.soft_deleted_exams || 0),
      deleteRequests: Number(row.delete_requests || 0),
    })),
    recentActivity: recentActivity.rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminName: row.admin_name,
      action: row.action,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    })),
    deletionRequests: deletionRequests.rows.map((row) => ({
      examId: row.id,
      title: row.title,
      status: row.status,
      deletionStatus: row.deletion_status,
      deletedAt: row.deleted_at,
      deleteReason: row.delete_reason,
      deleteRequestedAt: row.delete_requested_at,
      deleteRequestReason: row.delete_request_reason,
      requestedByName: row.requested_by_name,
      deletedByName: row.deleted_by_name,
    })),
    topExams: topExams.rows.map((row) => ({
      examId: row.exam_id,
      examTitle: row.exam_title,
      subjectName: row.subject_name,
      adminName: row.admin_name,
      totalAttempts: Number(row.total_attempts || 0),
      completedAttempts: Number(row.completed_attempts || 0),
      uniqueStudents: Number(row.unique_students || 0),
      avgPercentage: Number(row.avg_percentage || 0),
    })),
    adminSubjects: adminSubjects.rows.map((row) => ({
      adminId: row.admin_id,
      adminName: row.admin_name || `Admin #${row.admin_id}`,
      email: row.email,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      examsCount: Number(row.exams_count || 0),
      publishedExams: Number(row.published_exams || 0),
      draftExams: Number(row.draft_exams || 0),
      totalQuestions: Number(row.total_questions || 0),
      completedAttempts: Number(row.completed_attempts || 0),
      examTitles: row.exam_titles || [],
    })),
  };
}

async function getExamReport(examId, query) {
  const params = [Number(examId)];
  const attemptClauses = ["ea.exam_id = $1"];
  if (query.from) {
    params.push(query.from);
    attemptClauses.push(`ea.created_at >= $${params.length}`);
  }
  if (query.to) {
    params.push(`${query.to}T23:59:59.999Z`);
    attemptClauses.push(`ea.created_at <= $${params.length}`);
  }
  const attemptWhere = attemptClauses.join(" AND ");

  const summary = await db.query(
    `
      SELECT
        e.id AS exam_id,
        e.title AS exam_title,
        s.name AS subject_name,
        e.total_questions,
        e.duration,
        COUNT(ea.id)::int AS total_attempts,
        COUNT(ea.id) FILTER (WHERE ea.status = 'completed')::int AS completed_attempts,
        COUNT(DISTINCT ea.user_id)::int AS participants,
        ROUND(COUNT(ea.id) FILTER (WHERE ea.status = 'completed')::decimal / NULLIF(COUNT(ea.id), 0) * 100, 2) AS completion_rate,
        ROUND(AVG(COALESCE(ea.score_percentage, ea.total_score / NULLIF(e.total_points, 0) * 100)) FILTER (WHERE ea.status = 'completed'), 2) AS avg_percentage
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
        ${query.from ? `AND ea.created_at >= $2` : ""}
        ${query.to ? `AND ea.created_at <= $${query.from ? 3 : 2}` : ""}
      WHERE e.id = $1 AND e.deleted_at IS NULL
      GROUP BY e.id, s.id
    `,
    params,
  );

  const bucketExpr = getBucketExpression();
  const [questionStats, scoreBuckets, daily] = await Promise.all([
    getTopWrongQuestions({ ...query, examId }, 20),
    db.query(
      `
        SELECT ${bucketExpr} AS bucket, COUNT(*)::int AS count
        FROM exam_attempts ea
        JOIN exams e ON e.id = ea.exam_id
        WHERE ${attemptWhere}
          AND e.deleted_at IS NULL
          AND ea.status = 'completed'
          AND ea.total_score IS NOT NULL
        GROUP BY bucket
        ORDER BY bucket
      `,
      params,
    ),
    db.query(
      `
        SELECT to_char(date_trunc('day', ea.created_at), 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS attempts,
               COUNT(*) FILTER (WHERE ea.status = 'completed')::int AS completed
        FROM exam_attempts ea
        WHERE ${attemptWhere}
        GROUP BY date_trunc('day', ea.created_at)
        ORDER BY date_trunc('day', ea.created_at)
      `,
      params,
    ),
  ]);

  return {
    summary: summary.rows[0] || null,
    scoreBuckets: scoreBuckets.rows,
    attemptsByDay: daily.rows,
    topWrongQuestions: questionStats,
  };
}

async function getAnalytics(query = {}) {
  const [revenue, completion, scoreDistribution, topWrongQuestions, examReports] = await Promise.all([
    getRevenueSeries(query),
    getCompletionStats(query),
    getScoreDistribution(query),
    getTopWrongQuestions(query, 15),
    getExamReports(query),
  ]);

  return {
    revenue,
    completion,
    scoreDistribution,
    topWrongQuestions,
    examReports,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/\r?\n/g, " ");
  if (/[",;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows, columns) {
  const header = columns.map((col) => csvEscape(col.label)).join(",");
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col.key])).join(","));
  return `\uFEFF${[header, ...body].join("\n")}`;
}

async function exportDataset(dataset, query = {}) {
  if (!ALLOWED_EXPORTS.has(dataset)) {
    const error = new Error("Unsupported export dataset");
    error.statusCode = 400;
    throw error;
  }

  const range = getRange(query);
  let rows;
  let columns;
  let filename = `${dataset}.csv`;

  if (dataset === "users") {
    const dateFilter = range.addDateFilter("u.created_at");
    const result = await db.query(
      `
        SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.is_vip,
               COALESCE(u.subscription_tier, 'basic') AS subscription_tier,
               u.vip_expires_at, u.created_at,
               COUNT(ea.id)::int AS total_attempts,
               ROUND(AVG(ea.total_score), 2) AS avg_score
        FROM users u
        LEFT JOIN exam_attempts ea ON ea.user_id = u.id AND ea.status = 'completed'
        WHERE ${dateFilter}
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `,
      range.params,
    );
    rows = result.rows;
    columns = [
      { key: "id", label: "ID" },
      { key: "email", label: "Email" },
      { key: "full_name", label: "Full name" },
      { key: "role", label: "Role" },
      { key: "is_active", label: "Active" },
      { key: "is_vip", label: "VIP" },
      { key: "subscription_tier", label: "Tier" },
      { key: "vip_expires_at", label: "VIP expires" },
      { key: "total_attempts", label: "Attempts" },
      { key: "avg_score", label: "Avg score" },
      { key: "created_at", label: "Created at" },
    ];
  }

  if (dataset === "attempts") {
    const dateFilter = range.addDateFilter("ea.created_at");
    const result = await db.query(
      `
        SELECT ea.id, ea.user_id, u.email, u.full_name, ea.exam_id, e.title AS exam_title,
               s.name AS subject_name, ea.attempt_number, ea.status, ea.total_score,
               ea.total_correct, ea.total_incorrect, ea.total_unanswered,
               ea.duration_seconds, ea.created_at, ea.submit_time
        FROM exam_attempts ea
        JOIN users u ON u.id = ea.user_id
        JOIN exams e ON e.id = ea.exam_id
        JOIN subjects s ON s.id = e.subject_id
        WHERE ${dateFilter}
        ORDER BY ea.created_at DESC
      `,
      range.params,
    );
    rows = result.rows;
    columns = [
      { key: "id", label: "Attempt ID" },
      { key: "user_id", label: "User ID" },
      { key: "email", label: "Email" },
      { key: "full_name", label: "Full name" },
      { key: "exam_id", label: "Exam ID" },
      { key: "exam_title", label: "Exam" },
      { key: "subject_name", label: "Subject" },
      { key: "attempt_number", label: "Attempt no" },
      { key: "status", label: "Status" },
      { key: "total_score", label: "Score" },
      { key: "total_correct", label: "Correct" },
      { key: "total_incorrect", label: "Incorrect" },
      { key: "total_unanswered", label: "Unanswered" },
      { key: "duration_seconds", label: "Duration seconds" },
      { key: "created_at", label: "Started at" },
      { key: "submit_time", label: "Submitted at" },
    ];
  }

  if (dataset === "results") {
    const dateFilter = range.addDateFilter("ea.submit_time");
    const result = await db.query(
      `
        SELECT ea.id AS attempt_id, u.email, u.full_name, e.title AS exam_title,
               q.id AS question_id, q.question_number, q.question_text,
               ua.selected_answer_key, ca.answer_key AS correct_answer_key,
               ua.is_correct, ua.time_spent_seconds, ea.submit_time
        FROM user_answers ua
        JOIN exam_attempts ea ON ea.id = ua.attempt_id
        JOIN users u ON u.id = ea.user_id
        JOIN exams e ON e.id = ea.exam_id
        JOIN questions q ON q.id = ua.question_id
        LEFT JOIN answers ca ON ca.question_id = q.id AND ca.is_correct = TRUE
        WHERE ea.status = 'completed'
          AND ${dateFilter}
        ORDER BY ea.submit_time DESC, q.question_number ASC
      `,
      range.params,
    );
    rows = result.rows;
    columns = [
      { key: "attempt_id", label: "Attempt ID" },
      { key: "email", label: "Email" },
      { key: "full_name", label: "Full name" },
      { key: "exam_title", label: "Exam" },
      { key: "question_id", label: "Question ID" },
      { key: "question_number", label: "Question no" },
      { key: "question_text", label: "Question" },
      { key: "selected_answer_key", label: "Selected" },
      { key: "correct_answer_key", label: "Correct" },
      { key: "is_correct", label: "Is correct" },
      { key: "time_spent_seconds", label: "Time seconds" },
      { key: "submit_time", label: "Submitted at" },
    ];
  }

  if (dataset === "transactions") {
    const dateFilter = range.addDateFilter("t.created_at");
    const result = await db.query(
      `
        SELECT t.id, t.user_id, u.email, u.full_name, t.amount, t.payment_method,
               t.package_name, t.package_duration, t.transaction_code, t.status,
               t.payment_channel, t.trans_id, t.paid_at, t.vip_expires_at, t.created_at
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE ${dateFilter}
        ORDER BY t.created_at DESC
      `,
      range.params,
    );
    rows = result.rows;
    columns = [
      { key: "id", label: "Transaction ID" },
      { key: "user_id", label: "User ID" },
      { key: "email", label: "Email" },
      { key: "full_name", label: "Full name" },
      { key: "amount", label: "Amount" },
      { key: "payment_method", label: "Payment method" },
      { key: "package_name", label: "Package" },
      { key: "package_duration", label: "Duration days" },
      { key: "transaction_code", label: "Code" },
      { key: "status", label: "Status" },
      { key: "payment_channel", label: "Channel" },
      { key: "trans_id", label: "Gateway ID" },
      { key: "paid_at", label: "Paid at" },
      { key: "vip_expires_at", label: "VIP expires" },
      { key: "created_at", label: "Created at" },
    ];
  }

  if (query.from || query.to) {
    filename = `${dataset}_${query.from || "start"}_${query.to || "now"}.csv`;
  }

  return { filename, csv: toCsv(rows, columns) };
}

module.exports = {
  getAnalytics,
  getAdminPerformance,
  getExamReport,
  exportDataset,
};
