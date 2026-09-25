-- One exam can publish a separate question PDF and solution PDF for each language.
-- Existing files inherit the exam language so all current exams keep working.
ALTER TABLE admin_exam_source_files
  ADD COLUMN IF NOT EXISTS language_mode VARCHAR(20);

UPDATE admin_exam_source_files sf
SET language_mode = CASE
  WHEN e.language_mode IN ('vi', 'en', 'zh') THEN e.language_mode
  WHEN e.language_mode LIKE 'vi_%' THEN 'vi'
  WHEN e.language_mode LIKE 'en_%' THEN 'en'
  ELSE 'zh'
END
FROM exams e
WHERE e.id = sf.exam_id
  AND (sf.language_mode IS NULL OR sf.language_mode = '');

ALTER TABLE admin_exam_source_files
  ALTER COLUMN language_mode SET DEFAULT 'zh';

CREATE INDEX IF NOT EXISTS idx_admin_exam_source_files_exam_language
  ON admin_exam_source_files(exam_id, language_mode, created_at DESC)
  WHERE is_exam_paper = TRUE OR is_solution_file = TRUE;

-- Keep the chosen language with the attempt, so resumed attempts and the
-- post-exam PDF comparison always use the same version the learner saw.
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS paper_language_mode VARCHAR(20);

UPDATE exam_attempts ea
SET paper_language_mode = CASE
  WHEN e.language_mode IN ('vi', 'en', 'zh') THEN e.language_mode
  WHEN e.language_mode LIKE 'vi_%' THEN 'vi'
  WHEN e.language_mode LIKE 'en_%' THEN 'en'
  ELSE 'zh'
END
FROM exams e
WHERE e.id = ea.exam_id
  AND (ea.paper_language_mode IS NULL OR ea.paper_language_mode = '');

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_language
  ON exam_attempts(exam_id, user_id, paper_language_mode);
