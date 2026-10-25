-- Separate question-based topic practice exams from mock exams and PDF room files.
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS exam_type VARCHAR(30) NOT NULL DEFAULT 'mock';

UPDATE exams
SET exam_type = 'mock'
WHERE exam_type IS NULL OR BTRIM(exam_type) = '';

ALTER TABLE exams
  ALTER COLUMN exam_type SET DEFAULT 'mock',
  ALTER COLUMN exam_type SET NOT NULL;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES question_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_topic_practice_catalog
  ON exams(subject_id, topic_id, status, publish_date DESC)
  WHERE exam_type = 'topic_practice' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION sync_topic_practice_question_mapping()
RETURNS TRIGGER AS $$
DECLARE
  selected_topic_id INTEGER;
BEGIN
  SELECT topic_id INTO selected_topic_id
  FROM exams
  WHERE id = NEW.exam_id
    AND exam_type = 'topic_practice';

  IF selected_topic_id IS NOT NULL THEN
    INSERT INTO question_topic_mapping (question_id, topic_id)
    VALUES (NEW.id, selected_topic_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_topic_practice_question_mapping ON questions;
CREATE TRIGGER trg_sync_topic_practice_question_mapping
AFTER INSERT OR UPDATE OF exam_id ON questions
FOR EACH ROW EXECUTE FUNCTION sync_topic_practice_question_mapping();
