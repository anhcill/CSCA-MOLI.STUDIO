export const CUTE_AI_LOADING_MESSAGES = [
  'AI dễ thương 🤖✨',
  '🤔 Đang suy nghĩ một chút...',
  '🧠 AI đang động não cực mạnh...',
  '✨ Đang tạo câu trả lời xịn sò...',
  '☕ Cho AI nhấp ngụm cà phê đã...',
  '🔍 Đang tìm câu trả lời hay nhất...',
  '🌟 Sắp xong rồi nè...',
  '🚀 AI đang tăng tốc...',
];

export function pickCuteAILoadingMessage(seed = Date.now()) {
  const index = Math.abs(Math.floor(seed)) % CUTE_AI_LOADING_MESSAGES.length;
  return CUTE_AI_LOADING_MESSAGES[index];
}
