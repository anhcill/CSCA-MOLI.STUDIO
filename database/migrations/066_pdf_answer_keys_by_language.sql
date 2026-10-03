-- A PDF in each language can order its A-D choices independently.
CREATE TABLE IF NOT EXISTS exam_pdf_answer_keys (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  language_mode VARCHAR(20) NOT NULL CHECK (language_mode IN ('vi', 'en', 'zh')),
  question_number INTEGER NOT NULL CHECK (question_number > 0),
  answer_key VARCHAR(1) NOT NULL CHECK (answer_key IN ('A', 'B', 'C', 'D')),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_id, language_mode, question_number)
);

-- Preserve the old shared answer key only for the exam's original language.
-- Other PDF versions must receive their own key before students can start.
INSERT INTO exam_pdf_answer_keys (exam_id, language_mode, question_number, answer_key)
SELECT q.exam_id,
       CASE
         WHEN e.language_mode = 'vi' OR e.language_mode LIKE 'vi_%' THEN 'vi'
         WHEN e.language_mode = 'en' OR e.language_mode LIKE 'en_%' THEN 'en'
         ELSE 'zh'
       END,
       q.question_number,
       MAX(a.answer_key)
FROM questions q
JOIN exams e ON e.id = q.exam_id
JOIN answers a ON a.question_id = q.id AND a.is_correct = TRUE
WHERE q.deleted_at IS NULL
  AND q.question_number > 0
  AND EXISTS (
    SELECT 1 FROM admin_exam_source_files sf
    WHERE sf.exam_id = q.exam_id
      AND sf.is_exam_paper = TRUE
      AND sf.file_type = 'pdf'
      AND sf.file_data IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM exam_pdf_answer_keys existing WHERE existing.exam_id = q.exam_id
  )
  AND a.answer_key IN ('A', 'B', 'C', 'D')
GROUP BY q.exam_id, e.language_mode, q.question_number
ON CONFLICT (exam_id, language_mode, question_number) DO NOTHING;
