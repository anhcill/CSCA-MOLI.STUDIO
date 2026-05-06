-- Migration 017: Thêm passage_group_id để nhóm câu trong cùng đoạn đọc hiểu
-- Khi tạo reading_passage: passage_group_id = question_id mới
-- Khi tạo reading_item: passage_group_id = passage_group_id của câu cha gần nhất

-- passage_group_id: INT FK tự tham chiếu, cho phép NULL
-- (câu thường: NULL | câu trong nhóm đọc hiểu: = ID câu passage đầu nhóm)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS passage_group_id INTEGER
  REFERENCES questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_passage_group
  ON questions(exam_id, passage_group_id)
  WHERE passage_group_id IS NOT NULL;
