const DEFAULT_IMPORT_PRESET = "auto";

const PDF_IMPORT_PRESETS = {
  auto: {
    label: "Auto",
    ruleParser: true,
    instruction: [
      "Detect the subject from the text.",
      "Use the most appropriate parsing strategy for math, science, language, humanities, or mixed exams.",
    ],
  },
  math: {
    label: "Math",
    ruleParser: true,
    instruction: [
      "Prioritize formulas, equations, fractions, powers, roots, inequalities, inverse functions, geometry notation, and worked solutions.",
      "Preserve every formula as KaTeX-compatible LaTeX inside \\(...\\).",
    ],
  },
  science: {
    label: "Science",
    ruleParser: true,
    instruction: [
      "Prioritize physics, chemistry, biology, formulas, units, variables, reactions, tables, and experiment descriptions.",
      "Use LaTeX for formulas and equations. Mark diagrams, circuits, lab figures, charts, and tables as needsImage=true when the visual is required.",
    ],
  },
  language: {
    label: "Language",
    ruleParser: false,
    instruction: [
      "Prioritize Chinese, English, Vietnamese language-learning questions, reading passages, grammar, vocabulary, translation, pinyin, and bilingual text.",
      "Keep long reading passages intact. Put Chinese text in questionTextCn/textCn when available.",
    ],
  },
  humanities: {
    label: "Humanities",
    ruleParser: false,
    instruction: [
      "Prioritize literature, history, geography, civics, culture, dates, names, places, maps, source excerpts, and long-context questions.",
      "Keep quoted/source text intact. Mark maps, charts, timelines, and tables as needsImage=true when they matter.",
    ],
  },
  image_heavy: {
    label: "Image-heavy",
    ruleParser: false,
    instruction: [
      "Assume many questions may depend on figures, charts, maps, diagrams, tables, or screenshots.",
      "Do not invent missing visual content. Set needsImage=true and write a precise imageHint for any question that cannot be answered from text alone.",
    ],
  },
};

function normalizePdfImportPreset(value) {
  const key = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PDF_IMPORT_PRESETS, key)
    ? key
    : DEFAULT_IMPORT_PRESET;
}

function shouldUseRuleBasedPdfParser(value) {
  const preset = PDF_IMPORT_PRESETS[normalizePdfImportPreset(value)];
  return preset.ruleParser === true;
}

function buildPresetInstructions(value) {
  const preset = PDF_IMPORT_PRESETS[normalizePdfImportPreset(value)];
  return preset.instruction.map((line) => `- ${line}`).join("\n");
}

function buildPdfImportPrompt(pdfText, importPreset = DEFAULT_IMPORT_PRESET) {
  const preset = normalizePdfImportPreset(importPreset);

  return `You are an exam data parser for a Vietnamese learning platform.

Import preset: ${preset} (${PDF_IMPORT_PRESETS[preset].label})

Preset-specific rules:
${buildPresetInstructions(preset)}

Task:
- For math PDFs, prioritize answer accuracy and formula cleanup over token savings.
- Repair PDF math extraction artifacts before returning text: remove stray "$$", convert (()/(...)) to (...), ([)/(a,b)) to [a,b), convert C R / C ℝ to C_{\\mathbb{R}}, and keep set operations as \\cup, \\cap, \\setminus.
- For math sequences, convert a^2, a^5, a n to sequence subscripts a_2, a_5, a_n when the context is a sequence term, not exponentiation.
- Always map correctAnswer to A-H when the explanation conclusion clearly matches an option, including short one-character options like 0, 2, 3, √2. Examples: q=2 -> the option text 2; a·b=0 -> the option text 0; 最小值为3 -> the option text 3; 共3个 -> the option text 3.
- Read the PDF/Word/OCR text below.
- Extract mixed exam content into three supported item types:
  1. single_choice: normal A/B/C/D multiple choice question.
  2. reading_group: one reading passage with multiple single-choice subQuestions.
  3. fill_blank_group: word-bank/cloze questions with linkedOptions and blank subItems.
- Add short Vietnamese explanations for each correct answer if possible.
- If a question references an image, table, chart, diagram, map, figure, experiment setup, or missing visual, set needsImage=true and write imageHint.
- Preserve math as KaTeX-compatible LaTeX inside \\(...\\). Convert OCR/plain fractions like 2x+3/x-1, (2x+3)/(x-1), or stacked numerator/denominator text into \\frac{2x+3}{x-1}.
- Preserve inequality and set/interval meaning exactly. Never change strict/non-strict signs: < stays <, > stays >, <= or ≤ becomes \\le, >= or ≥ becomes \\ge. Do not change \\le to < or \\ge to >.
- Do not change negative signs, decimal points, exponents, subscripts, answer labels, option text, domain conditions, or set membership when cleaning OCR artifacts.
- Convert math symbols to LaTeX: != or ≠ -> \\ne, <= or ≤ -> \\le, >= or ≥ -> \\ge, sqrt/√ -> \\sqrt{}, superscripts like f-1(x) or f^-1(x) -> f^{-1}(x).
- For Chinese math questions, keep Chinese words in questionTextCn but wrap only formulas, e.g. 求函数 \\(y=\\frac{2x+3}{x-1}(x\\ne1)\\) 的反函数。
- For answer options, store only the option content, not the A/B/C/D prefix. Example answer textCn: \\(f^{-1}(x)=\\frac{x+3}{x-2}\\).
- If OCR text contains solution/explanation markers such as 解析, 答案解析, 解答, 说明, 解:, Explanation, Analysis, Lời giải, or Giải thích, put the following text into explanation/explanationCn and do not keep it in questionText/questionTextCn or answers.
- Do not invent missing answer keys. If the correct answer is not clear, set correctAnswer="" and write reviewNotes.
- Put unsupported items such as essay/listening-only tasks into warnings, not items.
- Return one valid JSON object only. No markdown fence. No explanation outside JSON.

Required JSON schema:
{
  "exam": {
    "title": "",
    "duration": 90,
    "totalPoints": 100
  },
  "items": [
    {
      "itemType": "single_choice",
      "questionType": "single_choice",
      "questionText": "",
      "questionTextCn": "",
      "answers": [
        { "text": "", "textCn": "" }
      ],
      "correctAnswer": "A",
      "explanation": "",
      "explanationCn": "",
      "points": 1,
      "difficulty": "medium",
      "needsImage": false,
      "imageHint": "",
      "reviewNotes": ""
    },
    {
      "itemType": "reading_group",
      "passageText": "",
      "passageImageUrl": "",
      "subQuestions": [
        {
          "questionType": "single_choice",
          "questionText": "",
          "questionTextCn": "",
          "answers": [
            { "text": "", "textCn": "" }
          ],
          "correctAnswer": "A",
          "explanation": "",
          "explanationCn": "",
          "points": 1,
          "difficulty": "medium",
          "needsImage": false,
          "imageHint": "",
          "reviewNotes": ""
        }
      ],
      "needsImage": false,
      "imageHint": "",
      "reviewNotes": ""
    },
    {
      "itemType": "fill_blank_group",
      "clozeMode": "sentences",
      "passageText": "",
      "passageImageUrl": "",
      "linkedOptions": [
        { "key": "A", "text": "", "textCn": "" },
        { "key": "B", "text": "", "textCn": "" }
      ],
      "subItems": [
        {
          "questionText": "",
          "questionTextCn": "",
          "correctAnswerKey": "A",
          "explanation": "",
          "explanationCn": "",
          "points": 1,
          "difficulty": "medium"
        }
      ],
      "needsImage": false,
      "imageHint": "",
      "reviewNotes": ""
    }
  ],
  "warnings": []
}

Rules:
- questionText is Vietnamese/English text. questionTextCn is Chinese text if available.
- answers must contain 2 to 8 options.
- correctAnswer must be A-H or empty if not clear.
- reading_group must have passageText and at least 1 valid subQuestion.
- fill_blank_group linkedOptions must be a word bank A-F/A-H. subItems use correctAnswerKey pointing to linkedOptions.
- For fill_blank_group clozeMode: use "passage" for one paragraph with blanks, "sentences" for separate fill-blank sentences.
- Keep explanations concise and practical.
- Prefer Vietnamese for explanations.
- If output is long, reduce explanation length and finish valid JSON.

PDF/Word/OCR text:
${pdfText}`;
}

module.exports = {
  DEFAULT_IMPORT_PRESET,
  PDF_IMPORT_PRESETS,
  buildPdfImportPrompt,
  normalizePdfImportPreset,
  shouldUseRuleBasedPdfParser,
};
