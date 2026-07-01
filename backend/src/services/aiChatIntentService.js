function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const GREETING_RE = /^(hi|hello|helo|hey|alo|a\s*lo|chao|xin chao|yo|e|ê|hii+|hi+)[!.?\s]*$/i;

function isGreetingOnly(question = '') {
  return GREETING_RE.test(normalizeText(question));
}

function extractQuestionNumber(question = '') {
  const text = normalizeText(question);
  const patterns = [
    /\bcau\s*(?:so\s*)?(\d{1,3})\b/,
    /\bq(?:uestion)?\s*(\d{1,3})\b/,
    /#\s*(\d{1,3})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

function getQuestionByNumber(questions = [], questionNumber) {
  if (!Number.isInteger(questionNumber)) return null;
  return questions.find((item) => Number(item?.question_number) === questionNumber) || null;
}

function isVagueQuestionReview(question = '') {
  const text = normalizeText(question);
  const mentionsReviewTarget = /\bcau\s*(sai|dung|bo qua|bo trong|nay|do|kia)\b/.test(text)
    || /\b(sai|dung|bo qua|bo trong)\b/.test(text);
  const asksToExplain = /\b(giai|giai thich|xem|hoi|on|sua|vi sao|tai sao|lam sao|cach lam)\b/.test(text);
  return mentionsReviewTarget && asksToExplain && !extractQuestionNumber(question);
}

function buildQuestionChoices(questions = [], status, limit = 6) {
  const items = questions
    .filter((item) => {
      if (!status) return true;
      if (item.status) return item.status === status;
      if (status === 'unanswered') return !item.selected_answer_key;
      if (status === 'correct') return Boolean(item.is_correct);
      if (status === 'incorrect') return item.selected_answer_key && !item.is_correct;
      return true;
    })
    .slice(0, limit)
    .map((item) => `câu ${item.question_number}`);
  return items.length ? items.join(', ') : '';
}

function detectRequestedStatus(question = '') {
  const text = normalizeText(question);
  if (/\b(sai|nham)\b/.test(text)) return 'incorrect';
  if (/\b(bo qua|bo trong|chua lam)\b/.test(text)) return 'unanswered';
  if (/\b(dung|chuan)\b/.test(text)) return 'correct';
  return null;
}

function getDirectReply(question, context = {}) {
  const questions = Array.isArray(context.questions) ? context.questions : [];
  if (isGreetingOnly(question)) {
    return 'Hello nè. Bạn muốn hỏi mình câu nào trong bài này? Ví dụ: "giải câu 12" hoặc gửi ảnh đề cũng được.';
  }
  const questionNumber = extractQuestionNumber(question);
  if (!context.imageDataUrl && questions.length && questionNumber && !getQuestionByNumber(questions, questionNumber)) {
    return `Mình chưa thấy câu ${questionNumber} trong dữ liệu bài này. Bạn kiểm tra lại số câu hoặc gửi ảnh câu đó cho mình nha.`;
  }
  if (!context.imageDataUrl && questions.length && isVagueQuestionReview(question)) {
    const status = detectRequestedStatus(question);
    const choices = buildQuestionChoices(questions, status);
    return choices
      ? `Bạn muốn hỏi mình câu nào? Mình thấy có ${choices}. Chọn một câu trước, mình giải đúng câu đó cho gọn nha.`
      : 'Bạn muốn hỏi mình câu nào? Gõ kiểu "giải câu 12" là mình tập trung đúng câu đó nha.';
  }
  return null;
}

function focusQuestionsForPrompt(question, questions = []) {
  const questionNumber = extractQuestionNumber(question);
  const focusedQuestion = getQuestionByNumber(questions, questionNumber);
  if (questionNumber && !focusedQuestion) return { questions: [], focusedQuestion: null, questionNumber };
  if (!focusedQuestion) return { questions, focusedQuestion: null, questionNumber };
  return { questions: [focusedQuestion], focusedQuestion, questionNumber };
}

module.exports = {
  extractQuestionNumber,
  focusQuestionsForPrompt,
  getDirectReply,
  isGreetingOnly,
};
