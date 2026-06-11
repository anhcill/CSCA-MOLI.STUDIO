const aiConfig = require("../config/aiConfig");
const aiService = require("./aiService");
const { repairOcrMathArtifacts } = require("./ocrMathRepairService");

const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const REVIEW_BATCH_SIZE = Number.parseInt(process.env.AI_EXAM_REVIEW_BATCH_SIZE || "6", 10);
const REVIEW_MAX_ITEMS = Number.parseInt(process.env.AI_EXAM_REVIEW_MAX_ITEMS || "120", 10);
const REVIEW_APPLY_MIN_CONFIDENCE = Number.parseFloat(process.env.AI_EXAM_REVIEW_APPLY_MIN_CONFIDENCE || "0.75");

function stringValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function compactWhitespace(value) {
  return stringValue(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeStoredFormulaText(value, options = {}) {
  const input = stringValue(value).replace(/\0/g, "");
  if (!input.trim()) return "";

  let out = repairOcrMathArtifacts(input)
    .replace(/\\\\(?=(?:sin|cos|tan|cot|sec|csc|log|ln|lg|sqrt|lim|sum|int|vec|bar|hat|tilde|frac|binom|mathbb|begin|end|rightleftharpoons|leftrightharpoons|left|right|infty|emptyset|notin|setminus|cup|cap|circ|pi|alpha|beta|gamma|delta|theta|lambda|mu|Delta|partial|pm|Rightarrow|Leftrightarrow|to|leq|geq|neq|approx)\b|\(|\)|\[|\]|\{|\})/g, "\\")
    .replace(/\\right\s+leftharpoons/g, "\\rightleftharpoons")
    .replace(/\\left\s+right/g, "\\leftright")
    .replace(/\\le\s+ft/g, "\\left")
    .replace(/\\in\s+t/g, "\\int")
    .replace(/\\frac\s*([A-Za-z0-9])\s*([A-Za-z0-9])\b/g, "\\frac{$1}{$2}")
    .replace(/\\sqrt\s*([A-Za-z0-9])\b/g, "\\sqrt{$1}")
    .replace(/\(\[\)\/\(([^)]*)\)\)/g, "[$1)")
    .replace(/\(\(\)\/\(([^)]*)\)\)/g, "($1)")
    .replace(/\bC\s*(?:\u211d|R)\s*\(/g, "C_{\\mathbb{R}}(")
    .replace(/\bC\s*(?:\u211d|R)\b/g, "C_{\\mathbb{R}}")
    .replace(/\\cup|\u222a/g, "\\cup")
    .replace(/\\cap|\u2229/g, "\\cap")
    .replace(/\\setminus|\u2216/g, "\\setminus")
    .replace(/\b([A-Za-z])\s*[\u20d7]+/g, "\\vec{$1}")
    .replace(/(\d)\s*o\b/g, "$1°")
    .replace(/\s+([,.;:\uff0c\u3002\uff1b\uff1a\uff09)\]])/g, "$1")
    .replace(/([\uff08(\[])\s+/g, "$1");

  if (options.explanation) {
    out = out
      .replace(/\\n/g, "\n")
      .replace(/\r\n?/g, "\n")
      .replace(/\s*((?:Công thức|Thay|Kiểm tra|Kết luận|Chọn|Vậy)\s*[:：])/gi, "\n$1")
      .replace(/\s*((?:步骤|Bước)\s*\d+\s*[:：])/gi, "\n$1")
      .replace(/\s*(=>|⇒|\\Rightarrow)\s*/g, "\n$1 ")
      .replace(/([。.;；])\s*(?=(?:由|当|代入|验证|因此|所以|故|选|答案|解析|得|Suy ra|Vậy))/g, "$1\n");
  }

  return compactWhitespace(out);
}

function isSuspiciousFormulaText(value) {
  const text = stringValue(value);
  if (!text) return false;

  const openInline = (text.match(/\\\(/g) || []).length;
  const closeInline = (text.match(/\\\)/g) || []).length;
  const openDisplay = (text.match(/\\\[/g) || []).length;
  const closeDisplay = (text.match(/\\\]/g) || []).length;

  return (
    openInline !== closeInline ||
    openDisplay !== closeDisplay ||
    /\\(?:frac|sqrt|left|right)\s+(?=[A-Za-z])/i.test(text) ||
    /\\(?:le\s+ft|in\s+t|right\s+leftharpoons)/i.test(text) ||
    /\$\$/.test(text)
  );
}

function normalizeField(value, options = {}) {
  const before = stringValue(value).trim();
  const after = normalizeStoredFormulaText(before, options);
  if (before === after) {
    return { before, after, changed: false, suspicious: isSuspiciousFormulaText(after) };
  }

  const beforeLen = Math.max(before.length, 1);
  const ratio = after.length / beforeLen;
  const safe = ratio >= 0.5 && ratio <= 1.8 && !/<[^>]+>/.test(after);
  const suspicious = !safe || isSuspiciousFormulaText(after);
  return { before, after, changed: safe && !suspicious, suspicious };
}

function pushChange(changes, question, field, before, after) {
  changes.push({
    questionId: question.id,
    questionNumber: question.question_number,
    field,
    before,
    after,
  });
}

function normalizeLinkedOptions(rawOptions) {
  if (!rawOptions) return { value: rawOptions, changes: [], warnings: [] };

  const options = typeof rawOptions === "string" ? JSON.parse(rawOptions) : rawOptions;
  if (!Array.isArray(options)) return { value: rawOptions, changes: [], warnings: [] };

  const changes = [];
  const warnings = [];
  const nextOptions = options.map((option, index) => {
    const next = { ...option };
    for (const key of ["text", "textCn"]) {
      const normalized = normalizeField(option?.[key]);
      if (normalized.changed) {
        next[key] = normalized.after;
        changes.push({ index, field: key, before: normalized.before, after: normalized.after });
      } else if (normalized.suspicious) {
        warnings.push({ index, field: key, value: normalized.before });
      }
    }
    return next;
  });

  return { value: nextOptions, changes, warnings };
}

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

async function normalizeExamFormulas(client, examId, options = {}) {
  const apply = options.apply !== false;
  const questionsResult = await client.query(
    `SELECT id, question_number, question_text, question_text_cn, explanation, explanation_cn, passage_text, linked_options
     FROM questions
     WHERE exam_id = $1 AND deleted_at IS NULL
     ORDER BY question_number, id`,
    [examId],
  );
  const answersResult = await client.query(
    `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, q.question_number
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE q.exam_id = $1 AND q.deleted_at IS NULL
     ORDER BY q.question_number, a.answer_key`,
    [examId],
  );

  const changes = [];
  const warnings = [];

  for (const question of questionsResult.rows) {
    const updates = [];
    const params = [];

    for (const field of ["question_text", "question_text_cn", "passage_text"]) {
      const normalized = normalizeField(question[field]);
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        pushChange(changes, question, field, normalized.before, normalized.after);
      } else if (normalized.suspicious) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field,
          message: "Công thức còn nghi lỗi, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    for (const field of ["explanation", "explanation_cn"]) {
      const normalized = normalizeField(question[field], { explanation: true });
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        pushChange(changes, question, field, normalized.before, normalized.after);
      } else if (normalized.suspicious) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field,
          message: "Lời giải còn nghi lỗi công thức, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    if (question.linked_options) {
      try {
        const linked = normalizeLinkedOptions(question.linked_options);
        if (linked.changes.length) {
          params.push(JSON.stringify(linked.value));
          updates.push(`linked_options = $${params.length}`);
          for (const change of linked.changes) {
            pushChange(changes, question, `linked_options.${change.index}.${change.field}`, change.before, change.after);
          }
        }
        for (const warning of linked.warnings) {
          warnings.push({
            questionId: question.id,
            questionNumber: question.question_number,
            field: `linked_options.${warning.index}.${warning.field}`,
            message: "Lựa chọn điền từ còn nghi lỗi công thức, cần xem tay.",
            value: warning.value,
          });
        }
      } catch (error) {
        warnings.push({
          questionId: question.id,
          questionNumber: question.question_number,
          field: "linked_options",
          message: "Không đọc được linked_options để chuẩn hóa.",
        });
      }
    }

    if (apply && updates.length) {
      params.push(question.id);
      await client.query(
        `UPDATE questions SET ${updates.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }
  }

  for (const answer of answersResult.rows) {
    const updates = [];
    const params = [];
    for (const field of ["answer_text", "answer_text_cn"]) {
      const normalized = normalizeField(answer[field]);
      if (normalized.changed) {
        params.push(normalized.after);
        updates.push(`${field} = $${params.length}`);
        changes.push({
          answerId: answer.id,
          questionId: answer.question_id,
          questionNumber: answer.question_number,
          answerKey: answer.answer_key,
          field,
          before: normalized.before,
          after: normalized.after,
        });
      } else if (normalized.suspicious) {
        warnings.push({
          answerId: answer.id,
          questionId: answer.question_id,
          questionNumber: answer.question_number,
          answerKey: answer.answer_key,
          field,
          message: "Đáp án còn nghi lỗi công thức, cần xem tay.",
          value: normalized.before,
        });
      }
    }

    if (apply && updates.length) {
      params.push(answer.id);
      await client.query(
        `UPDATE answers SET ${updates.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }
  }

  if (apply && changes.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    questionCount: questionsResult.rowCount,
    answerCount: answersResult.rowCount,
    changedCount: changes.length,
    warningCount: warnings.length,
    changes: changes.slice(0, 80),
    warnings: warnings.slice(0, 80),
  };
}

function stripAiNoise(raw) {
  return stringValue(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAiJson(raw) {
  const text = stripAiNoise(raw);
  try {
    return JSON.parse(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function normalizeReviewStatus(value) {
  const status = stringValue(value).toLowerCase();
  if (["ok", "formula_issue", "answer_issue", "explanation_issue", "needs_review"].includes(status)) {
    return status;
  }
  return "needs_review";
}

function collectImportedQuestions(items) {
  const questions = [];
  (items || []).forEach((item, itemIndex) => {
    if (item?.itemType === "reading_group") {
      (item.subQuestions || []).forEach((question, subIndex) => {
        questions.push({
          path: `${itemIndex}.subQuestions.${subIndex}`,
          label: `Mục ${itemIndex + 1}.${subIndex + 1}`,
          itemIndex,
          subIndex,
          kind: "reading",
          contextText: item.passageText || "",
          contextImageUrl: item.passageImageUrl || "",
          question,
        });
      });
      return;
    }

    if (item?.itemType === "fill_blank_group") {
      (item.subItems || []).forEach((question, subIndex) => {
        questions.push({
          path: `${itemIndex}.subItems.${subIndex}`,
          label: `Mục ${itemIndex + 1}.${subIndex + 1}`,
          itemIndex,
          subIndex,
          kind: "fill_blank",
          contextText: item.passageText || "",
          contextImageUrl: item.passageImageUrl || "",
          question: {
            ...question,
            answers: item.linkedOptions || [],
            correctAnswer: question.correctAnswerKey,
          },
        });
      });
      return;
    }

    questions.push({
      path: `${itemIndex}`,
      label: `Mục ${itemIndex + 1}`,
      itemIndex,
      kind: "single",
      contextText: item.passageText || "",
      contextImageUrl: item.passageImageUrl || "",
      question: item,
    });
  });
  return questions.slice(0, REVIEW_MAX_ITEMS);
}

function buildReviewPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      contextText: entry.contextText || q.passageText || q.passage_text || "",
      contextImageUrl: entry.contextImageUrl || q.passageImageUrl || q.passage_image_url || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      questionImageUrl: q.imageUrl || q.image_url || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
        imageUrl: answer.imageUrl || answer.image_url || "",
      })),
      currentCorrectAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
      explanationImageUrl: q.explanationImageUrl || q.explanation_image_url || "",
    };
  });

  return `Bạn là giáo viên soát đề CSCA. Hãy giải lại từng câu từ đầu, không tin đáp án/lời giải cũ.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Không tự sửa nội dung đề trong JSON.
- contextText là đoạn đọc hiểu/đoạn điền từ nếu có; phải dùng khi giải câu con.
- Nếu có imageUrl/contextImageUrl/explanationImageUrl mà ảnh cần để giải nhưng bạn không đọc được ảnh, status="needs_review".
- Nếu đáp án hiện tại đúng, status="ok".
- Nếu công thức/LaTeX/OCR làm câu khó hiểu hoặc sai, status="formula_issue".
- Nếu đáp án hiện tại có vẻ sai, status="answer_issue" và đưa suggestedCorrectAnswer.
- Nếu lời giải sai, thiếu, hoặc trình bày không khớp đáp án, status="explanation_issue".
- Nếu thiếu hình/dữ kiện hoặc không chắc, status="needs_review".
- confidence từ 0 đến 1. Câu đỏ chỉ khi confidence >= 0.75.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "reviews": [
    {
      "index": 0,
      "path": "0",
      "status": "ok|formula_issue|answer_issue|explanation_issue|needs_review",
      "confidence": 0.9,
      "suggestedCorrectAnswer": "A",
      "formulaIssues": ["..."],
      "explanationIssues": ["..."],
      "note": "ngắn gọn tiếng Việt"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function buildFallbackReview(entry, note) {
  return {
    path: entry.path,
    label: entry.label,
    questionId: entry.questionId,
    questionNumber: entry.questionNumber,
    questionType: entry.questionType,
    parentQuestionId: entry.parentQuestionId,
    status: "needs_review",
    confidence: 0,
    suggestedCorrectAnswer: "",
    formulaIssues: [],
    explanationIssues: [],
    note,
  };
}

function getReviewErrorDiagnostic(error) {
  const errorCode = error?.message || "AI_REVIEW_ERROR";
  const providerMessage = stringValue(error?.providerMessage).slice(0, 500);
  const message = providerMessage || (
    errorCode === "RATE_LIMITED"
      ? "AI đang bị giới hạn, thử lại sau."
      : errorCode === "AI_TIMEOUT"
        ? "AI soát đề quá thời gian."
        : stringValue(error?.message || "AI review lỗi, cần chạy lại.").slice(0, 500)
  );

  return {
    errorCode,
    message,
    retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : undefined,
    providerStatus: Number.isFinite(error?.providerStatus) ? error.providerStatus : undefined,
    providerCode: error?.providerCode,
  };
}

function getBatchLabelRange(batch) {
  const labels = batch.map(entry => entry.label).filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} - ${labels[labels.length - 1]}`;
}

async function reviewQuestionEntriesWithAI(sourceEntries, context = {}) {
  const entries = (sourceEntries || []).slice(0, REVIEW_MAX_ITEMS);
  if (!entries.length) {
    return {
      summary: {
        total: 0,
        ok: 0,
        issues: 0,
        aiCalls: 0,
        failedBatches: 0,
        invalidBatches: 0,
        model: aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel,
        questionTotal: 0,
        reviewedCount: 0,
      },
      reviews: [],
      diagnostics: [{
        batch: 0,
        range: "Không có câu hợp lệ",
        labels: [],
        paths: [],
        model: aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel,
        status: "no_questions",
        message: "Không gom được câu hỏi hợp lệ từ dữ liệu này nên chưa gọi model.",
      }],
    };
  }

  const reviews = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(12, REVIEW_BATCH_SIZE || 6));
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const model = aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel;
    const startedAt = Date.now();
    try {
      const raw = await aiService.callBeeknoee(buildReviewPrompt(batch, context), {
        model,
        temperature: 0.1,
        maxTokens: Number.parseInt(process.env.AI_EXAM_REVIEW_MAX_TOKENS || "3000", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_REVIEW_TIMEOUT_MS || "90000", 10),
      });
      const parsed = parseAiJson(raw);
      const batchReviews = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchReviews.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedReviews: batchReviews.length,
        expectedReviews: batch.length,
        message: batchReviews.length
          ? `AI đã trả ${batchReviews.length}/${batch.length} review.`
          : "AI đã được gọi nhưng phản hồi không có JSON reviews hợp lệ.",
        rawPreview: batchReviews.length ? undefined : stringValue(raw).slice(0, 500),
      });
      if (!batchReviews.length) {
        continue;
      }
      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const review = batchReviews.find((item) => item?.path === entry.path || item?.index === localIndex);
        if (!review) {
          reviews.push(buildFallbackReview(entry, "AI không trả review cho câu này. Xem log tổng hợp phía trên."));
          continue;
        }
        reviews.push({
          path: entry.path,
          label: entry.label,
          questionId: entry.questionId,
          questionNumber: entry.questionNumber,
          questionType: entry.questionType,
          parentQuestionId: entry.parentQuestionId,
          status: normalizeReviewStatus(review.status),
          confidence: Math.max(0, Math.min(1, Number(review.confidence) || 0)),
          suggestedCorrectAnswer: stringValue(review.suggestedCorrectAnswer).toUpperCase().slice(0, 1),
          formulaIssues: Array.isArray(review.formulaIssues) ? review.formulaIssues.map(stringValue).filter(Boolean) : [],
          explanationIssues: Array.isArray(review.explanationIssues) ? review.explanationIssues.map(stringValue).filter(Boolean) : [],
          note: stringValue(review.note).slice(0, 600),
        });
      }
    } catch (error) {
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedReviews: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI imported exam review batch failed:", diagnostic);
    }
  }

  const counts = reviews.reduce((acc, review) => {
    acc.total += 1;
    if (review.status === "ok") acc.ok += 1;
    else acc.issues += 1;
    acc[review.status] = (acc[review.status] || 0) + 1;
    return acc;
  }, { total: 0, ok: 0, issues: 0 });
  counts.aiCalls = diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length;
  counts.failedBatches = diagnostics.filter(item => item.status === "failed").length;
  counts.invalidBatches = diagnostics.filter(item => item.status === "invalid_response").length;
  counts.model = aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel;
  counts.questionTotal = entries.length;
  counts.reviewedCount = reviews.length;

  return {
    reviews,
    summary: counts,
    diagnostics,
  };
}

function applyReviewsToImportedItems(items, reviews) {
  const nextItems = JSON.parse(JSON.stringify(items || []));
  for (const review of reviews) {
    const parts = review.path.split(".");
    const itemIndex = Number.parseInt(parts[0], 10);
    const item = nextItems[itemIndex];
    if (!item) continue;

    let target = item;
    if (parts[1] === "subQuestions") target = item.subQuestions?.[Number.parseInt(parts[2], 10)];
    if (parts[1] === "subItems") target = item.subItems?.[Number.parseInt(parts[2], 10)];
    if (!target) continue;

    target.aiReview = review;
    if (review.status !== "ok") {
      const noteParts = [
        `[AI ${review.status}] ${review.note || "Cần kiểm tra lại."}`,
        review.suggestedCorrectAnswer ? `Gợi ý đáp án: ${review.suggestedCorrectAnswer}` : "",
        ...review.formulaIssues.map((issue) => `Công thức: ${issue}`),
        ...review.explanationIssues.map((issue) => `Lời giải: ${issue}`),
      ].filter(Boolean);
      target.reviewNotes = [target.reviewNotes, ...noteParts].filter(Boolean).join("\n");
    }
  }
  return nextItems;
}

async function reviewImportedItemsWithAI(items, context = {}) {
  const entries = collectImportedQuestions(items);
  const result = await reviewQuestionEntriesWithAI(entries, context);
  return {
    items: applyReviewsToImportedItems(items, result.reviews),
    ...result,
  };
}

function getReviewFixTargetEntries(entries, reviews = []) {
  const reviewByPath = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review?.path || review.status === "ok") continue;
    reviewByPath.set(review.path, review);
  }

  return entries
    .filter((entry) => reviewByPath.has(entry.path))
    .map((entry) => ({ ...entry, review: reviewByPath.get(entry.path) }))
    .slice(0, REVIEW_MAX_ITEMS);
}

function buildFixPrompt(batch, context = {}) {
  const payload = batch.map((entry, index) => {
    const q = entry.question || {};
    return {
      index,
      path: entry.path,
      label: entry.label,
      questionId: entry.questionId,
      questionNumber: entry.questionNumber,
      review: entry.review,
      contextText: entry.contextText || q.passageText || q.passage_text || "",
      contextImageUrl: entry.contextImageUrl || q.passageImageUrl || q.passage_image_url || "",
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      questionImageUrl: q.imageUrl || q.image_url || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || answer.answer_key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
        imageUrl: answer.imageUrl || answer.image_url || "",
      })),
      currentCorrectAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
      explanationImageUrl: q.explanationImageUrl || q.explanation_image_url || "",
    };
  });

  return `Bạn là giáo viên CSCA và kỹ thuật viên LaTeX. Hãy sửa toàn bộ lỗi trong log AI review dưới đây.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Chỉ sửa những trường cần sửa. Không tự chế đề mới.
- Nếu sửa đáp án, correctAnswer phải là một key đang có trong answers.
- Nếu sửa công thức/lời giải, trả lại nguyên field đã sửa hoàn chỉnh, giữ đúng ngôn ngữ gốc.
- Nếu không đủ dữ kiện hoặc cần hình ảnh không đọc được, không sửa bừa; đưa note ngắn.
- Ưu tiên sửa lỗi trong review.note, formulaIssues, explanationIssues.

Môn/ngữ cảnh: ${context.subject || "CSCA đa môn"}.

Trả dạng:
{
  "fixes": [
    {
      "index": 0,
      "path": "0",
      "confidence": 0.9,
      "correctAnswer": "B",
      "questionText": "chỉ gửi nếu cần thay",
      "questionTextCn": "chỉ gửi nếu cần thay",
      "answers": [{"key": "A", "text": "chỉ gửi nếu cần thay", "textCn": "chỉ gửi nếu cần thay"}],
      "explanation": "chỉ gửi nếu cần thay",
      "explanationCn": "chỉ gửi nếu cần thay",
      "note": "đã sửa gì hoặc vì sao bỏ qua"
    }
  ]
}

Dữ liệu:
${JSON.stringify(payload)}`;
}

function normalizeAiFix(rawFix, entry) {
  const answerKeys = new Set((entry.question?.answers || []).map((answer, index) => (
    stringValue(answer?.key || answer?.answer_key || ANSWER_KEYS[index]).toUpperCase().slice(0, 1)
  )).filter(Boolean));
  const correctAnswer = stringValue(rawFix?.correctAnswer).trim().toUpperCase().slice(0, 1);
  const normalized = {
    path: entry.path,
    label: entry.label,
    questionId: entry.questionId,
    questionNumber: entry.questionNumber,
    questionType: entry.questionType,
    parentQuestionId: entry.parentQuestionId,
    confidence: Math.max(0, Math.min(1, Number(rawFix?.confidence) || 0)),
    correctAnswer: answerKeys.has(correctAnswer) ? correctAnswer : "",
    questionText: stringValue(rawFix?.questionText).trim(),
    questionTextCn: stringValue(rawFix?.questionTextCn).trim(),
    explanation: stringValue(rawFix?.explanation).trim(),
    explanationCn: stringValue(rawFix?.explanationCn).trim(),
    note: stringValue(rawFix?.note).slice(0, 600),
    answers: [],
  };

  if (Array.isArray(rawFix?.answers)) {
    normalized.answers = rawFix.answers.map((answer) => {
      const key = stringValue(answer?.key).trim().toUpperCase().slice(0, 1);
      if (!answerKeys.has(key)) return null;
      return {
        key,
        text: stringValue(answer?.text).trim(),
        textCn: stringValue(answer?.textCn).trim(),
      };
    }).filter(Boolean);
  }

  return normalized;
}

async function generateReviewFixesWithAI(entries, reviews, context = {}) {
  const targets = getReviewFixTargetEntries(entries, reviews);
  if (!targets.length) {
    return {
      fixes: [],
      diagnostics: [{
        batch: 0,
        range: "Không có log lỗi",
        status: "no_questions",
        message: "Không có log lỗi cần AI sửa.",
      }],
      summary: { total: 0, fixed: 0, aiCalls: 0, failedBatches: 0, invalidBatches: 0, model: aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel },
    };
  }

  const fixes = [];
  const diagnostics = [];
  const batchSize = Math.max(1, Math.min(8, Number.parseInt(process.env.AI_EXAM_FIX_BATCH_SIZE || "4", 10)));

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const model = aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel;
    const startedAt = Date.now();
    try {
      const raw = await aiService.callBeeknoee(buildFixPrompt(batch, context), {
        model,
        temperature: 0.05,
        maxTokens: Number.parseInt(process.env.AI_EXAM_FIX_MAX_TOKENS || "4500", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_FIX_TIMEOUT_MS || "120000", 10),
      });
      const parsed = parseAiJson(raw);
      const batchFixes = Array.isArray(parsed?.fixes) ? parsed.fixes : [];
      diagnostics.push({
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: batchFixes.length ? "ok" : "invalid_response",
        durationMs: Date.now() - startedAt,
        returnedFixes: batchFixes.length,
        expectedFixes: batch.length,
        message: batchFixes.length
          ? `AI đã trả ${batchFixes.length}/${batch.length} bản sửa.`
          : "AI đã được gọi nhưng phản hồi không có JSON fixes hợp lệ.",
        rawPreview: batchFixes.length ? undefined : stringValue(raw).slice(0, 500),
      });

      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const fix = batchFixes.find((item) => item?.path === entry.path || item?.index === localIndex);
        if (fix) fixes.push(normalizeAiFix(fix, entry));
      }
    } catch (error) {
      const diagnostic = {
        batch: Math.floor(i / batchSize) + 1,
        range: getBatchLabelRange(batch),
        paths: batch.map(entry => entry.path),
        labels: batch.map(entry => entry.label),
        model,
        status: "failed",
        durationMs: Date.now() - startedAt,
        expectedFixes: batch.length,
        ...getReviewErrorDiagnostic(error),
      };
      diagnostics.push(diagnostic);
      console.warn("AI exam fix batch failed:", diagnostic);
    }
  }

  return {
    fixes,
    diagnostics,
    summary: {
      total: targets.length,
      fixed: fixes.length,
      aiCalls: diagnostics.filter(item => item.status === "ok" || item.status === "invalid_response").length,
      failedBatches: diagnostics.filter(item => item.status === "failed").length,
      invalidBatches: diagnostics.filter(item => item.status === "invalid_response").length,
      model: aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel,
    },
  };
}

function applyFixesToImportedItems(items, fixes = []) {
  const nextItems = JSON.parse(JSON.stringify(items || []));
  const changes = [];
  const skipped = [];

  const setField = (target, field, value, change) => {
    if (!value || target[field] === value) return;
    target[field] = value;
    changes.push(change);
  };

  for (const fix of fixes) {
    const parts = stringValue(fix.path).split(".");
    const itemIndex = Number.parseInt(parts[0], 10);
    const item = nextItems[itemIndex];
    if (!item) {
      skipped.push({ path: fix.path, reason: "Không tìm thấy mục import." });
      continue;
    }

    let target = item;
    if (parts[1] === "subQuestions") target = item.subQuestions?.[Number.parseInt(parts[2], 10)];
    if (parts[1] === "subItems") target = item.subItems?.[Number.parseInt(parts[2], 10)];
    if (!target) {
      skipped.push({ path: fix.path, reason: "Không tìm thấy câu cần sửa." });
      continue;
    }

    const beforeCount = changes.length;
    setField(target, "questionText", fix.questionText, { path: fix.path, field: "questionText" });
    setField(target, "questionTextCn", fix.questionTextCn, { path: fix.path, field: "questionTextCn" });
    setField(target, "explanation", fix.explanation, { path: fix.path, field: "explanation" });
    setField(target, "explanationCn", fix.explanationCn, { path: fix.path, field: "explanationCn" });

    if (fix.correctAnswer) {
      if (parts[1] === "subItems") {
        if (target.correctAnswerKey !== fix.correctAnswer) {
          target.correctAnswerKey = fix.correctAnswer;
          changes.push({ path: fix.path, field: "correctAnswerKey", after: fix.correctAnswer });
        }
      } else if (target.correctAnswer !== fix.correctAnswer) {
        target.correctAnswer = fix.correctAnswer;
        changes.push({ path: fix.path, field: "correctAnswer", after: fix.correctAnswer });
      }
    }

    if (Array.isArray(fix.answers) && fix.answers.length) {
      const answerTarget = parts[1] === "subItems" ? item.linkedOptions : target.answers;
      if (Array.isArray(answerTarget)) {
        for (const answerFix of fix.answers) {
          const answer = answerTarget.find((entry) => entry.key === answerFix.key);
          if (!answer) continue;
          setField(answer, "text", answerFix.text, { path: fix.path, field: `answers.${answerFix.key}.text` });
          setField(answer, "textCn", answerFix.textCn, { path: fix.path, field: `answers.${answerFix.key}.textCn` });
        }
      }
    }

    if (changes.length > beforeCount) {
      target.aiReview = {
        ...(target.aiReview || {}),
        status: "ok",
        confidence: fix.confidence || target.aiReview?.confidence || 0,
        note: fix.note || "Đã áp dụng AI sửa toàn bộ log.",
      };
      target.reviewNotes = [target.reviewNotes, `Đã áp dụng AI sửa: ${fix.note || "cập nhật theo log."}`]
        .filter(Boolean)
        .join("\n");
    } else {
      skipped.push({ path: fix.path, reason: fix.note || "AI không trả field có thể áp dụng." });
    }
  }

  return {
    items: nextItems,
    changedCount: changes.length,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
  };
}

async function applyImportedReviewFixesWithAI(items, reviews = [], context = {}) {
  const entries = collectImportedQuestions(items);
  const generated = await generateReviewFixesWithAI(entries, reviews, context);
  const applied = applyFixesToImportedItems(items, generated.fixes);

  return {
    ...applied,
    fixes: generated.fixes,
    diagnostics: generated.diagnostics,
    summary: {
      ...generated.summary,
      changedCount: applied.changedCount,
      skippedCount: applied.skippedCount,
    },
    message: `AI đã sửa ${applied.changedCount} chỗ trong bản import.`,
  };
}

function normalizeReviewAnswers(question) {
  const answers = Array.isArray(question.answers) ? question.answers.filter(Boolean) : [];
  const linkedOptions = parseJsonValue(question.effective_linked_options || question.linked_options, []);
  if (
    question.question_type === "fill_blank_item" &&
    Array.isArray(linkedOptions) &&
    linkedOptions.length
  ) {
    return linkedOptions.map((option, index) => ({
      key: option?.key || ANSWER_KEYS[index],
      text: option?.text || option?.answer_text || "",
      textCn: option?.textCn || option?.text_cn || option?.answer_text_cn || "",
      imageUrl: option?.imageUrl || option?.image_url || "",
    }));
  }

  return answers.map((answer, index) => ({
    key: answer?.answer_key || answer?.key || ANSWER_KEYS[index],
    text: answer?.answer_text || answer?.text || "",
    textCn: answer?.answer_text_cn || answer?.textCn || "",
    imageUrl: answer?.image_url || answer?.imageUrl || "",
  }));
}

function getCurrentCorrectAnswer(question) {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const correct = answers.find((answer) => answer?.is_correct);
  return stringValue(correct?.answer_key || correct?.key).toUpperCase().slice(0, 1);
}

async function loadStoredExamReviewEntries(client, examId) {
  const examResult = await client.query(
    `SELECT e.id, e.title, s.name as subject_name, s.code as subject_code
     FROM exams e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.id = $1 AND e.deleted_at IS NULL
     LIMIT 1`,
    [examId],
  );

  if (!examResult.rows.length) {
    const error = new Error("EXAM_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const questionsResult = await client.query(
    `SELECT
       q.id,
       q.question_number,
       q.question_type,
       q.question_text,
       q.question_text_cn,
       q.image_url,
       q.explanation,
       q.explanation_cn,
       q.explanation_image_url,
       q.passage_text,
       q.passage_image_url,
       q.linked_options,
       q.sub_question_number,
       q.passage_group_id,
       COALESCE(
         q.linked_options,
         (SELECT linked_options FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.question_type = 'fill_blank_pool')
       ) as effective_linked_options,
       COALESCE(
         q.passage_text,
         (SELECT passage_text FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_text IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_text,
       COALESCE(
         q.passage_image_url,
         (SELECT passage_image_url FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_image_url IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_image_url,
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
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.exam_id = $1
       AND q.deleted_at IS NULL
       AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
     GROUP BY q.id
     ORDER BY q.question_number, q.id`,
    [examId],
  );

  const entries = questionsResult.rows.map((question) => {
    const questionNumber = question.sub_question_number || question.question_number;
    return {
      path: `question:${question.id}`,
      label: `Câu ${questionNumber}`,
      kind: "stored",
      questionId: question.id,
      questionNumber,
      questionType: question.question_type,
      parentQuestionId: question.passage_group_id || undefined,
      contextText: question.effective_passage_text || question.passage_text || "",
      contextImageUrl: question.effective_passage_image_url || question.passage_image_url || "",
      question: {
        questionText: question.question_text || "",
        questionTextCn: question.question_text_cn || "",
        imageUrl: question.image_url || "",
        answers: normalizeReviewAnswers(question),
        correctAnswer: getCurrentCorrectAnswer(question),
        explanation: question.explanation || "",
        explanationCn: question.explanation_cn || "",
        explanationImageUrl: question.explanation_image_url || "",
      },
    };
  });

  return { exam: examResult.rows[0], entries };
}

function getSuggestedAnswerKey(review) {
  const answer = stringValue(review?.suggestedCorrectAnswer).trim().toUpperCase().slice(0, 1);
  return ANSWER_KEYS.includes(answer) ? answer : "";
}

async function applySuggestedAnswerFixes(client, examId, reviews = []) {
  const answerChanges = [];
  const skipped = [];
  const seenQuestions = new Set();

  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review || review.status === "ok") continue;

    const questionId = Number.parseInt(review.questionId, 10);
    const confidence = Math.max(0, Math.min(1, Number(review.confidence) || 0));
    const suggestedAnswer = getSuggestedAnswerKey(review);

    if (!questionId || seenQuestions.has(questionId)) continue;
    seenQuestions.add(questionId);

    if (!suggestedAnswer) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        reason: "AI chưa đưa đáp án gợi ý rõ ràng.",
      });
      continue;
    }

    if (confidence < REVIEW_APPLY_MIN_CONFIDENCE) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        suggestedAnswer,
        confidence,
        reason: `Độ tin cậy dưới ${Math.round(REVIEW_APPLY_MIN_CONFIDENCE * 100)}%.`,
      });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({
        questionId,
        questionNumber: review.questionNumber,
        suggestedAnswer,
        reason: "Câu không còn thuộc đề này.",
      });
      continue;
    }

    const answersResult = await client.query(
      `SELECT id, answer_key, is_correct
       FROM answers
       WHERE question_id = $1
       ORDER BY answer_key`,
      [questionId],
    );
    const answers = answersResult.rows;
    const targetAnswer = answers.find((answer) => answer.answer_key === suggestedAnswer);
    if (!targetAnswer) {
      skipped.push({
        questionId,
        questionNumber: question.question_number,
        suggestedAnswer,
        reason: "Không tìm thấy lựa chọn này trong câu.",
      });
      continue;
    }

    const currentAnswer = answers.find((answer) => answer.is_correct)?.answer_key || "";
    if (currentAnswer === suggestedAnswer) {
      continue;
    }

    await client.query(
      `UPDATE answers
       SET is_correct = (answer_key = $2)
       WHERE question_id = $1`,
      [questionId, suggestedAnswer],
    );
    answerChanges.push({
      questionId,
      questionNumber: question.question_number,
      before: currentAnswer,
      after: suggestedAnswer,
      confidence,
    });
  }

  if (answerChanges.length) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return { answerChanges, skipped };
}

async function applyExamReviewFixes(client, examId, reviews = [], options = {}) {
  const applySafeFormulas = options.applySafeFormulas !== false;
  const { exam, entries } = await loadStoredExamReviewEntries(client, examId);
  const generated = await generateReviewFixesWithAI(entries, reviews, {
    subject: options.subject || exam.subject_name || exam.subject_code || "CSCA",
  });

  const changes = [];
  const skipped = [];

  for (const fix of generated.fixes) {
    const questionId = Number.parseInt(fix.questionId, 10);
    if (!questionId) {
      skipped.push({ path: fix.path, reason: "AI không trả questionId hợp lệ." });
      continue;
    }

    const questionResult = await client.query(
      `SELECT id, question_number
       FROM questions
       WHERE id = $1 AND exam_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [questionId, examId],
    );
    const question = questionResult.rows[0];
    if (!question) {
      skipped.push({ path: fix.path, questionId, reason: "Câu không còn thuộc đề này." });
      continue;
    }

    const fields = [];
    const params = [];
    const addField = (column, value) => {
      if (!value) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
      changes.push({ questionId, questionNumber: question.question_number, field: column });
    };

    addField("question_text", fix.questionText);
    addField("question_text_cn", fix.questionTextCn);
    addField("explanation", fix.explanation);
    addField("explanation_cn", fix.explanationCn);

    if (fields.length) {
      params.push(questionId);
      await client.query(
        `UPDATE questions SET ${fields.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }

    const answersResult = await client.query(
      `SELECT id, answer_key, is_correct
       FROM answers
       WHERE question_id = $1
       ORDER BY answer_key`,
      [questionId],
    );
    const answerKeys = new Set(answersResult.rows.map((answer) => answer.answer_key));

    if (fix.correctAnswer) {
      if (answerKeys.has(fix.correctAnswer)) {
        const currentAnswer = answersResult.rows.find((answer) => answer.is_correct)?.answer_key || "";
        if (currentAnswer !== fix.correctAnswer) {
          await client.query(
            `UPDATE answers
             SET is_correct = (answer_key = $2)
             WHERE question_id = $1`,
            [questionId, fix.correctAnswer],
          );
          changes.push({
            questionId,
            questionNumber: question.question_number,
            field: "correct_answer",
            before: currentAnswer,
            after: fix.correctAnswer,
          });
        }
      } else {
        skipped.push({
          path: fix.path,
          questionId,
          suggestedAnswer: fix.correctAnswer,
          reason: "Đáp án AI trả không có trong lựa chọn hiện tại.",
        });
      }
    }

    if (Array.isArray(fix.answers)) {
      for (const answerFix of fix.answers) {
        if (!answerKeys.has(answerFix.key)) continue;
        const updateFields = [];
        const updateParams = [];
        if (answerFix.text) {
          updateParams.push(answerFix.text);
          updateFields.push(`answer_text = $${updateParams.length}`);
        }
        if (answerFix.textCn) {
          updateParams.push(answerFix.textCn);
          updateFields.push(`answer_text_cn = $${updateParams.length}`);
        }
        if (!updateFields.length) continue;

        updateParams.push(questionId, answerFix.key);
        await client.query(
          `UPDATE answers SET ${updateFields.join(", ")}
           WHERE question_id = $${updateParams.length - 1} AND answer_key = $${updateParams.length}`,
          updateParams,
        );
        changes.push({
          questionId,
          questionNumber: question.question_number,
          answerKey: answerFix.key,
          field: "answer_text",
        });
      }
    }
  }

  const formulaResult = applySafeFormulas
    ? await normalizeExamFormulas(client, examId, { apply: true })
    : null;

  if (changes.length || formulaResult?.changedCount) {
    await client.query("UPDATE exams SET updated_at = NOW() WHERE id = $1", [examId]);
  }

  return {
    examId: Number(examId),
    message: `AI đã sửa ${changes.length} chỗ theo log và ${formulaResult?.changedCount || 0} chỗ công thức chắc chắn.`,
    changedCount: changes.length,
    answerChangedCount: changes.filter(change => change.field === "correct_answer").length,
    formulaChangedCount: formulaResult?.changedCount || 0,
    warningCount: formulaResult?.warningCount || 0,
    skippedCount: skipped.length,
    changes: changes.slice(0, 100),
    skipped: skipped.slice(0, 100),
    fixes: generated.fixes,
    diagnostics: generated.diagnostics,
    summary: generated.summary,
    formulaResult,
  };
}

async function reviewStoredExamWithAI(client, examId, context = {}) {
  const examResult = await client.query(
    `SELECT e.id, e.title, s.name as subject_name, s.code as subject_code
     FROM exams e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.id = $1 AND e.deleted_at IS NULL
     LIMIT 1`,
    [examId],
  );

  if (!examResult.rows.length) {
    const error = new Error("EXAM_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const questionsResult = await client.query(
    `SELECT
       q.id,
       q.question_number,
       q.question_type,
       q.question_text,
       q.question_text_cn,
       q.image_url,
       q.explanation,
       q.explanation_cn,
       q.explanation_image_url,
       q.passage_text,
       q.passage_image_url,
       q.linked_options,
       q.sub_question_number,
       q.passage_group_id,
       COALESCE(
         q.linked_options,
         (SELECT linked_options FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.question_type = 'fill_blank_pool')
       ) as effective_linked_options,
       COALESCE(
         q.passage_text,
         (SELECT passage_text FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_text IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_text,
       COALESCE(
         q.passage_image_url,
         (SELECT passage_image_url FROM questions parent
          WHERE parent.id = q.passage_group_id
            AND parent.passage_image_url IS NOT NULL
          ORDER BY parent.id LIMIT 1)
       ) as effective_passage_image_url,
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
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.exam_id = $1
       AND q.deleted_at IS NULL
       AND q.question_type NOT IN ('reading_passage', 'fill_blank_pool')
     GROUP BY q.id
     ORDER BY q.question_number, q.id`,
    [examId],
  );

  const entries = questionsResult.rows.map((question) => {
    const questionNumber = question.sub_question_number || question.question_number;
    return {
      path: `question:${question.id}`,
      label: `Câu ${questionNumber}`,
      kind: "stored",
      questionId: question.id,
      questionNumber,
      questionType: question.question_type,
      parentQuestionId: question.passage_group_id || undefined,
      contextText: question.effective_passage_text || question.passage_text || "",
      contextImageUrl: question.effective_passage_image_url || question.passage_image_url || "",
      question: {
        questionText: question.question_text || "",
        questionTextCn: question.question_text_cn || "",
        imageUrl: question.image_url || "",
        answers: normalizeReviewAnswers(question),
        correctAnswer: getCurrentCorrectAnswer(question),
        explanation: question.explanation || "",
        explanationCn: question.explanation_cn || "",
        explanationImageUrl: question.explanation_image_url || "",
      },
    };
  });

  const exam = examResult.rows[0];
  const result = await reviewQuestionEntriesWithAI(entries, {
    ...context,
    subject: context.subject || exam.subject_name || exam.subject_code || "CSCA",
  });
  const safeFixPreview = await normalizeExamFormulas(client, examId, { apply: false });

  return {
    examId: Number(examId),
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subject_name,
      subjectCode: exam.subject_code,
    },
    ...result,
    safeFixPreview,
  };
}

module.exports = {
  normalizeExamFormulas,
  normalizeField,
  normalizeStoredFormulaText,
  applyExamReviewFixes,
  applyImportedReviewFixesWithAI,
  reviewStoredExamWithAI,
  reviewImportedItemsWithAI,
};
