/**
 * INSIGHT SERVICE
 * Phân tích học tập cá nhân hóa - hoàn toàn rule-based, không phụ thuộc AI API
 *
 * Database schema cần:
 * - exam_attempts (id, user_id, exam_id, total_score, total_correct, total_incorrect, duration_seconds, submit_time, status)
 * - user_answers (id, attempt_id, question_id, is_correct, time_spent_seconds)
 * - questions (id, exam_id, difficulty, question_category)
 * - exams (id, subject_id, title, difficulty_level, is_premium)
 * - subjects (id, code, name)
 * - question_topics (id, name)
 * - question_topic_mapping (question_id, topic_id)
 * - user_topic_stats (id, user_id, topic_id, total_questions, correct_answers, incorrect_answers, error_percentage)
 * - user_learning_insights (id, user_id, insight_type, category, priority, title, content, data)
 * - user_learning_patterns (id, user_id, metric_type, data)
 * - user_study_plans (id, user_id, plan_type, title, data, is_active)
 * - user_recommended_exams (id, user_id, exam_id, reason, priority)
 */

const { pool } = require("../config/database");

// ─── Utility helpers ──────────────────────────────────────────────────────────

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function pct(correct, total) {
  if (!total || total === 0) return 0;
  return round2((correct / total) * 100);
}

function avgScore(scores) {
  if (!scores || scores.length === 0) return 0;
  return round2(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function medianScore(scores) {
  if (!scores || scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── 1. OVERVIEW ──────────────────────────────────────────────────────────────

/**
 * Lấy tổng quan học tập của user
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getOverview(userId) {
  const client = await pool.connect();
  try {
    // Lấy stats tổng quan
    const overviewQuery = `
      SELECT
        COUNT(*)::INTEGER as total_exams,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_exams,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_correct ELSE 0 END), 0)::INTEGER as total_correct,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_incorrect ELSE 0 END), 0)::INTEGER as total_incorrect,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0)::INTEGER as total_time_seconds,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN total_score ELSE NULL END), 0)::DECIMAL as avg_score,
        COALESCE(MAX(total_score), 0)::DECIMAL as highest_score,
        COALESCE(MIN(CASE WHEN status = 'completed' THEN total_score ELSE NULL END), 0)::DECIMAL as lowest_score,
        COALESCE(
          AVG(CASE WHEN status = 'completed' THEN (total_correct::DECIMAL /
            NULLIF((SELECT total_questions FROM exams WHERE id = exam_id), 0) * 100
          END), 0
        )::DECIMAL as avg_percentage
      FROM exam_attempts
      WHERE user_id = $1
    `;
    const overviewResult = await client.query(overviewQuery, [userId]);
    const overview = overviewResult.rows[0];

    // Lấy điểm theo môn
    const subjectQuery = `
      SELECT
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name,
        COUNT(ea.id)::INTEGER as exam_count,
        COALESCE(AVG(ea.total_score), 0)::DECIMAL as avg_score,
        COALESCE(MAX(ea.total_score), 0)::DECIMAL as highest_score,
        COALESCE(
          AVG(ea.total_score / NULLIF(e.total_questions, 0) * 100), 0
        )::DECIMAL as avg_percentage,
        COALESCE(
          AVG(CASE WHEN ea.total_score IS NOT NULL THEN ea.total_score END), 0
        )::DECIMAL as latest_score
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      GROUP BY s.id, s.code, s.name
      ORDER BY avg_score DESC
    `;
    const subjectResult = await client.query(subjectQuery, [userId]);
    const subjects = subjectResult.rows;

    // Lấy rank gần đúng (percentile)
    const percentileQuery = `
      WITH user_avg AS (
        SELECT AVG(total_score) as user_avg
        FROM exam_attempts
        WHERE user_id = $1 AND status = 'completed'
        GROUP BY user_id
      ),
      all_avgs AS (
        SELECT AVG(total_score) as avg_score
        FROM exam_attempts
        WHERE status = 'completed'
        GROUP BY user_id
      )
      SELECT
        COUNT(CASE WHEN avg_score < (SELECT user_avg FROM user_avg LIMIT 1) THEN 1 END)::INTEGER as below_count,
        COUNT(*)::INTEGER as total_users
      FROM all_avgs
    `;
    const percentileResult = await client.query(percentileQuery, [userId]);
    const percentile = percentileResult.rows[0];

    let rankPercentile = 50;
    if (percentile.total_users > 0 && percentile.below_count !== null) {
      rankPercentile = round2(
        ((parseInt(percentile.total_users) - parseInt(percentile.below_count)) /
          parseInt(percentile.total_users)) * 100,
      );
    }

    // Tính streak (ngày học liên tiếp)
    const streakQuery = `
      SELECT date::DATE
      FROM exam_attempts
      WHERE user_id = $1 AND status = 'completed'
      GROUP BY date::DATE
      ORDER BY date::DATE DESC
      LIMIT 30
    `;
    const streakResult = await client.query(streakQuery, [userId]);
    const dates = streakResult.rows.map((r) => r.date);
    let currentStreak = 0;
    if (dates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = today;
      for (const d of dates) {
        const examDate = new Date(d);
        examDate.setHours(0, 0, 0, 0);
        const diff = Math.round((checkDate - examDate) / (1000 * 60 * 60 * 24));
        if (diff <= 1) {
          currentStreak++;
          checkDate = examDate;
        } else {
          break;
        }
      }
    }

    return {
      totalExams: parseInt(overview.total_exams) || 0,
      completedExams: parseInt(overview.completed_exams) || 0,
      totalCorrect: parseInt(overview.total_correct) || 0,
      totalIncorrect: parseInt(overview.total_incorrect) || 0,
      totalTimeMinutes: Math.round((parseInt(overview.total_time_seconds) || 0) / 60),
      avgScore: parseFloat(overview.avg_score) || 0,
      highestScore: parseFloat(overview.highest_score) || 0,
      lowestScore: parseFloat(overview.lowest_score) || 0,
      avgPercentage: parseFloat(overview.avg_percentage) || 0,
      rankPercentile,
      currentStreak,
      subjects: subjects.map((s) => ({
        ...s,
        avg_score: parseFloat(s.avg_score),
        avg_percentage: parseFloat(s.avg_percentage),
        highest_score: parseFloat(s.highest_score),
        latest_score: parseFloat(s.latest_score),
      })),
    };
  } finally {
    client.release();
  }
}

// ─── 2. TOPIC ANALYSIS ───────────────────────────────────────────────────────

/**
 * Phân tích theo chủ đề (yếu điểm + mạnh điểm)
 * @param {number} userId
 * @param {string|null} subjectCode - lọc theo môn, null = tất cả
 * @returns {Promise<Object>}
 */
async function analyzeTopics(userId, subjectCode = null) {
  const client = await pool.connect();
  try {
    let topicQuery;
    let params;

    if (subjectCode) {
      topicQuery = `
        SELECT
          qt.id as topic_id,
          qt.name as topic_name,
          qt.name_cn as topic_name_cn,
          s.id as subject_id,
          s.code as subject_code,
          s.name as subject_name,
          COALESCE(SUM(uts.total_questions), 0)::INTEGER as total_questions,
          COALESCE(SUM(uts.correct_answers), 0)::INTEGER as correct_answers,
          COALESCE(SUM(uts.incorrect_answers), 0)::INTEGER as incorrect_answers,
          COALESCE(MAX(uts.error_percentage), 0)::DECIMAL as error_percentage,
          COALESCE(
            AVG(uts.total_questions), 0
          )::INTEGER as avg_questions_per_exam
        FROM user_topic_stats uts
        JOIN question_topics qt ON uts.topic_id = qt.id
        JOIN subjects s ON uts.subject_id = s.id
        WHERE uts.user_id = $1 AND s.code = $2
        GROUP BY qt.id, qt.name, qt.name_cn, s.id, s.code, s.name
        HAVING COALESCE(SUM(uts.total_questions), 0) >= 2
        ORDER BY error_percentage DESC
      `;
      params = [userId, subjectCode];
    } else {
      topicQuery = `
        SELECT
          qt.id as topic_id,
          qt.name as topic_name,
          qt.name_cn as topic_name_cn,
          s.id as subject_id,
          s.code as subject_code,
          s.name as subject_name,
          COALESCE(SUM(uts.total_questions), 0)::INTEGER as total_questions,
          COALESCE(SUM(uts.correct_answers), 0)::INTEGER as correct_answers,
          COALESCE(SUM(uts.incorrect_answers), 0)::INTEGER as incorrect_answers,
          COALESCE(MAX(uts.error_percentage), 0)::DECIMAL as error_percentage
        FROM user_topic_stats uts
        JOIN question_topics qt ON uts.topic_id = qt.id
        JOIN subjects s ON uts.subject_id = s.id
        WHERE uts.user_id = $1
        GROUP BY qt.id, qt.name, qt.name_cn, s.id, s.code, s.name
        HAVING COALESCE(SUM(uts.total_questions), 0) >= 2
        ORDER BY error_percentage DESC
      `;
      params = [userId];
    }

    const result = await client.query(topicQuery, params);

    const topics = result.rows.map((t) => ({
      topicId: t.topic_id,
      topicName: t.topic_name,
      topicNameCn: t.topic_name_cn,
      subjectId: t.subject_id,
      subjectCode: t.subject_code,
      subjectName: t.subject_name,
      totalQuestions: parseInt(t.total_questions),
      correctAnswers: parseInt(t.correct_answers),
      incorrectAnswers: parseInt(t.incorrect_answers),
      accuracy: pct(parseInt(t.correct_answers), parseInt(t.total_questions)),
      errorRate: parseFloat(t.error_percentage) || 0,
    }));

    // Phân loại yếu/mạnh
    const weaknesses = topics
      .filter((t) => t.accuracy < 60)
      .slice(0, 5)
      .map((t) => ({
        ...t,
        advice: generateTopicAdvice(t),
      }));

    const strengths = topics
      .filter((t) => t.accuracy >= 80)
      .slice(0, 5)
      .map((t) => ({
        ...t,
        praise: `Bạn đang làm tốt chủ đề "${t.topicName}" với ${t.accuracy}% độ chính xác! Hãy duy trì và tiếp tục ôn luyện để giữ vững phong độ.`,
      }));

    return {
      totalTopics: topics.length,
      analyzedTopics: topics,
      weaknesses,
      strengths,
    };
  } finally {
    client.release();
  }
}

function generateTopicAdvice(topic) {
  const { accuracy, totalQuestions, topicName } = topic;

  if (accuracy < 30) {
    return `Đây là chủ đề bạn đang gặp rất nhiều khó khăn. Hãy dành 60 phút mỗi ngày trong 3 ngày tới để ôn lại lý thuyết cơ bản của "${topicName}" trước khi luyện thêm bài tập.`;
  }
  if (accuracy < 50) {
    return `Chủ đề "${topicName}" cần được cải thiện. Hãy ôn lại công thức và làm ít nhất 15 câu liên quan. Ghi chép lại những lỗi sai phổ biến và ôn lại mỗi 2 ngày.`;
  }
  if (accuracy < 60) {
    return `Với ${accuracy}% ở "${topicName}", bạn đang ở mức trung bình yếu. Hãy tập trung vào các dạng bài còn sai, xem lại giải thích đáp án và luyện thêm 10 câu để cải thiện lên 70%+.`;
  }
  return `Chủ đề "${topicName}" đã khá tốt. Hãy ôn tập định kỳ 1 lần/tuần để đảm bảo không bị quên và nâng cao tốc độ làm bài.`;
}

// ─── 3. DIFFICULTY ANALYSIS ─────────────────────────────────────────────────

/**
 * Phân tích điểm số theo độ khó
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function analyzeDifficulty(userId) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT
        q.difficulty,
        COUNT(DISTINCT ea.id)::INTEGER as exam_count,
        COUNT(ua.id)::INTEGER as questions_answered,
        SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_count,
        SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END)::INTEGER as incorrect_count,
        ROUND(
          SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::DECIMAL /
          NULLIF(COUNT(ua.id), 0) * 100, 2
        )::DECIMAL as accuracy,
        COALESCE(
          AVG(ua.time_spent_seconds FILTER (WHERE ua.time_spent_seconds > 0)), 0
        )::DECIMAL as avg_time_seconds
      FROM exam_attempts ea
      JOIN user_answers ua ON ea.id = ua.attempt_id
      JOIN questions q ON ua.question_id = q.id
      WHERE ea.user_id = $1 AND ea.status = 'completed' AND q.difficulty IS NOT NULL
      GROUP BY q.difficulty
      ORDER BY
        CASE q.difficulty
          WHEN 'easy' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'hard' THEN 3
          ELSE 4
        END
    `;

    const result = await client.query(query, [userId]);

    const breakdown = result.rows.map((r) => ({
      difficulty: r.difficulty,
      examCount: parseInt(r.exam_count),
      questionsAnswered: parseInt(r.questions_answered),
      correctCount: parseInt(r.correct_count),
      incorrectCount: parseInt(r.incorrect_count),
      accuracy: parseFloat(r.accuracy) || 0,
      avgTimeSeconds: parseFloat(r.avg_time_seconds) || 0,
    }));

    // Xác định độ khó yếu nhất
    const weakest = breakdown.reduce(
      (min, d) => (d.accuracy < (min?.accuracy ?? 100) ? d : min),
      null,
    );

    // Đề xuất dựa trên pattern
    let suggestion;
    if (!weakest) {
      suggestion = "Bạn cần làm thêm đề thi để có đủ dữ liệu phân tích theo độ khó.";
    } else if (weakest.difficulty === 'hard' && weakest.accuracy < 50) {
      suggestion = "Bạn đang gặp khó với câu hỏi khó. Hãy bắt đầu từ cơ bản, đừng vội làm câu hard - hãy chắc chắn điểm easy và medium trước.";
    } else if (weakest.difficulty === 'medium' && weakest.accuracy < 60) {
      suggestion = "Câu hỏi trung bình là phần quan trọng nhất để đạt điểm cao. Hãy tập trung luyện medium trước, sau đó mới mở rộng sang hard.";
    } else if (breakdown.every((d) => d.accuracy >= 75)) {
      suggestion = "Xuất sắc! Bạn làm tốt ở mọi độ khó. Hãy thử các đề thi khó hơn hoặc luyện tốc độ để cải thiện thời gian.";
    } else {
      suggestion = `Hãy tập trung vào câu hỏi "${weakest.difficulty === 'easy' ? 'dễ' : weakest.difficulty === 'medium' ? 'trung bình' : 'khó'}" (${weakest?.accuracy ?? 0}% đúng) - đây là phần bạn đang mất nhiều điểm nhất.`;
    }

    return {
      breakdown,
      weakestDifficulty: weakest?.difficulty || null,
      weakestAccuracy: weakest?.accuracy || 0,
      suggestion,
    };
  } finally {
    client.release();
  }
}

// ─── 4. TREND ANALYSIS ───────────────────────────────────────────────────────

/**
 * Phân tích xu hướng điểm số theo thời gian
 * @param {number} userId
 * @param {number} limit - số lần thi gần nhất để so sánh
 * @returns {Promise<Object>}
 */
async function analyzeTrend(userId, limit = 10) {
  const client = await pool.connect();
  try {
    // Lấy điểm các lần thi gần đây
    const query = `
      SELECT
        ea.id,
        ea.total_score as score,
        ea.total_correct,
        ea.total_incorrect,
        ea.submit_time,
        e.title as exam_title,
        s.name as subject_name,
        s.code as subject_code
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      ORDER BY ea.submit_time DESC
      LIMIT $2
    `;
    const result = await client.query(query, [userId, limit]);
    const attempts = result.rows;

    if (attempts.length < 2) {
      return {
        hasEnoughData: false,
        message: "Bạn cần làm ít nhất 2 đề thi để xem xu hướng.",
        trend: null,
        history: [],
      };
    }

    // Đảo ngược để xếp theo thời gian tăng dần (cũ → mới)
    const chronological = [...attempts].reverse();

    // Tính điểm TB theo nửa đầu vs nửa sau
    const mid = Math.floor(chronological.length / 2);
    const firstHalf = chronological.slice(0, mid);
    const secondHalf = chronological.slice(mid);

    const avgFirst = avgScore(firstHalf.map((a) => parseFloat(a.score) || 0));
    const avgSecond = avgScore(secondHalf.map((a) => parseFloat(a.score) || 0));
    const change = round2(avgSecond - avgFirst);

    // Xác định trend
    let trend;
    if (change >= 5) {
      trend = "improving";
    } else if (change <= -5) {
      trend = "declining";
    } else {
      trend = "stable";
    }

    // Điểm theo từng môn
    const subjectTrend = {};
    for (const a of attempts) {
      const code = a.subject_code;
      if (!subjectTrend[code]) {
        subjectTrend[code] = {
          subjectName: a.subject_name,
          scores: [],
        };
      }
      subjectTrend[code].scores.push({
        score: parseFloat(a.score) || 0,
        date: a.submit_time,
        examTitle: a.exam_title,
      });
    }

    const subjectTrends = Object.entries(subjectTrend).map(([code, data]) => {
      const firstHalfScores = data.scores.slice(0, Math.floor(data.scores.length / 2)).map((s) => s.score);
      const secondHalfScores = data.scores.slice(Math.floor(data.scores.length / 2)).map((s) => s.score);
      return {
        subjectCode: code,
        subjectName: data.subjectName,
        avgFirstHalf: avgScore(firstHalfScores),
        avgSecondHalf: avgScore(secondHalfScores),
        change: round2(avgScore(secondHalfScores) - avgScore(firstHalfScores)),
        history: data.scores,
      };
    });

    // Điểm số gần đây (để vẽ chart)
    const chartData = chronological.map((a) => ({
      date: a.submit_time,
      score: parseFloat(a.score) || 0,
      subject: a.subject_name,
      examTitle: a.exam_title,
    }));

    // Đề xuất
    let suggestion;
    if (trend === "improving") {
      suggestion = `Tuyệt vời! Điểm trung bình của bạn tăng ${change > 0 ? '+' : ''}${change} điểm. Hãy duy trì phong độ và tiếp tục luyện tập đều đặn.`;
    } else if (trend === "declining") {
      suggestion = `Điểm trung bình của bạn giảm ${change} điểm. Đừng nản! Hãy xem lại các lỗi sai gần đây, ôn lại lý thuyết yếu và nghỉ ngơi hợp lý.`;
    } else {
      suggestion = `Điểm số của bạn khá ổn định. Hãy tập trung vào chủ đề yếu và cố gắng cải thiện để vượt qua ngưỡng hiện tại.`;
    }

    return {
      hasEnoughData: true,
      trend,
      change,
      avgFirstHalf: avgFirst,
      avgSecondHalf: avgSecond,
      subjectTrends,
      chartData,
      suggestion,
      totalAttempts: attempts.length,
    };
  } finally {
    client.release();
  }
}

// ─── 5. TIME ANALYSIS ────────────────────────────────────────────────────────

/**
 * Phân tích quản lý thời gian
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function analyzeTimeManagement(userId) {
  const client = await pool.connect();
  try {
    // Thời gian trung bình / câu hỏi
    const avgTimeQuery = `
      SELECT
        COALESCE(AVG(ua.time_spent_seconds), 0)::DECIMAL as overall_avg_seconds,
        COALESCE(
          AVG(ua.time_spent_seconds) FILTER (WHERE ua.is_correct = true), 0
        )::DECIMAL as correct_avg_seconds,
        COALESCE(
          AVG(ua.time_spent_seconds) FILTER (WHERE ua.is_correct = false), 0
        )::DECIMAL as incorrect_avg_seconds,
        COALESCE(
          AVG(ua.time_spent_seconds) FILTER (
            WHERE ua.time_spent_seconds > (
              SELECT AVG(time_spent_seconds) * 2 FROM user_answers ua2
              JOIN exam_attempts ea2 ON ua2.attempt_id = ea2.id
              WHERE ea2.user_id = $1 AND ea2.status = 'completed'
            )
          ), 0
        )::DECIMAL as slow_avg_seconds
      FROM exam_attempts ea
      JOIN user_answers ua ON ea.id = ua.attempt_id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
        AND ua.time_spent_seconds > 0
    `;
    const avgResult = await client.query(avgTimeQuery, [userId]);
    const avg = avgResult.rows[0];

    // Câu hỏi làm quá chậm (mất >2x TB)
    const slowQuestionsQuery = `
      WITH avg_time AS (
        SELECT AVG(time_spent_seconds)::INTEGER as threshold
        FROM user_answers ua
        JOIN exam_attempts ea ON ua.attempt_id = ea.id
        WHERE ea.user_id = $1 AND ea.status = 'completed'
          AND ua.time_spent_seconds > 0
      )
      SELECT
        q.id as question_id,
        q.question_text,
        q.question_category,
        q.difficulty,
        COUNT(ua.id)::INTEGER as attempt_count,
        AVG(ua.time_spent_seconds)::DECIMAL as avg_time,
        SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_count,
        ROUND(
          SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::DECIMAL /
          COUNT(ua.id) * 100, 2
        )::DECIMAL as accuracy
      FROM user_answers ua
      JOIN exam_attempts ea ON ua.attempt_id = ea.id
      JOIN questions q ON ua.question_id = q.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
        AND ua.time_spent_seconds > (SELECT threshold FROM avg_time)
      GROUP BY q.id, q.question_text, q.question_category, q.difficulty
      HAVING COUNT(ua.id) >= 2
      ORDER BY AVG(ua.time_spent_seconds) DESC
      LIMIT 10
    `;
    const slowResult = await client.query(slowQuestionsQuery, [userId]);

    // Thời gian trung bình / đề
    const examTimeQuery = `
      SELECT
        ea.id,
        e.title as exam_title,
        s.name as subject_name,
        e.total_questions,
        e.duration as exam_duration,
        ea.duration_seconds,
        ROUND(
          ea.duration_seconds::DECIMAL / NULLIF(e.total_questions, 0), 1
        )::DECIMAL as seconds_per_question,
        ROUND(
          ea.duration_seconds::DECIMAL / NULLIF(e.duration * 60, 0) * 100, 1
        )::DECIMAL as time_used_percent
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed' AND ea.duration_seconds > 0
      ORDER BY ea.submit_time DESC
      LIMIT 10
    `;
    const examTimeResult = await client.query(examTimeQuery, [userId]);

    const overallAvgSeconds = parseFloat(avg.overall_avg_seconds) || 0;
    const correctAvgSeconds = parseFloat(avg.correct_avg_seconds) || 0;
    const incorrectAvgSeconds = parseFloat(avg.incorrect_avg_seconds) || 0;

    // Phân tích
    let timeManagementRating;
    let suggestion;

    if (incorrectAvgSeconds > correctAvgSeconds * 1.5 && incorrectAvgSeconds > 90) {
      timeManagementRating = "poor";
      suggestion = "Bạn đang dành quá nhiều thời gian cho những câu sai. Hãy đặt giới hạn thời gian cho mỗi câu: khoảng 60-90 giây. Nếu chưa chắc, hãy đánh dấu và quay lại sau.";
    } else if (overallAvgSeconds > 120) {
      timeManagementRating = "fair";
      suggestion = "Tốc độ làm bài của bạn khá chậm. Hãy luyện tập với giới hạn thời gian ngắn hơn thực tế để tăng tốc độ, đặc biệt với những câu easy và medium.";
    } else if (overallAvgSeconds <= 60) {
      timeManagementRating = "excellent";
      suggestion = "Tốc độ làm bài của bạn rất tốt! Hãy đảm bảo bạn không làm cẩu thả ở những câu dễ - đôi khi làm nhanh lại dễ sai hơn.";
    } else {
      timeManagementRating = "good";
      suggestion = "Quản lý thời gian của bạn khá tốt. Hãy tiếp tục duy trì và tập trung vào những dạng bài mất nhiều thời gian.";
    }

    return {
      overallAvgSeconds,
      correctAvgSeconds: round2(correctAvgSeconds),
      incorrectAvgSeconds: round2(incorrectAvgSeconds),
      timeManagementRating,
      suggestion,
      slowQuestions: slowResult.rows.map((q) => ({
        questionId: q.question_id,
        questionText: q.question_text?.substring(0, 100) + (q.question_text?.length > 100 ? "..." : ""),
        category: q.question_category,
        difficulty: q.difficulty,
        attemptCount: parseInt(q.attempt_count),
        avgTimeSeconds: parseFloat(q.avg_time) || 0,
        accuracy: parseFloat(q.accuracy) || 0,
      })),
      recentExamTimes: examTimeResult.rows.map((e) => ({
        examId: e.id,
        examTitle: e.exam_title,
        subjectName: e.subject_name,
        totalQuestions: e.total_questions,
        examDurationMinutes: e.exam_duration,
        actualDurationSeconds: parseInt(e.duration_seconds),
        secondsPerQuestion: parseFloat(e.seconds_per_question) || 0,
        timeUsedPercent: parseFloat(e.time_used_percent) || 0,
      })),
    };
  } finally {
    client.release();
  }
}

// ─── 6. RECOMMEND NEXT EXAMS ──────────────────────────────────────────────────

/**
 * Gợi ý đề thi tiếp theo dựa trên phân tích yếu điểm
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function recommendNextExams(userId) {
  const client = await pool.connect();
  try {
    // Lấy user info để kiểm tra VIP
    const userQuery = `SELECT is_vip FROM users WHERE id = $1`;
    const userResult = await client.query(userQuery, [userId]);
    const isVip = userResult.rows[0]?.is_vip ?? false;

    // Lấy các chủ đề yếu nhất
    const weakTopicsQuery = `
      SELECT
        qt.id as topic_id,
        qt.name as topic_name,
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name,
        uts.error_percentage,
        uts.total_questions
      FROM user_topic_stats uts
      JOIN question_topics qt ON uts.topic_id = qt.id
      JOIN subjects s ON uts.subject_id = s.id
      WHERE uts.user_id = $1
      ORDER BY uts.error_percentage DESC
      LIMIT 3
    `;
    const weakResult = await client.query(weakTopicsQuery, [userId]);
    const weakTopics = weakResult.rows;

    // Lấy đề thi chưa làm hoặc chưa làm gần đây
    const availableExamsQuery = `
      SELECT
        e.id,
        e.title,
        e.code as exam_code,
        e.total_questions,
        e.duration,
        e.difficulty_level,
        e.is_premium,
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name
      FROM exams e
      JOIN subjects s ON e.subject_id = s.id
      WHERE e.is_published = true
        AND ($2 = true OR e.is_premium = false)
        AND e.id NOT IN (
          SELECT ea.exam_id
          FROM exam_attempts ea
          WHERE ea.user_id = $1 AND ea.status = 'completed'
        )
        AND e.id NOT IN (
          SELECT er.exam_id
          FROM user_recommended_exams er
          WHERE er.user_id = $1
            AND er.is_completed = false
            AND er.created_at > NOW() - INTERVAL '7 days'
        )
      ORDER BY e.difficulty_level ASC
      LIMIT 5
    `;
    const availableResult = await client.query(availableExamsQuery, [
      userId,
      isVip,
    ]);

    // Nếu không đủ đề, lấy thêm đề đã làm rồi nhưng score thấp
    const lowScoreExamsQuery = `
      SELECT
        e.id,
        e.title,
        e.code as exam_code,
        e.total_questions,
        e.duration,
        e.difficulty_level,
        e.is_premium,
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name,
        MAX(ea.total_score) as best_score,
        COUNT(ea.id)::INTEGER as attempt_count
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      GROUP BY e.id, e.title, e.code, e.total_questions, e.duration,
               e.difficulty_level, e.is_premium, s.id, s.code, s.name
      HAVING MAX(ea.total_score) < 70
      ORDER BY MAX(ea.total_score) ASC
      LIMIT 3
    `;
    const lowScoreResult = await client.query(lowScoreExamsQuery, [userId]);

    const buildReason = (topic) => {
      if (topic) {
        return {
          type: "weak_topic",
          text: `Cải thiện chủ đề "${topic.topic_name}" (${pct(
            parseInt(topic.total_questions) - Math.round(topic.error_percentage * topic.total_questions / 100),
            parseInt(topic.total_questions),
          )}% đúng)`,
          topicId: topic.topic_id,
          topicName: topic.topic_name,
        };
      }
      return null;
    };

    const recommendations = [
      // Ưu tiên đề theo chủ đề yếu
      ...availableResult.rows
        .filter((e) =>
          weakTopics.some(
            (t) =>
              t.subject_id === e.subject_id
          ),
        )
        .slice(0, 3)
        .map((e) => ({
          ...e,
          reason: buildReason(weakTopics.find((t) => t.subject_id === e.subject_id)),
          priority: 1,
        })),

      // Đề chưa làm
      ...availableResult.rows
        .slice(0, 5)
        .map((e) => ({
          ...e,
          reason: { type: "new_exam", text: "Đề mới - chưa làm", topicId: null, topicName: null },
          priority: 2,
        })),

      // Đề đã làm nhưng điểm thấp
      ...lowScoreResult.rows.map((e) => ({
        ...e,
        reason: { type: "low_score", text: `Làm lại - điểm cao nhất ${e.best_score}`, topicId: null, topicName: null },
        priority: 3,
      })),
    ].slice(0, 6);

    // Lưu recommendations vào DB
    if (recommendations.length > 0) {
      const insertQuery = `
        INSERT INTO user_recommended_exams (user_id, exam_id, reason, priority)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, exam_id) DO UPDATE SET
          reason = $3,
          priority = $4,
          created_at = CURRENT_TIMESTAMP
      `;
      for (const rec of recommendations.slice(0, 5)) {
        await client.query(insertQuery, [
          userId,
          rec.id,
          rec.reason?.text || "Gợi ý",
          rec.priority,
        ]);
      }
    }

    return {
      recommendations: recommendations.map((r) => ({
        examId: r.id,
        examTitle: r.title,
        examCode: r.exam_code,
        totalQuestions: r.total_questions,
        duration: r.duration,
        difficultyLevel: r.difficulty_level,
        isPremium: r.is_premium,
        subjectId: r.subject_id,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        reason: r.reason,
        priority: r.priority,
        bestScore: r.best_score || null,
      })),
      weakTopics: weakTopics.map((t) => ({
        topicId: t.topic_id,
        topicName: t.topic_name,
        subjectCode: t.subject_code,
        subjectName: t.subject_name,
        errorPercentage: parseFloat(t.error_percentage) || 0,
      })),
    };
  } finally {
    client.release();
  }
}

// ─── 7. GENERATE STUDY PLAN ──────────────────────────────────────────────────

/**
 * Tạo lịch học 7 ngày tự động dựa trên yếu điểm
 * @param {number} userId
 * @param {string|null} subjectCode - tập trung vào môn nào, null = tất cả
 * @returns {Promise<Object>}
 */
async function generateStudyPlan(userId, subjectCode = null) {
  const client = await pool.connect();
  try {
    // Lấy 3 chủ đề yếu nhất
    const weakTopicsQuery = subjectCode
      ? `
        SELECT
          qt.id as topic_id,
          qt.name as topic_name,
          uts.error_percentage
        FROM user_topic_stats uts
        JOIN question_topics qt ON uts.topic_id = qt.id
        JOIN subjects s ON uts.subject_id = s.id
        WHERE uts.user_id = $1 AND s.code = $2 AND uts.total_questions >= 2
        ORDER BY uts.error_percentage DESC
        LIMIT 2
      `
      : `
        SELECT
          qt.id as topic_id,
          qt.name as topic_name,
          uts.error_percentage
        FROM user_topic_stats uts
        JOIN question_topics qt ON uts.topic_id = qt.id
        WHERE uts.user_id = $1 AND uts.total_questions >= 2
        ORDER BY uts.error_percentage DESC
        LIMIT 2
      `;

    const weakParams = subjectCode ? [userId, subjectCode] : [userId];
    const weakResult = await client.query(weakTopicsQuery, weakParams);
    const weakTopics = weakResult.rows;

    // Lấy đề thi phù hợp
    const examQuery = subjectCode
      ? `
        SELECT e.id, e.title, e.code, s.name as subject_name
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        WHERE s.code = $2 AND e.is_published = true
          AND e.id NOT IN (
            SELECT exam_id FROM exam_attempts
            WHERE user_id = $1 AND status = 'completed'
            ORDER BY submit_time DESC LIMIT 3
          )
        ORDER BY e.difficulty_level LIMIT 3
      `
      : `
        SELECT e.id, e.title, e.code, s.name as subject_name
        FROM exams e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.is_published = true
          AND e.id NOT IN (
            SELECT exam_id FROM exam_attempts
            WHERE user_id = $1 AND status = 'completed'
            ORDER BY submit_time DESC LIMIT 3
          )
        ORDER BY e.difficulty_level LIMIT 5
      `;

    const examParams = subjectCode ? [userId, subjectCode] : [userId];
    const examResult = await client.query(examQuery, examParams);
    const availableExams = examResult.rows;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    const topicFocus = weakTopics.map((t) => t.topic_name);

    // Ngày 1-2: Ôn lý thuyết chủ đề yếu
    for (let i = 0; i < 2; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push({
        day: i + 1,
        date: date.toISOString().split("T")[0],
        type: "theory",
        title: `Ôn lý thuyết: ${topicFocus[i] || "Tổng ôn"}`,
        description:
          "Học lại các khái niệm và công thức cơ bản của chủ đề này",
        tasks: [
          "Đọc lại lý thuyết trong 30 phút",
          "Ghi chép lại 5 công thức quan trọng",
          "Làm 10 câu trắc nghiệm cơ bản",
          "Review lại đáp án và giải thích",
        ],
        focusTopics: topicFocus[i] ? [topicFocus[i]] : [],
        estimatedMinutes: 90,
      });
    }

    // Ngày 3: Luyện đề
    const date3 = new Date(today);
    date3.setDate(date3.getDate() + 2);
    days.push({
      day: 3,
      date: date3.toISOString().split("T")[0],
      type: "exam",
      title: "Luyện đề mô phỏng",
      description: "Làm đề thi thử trong điều kiện giống thi thật",
      tasks: [
        "Làm 1 đề đầy đủ trong thời gian quy định",
        "Không tra cứu khi đang làm",
        "Sau khi nộp: đánh dấu câu sai",
        "Review đáp án + giải thích chi tiết",
      ],
      targetExam: availableExams[0] || null,
      estimatedMinutes: 120,
    });

    // Ngày 4-5: Luyện专项 (topic yếu)
    for (let i = 0; i < 2; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + 3 + i);
      days.push({
        day: 4 + i,
        date: date.toISOString().split("T")[0],
        type: "practice",
        title: `Luyện tập chuyên sâu: ${topicFocus[i % topicFocus.length] || "Tổng ôn"}`,
        description: "Luyện nhiều câu hỏi cùng chủ đề để cải thiện độ chính xác",
        tasks: [
          "Làm 20 câu cùng chủ đề",
          "Phân tích từng câu sai: vì sao sai, cách khắc phục",
          "Ghi lại 5 lỗi sai phổ biến nhất",
          "Ôn lại 10 phút cuối ngày",
        ],
        focusTopics: topicFocus[i % topicFocus.length] ? [topicFocus[i % topicFocus.length]] : [],
        estimatedMinutes: 90,
      });
    }

    // Ngày 6: Đánh giá tuần
    const date6 = new Date(today);
    date6.setDate(date6.getDate() + 5);
    days.push({
      day: 6,
      date: date6.toISOString().split("T")[0],
      type: "review",
      title: "Tổng kết và đánh giá tuần",
      description: "Xem lại toàn bộ quá trình học trong tuần",
      tasks: [
        "Xem lại sổ ghi chép lỗi sai",
        "So sánh điểm với tuần trước",
        "Xác định 3 điều cần cải thiện cho tuần tới",
        "Nghỉ ngơi và thư giãn",
      ],
      estimatedMinutes: 60,
    });

    // Ngày 7: Thi thử
    const date7 = new Date(today);
    date7.setDate(date7.getDate() + 6);
    days.push({
      day: 7,
      date: date7.toISOString().split("T")[0],
      type: "exam",
      title: "Thi thử cuối tuần",
      description: "Làm đề để đánh giá sự tiến bộ",
      tasks: [
        "Làm đề mới (ưu tiên đề chưa làm)",
        "Tính điểm và so sánh với đầu tuần",
        "Ghi nhận tiến bộ và tiếp tục phát huy",
      ],
      targetExam: availableExams[1] || availableExams[0] || null,
      estimatedMinutes: 120,
    });

    // Lưu vào DB
    const insertQuery = `
      INSERT INTO user_study_plans (user_id, plan_type, title, data, is_active, starts_at, ends_at)
      VALUES ($1, 'auto', $2, $3, true, $4, $5)
      ON CONFLICT (user_id, is_active) WHERE is_active = true
      DO UPDATE SET
        title = $2,
        data = $3,
        starts_at = $4,
        ends_at = $5,
        created_at = CURRENT_TIMESTAMP
    `;
    await client.query(insertQuery, [
      userId,
      `Kế hoạch 7 ngày${subjectCode ? ` - ${subjectCode}` : ""}`,
      JSON.stringify(days),
      days[0].date,
      days[6].date,
    ]);

    return {
      planTitle: `Kế hoạch 7 ngày${subjectCode ? ` - ${subjectCode}` : ""}`,
      startsAt: days[0].date,
      endsAt: days[6].date,
      days,
    };
  } finally {
    client.release();
  }
}

// ─── 8. FULL ANALYSIS (combines all) ────────────────────────────────────────

/**
 * Phân tích toàn diện - gọi tất cả module
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getFullAnalysis(userId) {
  const [overview, topics, difficulty, trend, timeMgmt, recommendations] =
    await Promise.all([
      getOverview(userId),
      analyzeTopics(userId),
      analyzeDifficulty(userId),
      analyzeTrend(userId),
      analyzeTimeManagement(userId),
      recommendNextExams(userId),
    ]);

  // Tổng hợp suggestions
  const suggestions = [
    // Từ topic analysis
    ...topics.weaknesses.slice(0, 2).map((w) => ({
      type: "topic",
      priority: w.errorRate > 50 ? "high" : "medium",
      text: `Cải thiện "${w.topicName}" (${w.accuracy}% đúng) - ${w.advice}`,
    })),

    // Từ difficulty analysis
    {
      type: "difficulty",
      priority: "medium",
      text: difficulty.suggestion,
    },

    // Từ time analysis
    {
      type: "time",
      priority: timeMgmt.timeManagementRating === "poor" ? "high" : "low",
      text: timeMgmt.suggestion,
    },

    // Từ trend
    trend.hasEnoughData && {
      type: "trend",
      priority: "medium",
      text: trend.suggestion,
    },
  ].filter(Boolean);

  // Sắp xếp theo priority
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    overview,
    topics,
    difficulty,
    trend,
    timeManagement: timeMgmt,
    recommendations,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 9. GET ACTIVE STUDY PLAN ─────────────────────────────────────────────────

/**
 * Lấy lịch học đang active
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getActiveStudyPlan(userId) {
  const query = `
    SELECT id, title, data, starts_at, ends_at, created_at
    FROM user_study_plans
    WHERE user_id = $1 AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await pool.query(query, [userId]);
  if (result.rows.length === 0) return null;

  const plan = result.rows[0];
  const days = typeof plan.data === 'string' ? JSON.parse(plan.data) : plan.data;

  // Đánh dấu ngày hiện tại
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split("T")[0];
  let currentDayIndex = -1;
  for (let i = 0; i < days.length; i++) {
    if (days[i].date === todayStr) {
      currentDayIndex = i;
      break;
    }
  }

  return {
    id: plan.id,
    title: plan.title,
    startsAt: plan.starts_at,
    endsAt: plan.ends_at,
    days: days.map((d, i) => ({
      ...d,
      isToday: i === currentDayIndex,
      isPast: new Date(d.date) < today,
    })),
  };
}

// ─── 10. MARK INSIGHT AS READ ────────────────────────────────────────────────

/**
 * Đánh dấu insight đã đọc
 */
async function markInsightRead(insightId, userId) {
  await pool.query(
    `UPDATE user_learning_insights SET is_read = true WHERE id = $1 AND user_id = $2`,
    [insightId, userId],
  );
}

// ─── 11. EXAM SUBMISSION TRIGGER ────────────────────────────────────────────

/**
 * Chạy sau khi user nộp bài - cập nhật insights và patterns
 * Gọi từ examController sau khi submit thành công
 */
async function onExamSubmitted(userId, attemptId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Cập nhật score_trend pattern
    const updateTrendQuery = `
      INSERT INTO user_learning_patterns (user_id, metric_type, data)
      SELECT
        $1,
        'score_trend',
        jsonb_build_object(
          'trend', 'calculated',
          'last_score', ea.total_score,
          'last_exam', e.title,
          'last_date', ea.submit_time
        )
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.id = $2
      ON CONFLICT (user_id, metric_type)
      DO UPDATE SET
        data = user_learning_patterns.data ||
          jsonb_build_object(
            'last_score', ea.total_score,
            'last_exam', e.title,
            'last_date', ea.submit_time
          ),
        updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(updateTrendQuery, [userId, attemptId]);

    // 2. Cập nhật daily summary
    const updateDailyQuery = `
      INSERT INTO daily_learning_summaries
        (user_id, date, exams_taken, questions_answered, correct_answers,
         incorrect_answers, time_spent_seconds)
      SELECT
        $1,
        CURRENT_DATE,
        1,
        COALESCE(SUM(
          CASE WHEN ua.is_correct THEN 1 ELSE 0 END
        ), 0),
        COALESCE(SUM(
          CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END
        ), 0),
        COALESCE(SUM(
          CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END
        ), 0),
        COALESCE(SUM(ua.time_spent_seconds), 0)
      FROM user_answers ua
      JOIN exam_attempts ea ON ua.attempt_id = ea.id
      WHERE ea.id = $2
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        exams_taken = daily_learning_summaries.exams_taken + 1,
        questions_answered = daily_learning_summaries.questions_answered +
          COALESCE(
            (SELECT COUNT(*) FROM user_answers ua2
             JOIN exam_attempts ea2 ON ua2.attempt_id = ea2.id
             WHERE ea2.id = $2), 0
          ),
        correct_answers = daily_learning_summaries.correct_answers +
          COALESCE(
            (SELECT SUM(CASE WHEN ua3.is_correct THEN 1 ELSE 0 END)
             FROM user_answers ua3 WHERE ua3.attempt_id = $2), 0
          ),
        incorrect_answers = daily_learning_summaries.incorrect_answers +
          COALESCE(
            (SELECT SUM(CASE WHEN NOT ua3.is_correct THEN 1 ELSE 0 END)
             FROM user_answers ua3 WHERE ua3.attempt_id = $2), 0
          ),
        time_spent_seconds = daily_learning_summaries.time_spent_seconds +
          COALESCE(
            (SELECT SUM(time_spent_seconds) FROM user_answers ua3
             WHERE ua3.attempt_id = $2), 0
          )
    `;
    await client.query(updateDailyQuery, [userId, attemptId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in onExamSubmitted:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ─── 12. ANALYZE BY EXAM TYPE (Phòng thi vs Tự do) ─────────────────────────────

/**
 * Phân tích điểm số theo loại đề thi (phòng thi vs tự do)
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function analyzeByExamType(userId) {
  const client = await pool.connect();
  try {
    // Phòng thi: có start_time IS NOT NULL
    // Tự do: start_time IS NULL
    const query = `
      SELECT
        CASE
          WHEN e.start_time IS NOT NULL THEN 'phong_thi'
          ELSE 'tu_do'
        END as exam_type,
        COUNT(DISTINCT ea.id)::INTEGER as attempt_count,
        COUNT(DISTINCT ea.user_id)::INTEGER as unique_users,
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
          AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
        )::DECIMAL as avg_score,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE WHEN
              ea.status = 'completed' AND
              ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
            THEN ea.id END)::DECIMAL /
            NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
          ), 0
        )::DECIMAL as pass_rate,
        COALESCE(
          AVG(CASE WHEN ea.status = 'completed' THEN ea.duration_seconds END), 0
        )::INTEGER as avg_duration_seconds
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      GROUP BY
        CASE
          WHEN e.start_time IS NOT NULL THEN 'phong_thi'
          ELSE 'tu_do'
        END
    `;

    const result = await client.query(query, [userId]);

    const byType = {};
    for (const row of result.rows) {
      byType[row.exam_type] = {
        attemptCount: parseInt(row.attempt_count) || 0,
        uniqueUsers: parseInt(row.unique_users) || 0,
        avgPercentage: parseFloat(row.avg_percentage) || 0,
        maxPercentage: parseFloat(row.max_percentage) || 0,
        avgScore: parseFloat(row.avg_score) || 0,
        passRate: parseFloat(row.pass_rate) || 0,
        avgDurationSeconds: parseInt(row.avg_duration_seconds) || 0,
      };
    }

    // Lấy xu hướng so sánh: điểm TB phòng thi vs tự do
    const phongThi = byType.phong_thi;
    const tuDo = byType.tu_do;

    let comparison = null;
    if (phongThi && tuDo && phongThi.attemptCount > 0 && tuDo.attemptCount > 0) {
      const diff = round2(phongThi.avgPercentage - tuDo.avgPercentage);
      comparison = {
        phongThiVsTuDo: diff,
        betterType: diff > 0 ? 'phong_thi' : diff < 0 ? 'tu_do' : 'equal',
        text: diff > 0
          ? `Bạn làm tốt hơn ở đề phòng thi (+${diff}% so với tự do)`
          : diff < 0
          ? `Bạn làm tốt hơn ở đề tự do (+${Math.abs(diff)}% so với phòng thi)`
          : 'Kết quả tương đương giữa 2 loại đề',
      };
    }

    return {
      phongThi: phongThi || null,
      tuDo: tuDo || null,
      comparison,
      hasEnoughData: result.rows.length > 0,
    };
  } finally {
    client.release();
  }
}

// ─── 13. WEEKDAY HEATMAP ───────────────────────────────────────────────────────

/**
 * Phân tích thói quen học tập theo ngày trong tuần
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function analyzeWeekdayPattern(userId) {
  const client = await pool.connect();
  try {
    // Lấy dữ liệu 90 ngày gần nhất
    const query = `
      SELECT
        TO_CHAR(submit_time, 'Dy') as weekday_short,
        TO_CHAR(submit_time, 'YYYY-MM-DD') as date_str,
        COUNT(DISTINCT ea.id)::INTEGER as attempt_count,
        AVG(CASE WHEN ea.status = 'completed'
          THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
        END)::DECIMAL as avg_percentage,
        AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END)::DECIMAL as avg_score,
        COALESCE(SUM(ea.duration_seconds), 0)::INTEGER as total_duration
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.user_id = $1
        AND ea.submit_time >= NOW() - INTERVAL '90 days'
      GROUP BY TO_CHAR(submit_time, 'Dy'), TO_CHAR(submit_time, 'YYYY-MM-DD')
      ORDER BY date_str
    `;

    const result = await client.query(query, [userId]);
    const rows = result.rows;

    // Aggregate by weekday (CN, T2, T3, T4, T5, T6, T7)
    const weekdayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayLabels: Record<string, string> = {
      Sun: 'CN', Mon: 'T2', Tue: 'T3', Wed: 'T4', Thu: 'T5', Fri: 'T6', Sat: 'T7',
    };

    const weekdayStats: Record<string, {
      days: number;
      attempts: number;
      totalScore: number;
      totalDuration: number;
      dates: string[];
    }> = {};

    for (const w of weekdayOrder) {
      weekdayStats[w] = { days: 0, attempts: 0, totalScore: 0, totalDuration: 0, dates: [] };
    }

    for (const row of rows) {
      const w = row.weekday_short;
      if (!weekdayStats[w]) continue;
      weekdayStats[w].days++;
      weekdayStats[w].attempts += parseInt(row.attempt_count) || 0;
      weekdayStats[w].totalScore += parseFloat(row.avg_percentage || 0);
      weekdayStats[w].totalDuration += parseInt(row.total_duration) || 0;
      weekdayStats[w].dates.push(row.date_str);
    }

    // Tính intensity (0-100) dựa trên số ngày active
    const maxDays = Math.max(...Object.values(weekdayStats).map((s) => s.days), 1);
    const maxAttempts = Math.max(...Object.values(weekdayStats).map((s) => s.attempts), 1);

    const heatmap = weekdayOrder.map((w) => {
      const s = weekdayStats[w];
      return {
        weekday: w,
        label: weekdayLabels[w],
        daysActive: s.days,
        totalAttempts: s.attempts,
        avgPercentage: s.days > 0 ? round2(s.totalScore / s.days) : 0,
        avgDurationMinutes: s.days > 0 ? Math.round(s.totalDuration / s.days / 60) : 0,
        intensityDays: maxDays > 0 ? round2((s.days / maxDays) * 100) : 0,
        intensityAttempts: maxAttempts > 0 ? round2((s.attempts / maxAttempts) * 100) : 0,
      };
    });

    // Xác định ngày học nhiều nhất và ít nhất
    const mostActive = heatmap.reduce((a, b) =>
      a.totalAttempts > b.totalAttempts ? a : b, heatmap[0]);
    const leastActive = heatmap.reduce((a, b) =>
      a.totalAttempts < b.totalAttempts ? a : b, heatmap[0]);

    // Mẹo theo ngày
    let tip = '';
    if (mostActive && mostActive.totalAttempts > 0) {
      tip = `Bạn học nhiều nhất vào ${weekdayLabels[mostActive.weekday]}. `;
      if (leastActive && leastActive.totalAttempts === 0) {
        tip += `Hãy thử học thêm vào ${weekdayLabels[leastActive.weekday]} để xây dựng thói quen đều đặn.`;
      }
    }

    return {
      heatmap,
      mostActiveDay: mostActive?.weekday || null,
      leastActiveDay: leastActive?.weekday || null,
      totalDaysStudied: Object.values(weekdayStats).reduce((sum, s) => sum + (s.days > 0 ? 1 : 0), 0),
      tip,
      hasEnoughData: rows.length > 0,
    };
  } finally {
    client.release();
  }
}

// ─── 14. HARDEST EXAMS ─────────────────────────────────────────────────────────

/**
 * Tìm những đề thi khó nhất (lowest pass rate / avg score)
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getHardestExams(userId) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT
        e.id,
        e.title,
        e.difficulty_level,
        s.name as subject_name,
        s.code as subject_code,
        e.total_questions,
        COUNT(ea.id)::INTEGER as total_attempts,
        COALESCE(
          AVG(CASE WHEN ea.status = 'completed'
            THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
          END), 0
        )::DECIMAL as user_avg_percentage,
        COALESCE(
          MAX(CASE WHEN ea.status = 'completed'
            THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
          END), 0
        )::DECIMAL as user_best_percentage,
        COALESCE(
          AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
        )::DECIMAL as user_avg_score,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE WHEN
              ea.status = 'completed' AND
              ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
            THEN ea.id END)::DECIMAL /
            NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
          ), 0
        )::DECIMAL as user_pass_rate,
        COALESCE(
          AVG(CASE WHEN ea.status = 'completed'
            THEN ROUND(
              ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100, 1
            ) END), 0
        )::DECIMAL as overall_avg_percentage,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE WHEN
              ea_all.status = 'completed' AND
              ea_all.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
            THEN ea_all.id END)::DECIMAL /
            NULLIF(COUNT(DISTINCT CASE WHEN ea_all.status = 'completed' THEN ea_all.id END), 0) * 100, 1
          ), 0
        )::DECIMAL as overall_pass_rate
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN exam_attempts ea_all ON e.id = ea_all.exam_id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
      GROUP BY e.id, e.title, e.difficulty_level, s.name, s.code, e.total_questions
      HAVING COUNT(ea.id) >= 1
      ORDER BY user_avg_percentage ASC, user_pass_rate ASC
      LIMIT 5
    `;

    const result = await client.query(query, [userId]);

    return {
      hardestExams: result.rows.map((r) => ({
        examId: r.id,
        title: r.title,
        difficultyLevel: r.difficulty_level,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        totalQuestions: parseInt(r.total_questions) || 0,
        userAttempts: parseInt(r.total_attempts) || 0,
        userAvgPercentage: parseFloat(r.user_avg_percentage) || 0,
        userBestPercentage: parseFloat(r.user_best_percentage) || 0,
        userAvgScore: parseFloat(r.user_avg_score) || 0,
        userPassRate: parseFloat(r.user_pass_rate) || 0,
        overallAvgPercentage: parseFloat(r.overall_avg_percentage) || 0,
        overallPassRate: parseFloat(r.overall_pass_rate) || 0,
      })),
      hasEnoughData: result.rows.length > 0,
    };
  } finally {
    client.release();
  }
}

// ─── Module exports ───────────────────────────────────────────────────────────

module.exports = {
  getOverview,
  analyzeTopics,
  analyzeDifficulty,
  analyzeTrend,
  analyzeTimeManagement,
  recommendNextExams,
  generateStudyPlan,
  getFullAnalysis,
  getActiveStudyPlan,
  markInsightRead,
  onExamSubmitted,
  analyzeByExamType,
  analyzeWeekdayPattern,
  getHardestExams,
};
