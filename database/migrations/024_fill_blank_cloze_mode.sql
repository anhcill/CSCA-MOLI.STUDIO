-- Support two Chinese fill-blank formats:
--   sentences: separate sentence blanks using the same option pool
--   passage: one continuous passage with multiple blanks using the same option pool

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS cloze_mode VARCHAR(20) DEFAULT 'sentences';

UPDATE questions
SET cloze_mode = 'passage'
WHERE question_type = 'fill_blank_pool'
  AND (cloze_mode IS NULL OR cloze_mode = 'sentences');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_cloze_mode'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_cloze_mode
      CHECK (cloze_mode IS NULL OR cloze_mode IN ('sentences', 'passage'));
  END IF;
END $$;

COMMENT ON COLUMN questions.cloze_mode IS
  'For fill_blank_pool: sentences = separate sentence blanks, passage = continuous passage cloze.';
