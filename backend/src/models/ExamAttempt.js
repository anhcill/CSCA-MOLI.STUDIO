const { pool } = require("../config/database");
const { scorePercentage, scaleTenPointScore } = require("../utils/examScoring");

function createAttemptError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeScore(rawScore, possibleScore) {
  const raw = Number(rawScore) || 0;
  const possible = Number(possibleScore) || 0;
  if (possible <= 0) {
    return {
      score_scale_10: 0,
      score_scale_100: 0,
      total_possible_score: 0,
    };
  }

  const ratio = Math.max(0, Math.min(1, raw / possible));
  return {
    score_scale_10: Number((ratio * 10).toFixed(2)),
    score_scale_100: Number((ratio * 100).toFixed(1)),
    total_possible_score: Number(possible.toFixed(2)),
  };
}

const SUBJECTIVE_TYPES = ["essay", "translation"];
const CONTAINER_TYPES = ["reading_passage", "fill_blank_pool"];

async function calculateAttemptStats(client, attemptId, examId) {
  const result = await client.query(
    `WITH eligible_questions AS (
       SELECT q.*
       FROM questions q
       WHERE q.exam_id = $2
         AND q.question_type <> ALL($3::varchar[])
         AND (
           q.deleted_at IS NULL
           OR EXISTS (
             SELECT 1 FROM user_answers historical
             WHERE historical.attempt_id = $1 AND historical.question_id = q.id
           )
         )
     )
     SELECT
       COUNT(q.id)::int AS total_questions,
       COUNT(ua.id)::int AS total_answered,
       COUNT(*) FILTER (
         WHERE ua.id IS NOT NULL AND (
           (q.question_type <> ALL($4::varchar[]) AND ua.is_correct IS TRUE)
           OR (q.question_type = ANY($4::varchar[]) AND ua.score_awarded IS NOT NULL
               AND ua.score_awarded >= q.points * 0.5)
         )
       )::int AS total_correct,
       COUNT(*) FILTER (
         WHERE ua.id IS NOT NULL AND (
           (q.question_type <> ALL($4::varchar[]) AND ua.is_correct IS FALSE)
           OR (q.question_type = ANY($4::varchar[]) AND ua.score_awarded IS NOT NULL
               AND ua.score_awarded < q.points * 0.5)
         )
       )::int AS total_incorrect,
       COUNT(*) FILTER (
         WHERE ua.id IS NOT NULL AND q.question_type = ANY($4::varchar[])
           AND ua.score_awarded IS NULL
       )::int AS total_pending_grading,
       COALESCE(SUM(
         CASE
           WHEN q.question_type = ANY($4::varchar[]) THEN COALESCE(ua.score_awarded, 0)
           WHEN ua.is_correct IS TRUE THEN q.points
           ELSE 0
         END
       ), 0)::numeric AS total_score,
       COALESCE(SUM(q.points), 0)::numeric AS total_possible_score
     FROM eligible_questions q
     LEFT JOIN user_answers ua
       ON ua.question_id = q.id AND ua.attempt_id = $1`,
    [attemptId, examId, CONTAINER_TYPES, SUBJECTIVE_TYPES],
  );

  const stats = result.rows[0];
  stats.total_unanswered = Math.max(
    0,
    Number(stats.total_questions || 0) - Number(stats.total_answered || 0),
  );
  stats.score_percentage = scorePercentage(stats.total_score, stats.total_possible_score);
  return stats;
}

const ExamAttempt = {
  async getInProgress(userId, examId) {
    const result = await pool.query(
      `SELECT ea.*,
              COALESCE(COUNT(ua.id), 0)::int AS answered_count
       FROM exam_attempts ea
       LEFT JOIN user_answers ua ON ua.attempt_id = ea.id
       WHERE ea.user_id = $1 AND ea.exam_id = $2 AND ea.status = 'in_progress'
       GROUP BY ea.id
       ORDER BY ea.start_time DESC
       LIMIT 1`,
      [userId, examId],
    );
    return result.rows[0] || null;
  },

  async abandonInProgress(userId, examId) {
    await pool.query(
      `UPDATE exam_attempts
       SET status = 'abandoned', end_time = COALESCE(end_time, CURRENT_TIMESTAMP)
       WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'`,
      [userId, examId],
    );
  },

  async getSavedAnswers(attemptId) {
    const result = await pool.query(
      `SELECT question_id,
              selected_answer_id,
              selected_answer_key,
              essay_answer
       FROM user_answers
       WHERE attempt_id = $1`,
      [attemptId],
    );
    return result.rows;
  },

  // Bắt đầu làm bài thi
  async start(userId, examId, options = {}) {
    if (options.practiceMode) {
      const result = await pool.query(
        `INSERT INTO exam_attempts (user_id, exam_id, attempt_number, status)
         VALUES (
           $1,
           $2,
           (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM exam_attempts WHERE user_id = $1 AND exam_id = $2),
           'practice'
         )
         RETURNING *`,
        [userId, examId]
      );
      return result.rows[0];
    }

    if (options.restart) {
      await this.abandonInProgress(userId, examId);
    }

    let retries = 3;
    while (retries > 0) {
      try {
        // Check if user already has an in-progress attempt
        const checkQuery = `
          SELECT * FROM exam_attempts 
          WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'
        `;
        const checkResult = await pool.query(checkQuery, [userId, examId]);

        if (checkResult.rows.length > 0) {
          return checkResult.rows[0]; // Return existing attempt
        }

        // Create new attempt atomically
        const insertQuery = `
          INSERT INTO exam_attempts (user_id, exam_id, attempt_number, status)
          VALUES (
            $1, 
            $2, 
            (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM exam_attempts WHERE user_id = $1 AND exam_id = $2), 
            'in_progress'
          )
          RETURNING *
        `;

        const result = await pool.query(insertQuery, [userId, examId]);
        return result.rows[0];
      } catch (err) {
        if (err.code === '23505' && err.constraint === 'exam_attempts_user_id_exam_id_attempt_number_key') {
          // Race condition occurred: another request just inserted the record.
          retries--;
          if (retries === 0) throw err;
          // Wait a bit before retrying to allow the other transaction to finish
          await new Promise(r => setTimeout(r, 50));
        } else {
          throw err;
        }
      }
    }
  },

  // Lưu câu trả lời
  async saveAnswer(attemptId, questionId, selectedAnswerKey, timeSpent, essayAnswer = null, userId = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lấy thông tin câu hỏi để xác định loại
      const contextResult = await client.query(
        `SELECT ea.user_id, ea.status, ea.exam_id, q.question_type, q.points
         FROM exam_attempts ea
         INNER JOIN questions q ON q.exam_id = ea.exam_id AND q.id = $2 AND q.deleted_at IS NULL
         WHERE ea.id = $1
         FOR UPDATE OF ea`,
        [attemptId, questionId]
      );
      const context = contextResult.rows[0];
      const questionType = context?.question_type;
      if (!questionType) {
        throw createAttemptError("Attempt or question not found", 404);
      }
      if (userId && Number(context.user_id) !== Number(userId)) {
        throw createAttemptError("Attempt does not belong to current user", 403);
      }
      if (!["in_progress", "practice"].includes(context.status)) {
        throw createAttemptError("Attempt is not editable", 409);
      }

      // Nếu là câu tự luận hoặc dịch thuật → lưu essay_answer, không check đáp án
      if (questionType === 'essay' || questionType === 'translation') {
        const normalizedEssay = typeof essayAnswer === "string" ? essayAnswer.trim() : "";
        if (!normalizedEssay) {
          await client.query(
            `DELETE FROM user_answers WHERE attempt_id = $1 AND question_id = $2`,
            [attemptId, questionId]
          );
          await client.query("COMMIT");
          return {
            attempt_id: Number(attemptId),
            question_id: Number(questionId),
            selected_answer_key: null,
            selected_answer_id: null,
            is_correct: null,
            essay_answer: null,
          };
        }

        const upsertQuery = `
          INSERT INTO user_answers (
            attempt_id, question_id, selected_answer_key,
            selected_answer_id, is_correct, time_spent_seconds, essay_answer,
            score_awarded, max_score, grading_status, grading_feedback,
            grading_result, graded_at
          ) VALUES ($1, $2, $3, NULL, NULL, $4, $5, NULL, $6, 'pending', NULL, NULL, NULL)
          ON CONFLICT (attempt_id, question_id)
          DO UPDATE SET
            selected_answer_key = $3,
            essay_answer = $5,
            time_spent_seconds = $4,
            is_correct = NULL,
            score_awarded = NULL,
            max_score = $6,
            grading_status = 'pending',
            grading_feedback = NULL,
            grading_result = NULL,
            graded_at = NULL,
            created_at = CURRENT_TIMESTAMP
          RETURNING *
        `;
        const result = await client.query(upsertQuery, [
          attemptId,
          questionId,
          selectedAnswerKey || 'ESSAY_ANSWER',
          timeSpent || 0,
          normalizedEssay,
          Number(context.points) || 0,
        ]);
        await client.query("COMMIT");
        return result.rows[0];
      }

      // Multiple-choice: logic cũ
      const answerQuery = `
        SELECT a.id, a.is_correct
        FROM answers a
        WHERE a.question_id = $1 AND a.answer_key = $2
      `;
      const answerResult = await client.query(answerQuery, [
        questionId,
        selectedAnswerKey,
      ]);

      if (answerResult.rows.length === 0) {
        throw new Error("Invalid answer key");
      }

      const selectedAnswer = answerResult.rows[0];

      const upsertQuery = `
        INSERT INTO user_answers (
          attempt_id, question_id, selected_answer_id,
          selected_answer_key, is_correct, time_spent_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET
          selected_answer_id = $3,
          selected_answer_key = $4,
          is_correct = $5,
          time_spent_seconds = $6,
          created_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await client.query(upsertQuery, [
        attemptId,
        questionId,
        selectedAnswer.id,
        selectedAnswerKey,
        selectedAnswer.is_correct,
        timeSpent,
      ]);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Nộp bài và tính điểm
  async submit(attemptId, userId = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const examQuery = `
        SELECT ea.*, e.total_questions,
               COALESCE((
                 SELECT SUM(q.points)
                 FROM questions q
                 WHERE q.exam_id = e.id
                   AND q.deleted_at IS NULL
               ), 0) as total_possible_score,
               EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ea.start_time))::INTEGER as duration
        FROM exam_attempts ea
        INNER JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = $1
        FOR UPDATE OF ea
      `;
      const examResult = await client.query(examQuery, [attemptId]);
      const examInfo = examResult.rows[0];
      if (!examInfo) {
        throw createAttemptError("Attempt not found", 404);
      }
      if (userId && Number(examInfo.user_id) !== Number(userId)) {
        throw createAttemptError("Attempt does not belong to current user", 403);
      }
      if (examInfo.status === "completed") {
        await client.query("COMMIT");
        return {
          ...examInfo,
          ...normalizeScore(examInfo.total_score, examInfo.total_possible_score),
          already_completed: true,
        };
      }
      if (!["in_progress", "practice"].includes(examInfo.status)) {
        throw createAttemptError("Attempt cannot be submitted", 409);
      }

      const stats = await calculateAttemptStats(client, attemptId, examInfo.exam_id);
      const normalizedScore = normalizeScore(stats.total_score, stats.total_possible_score);

      // Update attempt with results
      const updateQuery = `
        UPDATE exam_attempts 
        SET 
          end_time = CURRENT_TIMESTAMP,
          submit_time = CURRENT_TIMESTAMP,
          duration_seconds = $1,
          total_score = $2,
          total_correct = $3,
          total_incorrect = $4,
          total_unanswered = $5,
          total_possible_score = $6,
          score_percentage = $7,
          total_pending_grading = $8,
          status = 'completed'
        WHERE id = $9
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        examInfo.duration || 0,
        parseFloat(stats.total_score) || 0,
        parseInt(stats.total_correct) || 0,
        parseInt(stats.total_incorrect) || 0,
        stats.total_unanswered,
        Number(stats.total_possible_score) || 0,
        Number(stats.score_percentage) || 0,
        parseInt(stats.total_pending_grading) || 0,
        attemptId,
      ]);

      // Update user topic stats
      await this.updateTopicStats(client, attemptId);

      await client.query("COMMIT");
      return { ...result.rows[0], ...normalizedScore, already_completed: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async applySubjectiveGrade(attemptId, questionId, userId, gradeResult) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const contextResult = await client.query(
        `SELECT ea.exam_id, ea.status, ea.user_id, q.points, q.question_type,
                ua.essay_answer
         FROM exam_attempts ea
         JOIN questions q ON q.exam_id = ea.exam_id AND q.id = $2
         JOIN user_answers ua ON ua.attempt_id = ea.id AND ua.question_id = q.id
         WHERE ea.id = $1
         FOR UPDATE OF ea, ua`,
        [attemptId, questionId],
      );
      const context = contextResult.rows[0];
      if (!context) throw createAttemptError("Attempt answer not found", 404);
      if (Number(context.user_id) !== Number(userId)) {
        throw createAttemptError("Attempt does not belong to current user", 403);
      }
      if (!SUBJECTIVE_TYPES.includes(context.question_type)) {
        throw createAttemptError("Question is not subjectively graded", 400);
      }

      const maxScore = Number(context.points) || 0;
      const awarded = scaleTenPointScore(gradeResult.totalScore, maxScore);

      await client.query(
        `UPDATE user_answers
         SET score_awarded = $1, max_score = $2, grading_status = 'graded',
             grading_feedback = $3, grading_result = $4::jsonb,
             graded_at = CURRENT_TIMESTAMP, is_correct = NULL
         WHERE attempt_id = $5 AND question_id = $6`,
        [awarded, maxScore, gradeResult.feedback || null, JSON.stringify(gradeResult), attemptId, questionId],
      );

      if (context.status === "completed") {
        const stats = await calculateAttemptStats(client, attemptId, context.exam_id);
        await client.query(
          `UPDATE exam_attempts
           SET total_score = $1, total_correct = $2, total_incorrect = $3,
               total_unanswered = $4, total_possible_score = $5,
               score_percentage = $6, total_pending_grading = $7
           WHERE id = $8`,
          [
            Number(stats.total_score) || 0,
            Number(stats.total_correct) || 0,
            Number(stats.total_incorrect) || 0,
            stats.total_unanswered,
            Number(stats.total_possible_score) || 0,
            Number(stats.score_percentage) || 0,
            Number(stats.total_pending_grading) || 0,
            attemptId,
          ],
        );
      }

      await client.query("COMMIT");
      return { ...gradeResult, scoreAwarded: awarded, maxScore };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Cập nhật thống kê theo topic
  async updateTopicStats(client, attemptId) {
    const query = `
      INSERT INTO user_topic_stats (user_id, subject_id, topic_id, total_questions, correct_answers, incorrect_answers, error_percentage)
      SELECT 
        ea.user_id,
        e.subject_id,
        qtm.topic_id,
        COUNT(*) as total_questions,
        SUM(CASE WHEN COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END) as correct_answers,
        SUM(CASE WHEN NOT COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END) as incorrect_answers,
        ROUND((SUM(CASE WHEN NOT COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as error_percentage
      FROM user_answers ua
      INNER JOIN exam_attempts ea ON ua.attempt_id = ea.id
      INNER JOIN questions q ON ua.question_id = q.id
      INNER JOIN exams e ON q.exam_id = e.id
      INNER JOIN question_topic_mapping qtm ON q.id = qtm.question_id
      WHERE ea.id = $1
        AND (q.question_type NOT IN ('essay', 'translation') OR ua.score_awarded IS NOT NULL)
      GROUP BY ea.user_id, e.subject_id, qtm.topic_id
      ON CONFLICT (user_id, subject_id, topic_id)
      DO UPDATE SET
        total_questions = user_topic_stats.total_questions + EXCLUDED.total_questions,
        correct_answers = user_topic_stats.correct_answers + EXCLUDED.correct_answers,
        incorrect_answers = user_topic_stats.incorrect_answers + EXCLUDED.incorrect_answers,
        error_percentage = ROUND((user_topic_stats.incorrect_answers + EXCLUDED.incorrect_answers)::DECIMAL / 
                                 (user_topic_stats.total_questions + EXCLUDED.total_questions) * 100, 2),
        last_updated = CURRENT_TIMESTAMP
    `;

    await client.query(query, [attemptId]);
  },

  // Lấy lịch sử làm bài của user
  async rebuildUserTopicStats(client, userId) {
    await client.query(`DELETE FROM user_topic_stats WHERE user_id = $1`, [userId]);

    await client.query(
      `INSERT INTO user_topic_stats (user_id, subject_id, topic_id, total_questions, correct_answers, incorrect_answers, error_percentage)
       SELECT
         ea.user_id,
         e.subject_id,
         qtm.topic_id,
         COUNT(*)::int AS total_questions,
         SUM(CASE WHEN COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END)::int AS correct_answers,
         SUM(CASE WHEN NOT COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END)::int AS incorrect_answers,
         ROUND(
           SUM(CASE WHEN NOT COALESCE(ua.is_correct, ua.score_awarded >= q.points * 0.5) THEN 1 ELSE 0 END)::decimal
           / NULLIF(COUNT(*), 0) * 100,
           2
         ) AS error_percentage
       FROM user_answers ua
       JOIN exam_attempts ea ON ua.attempt_id = ea.id
       JOIN questions q ON ua.question_id = q.id
       JOIN exams e ON q.exam_id = e.id
       JOIN question_topic_mapping qtm ON q.id = qtm.question_id
       WHERE ea.user_id = $1
         AND ea.status = 'completed'
         AND (q.question_type NOT IN ('essay', 'translation') OR ua.score_awarded IS NOT NULL)
       GROUP BY ea.user_id, e.subject_id, qtm.topic_id`,
      [userId],
    );
  },

  async deleteHistoryAttempt(attemptId, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const attemptResult = await client.query(
        `SELECT id, exam_id, user_id
         FROM exam_attempts
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [attemptId, userId],
      );

      const attempt = attemptResult.rows[0];
      if (!attempt) {
        throw createAttemptError("Attempt not found", 404);
      }

      await client.query(`DELETE FROM ai_insights WHERE attempt_id = $1 AND user_id = $2`, [attemptId, userId]);

      const optionalTables = await client.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [["ai_ask_cache", "exam_risk_cases"]],
      );
      const existingTables = new Set(optionalTables.rows.map((row) => row.table_name));

      if (existingTables.has("ai_ask_cache")) {
        await client.query(
          `DELETE FROM ai_ask_cache WHERE attempt_id = $1 AND (user_id = $2 OR user_id IS NULL)`,
          [String(attemptId), userId],
        );
      }
      if (existingTables.has("exam_risk_cases")) {
        await client.query(`DELETE FROM exam_risk_cases WHERE attempt_id = $1 AND user_id = $2`, [attemptId, userId]);
      }
      await client.query(`UPDATE user_question_notes SET source_attempt_id = NULL WHERE source_attempt_id = $1 AND user_id = $2`, [attemptId, userId]);
      await client.query(`DELETE FROM exam_attempts WHERE id = $1 AND user_id = $2`, [attemptId, userId]);

      await this.rebuildUserTopicStats(client, userId);

      await client.query("COMMIT");
      return { id: Number(attemptId), exam_id: attempt.exam_id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserHistory(userId, subjectCode = null, limit = 10) {
    let query = `
      SELECT
        ea.*,
        ea.submit_time AS submitted_at,
        e.code as exam_code,
        e.title as exam_title,
        e.language_mode,
        e.total_questions,
        COALESCE(ea.total_possible_score, e.total_points, 0) AS total_possible_score,
        COALESCE(ea.score_percentage,
          ea.total_score / NULLIF(COALESCE(ea.total_possible_score, e.total_points), 0) * 100,
          0
        ) AS score_percentage,
        COALESCE(ea.total_pending_grading, 0) AS total_pending_grading,
        s.name as subject_name,
        s.code as subject_code,
        (
          SELECT COUNT(*)::INTEGER
          FROM questions q WHERE q.exam_id = e.id AND q.deleted_at IS NULL
            AND q.question_type <> ALL(ARRAY['reading_passage','fill_blank_pool']::varchar[])
        ) as question_count
      FROM exam_attempts ea
      INNER JOIN exams e ON ea.exam_id = e.id
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE ea.user_id = $1 AND ea.status = 'completed'
    `;

    const params = [userId];

    if (subjectCode) {
      query += ` AND s.code = $2`;
      params.push(subjectCode);
      query += ` ORDER BY ea.submit_time DESC LIMIT $3`;
      params.push(limit);
    } else {
      query += ` ORDER BY ea.submit_time DESC LIMIT $2`;
      params.push(limit);
    }

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Lấy thống kê theo topic
  async getUserTopicStats(userId, subjectCode) {
    const query = `
      SELECT 
        uts.*,
        qt.name as topic_name,
        qt.name_cn as topic_name_cn
      FROM user_topic_stats uts
      INNER JOIN question_topics qt ON uts.topic_id = qt.id
      INNER JOIN subjects s ON uts.subject_id = s.id
      WHERE uts.user_id = $1 AND s.code = $2
      ORDER BY uts.error_percentage DESC
    `;

    const result = await pool.query(query, [userId, subjectCode]);
    return result.rows;
  },

  // Lấy chi tiết một lần làm bài
  async getAttemptDetail(attemptId, userId) {
    const attemptQuery = `
      SELECT
        ea.*,
        e.code as exam_code,
        e.title as exam_title,
        e.language_mode,
        COALESCE(ea.total_possible_score, e.total_points, 0) AS total_possible_score,
        COALESCE(ea.score_percentage,
          ea.total_score / NULLIF(COALESCE(ea.total_possible_score, e.total_points), 0) * 100,
          0
        ) AS score_percentage,
        COALESCE(ea.total_pending_grading, 0) AS total_pending_grading,
        (
          SELECT COUNT(*)::int FROM questions active_q
          WHERE active_q.exam_id = e.id AND active_q.deleted_at IS NULL
            AND active_q.question_type <> ALL(ARRAY['reading_passage','fill_blank_pool']::varchar[])
        ) AS total_questions,
        s.name as subject_name,
        e.solution_video_url,
        e.solution_description
      FROM exam_attempts ea
      INNER JOIN exams e ON ea.exam_id = e.id
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE ea.id = $1 AND ea.user_id = $2
    `;

    const attemptResult = await pool.query(attemptQuery, [attemptId, userId]);

    if (attemptResult.rows.length === 0) {
      return null;
    }

    const attempt = attemptResult.rows[0];

    // Get all questions with answers
    const questionsQuery = `
      SELECT 
        q.id,
        COALESCE(q.deleted_question_number, q.question_number) AS question_number,
        q.question_text,
        q.question_text_cn,
        q.question_text_en,
        q.question_type,
        q.difficulty,
        q.question_category,
        q.points,
        q.explanation,
        q.explanation_cn,
        q.explanation_en,
        q.explanation_image_url,
        (
          SELECT qt.name
          FROM question_topic_mapping qtm
          INNER JOIN question_topics qt ON qt.id = qtm.topic_id
          WHERE qtm.question_id = q.id
          LIMIT 1
        ) as topic_name,
        ua.selected_answer_key as user_answer,
        ua.is_correct,
        ua.essay_answer,
        ua.score_awarded,
        ua.max_score,
        ua.grading_status,
        ua.grading_feedback,
        ua.grading_result,
        (SELECT answer_key FROM answers WHERE question_id = q.id AND is_correct = true LIMIT 1) as correct_answer
      FROM questions q
      LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.attempt_id = $1
      WHERE q.exam_id = $2
        AND (q.deleted_at IS NULL OR ua.id IS NOT NULL)
        AND q.question_type <> ALL(ARRAY['reading_passage','fill_blank_pool']::varchar[])
      ORDER BY COALESCE(q.deleted_question_number, q.question_number)
    `;

    const questionsResult = await pool.query(questionsQuery, [
      attemptId,
      attempt.exam_id,
    ]);

    // FIX N+1: Fetch ALL answers for all questions in a single query
    const allAnswersResult = await pool.query(
      `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, a.answer_text_en, a.is_correct
       FROM answers a
       INNER JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1
       ORDER BY a.question_id, a.answer_key`,
      [attempt.exam_id]
    );

    // Group answers by question_id in memory
    const answersByQuestion = {};
    for (const a of allAnswersResult.rows) {
      if (!answersByQuestion[a.question_id]) {
        answersByQuestion[a.question_id] = [];
      }
      answersByQuestion[a.question_id].push(a);
    }

    // Build formatted answers array
    const formattedAnswers = [];

    for (const question of questionsResult.rows) {
      const questionAnswers = answersByQuestion[question.id] || [];

      // Build a map: { 'A': 'text...', 'B': 'text...' }
      const optionMap = {};
      const optionCnMap = {};
      const optionEnMap = {};
      questionAnswers.forEach((a) => {
        optionMap[a.answer_key] = a.answer_text;
        optionCnMap[a.answer_key] = a.answer_text_cn;
        optionEnMap[a.answer_key] = a.answer_text_en;
      });

      const userAnswerKey = question.user_answer;
      const correctAnswerKey = question.correct_answer;

      formattedAnswers.push({
        id: question.id,
        question_id: question.id,
        question_number: question.question_number,
        question_text: question.question_text,
        question_text_cn: question.question_text_cn,
        question_text_en: question.question_text_en,
        question_type: question.question_type,
        difficulty: question.difficulty,
        question_category: question.question_category,
        topic_name: question.topic_name,
        selected_answer_key: userAnswerKey,
        selected_answer_text: SUBJECTIVE_TYPES.includes(question.question_type)
          ? (question.essay_answer || "")
          : userAnswerKey
          ? `${userAnswerKey}. ${optionMap[userAnswerKey] || ""}`
          : "Bỏ qua",
        correct_answer_key: correctAnswerKey,
        selected_answer_text_cn: userAnswerKey && optionCnMap[userAnswerKey] && optionCnMap[userAnswerKey] !== optionMap[userAnswerKey]
          ? `${userAnswerKey}. ${optionCnMap[userAnswerKey]}`
          : null,
        selected_answer_text_en: userAnswerKey && optionEnMap[userAnswerKey] && optionEnMap[userAnswerKey] !== optionMap[userAnswerKey]
          ? `${userAnswerKey}. ${optionEnMap[userAnswerKey]}`
          : null,
        correct_answer_text: correctAnswerKey
          ? `${correctAnswerKey}. ${optionMap[correctAnswerKey] || ""}`
          : "",
        correct_answer_text_cn: correctAnswerKey && optionCnMap[correctAnswerKey] && optionCnMap[correctAnswerKey] !== optionMap[correctAnswerKey]
          ? `${correctAnswerKey}. ${optionCnMap[correctAnswerKey]}`
          : null,
        correct_answer_text_en: correctAnswerKey && optionEnMap[correctAnswerKey] && optionEnMap[correctAnswerKey] !== optionMap[correctAnswerKey]
          ? `${correctAnswerKey}. ${optionEnMap[correctAnswerKey]}`
          : null,
        is_correct: question.is_correct,
        score_awarded: question.score_awarded,
        max_score: question.max_score,
        grading_status: question.grading_status,
        grading_feedback: question.grading_feedback,
        grading_result: question.grading_result,
        points: question.points,
        explanation: question.explanation,
        explanation_cn: question.explanation_cn,
        explanation_en: question.explanation_en,
        explanation_image_url: question.explanation_image_url,
        options: questionAnswers.map((a) => ({
          key: a.answer_key,
          text: a.answer_text,
          text_cn:
            a.answer_text_cn && a.answer_text_cn !== a.answer_text
              ? a.answer_text_cn
              : null,
          text_en:
            a.answer_text_en && a.answer_text_en !== a.answer_text
              ? a.answer_text_en
              : null,
          is_correct: a.is_correct,
        })),
      });
    }

    attempt.answers = formattedAnswers;
    Object.assign(
      attempt,
      normalizeScore(
        attempt.total_score,
        formattedAnswers.reduce((sum, answer) => sum + (Number(answer.points) || 0), 0),
      ),
    );

    // Attach video solution if exists
    attempt.solution_video_url = attempt.solution_video_url || null;
    attempt.solution_description = attempt.solution_description || null;

    return attempt;
  },
};

module.exports = ExamAttempt;
