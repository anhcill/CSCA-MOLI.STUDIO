const { SOURCE_PROMPT_TEXT_LIMIT } = require("./types");

function buildSourceReviewPromptSection(sourceFile) {
  if (!sourceFile?.textContent) return "";
  const text = String(sourceFile.textContent || "").slice(0, SOURCE_PROMPT_TEXT_LIMIT);
  return `

File gốc đối chiếu:
- Tên file: ${sourceFile.fileName || "không rõ"}
- Loại file: ${sourceFile.fileType || "không rõ"}
- Text đã trích${sourceFile.truncatedForPrompt ? " (đã cắt ngắn để gửi AI)" : ""}:
${text}
`;
}

function buildSourceReviewRules(sourceFile) {
  if (!sourceFile?.textContent) return "";
  return `
- Có file gốc đối chiếu. Phải so DB hiện tại với file gốc khi file gốc có dữ kiện rõ.
- Nếu nội dung câu/đáp án DB lệch rõ so với file gốc, dùng status="source_mismatch".
- Nếu DB thiếu đáp án đúng nhưng file gốc thể hiện đáp án rõ, dùng status="missing_answer_from_source" và trả suggestedCorrectAnswer.
- Nếu thấy câu trong DB bị thiếu đoạn quan trọng so với file gốc hoặc có dấu hiệu import rơi câu, dùng status="missing_from_db" hoặc "source_mismatch" tùy trường hợp.
- Nếu file gốc cần để quyết định nhưng text trích chưa đủ rõ, dùng status="needs_source_review"; không đoán.
- Các status nguồn hợp lệ thêm: missing_from_db | missing_answer_from_source | source_mismatch | needs_source_review.
`;
}

function buildSourceFixRules(sourceFile) {
  if (!sourceFile?.textContent) return "";
  return `
- Với lỗi từ file gốc, chỉ sửa khi file gốc thể hiện rõ và review có confidence >= 0.75.
- Nếu status là missing_answer_from_source/source_mismatch mà không xác định chắc correctAnswer từ file gốc, không sửa đáp án; trả note lý do.
- Không tự thêm câu mới vào DB trong bước này. Với missing_from_db chỉ ghi note để admin xem tay.
`;
}

module.exports = {
  buildSourceReviewPromptSection,
  buildSourceReviewRules,
  buildSourceFixRules,
};
