-- Soft-delete questions that already have user answer history.
-- Hard-deleting those rows breaks foreign keys from user_answers and loses audit/history data.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_question_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_questions_deleted_at
  ON questions(deleted_at);

CREATE INDEX IF NOT EXISTS idx_questions_exam_active
  ON questions(exam_id, question_number)
  WHERE deleted_at IS NULL;
