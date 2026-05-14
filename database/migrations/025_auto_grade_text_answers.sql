-- Auto grading support for essay / translation questions.

ALTER TABLE user_answers
  ALTER COLUMN selected_answer_key TYPE VARCHAR(30)
  USING selected_answer_key::VARCHAR(30),
  ADD COLUMN IF NOT EXISTS score_awarded NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS grading_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS grading_feedback TEXT,
  ADD COLUMN IF NOT EXISTS grading_result JSONB,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_question_type;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_question_type_v2;
ALTER TABLE questions ADD CONSTRAINT chk_question_type
  CHECK (question_type IN (
    'single_choice',
    'fill_blank_pool',
    'fill_blank_item',
    'reading_passage',
    'reading_item',
    'true_false',
    'essay',
    'translation'
  ));

