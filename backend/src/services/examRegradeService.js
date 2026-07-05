const {
  CONTAINER_QUESTION_TYPES,
  SUBJECTIVE_QUESTION_TYPES,
  scorePercentage,
} = require("../utils/examScoring");

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
    [attemptId, examId, CONTAINER_QUESTION_TYPES, SUBJECTIVE_QUESTION_TYPES],
  );

  const stats = result.rows[0];
  stats.total_unanswered = Math.max(
    0,
    Number(stats.total_questions || 0) - Number(stats.total_answered || 0),
  );
  stats.score_percentage = scorePercentage(stats.total_score, stats.total_possible_score);
  return stats;
}

async function recalculateCompletedAttempts(client, attemptIds) {
  const uniqueAttemptIds = [...new Set(attemptIds.map(Number).filter(Number.isFinite))];
  const recalculatedAttemptIds = [];

  for (const attemptId of uniqueAttemptIds) {
    const attemptResult = await client.query(
      `SELECT id, exam_id
       FROM exam_attempts
       WHERE id = $1 AND status = 'completed'`,
      [attemptId],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) continue;

    const stats = await calculateAttemptStats(client, attempt.id, attempt.exam_id);
    await client.query(
      `UPDATE exam_attempts
       SET total_score = $1,
           total_correct = $2,
           total_incorrect = $3,
           total_unanswered = $4,
           total_possible_score = $5,
           score_percentage = $6,
           total_pending_grading = $7
       WHERE id = $8`,
      [
        Number(stats.total_score) || 0,
        Number(stats.total_correct) || 0,
        Number(stats.total_incorrect) || 0,
        stats.total_unanswered,
        Number(stats.total_possible_score) || 0,
        Number(stats.score_percentage) || 0,
        Number(stats.total_pending_grading) || 0,
        attempt.id,
      ],
    );
    recalculatedAttemptIds.push(Number(attempt.id));
  }

  return recalculatedAttemptIds;
}

async function getCompletedAttemptIdsForQuestion(client, questionId, examId = null) {
  const result = await client.query(
    `SELECT DISTINCT ea.id
     FROM exam_attempts ea
     INNER JOIN user_answers ua ON ua.attempt_id = ea.id
     WHERE ua.question_id = $1
       AND ea.status = 'completed'
       AND ($2::int IS NULL OR ea.exam_id = $2)`,
    [questionId, examId],
  );
  return result.rows.map((row) => Number(row.id));
}

async function invalidateQuestionAiCache(client, questionId) {
  const tableResult = await client.query("SELECT to_regclass('public.ai_ask_cache') AS table_name");
  if (!tableResult.rows[0]?.table_name) return 0;

  const result = await client.query(
    `DELETE FROM ai_ask_cache
     WHERE metadata->'cacheContext'->>'question_id' = $1
        OR metadata->'cacheContext'->>'questionId' = $1`,
    [String(questionId)],
  );
  return result.rowCount || 0;
}

async function regradeQuestionAnswers(client, questionId, options = {}) {
  const questionResult = await client.query(
    `SELECT id, exam_id
     FROM questions
     WHERE id = $1`,
    [questionId],
  );
  const question = questionResult.rows[0];
  if (!question) {
    return {
      questionId: Number(questionId),
      examId: options.examId || null,
      changedAnswerRows: 0,
      attemptIds: [],
      recalculatedAttemptIds: [],
      aiCacheDeleted: 0,
    };
  }

  const examId = options.examId || question.exam_id || null;
  const changedResult = await client.query(
    `WITH answer_key_truth AS (
       SELECT
         question_id,
         answer_key,
         BOOL_OR(is_correct) AS is_correct,
         COALESCE(
           MIN(id) FILTER (WHERE is_correct),
           MIN(id)
         ) AS preferred_answer_id
       FROM answers
       WHERE question_id = $1
       GROUP BY question_id, answer_key
     )
     UPDATE user_answers ua
     SET selected_answer_id = answer_key_truth.preferred_answer_id,
         is_correct = answer_key_truth.is_correct
     FROM answer_key_truth
     WHERE ua.question_id = $1
       AND ua.selected_answer_key = answer_key_truth.answer_key
       AND (
         ua.selected_answer_id IS DISTINCT FROM answer_key_truth.preferred_answer_id
         OR ua.is_correct IS DISTINCT FROM answer_key_truth.is_correct
       )
     RETURNING ua.attempt_id`,
    [question.id],
  );

  let attemptIds = changedResult.rows.map((row) => Number(row.attempt_id));
  if (options.forceRecalculate) {
    attemptIds = [
      ...attemptIds,
      ...(await getCompletedAttemptIdsForQuestion(client, question.id, examId)),
    ];
  }

  const recalculatedAttemptIds = await recalculateCompletedAttempts(client, attemptIds);
  const aiCacheDeleted = options.invalidateAiCache === false
    ? 0
    : await invalidateQuestionAiCache(client, question.id);

  return {
    questionId: Number(question.id),
    examId: examId ? Number(examId) : null,
    changedAnswerRows: changedResult.rowCount || 0,
    attemptIds: [...new Set(attemptIds.map(Number).filter(Number.isFinite))],
    recalculatedAttemptIds,
    aiCacheDeleted,
  };
}

module.exports = {
  regradeQuestionAnswers,
  recalculateCompletedAttempts,
  invalidateQuestionAiCache,
};
