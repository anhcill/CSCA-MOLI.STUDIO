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
const { repairOcrMathArtifacts } = require("./ocrMathRepairService");

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
  const status = error?.providerStatus ?? error?.response?.status;
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
const PDF_IMPORT_RULE_PARSER_AI_SKIP_MIN = Number.parseInt(process.env.PDF_IMPORT_RULE_PARSER_AI_SKIP_MIN || "20", 10);
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

  return repairOcrMathArtifacts(text)
    .replace(/\$\$+/g, "")
    .replace(/([A-Za-z\u00C0-\u1EF9])\s+n\s+([\u00C0-\u1EF9])/g, "$1 n$2")
    .replace(/([A-Za-z\u00C0-\u1EF9])_\{n\}([A-Za-z\u00C0-\u1EF9])/g, "$1 n$2")
    .replace(/([A-Za-z\u00C0-\u1EF9])_n([A-Za-z\u00C0-\u1EF9])/g, "$1 n$2")
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, "[$1)")
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, "($1)")
    .replace(/\bC\s*(?:\u211d|R)\s*\(/g, "C_{\\mathbb{R}}(")
    .replace(/\bC\s*(?:\u211d|R)\b/g, "C_{\\mathbb{R}}")
    .replace(/\\cup|\u222a/g, "\\cup")
    .replace(/\\cap|\u2229/g, "\\cap")
    .replace(/\\setminus|\u2216/g, "\\setminus")
    .replace(/\b([A-Za-z])\s*[\u20d7]+/g, "\\vec{$1}")
    .replace(/(\d)\s*o\b/g, "$1°")
    .replace(/\s+([,.;:ï¼Œă€‚ï¼›ï¼ï¼‰\)Â°])/g, "$1")
    .replace(/([ï¼ˆ\(])\s+/g, "$1")
    .trim();
}

function tidyImportedExplanationBreaks(value) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function applyImportedExplanationBreakRules(value) {
  return value
    .replace(/\s*((?:前\s*n\s*[项項]和公式|通[项項]公式|代入(?:数据|數據)?解不等式|验证|驗證|检验|檢驗|结论|結論)\s*[:：])/g, "\n$1")
    .replace(/\s*((?:Công thức|Thay|Kiểm tra|Kết luận|Chọn|Vậy)\s*[:：])/gi, "\n$1")
    .replace(/\s*((?:步骤|步驟|Bước)\s*\d+\s*[:：])/gi, "\n$1")
    .replace(/\s*(⇔|=>|⇒|\\Rightarrow)\s*/g, "\n$1 ")
    .replace(/([。.;；])\s*(?=(?:由|当|代入|验证|驗證|因此|所以|故|选|答案|解析|得|Suy ra|Vậy|n\s*=))/g, "$1\n")
    .replace(/([，,])\s*(?=(?:n|x|m|k)\s*=\s*-?\d+\s*(?:时|時))/g, "$1\n")
    .replace(/[，,]\s*(?=(?:值域|定义域|反函数|因此|所以|故|选|答案|得))/g, "，\n")
    .replace(/([:：])\s*(?=(?:[A-Za-z0-9\\(√]|\\log|\\frac|\\sqrt))/g, "$1\n")
    .replace(/\s*(选\s*[A-H][.。]?)/gi, "\n$1")
    .replace(/\n\s*\n(?=(?:⇔|=>|⇒|\\Rightarrow))/g, "\n");
}

function restoreImportedExplanationBreaks(value) {
  const text = repairPdfImportTextArtifacts(value)
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n");
  if (!text) return "";

  return tidyImportedExplanationBreaks(applyImportedExplanationBreakRules(text));
}

function withRuleBasedFallbackWarning(preview, reason) {
  if (!preview?.items?.length) return preview;

  const warnings = Array.isArray(preview.warnings) ? [...preview.warnings] : [];
  warnings.push(reason || "AI đọc đề chưa ổn, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.");
  return { ...preview, warnings };
}

function withRuleBasedOnlyWarning(preview) {
  if (!preview?.items?.length) return preview;

  const warnings = Array.isArray(preview.warnings) ? [...preview.warnings] : [];
  warnings.push("Parser nhanh đã đọc đủ nhiều câu nên hệ thống không gọi AI để tránh tốn tiền. Hãy kiểm tra lại đáp án và công thức trước khi lưu.");
  return { ...preview, warnings };
}

function getPdfImportFallbackReason(error) {
  if (error?.message === "RATE_LIMITED") {
    return "AI đang bị giới hạn tạm thời, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.";
  }
  if (error?.message === "AI_TIMEOUT") {
    return "AI xử lý quá thời gian, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.";
  }
  return "AI đọc đề chưa ổn, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.";
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
  const subQuestionNumber = Number.parseInt(rawQuestion?.subQuestionNumber, 10);

  return {
    questionType: QUESTION_TYPES.SINGLE_CHOICE,
    questionText: normalizedQuestion.en,
    questionTextCn: normalizedQuestion.cn,
    imageUrl: stringValue(rawQuestion?.imageUrl),
    explanationImageUrl: stringValue(rawQuestion?.explanationImageUrl || rawQuestion?.explanation_image_url),
    points: clamp(parsePositiveNumber(rawQuestion?.points, 1), 0.1, MAX_POINTS_PER_QUESTION),
    explanation: restoreImportedExplanationBreaks(rawQuestion?.explanation || viQuestion.explanation),
    explanationCn: restoreImportedExplanationBreaks(rawQuestion?.explanationCn || rawQuestion?.explanation_cn || cnQuestion.explanation),
    answers: answers.map((answer) => ({
      text: answer.text || answer.textCn,
      textCn: answer.textCn || answer.text,
      imageUrl: answer.imageUrl || "",
    })),
    correctAnswer,
    difficulty,
    needsImage,
    imageHint: imageHint || (needsImage ? "Câu này có thể cần hình ảnh/bảng/biểu đồ trong PDF. Hãy thêm ảnh thủ công trước khi xuất bản." : ""),
    reviewNotes,
    subQuestionNumber: Number.isFinite(subQuestionNumber) ? subQuestionNumber : index + 1,
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
    imageHint: stringValue(rawGroup?.imageHint) || (needsImage ? "Đoạn đọc hiểu có thể cần hình ảnh trong PDF. Hãy thêm ảnh thủ công trước khi xuất bản." : ""),
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
        explanationImageUrl: stringValue(item?.explanationImageUrl || item?.explanation_image_url),
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
    imageHint: stringValue(rawGroup?.imageHint) || (needsImage ? "Nhóm điền từ có thể cần hình ảnh trong PDF. Hãy thêm ảnh thủ công trước khi xuất bản." : ""),
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
    .filter((answer) => answer.score >= 4)
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
const RULE_IMPORT_MISSING_OPTION_TEXT = "Chưa trích được nội dung đáp án từ Word/PDF. Hãy sửa đáp án này trong bản xem trước.";
const CHINESE_SOCIAL_ANSWER_RE = /Answer\s*:\s*([A-H])/i;
const CHINESE_SOCIAL_EXPLANATION_RE = /Explanation(?:\s*(?:中文|Chinese))?\s*[:：]?\s*/i;
const CHINESE_SOCIAL_OPTION_LABEL_RE = /[（(]\s*([A-H])\s*[）)]/gi;
const CHINESE_SOCIAL_GROUP_POOL_RE = /(?:^|\n)\s*(?:第\s*)?(\d{1,3})\s*-\s*(\d{1,3})\s*(?:题)?\s*[:：]\s*([^\n]*(?:[（(]\s*[A-H]\s*[）)][^\n]*)+)/gi;
const CHINESE_SOCIAL_READING_GROUP_RE = /(?:^|\n)\s*第\s*(\d{1,3})\s*-\s*(\d{1,3})\s*题\s*[:：]?\s*/gi;
const CHINESE_SOCIAL_SECTION_READING_RE = /(?:^|\n)\s*(?:VI|Ⅵ)[.．]\s*阅读理解/i;
const CHINESE_SCIENCE_QUESTION_LINE_RE = /^(\d{1,3})[.．、]\s*(.*)$/;
const CHINESE_SCIENCE_OPTION_LINE_RE = /^([A-H])[.．、]\s*/i;
const CHINESE_SCIENCE_OPTION_RE = /(?:^|[ \t\n])([A-H])[ \t]*[.．、][ \t]*/gi;
const CHINESE_SCIENCE_EXPLANATION_LINE_RE = /^(?:解答|解析|答案解析|说明|答案)\s*[:：]?/i;
const CHINESE_SCIENCE_EXPLANATION_RE = /(?:^|\n)\s*(?:解答|解析|答案解析|说明|答案)\s*[:：]?\s*/i;
const CHINESE_SCIENCE_EXPLICIT_ANSWER_RE = /(?:答案|正确答案|故选|应选|选|得答案)\s*[:：为是]?\s*([A-H])/i;

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

function normalizeChineseSocialText(rawText) {
  return normalizeRuleBasedMathLayout(rawText)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeChineseScienceLines(rawText) {
  return normalizeRuleBasedMathLayout(rawText)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => stringValue(line).replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function getChineseScienceQuestionMarkers(lines) {
  const markers = [];
  lines.forEach((line, index) => {
    const match = line.match(CHINESE_SCIENCE_QUESTION_LINE_RE);
    const questionNumber = Number.parseInt(match?.[1], 10);
    if (Number.isFinite(questionNumber) && questionNumber > 0 && questionNumber <= PDF_IMPORT_MAX_QUESTIONS) {
      markers.push({ index, questionNumber });
    }
  });
  return markers;
}

function splitChineseScienceMissingQuestion(blockLines, questionNumber, nextQuestionNumber) {
  if (nextQuestionNumber !== questionNumber + 2) {
    return [{ questionNumber, lines: blockLines }];
  }

  const optionLineIndexes = blockLines
    .map((line, index) => (CHINESE_SCIENCE_OPTION_LINE_RE.test(line) ? index : -1))
    .filter((index) => index >= 0);

  if (optionLineIndexes.length < 8) {
    return [{ questionNumber, lines: blockLines }];
  }

  const secondOptionGroupStart = optionLineIndexes[4];
  const missingQuestionLineIndex = secondOptionGroupStart - 1;
  const missingQuestionText = blockLines[missingQuestionLineIndex] || "";

  if (
    missingQuestionLineIndex <= optionLineIndexes[3] ||
    missingQuestionText.length < 8 ||
    !/[\u4e00-\u9fff]/.test(missingQuestionText)
  ) {
    return [{ questionNumber, lines: blockLines }];
  }

  return [
    { questionNumber, lines: blockLines.slice(0, missingQuestionLineIndex) },
    {
      questionNumber: questionNumber + 1,
      lines: [
        `${questionNumber + 1}. ${missingQuestionText}`,
        ...blockLines.slice(secondOptionGroupStart),
      ],
    },
  ];
}

function getChineseScienceQuestionBlocks(rawText) {
  const lines = normalizeChineseScienceLines(rawText);
  const markers = getChineseScienceQuestionMarkers(lines);
  const blocks = [];

  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const nextMarker = markers[index + 1];
    const blockLines = lines.slice(marker.index, nextMarker?.index ?? lines.length);
    const splitBlocks = splitChineseScienceMissingQuestion(
      blockLines,
      marker.questionNumber,
      nextMarker?.questionNumber,
    );
    blocks.push(...splitBlocks);
  }

  return blocks;
}

function getChineseScienceOptionMatches(text) {
  return [...stringValue(text).matchAll(CHINESE_SCIENCE_OPTION_RE)]
    .map((match) => {
      const labelOffset = match[0].search(/[A-H]/i);
      return {
        key: stringValue(match[1]).toUpperCase(),
        labelStart: match.index + Math.max(labelOffset, 0),
        contentStart: match.index + match[0].length,
      };
    })
    .filter((match) => /^[A-H]$/.test(match.key));
}

function cleanChineseScienceOptionText(rawText) {
  const text = splitRuleBasedOptionText(rawText);
  if (/^[A-H][.．、]?$/.test(text)) return "";
  return text;
}

function parseChineseScienceQuestionBlock(block) {
  const firstLineMatch = block.lines[0]?.match(CHINESE_SCIENCE_QUESTION_LINE_RE);
  const firstQuestionLine = firstLineMatch ? firstLineMatch[2] : block.lines[0];
  const body = [firstQuestionLine, ...block.lines.slice(1)].filter(Boolean).join("\n");
  const explanationMatch = body.match(CHINESE_SCIENCE_EXPLANATION_RE);
  const questionAndOptions = (explanationMatch ? body.slice(0, explanationMatch.index) : body).trim();
  const explanation = explanationMatch
    ? cleanRuleBasedTextFragment(body.slice(explanationMatch.index + explanationMatch[0].length))
    : "";
  const optionMatches = getChineseScienceOptionMatches(questionAndOptions);

  if (optionMatches.length < 2) return null;

  const questionText = cleanRuleBasedTextFragment(questionAndOptions.slice(0, optionMatches[0].labelStart));
  if (!questionText) return null;

  const parsedOptions = optionMatches
    .slice(0, 8)
    .map((option, index, allOptions) => {
      const nextOption = allOptions[index + 1];
      const optionText = cleanChineseScienceOptionText(
        questionAndOptions.slice(option.contentStart, nextOption?.labelStart ?? questionAndOptions.length),
      );
      return {
        key: option.key,
        text: optionText,
      };
    });
  const maxOptionIndex = Math.max(
    3,
    ...parsedOptions.map((option) => RULE_IMPORT_ANSWER_KEYS.indexOf(option.key)).filter((index) => index >= 0),
  );
  const optionTextByKey = new Map(parsedOptions.map((option) => [option.key, option.text]));
  const answers = RULE_IMPORT_ANSWER_KEYS.slice(0, maxOptionIndex + 1).map((key) => ({
    text: "",
    textCn: optionTextByKey.get(key) || getMissingOptionText(key),
  }));

  const explicitAnswer = explanation.match(CHINESE_SCIENCE_EXPLICIT_ANSWER_RE)?.[1]?.toUpperCase() || "";
  const correctAnswer = explicitAnswer || inferCorrectAnswerFromExplanation(answers, explanation);
  const hasMissingAnswerText = answers.some((answer) => stringValue(answer.textCn).includes(RULE_IMPORT_MISSING_OPTION_TEXT));
  const needsImage = PDF_IMPORT_IMAGE_HINT_RE.test(`${questionText} ${explanation}`);
  const reviewNotes = [
    correctAnswer ? "" : "Chưa tự nhận diện được đáp án đúng. Hãy chọn đáp án trước khi lưu.",
    hasMissingAnswerText ? "Một số công thức/hình trong đáp án chưa được trích ra từ Word/PDF. Hãy sửa các ô giữ chỗ trong bản xem trước." : "",
  ].filter(Boolean).join(" ");

  return {
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
    subQuestionNumber: block.questionNumber,
    needsImage,
    imageHint: needsImage ? "Câu này có thể cần hình ảnh/bảng/biểu đồ trong file. Hãy thêm ảnh thủ công trước khi xuất bản." : "",
    reviewNotes,
  };
}

function parseChineseScienceTextWithRules(rawText, sourceMeta) {
  const blocks = getChineseScienceQuestionBlocks(rawText);
  if (blocks.length < 5) return null;

  const items = blocks
    .map(parseChineseScienceQuestionBlock)
    .filter(Boolean);

  if (!items.length) return null;

  const skippedCount = blocks.length - items.length;
  const warnings = [
    "Bản xem trước này dùng bộ đọc nhanh cho đề khoa học tiếng Trung. Hãy kiểm tra công thức, hình vẽ, ô trống và đáp án đúng trước khi lưu.",
  ];
  if (skippedCount > 0) {
    warnings.push(`Đã bỏ qua ${skippedCount} đoạn giống câu hỏi nhưng không có đủ nhãn đáp án.`);
  }

  return normalizePdfImportResult({
    exam: {
      title: sourceMeta?.fileName ? String(sourceMeta.fileName).replace(/\.(pdf|docx?|doc)$/i, "") : "Imported exam",
      duration: 90,
      totalPoints: Math.max(items.length, 1),
    },
    items,
    warnings,
  }, sourceMeta);
}

function parseChineseSocialQuestionMatches(text) {
  const matches = [];
  const questionRe = /(^|[\n。])\s*(\d{1,3})\.\s*/g;

  for (const match of text.matchAll(questionRe)) {
    const questionNumber = Number.parseInt(match[2], 10);
    if (!Number.isFinite(questionNumber) || questionNumber > PDF_IMPORT_MAX_QUESTIONS) continue;
    matches.push({
      index: match.index + match[1].length,
      bodyStart: match.index + match[0].length,
      questionNumber,
    });
  }

  return matches;
}

function parseChineseSocialOptions(text) {
  const matches = [...stringValue(text).matchAll(CHINESE_SOCIAL_OPTION_LABEL_RE)];
  if (matches.length < 2) return { answers: [], firstOptionIndex: -1 };

  const answers = [];
  for (let i = 0; i < matches.length; i++) {
    const key = stringValue(matches[i][1]).toUpperCase();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const optionText = cleanRuleBasedTextFragment(text.slice(start, end));
    if (key && optionText) {
      answers.push({ key, text: optionText });
    }
  }

  answers.sort((a, b) => RULE_IMPORT_ANSWER_KEYS.indexOf(a.key) - RULE_IMPORT_ANSWER_KEYS.indexOf(b.key));
  return { answers: answers.map((answer) => ({ key: answer.key, text: "", textCn: answer.text })), firstOptionIndex: matches[0].index };
}

function getChineseSocialPoolGroups(text) {
  const poolGroups = [];

  for (const match of text.matchAll(CHINESE_SOCIAL_GROUP_POOL_RE)) {
    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const { answers } = parseChineseSocialOptions(match[3]);
    if (answers.length < 2) continue;

    poolGroups.push({
      startQuestion: start,
      endQuestion: end,
      linkedOptions: answers,
    });
  }

  return poolGroups;
}

function getChineseSocialPoolMap(poolGroups) {
  const poolMap = new Map();

  poolGroups.forEach((group) => {
    for (let questionNumber = group.startQuestion; questionNumber <= group.endQuestion; questionNumber++) {
      poolMap.set(questionNumber, group.linkedOptions);
    }
  });

  return poolMap;
}

function normalizeChineseSocialQuestionText(text) {
  return cleanRuleBasedTextFragment(text)
    .replace(/\bOptions\s*[:：]\s*$/i, "")
    .replace(/^中文\s*[:：]\s*/i, "中文：")
    .trim();
}

function parseChineseSocialQuestionBlock(block, questionNumber, poolMap) {
  const answerMatch = block.match(CHINESE_SOCIAL_ANSWER_RE);
  const correctAnswer = answerMatch?.[1]?.toUpperCase() || "";
  const answerIndex = answerMatch?.index ?? -1;
  const questionAndOptions = (answerIndex >= 0 ? block.slice(0, answerIndex) : block).trim();
  const explanationIndex = block.search(CHINESE_SOCIAL_EXPLANATION_RE);
  const explanation = explanationIndex >= 0
    ? cleanRuleBasedTextFragment(block.slice(explanationIndex).replace(CHINESE_SOCIAL_EXPLANATION_RE, ""))
    : "";
  const parsedOptions = parseChineseSocialOptions(questionAndOptions);
  const answers = parsedOptions.answers.length >= 2
    ? parsedOptions.answers
    : (poolMap.get(questionNumber) || []);
  const questionTextSource = parsedOptions.firstOptionIndex >= 0
    ? questionAndOptions.slice(0, parsedOptions.firstOptionIndex)
    : questionAndOptions;
  const questionText = normalizeChineseSocialQuestionText(questionTextSource);

  if (!questionText || answers.length < 2) return null;

  return {
    itemType: "single_choice",
    questionType: "single_choice",
    questionText: "",
    questionTextCn: questionText,
    answers,
    correctAnswer,
    explanation: "",
    explanationCn: explanation,
    points: 1,
    difficulty: "medium",
    subQuestionNumber: questionNumber,
    needsImage: PDF_IMPORT_IMAGE_HINT_RE.test(questionText),
    imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(questionText) ? "Câu này có thể cần hình ảnh/bảng/biểu đồ trong file. Hãy thêm ảnh thủ công trước khi xuất bản." : "",
    reviewNotes: correctAnswer ? "" : "Chưa tự nhận diện được đáp án đúng. Hãy chọn đáp án trước khi lưu.",
  };
}

function getChineseSocialQuestionBlocks(text) {
  const questionMatches = parseChineseSocialQuestionMatches(text);
  return questionMatches.map((match, index) => {
    const end = index + 1 < questionMatches.length ? questionMatches[index + 1].index : text.length;
    return {
      questionNumber: match.questionNumber,
      block: text.slice(match.bodyStart, end).trim(),
    };
  });
}

function buildChineseSocialFillBlankGroup(poolGroup, questionBlocks, poolMap) {
  const subItems = questionBlocks
    .filter((questionBlock) => (
      questionBlock.questionNumber >= poolGroup.startQuestion &&
      questionBlock.questionNumber <= poolGroup.endQuestion
    ))
    .map((questionBlock) => {
      const parsedQuestion = parseChineseSocialQuestionBlock(questionBlock.block, questionBlock.questionNumber, poolMap);
      if (!parsedQuestion?.correctAnswer) return null;

      return {
        questionText: "",
        questionTextCn: parsedQuestion.questionTextCn,
        explanation: "",
        explanationCn: parsedQuestion.explanationCn,
        correctAnswerKey: parsedQuestion.correctAnswer,
        points: parsedQuestion.points || 1,
        difficulty: parsedQuestion.difficulty || "medium",
        subQuestionNumber: questionBlock.questionNumber,
      };
    })
    .filter(Boolean);

  if (!subItems.length) return null;

  return {
    itemType: "fill_blank_group",
    clozeMode: "sentences",
    linkedOptions: poolGroup.linkedOptions,
    subItems,
    needsImage: subItems.some((item) => PDF_IMPORT_IMAGE_HINT_RE.test(`${item.questionText} ${item.questionTextCn}`)),
    imageHint: "",
    reviewNotes: subItems.length !== poolGroup.endQuestion - poolGroup.startQuestion + 1
      ? "Một số câu điền từ dùng chung lựa chọn chưa được đọc đủ. Hãy kiểm tra nhóm này trước khi lưu."
      : "",
  };
}

function parseChineseSocialQuestions(text, poolGroups, poolMap) {
  const questionBlocks = getChineseSocialQuestionBlocks(text);
  const poolGroupByStart = new Map(poolGroups.map((group) => [group.startQuestion, group]));
  const pooledQuestionNumbers = new Set();
  poolGroups.forEach((group) => {
    for (let questionNumber = group.startQuestion; questionNumber <= group.endQuestion; questionNumber++) {
      pooledQuestionNumbers.add(questionNumber);
    }
  });
  const items = [];

  for (const questionBlock of questionBlocks) {
    const poolGroup = poolGroupByStart.get(questionBlock.questionNumber);
    if (poolGroup) {
      const group = buildChineseSocialFillBlankGroup(poolGroup, questionBlocks, poolMap);
      if (group) items.push(group);
      continue;
    }

    if (pooledQuestionNumbers.has(questionBlock.questionNumber)) continue;

    const item = parseChineseSocialQuestionBlock(questionBlock.block, questionBlock.questionNumber, poolMap);
    if (item) items.push(item);
  }

  return items;
}

function parseChineseSocialReadingGroups(text, poolMap) {
  const groupMatches = [...text.matchAll(CHINESE_SOCIAL_READING_GROUP_RE)].map((match) => ({
    index: match.index,
    bodyStart: match.index + match[0].length,
    startQuestion: Number.parseInt(match[1], 10),
    endQuestion: Number.parseInt(match[2], 10),
  })).filter((match) => Number.isFinite(match.startQuestion) && Number.isFinite(match.endQuestion));
  const groups = [];

  for (let i = 0; i < groupMatches.length; i++) {
    const groupMatch = groupMatches[i];
    const segmentEnd = i + 1 < groupMatches.length ? groupMatches[i + 1].index : text.length;
    const segment = text.slice(groupMatch.bodyStart, segmentEnd).trim();
    const questionMatches = parseChineseSocialQuestionMatches(segment);
    if (!questionMatches.length) continue;

    const passageText = cleanRuleBasedTextFragment(segment.slice(0, questionMatches[0].index));
    const subQuestions = [];
    for (let questionIndex = 0; questionIndex < questionMatches.length; questionIndex++) {
      const questionMatch = questionMatches[questionIndex];
      const questionEnd = questionIndex + 1 < questionMatches.length ? questionMatches[questionIndex + 1].index : segment.length;
      const block = segment.slice(questionMatch.bodyStart, questionEnd).trim();
      const question = parseChineseSocialQuestionBlock(block, questionMatch.questionNumber, poolMap);
      if (question) {
        subQuestions.push({ ...question, itemType: undefined });
      }
    }

    if (passageText && subQuestions.length) {
      groups.push({
        itemType: "reading_group",
        passageText,
        subQuestions,
        needsImage: PDF_IMPORT_IMAGE_HINT_RE.test(passageText),
        imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(passageText) ? "Đoạn đọc hiểu có thể cần hình ảnh trong file. Hãy thêm ảnh thủ công trước khi xuất bản." : "",
        reviewNotes: "",
      });
    } else {
      groups.push(...subQuestions.map((question) => ({ ...question, itemType: "single_choice" })));
    }
  }

  return groups;
}

function parseChineseSocialTextWithRules(rawText, sourceMeta) {
  const text = normalizeChineseSocialText(rawText);
  if (!CHINESE_SOCIAL_ANSWER_RE.test(text)) return null;

  const poolGroups = getChineseSocialPoolGroups(text);
  const poolMap = getChineseSocialPoolMap(poolGroups);
  const readingSectionMatch = text.match(CHINESE_SOCIAL_SECTION_READING_RE);
  const mainText = readingSectionMatch?.index >= 0 ? text.slice(0, readingSectionMatch.index) : text;
  const readingText = readingSectionMatch?.index >= 0 ? text.slice(readingSectionMatch.index) : "";
  const items = [
    ...parseChineseSocialQuestions(mainText, poolGroups, poolMap),
    ...parseChineseSocialReadingGroups(readingText, poolMap),
  ];

  if (!items.length) return null;

  return normalizePdfImportResult({
    exam: {
      title: sourceMeta?.fileName ? String(sourceMeta.fileName).replace(/\.(pdf|docx?|doc)$/i, "") : "Imported exam",
      duration: 90,
      totalPoints: Math.max(items.reduce((sum, item) => sum + countImportedItemQuestions(item), 0), 1),
    },
    items,
    warnings: [
      "Bản xem trước này dùng bộ đọc nhanh cho đề xã hội tiếng Trung. Hãy kiểm tra đoạn đọc hiểu và các lựa chọn chung trước khi lưu.",
    ],
  }, sourceMeta);
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
      correctAnswer ? "" : "Chưa tự nhận diện được đáp án đúng. Hãy chọn đáp án trước khi lưu.",
      hasMissingAnswerText ? "Một số nội dung đáp án chưa được trích ra từ Word/PDF. Hãy sửa các ô giữ chỗ trong bản xem trước." : "",
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
      imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(questionText) ? "Câu này có thể cần hình ảnh/bảng/biểu đồ trong file. Hãy thêm ảnh thủ công trước khi xuất bản." : "",
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
      "Bản xem trước này dùng bộ đọc nhanh cho đề tiếng Việt. Hãy kiểm tra công thức, đáp án giữ chỗ và các câu cần hình ảnh trước khi lưu.",
    ],
  }, sourceMeta);
}

function parsePdfTextWithRules(pdfText, sourceMeta) {
  const vietnamesePreview = parseVietnameseChoiceTextWithRules(pdfText, sourceMeta);
  if (vietnamesePreview?.items?.length) return vietnamesePreview;

  const chineseSciencePreview = parseChineseScienceTextWithRules(pdfText, sourceMeta);
  if (chineseSciencePreview?.items?.length) return chineseSciencePreview;

  const chineseSocialPreview = parseChineseSocialTextWithRules(pdfText, sourceMeta);
  if (chineseSocialPreview?.items?.length) return chineseSocialPreview;

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
      imageHint: PDF_IMPORT_IMAGE_HINT_RE.test(questionText) ? "Câu này có thể cần hình ảnh/bảng/biểu đồ trong PDF. Hãy thêm ảnh thủ công trước khi xuất bản." : "",
      reviewNotes: correctAnswer ? "" : "Chưa tự nhận diện được đáp án đúng. Hãy chọn đáp án trước khi lưu.",
    });
  }

  if (items.length === 0) return null;

  const warnings = [
    "Bản xem trước này dùng bộ đọc nhanh văn bản PDF. Hãy kiểm tra đáp án đúng trước khi lưu.",
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
    warnings.push(`Đã bỏ qua ${rawItems.length - items.length} mục không hợp lệ hoặc chưa hỗ trợ. Hãy kiểm tra PDF và thêm phần thiếu thủ công.`);
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
    return `Không thể import quá ${PDF_IMPORT_MAX_QUESTIONS} câu trong một lần`;
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
       explanation_image_url, image_url, question_group_type, difficulty
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      question.explanationImageUrl ? sanitize(question.explanationImageUrl) : null,
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
         points, explanation, explanation_cn, explanation_image_url,
         question_group_type, difficulty,
         sub_question_number, passage_group_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        subItem.explanationImageUrl ? sanitize(subItem.explanationImageUrl) : null,
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
  const error = new Error(responseBody?.message || cause?.message || "Import preview failed");
  error.statusCode = statusCode;
  error.responseBody = responseBody;
  if (cause?.providerStatus) error.providerStatus = cause.providerStatus;
  if (cause?.providerCode) error.providerCode = cause.providerCode;
  if (cause?.providerMessage) error.providerMessage = cause.providerMessage;
  if (cause?.retryAfter) error.retryAfter = cause.retryAfter;
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
        message: "File không có đủ chữ đọc được. Hãy dùng PDF có text, file Word .doc/.docx hoặc nhập câu hỏi thủ công.",
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

    const ruleBasedCountBeforeAi = ruleBasedPreview?.totalQuestionCount || 0;
    if (
      ruleBasedPreview?.items?.length
      && Number.isFinite(PDF_IMPORT_RULE_PARSER_AI_SKIP_MIN)
      && PDF_IMPORT_RULE_PARSER_AI_SKIP_MIN > 0
      && ruleBasedCountBeforeAi >= PDF_IMPORT_RULE_PARSER_AI_SKIP_MIN
    ) {
      return withRuleBasedOnlyWarning(ruleBasedPreview);
    }

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
          "AI không trả về JSON hợp lệ, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.",
        );
      }

      throw createImportPreviewError(502, {
        message: "AI không trả về dữ liệu import hợp lệ. Hãy thử lại với PDF ngắn hơn.",
        preview: String(rawAi || "").slice(0, 800),
      });
    }

    const normalized = normalizePdfImportResult(aiResult, sourceMeta);

    if (normalized.items.length === 0) {
      if (ruleBasedPreview?.items?.length) {
        return withRuleBasedFallbackWarning(
          ruleBasedPreview,
          "AI không trả về câu hỏi hợp lệ, hệ thống đã dùng bản đọc nhanh bằng quy tắc để tránh thiếu câu.",
        );
      }

      throw createImportPreviewError(422, {
        message: "Không tìm thấy câu hỏi hợp lệ được hỗ trợ trong PDF này.",
        ...normalized,
      });
    }

    const normalizedCount = normalized.totalQuestionCount || 0;
    const ruleBasedCount = ruleBasedPreview?.totalQuestionCount || 0;
    if (ruleBasedCount > normalizedCount) {
      return withRuleBasedFallbackWarning(
        ruleBasedPreview,
        `Parser nhanh đọc được ${ruleBasedCount} câu, còn AI chỉ trả về ${normalizedCount} câu; hệ thống dùng bản parser nhanh để tránh thiếu câu.`,
      );
    }

    return normalized;
  } catch (error) {
    if (error.statusCode && error.responseBody) throw error;

    if (ruleBasedPreview?.items?.length) {
      return withRuleBasedFallbackWarning(ruleBasedPreview, getPdfImportFallbackReason(error));
    }

    if (error.message === "RATE_LIMITED") {
      throw createImportPreviewError(429, {
        message: "AI đang bị giới hạn tạm thời. Hãy thử lại sau.",
        retryAfter: error.retryAfter || aiService.getRateLimitRemaining?.(),
      }, error);
    }

    if (error.message === "AI_TIMEOUT") {
      throw createImportPreviewError(504, {
        message: "AI đọc PDF quá lâu. Hãy thử PDF ngắn hơn.",
      }, error);
    }

    if (
      error.message === "Chi cho phep upload file PDF" ||
      error.message === "Chi cho phep upload file PDF hoac Word .doc/.docx"
    ) {
      throw createImportPreviewError(400, { message: error.message }, error);
    }

    if (error.message === "UNSUPPORTED_IMPORT_FILE") {
      throw createImportPreviewError(400, { message: "Chỉ hỗ trợ file PDF và Word .doc/.docx." }, error);
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
