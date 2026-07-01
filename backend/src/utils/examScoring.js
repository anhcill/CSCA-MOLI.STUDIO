const CONTAINER_QUESTION_TYPES = ["reading_passage", "fill_blank_pool"];
const SUBJECTIVE_QUESTION_TYPES = ["essay", "translation"];

function scorePercentage(score, possibleScore) {
  const earned = Number(score) || 0;
  const possible = Number(possibleScore) || 0;
  if (possible <= 0) return 0;
  return Math.max(0, Math.min(100, (earned / possible) * 100));
}

function scaleTenPointScore(scoreOnTen, maxScore) {
  const normalized = Math.max(0, Math.min(10, Number(scoreOnTen) || 0));
  const maximum = Math.max(0, Number(maxScore) || 0);
  return Math.round((normalized / 10) * maximum * 100) / 100;
}

async function syncExamTotals(client, examId) {
  await client.query(
    `UPDATE exams e
     SET total_questions = totals.total_questions,
         total_points = totals.total_points,
         updated_at = CURRENT_TIMESTAMP
     FROM (
       SELECT COUNT(*)::int AS total_questions,
              COALESCE(SUM(points), 0)::numeric AS total_points
       FROM questions
       WHERE exam_id = $1
         AND deleted_at IS NULL
         AND question_type <> ALL($2::varchar[])
     ) totals
     WHERE e.id = $1`,
    [examId, CONTAINER_QUESTION_TYPES],
  );
}

module.exports = {
  CONTAINER_QUESTION_TYPES,
  SUBJECTIVE_QUESTION_TYPES,
  scorePercentage,
  scaleTenPointScore,
  syncExamTotals,
};
