import type { QuestionResult, QuestionReviewStatus } from './types';
import { getExamLanguageText } from '@/lib/exam/languageMode';

export const REVIEW_AI_ACCURACY_RULE =
  'Luôn giữ nguyên ký hiệu toán/logic trong đề và đáp án: <, <=, ≤, >, >=, ≥, =, ≠. Không đổi ≤ thành < hoặc ≥ thành >; nếu thiếu dữ kiện/hình ảnh thì nói thiếu, không đoán.';

export const REVIEW_AI_FORMAT_RULE =
  String.raw`FORMAT BAT BUOC: Khong dung **bold**, ###, ---/___, $$ hoac markdown phuc tap. Cong thuc Toan/Khoa hoc chi viet inline bang \(...\), vi du \(2^5=32\), \(|x|<3\), \(x\in\mathbb{Z}\). Khong de cong thuc bi tach thanh tung ky tu/tung dong. Neu can nhan manh, viet tieu de plain text nhu "Buoc 1: ..." hoac "Luu y: ...". Dung ky hieu →, ≤, ≥, ∈ trong van ban thuong; khong viet \to ngoai LaTeX. Tra loi gon thanh 3-5 muc: ket luan, cach lam, vi sao sai/dung, meo nho.`;

export function getQuestionReviewStatus(question: QuestionResult): QuestionReviewStatus {
  if (!question.selected_answer_key) return 'unanswered';
  return question.is_correct ? 'correct' : 'incorrect';
}

export function getReviewAIButtonLabel(status: QuestionReviewStatus) {
  if (status === 'correct') return 'Hỏi AI củng cố câu đúng';
  if (status === 'unanswered') return 'Hỏi AI hướng dẫn câu bỏ qua';
  return 'Hỏi AI giải thích thêm';
}

export function formatReviewAnswer(key?: string | null, text?: string | null, fallback = 'Bỏ qua') {
  if (!key) return fallback;
  const cleanText = (text || '').trim();
  return cleanText.startsWith(`${key}.`) ? cleanText : `${key}. ${cleanText}`.trim();
}

export function hasAltText(primary?: string | null, alt?: string | null) {
  const a = (primary || '').trim();
  const b = (alt || '').trim();
  return Boolean(b && b !== a);
}

export function getReviewCardClass(status: QuestionReviewStatus) {
  if (status === 'correct') return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50';
  if (status === 'incorrect') return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50';
  return 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800';
}

export function getOptionToneClass(isCorrect: boolean, isUserPick: boolean) {
  if (isCorrect) {
    return {
      bg: 'bg-green-100 dark:bg-green-950/40',
      border: 'border-green-500 dark:border-green-700',
      text: 'text-green-900 dark:text-green-100 font-semibold',
      secondary: 'text-green-700 dark:text-green-300',
    };
  }
  if (isUserPick) {
    return {
      bg: 'bg-red-100 dark:bg-red-950/40',
      border: 'border-red-500 dark:border-red-700',
      text: 'text-red-900 dark:text-red-100 font-semibold',
      secondary: 'text-red-700 dark:text-red-300',
    };
  }
  return {
    bg: 'bg-white dark:bg-gray-950/60',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-200',
    secondary: 'text-gray-500 dark:text-gray-400',
  };
}

export function getQuestionDisplayText(question: QuestionResult, preferredText?: string, languageMode?: string | null) {
  if (preferredText) return preferredText.trim();
  const selected = getExamLanguageText({
    vi: question.question_text,
    zh: question.question_text_cn,
    en: question.question_text_en,
  }, languageMode);
  return [selected.primary, selected.secondary].filter(Boolean).join('\n').trim();
}

function formatTrilingualBlock(label: string, values: { vi?: string | null; zh?: string | null; en?: string | null }) {
  return [
    values.zh ? `${label} (ZH): ${values.zh}` : '',
    values.vi ? `${label} (VI): ${values.vi}` : '',
    values.en ? `${label} (EN): ${values.en}` : '',
  ].filter(Boolean).join('\n');
}

function buildQuestionLanguageContext(question: QuestionResult) {
  const optionLines = (question.options || []).map((option) => [
    `${option.key}.`,
    option.text_cn ? `ZH: ${option.text_cn}` : '',
    option.text ? `VI: ${option.text}` : '',
    option.text_en ? `EN: ${option.text_en}` : '',
  ].filter(Boolean).join(' '));

  return [
    formatTrilingualBlock('Nội dung câu hỏi', {
      vi: question.question_text,
      zh: question.question_text_cn,
      en: question.question_text_en,
    }),
    optionLines.length ? `Các lựa chọn:\n${optionLines.join('\n')}` : '',
    formatTrilingualBlock('Đáp án học sinh chọn', {
      vi: formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bỏ qua'),
      zh: question.selected_answer_text_cn,
      en: question.selected_answer_text_en,
    }),
    formatTrilingualBlock('Đáp án đúng', {
      vi: formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng'),
      zh: question.correct_answer_text_cn,
      en: question.correct_answer_text_en,
    }),
    formatTrilingualBlock('Giải thích có sẵn', {
      vi: question.explanation,
      zh: question.explanation_cn,
      en: question.explanation_en,
    }),
  ].filter(Boolean).join('\n');
}

export function buildQuestionExplanationPrompt(question: QuestionResult, preferredText?: string, languageMode?: string | null) {
  const questionNo = question.sub_question_number || question.question_number;
  const questionText = getQuestionDisplayText(question, preferredText, languageMode);
  const selectedAnswer = formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bỏ qua');
  const correctAnswer = formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng');
  const base = [
    `Câu ${questionNo}`,
    questionText ? `Nội dung câu hỏi: ${questionText}` : '',
    buildQuestionLanguageContext(question),
    `Đáp án đúng: ${correctAnswer}`,
    REVIEW_AI_ACCURACY_RULE,
    REVIEW_AI_FORMAT_RULE,
    'Dữ liệu có thể có 3 ngôn ngữ: ZH/VI/EN. Khi giải thích, đọc đủ cả 3 field nếu có; không bỏ qua tiếng Anh.',
  ].filter(Boolean).join('\n');

  const status = getQuestionReviewStatus(question);
  if (status === 'correct') {
    return `${base}\nHọc sinh đã chọn đúng: ${selectedAnswer}.\nHãy giải thích vì sao đáp án này đúng, chỉ ra kiến thức cần nhớ, dấu hiệu nhận biết và bẫy dễ nhầm. Trả lời bằng tiếng Việt có dấu, ngắn gọn nhưng đủ ý.`;
  }
  if (status === 'unanswered') {
    return `${base}\nHọc sinh đã bỏ qua câu này.\nHãy hướng dẫn cách suy luận từ đầu, vì sao đáp án đúng là phù hợp, mẹo nhận biết lần sau và kiến thức cần ôn lại. Trả lời bằng tiếng Việt có dấu, dễ hiểu.`;
  }
  return `${base}\nHọc sinh đã chọn sai: ${selectedAnswer}.\nHãy giải thích vì sao lựa chọn này sai, vì sao đáp án đúng là phù hợp, kiến thức liên quan và mẹo ghi nhớ. Trả lời bằng tiếng Việt có dấu, dễ hiểu.`;
}

export function buildQuestionTheoryPrompt(question: QuestionResult, preferredText?: string, languageMode?: string | null) {
  const questionNo = question.sub_question_number || question.question_number;
  const questionText = getQuestionDisplayText(question, preferredText, languageMode);
  const selectedAnswer = formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bỏ qua');
  const correctAnswer = formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng');
  const status = getQuestionReviewStatus(question);
  const learnerState = status === 'correct'
    ? `Học sinh đã chọn đúng: ${selectedAnswer}`
    : status === 'unanswered'
      ? 'Học sinh đã bỏ qua câu này'
      : `Học sinh đã chọn sai: ${selectedAnswer}`;

  return [
    `Câu ${questionNo}`,
    questionText ? `Nội dung câu hỏi: ${questionText}` : '',
    buildQuestionLanguageContext(question),
    learnerState,
    `Đáp án đúng: ${correctAnswer}`,
    REVIEW_AI_ACCURACY_RULE,
    REVIEW_AI_FORMAT_RULE,
    'Dữ liệu có thể có 3 ngôn ngữ: ZH/VI/EN. Khi giảng lại, đọc đủ cả 3 field nếu có; không bỏ qua tiếng Anh.',
    'Hãy giảng lại lý thuyết liên quan trực tiếp tới câu này.',
    'Trả lời bằng tiếng Việt có dấu, gồm: kiến thức trọng tâm, cách nhận biết, ví dụ ngắn, lỗi dễ nhầm, mẹo nhớ.',
  ].filter(Boolean).join('\n');
}
