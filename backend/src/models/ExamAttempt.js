const { pool } = require("../config/database");

const ExamAttempt = {
  // Bắt đầu làm bài thi
  async start(userId, examId) {
    // Check if user already has an in-progress attempt
    const checkQuery = `
      SELECT * FROM exam_attempts 
      WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'
    `;
    const checkResult = await pool.query(checkQuery, [userId, examId]);

    if (checkResult.rows.length > 0) {
      return checkResult.rows[0]; // Return existing attempt
    }

    // Get attempt number
    const countQuery = `
      SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
      FROM exam_attempts 
      WHERE user_id = $1 AND exam_id = $2
    `;
    const countResult = await pool.query(countQuery, [userId, examId]);
    const attemptNumber = countResult.rows[0].next_attempt;

    // Create new attempt
    const insertQuery = `
      INSERT INTO exam_attempts (user_id, exam_id, attempt_number, status)
      VALUES ($1, $2, $3, 'in_progress')
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId,
      examId,
      attemptNumber,
    ]);
    return result.rows[0];
  },

  // Lưu câu trả lời
  async saveAnswer(attemptId, questionId, selectedAnswerKey, timeSpent) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get correct answer
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

      // Insert or update user answer
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
  async submit(attemptId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Calculate scores
      const statsQuery = `
        SELECT 
          COALESCE(COUNT(*), 0) as total_answered,
          COALESCE(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END), 0) as total_correct,
          COALESCE(SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END), 0) as total_incorrect,
          COALESCE(SUM(CASE WHEN ua.is_correct THEN q.points ELSE 0 END), 0) as total_score
        FROM user_answers ua
        INNER JOIN questions q ON ua.question_id = q.id
        WHERE ua.attempt_id = $1
      `;
      const statsResult = await client.query(statsQuery, [attemptId]);
      const stats = statsResult.rows[0];

      // Get total questions in exam
      const examQuery = `
        SELECT e.total_questions, 
               EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ea.start_time))::INTEGER as duration
        FROM exam_attempts ea
        INNER JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = $1
      `;
      const examResult = await client.query(examQuery, [attemptId]);
      const examInfo = examResult.rows[0];

      const totalUnanswered =
        examInfo.total_questions - parseInt(stats.total_answered);

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
          status = 'completed'
        WHERE id = $6
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        examInfo.duration || 0,
        parseFloat(stats.total_score) || 0,
        parseInt(stats.total_correct) || 0,
        parseInt(stats.total_incorrect) || 0,
        Math.max(0, totalUnanswered),
        attemptId,
      ]);

      // Update user topic stats
      await this.updateTopicStats(client, attemptId);

      await client.query("COMMIT");
      return result.rows[0];
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
        SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) as correct_answers,
        SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END) as incorrect_answers,
        ROUND((SUM(CASE WHEN NOT ua.is_correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as error_percentage
      FROM user_answers ua
      INNER JOIN exam_attempts ea ON ua.attempt_id = ea.id
      INNER JOIN questions q ON ua.question_id = q.id
      INNER JOIN exams e ON q.exam_id = e.id
      INNER JOIN question_topic_mapping qtm ON q.id = qtm.question_id
      WHERE ea.id = $1
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
  async getUserHistory(userId, subjectCode = null, limit = 10) {
    let query = `
      SELECT 
        ea.*,
        e.code as exam_code,
        e.title as exam_title,
        s.name as subject_name,
        s.code as subject_code
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
        e.total_questions,
        s.name as subject_name
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
        q.question_number,
        q.question_text,
        q.question_text_cn,
        q.points,
        q.explanation,
        ua.selected_answer_key as user_answer,
        ua.is_correct,
        (SELECT answer_key FROM answers WHERE question_id = q.id AND is_correct = true LIMIT 1) as correct_answer
      FROM questions q
      LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.attempt_id = $1
      WHERE q.exam_id = $2
      ORDER BY q.question_number
    `;

    const questionsResult = await pool.query(questionsQuery, [
      attemptId,
      attempt.exam_id,
    ]);

    // FIX N+1: Fetch ALL answers for all questions in a single query
    const allAnswersResult = await pool.query(
      `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, a.is_correct
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
      questionAnswers.forEach((a) => {
        optionMap[a.answer_key] = a.answer_text;
      });

      const userAnswerKey = question.user_answer;
      const correctAnswerKey = question.correct_answer;

      formattedAnswers.push({
        question_number: question.question_number,
        question_text: question.question_text,
        question_text_cn: question.question_text_cn,
        selected_answer_key: userAnswerKey,
        selected_answer_text: userAnswerKey
          ? `${userAnswerKey}. ${optionMap[userAnswerKey] || ""}`
          : "Bỏ qua",
        correct_answer_key: correctAnswerKey,
        correct_answer_text: correctAnswerKey
          ? `${correctAnswerKey}. ${optionMap[correctAnswerKey] || ""}`
          : "",
        is_correct: question.is_correct || false,
        points: question.points,
        explanation: question.explanation,
        options: questionAnswers.map((a) => ({
          key: a.answer_key,
          text: a.answer_text,
          text_cn:
            a.answer_text_cn && a.answer_text_cn !== a.answer_text
              ? a.answer_text_cn
              : null,
          is_correct: a.is_correct,
        })),
      });
    }

    attempt.answers = formattedAnswers;

    return attempt;
  },
};

module.exports = ExamAttempt;
