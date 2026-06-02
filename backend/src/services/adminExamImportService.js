const aiConfig = require("../config/aiConfig");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");
const aiService = require("./aiService");
const {
  buildPdfImportPrompt,
  normalizePdfImportPreset,
  shouldUseRuleBasedPdfParser,
} = require("./pdfImportPromptService");

const MAX_POINTS_PER_QUESTION = 100;
const QUESTION_TYPES = {
  SINGLE_CHOICE: "single_choice",
  FILL_BLANK_POOL: "fill_blank_pool",
  FILL_BLANK_ITEM: "fill_blank_item",
  READING_PASSAGE: "reading_passage",
  READING_ITEM: "reading_item",
  TRUE_FALSE: "true_false",
};

function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeExplanation(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\0/g, "").trim();
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeBilingualText(en, cn) {
  const enText = (en || "").trim();
  const cnText = (cn || "").trim();
  if (!enText && !cnText) return null;
  return {
    en: enText || cnText,
    cn: cnText || enText,
  };
}

const PDF_EXPLANATION_MARKER_RE = /(?:^|\s)(?:\u7b54\u6848\u89e3\u6790|\u89e3\u6790|\u89e3\u91ca|\u89e3\u7b54|\u8bf4\u660e|\u89e3|analysis|explanation|l\u1eddi gi\u1ea3i|loi giai|gi\u1ea3i th\u00edch|giai thich)\s*[:\uff1a]\s*/i;

function splitPdfExplanationMarker(value) {
  const text = stringValue(value);
  const match = text.match(PDF_EXPLANATION_MARKER_RE);
  if (!match || match.index === undefined) {
    return { text, explanation: "" };
  }

  return {
    text: text.slice(0, match.index).trim(),
    explanation: text.slice(match.index + match[0].length).trim(),
  };
}

async function getNextContainerQuestionNumber(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MIN(question_number), 0)::int - 1 AS question_number FROM questions WHERE exam_id = $1 AND question_number < 0 AND deleted_at IS NULL",
    [examId],
  );
  return result.rows[0].question_number || -1;
}

function shouldTryImportFallback(error) {
  const status = error?.response?.status;
  return error?.message === "AI_TIMEOUT" || (Number.isFinite(status) && status >= 500);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callPdfImportAI(prompt, options) {
  const { attemptsPerModel = 2, ...aiOptions } = options || {};
  const maxAttemptsPerModel = Math.max(1, Math.min(3, Number.parseInt(attemptsPerModel, 10) || 2));
  const models = [
    aiConfig.beeknoee.importModel,
    aiConfig.beeknoee.importFallbackModel,
  ].filter((model, index, all) => model && all.indexOf(model) === index);

  let lastError = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        return await aiService.callBeeknoee(prompt, { ...aiOptions, model });
      } catch (error) {
        lastError = error;
        const canRetry = shouldTryImportFallback(error);
        if (!canRetry) throw error;
        if (attempt < 2) {
          await wait(800 * attempt);
          continue;
        }
        if (model === models[models.length - 1]) {
          throw error;
        }
        console.warn(`PDF import AI model ${model} failed, retrying fallback model.`);
      }
    }
  }

  throw lastError || new Error("PDF_IMPORT_AI_FAILED");
}

const PDF_IMPORT_TEXT_LIMIT = 60000;
const PDF_IMPORT_MAX_QUESTIONS = 120;
const PDF_IMPORT_IMAGE_HINT_RE = /(?:\b(?:hinh|anh|bieu\s*do|do\s*thi|so\s*do|figure|image|diagram|chart|map|graph|picture)\b|h\u00ecnh|\u1ea3nh|bi\u1ec3u\s*\u0111\u1ed3|\u0111\u1ed3\s*th\u1ecb|s\u01a1\s*\u0111\u1ed3|\u770b\u56fe|\u56fe|\u56fe\u7247|\u56fe\u8868)/i;

const wordExtractor = new WordExtractor();

function getImportFileExtension(file) {
  return String(file?.originalname || "").toLowerCase().split(".").pop();
}

function getImportFileType(file) {
  const extension = getImportFileExtension(file);
  if (extension === "pdf") return "pdf";
  if (extension === "doc") return "doc";
  if (extension === "docx") return "docx";
  return "";
}

async function extractImportFileText(file) {
  const fileType = getImportFileType(file);

  if (fileType === "pdf") {
    const pdfData = await pdfParse(file.buffer);
    return {
      text: pdfData.text,
      pages: pdfData.numpages || null,
      fileType,
    };
  }

  if (fileType === "docx") {
    const docxData = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      text: docxData.value,
      pages: null,
      fileType,
      warnings: Array.isArray(docxData.messages)
        ? docxData.messages.map((message) => message.message).filter(Boolean)
        : [],
    };
  }

  if (fileType === "doc") {
    const docData = await wordExtractor.extract(file.buffer);
    return {
      text: [
        docData.getBody(),
        docData.getTextboxes?.(),
        docData.getFootnotes?.(),
        docData.getEndnotes?.(),
      ].filter(Boolean).join("\n"),
      pages: null,
      fileType,
    };
  }

  throw new Error("UNSUPPORTED_IMPORT_FILE");
}

function stripAiNoise(raw) {
  return String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function findBalancedJsonObject(raw) {
  const text = stripAiNoise(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastObject = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        lastObject = text.slice(start, i + 1);
        start = -1;
      }
    }
  }

  return lastObject;
}

function parseAiJsonObject(raw) {
  const fencedBlocks = [...String(raw || "").matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1].trim());

  for (let i = fencedBlocks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(fencedBlocks[i]);
      if (parsed && typeof parsed === "object" && (Array.isArray(parsed.items) || Array.isArray(parsed.questions) || parsed.exam)) {
        return parsed;
      }
    } catch (error) {
      // Try the balanced-object fallback below.
    }
  }

  const json = findBalancedJsonObject(raw);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function stringValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function repairPdfImportTextArtifacts(value) {
  const text = stringValue(value);
  if (!text) return "";

  return text
    .replace(/\$\$+/g, "")
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, "[$1)")
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, "($1)")
    .replace(/\bC\s*(?:\u211d|R)\s*\(/g, "C_{\\mathbb{R}}(")
    .replace(/\bC\s*(?:\u211d|R)\b/g, "C_{\\mathbb{R}}")
    .replace(/\\cup|\u222a/g, "\\cup")
    .replace(/\\cap|\u2229/g, "\\cap")
    .replace(/\\setminus|\u2216/g, "\\setminus")
    .replace(/\b([A-Za-z])\s*[\u20d7]+/g, "\\vec{$1}")
    .replace(/\s+([,.;:ï¼Œă€‚ï¼›ï¼ï¼‰\)Â°])/g, "$1")
    .replace(/([ï¼ˆ\(])\s+/g, "$1")
    .trim();
}

function withRuleBasedFallbackWarning(preview, reason) {
  if (!preview?.items?.length) return preview;

  const warnings = Array.isArray(preview.warnings) ? [...preview.warnings] : [];
  warnings.push(reason || "AI parse failed; returned rule-based preview fallback.");
  return { ...preview, warnings };
}

function getPdfImportFallbackReason(error) {
  if (error?.message === "RATE_LIMITED") {
    return "AI is rate limited; returned rule-based preview fallback.";
  }
  if (error?.message === "AI_TIMEOUT") {
    return "AI timed out; returned rule-based preview fallback.";
  }
  return "AI parse failed; returned rule-based preview fallback.";
}

function normalizeUploadedFileName(value) {
  const raw = stringValue(value);
  if (!raw || !/[ÃÂ]/.test(raw)) return raw;

  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    return decoded && !decoded.includes("�") ? decoded : raw;
  } catch (error) {
    return raw;
  }
}

function normalizeImportAnswers(rawAnswers) {
  const source = rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
    ? Object.keys(rawAnswers).sort().map((key) => rawAnswers[key])
    : rawAnswers;

  if (!Array.isArray(source)) return [];

  return source
    .slice(0, 8)
    .map((answer) => {
      if (typeof answer === "string") {
        return { text: repairPdfImportTextArtifacts(answer), textCn: "", imageUrl: "" };
      }

      return {
        text: repairPdfImportTextArtifacts(answer?.text || answer?.answerText || answer?.content),
        textCn: repairPdfImportTextArtifacts(answer?.textCn || answer?.answerTextCn || answer?.contentCn),
        imageUrl: stringValue(answer?.imageUrl),
        isCorrect: answer?.isCorrect === true,
      };
    })
    .filter((answer) => answer.text || answer.textCn);
}

function normalizeCorrectAnswer(rawQuestion, answers) {
  const answerKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const raw = stringValue(
    rawQuestion.correctAnswer ||
    rawQuestion.correct_answer ||
    rawQuestion.answer ||
    rawQuestion.answerKey ||
    rawQuestion.correctAnswerKey,
  ).toUpperCase();

  if (/^[A-H]$/.test(raw)) return raw;

  const number = Number.parseInt(raw, 10);
  if (Number.isFinite(number) && number >= 1 && number <= answers.length) {
    return answerKeys[number - 1];
  }

  const correctIndex = answers.findIndex((answer) => answer.isCorrect === true);
  if (correctIndex >= 0) return answerKeys[correctIndex];

  const explanationText = [
    rawQuestion.explanation,
    rawQuestion.explanationCn,
    rawQuestion.explanation_cn,
  ].map(repairPdfImportTextArtifacts).filter(Boolean).join(" ");
  const inferred = inferCorrectAnswerFromExplanation(answers, explanationText);
  return inferred || "";
}

function normalizeImportedQuestion(rawQuestion, index) {
  const rawType = stringValue(rawQuestion?.questionType || rawQuestion?.question_type || QUESTION_TYPES.SINGLE_CHOICE)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!["single_choice", "multiple_choice", "trac_nghiem"].includes(rawType)) {
    return null;
  }

  const answers = normalizeImportAnswers(rawQuestion?.answers || rawQuestion?.options);
  const rawQuestionText = repairPdfImportTextArtifacts(rawQuestion?.questionText || rawQuestion?.question || rawQuestion?.text);
  const rawQuestionTextCn = repairPdfImportTextArtifacts(rawQuestion?.questionTextCn || rawQuestion?.question_cn || rawQuestion?.textCn);
  const viQuestion = splitPdfExplanationMarker(rawQuestionText);
  const cnQuestion = splitPdfExplanationMarker(rawQuestionTextCn);
  const questionText = repairPdfImportTextArtifacts(viQuestion.explanation ? viQuestion.text : rawQuestionText);
  const questionTextCn = repairPdfImportTextArtifacts(cnQuestion.explanation ? cnQuestion.text : rawQuestionTextCn);
  const normalizedQuestion = normalizeBilingualText(questionText, questionTextCn);

  if (!normalizedQuestion || answers.length < 2) return null;

  const difficulty = ["easy", "medium", "hard"].includes(rawQuestion?.difficulty)
    ? rawQuestion.difficulty
    : "medium";
  const correctAnswer = normalizeCorrectAnswer({
    ...rawQuestion,
    explanation: rawQuestion?.explanation || viQuestion.explanation,
    explanationCn: rawQuestion?.explanationCn || rawQuestion?.explanation_cn || cnQuestion.explanation,
  }, answers);
  const imageHint = stringValue(rawQuestion?.imageHint || rawQuestion?.image_hint);
  const reviewNotes = stringValue(rawQuestion?.reviewNotes || rawQuestion?.review_notes);
  const combinedText = `${questionText} ${questionTextCn} ${imageHint} ${reviewNotes}`;
  const needsImage = rawQuestion?.needsImage === true || PDF_IMPORT_IMAGE_HINT_RE.test(combinedText);

  return {
    questionType: QUESTION_TYPES.SINGLE_CHOICE,
    questionText: normalizedQuestion.en,
    questionTextCn: normalizedQuestion.cn,
    imageUrl: stringValue(rawQuestion?.imageUrl),
    points: clamp(parsePositiveNumber(rawQuestion?.points, 1), 0.1, MAX_POINTS_PER_QUESTION),
    explanation: repairPdfImportTextArtifacts(rawQuestion?.explanation || viQuestion.explanation),
    explanationCn: repairPdfImportTextArtifacts(rawQuestion?.explanationCn || rawQuestion?.explanation_cn || cnQuestion.explanation),
    answers: answers.map((answer) => ({
      text: answer.text || answer.textCn,
      textCn: answer.textCn || answer.text,
      imageUrl: answer.imageUrl || "",
    })),
    correctAnswer,
    difficulty,
    needsImage,
    imageHint: imageHint || (needsImage ? "Question may reference an image/table/chart in the PDF. Add image manually before publishing." : ""),
    reviewNotes,
    importIndex: index + 1,
  };
}

function normalizeImportLinkedOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];

  return rawOptions
    .slice(0, 12)
    .map((option, index) => ({
      key: stringValue(option?.key || String.fromCharCode(65 + index)).toUpperCase().slice(0, 1) || String.fromCharCode(65 + index),
      text: stringValue(option?.text || option?.content),
      textCn: stringValue(option?.textCn || option?.contentCn),
    }))
    .filter((option) => option.text || option.textCn);
}

function countImportClozeBlanks(text) {
  if (!text || typeof text !== "string") return 0;
  return (text.match(/_{2,}|＿+/g) || []).length;
}

function normalizeImportedReadingGroup(rawGroup, index) {
  const passageText = stringValue(rawGroup?.passageText || rawGroup?.passage || rawGroup?.text);
  const passageImageUrl = stringValue(rawGroup?.passageImageUrl || rawGroup?.imageUrl);
  const subQuestions = (Array.isArray(rawGroup?.subQuestions) ? rawGroup.subQuestions : [])
    .map((question, subIndex) => normalizeImportedQuestion(question, subIndex))
    .filter(Boolean);
  const needsImage = rawGroup?.needsImage === true || PDF_IMPORT_IMAGE_HINT_RE.test(`${passageText} ${rawGroup?.imageHint || ""}`);

  if (!passageText || subQuestions.length === 0) return null;

  return {
    itemType: "reading_group",
    passageText,
    passageImageUrl,
    subQuestions,
    needsImage,
    imageHint: stringValue(rawGroup?.imageHint) || (needsImage ? "Reading passage may reference a visual in the PDF. Add image manually before publishing." : ""),
    reviewNotes: stringValue(rawGroup?.reviewNotes),
    importIndex: index + 1,
  };
}

function normalizeImportedFillBlankGroup(rawGroup, index) {
  const clozeMode = rawGroup?.clozeMode === "passage" ? "passage" : "sentences";
  const passageText = stringValue(rawGroup?.passageText || rawGroup?.passage || rawGroup?.text);
  const passageImageUrl = stringValue(rawGroup?.passageImageUrl || rawGroup?.imageUrl);
  const linkedOptions = normalizeImportLinkedOptions(rawGroup?.linkedOptions || rawGroup?.options);
  const optionKeys = new Set(linkedOptions.map((option) => option.key));
  const rawSubItems = Array.isArray(rawGroup?.subItems) ? rawGroup.subItems : [];
  const subItems = rawSubItems
    .map((item, subIndex) => {
      const questionText = stringValue(item?.questionText || item?.question || item?.text);
      const questionTextCn = stringValue(item?.questionTextCn || item?.question_cn || item?.textCn);
      const normalizedQuestion = normalizeBilingualText(questionText, questionTextCn);
      const correctAnswerKey = stringValue(item?.correctAnswerKey || item?.correctAnswer || item?.answerKey || item?.answer)
        .toUpperCase()
        .slice(0, 1);

      if (!optionKeys.has(correctAnswerKey)) return null;
      if (clozeMode === "sentences" && !normalizedQuestion) return null;

      return {
        questionText: normalizedQuestion?.en || `Blank ${subIndex + 1}`,
        questionTextCn: normalizedQuestion?.cn || `Blank ${subIndex + 1}`,
        points: clamp(parsePositiveNumber(item?.points, 1), 0.1, MAX_POINTS_PER_QUESTION),
        explanation: stringValue(item?.explanation),
        explanationCn: stringValue(item?.explanationCn || item?.explanation_cn),
        correctAnswerKey,
        difficulty: ["easy", "medium", "hard"].includes(item?.difficulty) ? item.difficulty : "medium",
        subQuestionNumber: Number.parseInt(item?.subQuestionNumber, 10) || subIndex + 1,
      };
    })
    .filter(Boolean);

  if (linkedOptions.length < 2 || subItems.length === 0) return null;
  if (clozeMode === "passage" && !passageText) return null;

  const blankCount = clozeMode === "passage" ? countImportClozeBlanks(passageText) : 0;
  const reviewNotes = [
    stringValue(rawGroup?.reviewNotes),
    blankCount > 0 && blankCount !== subItems.length
      ? `Blank count (${blankCount}) does not match answer count (${subItems.length}). Review before publishing.`
      : "",
  ].filter(Boolean).join(" ");
  const needsImage = rawGroup?.needsImage === true || PDF_IMPORT_IMAGE_HINT_RE.test(`${passageText} ${rawGroup?.imageHint || ""}`);

  return {
    itemType: "fill_blank_group",
    clozeMode,
    passageText,
    passageImageUrl,
    linkedOptions,
    subItems,
    needsImage,
    imageHint: stringValue(rawGroup?.imageHint) || (needsImage ? "Fill-blank group may reference a visual in the PDF. Add image manually before publishing." : ""),
    reviewNotes,
    importIndex: index + 1,
  };
}

function getImportItemType(rawItem) {
  const rawType = stringValue(rawItem?.itemType || rawItem?.type || rawItem?.questionType || rawItem?.question_type)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["reading_group", "reading_passage", "reading"].includes(rawType)) return "reading_group";
  if (["fill_blank_group", "fill_blank_pool", "fill_blank", "cloze"].includes(rawType)) return "fill_blank_group";
  return "single_choice";
}

function normalizeImportedItem(rawItem, index) {
  const itemType = getImportItemType(rawItem);

  if (itemType === "reading_group") return normalizeImportedReadingGroup(rawItem, index);
  if (itemType === "fill_blank_group") return normalizeImportedFillBlankGroup(rawItem, index);

  const question = normalizeImportedQuestion(rawItem, index);
  return question ? { ...question, itemType: "single_choice" } : null;
}

function flattenImportSourceItems(aiResult) {
  const items = Array.isArray(aiResult?.items) ? [...aiResult.items] : [];

  if (Array.isArray(aiResult?.questions)) {
    items.push(...aiResult.questions.map((question) => ({ ...question, itemType: "single_choice" })));
  }

  if (Array.isArray(aiResult?.readingGroups)) {
    items.push(...aiResult.readingGroups.map((group) => ({ ...group, itemType: "reading_group" })));
  }

  if (Array.isArray(aiResult?.fillBlankGroups)) {
    items.push(...aiResult.fillBlankGroups.map((group) => ({ ...group, itemType: "fill_blank_group" })));
  }

  return items;
}

function countImportedItemQuestions(item) {
  if (!item) return 0;
  if (item.itemType === "reading_group") return item.subQuestions.length;
  if (item.itemType === "fill_blank_group") return item.subItems.length;
  return 1;
}

function mapPdfMathGlyph(char) {
  const rawCodePoint = char.codePointAt(0);
  const codePoint = rawCodePoint >= 0xd400 && rawCodePoint <= 0xd7ff
    ? rawCodePoint + 0x10000
    : rawCodePoint;

  const greekMap = new Map([
    [0x1d703, "θ"],
    [0x1d70b, "π"],
  ]);
  if (greekMap.has(codePoint)) {
    return greekMap.get(codePoint);
  }

  const alphaRanges = [
    [0x1d400, 0x1d419, 65],
    [0x1d41a, 0x1d433, 97],
    [0x1d434, 0x1d44d, 65],
    [0x1d44e, 0x1d467, 97],
    [0x1d468, 0x1d481, 65],
    [0x1d482, 0x1d49b, 97],
    [0x1d5a0, 0x1d5b9, 65],
    [0x1d5ba, 0x1d5d3, 97],
    [0x1d5d4, 0x1d5ed, 65],
    [0x1d5ee, 0x1d607, 97],
  ];

  for (const [start, end, asciiStart] of alphaRanges) {
    if (codePoint >= start && codePoint <= end) {
      return String.fromCharCode(asciiStart + codePoint - start);
    }
  }

  const digitRanges = [0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6];
  for (const start of digitRanges) {
    if (codePoint >= start && codePoint <= start + 9) {
      return String(codePoint - start);
    }
  }

  return char;
}

function compactRuleBasedFormulaLine(line) {
  return stringValue(line)
    .trim()
    .replace(/\s+/g, "");
}

function isRuleBasedMathLine(line) {
  const normalized = compactRuleBasedFormulaLine(line);
  if (!normalized || normalized.length > 100) return false;
  if (/^[A-H][.．、]/.test(normalized)) return false;
  if (/[\u4e00-\u9fff]/.test(normalized)) return false;
  return /[A-Za-z0-9πθ√+\-*/^=().,≠≤≥<>|∈∪∩∞{}\[\]]/.test(normalized);
}

function isVerticalFractionBoundary(line) {
  const normalized = compactRuleBasedFormulaLine(line);
  if (!normalized) return true;
  if (/^=/.test(normalized)) return true;
  if (/^[，。,;；)）(（]/.test(normalized)) return true;
  if (/^\d{1,3}[.．、]/.test(normalized)) return true;
  if (/^[A-H][.．、]/.test(normalized)) return true;
  if (/^(解析|解答|说明|答案解析)[:：]?/.test(normalized)) return true;
  return /[\u4e00-\u9fff]/.test(normalized);
}

function appendRuleBasedFormulaLine(lines, line) {
  if (line === "=" && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}=`;
    return;
  }
  lines.push(line);
}

function normalizeVerticalFormulaFractions(rawText) {
  const lines = stringValue(rawText).split("\n");
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prefixEndsWithEquals = /=\s*$/.test(line);

    if (prefixEndsWithEquals) {
      const numerator = compactRuleBasedFormulaLine(lines[i + 1]);
      const denominator = compactRuleBasedFormulaLine(lines[i + 2]);
      const sqrtNumerator = lines[i + 1]?.trim() === "√"
        ? compactRuleBasedFormulaLine(lines[i + 2])
        : "";
      const sqrtDenominator = lines[i + 1]?.trim() === "√"
        ? compactRuleBasedFormulaLine(lines[i + 3])
        : "";

      if (sqrtNumerator && sqrtDenominator && isRuleBasedMathLine(sqrtNumerator) && isRuleBasedMathLine(sqrtDenominator) && isVerticalFractionBoundary(lines[i + 4])) {
        appendRuleBasedFormulaLine(output, `${line}√(${sqrtNumerator})/(${sqrtDenominator})`);
        i += 3;
        continue;
      }

      if (numerator && denominator && isRuleBasedMathLine(numerator) && isRuleBasedMathLine(denominator) && isVerticalFractionBoundary(lines[i + 3])) {
        appendRuleBasedFormulaLine(output, `${line}(${numerator})/(${denominator})`);
        i += 2;
        continue;
      }
    }

    output.push(lines[i]);
  }

  return output.join("\n");
}

function normalizePdfMathGlyphs(rawText) {
  return [...stringValue(rawText)]
    .map(mapPdfMathGlyph)
    .join("")
    .replace(/−/g, "-")
    .replace(/∣/g, "|")
    .replace(/∘/g, "°");
}

function normalizeRuleBasedMathLayout(rawText) {
  return normalizeVerticalFormulaFractions(normalizePdfMathGlyphs(rawText))
    .replace(/\r/g, "\n")
    .replace(/Page\s+\d+\s*\|\s*\d+/gi, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/([A-Za-z])\s*\n\s*([2-9])\s*\n\s*([0-9]+)(?=\s*(?:\n|[-+*/=<>≤≥,，。;；)）\]}]|$))/g, "$1^$2/$3")
    .replace(/([0-9])\s*\n\s*√\s*\n\s*([0-9πθ]+)(?=\s*(?:\n|[,.，。；:：)）]|$))/g, "$1√$2")
    .replace(/([+-]?)\s*\n\s*√\s*\n\s*([0-9πθ]+)\s*\n\s*([0-9πθ]+)(?=\s*(?:\n|[A-H][.．、]|[，。；:：)）]|$))/g, (_, sign, numerator, denominator) => `${sign || ""}√${numerator}/${denominator}`)
    .replace(/([+-]?)\s*\n\s*([0-9πθ]+)\s*\n\s*([0-9πθ]+)(?=\s*(?:\n|[A-H][.．、]|[，。；:：)）]|$))/g, (_, sign, numerator, denominator) => `${sign || ""}${numerator}/${denominator}`)
    .replace(/([A-Za-z0-9)\]}])\s*\n\s*([2-9])(?=\s*\n\s*(?:[-+*/=<>≤≥,，。;；)）\]}]|$))/g, "$1^$2");
}

function cleanRuleBasedTextFragment(rawText) {
  const cleaned = stringValue(rawText)
    .replace(/\s+/g, " ")
    .replace(/\b(sin|cos|tan|cot|ln|log)\s+\(/gi, "$1(")
    .replace(/√\s+/g, "√")
    .replace(/([0-9])\s+√/g, "$1√")
    .replace(/\s+\^/g, "^")
    .replace(/\^\s+/g, "^")
    .replace(/\bf\s*-1\s*\(/gi, "f^-1(")
    .replace(/\b([A-Za-z])\s+\(/g, "$1(")
    .replace(/\s+([,.;:，。；：）\)°])/g, "$1")
    .replace(/([（\(])\s+/g, "$1")
    .trim();
  return repairPdfImportTextArtifacts(cleaned);
}

function splitRuleBasedOptionText(rawText) {
  const text = cleanRuleBasedTextFragment(rawText);
  if (!text) return "";
  return text;
}

function inferCorrectAnswerFromExplanation(answers, explanation) {
  const normalizedExplanation = repairPdfImportTextArtifacts(explanation).replace(/\s+/g, "");
  if (!normalizedExplanation) return "";

  const unicodeExplicitAnswer = normalizedExplanation.match(/(?:\u7b54\u6848|\u6b63\u786e\u7b54\u6848|\u6545\u9009|\u5e94\u9009|\u9009)[:\uff1a\u4e3a\u662f]*([A-H])/i);
  if (unicodeExplicitAnswer?.[1]) {
    return unicodeExplicitAnswer[1].toUpperCase();
  }

  const explicitAnswer = normalizedExplanation.match(/(?:答案|正确答案|故选|应选|选)[:：为是]*([A-H])/i);
  if (explicitAnswer?.[1]) {
    return explicitAnswer[1].toUpperCase();
  }

  const scoreAnswer = (answerText) => {
    if (!answerText) return 0;

    const escaped = answerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = "(?:$|[)\\]}\\uFF09\\uFF0C\\u3002\\uFF1B;,.\\u4E2A\\u500B]|\\b)";
    const strongMarker = new RegExp(`(?:=|=>|->|:|\\uFF1A|\\u4E3A|\\u5F97|\\u5171|\\u662F|\\u5373|\\u6700\\u5C0F\\u503C\\u4E3A|\\u6700\\u5927\\u503C\\u4E3A)${escaped}${boundary}`);
    if (strongMarker.test(normalizedExplanation)) return 5;

    const sentenceConclusion = new RegExp(`(?:\\u7B54\\u6848|\\u7ED3\\u679C|\\u89E3\\u5F97|\\u6545|\\u6240\\u4EE5|\\u56E0\\u6B64)[^\\u3002\\uFF1B;,.]{0,24}${escaped}${boundary}`);
    if (sentenceConclusion.test(normalizedExplanation)) return 4;

    if (answerText.length >= 2 && new RegExp(`${escaped}${boundary}`).test(normalizedExplanation)) return 2;
    return 0;
  };

  const candidates = answers
    .map((answer, index) => {
      const values = [
        repairPdfImportTextArtifacts(answer.textCn || answer.text),
        repairPdfImportTextArtifacts(answer.text || answer.textCn),
      ]
        .map((value) => value.replace(/\s+/g, ""))
        .filter(Boolean);

      return {
        key: String.fromCharCode(65 + index),
        score: Math.max(0, ...values.map(scoreAnswer)),
      };
    })
    .filter((answer) => answer.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return "";
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return "";
  return candidates[0].key;
}

const VIETNAMESE_QUESTION_RE = /C\u00e2u\s*(\d{1,3})(?:\s*\(([^)]*)\))?\s*:?\s*/gi;
const VIETNAMESE_EXPLANATION_RE = /(?:^|\n)\s*(?:Gi\u1ea3i|L\u1eddi\s*gi\u1ea3i|\u0110\u00e1p\s*\u00e1n)\s*:/i;
const VIETNAMESE_ANSWER_RE = /\u0110\u00e1p\s*\u00e1n(?:\s*\u0111\u00fang)?\s*:\s*\(?([A-H])\)?/i;
const VIETNAMESE_OPTION_LABEL_RE = /^(?:\(([A-H])\)|([A-H])[\.)])\s*(.*)$/i;
const VIETNAMESE_TRAILING_ANSWER_KEY_RE = /(?:^|\n)\s*(\d{1,3})\s*[\.)]\s*([A-H])\s*(?=\n|$)/gi;
const RULE_IMPORT_ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const RULE_IMPORT_MISSING_OPTION_TEXT = "Option content was not extracted from Word/PDF. Edit this answer in the preview.";

function getSequentialVietnameseQuestionMatches(text) {
  const matches = [];
  let lastQuestionNumber = 0;

  for (const match of text.matchAll(VIETNAMESE_QUESTION_RE)) {
    const questionNumber = Number.parseInt(match[1], 10);
    if (!Number.isFinite(questionNumber) || questionNumber <= lastQuestionNumber) continue;
    if (questionNumber > PDF_IMPORT_MAX_QUESTIONS) continue;
    matches.push(match);
    lastQuestionNumber = questionNumber;
  }

  return matches;
}

function getVietnameseAnswerKeyMap(text) {
  const answerKeyMap = new Map();

  for (const match of text.matchAll(VIETNAMESE_TRAILING_ANSWER_KEY_RE)) {
    const questionNumber = Number.parseInt(match[1], 10);
    const answerKey = stringValue(match[2]).toUpperCase();
    if (Number.isFinite(questionNumber) && /^[A-H]$/.test(answerKey)) {
      answerKeyMap.set(questionNumber, answerKey);
    }
  }

  return answerKeyMap;
}

function getMissingOptionText(key) {
  return `Option ${key}: ${RULE_IMPORT_MISSING_OPTION_TEXT}`;
}

function stripVietnameseTrailingAnswerKeyList(text) {
  return stringValue(text).replace(/(?:\n\s*\d{1,3}\s*[\.)]\s*[A-H]\s*){8,}\s*$/i, "").trim();
}

function isLikelyUnlabeledOptionLine(line) {
  const text = stringValue(line);
  if (!text || text.length > 90) return false;
  if (/[?？]$/.test(text)) return false;
  if (/^(?:Gi\u1ea3i|L\u1eddi\s*gi\u1ea3i|\u0110\u00e1p\s*\u00e1n)\s*:/i.test(text)) return false;
  return /[A-Za-z0-9\u00c0-\u1ef9+\-*/=.,()%\u03b3\u03a9\u00b0]/.test(text);
}

function buildVietnameseAnswersFromLines(lines) {
  const labeled = [];

  lines.forEach((line, index) => {
    const match = line.match(VIETNAMESE_OPTION_LABEL_RE);
    if (!match) return;
    const key = (match[1] || match[2] || "").toUpperCase();
    if (!key) return;
    labeled.push({ index, key, text: cleanRuleBasedTextFragment(match[3]) });
  });

  const answersByKey = new Map();
  let questionEndIndex = lines.length;

  if (labeled.length > 0) {
    const firstKeyIndex = RULE_IMPORT_ANSWER_KEYS.indexOf(labeled[0].key);
    const missingBeforeFirst = Math.max(0, firstKeyIndex);
    const previousCandidates = [];

    for (let i = labeled[0].index - 1; i >= 0 && previousCandidates.length < missingBeforeFirst; i--) {
      if (isLikelyUnlabeledOptionLine(lines[i])) previousCandidates.unshift({ index: i, text: lines[i] });
    }

    previousCandidates.forEach((candidate, index) => {
      answersByKey.set(RULE_IMPORT_ANSWER_KEYS[index], splitRuleBasedOptionText(candidate.text));
    });

    questionEndIndex = previousCandidates[0]?.index ?? labeled[0].index;

    for (let i = 0; i < labeled.length; i++) {
      const current = labeled[i];
      const next = labeled[i + 1];
      const segmentLines = [current.text];
      for (let lineIndex = current.index + 1; lineIndex < (next?.index ?? lines.length); lineIndex++) {
        if (lines[lineIndex]) segmentLines.push(lines[lineIndex]);
      }
      answersByKey.set(current.key, splitRuleBasedOptionText(segmentLines.join(" ")) || getMissingOptionText(current.key));
    }
  } else {
    const candidates = [];
    for (let i = lines.length - 1; i >= 0 && candidates.length < 4; i--) {
      if (isLikelyUnlabeledOptionLine(lines[i])) candidates.unshift({ index: i, text: lines[i] });
    }

    if (candidates.length >= 2) {
      questionEndIndex = candidates[0].index;
      candidates.forEach((candidate, index) => {
        answersByKey.set(RULE_IMPORT_ANSWER_KEYS[index], splitRuleBasedOptionText(candidate.text));
      });
    }
  }

  const answers = RULE_IMPORT_ANSWER_KEYS
    .map((key) => answersByKey.get(key))
    .filter(Boolean)
    .map((text) => ({ text, textCn: "" }));

  return { answers, questionEndIndex };
}

function buildMissingVietnameseAnswers() {
  return RULE_IMPORT_ANSWER_KEYS.slice(0, 4).map((key) => ({
    text: getMissingOptionText(key),
    textCn: "",
  }));
}

function parseVietnameseChoiceTextWithRules(rawText, sourceMeta) {
  const text = normalizeRuleBasedMathLayout(rawText)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  const questionMatches = getSequentialVietnameseQuestionMatches(text);
  if (!questionMatches.length) return null;
  const answerKeyMap = getVietnameseAnswerKeyMap(text);

  const items = [];
  for (let i = 0; i < questionMatches.length; i++) {
    const match = questionMatches[i];
    const questionNumber = Number.parseInt(match[1], 10);
    const start = match.index + match[0].length;
    const end = i + 1 < questionMatches.length ? questionMatches[i + 1].index : text.length;
    const body = stripVietnameseTrailingAnswerKeyList(text.slice(start, end).trim());
    if (!body) continue;

    const explanationIndex = body.search(VIETNAMESE_EXPLANATION_RE);
    const questionAndOptions = (explanationIndex >= 0 ? body.slice(0, explanationIndex) : body).trim();
    const explanation = explanationIndex >= 0 ? cleanRuleBasedTextFragment(body.slice(explanationIndex)) : "";
    const answerMatch = body.match(VIETNAMESE_ANSWER_RE);
    const correctAnswer = answerMatch?.[1]?.toUpperCase() || answerKeyMap.get(questionNumber) || "";
    const lines = questionAndOptions.split("\n").map(cleanRuleBasedTextFragment).filter(Boolean);
    let { answers, questionEndIndex } = buildVietnameseAnswersFromLines(lines);
    const questionText = cleanRuleBasedTextFragment(lines.slice(0, questionEndIndex).join(" "));

    if (answers.length < 2 && correctAnswer) {
      answers = buildMissingVietnameseAnswers();
    }

    if (!questionText || answers.length < 2) continue;
    const hasMissingAnswerText = answers.some((answer) => stringValue(answer.text).includes(RULE_IMPORT_MISSING_OPTION_TEXT));
    const reviewNotes = [
      correctAnswer ? "" : "Could not infer the correct answer automatically. Please choose it before saving.",
      hasMissingAnswerText ? "Some answer content was not extracted from Word/PDF. Edit placeholders in the preview." : "",
    ].filter(Boolean).join(" ");

    items.push({
      itemType: "single_choice",
      questionType: "single_choice",
      questionText,
      questionTextCn: "",
      answers,
      correctAnswer,
      explanation,
      explanationCn: "",
      points: 1,
      difficulty: /VDC|advanced|hard/i.test(match[0]) ? "hard" : "medium",
      needsImage: PDF_IMPORT_IMAGE_HINT_RE.test(questionText),
      imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(questionText) ? "Question may reference an image/table/chart in the file. Add image manually before publishing." : "",
      reviewNotes,
    });
  }

  if (items.length === 0) return null;

  return normalizePdfImportResult({
    exam: {
      title: sourceMeta?.fileName ? String(sourceMeta.fileName).replace(/\.(pdf|docx?|doc)$/i, "") : "Imported exam",
      duration: 90,
      totalPoints: Math.max(items.length, 1),
    },
    items,
    warnings: [
      "This preview used the fast Vietnamese question parser. Please review formulas, placeholder answers, and image-based questions before saving.",
    ],
  }, sourceMeta);
}

function parsePdfTextWithRules(pdfText, sourceMeta) {
  const vietnamesePreview = parseVietnameseChoiceTextWithRules(pdfText, sourceMeta);
  if (vietnamesePreview?.items?.length) return vietnamesePreview;

  const text = normalizeRuleBasedMathLayout(pdfText)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const questionMatches = [...text.matchAll(/(?:^|\s)(\d{1,3})[.．、]\s*/g)];
  const items = [];

  for (let i = 0; i < questionMatches.length; i++) {
    const start = questionMatches[i].index + questionMatches[i][0].length;
    const end = i + 1 < questionMatches.length ? questionMatches[i + 1].index : text.length;
    const block = text.slice(start, end).trim();
    if (!block) continue;

    const optionMatch = block.match(/\sA\s*[.．、]\s*/);
    if (!optionMatch) continue;

    const questionText = cleanRuleBasedTextFragment(block.slice(0, optionMatch.index));
    const afterA = block.slice(optionMatch.index).trim();
    const detectedExplanationMatch = afterA.match(PDF_EXPLANATION_MARKER_RE);
    const explanationMatch = afterA.match(/\s(?:解析|解答|说明|答案解析)[:：]\s*/);
    const activeExplanationMatch = detectedExplanationMatch || explanationMatch;
    const optionsPart = activeExplanationMatch ? afterA.slice(0, activeExplanationMatch.index).trim() : afterA;
    const explanation = activeExplanationMatch ? cleanRuleBasedTextFragment(afterA.slice(activeExplanationMatch.index + activeExplanationMatch[0].length)) : "";
    const optionMatches = [...optionsPart.matchAll(/(?:^|\s)([A-H])\s*[.．、]\s*/g)];

    if (optionMatches.length < 2) continue;

    const answers = [];
    for (let optionIndex = 0; optionIndex < optionMatches.length; optionIndex++) {
      const optStart = optionMatches[optionIndex].index + optionMatches[optionIndex][0].length;
      const optEnd = optionIndex + 1 < optionMatches.length ? optionMatches[optionIndex + 1].index : optionsPart.length;
      const optionText = splitRuleBasedOptionText(optionsPart.slice(optStart, optEnd));
      if (optionText) {
        answers.push({ text: "", textCn: optionText });
      }
    }

    if (answers.length < 2 || !questionText) continue;

    const correctAnswer = inferCorrectAnswerFromExplanation(answers, explanation);
    items.push({
      itemType: "single_choice",
      questionType: "single_choice",
      questionText: "",
      questionTextCn: questionText,
      answers,
      correctAnswer,
      explanation: "",
      explanationCn: explanation,
      points: 1,
      difficulty: /提高|advanced|hard/i.test(questionText) ? "hard" : "medium",
      needsImage: PDF_IMPORT_IMAGE_HINT_RE.test(questionText),
      imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(questionText) ? "Question may reference an image/table/chart in the PDF. Add image manually before publishing." : "",
      reviewNotes: correctAnswer ? "" : "Could not infer the correct answer automatically. Please choose it before saving.",
    });
  }

  if (items.length === 0) return null;

  const warnings = [
    "This preview used the fast PDF text parser. Please review correct answers before saving.",
  ];

  return normalizePdfImportResult({
    exam: {
      title: sourceMeta?.fileName ? String(sourceMeta.fileName).replace(/\.pdf$/i, "") : "Imported PDF exam",
      duration: 90,
      totalPoints: Math.max(items.length, 1),
    },
    items,
    warnings,
  }, sourceMeta);
}

function normalizePdfImportResult(aiResult, sourceMeta) {
  const warnings = Array.isArray(aiResult?.warnings)
    ? aiResult.warnings.map((warning) => stringValue(warning)).filter(Boolean)
    : [];

  const rawItems = flattenImportSourceItems(aiResult);
  const items = rawItems
    .slice(0, PDF_IMPORT_MAX_QUESTIONS)
    .map((item, index) => normalizeImportedItem(item, index))
    .filter(Boolean);
  const questions = items.filter((item) => item.itemType === "single_choice");

  if (rawItems.length > items.length) {
    warnings.push(`Skipped ${rawItems.length - items.length} invalid or unsupported items. Review the PDF and add missing parts manually.`);
  }

  return {
    exam: {
      title: stringValue(aiResult?.exam?.title || aiResult?.title),
      duration: Number.parseInt(aiResult?.exam?.duration || aiResult?.duration || 90, 10) || 90,
      totalPoints: Number.parseFloat(aiResult?.exam?.totalPoints || aiResult?.totalPoints || 100) || 100,
    },
    items,
    questions,
    totalQuestionCount: items.reduce((sum, item) => sum + countImportedItemQuestions(item), 0),
    warnings,
    source: sourceMeta,
  };
}

function validateImportItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Questions are required";
  }

  const totalQuestions = items.reduce((sum, item) => sum + countImportedItemQuestions(item), 0);
  if (totalQuestions > PDF_IMPORT_MAX_QUESTIONS) {
    return `Cannot import more than ${PDF_IMPORT_MAX_QUESTIONS} questions at once`;
  }

  const answerKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];

    if (item.itemType === "single_choice") {
      const allowedKeys = answerKeys.slice(0, item.answers.length);
      if (!allowedKeys.includes(item.correctAnswer)) {
        return `Item ${itemIndex + 1} needs a valid correct answer`;
      }
      continue;
    }

    if (item.itemType === "reading_group") {
      for (let subIndex = 0; subIndex < item.subQuestions.length; subIndex++) {
        const subQuestion = item.subQuestions[subIndex];
        const allowedKeys = answerKeys.slice(0, subQuestion.answers.length);
        if (!allowedKeys.includes(subQuestion.correctAnswer)) {
          return `Reading item ${itemIndex + 1}.${subIndex + 1} needs a valid correct answer`;
        }
      }
      continue;
    }

    if (item.itemType === "fill_blank_group") {
      const optionKeys = new Set(item.linkedOptions.map((option) => option.key));
      for (let subIndex = 0; subIndex < item.subItems.length; subIndex++) {
        if (!optionKeys.has(item.subItems[subIndex].correctAnswerKey)) {
          return `Fill-blank item ${itemIndex + 1}.${subIndex + 1} needs a valid correct answer key`;
        }
      }
      continue;
    }

    return `Item ${itemIndex + 1} has an unsupported type`;
  }

  return "";
}

async function insertImportedSingleChoice(client, { examId, question, questionNumber }) {
  const answerKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const normalizedQuestion = normalizeBilingualText(question.questionText, question.questionTextCn);

  const questionResult = await client.query(
    `INSERT INTO questions (
       exam_id, question_number, question_type,
       question_text, question_text_cn,
       points, explanation, explanation_cn,
       image_url, question_group_type, difficulty
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      examId,
      questionNumber,
      QUESTION_TYPES.SINGLE_CHOICE,
      sanitize(normalizedQuestion.en),
      sanitize(normalizedQuestion.cn),
      clamp(parsePositiveNumber(question.points, 1), 0.1, MAX_POINTS_PER_QUESTION),
      question.explanation ? sanitizeExplanation(question.explanation) : null,
      question.explanationCn ? sanitizeExplanation(question.explanationCn) : null,
      question.imageUrl ? sanitize(question.imageUrl) : null,
      QUESTION_TYPES.SINGLE_CHOICE,
      question.difficulty || "medium",
    ],
  );

  const questionId = questionResult.rows[0].id;

  for (let i = 0; i < question.answers.length; i++) {
    const answer = question.answers[i];
    const normalizedAnswer = normalizeBilingualText(answer.text, answer.textCn);
    const key = answerKeys[i];

    await client.query(
      `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        questionId,
        key,
        sanitize(normalizedAnswer.en),
        sanitize(normalizedAnswer.cn),
        key === question.correctAnswer,
        answer.imageUrl ? sanitize(answer.imageUrl) : null,
      ],
    );
  }

  return {
    itemType: "single_choice",
    id: questionId,
    questionNumber,
    correctAnswer: question.correctAnswer,
    needsImage: question.needsImage === true,
  };
}

async function insertImportedReadingGroup(client, { examId, group, startQuestionNumber }) {
  const containerNumber = await getNextContainerQuestionNumber(client, examId);
  const passageResult = await client.query(
    `INSERT INTO questions (
       exam_id, question_number, question_type,
       question_text, question_text_cn,
       points, passage_text, passage_image_url,
       question_group_type, sub_question_number, passage_group_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      examId,
      containerNumber,
      QUESTION_TYPES.READING_PASSAGE,
      "Doan van doc hieu",
      "阅读理解",
      0,
      sanitize(group.passageText),
      group.passageImageUrl ? sanitize(group.passageImageUrl) : null,
      QUESTION_TYPES.READING_PASSAGE,
      null,
      null,
    ],
  );
  const groupId = passageResult.rows[0].id;
  await client.query("UPDATE questions SET passage_group_id = id WHERE id = $1", [groupId]);

  let questionNumber = startQuestionNumber - 1;
  const subQuestions = [];
  for (const subQuestion of group.subQuestions) {
    questionNumber++;
    const inserted = await insertImportedSingleChoice(client, {
      examId,
      question: subQuestion,
      questionNumber,
    });
    await client.query(
      `UPDATE questions
       SET question_type = $1,
           question_group_type = $1,
           sub_question_number = $2,
           passage_group_id = $3
       WHERE id = $4`,
      [
        QUESTION_TYPES.READING_ITEM,
        subQuestion.subQuestionNumber || questionNumber,
        groupId,
        inserted.id,
      ],
    );
    subQuestions.push(inserted);
  }

  return {
    itemType: "reading_group",
    groupId,
    questionNumber: startQuestionNumber,
    subQuestions,
    totalItems: subQuestions.length,
    needsImage: group.needsImage === true,
  };
}

async function insertImportedFillBlankGroup(client, { examId, group, startQuestionNumber }) {
  const containerNumber = await getNextContainerQuestionNumber(client, examId);
  const normalizedOpts = group.linkedOptions.map((option, index) => ({
    key: option.key || String.fromCharCode(65 + index),
    text: option.text || option.textCn,
    textCn: option.textCn || option.text,
  }));

  const poolResult = await client.query(
    `INSERT INTO questions (
       exam_id, question_number, question_type,
       question_text, question_text_cn,
       points, passage_text, passage_image_url,
       question_group_type, difficulty,
       linked_options, sub_question_number, passage_group_id, cloze_mode
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      examId,
      containerNumber,
      QUESTION_TYPES.FILL_BLANK_POOL,
      "Dien tu",
      "填空",
      0,
      group.passageText ? sanitize(group.passageText) : null,
      group.passageImageUrl ? sanitize(group.passageImageUrl) : null,
      QUESTION_TYPES.FILL_BLANK_POOL,
      "medium",
      JSON.stringify(normalizedOpts),
      null,
      null,
      group.clozeMode === "passage" ? "passage" : "sentences",
    ],
  );

  const groupId = poolResult.rows[0].id;
  await client.query("UPDATE questions SET passage_group_id = id WHERE id = $1", [groupId]);

  let questionNumber = startQuestionNumber - 1;
  const subItems = [];
  for (const subItem of group.subItems) {
    questionNumber++;
    const parsedPoints = clamp(parsePositiveNumber(subItem.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
    const normQ = normalizeBilingualText(subItem.questionText, subItem.questionTextCn);

    const subResult = await client.query(
      `INSERT INTO questions (
         exam_id, question_number, question_type,
         question_text, question_text_cn,
         points, explanation, explanation_cn,
         question_group_type, difficulty,
         sub_question_number, passage_group_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        examId,
        questionNumber,
        QUESTION_TYPES.FILL_BLANK_ITEM,
        sanitize(normQ?.en || `Blank ${questionNumber}`),
        sanitize(normQ?.cn || `Blank ${questionNumber}`),
        parsedPoints,
        subItem.explanation ? sanitizeExplanation(subItem.explanation) : null,
        subItem.explanationCn ? sanitizeExplanation(subItem.explanationCn) : null,
        QUESTION_TYPES.FILL_BLANK_ITEM,
        subItem.difficulty || "medium",
        subItem.subQuestionNumber || questionNumber,
        groupId,
      ],
    );
    const questionId = subResult.rows[0].id;

    for (const option of normalizedOpts) {
      await client.query(
        `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          questionId,
          option.key,
          sanitize(option.text),
          sanitize(option.textCn),
          option.key === subItem.correctAnswerKey,
        ],
      );
    }

    subItems.push({
      id: questionId,
      questionNumber,
      correctAnswerKey: subItem.correctAnswerKey,
    });
  }

  return {
    itemType: "fill_blank_group",
    groupId,
    questionNumber: startQuestionNumber,
    subItems,
    totalItems: subItems.length,
    needsImage: group.needsImage === true,
  };
}


function createImportPreviewError(statusCode, responseBody, cause) {
  const error = cause instanceof Error ? cause : new Error(responseBody?.message || "Import preview failed");
  error.statusCode = statusCode;
  error.responseBody = responseBody;
  return error;
}

async function previewImportFile(file, importPresetInput) {
  let ruleBasedPreview = null;

  try {
    const importPreset = normalizePdfImportPreset(importPresetInput);
    const importFile = await extractImportFileText(file);
    const extractedText = stringValue(importFile.text)
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (extractedText.length < 120) {
      throw createImportPreviewError(400, {
        message: "File does not contain enough readable text. Please use a text PDF, a Word .doc/.docx file, or enter questions manually.",
      });
    }

    const truncatedText = extractedText.slice(0, PDF_IMPORT_TEXT_LIMIT);
    const sourceMeta = {
      fileName: normalizeUploadedFileName(file.originalname),
      pages: importFile.pages || null,
      textLength: extractedText.length,
      truncated: extractedText.length > PDF_IMPORT_TEXT_LIMIT,
      importPreset,
      fileType: importFile.fileType,
    };

    ruleBasedPreview = shouldUseRuleBasedPdfParser(importPreset)
      ? parsePdfTextWithRules(truncatedText, sourceMeta)
      : null;

    const rawAi = await callPdfImportAI(buildPdfImportPrompt(truncatedText, importPreset), {
      temperature: 0.15,
      maxTokens: 6500,
      timeout: 90000,
      attemptsPerModel: 1,
    });
    const aiResult = parseAiJsonObject(rawAi);

    if (!aiResult) {
      if (ruleBasedPreview?.items?.length) {
        return withRuleBasedFallbackWarning(
          ruleBasedPreview,
          "AI did not return valid JSON; returned rule-based preview fallback.",
        );
      }

      throw createImportPreviewError(502, {
        message: "AI did not return a valid import JSON. Please try again with a shorter PDF.",
        preview: String(rawAi || "").slice(0, 800),
      });
    }

    const normalized = normalizePdfImportResult(aiResult, sourceMeta);

    if (normalized.items.length === 0) {
      if (ruleBasedPreview?.items?.length) {
        return withRuleBasedFallbackWarning(
          ruleBasedPreview,
          "AI returned no valid questions; returned rule-based preview fallback.",
        );
      }

      throw createImportPreviewError(422, {
        message: "No valid supported questions were found in this PDF.",
        ...normalized,
      });
    }

    return normalized;
  } catch (error) {
    if (error.statusCode && error.responseBody) throw error;

    if (ruleBasedPreview?.items?.length) {
      return withRuleBasedFallbackWarning(ruleBasedPreview, getPdfImportFallbackReason(error));
    }

    if (error.message === "RATE_LIMITED") {
      throw createImportPreviewError(429, {
        message: "AI is rate limited. Please try again later.",
        retryAfter: error.retryAfter || aiService.getRateLimitRemaining?.(),
      }, error);
    }

    if (error.message === "AI_TIMEOUT") {
      throw createImportPreviewError(504, {
        message: "AI took too long to parse this PDF. Please try a shorter PDF.",
      }, error);
    }

    if (
      error.message === "Chi cho phep upload file PDF" ||
      error.message === "Chi cho phep upload file PDF hoac Word .doc/.docx"
    ) {
      throw createImportPreviewError(400, { message: error.message }, error);
    }

    if (error.message === "UNSUPPORTED_IMPORT_FILE") {
      throw createImportPreviewError(400, { message: "Only PDF and Word .doc/.docx files are supported." }, error);
    }

    throw createImportPreviewError(500, { message: "Failed to preview import file" }, error);
  }
}

module.exports = {
  previewImportFile,
  normalizeImportedItem,
  validateImportItems,
  countImportedItemQuestions,
  insertImportedSingleChoice,
  insertImportedReadingGroup,
  insertImportedFillBlankGroup,
  parsePdfTextWithRules,
};
