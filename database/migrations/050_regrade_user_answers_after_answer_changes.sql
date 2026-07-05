-- Backfill user_answers after admin answer-key changes.
-- Keeps historical attempts consistent with current answers.is_correct.

BEGIN;

CREATE TEMP TABLE tmp_regraded_question_attempts (
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL
) ON COMMIT DROP;

WITH answer_key_truth AS (
  SELECT
    question_id,
    answer_key,
    BOOL_OR(is_correct) AS is_correct,
    COALESCE(
      MIN(id) FILTER (WHERE is_correct),
      MIN(id)
    ) AS preferred_answer_id
  FROM answers
  GROUP BY question_id, answer_key
),
changed AS (
  UPDATE user_answers ua
  SET selected_answer_id = answer_key_truth.preferred_answer_id,
      is_correct = answer_key_truth.is_correct
  FROM answer_key_truth
  WHERE ua.question_id = answer_key_truth.question_id
    AND ua.selected_answer_key = answer_key_truth.answer_key
    AND (
      ua.selected_answer_id IS DISTINCT FROM answer_key_truth.preferred_answer_id
      OR ua.is_correct IS DISTINCT FROM answer_key_truth.is_correct
    )
  RETURNING ua.attempt_id, ua.question_id
)
INSERT INTO tmp_regraded_question_attempts (attempt_id, question_id)
SELECT DISTINCT attempt_id, question_id
FROM changed;

WITH affected_attempts AS (
  SELECT DISTINCT attempt_id
  FROM tmp_regraded_question_attempts
),
stats AS (
  SELECT
    ea.id AS attempt_id,
    COUNT(q.id)::int AS total_questions,
    COUNT(ua.id)::int AS total_answered,
    COUNT(*) FILTER (
      WHERE ua.id IS NOT NULL AND (
        (q.question_type <> ALL(ARRAY['essay','translation']::varchar[]) AND ua.is_correct IS TRUE)
        OR (q.question_type = ANY(ARRAY['essay','translation']::varchar[]) AND ua.score_awarded IS NOT NULL
            AND ua.score_awarded >= q.points * 0.5)
      )
    )::int AS total_correct,
    COUNT(*) FILTER (
      WHERE ua.id IS NOT NULL AND (
        (q.question_type <> ALL(ARRAY['essay','translation']::varchar[]) AND ua.is_correct IS FALSE)
        OR (q.question_type = ANY(ARRAY['essay','translation']::varchar[]) AND ua.score_awarded IS NOT NULL
            AND ua.score_awarded < q.points * 0.5)
      )
    )::int AS total_incorrect,
    COUNT(*) FILTER (
      WHERE ua.id IS NOT NULL AND q.question_type = ANY(ARRAY['essay','translation']::varchar[])
        AND ua.score_awarded IS NULL
    )::int AS total_pending_grading,
    COALESCE(SUM(
      CASE
        WHEN q.question_type = ANY(ARRAY['essay','translation']::varchar[]) THEN COALESCE(ua.score_awarded, 0)
        WHEN ua.is_correct IS TRUE THEN q.points
        ELSE 0
      END
    ), 0)::numeric AS total_score,
    COALESCE(SUM(q.points), 0)::numeric AS total_possible_score
  FROM affected_attempts aa
  INNER JOIN exam_attempts ea ON ea.id = aa.attempt_id
  INNER JOIN questions q
    ON q.exam_id = ea.exam_id
   AND q.question_type <> ALL(ARRAY['reading_passage','fill_blank_pool']::varchar[])
   AND (
     q.deleted_at IS NULL
     OR EXISTS (
       SELECT 1 FROM user_answers historical
       WHERE historical.attempt_id = ea.id AND historical.question_id = q.id
     )
   )
  LEFT JOIN user_answers ua
    ON ua.question_id = q.id AND ua.attempt_id = ea.id
  WHERE ea.status = 'completed'
  GROUP BY ea.id
)
UPDATE exam_attempts ea
SET total_score = stats.total_score,
    total_correct = stats.total_correct,
    total_incorrect = stats.total_incorrect,
    total_unanswered = GREATEST(0, stats.total_questions - stats.total_answered),
    total_possible_score = stats.total_possible_score,
    score_percentage = CASE
      WHEN stats.total_possible_score > 0
        THEN GREATEST(0, LEAST(100, stats.total_score / stats.total_possible_score * 100))
      ELSE 0
    END,
    total_pending_grading = stats.total_pending_grading
FROM stats
WHERE ea.id = stats.attempt_id;

DO $$
BEGIN
  IF to_regclass('public.ai_ask_cache') IS NOT NULL THEN
    DELETE FROM ai_ask_cache cache
    USING (
      SELECT DISTINCT question_id
      FROM tmp_regraded_question_attempts
    ) changed_questions
    WHERE cache.metadata->'cacheContext'->>'question_id' = changed_questions.question_id::text
       OR cache.metadata->'cacheContext'->>'questionId' = changed_questions.question_id::text;
  END IF;
END $$;

COMMIT;
