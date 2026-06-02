const { pool } = require("../config/database");
const { cache } = require("../config/cache");
const aiConfig = require("../config/aiConfig");
const UserActivity = require("../models/UserActivity");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");
const aiService = require("../services/aiService");
const {
  buildPdfImportPrompt,
  normalizePdfImportPreset,
  shouldUseRuleBasedPdfParser,
} = require("../services/pdfImportPromptService");
const {
  extractSingleQuestionImageOcrText,
} = require("../services/singleQuestionImageOcrService");

// ─── P1 Security: XSS sanitization (strip HTML tags, allow plain text only) ─────
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeExplanation(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\0/g, "").trim();
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

// ─── P1: Validate question points ──────────────────────────────────────────────
const MAX_POINTS_PER_QUESTION = 100;
const MAX_QUESTIONS_PER_EXAM = 200;
const MISSING_EXAM_MESSAGE = "De thi khong ton tai hoac da bi xoa. Vui long tai lai danh sach de.";

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

const PDF_EXPLANATION_MARKER_RE = /(?:^|\s)(?:\u7b54\u6848\u89e3\u6790|\u89e3\u6790|\u89e3\u7b54|\u8bf4\u660e|\u89e3|analysis|explanation|l\u1eddi gi\u1ea3i|loi giai|gi\u1ea3i th\u00edch|giai thich)\s*[:\uff1a]\s*/i;

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

function normalizeExamAccess(isPremium, vipTier) {
  const normalizedTier = vipTier && vipTier !== "basic" ? "vip" : "basic";
  const normalizedPremium =
    normalizedTier !== "basic" || isPremium === true;

  return {
    isPremium: normalizedPremium,
    vipTier: normalizedPremium ? "vip" : "basic",
  };
}

function isSuperAdmin(req) {
  const roles = req.user?.rbacRoles || [];
  const permissions = req.user?.permissions || [];
  return roles.includes("super_admin") || permissions.includes("*");
}

// ─── Question types cho đề tiếng Trung ────────────────────────────────────────────
const QUESTION_TYPES = {
  SINGLE_CHOICE:     'single_choice',       // Trắc nghiệm A-B-C-D (câu 1-10, 26-33, 49-70)
  FILL_BLANK_POOL:   'fill_blank_pool',      // Điền từ đầu nhóm, có pool A-F (câu 11-25)
  FILL_BLANK_ITEM:   'fill_blank_item',     // Điền từ con trong nhóm, dùng linked_options cha
  READING_PASSAGE:    'reading_passage',      // Đọc hiểu đầu đoạn (câu 34, 71...)
  READING_ITEM:       'reading_item',         // Câu con trong đoạn đọc hiểu (35, 36, 72...)
  TRUE_FALSE:        'true_false',           // Đúng/Sai
};

// ─── Helper: lấy passage_group_id của câu cha gần nhất ───────────────────────
async function getLatestPassageGroupId(client, examId) {
  const r = await client.query(
    `SELECT id FROM questions
     WHERE exam_id = $1 AND passage_group_id IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [examId],
  );
  return r.rows[0]?.id ?? null;
}

// ─── Helper: normalize linked_options (pool A-F) ─────────────────────────────────
// Frontend convention: text = Tiếng Việt, textCn = Tiếng Trung
// Backend: nếu text rỗng thì dùng textCn làm fallback cho cả hai
function normalizeLinkedOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return null;
  const normalized = rawOptions
    .map((opt, i) => {
    const text = (opt.text || '').trim();
    const textCn = (opt.textCn || '').trim();
    return {
      key:   opt.key || String.fromCharCode(65 + i),
      text,
      textCn,
    };
  })
    .filter((opt) => opt.text || opt.textCn);

  return normalized.length >= 2 ? normalized : null;
}

async function getAppendQuestionPosition(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MAX(question_number), 0)::int + 1 AS position FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL",
    [examId],
  );
  return result.rows[0].position || 1;
}

async function getNextContainerQuestionNumber(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MIN(question_number), 0)::int - 1 AS question_number FROM questions WHERE exam_id = $1 AND question_number < 0 AND deleted_at IS NULL",
    [examId],
  );
  return result.rows[0].question_number || -1;
}

async function ensureExamExists(client, examId) {
  const result = await client.query(
    "SELECT 1 FROM exams WHERE id = $1 LIMIT 1",
    [examId],
  );
  return result.rows.length > 0;
}

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1::text) AS table_name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
}

async function execIfTableExists(client, tableName, sql, params = []) {
  if (!(await tableExists(client, tableName))) return 0;
  const result = await client.query(sql, params);
  return result.rowCount || 0;
}

function isMissingQuestionExamForeignKey(error) {
  return error.code === "23503" && error.constraint === "questions_exam_id_fkey";
}

async function shiftQuestionNumbers(client, examId, fromPosition, delta) {
  if (!delta) return;
  const offset = 10000;
  await client.query(
    `UPDATE questions
     SET question_number = question_number + $3::int
     WHERE exam_id = $1::int AND question_number >= $2::int AND question_number > 0 AND deleted_at IS NULL`,
    [examId, fromPosition, offset],
  );
  await client.query(
    `UPDATE questions
     SET question_number = question_number - $3::int + $4::int
     WHERE exam_id = $1::int AND question_number >= ($2::int + $3::int) AND deleted_at IS NULL`,
    [examId, fromPosition, offset, delta],
  );
}

const PDF_IMPORT_TEXT_LIMIT = 60000;
const PDF_IMPORT_MAX_QUESTIONS = 120;
const PDF_IMPORT_IMAGE_HINT_RE = /(hinh|anh|bieu do|do thi|so do|figure|image|diagram|chart|map|graph|picture|看图|图|图片|图表)/i;

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

function parsePdfTextWithRules(pdfText, sourceMeta) {
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

const AdminExamController = {
  async ocrSingleQuestionImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Cần gửi ảnh câu hỏi" });
      }

      const text = await extractSingleQuestionImageOcrText(req.file);
      if (!text) {
        return res.status(422).json({ message: "Không đọc được chữ từ ảnh" });
      }

      res.json({
        text,
        source: {
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });
    } catch (error) {
      console.error("Single question image OCR error:", error);

      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI OCR đang bị giới hạn tạm thời",
          retryAfter: error.retryAfter,
        });
      }

      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI OCR quá thời gian" });
      }

      res.status(500).json({ message: "OCR ảnh thất bại" });
    }
  },

  async previewPdfImport(req, res) {
    let ruleBasedPreview = null;

    try {
      if (!req.file) {
        return res.status(400).json({ message: "PDF or Word .doc/.docx file is required" });
      }

      const importPreset = normalizePdfImportPreset(req.body?.importPreset);
      const importFile = await extractImportFileText(req.file);
      const extractedText = stringValue(importFile.text)
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (extractedText.length < 120) {
        return res.status(400).json({
          message: "File does not contain enough readable text. Please use a text PDF, a Word .doc/.docx file, or enter questions manually.",
        });
      }

      const truncatedText = extractedText.slice(0, PDF_IMPORT_TEXT_LIMIT);
      const sourceMeta = {
        fileName: normalizeUploadedFileName(req.file.originalname),
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
          return res.json(withRuleBasedFallbackWarning(
            ruleBasedPreview,
            "AI did not return valid JSON; returned rule-based preview fallback.",
          ));
        }

        return res.status(502).json({
          message: "AI did not return a valid import JSON. Please try again with a shorter PDF.",
          preview: String(rawAi || "").slice(0, 800),
        });
      }

      const normalized = normalizePdfImportResult(aiResult, sourceMeta);

      if (normalized.items.length === 0) {
        if (ruleBasedPreview?.items?.length) {
          return res.json(withRuleBasedFallbackWarning(
            ruleBasedPreview,
            "AI returned no valid questions; returned rule-based preview fallback.",
          ));
        }

        return res.status(422).json({
          message: "No valid supported questions were found in this PDF.",
          ...normalized,
        });
      }

      res.json(normalized);
    } catch (error) {
      console.error("Preview file import error:", error);

      if (ruleBasedPreview?.items?.length) {
        return res.json(withRuleBasedFallbackWarning(ruleBasedPreview, getPdfImportFallbackReason(error)));
      }

      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI is rate limited. Please try again later.",
          retryAfter: error.retryAfter || aiService.getRateLimitRemaining?.(),
        });
      }

      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({
          message: "AI took too long to parse this PDF. Please try a shorter PDF.",
        });
      }

      if (
        error.message === "Chi cho phep upload file PDF" ||
        error.message === "Chi cho phep upload file PDF hoac Word .doc/.docx"
      ) {
        return res.status(400).json({ message: error.message });
      }

      if (error.message === "UNSUPPORTED_IMPORT_FILE") {
        return res.status(400).json({ message: "Only PDF and Word .doc/.docx files are supported." });
      }

      res.status(500).json({ message: "Failed to preview import file" });
    }
  },

  async bulkImportQuestions(req, res) {
    const { examId } = req.params;
    const rawItems = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body?.questions)
        ? req.body.questions.map((question) => ({ ...question, itemType: "single_choice" }))
        : [];
    const items = rawItems.map((item, index) => normalizeImportedItem(item, index));
    const invalidIndex = items.findIndex((item) => !item);

    if (invalidIndex !== -1) {
      return res.status(400).json({ message: `Item ${invalidIndex + 1} is invalid or unsupported` });
    }

    const validationError = validateImportItems(items);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const totalImportQuestions = items.reduce((sum, item) => sum + countImportedItemQuestions(item), 0);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId, 10)]);

      if (!(await ensureExamExists(client, examId))) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const countResult = await client.query(
        "SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL",
        [examId],
      );
      const currentCount = countResult.rows[0].count || 0;

      if (currentCount + totalImportQuestions > MAX_QUESTIONS_PER_EXAM) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Exam cannot exceed ${MAX_QUESTIONS_PER_EXAM} questions` });
      }

      let questionNumber = (await getAppendQuestionPosition(client, examId)) - 1;
      const insertedItems = [];

      for (const item of items) {
        const startQuestionNumber = questionNumber + 1;
        let insertedItem;

        if (item.itemType === "reading_group") {
          insertedItem = await insertImportedReadingGroup(client, {
            examId,
            group: item,
            startQuestionNumber,
          });
        } else if (item.itemType === "fill_blank_group") {
          insertedItem = await insertImportedFillBlankGroup(client, {
            examId,
            group: item,
            startQuestionNumber,
          });
        } else {
          insertedItem = await insertImportedSingleChoice(client, {
            examId,
            question: item,
            questionNumber: startQuestionNumber,
          });
        }

        questionNumber += countImportedItemQuestions(item);
        insertedItems.push(insertedItem);
      }

      await client.query(
        "UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2",
        [totalImportQuestions, examId],
      );

      await client.query("COMMIT");

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, "admin.bulk_import_questions", {
        examId,
        count: totalImportQuestions,
        items: insertedItems.length,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({
        message: "Questions imported",
        insertedCount: totalImportQuestions,
        insertedItems,
        insertedQuestions: insertedItems.filter((item) => item.itemType === "single_choice"),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Bulk import questions error:", error);
      if (isMissingQuestionExamForeignKey(error)) {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      res.status(500).json({ message: "Failed to import questions" });
    } finally {
      client.release();
    }
  },

  // Create new exam
  async createExam(req, res) {
    try {
      // P0: destructure titleCn
      const { title, titleCn, subjectId, duration, totalPoints, description, descriptionCn, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated, difficulty_level } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ message: "Title and subject required" });
      }

      // P1: validate subjectId exists
      const subjectCheck = await pool.query("SELECT id FROM subjects WHERE id = $1", [subjectId]);
      if (subjectCheck.rows.length === 0) {
        return res.status(400).json({ message: "Subject not found" });
      }

      const parsedTotalPoints = parsePositiveNumber(totalPoints, 100);

      // P1: sanitize all text inputs to prevent XSS
      const examCode = `EXAM-${subjectId}-${Date.now()}`;
      const safeTitle = sanitize(title);
      const safeTitleCn = titleCn ? sanitize(titleCn) : null;
      const safeDescription = description ? sanitize(description) : "";
      const access = normalizeExamAccess(is_premium, vip_tier);

      const result = await pool.query(
        `INSERT INTO exams (code, title, title_cn, subject_id, duration, total_points, total_questions, description, difficulty_level, status, publish_date, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'draft', NOW(), $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          examCode,
          safeTitle,
          safeTitleCn,
          subjectId,
          duration || 90,
          parsedTotalPoints,
          safeDescription,
          difficulty_level || 'medium',
          access.isPremium,
          solution_video_url ? sanitize(solution_video_url) : null,
          solution_description ? sanitize(solution_description) : null,
          shuffle_mode === true,
          access.vipTier,
          is_simulated === true,
          req.user.id,
        ],
      );

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, 'admin.create_exam', { examId: result.rows[0].id, title, ip: req.ip, userAgent: req.headers['user-agent'] });

      res.status(201).json({
        message: "Exam created",
        exam: result.rows[0],
      });
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({ message: "Failed to create exam" });
    }
  },

  // Update exam
  async updateExam(req, res) {
    try {
      const { examId } = req.params;
      // P0: destructure titleCn, descriptionCn
      const { title, titleCn, duration, totalPoints, description, difficulty_level, status, is_premium, allow_download, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated } = req.body;
      const parsedTotalPoints =
        totalPoints === undefined
          ? undefined
          : parsePositiveNumber(totalPoints, 100);

      const updates = [];
      const params = [];
      let idx = 1;
      // P1: sanitize all text fields + P0: handle titleCn/descriptionCn
      if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(sanitize(title)); }
      if (titleCn !== undefined) { updates.push(`title_cn = $${idx++}`); params.push(titleCn ? sanitize(titleCn) : null); }
      if (duration !== undefined) { updates.push(`duration = $${idx++}`); params.push(duration); }
      if (parsedTotalPoints !== undefined) { updates.push(`total_points = $${idx++}`); params.push(parsedTotalPoints); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description ? sanitize(description) : null); }
      if (difficulty_level !== undefined) { updates.push(`difficulty_level = $${idx++}`); params.push(difficulty_level); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
      if (is_premium !== undefined || vip_tier !== undefined) {
        const access = normalizeExamAccess(is_premium, vip_tier);
        updates.push(`is_premium = $${idx++}`);
        params.push(access.isPremium);
        updates.push(`vip_tier = $${idx++}`);
        params.push(access.vipTier);
      }
      if (allow_download !== undefined) { updates.push(`allow_download = $${idx++}`); params.push(allow_download === true); }
      if (solution_video_url !== undefined) { updates.push(`solution_video_url = $${idx++}`); params.push(solution_video_url ? sanitize(solution_video_url) : null); }
      if (solution_description !== undefined) { updates.push(`solution_description = $${idx++}`); params.push(solution_description ? sanitize(solution_description) : null); }
      if (shuffle_mode !== undefined) { updates.push(`shuffle_mode = $${idx++}`); params.push(shuffle_mode === true); }
      if (is_simulated !== undefined) { updates.push(`is_simulated = $${idx++}`); params.push(is_simulated === true); }
      updates.push(`updated_at = NOW()`);
      params.push(examId);

      const result = await pool.query(
        `UPDATE exams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, 'admin.update_exam', { examId, updates: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });


      res.json({ message: "Exam updated", exam: result.rows[0] });
    } catch (error) {
      console.error("Update exam error:", error);
      res.status(500).json({ message: "Failed to update exam" });
    }
  },

  // Delete exam
  async deleteExam(req, res) {
    try {
      const { examId } = req.params;
      const reason = sanitize(req.body?.reason || req.query?.reason || "");
      const examResult = await pool.query(
        `SELECT e.id, e.title, e.status, e.deleted_at, e.deletion_status,
                COUNT(ea.id)::int AS attempts_count
         FROM exams e
         LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
         WHERE e.id = $1
         GROUP BY e.id`,
        [examId],
      );

      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const exam = examResult.rows[0];
      if (exam.deleted_at) {
        return res.status(400).json({ message: "Đề thi này đã nằm trong thùng rác mềm." });
      }

      const hasAttempts = Number(exam.attempts_count || 0) > 0;
      const needsApproval = !isSuperAdmin(req) && (hasAttempts || exam.status === "published");

      if (needsApproval) {
        const result = await pool.query(
          `UPDATE exams
           SET deletion_status = 'requested',
               delete_requested_at = NOW(),
               delete_requested_by = $2,
               delete_request_reason = NULLIF($3, ''),
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, title, deletion_status, delete_requested_at`,
          [examId, req.user.id, reason],
        );

        cache.delByPrefix("exams:");
        cache.del("exams:lobby");
        UserActivity.log(req.user.id, 'admin.request_delete_exam', {
          examId,
          examTitle: exam.title,
          attemptsCount: Number(exam.attempts_count || 0),
          reason,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        return res.status(202).json({
          message: "Đề đã có dữ liệu thật hoặc đang public nên đã chuyển thành yêu cầu xóa để admin tổng duyệt.",
          exam: result.rows[0],
          requiresApproval: true,
        });
      }

      const result = await pool.query(
        `UPDATE exams
         SET status = 'archived',
             deleted_at = NOW(),
             deleted_by = $2,
             delete_reason = NULLIF($3, ''),
             deletion_status = 'soft_deleted',
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, status, deleted_at, deletion_status`,
        [examId, req.user.id, reason],
      );

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");
      UserActivity.log(req.user.id, 'admin.soft_delete_exam', {
        examId,
        examTitle: exam.title,
        reason,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        message: "Đề đã được chuyển vào thùng rác mềm. Dữ liệu câu hỏi, lượt thi và đáp án vẫn được giữ để có thể khôi phục.",
        exam: result.rows[0],
      });
    } catch (error) {
      console.error("Delete exam error:", error);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  },

  async restoreExam(req, res) {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Chỉ admin tổng được khôi phục đề đã xóa mềm." });
      }

      const { examId } = req.params;
      const result = await pool.query(
        `UPDATE exams
         SET deleted_at = NULL,
             deleted_by = NULL,
             delete_reason = NULL,
             delete_requested_at = NULL,
             delete_requested_by = NULL,
             delete_request_reason = NULL,
             deletion_status = 'none',
             status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, status`,
        [examId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");
      UserActivity.log(req.user.id, 'admin.restore_exam', {
        examId,
        examTitle: result.rows[0].title,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: "Đã khôi phục đề thi.", exam: result.rows[0] });
    } catch (error) {
      console.error("Restore exam error:", error);
      res.status(500).json({ message: "Failed to restore exam" });
    }
  },

  // Permanently delete an exam that is already in soft trash.
  async permanentDeleteExam(req, res) {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: "Chỉ admin tổng được xóa vĩnh viễn đề trong thùng rác mềm." });
    }

    const { examId } = req.params;
    const reason = sanitize(req.body?.reason || req.query?.reason || "");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const examResult = await client.query(
        `SELECT id, title, deleted_at, deletion_status
         FROM exams
         WHERE id = $1
         FOR UPDATE`,
        [examId],
      );

      if (examResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Exam not found" });
      }

      const exam = examResult.rows[0];
      if (!exam.deleted_at) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Chỉ có thể xóa vĩnh viễn đề đã nằm trong thùng rác mềm." });
      }

      const stats = {};
      stats.certificates = await execIfTableExists(client, "exam_certificates", "DELETE FROM exam_certificates WHERE exam_id = $1", [examId]);
      stats.violations = await execIfTableExists(client, "exam_violations", "DELETE FROM exam_violations WHERE exam_id = $1", [examId]);
      stats.aiInsights = await execIfTableExists(
        client,
        "ai_insights",
        "DELETE FROM ai_insights WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = $1)",
        [examId],
      );
      stats.userAnswers = await execIfTableExists(
        client,
        "user_answers",
        `DELETE FROM user_answers
         WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = $1)
            OR question_id IN (SELECT id FROM questions WHERE exam_id = $1)
            OR selected_answer_id IN (
              SELECT a.id FROM answers a
              JOIN questions q ON q.id = a.question_id
              WHERE q.exam_id = $1
            )`,
        [examId],
      );
      stats.attempts = await execIfTableExists(client, "exam_attempts", "DELETE FROM exam_attempts WHERE exam_id = $1", [examId]);

      stats.roomStudents = await execIfTableExists(
        client,
        "exam_room_students",
        `DELETE FROM exam_room_students
         WHERE registration_id IN (SELECT id FROM exam_registrations WHERE exam_id = $1)
            OR room_id IN (SELECT id FROM exam_rooms WHERE exam_id = $1)`,
        [examId],
      );
      stats.proctors = await execIfTableExists(
        client,
        "exam_proctor_assignments",
        "DELETE FROM exam_proctor_assignments WHERE room_id IN (SELECT id FROM exam_rooms WHERE exam_id = $1)",
        [examId],
      );
      stats.rooms = await execIfTableExists(client, "exam_rooms", "DELETE FROM exam_rooms WHERE exam_id = $1", [examId]);
      stats.registrations = await execIfTableExists(client, "exam_registrations", "DELETE FROM exam_registrations WHERE exam_id = $1", [examId]);
      stats.scheduleLogs = await execIfTableExists(client, "exam_schedule_logs", "DELETE FROM exam_schedule_logs WHERE exam_id = $1", [examId]);
      stats.adminMap = await execIfTableExists(client, "exam_admin_map", "DELETE FROM exam_admin_map WHERE exam_id = $1", [examId]);
      stats.recommendations = await execIfTableExists(client, "user_recommended_exams", "DELETE FROM user_recommended_exams WHERE exam_id = $1", [examId]);
      stats.examBookmarks = await execIfTableExists(client, "user_bookmarks", "DELETE FROM user_bookmarks WHERE entity_type = 'exam' AND entity_id = $1", [examId]);
      stats.questionBookmarks = await execIfTableExists(
        client,
        "user_bookmarks",
        "DELETE FROM user_bookmarks WHERE entity_type = 'question' AND entity_id IN (SELECT id FROM questions WHERE exam_id = $1)",
        [examId],
      );
      stats.questionNotes = await execIfTableExists(
        client,
        "user_question_notes",
        "DELETE FROM user_question_notes WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)",
        [examId],
      );

      if (await tableExists(client, "user_practice_sets")) {
        await client.query(
          `UPDATE user_practice_sets ups
           SET question_ids = COALESCE((
             SELECT array_agg(kept.qid ORDER BY kept.ord)
             FROM unnest(ups.question_ids) WITH ORDINALITY AS kept(qid, ord)
             WHERE NOT EXISTS (
               SELECT 1 FROM questions q WHERE q.exam_id = $1 AND q.id = kept.qid
             )
           ), '{}'::integer[]),
               updated_at = CURRENT_TIMESTAMP
           WHERE EXISTS (
             SELECT 1
             FROM unnest(ups.question_ids) AS ids(qid)
             JOIN questions q ON q.id = ids.qid
             WHERE q.exam_id = $1
           )`,
          [examId],
        );
      }

      stats.topicMappings = await execIfTableExists(
        client,
        "question_topic_mapping",
        "DELETE FROM question_topic_mapping WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)",
        [examId],
      );
      await client.query("UPDATE questions SET passage_group_id = NULL WHERE exam_id = $1", [examId]);
      stats.answers = await execIfTableExists(
        client,
        "answers",
        "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)",
        [examId],
      );
      stats.questions = await execIfTableExists(client, "questions", "DELETE FROM questions WHERE exam_id = $1", [examId]);
      const deletedExam = await client.query("DELETE FROM exams WHERE id = $1 RETURNING id, title", [examId]);

      await client.query("COMMIT");
      cache.delByPrefix("exams:");
      cache.del("exams:lobby");
      UserActivity.log(req.user.id, "admin.permanent_delete_exam", {
        examId,
        examTitle: exam.title,
        reason,
        deletedRows: stats,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.json({
        message: "Đã xóa vĩnh viễn đề thi khỏi thùng rác mềm.",
        exam: deletedExam.rows[0],
        deletedRows: stats,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Permanent delete exam error:", error);
      if (error.code === "23503") {
        return res.status(409).json({
          message: "Không thể xóa vĩnh viễn vì vẫn còn dữ liệu liên kết. Vui lòng báo kỹ thuật kiểm tra khóa ngoại còn lại.",
          constraint: error.constraint,
        });
      }
      return res.status(500).json({ message: "Failed to permanently delete exam" });
    } finally {
      client.release();
    }
  },

  async approveDeleteRequest(req, res) {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Chỉ admin tổng được duyệt yêu cầu xóa đề." });
      }

      const { examId } = req.params;
      const reason = sanitize(req.body?.reason || req.query?.reason || "");
      const examResult = await pool.query(
        `SELECT id, title, deletion_status, delete_request_reason
         FROM exams
         WHERE id = $1`,
        [examId],
      );

      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const exam = examResult.rows[0];
      if (exam.deletion_status !== "requested") {
        return res.status(400).json({ message: "Đề này không có yêu cầu xóa đang chờ duyệt." });
      }

      const result = await pool.query(
        `UPDATE exams
         SET status = 'archived',
             deleted_at = NOW(),
             deleted_by = $2,
             delete_reason = COALESCE(NULLIF($3, ''), delete_request_reason),
             deletion_status = 'soft_deleted',
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, status, deleted_at, deletion_status`,
        [examId, req.user.id, reason],
      );

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");
      UserActivity.log(req.user.id, "admin.approve_delete_exam", {
        examId,
        examTitle: exam.title,
        reason,
        requestReason: exam.delete_request_reason,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: "Đã duyệt yêu cầu xóa. Đề đã được chuyển vào thùng rác mềm.",
        exam: result.rows[0],
      });
    } catch (error) {
      console.error("Approve delete request error:", error);
      res.status(500).json({ message: "Failed to approve delete request" });
    }
  },

  async rejectDeleteRequest(req, res) {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Chỉ admin tổng được từ chối yêu cầu xóa đề." });
      }

      const { examId } = req.params;
      const reason = sanitize(req.body?.reason || req.query?.reason || "");
      const examResult = await pool.query(
        `SELECT id, title, deletion_status
         FROM exams
         WHERE id = $1`,
        [examId],
      );

      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const exam = examResult.rows[0];
      if (exam.deletion_status !== "requested") {
        return res.status(400).json({ message: "Đề này không có yêu cầu xóa đang chờ duyệt." });
      }

      const result = await pool.query(
        `UPDATE exams
         SET delete_requested_at = NULL,
             delete_requested_by = NULL,
             delete_request_reason = NULL,
             deletion_status = 'none',
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, status, deletion_status`,
        [examId],
      );

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");
      UserActivity.log(req.user.id, "admin.reject_delete_exam", {
        examId,
        examTitle: exam.title,
        reason,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: "Đã từ chối yêu cầu xóa. Đề vẫn được giữ lại.",
        exam: result.rows[0],
      });
    } catch (error) {
      console.error("Reject delete request error:", error);
      res.status(500).json({ message: "Failed to reject delete request" });
    }
  },

  // ─── ADD QUESTION (hỗ trợ 6 loại câu hỏi) ──────────────────────────────
  async addQuestion(req, res) {
    try {
      const { examId } = req.params;
      const {
        questionType,        // Loại câu hỏi: single_choice | fill_blank_pool | fill_blank_item | reading_passage | reading_item
        questionText,       // Nội dung câu hỏi (tiếng Anh, optional)
        questionTextCn,     // Nội dung câu hỏi (tiếng Trung)
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,           // Mảng [{text, textCn, isCorrect}] — cho single_choice / reading_item
        correctAnswer,     // Key đúng: 'A','B','C','D' — cho single_choice / reading_item
        passageText,       // Đoạn văn đọc hiểu / điền từ
        passageImageUrl,
        passageGroupType,  // legacy alias cho questionType
        difficulty,
        linkedOptions,      // Pool A-F cho fill_blank_pool
        correctAnswerKey,   // 'A'/'B'... cho fill_blank_item
        subQuestionNumber,  // Số câu con trong đoạn (34, 35, 36...)
      } = req.body;

      // Resolve question type (hỗ trợ cả tên cũ)
      const qType = questionType || passageGroupType || QUESTION_TYPES.SINGLE_CHOICE;

      // Validation cơ bản
      if (qType !== QUESTION_TYPES.FILL_BLANK_ITEM && qType !== QUESTION_TYPES.FILL_BLANK_POOL && qType !== QUESTION_TYPES.READING_PASSAGE) {
        // Câu điền từ con, điền từ pool & đọc hiểu đầu đoạn KHÔNG bắt buộc questionText
        // (nội dung nằm trong passageText)
        const normQ = normalizeBilingualText(questionText, questionTextCn);
        if (!normQ) {
          return res.status(400).json({ message: "Câu hỏi phải có nội dung (Tiếng Anh hoặc Tiếng Trung)" });
        }
      }

      // Đọc hiểu: bắt buộc có passageText
      if (qType === QUESTION_TYPES.READING_PASSAGE) {
        if (!passageText || !passageText.trim()) {
          return res.status(400).json({ message: "Đọc hiểu cần có đoạn văn (passageText)" });
        }
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        if (!(await ensureExamExists(client, examId))) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
        }

        // ── Kiểm tra max questions ──
        const countResult = await client.query(
          "SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1 AND deleted_at IS NULL",
          [examId],
        );
        if (countResult.rows[0].count >= MAX_QUESTIONS_PER_EXAM) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `Đề thi đã đạt giới hạn ${MAX_QUESTIONS_PER_EXAM} câu` });
        }

        const questionNumber = countResult.rows[0].count + 1;

        // ── Xác định passage_group_id và sub_question_number ──
        let passageGroupId = null;
        let subQn = null;

        if (qType === QUESTION_TYPES.READING_ITEM || qType === QUESTION_TYPES.FILL_BLANK_ITEM) {
          // Câu con: lấy group của câu cha gần nhất
          passageGroupId = await getLatestPassageGroupId(client, examId);
          if (!passageGroupId) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Không tìm thấy nhóm câu cha. Vui lòng thêm câu bắt đầu nhóm trước." });
          }
        }

        if (qType === QUESTION_TYPES.READING_ITEM || qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_ITEM) {
          // Đọc hiểu & Điền từ: số câu con
          subQn = subQuestionNumber || questionNumber;
        }

        // ── Normalize linked_options cho fill_blank_pool ──
        let linkedOpts = null;
        if (qType === QUESTION_TYPES.FILL_BLANK_POOL) {
          if (!passageText || !passageText.trim()) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Điền từ cần có đoạn văn với chỗ trống (passageText)" });
          }
          linkedOpts = normalizeLinkedOptions(linkedOptions || []);
          if (!linkedOpts || linkedOpts.length < 2) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Điền từ cần ít nhất 2 lựa chọn A-F" });
          }
        }

        // ── Validate answers: single_choice / reading_item ──
        if ((qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) && qType !== QUESTION_TYPES.FILL_BLANK_ITEM) {
          const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
          if (normAnswers.some(a => !a) || normAnswers.length < 2 || normAnswers.length > 8) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Cần từ 2 đến 8 đáp án" });
          }
        }

        // ── Validate correct answer: single_choice / reading_item ──
        if ((qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) && !correctAnswer) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Cần chọn đáp án đúng (correctAnswer)" });
        }

        // ── Validate correct answer: fill_blank_item ──
        if (qType === QUESTION_TYPES.FILL_BLANK_ITEM && !correctAnswerKey) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Câu điền từ cần chỉ định đáp án đúng (correctAnswerKey)" });
        }

        // ── INSERT câu hỏi ──
        const normQ = normalizeBilingualText(questionText, questionTextCn);
        const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

        const questionResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, explanation, explanation_cn,
             image_url,
             passage_text, passage_image_url,
             question_group_type, difficulty,
             linked_options, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING id`,
          [
            examId,
            questionNumber,
            qType,
            sanitize(normQ?.en || ''),
            sanitize(normQ?.cn || ''),
            parsedPoints,
            explanation ? sanitizeExplanation(explanation) : null,
            explanationCn ? sanitizeExplanation(explanationCn) : null,
            imageUrl ? sanitize(imageUrl) : null,
            passageText ? sanitize(passageText) : null,
            passageImageUrl ? sanitize(passageImageUrl) : null,
            qType,
            difficulty || null,
            linkedOpts ? JSON.stringify(linkedOpts) : null,
            subQn,
            passageGroupId,
          ],
        );

        const questionId = questionResult.rows[0].id;

        // ── UPDATE passage_group_id cho câu đầu đoạn ──
        if (qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_POOL) {
          await client.query(
            "UPDATE questions SET passage_group_id = id WHERE id = $1",
            [questionId],
          );
        }

        // ── INSERT answers: single_choice / reading_item ──
        if (qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) {
          const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < normAnswers.length; i++) {
            const key = answerKeys[i];
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                questionId,
                key,
                sanitize(normAnswers[i].en),
                sanitize(normAnswers[i].cn),
                key === correctAnswer,
                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
              ],
            );
          }
        }

        // ── UPDATE exam total_questions ──
        await client.query(
          "UPDATE exams SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1",
          [examId],
        );

        await client.query("COMMIT");

        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, 'admin.add_question', {
          examId, questionId, questionType: qType,
          ip: req.ip, userAgent: req.headers['user-agent']
        });

        res.status(201).json({
          message: "Question added",
          questionId,
          questionType: qType,
          questionNumber,
          passageGroupId: qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_POOL ? questionId : passageGroupId,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Add question error:", error);
      if (isMissingQuestionExamForeignKey(error)) {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      res.status(500).json({ message: "Failed to add question" });
    }
  },

  // Update question (hỗ trợ đủ 6 loại câu hỏi)
  async updateQuestion(req, res) {
    try {
      const { questionId } = req.params;
      const {
        questionType,
        questionText,
        questionTextCn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,
        correctAnswer,
        passageText,
        passageImageUrl,
        questionGroupType,
        difficulty,
        linkedOptions,
        correctAnswerKey,
        subQuestionNumber,
      } = req.body;

      const hasQuestionTextPayload = questionText !== undefined || questionTextCn !== undefined;
      const normalizedQuestion = hasQuestionTextPayload ? normalizeBilingualText(questionText, questionTextCn) : null;

      if (hasQuestionTextPayload && !normalizedQuestion) {
        return res.status(400).json({ message: "Câu hỏi không thể trống ở cả hai ngôn ngữ" });
      }

      const parsedPoints = points !== undefined
        ? clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION)
        : undefined;

      // Normalize linked_options
      let linkedOpts = undefined;
      if (linkedOptions !== undefined) {
        if (linkedOptions === null || linkedOptions === '') {
          linkedOpts = null;
        } else {
          linkedOpts = normalizeLinkedOptions(linkedOptions);
        }
      }

      const qType = questionType || questionGroupType;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Update question (sanitized) — chỉ update fields được gửi lên
        const fields = [];
        const vals = [];
        let idx = 1;

        if (normalizedQuestion) {
          fields.push(`question_text = $${idx++}`);
          vals.push(sanitize(normalizedQuestion.en));
          fields.push(`question_text_cn = $${idx++}`);
          vals.push(sanitize(normalizedQuestion.cn));
        }
        if (imageUrl !== undefined) {
          fields.push(`image_url = $${idx++}`);
          vals.push(imageUrl ? sanitize(imageUrl) : null);
        }
        if (parsedPoints !== undefined) {
          fields.push(`points = $${idx++}`);
          vals.push(parsedPoints);
        }
        if (explanation !== undefined) {
          fields.push(`explanation = $${idx++}`);
          vals.push(explanation ? sanitizeExplanation(explanation) : null);
        }
        if (explanationCn !== undefined) {
          fields.push(`explanation_cn = $${idx++}`);
          vals.push(explanationCn ? sanitizeExplanation(explanationCn) : null);
        }
        if (passageText !== undefined) {
          fields.push(`passage_text = $${idx++}`);
          vals.push(passageText ? sanitize(passageText) : null);
        }
        if (passageImageUrl !== undefined) {
          fields.push(`passage_image_url = $${idx++}`);
          vals.push(passageImageUrl ? sanitize(passageImageUrl) : null);
        }
        if (qType !== undefined) {
          fields.push(`question_type = $${idx++}`);
          vals.push(qType);
          fields.push(`question_group_type = $${idx++}`);
          vals.push(qType);
        }
        if (difficulty !== undefined) {
          fields.push(`difficulty = $${idx++}`);
          vals.push(difficulty || null);
        }
        if (linkedOpts !== undefined) {
          fields.push(`linked_options = $${idx++}`);
          vals.push(linkedOpts ? JSON.stringify(linkedOpts) : null);
        }
        if (subQuestionNumber !== undefined) {
          fields.push(`sub_question_number = $${idx++}`);
          vals.push(subQuestionNumber || null);
        }

        if (fields.length > 0) {
          vals.push(questionId);
          await client.query(
            `UPDATE questions SET ${fields.join(', ')} WHERE id = $${idx}`,
            vals,
          );
        }

        // Update answers — chỉ cho single_choice / reading_item
        if (answers && answers.length >= 2 && answers.length <= 8) {
          if (qType === 'fill_blank_pool' || qType === 'fill_blank_item') {
            // Điền từ: không dùng bảng answers
          } else {
            const normalizedAnswers = answers.map(a => normalizeBilingualText(a.text, a.textCn));
            if (normalizedAnswers.some(a => !a)) {
              await client.query("ROLLBACK");
              return res.status(400).json({ message: "Mỗi đáp án phải có nội dung" });
            }
            await client.query("DELETE FROM answers WHERE question_id = $1", [questionId]);
            const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            for (let i = 0; i < answers.length; i++) {
              const key = answerKeys[i];
              await client.query(
                `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  questionId,
                  key,
                  sanitize(normalizedAnswers[i].en),
                  sanitize(normalizedAnswers[i].cn),
                  key === correctAnswer,
                  answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
                ],
              );
            }
          }
        }

        await client.query("COMMIT");
        UserActivity.log(req.user.id, 'admin.update_question', { questionId, ip: req.ip, userAgent: req.headers['user-agent'] });
        res.json({ message: "Question updated" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Update question error:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  },

  // Delete question
  async deleteQuestion(req, res) {
    try {
      const { questionId } = req.params;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const examResult = await client.query(
          "SELECT exam_id, question_number, question_type, deleted_at FROM questions WHERE id = $1",
          [questionId],
        );

        if (examResult.rows.length === 0 || examResult.rows[0].deleted_at) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Question not found" });
        }

        const examId = examResult.rows[0].exam_id;

        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        const deletedQuestionNumber = examResult.rows[0].question_number;
        const isAnswerableQuestion = deletedQuestionNumber > 0
          && ![QUESTION_TYPES.FILL_BLANK_POOL, QUESTION_TYPES.READING_PASSAGE].includes(examResult.rows[0].question_type);

        const answerHistoryResult = await client.query(
          `SELECT EXISTS (
             SELECT 1
             FROM user_answers ua
             WHERE ua.question_id = $1
                OR ua.selected_answer_id IN (SELECT id FROM answers WHERE question_id = $1)
           ) AS has_history`,
          [questionId],
        );
        const hasAnswerHistory = answerHistoryResult.rows[0]?.has_history === true;

        if (hasAnswerHistory) {
          await client.query(
            `UPDATE questions
             SET deleted_at = NOW(),
                 deleted_by = $2,
                 delete_reason = 'Deleted from admin question editor; preserved because user_answers exists',
                 deleted_question_number = question_number,
                 question_number = CASE
                   WHEN question_number > 0 THEN -100000000 - id
                   ELSE question_number
                 END
             WHERE id = $1`,
            [questionId, req.user.id],
          );
        } else {
          await client.query("DELETE FROM questions WHERE id = $1", [questionId]);
        }
        if (isAnswerableQuestion) {
          await shiftQuestionNumbers(client, examId, deletedQuestionNumber + 1, -1);
        }
        await client.query(
          "UPDATE exams SET total_questions = GREATEST(0, total_questions - $1), updated_at = NOW() WHERE id = $2",
          [isAnswerableQuestion ? 1 : 0, examId],
        );

        await client.query("COMMIT");
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, 'admin.delete_question', {
          examId,
          questionId,
          mode: hasAnswerHistory ? 'soft_delete' : 'hard_delete',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({ message: "Question deleted" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Delete question error:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  },

    // ── Question insertion at specific position ────────────────────────────────
    // POST /api/admin/exams/:examId/questions/insert
    // Body: { questionData: {...}, afterQuestionId?: number, atPosition?: number }
    // afterQuestionId: insert AFTER this question ID (shifts all after by +1)
    // atPosition: insert at this question_number (shifts all >= atPosition by +1)
    async insertQuestion(req, res) {
        const MAX_RETRIES = 5;

        const { examId } = req.params;
        const { questionData, afterQuestionId, atPosition } = req.body || {};

        if (!questionData) {
            return res.status(400).json({ message: "questionData là bắt buộc" });
        }

        const {
            questionType, questionText, questionTextCn, imageUrl,
            points, explanation, explanationCn, answers, correctAnswer,
            passageText, passageImageUrl, difficulty, linkedOptions,
            correctAnswerKey, subQuestionNumber,
        } = questionData;

        const qType = questionType || 'single_choice';
        let responseSent = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                // ── Serialize concurrent inserts to the same exam ──
                await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

                if (!(await ensureExamExists(client, examId))) {
                    await client.query("ROLLBACK");
                    return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
                }

                // ── Determine target position ──
                let targetPosition;
                if (atPosition !== undefined && atPosition > 0) {
                    targetPosition = atPosition;
                } else if (afterQuestionId) {
                    const afterRes = await client.query(
                        "SELECT question_number FROM questions WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL",
                        [afterQuestionId, examId],
                    );
                    if (afterRes.rows.length === 0) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Không tìm thấy câu hỏi để chèn sau" });
                    }
                    targetPosition = afterRes.rows[0].question_number + 1;
                } else {
                    // Default: append at end
                    targetPosition = await getAppendQuestionPosition(client, examId);
                }

                // ── Shift all questions at or after targetPosition by +1 ──
                await client.query(
                    `UPDATE questions AS q
                     SET question_number = q.question_number + 1
                     FROM (
                         SELECT id FROM questions
                         WHERE exam_id = $1 AND question_number >= $2 AND deleted_at IS NULL
                         ORDER BY question_number DESC
                     ) AS sub
                     WHERE q.id = sub.id`,
                    [examId, targetPosition],
                );

                // ── Handle passage_group for sub-questions ──
                let passageGroupId = null;
                let subQn = subQuestionNumber || targetPosition;

                if (qType === 'reading_item' || qType === 'fill_blank_item') {
                    passageGroupId = await getLatestPassageGroupId(client, examId);
                    if (!passageGroupId) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Không tìm thấy nhóm câu cha" });
                    }
                }

                if (qType === 'reading_passage' || qType === 'fill_blank_pool') {
                    // Will self-assign after insert
                }

                // ── Normalize linked_options ──
                let linkedOpts = null;
                if (qType === 'fill_blank_pool') {
                    linkedOpts = normalizeLinkedOptions(linkedOptions || []);
                    if (!linkedOpts || linkedOpts.length < 2) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Điền từ cần ít nhất 2 lựa chọn" });
                    }
                }

                // ── Validation ──
                if (qType !== 'fill_blank_item' && qType !== 'fill_blank_pool' && qType !== 'reading_passage') {
                    const normQ = normalizeBilingualText(questionText, questionTextCn);
                    if (!normQ) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Câu hỏi phải có nội dung" });
                    }
                }

                if (qType === 'fill_blank_pool') {
                    if (!passageText || !passageText.trim()) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Điền từ cần có đoạn văn với chỗ trống (passageText)" });
                    }
                }

                if (qType === 'reading_passage') {
                    if (!passageText || !passageText.trim()) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Đọc hiểu cần có đoạn văn (passageText)" });
                    }
                }

                if ((qType === 'single_choice' || qType === 'reading_item') && qType !== 'fill_blank_item') {
                    const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
                    if (normAnswers.some(a => !a) || normAnswers.length < 2) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Cần ít nhất 2 đáp án" });
                    }
                    if (!correctAnswer) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Cần chọn đáp án đúng (correctAnswer)" });
                    }
                }

                // ── Insert the new question ──
                const normQ = normalizeBilingualText(questionText, questionTextCn);
                const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

                const questionResult = await client.query(
                    `INSERT INTO questions (
                        exam_id, question_number, question_type,
                        question_text, question_text_cn,
                        points, explanation, explanation_cn,
                        image_url, passage_text, passage_image_url,
                        question_group_type, difficulty,
                        linked_options, sub_question_number, passage_group_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING id`,
                    [
                        examId, targetPosition, qType,
                        sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
                        parsedPoints,
                        explanation ? sanitizeExplanation(explanation) : null,
                        explanationCn ? sanitizeExplanation(explanationCn) : null,
                        imageUrl ? sanitize(imageUrl) : null,
                        passageText ? sanitize(passageText) : null,
                        passageImageUrl ? sanitize(passageImageUrl) : null,
                        qType, difficulty || null,
                        linkedOpts ? JSON.stringify(linkedOpts) : null,
                        subQn, passageGroupId,
                    ],
                );

                const questionId = questionResult.rows[0].id;

                // Self-assign passage_group_id for passage-starting questions
                if (qType === 'reading_passage' || qType === 'fill_blank_pool') {
                    await client.query(
                        "UPDATE questions SET passage_group_id = id WHERE id = $1",
                        [questionId],
                    );
                }

                // ── Insert answers ──
                if (qType === 'single_choice' || qType === 'reading_item') {
                    const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
                    const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                    for (let i = 0; i < normAnswers.length; i++) {
                        const key = answerKeys[i];
                        await client.query(
                            `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [
                                questionId, key,
                                sanitize(normAnswers[i].en), sanitize(normAnswers[i].cn),
                                key === correctAnswer,
                                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
                            ],
                        );
                    }
                }

                // ── Update exam total_questions ──
                await client.query(
                    "UPDATE exams SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1",
                    [examId],
                );

                await client.query("COMMIT");

                cache.delByPrefix("exams:");
                cache.del("exams:lobby");

                UserActivity.log(req.user.id, 'admin.insert_question', {
                    examId, questionId, targetPosition, questionType: qType,
                    ip: req.ip, userAgent: req.headers['user-agent']
                });

                res.status(201).json({
                    message: "Câu hỏi đã được chèn",
                    questionId,
                    questionNumber: targetPosition,
                    questionType: qType,
                });
                return;
            } catch (error) {
                await client.query("ROLLBACK");
                // Chỉ retry khi gặp duplicate key (23505), không retry các lỗi khác
                const isDuplicateKey =
                    error.code === '23505' &&
                    error.constraint === 'questions_exam_id_question_number_key';

                if (isDuplicateKey) {
                    console.warn(`[insertQuestion] Duplicate key on attempt ${attempt + 1}, retrying...`);
                    continue; // thử lại với vị trí mới
                }

                if (isMissingQuestionExamForeignKey(error)) {
                    if (responseSent) return;
                    responseSent = true;
                    return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
                }

                console.error("Insert question error:", error);
                if (responseSent) return;
                responseSent = true;
                return res.status(500).json({ message: "Failed to insert question" });
            } finally {
                client.release();
            }
        } // end for

        // Nếu hết retries mà vẫn lỗi
        if (responseSent) return;
        return res.status(500).json({ message: "Failed to insert question after retries" });
    },

    // ── P2: Question reordering ─────────────────────────────────────────────────
    // PUT /api/admin/exams/:examId/questions/reorder
    // Body: { orderedIds: [id1, id2, id3, ...] }
    async reorderQuestions(req, res) {
        try {
            const { examId } = req.params;
            const { orderedIds } = req.body;

            if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
                return res.status(400).json({ message: "orderedIds phải là mảng không rỗng" });
            }

            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                // ── Serialize concurrent operations on the same exam ──
                await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

                // Verify all questions belong to this exam
                const verifyResult = await client.query(
                    `SELECT id FROM questions WHERE exam_id = $1 AND deleted_at IS NULL AND id = ANY($2::int[])`,
                    [examId, orderedIds],
                );
                if (verifyResult.rows.length !== orderedIds.length) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ message: "Một số câu hỏi không thuộc đề thi này" });
                }

                // Update question_number for each question
                for (let i = 0; i < orderedIds.length; i++) {
                    await client.query(
                        "UPDATE questions SET question_number = $1 WHERE id = $2 AND deleted_at IS NULL",
                        [i + 1, orderedIds[i]],
                    );
                }

                await client.query("COMMIT");

                UserActivity.log(req.user.id, 'admin.reorder_questions', {
                    examId, orderedIds,
                    ip: req.ip, userAgent: req.headers['user-agent']
                });

                res.json({ message: "Sắp xếp lại thứ tự câu hỏi thành công" });
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Reorder questions error:", error);
            res.status(500).json({ message: "Failed to reorder questions" });
        }
    },

  // Get all exams (for admin dashboard)
  async getAllExams(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const type = req.query.type; // 'phong-thi' | 'tu-do' | 'mo-phong' | 'delete-requests' | 'trash' | undefined (all)

      const conditions = ['e.deleted_at IS NULL'];
      if (type === 'phong-thi') {
        conditions.push('e.start_time IS NOT NULL');
      } else if (type === 'tu-do') {
        conditions.push('e.start_time IS NULL AND e.is_simulated = false');
      } else if (type === 'mo-phong') {
        conditions.push('e.start_time IS NULL AND e.is_simulated = true');
      } else if (type === 'delete-requests') {
        if (!isSuperAdmin(req)) {
          return res.status(403).json({ message: "Chỉ admin tổng được xem danh sách yêu cầu xóa đề." });
        }
        conditions.push("e.deletion_status = 'requested'");
      } else if (type === 'trash') {
        if (!isSuperAdmin(req)) {
          return res.status(403).json({ message: "Chỉ admin tổng được xem thùng rác mềm." });
        }
        conditions[0] = 'e.deleted_at IS NOT NULL';
      }
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM exams e ${whereClause}`,
      );
      const totalExams = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalExams / limit);

      // Get exams with subject info
      const examsResult = await pool.query(
        `SELECT
                    e.id,
                    e.code,
                    e.title,
                    e.duration,
                    e.total_points,
                    e.total_questions,
          e.total_questions as questions_count,
                    e.status,
                    e.is_premium,
                    e.vip_tier,
                    e.is_simulated,
                    e.start_time,
                    e.end_time,
                    e.deleted_at,
                    e.deleted_by,
                    e.delete_reason,
                    e.delete_requested_at,
                    e.delete_requested_by,
                    e.delete_request_reason,
                    e.deletion_status,
                    requester.full_name as delete_requested_by_name,
                    deleter.full_name as deleted_by_name,
                    e.created_at,
                    s.name as subject_name,
                    s.code as subject_code,
                    COUNT(DISTINCT ea.id) as attempts_count
                FROM exams e
                LEFT JOIN subjects s ON e.subject_id = s.id
                LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
                LEFT JOIN users requester ON requester.id = e.delete_requested_by
                LEFT JOIN users deleter ON deleter.id = e.deleted_by
                ${whereClause}
                GROUP BY e.id, s.name, s.code, requester.full_name, deleter.full_name
                ORDER BY e.created_at DESC
                LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        exams: examsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalExams,
          limit,
        },
      });
    } catch (error) {
      console.error("Get all exams error:", error);
      res.status(500).json({ message: "Failed to get exams" });
    }
  },

  // GET /api/admin/exams/stats - Tổng hợp thống kê tất cả đề thi
  async getStats(req, res) {
    try {
      // Stats tổng quan
      const overviewQuery = `
        SELECT
          COUNT(DISTINCT e.id)::INTEGER as total_exams,
          COUNT(DISTINCT CASE WHEN e.status = 'published' THEN e.id END)::INTEGER as published_exams,
          COUNT(DISTINCT CASE WHEN e.start_time IS NOT NULL THEN e.id END)::INTEGER as phong_thi_count,
          COUNT(DISTINCT CASE WHEN e.start_time IS NULL THEN e.id END)::INTEGER as tu_do_count,
          COUNT(DISTINCT ea.id)::INTEGER as total_attempts,
          COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END)::INTEGER as completed_attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT ea.id), 0) * 100, 1
            ), 0
          )::DECIMAL as completion_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_score_percentage,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
          )::DECIMAL as avg_score_points
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        WHERE e.deleted_at IS NULL
      `;
      const overviewResult = await pool.query(overviewQuery);
      const overview = overviewResult.rows[0];

      // Top 5 đề thi có nhiều lượt thi nhất
      const topExamsQuery = `
        SELECT
          e.id,
          e.title,
          s.name as subject_name,
          e.difficulty_level,
          COUNT(DISTINCT ea.id)::INTEGER as attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_percentage,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
          )::DECIMAL as avg_score_points
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        LEFT JOIN subjects s ON e.subject_id = s.id
        WHERE e.deleted_at IS NULL
        GROUP BY e.id, e.title, s.name, e.difficulty_level
        HAVING COUNT(DISTINCT ea.id) > 0
        ORDER BY attempts DESC
        LIMIT 5
      `;
      const topExamsResult = await pool.query(topExamsQuery);

      // Stats theo môn
      const subjectStatsQuery = `
        SELECT
          s.id as subject_id,
          s.name as subject_name,
          s.code as subject_code,
          COUNT(DISTINCT e.id)::INTEGER as exam_count,
          COUNT(DISTINCT ea.id)::INTEGER as total_attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_percentage
        FROM subjects s
        LEFT JOIN exams e ON e.subject_id = s.id AND e.status = 'published' AND e.deleted_at IS NULL
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        GROUP BY s.id, s.name, s.code
        HAVING COUNT(DISTINCT ea.id) > 0
        ORDER BY total_attempts DESC
      `;
      const subjectStatsResult = await pool.query(subjectStatsQuery);

      res.json({
        success: true,
        data: {
          overview: {
            totalExams: parseInt(overview.total_exams) || 0,
            publishedExams: parseInt(overview.published_exams) || 0,
            phongThiCount: parseInt(overview.phong_thi_count) || 0,
            tuDoCount: parseInt(overview.tu_do_count) || 0,
            totalAttempts: parseInt(overview.total_attempts) || 0,
            completedAttempts: parseInt(overview.completed_attempts) || 0,
            completionRate: parseFloat(overview.completion_rate) || 0,
            avgScorePercentage: parseFloat(overview.avg_score_percentage) || 0,
            avgScorePoints: parseFloat(overview.avg_score_points) || 0,
          },
          topExams: topExamsResult.rows.map((r) => ({
            id: r.id,
            title: r.title,
            subjectName: r.subject_name,
            difficultyLevel: r.difficulty_level,
            attempts: parseInt(r.attempts) || 0,
            passRate: parseFloat(r.pass_rate) || 0,
            avgPercentage: parseFloat(r.avg_percentage) || 0,
            avgScorePoints: parseFloat(r.avg_score_points) || 0,
          })),
          subjectStats: subjectStatsResult.rows.map((r) => ({
            subjectId: r.subject_id,
            subjectName: r.subject_name,
            subjectCode: r.subject_code,
            examCount: parseInt(r.exam_count) || 0,
            totalAttempts: parseInt(r.total_attempts) || 0,
            passRate: parseFloat(r.pass_rate) || 0,
            avgPercentage: parseFloat(r.avg_percentage) || 0,
          })),
        },
      });
    } catch (error) {
      console.error("Get exam stats error:", error);
      res.status(500).json({ message: "Failed to get exam stats" });
    }
  },

  // GET /api/admin/exams/counts - Get exam counts by type
  async getCounts(req, res) {
    try {
      const [total, phongThi, tuDo, moPhong, deleteRequests, trash] = await Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND start_time IS NOT NULL'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND start_time IS NULL AND is_simulated = false'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND start_time IS NULL AND is_simulated = true'),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND deletion_status = 'requested'"),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NOT NULL'),
      ]);
      res.json({
        all: parseInt(total.rows[0].count),
        phongThi: parseInt(phongThi.rows[0].count),
        tuDo: parseInt(tuDo.rows[0].count),
        moPhong: parseInt(moPhong.rows[0].count),
        deleteRequests: parseInt(deleteRequests.rows[0].count),
        trash: parseInt(trash.rows[0].count),
      });
    } catch (error) {
      console.error("Get exam counts error:", error);
      res.status(500).json({ message: "Failed to get counts" });
    }
  },

  // Get exam with questions
  async getExamWithQuestions(req, res) {
    try {
      const { examId } = req.params;

      const examResult = await pool.query("SELECT * FROM exams WHERE id = $1 AND deleted_at IS NULL", [examId]);
      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Lấy câu hỏi + đáp án + linked_options (từ cha cho fill_blank_item)
      const questionsResult = await pool.query(
        `SELECT
           q.id,
           q.exam_id,
           q.question_number,
           q.question_type,
           q.question_text,
           q.question_text_cn,
           q.image_url,
           q.points,
           q.explanation,
           q.explanation_cn,
           q.passage_text,
           q.passage_image_url,
           q.question_group_type,
           q.cloze_mode,
           q.difficulty,
           q.linked_options,
           q.sub_question_number,
           q.passage_group_id,
           -- Lấy linked_options từ câu cha (fill_blank_item → fill_blank_pool)
           COALESCE(
             q.linked_options,
             (SELECT linked_options FROM questions parent
              WHERE parent.id = q.passage_group_id
                AND parent.question_type = 'fill_blank_pool')
           ) as effective_linked_options,
           -- Lấy passage_text từ câu cha (cho reading_item / fill_blank_item)
           COALESCE(
             q.passage_text,
             (SELECT passage_text FROM questions parent
              WHERE parent.id = q.passage_group_id
                AND parent.passage_text IS NOT NULL
              ORDER BY parent.id LIMIT 1)
           ) as effective_passage_text,
           COALESCE(
             q.cloze_mode,
             (SELECT cloze_mode FROM questions parent
              WHERE parent.id = q.passage_group_id
                AND parent.question_type = 'fill_blank_pool')
           ) as effective_cloze_mode,
           json_agg(
             json_build_object(
               'id', a.id,
               'answer_key', a.answer_key,
               'answer_text', a.answer_text,
               'answer_text_cn', a.answer_text_cn,
               'image_url', a.image_url,
               'is_correct', a.is_correct
             ) ORDER BY a.answer_key
           ) FILTER (WHERE a.id IS NOT NULL) as answers
         FROM questions q
         LEFT JOIN answers a ON q.id = a.question_id
         WHERE q.exam_id = $1
           AND q.deleted_at IS NULL
         GROUP BY q.id
         ORDER BY q.question_number, q.id`,
        [examId],
      );

      // Parse linked_options từ JSONB string
      const questions = questionsResult.rows.map(q => ({
        ...q,
        linked_options: q.linked_options
          ? (typeof q.linked_options === 'string' ? JSON.parse(q.linked_options) : q.linked_options)
          : null,
        effective_linked_options: q.effective_linked_options
          ? (typeof q.effective_linked_options === 'string' ? JSON.parse(q.effective_linked_options) : q.effective_linked_options)
          : null,
      }));

      res.json({
        exam: examResult.rows[0],
        questions,
      });
    } catch (error) {
      console.error("Get exam error:", error);
      res.status(500).json({ message: "Failed to get exam" });
    }
  },
  // ── Ngày 11-12: Quản lý lịch thi (Live / Upcoming schedule) ──────────────
  // GET /api/admin/exams/:examId/schedule - Get current schedule
  async getSchedule(req, res) {
    try {
      const { examId } = req.params;
      const result = await pool.query(
        `SELECT id, title, status, start_time, end_time, max_participants,
                (SELECT json_agg(l ORDER BY l.changed_at DESC) FROM (
                  SELECT changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason, changed_at
                  FROM exam_schedule_logs WHERE exam_id = $1 ORDER BY changed_at DESC LIMIT 10
                ) l) as change_log
         FROM exams WHERE id = $1`,
        [examId]
      );
      if (!result.rows[0]) return res.status(404).json({ message: 'Exam not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ message: 'Failed to get schedule' });
    }
  },

  // PUT /api/admin/exams/:examId/schedule - Set or update schedule
  async setSchedule(req, res) {
    try {
      const { examId } = req.params;
      // P0 fix: accept BOTH startTime (old) and start_time (frontend camelCase standard)
      const { startTime, endTime, start_time, end_time, maxParticipants, reason } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.full_name || req.user.username || `User#${adminId}`;

      const sTime = startTime || start_time;
      const eTime = endTime || end_time;
      if (!sTime || !eTime) {
        return res.status(400).json({ message: 'start_time và end_time là bắt buộc' });
      }
      const start = new Date(sTime);
      const end = new Date(eTime);
      if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ message: 'Thời gian không hợp lệ: end_time phải sau start_time' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lấy lịch cũ để ghi log diff
        const oldRes = await client.query('SELECT start_time, end_time FROM exams WHERE id = $1', [examId]);
        if (!oldRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found' }); }
        const old = oldRes.rows[0];

        await client.query(
          `UPDATE exams SET start_time = $1, end_time = $2, max_participants = COALESCE($3, max_participants), updated_at = NOW() WHERE id = $4`,
          [start, end, maxParticipants || null, examId]
        );

        // Ghi audit log
        await client.query(
          `INSERT INTO exam_schedule_logs (exam_id, changed_by, changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [examId, adminId, adminName, old.start_time, old.end_time, start, end, reason || null]
        );

        await client.query(
          `INSERT INTO audit_logs (
             actor_id,
             action,
             target_type,
             target_id,
             old_value,
             new_value,
             ip_address,
             user_agent,
             metadata
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb)`,
          [
            adminId,
            "exam_schedule_set",
            "exam",
            Number.parseInt(examId, 10),
            JSON.stringify({
              start_time: old.start_time,
              end_time: old.end_time,
            }),
            JSON.stringify({
              start_time: start,
              end_time: end,
              max_participants: maxParticipants || null,
            }),
            req.ip || null,
            req.headers["user-agent"] || null,
            JSON.stringify({ reason: reason || null }),
          ]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Cập nhật lịch thi thành công' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Set schedule error:', error);
      res.status(500).json({ message: 'Failed to set schedule' });
    }
  },

  // DELETE /api/admin/exams/:examId/schedule - Clear schedule (makes exam a free practice test)
  async clearSchedule(req, res) {
    try {
      const { examId } = req.params;
      const adminId = req.user.id;
      const adminName = req.user.full_name || req.user.username || `User#${adminId}`;
      const { reason } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const oldRes = await client.query('SELECT start_time, end_time FROM exams WHERE id = $1', [examId]);
        if (!oldRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found' }); }
        const old = oldRes.rows[0];

        await client.query(
          'UPDATE exams SET start_time = NULL, end_time = NULL, max_participants = 0, updated_at = NOW() WHERE id = $1',
          [examId]
        );
        await client.query(
          `INSERT INTO exam_schedule_logs (exam_id, changed_by, changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason)
           VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)`,
          [examId, adminId, adminName, old.start_time, old.end_time, reason || 'Xóa lịch thi']
        );

        await client.query(
          `INSERT INTO audit_logs (
             actor_id,
             action,
             target_type,
             target_id,
             old_value,
             new_value,
             ip_address,
             user_agent,
             metadata
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb)`,
          [
            adminId,
            "exam_schedule_clear",
            "exam",
            Number.parseInt(examId, 10),
            JSON.stringify({
              start_time: old.start_time,
              end_time: old.end_time,
            }),
            JSON.stringify({
              start_time: null,
              end_time: null,
              max_participants: 0,
            }),
            req.ip || null,
            req.headers["user-agent"] || null,
            JSON.stringify({ reason: reason || "Xóa lịch thi" }),
          ]
        );
        await client.query('COMMIT');
        res.json({ success: true, message: 'Đã xóa lịch thi, đổi thành đề thi tự do' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Clear schedule error:', error);
      res.status(500).json({ message: 'Failed to clear schedule' });
    }
  },

  // ── READING PASSAGE GROUP (passage + sub-questions) ──────────────────────────
  // POST /api/admin/exams/:examId/reading-passage-group
  async insertReadingPassageGroup(req, res) {
    try {
      const { examId } = req.params;
      const {
        passageText,
        passageImageUrl,
        subQuestions,
        insertPosition,
      } = req.body;

      if (!passageText || !passageText.trim()) {
        return res.status(400).json({ message: 'Đọc hiểu cần có đoạn văn (passageText)' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        const validSubQs = Array.isArray(subQuestions) ? subQuestions.filter(
          q => q.correctAnswer && Array.isArray(q.answers) && q.answers.length >= 2
        ) : [];
        if (validSubQs.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Đọc hiểu cần ít nhất 1 câu con hợp lệ' });
        }

        const startNumber = Number.isFinite(Number(insertPosition)) && Number(insertPosition) > 0
          ? Number(insertPosition)
          : await getAppendQuestionPosition(client, examId);
        await shiftQuestionNumbers(client, examId, startNumber, validSubQs.length);
        let questionNumber = startNumber - 1;
        const containerNumber = await getNextContainerQuestionNumber(client, examId);

        // Insert READING_PASSAGE question
        const passageResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, passage_text, passage_image_url,
             question_group_type, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            examId, containerNumber, QUESTION_TYPES.READING_PASSAGE,
            'Đoạn văn đọc hiểu', '阅读理解',
            0, sanitize(passageText),
            passageImageUrl ? sanitize(passageImageUrl) : null,
            QUESTION_TYPES.READING_PASSAGE, null, null,
          ]
        );
        const passageId = passageResult.rows[0].id;
        await client.query(
          'UPDATE questions SET passage_group_id = id WHERE id = $1',
          [passageId]
        );

        // Insert sub-questions
        const insertedSubs = [];

        for (const q of validSubQs) {
          questionNumber++;
          const parsedPoints = clamp(parsePositiveNumber(q.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
          const normQ = normalizeBilingualText(q.questionText, q.questionTextCn);

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
              examId, questionNumber, QUESTION_TYPES.READING_ITEM,
              sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
              parsedPoints,
              q.explanation ? sanitizeExplanation(q.explanation) : null,
              q.explanationCn ? sanitizeExplanation(q.explanationCn) : null,
              QUESTION_TYPES.READING_ITEM,
              q.difficulty || 'medium',
              q.subQuestionNumber || questionNumber,
              passageId,
            ]
          );
          const subId = subResult.rows[0].id;

          // Insert answers
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < q.answers.length; i++) {
            const normA = normalizeBilingualText(q.answers[i].text, q.answers[i].textCn);
            if (!normA) continue;
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                subId, answerKeys[i],
                sanitize(normA.en), sanitize(normA.cn),
                answerKeys[i] === q.correctAnswer,
                q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
              ]
            );
          }

          insertedSubs.push({ id: subId, questionNumber, correctAnswer: q.correctAnswer });
        }

        await client.query(
          'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
          [insertedSubs.length, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.insert_reading_passage_group', {
          examId, passageId, subQuestions: insertedSubs.length,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.status(201).json({
          message: 'Đoạn đọc hiểu đã được tạo',
          groupId: passageId,
          questionNumber: startNumber,
          subQuestions: insertedSubs,
          totalItems: insertedSubs.length,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Insert reading passage group error:', error);
      res.status(500).json({ message: 'Failed to create reading passage group' });
    }
  },

  // PUT /api/admin/exams/:examId/reading-passage-group/:groupId
  async updateReadingPassageGroup(req, res) {
    try {
      const { examId, groupId } = req.params;
      const {
        passageText,
        passageImageUrl,
        subQuestions,
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        // Update passage
        const updates = [];
        const vals = [];
        let idx = 1;

        if (passageText !== undefined) {
          updates.push(`passage_text = $${idx++}`);
          vals.push(passageText ? sanitize(passageText) : null);
        }
        if (passageImageUrl !== undefined) {
          updates.push(`passage_image_url = $${idx++}`);
          vals.push(passageImageUrl ? sanitize(passageImageUrl) : null);
        }

        if (updates.length > 0) {
          vals.push(groupId);
          vals.push(examId);
          const updateResult = await client.query(
            `UPDATE questions SET ${updates.join(', ')} WHERE id = $${idx} AND exam_id = $${idx + 1} AND question_type = $${idx + 2}`,
            [...vals, QUESTION_TYPES.READING_PASSAGE]
          );
          if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Reading passage group not found' });
          }
        } else {
          const existsResult = await client.query(
            `SELECT id FROM questions WHERE id = $1 AND exam_id = $2 AND question_type = $3`,
            [groupId, examId, QUESTION_TYPES.READING_PASSAGE],
          );
          if (existsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Reading passage group not found' });
          }
        }

        // Update sub-questions
        if (Array.isArray(subQuestions)) {
          const validSubQs = subQuestions.filter(
            q => q.correctAnswer && Array.isArray(q.answers) && q.answers.length >= 2
          );
          if (validSubQs.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Doc hieu can it nhat 1 cau con hop le' });
          }

          const oldCountRes = await client.query(
            `SELECT COUNT(*)::int as count,
                    COALESCE(MIN(question_number), 0)::int as start_num,
                    COALESCE(MAX(question_number), 0)::int as end_num
             FROM questions
             WHERE passage_group_id = $1 AND question_type = $2 AND question_number > 0`,
            [groupId, QUESTION_TYPES.READING_ITEM]
          );
          const oldSubCount = oldCountRes.rows[0].count || 0;
          const oldStart = oldCountRes.rows[0].start_num || await getAppendQuestionPosition(client, examId);
          const oldEnd = oldCountRes.rows[0].end_num || (oldStart - 1);

          await client.query(
            'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1 AND question_type = $2)',
            [groupId, QUESTION_TYPES.READING_ITEM]
          );
          await client.query(
            'DELETE FROM questions WHERE passage_group_id = $1 AND question_type = $2',
            [groupId, QUESTION_TYPES.READING_ITEM]
          );

          const delta = validSubQs.length - oldSubCount;
          await shiftQuestionNumbers(client, examId, oldEnd + 1, delta);

          let questionNumber = oldStart - 1;
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const insertedSubs = [];

          for (const q of validSubQs) {
            questionNumber++;
            const parsedPoints = clamp(parsePositiveNumber(q.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
            const normQ = normalizeBilingualText(q.questionText, q.questionTextCn);

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
                examId, questionNumber, QUESTION_TYPES.READING_ITEM,
                sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
                parsedPoints,
                q.explanation ? sanitizeExplanation(q.explanation) : null,
                q.explanationCn ? sanitizeExplanation(q.explanationCn) : null,
                QUESTION_TYPES.READING_ITEM,
                q.difficulty || 'medium',
                q.subQuestionNumber || questionNumber,
                groupId,
              ]
            );
            const subId = subResult.rows[0].id;

            for (let i = 0; i < q.answers.length; i++) {
              const normA = normalizeBilingualText(q.answers[i].text, q.answers[i].textCn);
              if (!normA) continue;
              await client.query(
                `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  subId, answerKeys[i],
                  sanitize(normA.en), sanitize(normA.cn),
                  answerKeys[i] === q.correctAnswer,
                  q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
                ]
              );
            }
            insertedSubs.push({ id: subId, questionNumber });
          }

          await client.query(
            'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
            [delta, examId]
          );
        }

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.update_reading_passage_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Đoạn đọc hiểu đã được cập nhật' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update reading passage group error:', error);
      res.status(500).json({ message: 'Failed to update reading passage group' });
    }
  },

  // DELETE /api/admin/exams/:examId/reading-passage-group/:groupId
  async deleteReadingPassageGroup(req, res) {
    try {
      const { examId, groupId } = req.params;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        const countRes = await client.query(
          `SELECT COUNT(*)::int as count,
                  COALESCE(MAX(question_number), 0)::int as end_num
           FROM questions
           WHERE passage_group_id = $1 AND question_type = $2 AND question_number > 0`,
          [groupId, QUESTION_TYPES.READING_ITEM]
        );
        const totalCount = countRes.rows[0].count || 0;
        const oldEnd = countRes.rows[0].end_num || 0;

        await client.query(
          'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1)',
          [groupId]
        );
        await client.query('DELETE FROM questions WHERE passage_group_id = $1', [groupId]);
        await client.query('DELETE FROM questions WHERE id = $1', [groupId]);
        if (totalCount > 0) {
          await shiftQuestionNumbers(client, examId, oldEnd + 1, -totalCount);
        }

        await client.query(
          'UPDATE exams SET total_questions = GREATEST(0, total_questions - $1), updated_at = NOW() WHERE id = $2',
          [totalCount, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.delete_reading_passage_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Đoạn đọc hiểu đã được xóa' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Delete reading passage group error:', error);
      res.status(500).json({ message: 'Failed to delete reading passage group' });
    }
  },
};

module.exports = AdminExamController;
