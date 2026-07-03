const { pool } = require("../config/database");
const { cache } = require("../config/cache");
const UserActivity = require("../models/UserActivity");
const { syncExamTotals } = require("../utils/examScoring");
const {
  previewImportFile,
  normalizeImportedItem,
  validateImportItems,
  countImportedItemQuestions,
  insertImportedSingleChoice,
  insertImportedReadingGroup,
  insertImportedFillBlankGroup,
} = require("../services/adminExamImportService");
const {
  extractSingleQuestionImageOcrText,
} = require("../services/singleQuestionImageOcrService");
const {
  normalizeExamFormulas: normalizeStoredExamFormulas,
  applyExamReviewFixes: applyStoredExamReviewFixes,
  applyExamDisplayFormatFixes,
  fixStoredQuestionExplanationWithAI,
  generateMissingExamExplanations,
  polishExamExplanations,
  applyImportedReviewFixesWithAI,
  reviewImportedItemsWithAI,
  reviewStoredExamWithAI,
  reviewStoredQuestionWithAI,
} = require("../services/examQualityService");
const {
  deleteExamSourceFile: deleteExamSourceFileRecord,
  listExamSourceFiles: listExamSourceFileRecords,
  saveExamSourceFile: saveExamSourceFileRecord,
} = require("../services/exam-ai/examSourceService");
const { buildAiModeOptions, isDeepMode } = require("../services/adminExamAiModeService");
const {
  DEFAULT_SETTINGS,
  getSettings: getSiteSettings,
} = require("../services/siteSettingsService");

// ─── P1 Security: XSS sanitization (strip HTML tags, allow plain text only) ─────
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeExplanation(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\0/g, "").trim();
}

function getSafeErrorLog(error) {
  if (!error) return { message: "Unknown error" };

  const safe = {
    message: error.message,
    statusCode: error.statusCode,
    responseBody: error.responseBody,
    code: error.code,
    providerStatus: error.providerStatus,
    providerCode: error.providerCode,
    providerMessage: error.providerMessage,
    retryAfter: error.retryAfter,
  };

  Object.keys(safe).forEach((key) => safe[key] === undefined && delete safe[key]);
  return safe;
}

function createRequestAbortSignal(req, res) {
  const controller = new AbortController();

  const cleanup = () => {
    req.off("aborted", abort);
    res.off("close", onResponseClose);
    res.off("finish", cleanup);
  };

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
    cleanup();
  };

  const onResponseClose = () => {
    if (res.writableEnded) {
      cleanup();
      return;
    }
    abort();
  };

  req.once("aborted", abort);
  res.once("close", onResponseClose);
  res.once("finish", cleanup);

  if (req.aborted) abort();
  return controller.signal;
}

function sendAiAbortResponse(req, res, error) {
  if (error?.message !== "AI_REQUEST_ABORTED" && !req.aborted && !res.destroyed) return false;
  if (!res.headersSent && !res.writableEnded && !res.destroyed) {
    res.status(499).json({ message: "Yeu cau AI da bi huy vi ket noi bi ngat. Vui long chay lai." });
  }
  return true;
}

function normalizeLedgerKey(value) {
  return String(value || "").trim().slice(0, 500);
}

function normalizeLedgerObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 500));
}

const MAX_POINTS_PER_QUESTION = 100;
const MAX_QUESTIONS_PER_EXAM = 200;
const MISSING_EXAM_MESSAGE = "De thi khong ton tai hoac da bi xoa. Vui long tai lai danh sach de.";
const EXAM_AI_LOCK_NAMESPACE = 910613;
const EXAM_AI_LOCK_WAIT_MS = Number.parseInt(process.env.EXAM_AI_LOCK_WAIT_MS || "15000", 10);
const EXAM_AI_LOCK_RETRY_MS = Number.parseInt(process.env.EXAM_AI_LOCK_RETRY_MS || "250", 10);
const EXAM_AI_ACTIONS = {
  REVIEW: "review_quality",
  REVIEW_QUESTION: "review_question_quality",
  FIX: "apply_fixes",
  FORMAT: "display_format_fixes",
  EXPLAIN: "missing_explanations",
  FIX_QUESTION_EXPLANATION: "fix_question_explanation",
  POLISH_EXPLANATIONS: "polish_explanations",
  NORMALIZE: "normalize_formulas",
};
const QUESTION_REVIEW_SETTING_KEYS = [
  "admin_question_review_model",
  "admin_question_review_fallback_model",
];

function normalizeAiModel(value, fallback) {
  return String(value || "").trim() || fallback;
}

function getUniqueAiModels(models) {
  return [...new Set(models.map(model => String(model || "").trim()).filter(Boolean))];
}

function getAdminExamAiMode(req) {
  return buildAiModeOptions(
    req.body?.qualityMode || req.query?.qualityMode,
    req.body?.fastModel || req.query?.fastModel,
  );
}

async function getQuestionReviewModelContext() {
  const settings = await getSiteSettings(QUESTION_REVIEW_SETTING_KEYS);
  const primaryModel = normalizeAiModel(
    settings.admin_question_review_model,
    DEFAULT_SETTINGS.admin_question_review_model,
  );
  const fallbackModel = normalizeAiModel(
    settings.admin_question_review_fallback_model,
    DEFAULT_SETTINGS.admin_question_review_fallback_model,
  );
  const reviewModels = getUniqueAiModels([primaryModel, fallbackModel]);
  return {
    reviewModel: reviewModels[0] || DEFAULT_SETTINGS.admin_question_review_model,
    reviewModels: reviewModels.length ? reviewModels : [DEFAULT_SETTINGS.admin_question_review_model],
  };
}

async function runDeepExamReviewIfNeeded(client, examId, modeOptions, baseContext = {}) {
  if (!isDeepMode(modeOptions.qualityMode) || !modeOptions.deep) return null;
  return reviewStoredExamWithAI(client, examId, {
    ...baseContext,
    ...modeOptions.deep,
  });
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const DEFAULT_EXAM_DURATION_MINUTES = 90;
const SIXTY_MINUTE_SUBJECT_CODES = new Set(["MATH", "PHYSICS", "CHEMISTRY"]);

function getDefaultExamDurationMinutes(subject) {
  const code = String(subject?.code || "").toUpperCase();
  if (SIXTY_MINUTE_SUBJECT_CODES.has(code)) return 60;
  return DEFAULT_EXAM_DURATION_MINUTES;
}

function resolveExamDurationMinutes(duration, subject) {
  return parsePositiveInteger(duration) || getDefaultExamDurationMinutes(subject);
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

function normalizeTrilingualText(vi, cn, en) {
  const viText = (vi || "").trim();
  const cnText = (cn || "").trim();
  const enText = (en || "").trim();
  if (!viText && !cnText && !enText) return null;
  return {
    vi: viText || enText || cnText,
    cn: cnText || viText || enText,
    en: enText,
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

function normalizeExamLanguageMode(value) {
  const mode = String(value || "").trim().toLowerCase().replace("-", "_");
  const allowed = new Set(["vi", "zh", "en", "vi_zh", "vi_en", "zh_vi", "zh_en", "en_vi", "en_zh"]);
  return allowed.has(mode) ? mode : "zh";
}

function getExamAllowDownload(access) {
  return access?.vipTier === "basic";
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
    const textEn = (opt.textEn || '').trim();
    return {
      key:   opt.key || String.fromCharCode(65 + i),
      text,
      textCn,
      textEn,
    };
  })
    .filter((opt) => opt.text || opt.textCn || opt.textEn);

  return normalized.length >= 2 ? normalized : null;
}

async function syncMultipleChoiceAnswers(client, questionId, answers, normalizedAnswers, correctAnswer) {
  const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const existingResult = await client.query(
    `SELECT a.*,
            EXISTS (
              SELECT 1 FROM user_answers ua WHERE ua.selected_answer_id = a.id
            ) AS is_referenced
     FROM answers a
     WHERE a.question_id = $1
     ORDER BY a.answer_key ASC, a.id ASC
     FOR UPDATE`,
    [questionId],
  );

  const existingByKey = new Map();
  for (const answer of existingResult.rows) {
    const key = String(answer.answer_key || "").trim();
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(answer);
  }

  const activeKeys = new Set();
  for (let i = 0; i < answers.length; i++) {
    const key = answerKeys[i];
    activeKeys.add(key);
    const rows = existingByKey.get(key) || [];
    const primary = rows.find((row) => row.is_referenced) || rows[0];

    if (primary) {
      await client.query(
        `UPDATE answers
         SET answer_text = $1,
             answer_text_cn = $2,
             answer_text_en = $3,
             is_correct = $4,
             image_url = $5
         WHERE id = $6`,
        [
          sanitize(normalizedAnswers[i].vi),
          sanitize(normalizedAnswers[i].cn),
          normalizedAnswers[i].en ? sanitize(normalizedAnswers[i].en) : null,
          key === correctAnswer,
          answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
          primary.id,
        ],
      );

      const duplicateIds = rows
        .filter((row) => row.id !== primary.id && !row.is_referenced)
        .map((row) => row.id);
      if (duplicateIds.length) {
        await client.query("DELETE FROM answers WHERE id = ANY($1::int[])", [duplicateIds]);
      }
      const referencedDuplicateIds = rows
        .filter((row) => row.id !== primary.id && row.is_referenced)
        .map((row) => row.id);
      if (referencedDuplicateIds.length) {
        await client.query(
          "UPDATE answers SET is_correct = false WHERE id = ANY($1::int[])",
          [referencedDuplicateIds],
        );
      }
    } else {
      await client.query(
        `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          questionId,
          key,
          sanitize(normalizedAnswers[i].vi),
          sanitize(normalizedAnswers[i].cn),
          normalizedAnswers[i].en ? sanitize(normalizedAnswers[i].en) : null,
          key === correctAnswer,
          answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
        ],
      );
    }
  }

  const obsolete = existingResult.rows.filter((answer) => !activeKeys.has(String(answer.answer_key || "").trim()));
  const obsoleteUnreferencedIds = obsolete.filter((answer) => !answer.is_referenced).map((answer) => answer.id);
  if (obsoleteUnreferencedIds.length) {
    await client.query("DELETE FROM answers WHERE id = ANY($1::int[])", [obsoleteUnreferencedIds]);
  }

  const obsoleteReferencedIds = obsolete.filter((answer) => answer.is_referenced).map((answer) => answer.id);
  if (obsoleteReferencedIds.length) {
    await client.query(
      "UPDATE answers SET is_correct = false WHERE id = ANY($1::int[])",
      [obsoleteReferencedIds],
    );
  }
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function acquireExamAiLock(client, examId, options = {}) {
  const parsedExamId = Number.parseInt(examId, 10);
  if (!Number.isInteger(parsedExamId) || parsedExamId <= 0) {
    const error = new Error("EXAM_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const waitMs = Number.isFinite(options.waitMs) ? Math.max(0, options.waitMs) : EXAM_AI_LOCK_WAIT_MS;
  const retryMs = Math.max(50, EXAM_AI_LOCK_RETRY_MS);
  const deadline = Date.now() + waitMs;

  do {
    if (options.signal?.aborted) {
      throw new Error("AI_REQUEST_ABORTED");
    }

    const result = await client.query(
      "SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS locked",
      [EXAM_AI_LOCK_NAMESPACE, parsedExamId],
    );

    if (result.rows[0]?.locked) return;

    if (Date.now() < deadline) {
      await wait(Math.min(retryMs, Math.max(0, deadline - Date.now())));
    }
  } while (Date.now() < deadline);

  const error = new Error("EXAM_AI_BUSY");
  error.statusCode = 409;
  throw error;
}

async function releaseExamAiLock(client, examId) {
  const parsedExamId = Number.parseInt(examId, 10);
  if (!Number.isInteger(parsedExamId) || parsedExamId <= 0) return;
  try {
    await client.query("SELECT pg_advisory_unlock($1::int, $2::int)", [EXAM_AI_LOCK_NAMESPACE, parsedExamId]);
  } catch {}
}

function getExamAiBusyResponse(res) {
  return res.status(409).json({
    message: "De nay dang duoc AI xu ly boi admin khac. Vui long doi xong roi thu lai.",
  });
}

async function recordExamAiRun(client, examId, action, userId, summary = {}) {
  await client.query(
    `INSERT INTO admin_exam_ai_runs (exam_id, action, status, summary, run_by, created_at)
     VALUES ($1, $2, 'completed', $3::jsonb, $4, NOW())
     ON CONFLICT (exam_id, action)
     DO UPDATE SET status = EXCLUDED.status,
                   summary = EXCLUDED.summary,
                   run_by = EXCLUDED.run_by,
                   created_at = NOW()`,
    [examId, action, JSON.stringify(summary || {}), userId || null],
  );
}

async function getExamAiHistory(examId) {
  const result = await pool.query(
    `SELECT r.action, r.status, r.summary, r.run_by, r.created_at,
            COALESCE(u.full_name, u.email) AS run_by_name
     FROM admin_exam_ai_runs r
     LEFT JOIN users u ON u.id = r.run_by
     WHERE r.exam_id = $1
     ORDER BY r.created_at DESC`,
    [examId],
  );
  return result.rows.map((row) => ({
    ...row,
    summary: typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary,
  }));
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

const AdminExamController = {
  async ocrSingleQuestionImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Cần gửi ảnh câu hỏi" });
      }

      const text = await extractSingleQuestionImageOcrText(req.file, {
        signal: createRequestAbortSignal(req, res),
      });
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
      if (sendAiAbortResponse(req, res, error)) return;
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
    try {
      if (!req.file) {
        return res.status(400).json({ message: "PDF or Word .doc/.docx file is required" });
      }

      const preview = await previewImportFile(req.file, {
        importPreset: req.body?.importPreset,
        importLanguageMode: req.body?.importLanguageMode,
        subjectCode: req.body?.subjectCode,
        subjectName: req.body?.subjectName,
        signal: createRequestAbortSignal(req, res),
      });
      res.json(preview);
    } catch (error) {
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Preview file import error:", getSafeErrorLog(error));
      res.status(error.statusCode || 500).json(error.responseBody || { message: "Failed to preview import file" });
    }
  },

  async listExamSourceFiles(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const sourceFiles = await listExamSourceFileRecords(client, examId);
      res.json({ sourceFiles });
    } catch (error) {
      console.error("List exam source files error:", getSafeErrorLog(error));
      res.status(500).json({ message: "Không tải được file gốc của đề." });
    } finally {
      client.release();
    }
  },

  async uploadExamSourceFile(req, res) {
    const { examId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "Cần upload file PDF hoặc Word .doc/.docx." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const result = await saveExamSourceFileRecord(client, examId, req.file, req.user.id);
      const sourceFiles = await listExamSourceFileRecords(client, examId);
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.upload_exam_source_file", {
        examId,
        sourceFileId: result.sourceFile?.id,
        fileName: result.sourceFile?.fileName,
        fileType: result.sourceFile?.fileType,
        textLength: result.sourceFile?.textLength,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({
        message: "Đã lưu file gốc để AI đối chiếu.",
        ...result,
        sourceFiles,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Upload exam source file error:", getSafeErrorLog(error));
      if (error.message === "SOURCE_FILE_TEXT_TOO_SHORT") {
        return res.status(422).json({ message: "File gốc không có đủ chữ để AI đối chiếu." });
      }
      if (error.message === "UNSUPPORTED_IMPORT_FILE") {
        return res.status(400).json({ message: "Chỉ hỗ trợ PDF và Word .doc/.docx." });
      }
      res.status(error.statusCode || 500).json({ message: "Upload file gốc thất bại." });
    } finally {
      client.release();
    }
  },

  async deleteExamSourceFile(req, res) {
    const { examId, sourceFileId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await deleteExamSourceFileRecord(client, examId, sourceFileId);
      if (!deleted) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Không tìm thấy file gốc." });
      }
      const sourceFiles = await listExamSourceFileRecords(client, examId);
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.delete_exam_source_file", {
        examId,
        sourceFileId,
        fileName: deleted.file_name,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: "Đã xóa file gốc.",
        deleted,
        sourceFiles,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Delete exam source file error:", getSafeErrorLog(error));
      res.status(500).json({ message: "Xóa file gốc thất bại." });
    } finally {
      client.release();
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

      await syncExamTotals(client, examId);

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

  async reviewImportedItems(req, res) {
    try {
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
      const items = rawItems
        .map((item, index) => normalizeImportedItem(item, index))
        .filter(Boolean);

      if (!items.length) {
        return res.status(400).json({ message: "Không có câu hỏi để AI soát." });
      }

      const modeOptions = getAdminExamAiMode(req);
      const result = await reviewImportedItemsWithAI(items, {
        subject: req.body?.subject || req.body?.subjectName || "CSCA",
        signal: createRequestAbortSignal(req, res),
        ...(isDeepMode(modeOptions.qualityMode) ? modeOptions.deep : modeOptions.fast),
      });
      result.qualityMode = modeOptions.qualityMode;

      UserActivity.log(req.user.id, "admin.review_imported_exam_items", {
        total: result.summary?.total || 0,
        issues: result.summary?.issues || 0,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Review imported items error:", getSafeErrorLog(error));
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI soát đề quá thời gian." });
      }
      res.status(500).json({ message: "AI soát đề thất bại." });
    }
  },

  async applyImportedReviewFixes(req, res) {
    try {
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
      const items = rawItems
        .map((item, index) => normalizeImportedItem(item, index))
        .filter(Boolean);
      const reviews = Array.isArray(req.body?.reviews) ? req.body.reviews : [];

      if (!items.length) {
        return res.status(400).json({ message: "Không có câu hỏi để AI sửa." });
      }
      if (!reviews.some(review => review?.status && review.status !== "ok")) {
        return res.status(400).json({ message: "Không có log lỗi cần sửa." });
      }

      const result = await applyImportedReviewFixesWithAI(items, reviews, {
        subject: req.body?.subject || req.body?.subjectName || "CSCA",
        signal: createRequestAbortSignal(req, res),
      });

      UserActivity.log(req.user.id, "admin.apply_imported_exam_review_fixes", {
        changedCount: result.changedCount || 0,
        skippedCount: result.skippedCount || 0,
        total: result.summary?.total || 0,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Apply imported review fixes error:", getSafeErrorLog(error));
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI sửa đề quá thời gian." });
      }
      res.status(500).json({ message: "AI sửa lỗi đề thất bại." });
    }
  },

  async getImportReviewLedger(req, res) {
    try {
      const ledgerKey = normalizeLedgerKey(req.query?.key);
      if (!ledgerKey) {
        return res.status(400).json({ message: "Thiếu khóa log AI." });
      }

      const result = await pool.query(
        `SELECT ledger_key, source, question_count, ledger, updated_at
         FROM admin_import_review_ledgers
         WHERE user_id = $1 AND ledger_key = $2
         LIMIT 1`,
        [req.user.id, ledgerKey],
      );

      const row = result.rows[0];
      res.json({
        key: ledgerKey,
        source: row?.source || {},
        questionCount: row?.question_count || 0,
        ledger: row?.ledger || {},
        updatedAt: row?.updated_at || null,
      });
    } catch (error) {
      console.error("Get import review ledger error:", getSafeErrorLog(error));
      res.status(500).json({ message: "Không tải được sổ log AI." });
    }
  },

  async saveImportReviewLedger(req, res) {
    try {
      const ledgerKey = normalizeLedgerKey(req.body?.key || req.body?.ledgerKey);
      if (!ledgerKey) {
        return res.status(400).json({ message: "Thiếu khóa log AI." });
      }

      const ledger = normalizeLedgerObject(req.body?.ledger);
      const source = req.body?.source && typeof req.body.source === "object" && !Array.isArray(req.body.source)
        ? req.body.source
        : {};
      const questionCount = Math.max(
        0,
        Math.min(500, Number.parseInt(req.body?.questionCount || "0", 10) || 0),
      );

      const result = await pool.query(
        `INSERT INTO admin_import_review_ledgers (user_id, ledger_key, source, question_count, ledger, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, NOW())
         ON CONFLICT (user_id, ledger_key)
         DO UPDATE SET source = EXCLUDED.source,
                       question_count = EXCLUDED.question_count,
                       ledger = EXCLUDED.ledger,
                       updated_at = NOW()
         RETURNING ledger_key, question_count, updated_at`,
        [req.user.id, ledgerKey, JSON.stringify(source), questionCount, JSON.stringify(ledger)],
      );

      res.json({
        key: result.rows[0].ledger_key,
        questionCount: result.rows[0].question_count,
        updatedAt: result.rows[0].updated_at,
        saved: true,
      });
    } catch (error) {
      console.error("Save import review ledger error:", getSafeErrorLog(error));
      res.status(500).json({ message: "Không lưu được sổ log AI." });
    }
  },

  async reviewExamQuality(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const baseContext = {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
      };
      let result = await reviewStoredExamWithAI(client, examId, baseContext);
      if (isDeepMode(modeOptions.qualityMode)) {
        const fastSummary = result.summary;
        result = await reviewStoredExamWithAI(client, examId, {
          ...baseContext,
          ...modeOptions.deep,
        });
        result.fastReviewSummary = fastSummary;
      }
      result.qualityMode = modeOptions.qualityMode;
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.REVIEW, req.user.id, {
        total: result.summary?.total || 0,
        issues: result.summary?.issues || 0,
        ok: result.summary?.ok || 0,
        model: result.summary?.model,
        sourceFileId: result.sourceFile?.id,
        sourceFileName: result.sourceFile?.fileName,
      });
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.review_saved_exam_quality", {
        examId,
        total: result.summary?.total || 0,
        issues: result.summary?.issues || 0,
        changedPreview: result.safeFixPreview?.changedCount || 0,
        warningPreview: result.safeFixPreview?.warningCount || 0,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Review saved exam quality error:", getSafeErrorLog(error));
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI soát đề quá thời gian." });
      }
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "EXAM_NOT_FOUND") {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      res.status(500).json({ message: "AI soát đề thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async reviewQuestionQuality(req, res) {
    const { examId, questionId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const questionReviewModelContext = await getQuestionReviewModelContext();
      const hasRequestedFastModel = Boolean(req.body?.fastModel || req.query?.fastModel);
      const baseContext = {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
        ...questionReviewModelContext,
        ...(hasRequestedFastModel ? modeOptions.fast : {}),
      };
      let result = await reviewStoredQuestionWithAI(client, examId, questionId, baseContext);
      if (isDeepMode(modeOptions.qualityMode)) {
        const fastSummary = result.summary;
        result = await reviewStoredQuestionWithAI(client, examId, questionId, {
          ...baseContext,
          ...modeOptions.deep,
        });
        result.fastReviewSummary = fastSummary;
      }
      result.qualityMode = modeOptions.qualityMode;
      if (Array.isArray(result.diagnostics)) {
        const modelChain = isDeepMode(modeOptions.qualityMode)
          ? getUniqueAiModels([baseContext.reviewModel, modeOptions.deep?.reviewModel])
          : getUniqueAiModels(baseContext.reviewModels || [baseContext.reviewModel]);
        const modelLabel = modelChain.join(" -> ");
        result.summary = { ...(result.summary || {}), model: modelLabel };
        result.diagnostics = result.diagnostics.map(item => ({
          ...item,
          model: modelLabel,
          modelChain,
        }));
      }
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.REVIEW_QUESTION, req.user.id, {
        questionId: Number(questionId),
        total: result.summary?.total || 0,
        issues: result.summary?.issues || 0,
        ok: result.summary?.ok || 0,
        model: result.summary?.model,
        sourceFileId: result.sourceFile?.id,
        sourceFileName: result.sourceFile?.fileName,
      });
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.review_saved_question_quality", {
        examId,
        questionId,
        status: result.reviews?.[0]?.status,
        issues: result.summary?.issues || 0,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Review saved question quality error:", getSafeErrorLog(error));
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI soát câu hỏi quá thời gian." });
      }
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "EXAM_NOT_FOUND") {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      if (error.message === "QUESTION_NOT_FOUND") {
        return res.status(404).json({ message: "Khong tim thay cau hoi de AI soat." });
      }
      res.status(500).json({ message: "AI soát câu hỏi thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async fixQuestionExplanation(req, res) {
    const { examId, questionId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const questionReviewModelContext = await getQuestionReviewModelContext();
      const result = await fixStoredQuestionExplanationWithAI(client, examId, questionId, {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        reviewNote: req.body?.reviewNote || req.body?.note || "",
        explanationIssues: Array.isArray(req.body?.explanationIssues) ? req.body.explanationIssues : [],
        signal,
        ...modeOptions.fast,
        fixModel: questionReviewModelContext.reviewModel,
        fixModels: questionReviewModelContext.reviewModels,
      });
      result.qualityMode = modeOptions.qualityMode;
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.FIX_QUESTION_EXPLANATION, req.user.id, {
        questionId: Number(questionId),
        changedCount: result.changedCount || 0,
        confidence: result.confidence,
        needsManualReview: result.needsManualReview,
        model: result.diagnostics?.[0]?.model,
        sourceFileId: result.sourceFile?.id,
        sourceFileName: result.sourceFile?.fileName,
      });
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.fix_question_explanation", {
        examId,
        questionId,
        changedCount: result.changedCount || 0,
        needsManualReview: result.needsManualReview,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Fix question explanation error:", getSafeErrorLog(error));
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI sửa lời giải quá thời gian." });
      }
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "EXAM_NOT_FOUND") {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      if (error.message === "QUESTION_NOT_FOUND") {
        return res.status(404).json({ message: "Không tìm thấy câu hỏi để AI sửa lời giải." });
      }
      res.status(500).json({ message: "AI sửa lời giải thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async applyExamReviewFixes(req, res) {
    const { examId } = req.params;
    const reviews = Array.isArray(req.body?.reviews) ? req.body.reviews : [];
    if (!reviews.length) {
      return res.status(400).json({
        message: "Bạn cần bấm AI soát đề trước, rồi mới dùng AI sửa toàn bộ log.",
      });
    }
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const baseContext = {
        applySafeFormulas: req.body?.applySafeFormulas !== false,
        applySuggestedAnswers: req.body?.applySuggestedAnswers !== false,
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
      };
      const result = await applyStoredExamReviewFixes(client, examId, reviews, baseContext);
      result.qualityMode = modeOptions.qualityMode;
      result.deepReview = await runDeepExamReviewIfNeeded(client, examId, modeOptions, {
        subject: baseContext.subject,
        signal,
      });
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.FIX, req.user.id, {
        changedCount: result.changedCount,
        answerChangedCount: result.answerChangedCount,
        formulaChangedCount: result.formulaChangedCount,
        skippedCount: result.skippedCount,
        model: result.summary?.model,
        sourceFileId: result.sourceFile?.id,
        sourceFileName: result.sourceFile?.fileName,
      });
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.apply_exam_review_fixes", {
        examId,
        answerChangedCount: result.answerChangedCount,
        formulaChangedCount: result.formulaChangedCount,
        skippedCount: result.skippedCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Apply exam review fixes error:", getSafeErrorLog(error));
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI sửa đề quá thời gian." });
      }
      res.status(500).json({ message: "Sửa lỗi AI đề này thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async applyExamDisplayFormatFixes(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const baseContext = {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
      };
      const result = await applyExamDisplayFormatFixes(client, examId, baseContext);
      result.qualityMode = modeOptions.qualityMode;
      result.deepReview = await runDeepExamReviewIfNeeded(client, examId, modeOptions, baseContext);
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.FORMAT, req.user.id, {
        changedCount: result.changedCount,
        formulaChangedCount: result.formulaChangedCount,
        warningCount: result.warningCount,
        skippedCount: result.skippedCount,
        model: result.summary?.model,
      });
      await client.query("COMMIT");

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, "admin.apply_exam_display_format_fixes", {
        examId,
        changedCount: result.changedCount,
        formulaChangedCount: result.formulaChangedCount,
        skippedCount: result.skippedCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Apply exam display format fixes error:", getSafeErrorLog(error));
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI sửa format quá thời gian." });
      }
      res.status(500).json({ message: "AI sửa format hiển thị thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async generateMissingExplanations(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const baseContext = {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
      };
      const result = await generateMissingExamExplanations(client, examId, baseContext);
      result.qualityMode = modeOptions.qualityMode;
      result.deepReview = await runDeepExamReviewIfNeeded(client, examId, modeOptions, baseContext);
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.EXPLAIN, req.user.id, {
        changedCount: result.changedCount,
        questionChangedCount: result.questionChangedCount,
        skippedCount: result.skippedCount,
        total: result.summary?.total,
        generated: result.summary?.generated,
        aiCalls: result.summary?.aiCalls,
        failedBatches: result.summary?.failedBatches,
        invalidBatches: result.summary?.invalidBatches,
        model: result.summary?.model,
      });
      await client.query("COMMIT");

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, "admin.generate_missing_exam_explanations", {
        examId,
        changedCount: result.changedCount,
        questionChangedCount: result.questionChangedCount,
        skippedCount: result.skippedCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Generate missing explanations error:", getSafeErrorLog(error));
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI dang bi gioi han tam thoi. Thu lai sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI tao giai thich qua thoi gian." });
      }
      if (error.message === "EXAM_NOT_FOUND") {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      res.status(500).json({ message: "AI tao giai thich thieu that bai." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async polishExplanations(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      const signal = createRequestAbortSignal(req, res);
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId, { signal });
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const modeOptions = getAdminExamAiMode(req);
      const baseContext = {
        subject: req.body?.subject || req.body?.subjectName || undefined,
        signal,
        ...modeOptions.fast,
      };
      const result = await polishExamExplanations(client, examId, baseContext);
      result.qualityMode = modeOptions.qualityMode;
      result.deepReview = await runDeepExamReviewIfNeeded(client, examId, modeOptions, baseContext);
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.POLISH_EXPLANATIONS, req.user.id, {
        changedCount: result.changedCount,
        questionChangedCount: result.questionChangedCount,
        skippedCount: result.skippedCount,
        model: result.summary?.model,
      });
      await client.query("COMMIT");

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, "admin.polish_exam_explanations", {
        examId,
        changedCount: result.changedCount,
        questionChangedCount: result.questionChangedCount,
        skippedCount: result.skippedCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (sendAiAbortResponse(req, res, error)) return;
      console.error("Polish explanations error:", getSafeErrorLog(error));
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      if (error.message === "RATE_LIMITED") {
        return res.status(429).json({
          message: "AI đang bị giới hạn tạm thời. Thử lại sau.",
          retryAfter: error.retryAfter,
        });
      }
      if (error.message === "AI_TIMEOUT") {
        return res.status(504).json({ message: "AI chuẩn hóa lời giải quá thời gian." });
      }
      if (error.message === "EXAM_NOT_FOUND") {
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }
      res.status(500).json({ message: "AI chuẩn hóa lời giải thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async normalizeExamFormulas(req, res) {
    const { examId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await acquireExamAiLock(client, examId);
      const exists = await ensureExamExists(client, examId);
      if (!exists) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: MISSING_EXAM_MESSAGE });
      }

      const result = await normalizeStoredExamFormulas(client, examId, { apply: true });
      await recordExamAiRun(client, examId, EXAM_AI_ACTIONS.NORMALIZE, req.user.id, {
        changedCount: result.changedCount,
        warningCount: result.warningCount,
      });
      await client.query("COMMIT");

      UserActivity.log(req.user.id, "admin.normalize_exam_formulas", {
        examId,
        changedCount: result.changedCount,
        warningCount: result.warningCount,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: result.changedCount
          ? `Đã chuẩn hóa ${result.changedCount} chỗ.`
          : "Không có công thức cần chuẩn hóa.",
        ...result,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Normalize exam formulas error:", error);
      if (error.message === "EXAM_AI_BUSY") {
        return getExamAiBusyResponse(res);
      }
      res.status(500).json({ message: "Chuẩn hóa công thức thất bại." });
    } finally {
      await releaseExamAiLock(client, examId);
      client.release();
    }
  },

  async normalizeManyExamFormulas(req, res) {
    const limit = Math.max(1, Math.min(200, Number.parseInt(req.body?.limit || "50", 10) || 50));
    const subject = String(req.body?.subject || "").trim();
    const client = await pool.connect();
    try {
      const where = ["e.deleted_at IS NULL", "COALESCE(e.deletion_status, 'none') <> 'soft_deleted'"];
      const params = [];
      if (subject) {
        params.push(subject);
        where.push(`s.code = $${params.length}`);
      }
      params.push(limit);

      const examResult = await client.query(
        `SELECT e.id, e.title
         FROM exams e
         LEFT JOIN subjects s ON s.id = e.subject_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.updated_at DESC NULLS LAST, e.id DESC
         LIMIT $${params.length}`,
        params,
      );

      const results = [];
      for (const exam of examResult.rows) {
        await client.query("BEGIN");
        try {
          const result = await normalizeStoredExamFormulas(client, exam.id, { apply: true });
          await client.query("COMMIT");
          results.push({ id: exam.id, title: exam.title, ...result });
        } catch (error) {
          await client.query("ROLLBACK");
          results.push({
            id: exam.id,
            title: exam.title,
            error: "Chuẩn hóa đề này thất bại.",
          });
        }
      }

      const changedCount = results.reduce((sum, item) => sum + (item.changedCount || 0), 0);
      const warningCount = results.reduce((sum, item) => sum + (item.warningCount || 0), 0);

      UserActivity.log(req.user.id, "admin.normalize_many_exam_formulas", {
        examCount: results.length,
        changedCount,
        warningCount,
        subject,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: `Đã quét ${results.length} đề, sửa ${changedCount} chỗ.`,
        examCount: results.length,
        changedCount,
        warningCount,
        results,
      });
    } catch (error) {
      console.error("Normalize many exam formulas error:", error);
      res.status(500).json({ message: "Chuẩn hóa nhiều đề thất bại." });
    } finally {
      client.release();
    }
  },

  // Create new exam
  async createExam(req, res) {
    try {
      // P0: destructure titleCn
      const { title, titleCn, subjectId, duration, totalPoints, description, descriptionCn, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated, difficulty_level, languageMode, language_mode } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ message: "Title and subject required" });
      }

      // P1: validate subjectId exists
      const subjectCheck = await pool.query("SELECT id, code FROM subjects WHERE id = $1", [subjectId]);
      if (subjectCheck.rows.length === 0) {
        return res.status(400).json({ message: "Subject not found" });
      }

      const parsedTotalPoints = parsePositiveNumber(totalPoints, 100);
      const parsedDuration = resolveExamDurationMinutes(duration, subjectCheck.rows[0]);

      // P1: sanitize all text inputs to prevent XSS
      const examCode = `EXAM-${subjectId}-${Date.now()}`;
      const safeTitle = sanitize(title);
      const safeTitleCn = titleCn ? sanitize(titleCn) : null;
      const safeDescription = description ? sanitize(description) : "";
      const access = normalizeExamAccess(is_premium, vip_tier);

      const result = await pool.query(
        `INSERT INTO exams (code, title, title_cn, subject_id, duration, total_points, total_questions, description, difficulty_level, language_mode, status, publish_date, is_premium, allow_download, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, 'draft', NOW(), $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          examCode,
          safeTitle,
          safeTitleCn,
          subjectId,
          parsedDuration,
          parsedTotalPoints,
          safeDescription,
          difficulty_level || 'medium',
          normalizeExamLanguageMode(languageMode || language_mode),
          access.isPremium,
          getExamAllowDownload(access),
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
      const { title, titleCn, subjectId, duration, totalPoints, description, difficulty_level, languageMode, language_mode, status, is_premium, allow_download, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated } = req.body;
      const parsedTotalPoints =
        totalPoints === undefined
          ? undefined
          : parsePositiveNumber(totalPoints, 100);
      const parsedDuration =
        duration === undefined
          ? undefined
          : parsePositiveInteger(duration);
      if (duration !== undefined && parsedDuration === null) {
        return res.status(400).json({ message: "Invalid exam duration" });
      }

      const updates = [];
      const params = [];
      let idx = 1;
      const currentExamResult = await pool.query("SELECT is_premium, vip_tier FROM exams WHERE id = $1 AND deleted_at IS NULL", [examId]);
      if (currentExamResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }
      const currentAccess = normalizeExamAccess(currentExamResult.rows[0].is_premium, currentExamResult.rows[0].vip_tier);
      let effectiveAccess = currentAccess;
      // P1: sanitize all text fields + P0: handle titleCn/descriptionCn
      if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(sanitize(title)); }
      if (titleCn !== undefined) { updates.push(`title_cn = $${idx++}`); params.push(titleCn ? sanitize(titleCn) : null); }
      if (subjectId !== undefined) {
        const parsedSubjectId = Number.parseInt(subjectId, 10);
        if (!Number.isInteger(parsedSubjectId) || parsedSubjectId <= 0) {
          return res.status(400).json({ message: "Subject not found" });
        }
        const subjectCheck = await pool.query("SELECT id FROM subjects WHERE id = $1", [parsedSubjectId]);
        if (subjectCheck.rows.length === 0) {
          return res.status(400).json({ message: "Subject not found" });
        }
        updates.push(`subject_id = $${idx++}`);
        params.push(parsedSubjectId);
      }
      if (parsedDuration !== undefined) { updates.push(`duration = $${idx++}`); params.push(parsedDuration); }
      if (parsedTotalPoints !== undefined) { updates.push(`total_points = $${idx++}`); params.push(parsedTotalPoints); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description ? sanitize(description) : null); }
      if (difficulty_level !== undefined) { updates.push(`difficulty_level = $${idx++}`); params.push(difficulty_level); }
      if (languageMode !== undefined || language_mode !== undefined) { updates.push(`language_mode = $${idx++}`); params.push(normalizeExamLanguageMode(languageMode || language_mode)); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
      if (is_premium !== undefined || vip_tier !== undefined) {
        const access = normalizeExamAccess(is_premium, vip_tier);
        effectiveAccess = access;
        updates.push(`is_premium = $${idx++}`);
        params.push(access.isPremium);
        updates.push(`vip_tier = $${idx++}`);
        params.push(access.vipTier);
      }
      updates.push(`allow_download = $${idx++}`);
      params.push(getExamAllowDownload(effectiveAccess));
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
      if (exam.deleted_at || exam.deletion_status === "soft_deleted") {
        return res.status(400).json({ message: "Đề thi này đã nằm trong danh sách xóa tạm." });
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
        message: "Đề đã được chuyển vào danh sách xóa tạm. Dữ liệu câu hỏi, lượt thi và đáp án vẫn được giữ để có thể khôi phục.",
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
        return res.status(403).json({ message: "Chỉ admin tổng được khôi phục đề đã xóa tạm." });
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
      return res.status(403).json({ message: "Chỉ admin tổng được xóa vĩnh viễn đề trong danh sách xóa tạm." });
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
      if (!exam.deleted_at && exam.deletion_status !== "soft_deleted") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Chỉ có thể xóa vĩnh viễn đề đã nằm trong danh sách xóa tạm." });
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
        message: "Đã xóa vĩnh viễn đề thi khỏi danh sách xóa tạm.",
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
        message: "Đã duyệt yêu cầu xóa. Đề đã được chuyển vào danh sách xóa tạm.",
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
        questionTextEn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        explanationEn,
        explanationImageUrl,
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
        const normQ = normalizeTrilingualText(questionText, questionTextCn, questionTextEn);
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
          const normAnswers = (answers || []).map(a => normalizeTrilingualText(a.text, a.textCn, a.textEn));
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
        const normQ = normalizeTrilingualText(questionText, questionTextCn, questionTextEn);
        const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

        const questionResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn, question_text_en,
             points, explanation, explanation_cn, explanation_en,
             explanation_image_url, image_url,
             passage_text, passage_image_url,
             question_group_type, difficulty,
             linked_options, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING id`,
          [
            examId,
            questionNumber,
            qType,
            sanitize(normQ?.vi || ''),
            sanitize(normQ?.cn || ''),
            normQ?.en ? sanitize(normQ.en) : null,
            parsedPoints,
            explanation ? sanitizeExplanation(explanation) : null,
            explanationCn ? sanitizeExplanation(explanationCn) : null,
            explanationEn ? sanitizeExplanation(explanationEn) : null,
            explanationImageUrl ? sanitize(explanationImageUrl) : null,
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
          const normAnswers = (answers || []).map(a => normalizeTrilingualText(a.text, a.textCn, a.textEn));
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < normAnswers.length; i++) {
            const key = answerKeys[i];
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                questionId,
                key,
                sanitize(normAnswers[i].vi),
                sanitize(normAnswers[i].cn),
                normAnswers[i].en ? sanitize(normAnswers[i].en) : null,
                key === correctAnswer,
                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
              ],
            );
          }
        }

        // ── UPDATE exam total_questions ──
        await syncExamTotals(client, examId);

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
        questionTextEn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        explanationEn,
        explanationImageUrl,
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

      const hasQuestionTextPayload = questionText !== undefined || questionTextCn !== undefined || questionTextEn !== undefined;
      const normalizedQuestion = hasQuestionTextPayload ? normalizeTrilingualText(questionText, questionTextCn, questionTextEn) : null;

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
          vals.push(sanitize(normalizedQuestion.vi));
          fields.push(`question_text_cn = $${idx++}`);
          vals.push(sanitize(normalizedQuestion.cn));
          fields.push(`question_text_en = $${idx++}`);
          vals.push(normalizedQuestion.en ? sanitize(normalizedQuestion.en) : null);
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
        if (explanationEn !== undefined) {
          fields.push(`explanation_en = $${idx++}`);
          vals.push(explanationEn ? sanitizeExplanation(explanationEn) : null);
        }
        if (explanationImageUrl !== undefined) {
          fields.push(`explanation_image_url = $${idx++}`);
          vals.push(explanationImageUrl ? sanitize(explanationImageUrl) : null);
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
            const normalizedAnswers = answers.map(a => normalizeTrilingualText(a.text, a.textCn, a.textEn));
            if (normalizedAnswers.some(a => !a)) {
              await client.query("ROLLBACK");
              return res.status(400).json({ message: "Mỗi đáp án phải có nội dung" });
            }
            await syncMultipleChoiceAnswers(client, questionId, answers, normalizedAnswers, correctAnswer);
          }
        }

        const examSyncResult = await client.query(
          "SELECT exam_id FROM questions WHERE id = $1",
          [questionId],
        );
        if (examSyncResult.rows[0]) {
          await syncExamTotals(client, examSyncResult.rows[0].exam_id);
        }

        await client.query("COMMIT");
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");
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
        await syncExamTotals(client, examId);

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
            questionType, questionText, questionTextCn, questionTextEn, imageUrl,
            points, explanation, explanationCn, explanationEn, explanationImageUrl, answers, correctAnswer,
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
                const parsedAtPosition = Number.parseInt(atPosition, 10);
                if (Number.isFinite(parsedAtPosition) && parsedAtPosition > 0) {
                    targetPosition = parsedAtPosition;
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
                await shiftQuestionNumbers(client, examId, targetPosition, 1);

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
                    const normQ = normalizeTrilingualText(questionText, questionTextCn, questionTextEn);
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
                    const normAnswers = (answers || []).map(a => normalizeTrilingualText(a.text, a.textCn, a.textEn));
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
                const normQ = normalizeTrilingualText(questionText, questionTextCn, questionTextEn);
                const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

                const questionResult = await client.query(
                    `INSERT INTO questions (
                        exam_id, question_number, question_type,
                        question_text, question_text_cn, question_text_en,
                        points, explanation, explanation_cn, explanation_en,
                        explanation_image_url, image_url, passage_text, passage_image_url,
                        question_group_type, difficulty,
                        linked_options, sub_question_number, passage_group_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    RETURNING id`,
                    [
                        examId, targetPosition, qType,
                        sanitize(normQ?.vi || ''), sanitize(normQ?.cn || ''),
                        normQ?.en ? sanitize(normQ.en) : null,
                        parsedPoints,
                        explanation ? sanitizeExplanation(explanation) : null,
                        explanationCn ? sanitizeExplanation(explanationCn) : null,
                        explanationEn ? sanitizeExplanation(explanationEn) : null,
                        explanationImageUrl ? sanitize(explanationImageUrl) : null,
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
                    const normAnswers = (answers || []).map(a => normalizeTrilingualText(a.text, a.textCn, a.textEn));
                    const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                    for (let i = 0; i < normAnswers.length; i++) {
                        const key = answerKeys[i];
                        await client.query(
                            `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, image_url)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [
                                questionId, key,
                                sanitize(normAnswers[i].vi), sanitize(normAnswers[i].cn),
                                normAnswers[i].en ? sanitize(normAnswers[i].en) : null,
                                key === correctAnswer,
                                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
                            ],
                        );
                    }
                }

                // ── Update exam total_questions ──
                await syncExamTotals(client, examId);

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
      const subject = typeof req.query.subject === "string" ? req.query.subject.trim() : "";
      const access = typeof req.query.access === "string" ? req.query.access.trim().toLowerCase() : "";

      const params = [];
      let idx = 1;
      const conditions = ["e.deleted_at IS NULL AND COALESCE(e.deletion_status, 'none') <> 'soft_deleted'"];
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
          return res.status(403).json({ message: "Chỉ admin tổng được xem danh sách xóa tạm." });
        }
        conditions[0] = "(e.deleted_at IS NOT NULL OR e.deletion_status = 'soft_deleted')";
      }
      if (subject) {
        conditions.push(`EXISTS (SELECT 1 FROM subjects subject_filter WHERE subject_filter.id = e.subject_id AND subject_filter.code = $${idx++})`);
        params.push(subject);
      }
      if (access === "normal") {
        conditions.push("(COALESCE(e.is_premium, FALSE) = FALSE AND COALESCE(e.vip_tier, 'basic') = 'basic')");
      } else if (access === "vip") {
        conditions.push("(COALESCE(e.is_premium, FALSE) = TRUE OR COALESCE(e.vip_tier, 'basic') <> 'basic')");
      }
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM exams e ${whereClause}`,
        params,
      );
      const totalExams = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalExams / limit);
      const limitParam = idx++;
      const offsetParam = idx++;

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
                LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, limit, offset],
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
              THEN COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100)
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
                COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100) >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100)
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
                COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100) >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100)
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

  // GET /api/admin/exams/analytics - Deep exam attempt analytics for exam admins
  async getAnalytics(req, res) {
    try {
      const baseExamWhere = "e.deleted_at IS NULL AND COALESCE(e.deletion_status, 'none') <> 'soft_deleted'";

      const overviewQuery = `
        SELECT
          COUNT(DISTINCT e.id)::int AS total_exams,
          COUNT(DISTINCT CASE WHEN ea.id IS NOT NULL THEN e.id END)::int AS exams_with_attempts,
          COUNT(DISTINCT ea.id)::int AS total_attempts,
          COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END)::int AS completed_attempts,
          COUNT(DISTINCT ea.user_id)::int AS unique_users,
          COALESCE(ROUND(AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS avg_score_percentage,
          COALESCE(ROUND(MAX(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS best_score_percentage,
          MAX(ea.submit_time) AS last_submit_at
        FROM exams e
        LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
        WHERE ${baseExamWhere}
      `;

      const popularExamsQuery = `
        WITH best_attempts AS (
          SELECT DISTINCT ON (ea.exam_id)
            ea.exam_id,
            ea.user_id,
            COALESCE(u.full_name, u.username, u.email, 'User #' || u.id) AS user_name,
            u.email AS user_email,
            ea.total_score,
            ROUND(ea.total_score::numeric / NULLIF(e.total_points, 0) * 100, 1)::numeric AS score_percentage,
            ea.duration_seconds,
            ea.submit_time
          FROM exam_attempts ea
          JOIN exams e ON e.id = ea.exam_id
          LEFT JOIN users u ON u.id = ea.user_id
          WHERE ea.status = 'completed' AND ${baseExamWhere}
          ORDER BY ea.exam_id, ea.total_score DESC NULLS LAST, ea.duration_seconds ASC NULLS LAST, ea.submit_time ASC NULLS LAST
        )
        SELECT
          e.id,
          e.title,
          e.status,
          e.is_premium,
          e.vip_tier,
          s.name AS subject_name,
          s.code AS subject_code,
          COUNT(ea.id)::int AS total_attempts,
          COUNT(CASE WHEN ea.status = 'completed' THEN 1 END)::int AS completed_attempts,
          COUNT(DISTINCT ea.user_id)::int AS unique_users,
          COALESCE(ROUND(AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS avg_score_percentage,
          COALESCE(ROUND(MAX(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS best_score_percentage,
          MAX(ea.submit_time) AS last_attempt_at,
          ba.user_id AS top_user_id,
          ba.user_name AS top_user_name,
          ba.user_email AS top_user_email,
          ba.total_score AS top_score,
          ba.score_percentage AS top_score_percentage,
          ba.duration_seconds AS top_duration_seconds,
          ba.submit_time AS top_submit_time
        FROM exams e
        LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
        LEFT JOIN best_attempts ba ON ba.exam_id = e.id
        WHERE ${baseExamWhere}
        GROUP BY e.id, e.title, e.status, e.is_premium, e.vip_tier, s.name, s.code,
                 ba.user_id, ba.user_name, ba.user_email, ba.total_score, ba.score_percentage, ba.duration_seconds, ba.submit_time
        HAVING COUNT(ea.id) > 0
        ORDER BY total_attempts DESC, unique_users DESC, last_attempt_at DESC NULLS LAST
        LIMIT 20
      `;

      const topUsersQuery = `
        SELECT
          u.id AS user_id,
          COALESCE(u.full_name, u.username, u.email, 'User #' || u.id) AS user_name,
          u.email AS user_email,
          COUNT(ea.id)::int AS total_attempts,
          COUNT(CASE WHEN ea.status = 'completed' THEN 1 END)::int AS completed_attempts,
          COUNT(DISTINCT ea.exam_id)::int AS distinct_exams,
          COALESCE(ROUND(AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS avg_score_percentage,
          COALESCE(ROUND(MAX(CASE WHEN ea.status = 'completed' THEN ea.total_score::numeric / NULLIF(e.total_points, 0) * 100 END), 1), 0)::numeric AS best_score_percentage,
          MAX(ea.submit_time) AS last_submit_at
        FROM exam_attempts ea
        JOIN exams e ON e.id = ea.exam_id
        LEFT JOIN users u ON u.id = ea.user_id
        WHERE ${baseExamWhere}
        GROUP BY u.id, u.full_name, u.username, u.email
        ORDER BY completed_attempts DESC, avg_score_percentage DESC, last_submit_at DESC NULLS LAST
        LIMIT 20
      `;

      const recentAttemptsQuery = `
        SELECT
          ea.id,
          ea.exam_id,
          e.title AS exam_title,
          s.name AS subject_name,
          s.code AS subject_code,
          ea.user_id,
          COALESCE(u.full_name, u.username, u.email, 'User #' || u.id) AS user_name,
          u.email AS user_email,
          ea.status,
          ea.total_score,
          ROUND(ea.total_score::numeric / NULLIF(e.total_points, 0) * 100, 1)::numeric AS score_percentage,
          ea.duration_seconds,
          ea.start_time,
          ea.submit_time,
          ea.created_at
        FROM exam_attempts ea
        JOIN exams e ON e.id = ea.exam_id
        LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN users u ON u.id = ea.user_id
        WHERE ${baseExamWhere}
        ORDER BY COALESCE(ea.submit_time, ea.created_at) DESC
        LIMIT 30
      `;

      const [overviewResult, popularExamsResult, topUsersResult, recentAttemptsResult] = await Promise.all([
        pool.query(overviewQuery),
        pool.query(popularExamsQuery),
        pool.query(topUsersQuery),
        pool.query(recentAttemptsQuery),
      ]);

      const overview = overviewResult.rows[0] || {};
      res.json({
        success: true,
        data: {
          overview: {
            totalExams: Number(overview.total_exams || 0),
            examsWithAttempts: Number(overview.exams_with_attempts || 0),
            totalAttempts: Number(overview.total_attempts || 0),
            completedAttempts: Number(overview.completed_attempts || 0),
            uniqueUsers: Number(overview.unique_users || 0),
            avgScorePercentage: parseFloat(overview.avg_score_percentage) || 0,
            bestScorePercentage: parseFloat(overview.best_score_percentage) || 0,
            lastSubmitAt: overview.last_submit_at || null,
          },
          popularExams: popularExamsResult.rows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            isPremium: row.is_premium === true,
            vipTier: row.vip_tier || "basic",
            subjectName: row.subject_name,
            subjectCode: row.subject_code,
            totalAttempts: Number(row.total_attempts || 0),
            completedAttempts: Number(row.completed_attempts || 0),
            uniqueUsers: Number(row.unique_users || 0),
            avgScorePercentage: parseFloat(row.avg_score_percentage) || 0,
            bestScorePercentage: parseFloat(row.best_score_percentage) || 0,
            lastAttemptAt: row.last_attempt_at || null,
            topUser: row.top_user_id ? {
              id: row.top_user_id,
              name: row.top_user_name,
              email: row.top_user_email,
              score: parseFloat(row.top_score) || 0,
              scorePercentage: parseFloat(row.top_score_percentage) || 0,
              durationSeconds: Number(row.top_duration_seconds || 0),
              submittedAt: row.top_submit_time || null,
            } : null,
          })),
          topUsers: topUsersResult.rows.map((row) => ({
            userId: row.user_id,
            userName: row.user_name,
            userEmail: row.user_email,
            totalAttempts: Number(row.total_attempts || 0),
            completedAttempts: Number(row.completed_attempts || 0),
            distinctExams: Number(row.distinct_exams || 0),
            avgScorePercentage: parseFloat(row.avg_score_percentage) || 0,
            bestScorePercentage: parseFloat(row.best_score_percentage) || 0,
            lastSubmitAt: row.last_submit_at || null,
          })),
          recentAttempts: recentAttemptsResult.rows.map((row) => ({
            id: row.id,
            examId: row.exam_id,
            examTitle: row.exam_title,
            subjectName: row.subject_name,
            subjectCode: row.subject_code,
            userId: row.user_id,
            userName: row.user_name,
            userEmail: row.user_email,
            status: row.status,
            totalScore: parseFloat(row.total_score) || 0,
            scorePercentage: parseFloat(row.score_percentage) || 0,
            durationSeconds: Number(row.duration_seconds || 0),
            startedAt: row.start_time || row.created_at || null,
            submittedAt: row.submit_time || null,
          })),
        },
      });
    } catch (error) {
      console.error("Get exam analytics error:", error);
      res.status(500).json({ message: "Failed to get exam analytics" });
    }
  },

  // GET /api/admin/exams/counts - Get exam counts by type
  async getCounts(req, res) {
    try {
      const [total, phongThi, tuDo, moPhong, deleteRequests, trash, bySubject] = await Promise.all([
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND COALESCE(deletion_status, 'none') <> 'soft_deleted'"),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND COALESCE(deletion_status, 'none') <> 'soft_deleted' AND start_time IS NOT NULL"),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND COALESCE(deletion_status, 'none') <> 'soft_deleted' AND start_time IS NULL AND is_simulated = false"),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND COALESCE(deletion_status, 'none') <> 'soft_deleted' AND start_time IS NULL AND is_simulated = true"),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NULL AND deletion_status = 'requested'"),
        pool.query("SELECT COUNT(*)::int as count FROM exams WHERE deleted_at IS NOT NULL OR deletion_status = 'soft_deleted'"),
        pool.query(`
          SELECT s.id as subject_id, s.name as subject_name, s.code as subject_code, COUNT(e.id)::int as count
          FROM subjects s
          JOIN exams e ON e.subject_id = s.id
          WHERE e.deleted_at IS NULL AND COALESCE(e.deletion_status, 'none') <> 'soft_deleted'
          GROUP BY s.id, s.name, s.code
          ORDER BY s.name ASC
        `),
      ]);
      res.json({
        all: parseInt(total.rows[0].count),
        phongThi: parseInt(phongThi.rows[0].count),
        tuDo: parseInt(tuDo.rows[0].count),
        moPhong: parseInt(moPhong.rows[0].count),
        deleteRequests: parseInt(deleteRequests.rows[0].count),
        trash: parseInt(trash.rows[0].count),
        bySubject: bySubject.rows.map((row) => ({
          subjectId: row.subject_id,
          subjectName: row.subject_name,
          subjectCode: row.subject_code,
          count: parseInt(row.count),
        })),
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

      const examResult = await pool.query(
        `SELECT e.*, s.name as subject_name, s.code as subject_code
         FROM exams e
         LEFT JOIN subjects s ON e.subject_id = s.id
         WHERE e.id = $1 AND e.deleted_at IS NULL`,
        [examId],
      );
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
           q.question_text_en,
           q.image_url,
           q.points,
           q.explanation,
           q.explanation_cn,
           q.explanation_en,
           q.explanation_image_url,
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
               'answer_text_en', a.answer_text_en,
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

      const exam = examResult.rows[0];
      exam.allow_download = getExamAllowDownload(normalizeExamAccess(exam.is_premium, exam.vip_tier));
      const aiHistory = await getExamAiHistory(examId);
      const sourceFiles = await listExamSourceFileRecords(pool, examId);

      res.json({
        exam,
        questions,
        aiHistory,
        sourceFiles,
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
          const normQ = normalizeTrilingualText(q.questionText, q.questionTextCn, q.questionTextEn);

          const subResult = await client.query(
            `INSERT INTO questions (
               exam_id, question_number, question_type,
               question_text, question_text_cn, question_text_en,
               points, explanation, explanation_cn, explanation_en, explanation_image_url,
               question_group_type, difficulty,
               sub_question_number, passage_group_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [
              examId, questionNumber, QUESTION_TYPES.READING_ITEM,
              sanitize(normQ?.vi || ''), sanitize(normQ?.cn || ''),
              normQ?.en ? sanitize(normQ.en) : null,
              parsedPoints,
              q.explanation ? sanitizeExplanation(q.explanation) : null,
              q.explanationCn ? sanitizeExplanation(q.explanationCn) : null,
              q.explanationEn ? sanitizeExplanation(q.explanationEn) : null,
              q.explanationImageUrl ? sanitize(q.explanationImageUrl) : null,
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
            const normA = normalizeTrilingualText(q.answers[i].text, q.answers[i].textCn, q.answers[i].textEn);
            if (!normA) continue;
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                subId, answerKeys[i],
                sanitize(normA.vi), sanitize(normA.cn),
                normA.en ? sanitize(normA.en) : null,
                answerKeys[i] === q.correctAnswer,
                q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
              ]
            );
          }

          insertedSubs.push({ id: subId, questionNumber, correctAnswer: q.correctAnswer });
        }

        await syncExamTotals(client, examId);

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
            const normQ = normalizeTrilingualText(q.questionText, q.questionTextCn, q.questionTextEn);

            const subResult = await client.query(
              `INSERT INTO questions (
                 exam_id, question_number, question_type,
                 question_text, question_text_cn, question_text_en,
                 points, explanation, explanation_cn, explanation_en, explanation_image_url,
                 question_group_type, difficulty,
                 sub_question_number, passage_group_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               RETURNING id`,
              [
                examId, questionNumber, QUESTION_TYPES.READING_ITEM,
                sanitize(normQ?.vi || ''), sanitize(normQ?.cn || ''),
                normQ?.en ? sanitize(normQ.en) : null,
                parsedPoints,
                q.explanation ? sanitizeExplanation(q.explanation) : null,
                q.explanationCn ? sanitizeExplanation(q.explanationCn) : null,
                q.explanationEn ? sanitizeExplanation(q.explanationEn) : null,
                q.explanationImageUrl ? sanitize(q.explanationImageUrl) : null,
                QUESTION_TYPES.READING_ITEM,
                q.difficulty || 'medium',
                q.subQuestionNumber || questionNumber,
                groupId,
              ]
            );
            const subId = subResult.rows[0].id;

            for (let i = 0; i < q.answers.length; i++) {
              const normA = normalizeTrilingualText(q.answers[i].text, q.answers[i].textCn, q.answers[i].textEn);
              if (!normA) continue;
              await client.query(
                `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, answer_text_en, is_correct, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  subId, answerKeys[i],
                  sanitize(normA.vi), sanitize(normA.cn),
                  normA.en ? sanitize(normA.en) : null,
                  answerKeys[i] === q.correctAnswer,
                  q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
                ]
              );
            }
            insertedSubs.push({ id: subId, questionNumber });
          }

          await syncExamTotals(client, examId);
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

        await syncExamTotals(client, examId);

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
