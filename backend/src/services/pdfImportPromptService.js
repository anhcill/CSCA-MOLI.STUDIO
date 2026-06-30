const DEFAULT_IMPORT_PRESET = "auto";
const DEFAULT_IMPORT_LANGUAGE_MODE = "auto";

const PDF_IMPORT_LANGUAGE_MODES = {
  auto: {
    label: "Auto",
    instruction: "Detect the source language and fill Vietnamese, Chinese, and English fields separately.",
  },
  vi: {
    label: "Vietnamese",
    instruction: "The source exam is Vietnamese. Put main question, answer, and explanation text in questionText/text/explanation.",
  },
  en: {
    label: "English",
    instruction: "The source exam is English. Put main question, answer, and explanation text in questionTextEn/textEn/explanationEn. Do not leave English only in Vietnamese fields.",
  },
  zh: {
    label: "Chinese",
    instruction: "The source exam is Chinese. Put main question, answer, and explanation text in questionTextCn/textCn/explanationCn.",
  },
  vi_en: {
    label: "Vietnamese + English",
    instruction: "The source exam is Vietnamese and English. Keep Vietnamese in questionText/text/explanation and English in questionTextEn/textEn/explanationEn.",
  },
  vi_zh: {
    label: "Vietnamese + Chinese",
    instruction: "The source exam is Vietnamese and Chinese. Keep Vietnamese in questionText/text/explanation and Chinese in questionTextCn/textCn/explanationCn.",
  },
  zh_en: {
    label: "Chinese + English",
    instruction: "The source exam is Chinese and English. Keep Chinese in questionTextCn/textCn/explanationCn and English in questionTextEn/textEn/explanationEn.",
  },
};

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
      "Keep long reading passages intact. Put Vietnamese text in questionText/text, Chinese text in questionTextCn/textCn, and English text in questionTextEn/textEn when available.",
    ],
  },
  chinese_natural: {
    label: "Chinese Natural CSCA",
    ruleParser: true,
    instruction: [
      "This is a CSCA Chinese Natural Science language exam. Prefer the CSCA Chinese rule parser first.",
      "Handle Vietnamese headers like Cau 1, Cau 11-15, Doan 1 (34-38), Chinese passages, word banks, cloze passages, and reading groups.",
      "If the answer key is missing, do not invent it. Leave correctAnswer/correctAnswerKey empty and add reviewNotes.",
    ],
  },
  chinese_social: {
    label: "Chinese Social CSCA",
    ruleParser: true,
    instruction: [
      "This is a CSCA Chinese Social Science language exam. Prefer the CSCA Chinese rule parser first.",
      "Handle Vietnamese headers like Cau 1, Cau 11-15, Doan 1 (34-38), Chinese passages, word banks, cloze passages, and reading groups.",
      "If the answer key is missing, do not invent it. Leave correctAnswer/correctAnswerKey empty and add reviewNotes.",
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

function normalizePdfImportLanguageMode(value) {
  const key = String(value || "").trim().toLowerCase().replace("-", "_");
  return Object.prototype.hasOwnProperty.call(PDF_IMPORT_LANGUAGE_MODES, key)
    ? key
    : DEFAULT_IMPORT_LANGUAGE_MODE;
}

function shouldUseRuleBasedPdfParser(value) {
  const preset = PDF_IMPORT_PRESETS[normalizePdfImportPreset(value)];
  return preset.ruleParser === true;
}

function buildPresetInstructions(value) {
  const preset = PDF_IMPORT_PRESETS[normalizePdfImportPreset(value)];
  return preset.instruction.map((line) => `- ${line}`).join("\n");
}

function buildPdfImportPrompt(pdfText, importPreset = DEFAULT_IMPORT_PRESET, importLanguageMode = DEFAULT_IMPORT_LANGUAGE_MODE) {
  const preset = normalizePdfImportPreset(importPreset);
  const languageMode = normalizePdfImportLanguageMode(importLanguageMode);

  return `You are an exam data parser for a Vietnamese learning platform.

Import preset: ${preset} (${PDF_IMPORT_PRESETS[preset].label})
Import language mode: ${languageMode} (${PDF_IMPORT_LANGUAGE_MODES[languageMode].label})

Preset-specific rules:
${buildPresetInstructions(preset)}

Language field routing:
- ${PDF_IMPORT_LANGUAGE_MODES[languageMode].instruction}
- If the selected language mode is English, English text must appear in questionTextEn/textEn/explanationEn even if duplicate fallback text is also needed elsewhere.
- If the selected language mode is Chinese, Chinese text must appear in questionTextCn/textCn/explanationCn.
- If the selected language mode is Vietnamese, Vietnamese text must appear in questionText/text/explanation.
- If the source DOCX marks an answer option as bold/correct (for example "[correct] B. ..."), use that option as correctAnswer.

Task:
- Think like a strict exam import auditor, but output JSON only. Preserve every question number and return the full exam structure whenever possible.
- For math PDFs, prioritize answer accuracy and formula cleanup over token savings.
- For Chinese CSCA language exams, handle "Cau 11-15" word banks, "Doan (34-38)" cloze passages, and reading groups before falling back to ordinary single-choice parsing.
- If a Word/PDF contains both Chinese original and Vietnamese translation, prioritize the original exam block first and do not duplicate translated questions unless the original block is missing.
- Never skip early questions because later examples or translations look easier. Each source question number should appear once in the returned items.
- For fill_blank_group without an answer key, keep all blank subItems and leave correctAnswerKey empty with reviewNotes; do not drop blanks just because the answer is unknown.
- Repair PDF math extraction artifacts before returning text: remove stray "$$", convert (()/(...)) to (...), ([)/(a,b)) to [a,b), convert C R / C ℝ to C_{\\mathbb{R}}, and keep set operations as \\cup, \\cap, \\setminus.
- For math sequences, convert a^2, a^5, a n to sequence subscripts a_2, a_5, a_n when the context is a sequence term, not exponentiation.
- Always map correctAnswer to A-H when the explanation conclusion clearly matches an option, including short one-character options like 0, 2, 3, √2. Examples: q=2 -> the option text 2; a·b=0 -> the option text 0; 最小值为3 -> the option text 3; 共3个 -> the option text 3.
- If OCR/source text explicitly marks an option as red/correct (for example "[red] D", "D red", "红色 D", "答案: D"), use that option as correctAnswer. If color is not preserved in text and no answer/explanation marker exists, leave correctAnswer empty.
- Read the PDF/Word/OCR text below.
- Extract mixed exam content into three supported item types:
  1. single_choice: normal A/B/C/D multiple choice question.
  2. reading_group: one reading passage with multiple single-choice subQuestions.
  3. fill_blank_group: word-bank/cloze questions with linkedOptions and blank subItems.
- Add short Vietnamese explanations for each correct answer if possible. Vietnamese explanations must use full Vietnamese diacritics, not no-accent text.
- Keep languages in separate fields: Vietnamese in questionText/text/explanation, Chinese in questionTextCn/textCn/explanationCn, English in questionTextEn/textEn/explanationEn. Never merge English into the Vietnamese field when an English field exists.
- If a question references an image, table, chart, diagram, map, figure, experiment setup, or missing visual, set needsImage=true and write imageHint.
- Preserve math as KaTeX-compatible LaTeX inside \\(...\\). Convert OCR/plain fractions like 2x+3/x-1, (2x+3)/(x-1), or stacked numerator/denominator text into \\frac{2x+3}{x-1}.
- Preserve inequality and set/interval meaning exactly. Never change strict/non-strict signs: < stays <, > stays >, <= or ≤ becomes \\le, >= or ≥ becomes \\ge. Do not change \\le to < or \\ge to >.
- Do not change negative signs, decimal points, exponents, subscripts, answer labels, option text, domain conditions, or set membership when cleaning OCR artifacts.
- Convert math symbols to LaTeX: != or ≠ -> \\ne, <= or ≤ -> \\le, >= or ≥ -> \\ge, sqrt/√ -> \\sqrt{}, superscripts like f-1(x) or f^-1(x) -> f^{-1}(x).
- For Chinese math questions, keep Chinese words in questionTextCn but wrap only formulas, e.g. 求函数 \\(y=\\frac{2x+3}{x-1}(x\\ne1)\\) 的反函数。
- For answer options, store only the option content, not the A/B/C/D prefix. Example answer textCn: \\(f^{-1}(x)=\\frac{x+3}{x-2}\\).
- If OCR text contains solution/explanation markers such as 解析, 答案解析, 解答, 说明, 解:, Explanation, Analysis, Lời giải, or Giải thích, put the following text into explanation/explanationCn/explanationEn and do not keep it in questionText/questionTextCn/questionTextEn or answers.
- Do not invent missing answer keys. If the correct answer is not clear, set correctAnswer="" and write reviewNotes.
- If the file has an explicit total question count, compare it with the returned structure. If the returned count is lower, add a warning naming the likely missing range.
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
      "questionTextEn": "",
      "answers": [
        { "text": "", "textCn": "", "textEn": "" }
      ],
      "correctAnswer": "A",
      "explanation": "",
      "explanationCn": "",
      "explanationEn": "",
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
          "questionTextEn": "",
          "answers": [
            { "text": "", "textCn": "", "textEn": "" }
          ],
          "correctAnswer": "A",
          "explanation": "",
          "explanationCn": "",
          "explanationEn": "",
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
        { "key": "A", "text": "", "textCn": "", "textEn": "" },
        { "key": "B", "text": "", "textCn": "", "textEn": "" }
      ],
      "subItems": [
        {
          "questionText": "",
          "questionTextCn": "",
          "questionTextEn": "",
          "correctAnswerKey": "A",
          "explanation": "",
          "explanationCn": "",
          "explanationEn": "",
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
- questionText is Vietnamese text, questionTextCn is Chinese text, and questionTextEn is English text if available.
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
  DEFAULT_IMPORT_LANGUAGE_MODE,
  PDF_IMPORT_PRESETS,
  PDF_IMPORT_LANGUAGE_MODES,
  buildPdfImportPrompt,
  normalizePdfImportLanguageMode,
  normalizePdfImportPreset,
  shouldUseRuleBasedPdfParser,
};
