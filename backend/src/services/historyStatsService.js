/**
 * HISTORY STATISTICS SERVICE
 * Thống kê chi tiết cho trang lịch sử thi
 */

const { pool } = require("../config/database");

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Lấy tất cả thống kê chi tiết cho trang thống kê lịch sử thi
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getHistoryStats(userId) {
  const client = await pool.connect();
  try {
    // 1. Thống kê tổng quan
    const overviewStats = await getOverviewStats(client, userId);

    // 2. Phân bố điểm số (histogram)
    const scoreDistribution = await getScoreDistribution(client, userId);

    // 3. Thống kê theo môn học
    const subjectStats = await getSubjectStats(client, userId);

    // 4. Thống kê theo độ khó
    const difficultyStats = await getDifficultyStats(client, userId);

    // 5. Xu hướng điểm số theo tháng
    const monthlyTrend = await getMonthlyTrend(client, userId);

    // 6. Thống kê thời gian
    const timeStats = await getTimeStats(client, userId);

    // 7. Tỷ lệ pass/fail
    const passFailStats = await getPassFailStats(client, userId);

    // 8. Điểm số gần đây nhất
    const recentAttempts = await getRecentAttempts(client, userId, 20);

    // 9. So sánh giữa các lần thi
    const improvementStats = await getImprovementStats(client, userId);

    return {
      overview: overviewStats,
      scoreDistribution,
      subjects: subjectStats,
      difficulties: difficultyStats,
      monthlyTrend,
      timeStats,
      passFail: passFailStats,
      recentAttempts,
      improvement: improvementStats,
    };
  } finally {
    client.release();
  }
}

async function getOverviewStats(client, userId) {
  const query = `
    SELECT
      COUNT(*)::INTEGER as total_attempts,
      COUNT(DISTINCT ea.exam_id)::INTEGER as unique_exams,
      COUNT(DISTINCT DATE(ea.submit_time))::INTEGER as active_days,
      COALESCE(AVG(ea.total_score), 0)::DECIMAL as avg_score,
      COALESCE(MAX(ea.total_score), 0)::DECIMAL as max_score,
      COALESCE(MIN(ea.total_score), 0)::DECIMAL as min_score,
      COALESCE(
        AVG(ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100), 0
      )::DECIMAL as avg_percentage,
      COALESCE(
        SUM(ea.total_correct), 0
      )::INTEGER as total_correct,
      COALESCE(
        SUM(ea.total_incorrect), 0
      )::INTEGER as total_incorrect,
      COALESCE(
        SUM(ea.total_unanswered), 0
      )::INTEGER as total_unanswered,
      COALESCE(
        AVG(ea.duration_seconds), 0
      )::INTEGER as avg_duration_seconds,
      COALESCE(
        SUM(ea.duration_seconds), 0
      )::INTEGER as total_duration_seconds
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
  `;
  const result = await client.query(query, [userId]);
  const r = result.rows[0];

  return {
    totalAttempts: parseInt(r.total_attempts) || 0,
    uniqueExams: parseInt(r.unique_exams) || 0,
    activeDays: parseInt(r.active_days) || 0,
    avgScore: parseFloat(r.avg_score) || 0,
    maxScore: parseFloat(r.max_score) || 0,
    minScore: parseFloat(r.min_score) || 0,
    avgPercentage: parseFloat(r.avg_percentage) || 0,
    totalCorrect: parseInt(r.total_correct) || 0,
    totalIncorrect: parseInt(r.total_incorrect) || 0,
    totalUnanswered: parseInt(r.total_unanswered) || 0,
    avgDurationSeconds: parseInt(r.avg_duration_seconds) || 0,
    totalDurationSeconds: parseInt(r.total_duration_seconds) || 0,
  };
}

async function getScoreDistribution(client, userId) {
  // Phân bố điểm theo các khoảng: 0-2, 2-4, 4-6, 6-8, 8-10
  const query = `
    SELECT
      CASE
        WHEN ea.total_score < 2 THEN '0-2'
        WHEN ea.total_score < 4 THEN '2-4'
        WHEN ea.total_score < 6 THEN '4-6'
        WHEN ea.total_score < 8 THEN '6-8'
        WHEN ea.total_score <= 10 THEN '8-10'
        ELSE 'unknown'
      END as range_label,
      COUNT(*)::INTEGER as count,
      ROUND(
        COUNT(*)::DECIMAL / NULLIF(
          (SELECT COUNT(*) FROM exam_attempts WHERE user_id = $1 AND status = 'completed'), 0
        ) * 100, 1
      )::DECIMAL as percentage
    FROM exam_attempts ea
    WHERE ea.user_id = $1 AND ea.status = 'completed'
    GROUP BY 1
    ORDER BY
      CASE
        WHEN (CASE
          WHEN ea.total_score < 2 THEN '0-2'
          WHEN ea.total_score < 4 THEN '2-4'
          WHEN ea.total_score < 6 THEN '4-6'
          WHEN ea.total_score < 8 THEN '6-8'
          WHEN ea.total_score <= 10 THEN '8-10'
          ELSE 'unknown'
        END) = '0-2' THEN 1
        WHEN (CASE
          WHEN ea.total_score < 2 THEN '0-2'
          WHEN ea.total_score < 4 THEN '2-4'
          WHEN ea.total_score < 6 THEN '4-6'
          WHEN ea.total_score < 8 THEN '6-8'
          WHEN ea.total_score <= 10 THEN '8-10'
          ELSE 'unknown'
        END) = '2-4' THEN 2
        WHEN (CASE
          WHEN ea.total_score < 2 THEN '0-2'
          WHEN ea.total_score < 4 THEN '2-4'
          WHEN ea.total_score < 6 THEN '4-6'
          WHEN ea.total_score < 8 THEN '6-8'
          WHEN ea.total_score <= 10 THEN '8-10'
          ELSE 'unknown'
        END) = '4-6' THEN 3
        WHEN (CASE
          WHEN ea.total_score < 2 THEN '0-2'
          WHEN ea.total_score < 4 THEN '2-4'
          WHEN ea.total_score < 6 THEN '4-6'
          WHEN ea.total_score < 8 THEN '6-8'
          WHEN ea.total_score <= 10 THEN '8-10'
          ELSE 'unknown'
        END) = '6-8' THEN 4
        WHEN (CASE
          WHEN ea.total_score < 2 THEN '0-2'
          WHEN ea.total_score < 4 THEN '2-4'
          WHEN ea.total_score < 6 THEN '4-6'
          WHEN ea.total_score < 8 THEN '6-8'
          WHEN ea.total_score <= 10 THEN '8-10'
          ELSE 'unknown'
        END) = '8-10' THEN 5
      END
  `;
  const result = await client.query(query, [userId]);

  // Ensure all ranges exist
  const allRanges = ['0-2', '2-4', '4-6', '6-8', '8-10'];
  const rangeMap = {};
  for (const row of result.rows) {
    rangeMap[row.range_label] = {
      count: parseInt(row.count) || 0,
      percentage: parseFloat(row.percentage) || 0,
    };
  }

  return allRanges.map(range => ({
    range,
    count: rangeMap[range]?.count || 0,
    percentage: rangeMap[range]?.percentage || 0,
  }));
}

async function getSubjectStats(client, userId) {
  const query = `
    SELECT
      s.id as subject_id,
      s.code as subject_code,
      s.name as subject_name,
      COUNT(ea.id)::INTEGER as attempt_count,
      COALESCE(AVG(ea.total_score), 0)::DECIMAL as avg_score,
      COALESCE(MAX(ea.total_score), 0)::DECIMAL as max_score,
      COALESCE(
        AVG(ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100), 0
      )::DECIMAL as avg_percentage,
      COALESCE(SUM(ea.total_correct), 0)::INTEGER as total_correct,
      COALESCE(SUM(ea.total_incorrect), 0)::INTEGER as total_incorrect,
      COALESCE(
        ROUND(
          COUNT(DISTINCT CASE WHEN
            ea.status = 'completed' AND
            ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
          THEN ea.id END)::DECIMAL /
          NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
        ), 0
      )::DECIMAL as pass_rate,
      COALESCE(AVG(ea.duration_seconds), 0)::INTEGER as avg_duration_seconds,
      COALESCE(
        SUM(ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100), 0
      )::DECIMAL as total_percentage_sum,
      (
        SELECT COALESCE(json_agg(ea2.total_score), '[]')
        FROM (
          SELECT ea2_inner.total_score
          FROM exam_attempts ea2_inner
          JOIN exams e2_inner ON ea2_inner.exam_id = e2_inner.id
          WHERE ea2_inner.user_id = $1 AND e2_inner.subject_id = s.id AND ea2_inner.status = 'completed'
          ORDER BY ea2_inner.submit_time DESC
          LIMIT 5
        ) ea2
      ) as recent_scores
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
    GROUP BY s.id, s.code, s.name
    ORDER BY attempt_count DESC
  `;
  const result = await client.query(query, [userId]);

  return result.rows.map(r => ({
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    subjectName: r.subject_name,
    attemptCount: parseInt(r.attempt_count) || 0,
    avgScore: parseFloat(r.avg_score) || 0,
    maxScore: parseFloat(r.max_score) || 0,
    avgPercentage: parseFloat(r.avg_percentage) || 0,
    totalCorrect: parseInt(r.total_correct) || 0,
    totalIncorrect: parseInt(r.total_incorrect) || 0,
    passRate: parseFloat(r.pass_rate) || 0,
    avgDurationSeconds: parseInt(r.avg_duration_seconds) || 0,
    recentScores: r.recent_scores || [],
    // Progress trend: compare last score vs first score
    progress: (r.recent_scores && r.recent_scores.length > 1)
      ? round2(r.recent_scores[0] - r.recent_scores[r.recent_scores.length - 1])
      : 0,
  }));
}

async function getDifficultyStats(client, userId) {
  const query = `
    SELECT
      e.difficulty_level,
      COUNT(DISTINCT ea.id)::INTEGER as attempt_count,
      COALESCE(
        AVG(CASE WHEN ea.status = 'completed'
          THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
        END), 0
      )::DECIMAL as avg_percentage,
      COALESCE(
        MAX(CASE WHEN ea.status = 'completed'
          THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
        END), 0
      )::DECIMAL as max_percentage,
      COALESCE(
        ROUND(
          COUNT(DISTINCT CASE WHEN
            ea.status = 'completed' AND
            ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
          THEN ea.id END)::DECIMAL /
          NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
        ), 0
      )::DECIMAL as pass_rate,
      COALESCE(AVG(ea.duration_seconds), 0)::INTEGER as avg_duration_seconds
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
      AND e.difficulty_level IS NOT NULL
    GROUP BY e.difficulty_level
    ORDER BY
      CASE e.difficulty_level
        WHEN 'easy' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'hard' THEN 3
        ELSE 4
      END
  `;
  const result = await client.query(query, [userId]);

  return result.rows.map(r => ({
    difficulty: r.difficulty_level,
    attemptCount: parseInt(r.attempt_count) || 0,
    avgPercentage: parseFloat(r.avg_percentage) || 0,
    maxPercentage: parseFloat(r.max_percentage) || 0,
    passRate: parseFloat(r.pass_rate) || 0,
    avgDurationSeconds: parseInt(r.avg_duration_seconds) || 0,
  }));
}

async function getMonthlyTrend(client, userId) {
  const query = `
    SELECT
      TO_CHAR(ea.submit_time, 'YYYY-MM') as month,
      TO_CHAR(ea.submit_time, 'MM/YYYY') as month_label,
      COUNT(*)::INTEGER as attempt_count,
      COALESCE(AVG(ea.total_score), 0)::DECIMAL as avg_score,
      COALESCE(
        AVG(ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100), 0
      )::DECIMAL as avg_percentage,
      COALESCE(MAX(ea.total_score), 0)::DECIMAL as max_score,
      COALESCE(
        SUM(ea.total_correct), 0
      )::INTEGER as total_correct,
      COALESCE(
        SUM(ea.total_incorrect), 0
      )::INTEGER as total_incorrect,
      COALESCE(
        ROUND(
          COUNT(DISTINCT CASE WHEN
            ea.status = 'completed' AND
            ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
          THEN ea.id END)::DECIMAL /
          NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
        ), 0
      )::DECIMAL as pass_rate
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
      AND ea.submit_time >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(ea.submit_time, 'YYYY-MM'), TO_CHAR(ea.submit_time, 'MM/YYYY')
    ORDER BY month ASC
  `;
  const result = await client.query(query, [userId]);

  return result.rows.map(r => ({
    month: r.month,
    monthLabel: r.month_label,
    attemptCount: parseInt(r.attempt_count) || 0,
    avgScore: parseFloat(r.avg_score) || 0,
    avgPercentage: parseFloat(r.avg_percentage) || 0,
    maxScore: parseFloat(r.max_score) || 0,
    totalCorrect: parseInt(r.total_correct) || 0,
    totalIncorrect: parseInt(r.total_incorrect) || 0,
    passRate: parseFloat(r.pass_rate) || 0,
  }));
}

async function getTimeStats(client, userId) {
  const query = `
    SELECT
      COALESCE(AVG(ea.duration_seconds), 0)::INTEGER as avg_duration_seconds,
      COALESCE(MAX(ea.duration_seconds), 0)::INTEGER as max_duration_seconds,
      COALESCE(MIN(ea.duration_seconds), 0)::INTEGER as min_duration_seconds,
      COALESCE(
        AVG(ea.duration_seconds::DECIMAL / NULLIF(e.total_questions, 0)), 0
      )::DECIMAL as avg_seconds_per_question,
      -- So sánh với thời gian cho phép
      COALESCE(
        AVG(
          CASE WHEN e.duration > 0
          THEN ea.duration_seconds::DECIMAL / NULLIF(e.duration * 60, 0) * 100
          ELSE NULL
          END
        ), 0
      )::DECIMAL as avg_time_used_percent,
      -- Câu hỏi đúng vs sai: thời gian trung bình
      COALESCE(
        AVG(ua.time_spent_seconds) FILTER (WHERE ua.is_correct = true), 0
      )::DECIMAL as correct_avg_seconds,
      COALESCE(
        AVG(ua.time_spent_seconds) FILTER (WHERE ua.is_correct = false), 0
      )::DECIMAL as incorrect_avg_seconds
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    LEFT JOIN user_answers ua ON ea.id = ua.attempt_id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
  `;
  const result = await client.query(query, [userId]);
  const r = result.rows[0];

  return {
    avgDurationSeconds: parseInt(r.avg_duration_seconds) || 0,
    maxDurationSeconds: parseInt(r.max_duration_seconds) || 0,
    minDurationSeconds: parseInt(r.min_duration_seconds) || 0,
    avgSecondsPerQuestion: parseFloat(r.avg_seconds_per_question) || 0,
    avgTimeUsedPercent: parseFloat(r.avg_time_used_percent) || 0,
    correctAvgSeconds: parseFloat(r.correct_avg_seconds) || 0,
    incorrectAvgSeconds: parseFloat(r.incorrect_avg_seconds) || 0,
  };
}

async function getPassFailStats(client, userId) {
  const query = `
    SELECT
      COUNT(CASE WHEN
        ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
      THEN 1 END)::INTEGER as pass_count,
      COUNT(CASE WHEN
        ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 < 60
      THEN 1 END)::INTEGER as fail_count,
      COUNT(*)::INTEGER as total_count,
      ROUND(
        COUNT(CASE WHEN
          ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
        THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1
      )::DECIMAL as pass_rate,
      ROUND(
        COUNT(CASE WHEN
          ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 80
        THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1
      )::DECIMAL as excellent_rate
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
  `;
  const result = await client.query(query, [userId]);
  const r = result.rows[0];

  return {
    passCount: parseInt(r.pass_count) || 0,
    failCount: parseInt(r.fail_count) || 0,
    totalCount: parseInt(r.total_count) || 0,
    passRate: parseFloat(r.pass_rate) || 0,
    excellentRate: parseFloat(r.excellent_rate) || 0,
  };
}

async function getRecentAttempts(client, userId, limit) {
  const query = `
    SELECT
      ea.id,
      ea.total_score as score,
      ea.total_correct,
      ea.total_incorrect,
      ea.total_unanswered,
      ea.duration_seconds,
      ea.submit_time,
      e.id as exam_id,
      e.title as exam_title,
      e.difficulty_level,
      s.name as subject_name,
      s.code as subject_code,
      e.total_questions,
      COALESCE(
        ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100, 0
      )::DECIMAL as percentage
    FROM exam_attempts ea
    JOIN exams e ON ea.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE ea.user_id = $1 AND ea.status = 'completed'
    ORDER BY ea.submit_time DESC
    LIMIT $2
  `;
  const result = await client.query(query, [userId, limit]);

  return result.rows.map(r => ({
    id: r.id,
    examId: r.exam_id,
    examTitle: r.exam_title,
    score: parseFloat(r.score) || 0,
    totalCorrect: parseInt(r.total_correct) || 0,
    totalIncorrect: parseInt(r.total_incorrect) || 0,
    totalUnanswered: parseInt(r.total_unanswered) || 0,
    totalQuestions: r.total_questions || 0,
    durationSeconds: parseInt(r.duration_seconds) || 0,
    percentage: parseFloat(r.percentage) || 0,
    difficultyLevel: r.difficulty_level,
    subjectName: r.subject_name,
    subjectCode: r.subject_code,
    submitTime: r.submit_time,
  }));
}

async function getImprovementStats(client, userId) {
  const query = `
    WITH ranked AS (
      SELECT
        ea.total_score as score,
        ea.submit_time,
        e.difficulty_level,
        ROW_NUMBER() OVER (ORDER BY ea.submit_time ASC) as rn_asc,
        ROW_NUMBER() OVER (ORDER BY ea.submit_time DESC) as rn_desc,
        COUNT(*) OVER () as total_count
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
    ),
    first_half AS (
      SELECT AVG(score) as avg_score
      FROM ranked
      WHERE rn_asc <= CEIL(total_count::DECIMAL / 2)
    ),
    second_half AS (
      SELECT AVG(score) as avg_score
      FROM ranked
      WHERE rn_desc <= CEIL(total_count::DECIMAL / 2)
    )
    SELECT
      (SELECT avg_score FROM first_half) as first_half_avg,
      (SELECT avg_score FROM second_half) as second_half_avg
  `;
  const result = await client.query(query, [userId]);
  const r = result.rows[0];

  const firstHalf = parseFloat(r.first_half_avg) || 0;
  const secondHalf = parseFloat(r.second_half_avg) || 0;
  const improvement = round2(secondHalf - firstHalf);

  return {
    firstHalfAvg: firstHalf,
    secondHalfAvg: secondHalf,
    improvement,
    trend: improvement > 0.5 ? 'improving' : improvement < -0.5 ? 'declining' : 'stable',
  };
}

module.exports = { getHistoryStats };
