export const AI_CHAT_WELCOME_MESSAGE =
    'Chào bạn, mình đây. Bạn muốn hỏi mình câu nào trong bài này?';

export const AI_CHAT_RESET_MESSAGE =
    'Mình dọn chat xong rồi. Bạn muốn hỏi câu nào tiếp nè?';

export const AI_CHAT_GREETING_REPLY =
    'Hello nè. Bạn muốn hỏi mình câu nào trong bài này? Ví dụ: "giải câu 12" hoặc gửi ảnh đề cũng được.';

export const QUICK_QUESTIONS = [
    { label: 'Câu sai', prompt: 'Hãy xem lại các câu tôi làm sai trong bài này. Nếu có nhiều câu, hãy hỏi tôi muốn xem câu số mấy trước.', emoji: '❓' },
    { label: 'Câu bỏ qua', prompt: 'Hãy xem các câu tôi bỏ qua. Nếu có nhiều câu, hãy hỏi tôi muốn bắt đầu từ câu số mấy.', emoji: '⏳' },
    { label: 'Câu đúng', prompt: 'Hãy giúp tôi củng cố một câu đúng. Nếu có nhiều câu, hãy hỏi tôi muốn xem câu số mấy.', emoji: '✅' },
    { label: 'Học gì tiếp?', prompt: 'Tôi nên học gì tiếp theo để cải thiện sau bài này?', emoji: '🎯' },
];

const GREETING_RE = /^(hi|hello|helo|hey|alo|a\s*lo|chao|chào|xin chào|yo|ê|e|hí|hii+|hi+)\s*[!.?]*$/i;

export function isGreetingOnly(value: string) {
    return GREETING_RE.test(value.trim());
}
