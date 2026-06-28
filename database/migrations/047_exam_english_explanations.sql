ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_text_en TEXT,
  ADD COLUMN IF NOT EXISTS explanation_en TEXT;

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS answer_text_en TEXT;
