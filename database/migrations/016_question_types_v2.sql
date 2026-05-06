-- Migration 016: Bổ sung question_type mở rộng cho đề tiếng Trung
-- Hỗ trợ đủ 6 loại câu hỏi:
--   single_choice        - Trắc nghiệm A/B/C/D (câu 1-10, 26-33, 49-70)
--   fill_blank_pool      - Bắt đầu nhóm Điền từ, có linked_options A-F (câu 11-15)
--   fill_blank_item      - Câu điền từ con trong nhóm, dùng linked_options của câu cha
--   reading_passage      - Bắt đầu đoạn đọc hiểu (câu 34, 71...)
--   reading_item         - Câu con trong đoạn đọc hiểu (câu 35, 36... 72, 73...)

-- 1. Cập nhật question_type default
ALTER TABLE questions
  ALTER COLUMN question_type
  SET DEFAULT 'single_choice';

-- 2. Thêm ràng buộc mới
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_question_type_v2;
ALTER TABLE questions ADD CONSTRAINT chk_question_type_v2
  CHECK (question_type IN (
    'single_choice',
    'fill_blank_pool',
    'fill_blank_item',
    'reading_passage',
    'reading_item',
    'true_false'
  ));

-- 3. Chú thích
COMMENT ON COLUMN questions.question_type IS
  'single_choice: trắc nghiệm A-B-C-D | fill_blank_pool: điền từ (đầu nhóm, có linked_options) | fill_blank_item: điền từ con | reading_passage: đọc hiểu (đầu nhóm) | reading_item: câu con đọc hiểu | true_false: đúng sai';
COMMENT ON COLUMN questions.linked_options IS
  'JSONB: [{key:"A",text:"符号",textCn:"符号"},...] - pool đáp án cho fill_blank_pool';
COMMENT ON COLUMN questions.sub_question_number IS
  'Số câu con trong nhóm đọc hiểu. VD: câu 34 đánh số 34, câu 35 đánh số 35.';
