const { pool } = require("../config/database");
const aiService = require("../services/aiService");

const AUTO_GRADED_TYPES = new Set(["essay", "translation"]);

function clampScore(value, min, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeTextForGrade(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/u.test(value || "");
}

function similarity(a, b) {
  const left = normalizeTextForGrade(a);
  const right = normalizeTextForGrade(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const tokenize = (text) => {
    if (hasCjk(text)) return Array.from(text.replace(/\s+/g, ""));
    return normalizeTextForGrade(text).split(" ").filter(Boolean);
  };
  const leftTokens = tokenize(a);
  const rightTokens = tokenize(b);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightCounts = new Map();
  for (const token of rightTokens) {
    rightCounts.set(token, (rightCounts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }

  return (2 * overlap) / (leftTokens.length + rightTokens.length);
}

function fallbackGradeTextAnswer(userAnswer, correctAnswers, maxPoints) {
  const answer = String(userAnswer || "").trim();
  const refs = (correctAnswers || []).map((v) => String(v || "").trim()).filter(Boolean);
  const points = clampScore(maxPoints, 0, 100);

  if (!answer) {
    return {
      score: 0,
      isCorrect: false,
      status: "graded",
      feedback: "Chua co cau tra loi.",
      result: { source: "fallback", totalScore: 0, feedback: "Chua co cau tra loi." },
    };
  }

  if (refs.length === 0) {
    return {
      score: 0,
      isCorrect: false,
      status: "needs_review",
      feedback: "Cau hoi chua co dap an mau de cham tu dong.",
      result: {
        source: "fallback",
        totalScore: 0,
        feedback: "Cau hoi chua co dap an mau de cham tu dong.",
      },
    };
  }

  const best = Math.max(...refs.map((ref) => similarity(answer, ref)));
  let ratio = 0;
  if (best >= 0.92) ratio = 1;
  else if (best >= 0.75) ratio = 0.8;
  else if (best >= 0.55) ratio = 0.55;

  const score = Number((points * ratio).toFixed(2));
  const totalScore = Number((ratio * 10).toFixed(1));
  const feedback = ratio >= 1
    ? "Khop dap an mau."
    : ratio > 0
      ? "Gan dung dap an mau, can doi chieu lai y/chinh xac ngon ngu."
      : "Chua khop dap an mau.";

  return {
    score,
    isCorrect: score >= points * 0.6,
    status: "graded",
    feedback,
    result: {
      source: "fallback",
      totalScore,
      similarity: Number(best.toFixed(3)),
      feedback,
      modelAnswer: refs[0],
    },
  };
}

const ExamAttempt = {
  // Bắt đầu làm bài thi
  async start(userId, examId) {
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
  async saveAnswer(attemptId, questionId, selectedAnswerKey, timeSpent, essayAnswer = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lấy thông tin câu hỏi để xác định loại
      const qResult = await client.query(
        `SELECT question_type FROM questions WHERE id = $1`,
        [questionId]
      );
      const questionType = qResult.rows[0]?.question_type;

      // Nếu là câu tự luận hoặc dịch thuật → lưu essay_answer, không check đáp án
      if (questionType === 'essay' || questionType === 'translation') {
        const upsertQuery = `
          INSERT INTO user_answers (
            attempt_id, question_id, selected_answer_key,
            selected_answer_id, is_correct, time_spent_seconds, essay_answer,
            score_awarded, max_score, grading_status, grading_feedback, grading_result, graded_at
          ) VALUES ($1, $2, $3, NULL, NULL, $4, $5, NULL, NULL, 'pending', NULL, NULL, NULL)
          ON CONFLICT (attempt_id, question_id)
          DO UPDATE SET
            selected_answer_key = $3,
            essay_answer = $5,
            time_spent_seconds = $4,
            score_awarded = NULL,
            max_score = NULL,
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
          selectedAnswerKey || 'ESSAY',
          timeSpent || 0,
          essayAnswer,
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
          score_awarded = NULL,
          max_score = NULL,
          grading_status = NULL,
          grading_feedback = NULL,
          grading_result = NULL,
          graded_at = NULL,
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
  async autoGradeTextAnswers(client, attemptId) {
    const answersResult = await client.query(
      `SELECT
         ua.id,
         ua.question_id,
         ua.essay_answer,
         q.question_type,
         q.question_text,
         q.question_text_cn,
         q.points,
         COALESCE(
           json_agg(
             json_build_object(
               'answer_text', a.answer_text,
               'answer_text_cn', a.answer_text_cn,
               'is_correct', a.is_correct
             )
             ORDER BY a.is_correct DESC, a.answer_key ASC
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'
         ) AS correct_answers
       FROM user_answers ua
       INNER JOIN questions q ON q.id = ua.question_id
       LEFT JOIN answers a
         ON a.question_id = q.id
        AND (a.is_correct = TRUE OR NOT EXISTS (
          SELECT 1 FROM answers ca WHERE ca.question_id = q.id AND ca.is_correct = TRUE
        ))
       WHERE ua.attempt_id = $1
         AND q.question_type = ANY($2::text[])
       GROUP BY ua.id, ua.question_id, ua.essay_answer, q.question_type,
                q.question_text, q.question_text_cn, q.points`,
      [attemptId, Array.from(AUTO_GRADED_TYPES)]
    );

    for (const row of answersResult.rows) {
      const maxPoints = clampScore(row.points, 0, 100);
      const refs = (row.correct_answers || [])
        .flatMap((answer) => [answer.answer_text, answer.answer_text_cn])
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      let grade = null;
      const userAnswer = String(row.essay_answer || "").trim();
      const correctAnswer = refs[0] || "";

      if (userAnswer && correctAnswer && !aiService.isRateLimited()) {
        try {
          const aiGrade = await aiService.gradeEssay({
            questionText: row.question_text,
            questionTextCn: row.question_text_cn,
            userAnswer,
            correctAnswer: refs.join("\n---\n"),
            questionType: row.question_type,
          });

          const hasUsefulAiResult =
            aiGrade &&
            (aiGrade.totalScore > 0 ||
              (Array.isArray(aiGrade.gradingCriteria) && aiGrade.gradingCriteria.length > 0) ||
              (Array.isArray(aiGrade.errors) && aiGrade.errors.length > 0) ||
              (Array.isArray(aiGrade.suggestions) && aiGrade.suggestions.length > 0) ||
              aiGrade.modelAnswer);

          if (hasUsefulAiResult) {
            const totalScore = clampScore(aiGrade.totalScore, 0, 10);
            const score = Number(((maxPoints * totalScore) / 10).toFixed(2));
            grade = {
              score,
              isCorrect: score >= maxPoints * 0.6,
              status: "graded",
              feedback: aiGrade.feedback || "",
              result: { ...aiGrade, source: "ai" },
            };
          }
        } catch (error) {
          if (error.message !== "RATE_LIMITED") {
            console.error("Auto grade text answer error:", error.message);
          }
        }
      }

      if (!grade) {
        grade = fallbackGradeTextAnswer(userAnswer, refs, maxPoints);
      }

      await client.query(
        `UPDATE user_answers
         SET is_correct = $1,
             score_awarded = $2,
             max_score = $3,
             grading_status = $4,
             grading_feedback = $5,
             grading_result = $6::jsonb,
             graded_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [
          grade.isCorrect,
          grade.score,
          maxPoints,
          grade.status,
          grade.feedback,
          JSON.stringify(grade.result || {}),
          row.id,
        ]
      );
    }
  },

  async submit(attemptId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await this.autoGradeTextAnswers(client, attemptId);

      // Calculate scores
      const statsQuery = `
        SELECT 
          COALESCE(COUNT(*), 0) as total_answered,
          COALESCE(SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END), 0) as total_correct,
          COALESCE(SUM(CASE WHEN ua.is_correct = FALSE THEN 1 ELSE 0 END), 0) as total_incorrect,
          COALESCE(SUM(COALESCE(ua.score_awarded, CASE WHEN ua.is_correct THEN q.points ELSE 0 END)), 0) as total_score
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
        e.total_questions,
        s.name as subject_name,
        s.code as subject_code,
        (
          SELECT COUNT(*)::INTEGER
          FROM questions q WHERE q.exam_id = e.id
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
        e.total_questions,
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
        q.question_number,
        q.question_text,
        q.question_text_cn,
        q.question_type,
        q.points,
        q.explanation,
        ua.selected_answer_key as user_answer,
        ua.essay_answer,
        ua.is_correct,
        ua.score_awarded,
        ua.max_score,
        ua.grading_status,
        ua.grading_feedback,
        ua.grading_result,
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
      const isTextQuestion = AUTO_GRADED_TYPES.has(question.question_type);
      const correctTextAnswer = questionAnswers
        .filter((a) => a.is_correct || questionAnswers.every((candidate) => !candidate.is_correct))
        .map((a) => a.answer_text_cn || a.answer_text)
        .filter(Boolean)
        .join("\n");
      const selectedAnswerText = isTextQuestion
        ? (question.essay_answer || "")
        : userAnswerKey
          ? `${userAnswerKey}. ${optionMap[userAnswerKey] || ""}`
          : "Bo qua";
      const correctAnswerText = isTextQuestion
        ? correctTextAnswer
        : correctAnswerKey
          ? `${correctAnswerKey}. ${optionMap[correctAnswerKey] || ""}`
          : "";

      formattedAnswers.push({
        question_number: question.question_number,
        question_text: question.question_text,
        question_text_cn: question.question_text_cn,
        question_type: question.question_type,
        selected_answer_key: userAnswerKey,
        selected_answer_text: userAnswerKey
          ? `${userAnswerKey}. ${optionMap[userAnswerKey] || ""}`
          : "Bỏ qua",
        correct_answer_key: correctAnswerKey,
        correct_answer_text: correctAnswerKey
          ? `${correctAnswerKey}. ${optionMap[correctAnswerKey] || ""}`
          : "",
        selected_answer_text: selectedAnswerText,
        correct_answer_text: correctAnswerText,
        is_correct: question.is_correct || false,
        points: question.points,
        score_awarded: question.score_awarded,
        max_score: question.max_score,
        grading_status: question.grading_status,
        grading_feedback: question.grading_feedback,
        grading_result: question.grading_result,
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

    // Attach video solution if exists
    attempt.solution_video_url = attempt.solution_video_url || null;
    attempt.solution_description = attempt.solution_description || null;

    return attempt;
  },
};

module.exports = ExamAttempt;
