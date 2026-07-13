import type { QuestionReportType } from '@/lib/api/exams';

export const QUESTION_REPORT_TYPES: { value: QuestionReportType; label: string }[] = [
  { value: 'wrong_answer', label: 'Sai đáp án' },
  { value: 'formula_error', label: 'Lỗi công thức' },
  { value: 'translation_error', label: 'Lỗi dịch' },
  { value: 'missing_image', label: 'Thiếu hình ảnh' },
  { value: 'missing_data', label: 'Thiếu dữ kiện' },
  { value: 'duplicate_question', label: 'Trùng câu hỏi' },
  { value: 'answer_mismatch', label: 'Đề/đáp án không khớp' },
  { value: 'other', label: 'Lỗi khác' },
];

export const QUESTION_REPORT_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_REPORT_TYPES.map(item => [item.value, item.label]),
);

const QUESTION_REPORT_DEFAULT_DESCRIPTIONS: Record<string, string> = {
  wrong_answer: 'Người dùng cho rằng đáp án đúng của câu hỏi bị sai.',
  formula_error: 'Người dùng phát hiện công thức hoặc ký hiệu toán học hiển thị sai.',
  translation_error: 'Người dùng phát hiện nội dung bản dịch không chính xác.',
  missing_image: 'Người dùng báo câu hỏi đang thiếu hình ảnh cần thiết.',
  missing_data: 'Người dùng báo câu hỏi đang thiếu dữ kiện để giải.',
  duplicate_question: 'Người dùng báo câu hỏi này bị trùng với câu khác.',
  answer_mismatch: 'Người dùng cho rằng nội dung đề và các phương án trả lời không khớp nhau.',
  other: 'Người dùng báo câu hỏi có lỗi khác nhưng không nhập mô tả thêm.',
};

export function questionReportLabel(type: string) {
  return QUESTION_REPORT_LABELS[type] || type.replace(/_/g, ' ');
}

export function questionReportDescription(type: string, description?: string | null) {
  return description?.trim() || QUESTION_REPORT_DEFAULT_DESCRIPTIONS[type] || 'Người dùng không nhập mô tả thêm.';
}
