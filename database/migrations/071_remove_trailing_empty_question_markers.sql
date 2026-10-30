WITH normalized AS (
  SELECT
    q.id,
    CASE
      WHEN q.question_text ~ '([[:space:] ]+|[^A-Za-z0-9_])([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$'
      THEN rtrim(regexp_replace(q.question_text, '([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$', ''))
      ELSE q.question_text
    END AS question_text,
    CASE
      WHEN q.question_text_cn ~ '([[:space:] ]+|[^A-Za-z0-9_])([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$'
      THEN rtrim(regexp_replace(q.question_text_cn, '([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$', ''))
      ELSE q.question_text_cn
    END AS question_text_cn,
    CASE
      WHEN q.question_text_en ~ '([[:space:] ]+|[^A-Za-z0-9_])([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$'
      THEN rtrim(regexp_replace(q.question_text_en, '([(][[:space:] ]*[)]|（[[:space:] ]*）)[[:space:] ]*$', ''))
      ELSE q.question_text_en
    END AS question_text_en
  FROM questions q
  JOIN exams e ON e.id = q.exam_id
  WHERE q.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND q.question_type IN ('single_choice', 'reading_item')
)
UPDATE questions q
SET
  question_text = normalized.question_text,
  question_text_cn = normalized.question_text_cn,
  question_text_en = normalized.question_text_en
FROM normalized
WHERE q.id = normalized.id
  AND ROW(q.question_text, q.question_text_cn, q.question_text_en)
      IS DISTINCT FROM ROW(normalized.question_text, normalized.question_text_cn, normalized.question_text_en);
