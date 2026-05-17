-- Optional question category used by attempt detail and learning insight queries.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_category VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_questions_question_category
  ON questions(question_category)
  WHERE question_category IS NOT NULL;
