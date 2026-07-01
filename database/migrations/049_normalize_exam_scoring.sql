-- Normalize weighted exam scoring and keep subjective answers explicit.

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS total_possible_score NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS score_percentage NUMERIC(7,3),
  ADD COLUMN IF NOT EXISTS total_pending_grading INTEGER NOT NULL DEFAULT 0;

UPDATE user_answers ua
SET max_score = q.points,
    grading_status = COALESCE(ua.grading_status, 'pending')
FROM questions q
WHERE q.id = ua.question_id
  AND q.question_type IN ('essay', 'translation')
  AND ua.essay_answer IS NOT NULL
  AND BTRIM(ua.essay_answer) <> '';

WITH totals AS (
  SELECT e.id,
         COUNT(q.id) FILTER (
           WHERE q.deleted_at IS NULL
             AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
         )::int AS total_questions,
         COALESCE(SUM(q.points) FILTER (
           WHERE q.deleted_at IS NULL
             AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
         ), 0)::numeric AS total_points
  FROM exams e
  LEFT JOIN questions q ON q.exam_id = e.id
  GROUP BY e.id
)
UPDATE exams e
SET total_questions = totals.total_questions,
    total_points = totals.total_points
FROM totals
WHERE totals.id = e.id;

UPDATE exam_attempts ea
SET total_possible_score = e.total_points,
    score_percentage = CASE
      WHEN e.total_points > 0 THEN ROUND(ea.total_score / e.total_points * 100, 3)
      ELSE 0
    END,
    total_pending_grading = (
      SELECT COUNT(*)::int
      FROM user_answers ua
      JOIN questions q ON q.id = ua.question_id
      WHERE ua.attempt_id = ea.id
        AND q.question_type IN ('essay', 'translation')
        AND ua.score_awarded IS NULL
    )
FROM exams e
WHERE e.id = ea.exam_id;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_score_percentage
  ON exam_attempts(score_percentage DESC)
  WHERE status = 'completed';
