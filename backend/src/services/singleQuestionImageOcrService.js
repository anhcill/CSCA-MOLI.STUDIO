const aiService = require("./aiService");
const aiConfig = require("../config/aiConfig");

const IMAGE_OCR_MAX_TOKENS = 3000;
const BEE = aiConfig.beeknoee;

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
- Preserve question number, A/B/C/D options, answer marker if visible, and explanation markers like 解析, 答案解析, 解答, 说明, Lời giải, Giải thích.
- Preserve math as clean text/LaTeX where visible: fractions, roots, powers, vectors, log/trig/lim/sum/int, systems, intervals.
- If the image contains a stacked fraction, write it as \\frac{numerator}{denominator}.
- If text color indicates the correct answer and the letter is visible, include a line like "答案: B". If color is ambiguous, do not guess.
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

async function extractSingleQuestionImageOcrText(file) {
  const raw = await aiService.callBeeknoeeMessages(
    buildSingleQuestionImageOcrMessages(file),
    { temperature: 0.05, maxTokens: IMAGE_OCR_MAX_TOKENS, model: BEE.ocrModel },
  );

  return cleanOcrText(raw);
}

module.exports = {
  extractSingleQuestionImageOcrText,
};
