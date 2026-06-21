const aiService = require("./aiService");
const aiConfig = require("../config/aiConfig");

const IMAGE_OCR_MAX_TOKENS = 4500;

function cleanOcrText(value) {
  return String(value || "")
    .replace(/^```(?:text|txt|markdown)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSingleQuestionImageOcrMessages(file) {
  const mimeType = file.mimetype || "image/png";
  const base64 = file.buffer.toString("base64");
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const prompt = `You are an OCR engine for one exam question image.

Return ONLY the OCR text. Do not solve the question. Do not add commentary.

Rules:
- Preserve original language: Chinese, Vietnamese, English, symbols.
- Do not translate, summarize, reorder, or correct the exam content.
- Transcribe exactly what is visible. If a small part is unreadable, write [không rõ] instead of guessing.
- Preserve question number, A/B/C/D options, answer marker if visible, and explanation markers like 解析, 答案解析, 解答, 说明, Lời giải, Giải thích.
- Preserve math as clean text/LaTeX where visible: fractions, roots, powers, vectors, log/trig/lim/sum/int, systems, intervals.
- Preserve comparison signs exactly: <, <=, ≤, >, >=, ≥, =, ≠. Do not change ≤ to <, ≥ to >, or strict signs to non-strict signs.
- Preserve negative signs, decimal points, exponents, subscripts, domain conditions, set/interval notation, and answer labels exactly where visible.
- Keep option labels exactly as A., B., C., D. on separate lines when visible.
- If the image contains a stacked fraction, write it as \\frac{numerator}{denominator}.
- If the image contains a brace system of equations, write it as \\begin{cases} row1 \\\\ row2 \\end{cases}.
- Use single LaTeX backslashes like \\frac and \\( ... \\). Do not double-escape as \\\\frac or \\\\(.
- If text color indicates the correct answer and the letter is visible, include a line like "答案: B". If color is ambiguous, do not guess.
- If the question needs a diagram/table/chart, include a short line "Hình: ..." listing only visible labels, numbers, arrows, axes, or table headers.
- Keep line breaks between question, options, and explanation.`;

  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
}

async function extractSingleQuestionImageOcrText(file, options = {}) {
  const raw = await aiService.callAdminExamAIMessages(
    buildSingleQuestionImageOcrMessages(file),
    {
      temperature: 0,
      maxTokens: IMAGE_OCR_MAX_TOKENS,
      model: aiConfig.adminExam?.ocrModel,
      models: aiConfig.adminExam?.ocrModels,
      timeout: aiConfig.adminExam?.ocrTimeout,
      signal: options.signal,
    },
  );

  return cleanOcrText(raw);
}

module.exports = {
  extractSingleQuestionImageOcrText,
};
