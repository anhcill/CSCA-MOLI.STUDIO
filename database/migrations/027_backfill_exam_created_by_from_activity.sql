-- Backfill legacy exams that were created before exams.created_by was tracked.
-- Uses the earliest admin.create_exam activity carrying metadata.examId.

UPDATE exams e
SET
  created_by = owner.user_id,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (((ua.metadata::jsonb ->> 'examId')::int))
    ((ua.metadata::jsonb ->> 'examId')::int) AS exam_id,
    ua.user_id
  FROM user_activities ua
  WHERE ua.action = 'admin.create_exam'
    AND ua.metadata IS NOT NULL
    AND (ua.metadata::jsonb ->> 'examId') ~ '^[0-9]+$'
  ORDER BY ((ua.metadata::jsonb ->> 'examId')::int), ua.created_at ASC
) owner
WHERE e.id = owner.exam_id
  AND e.created_by IS NULL;
