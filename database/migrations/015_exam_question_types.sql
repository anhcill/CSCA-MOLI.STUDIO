-- Migration: Thêm linked_options (jsonb) và sub_question_number cho bảng questions
-- Hỗ trợ: fill_blank_pool (điền từ A-F), reading_passage (số câu con 34,35,36...)

-- 1. Thêm sub_question_number (số câu con trong nhóm đọc hiểu, nullable)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sub_question_number INTEGER;

-- 2. Thêm question_type mở rộng (nếu chưa có)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_question_type;
ALTER TABLE questions ADD CONSTRAINT chk_question_type
    CHECK (question_type IN (
        'single_choice',
        'fill_blank_pool',
        'fill_blank_pool_item',
        'reading_passage',
        'reading_item'
    ));

-- 3. linked_options: JSONB - pool đáp án dùng chung (cho fill_blank_pool)
--    Format: [{key: "A", text: "符号"}, {key: "B", text: "密度"}, ...]
-- 4. correct_answer_key: đáp án đúng dạng "A", "B", "C" thay vì dùng bảng answers

COMMENT ON COLUMN questions.linked_options IS 'JSONB array: [{key:"A", text:"符号", textCn:"符号"}, ...] - dùng chung cho nhóm fill_blank_pool';
COMMENT ON COLUMN questions.sub_question_number IS 'Số thứ tự câu CON trong đoạn đọc hiểu. VD: 34, 35, 36 - nullable';
