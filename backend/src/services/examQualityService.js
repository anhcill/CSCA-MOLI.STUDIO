const aiConfig = require("../config/aiConfig");
const aiService = require("./aiService");
const { repairOcrMathArtifacts } = require("./ocrMathRepairService");

const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const REVIEW_BATCH_SIZE = Number.parseInt(process.env.AI_EXAM_REVIEW_BATCH_SIZE || "6", 10);
const REVIEW_MAX_ITEMS = Number.parseInt(process.env.AI_EXAM_REVIEW_MAX_ITEMS || "120", 10);

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
        `UPDATE questions SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
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
      questionText: q.questionText || "",
      questionTextCn: q.questionTextCn || "",
      answers: (q.answers || []).map((answer, answerIndex) => ({
        key: answer.key || ANSWER_KEYS[answerIndex],
        text: answer.text || answer.answer_text || "",
        textCn: answer.textCn || answer.answer_text_cn || "",
      })),
      currentCorrectAnswer: q.correctAnswer || q.correctAnswerKey || "",
      explanation: q.explanation || "",
      explanationCn: q.explanationCn || "",
    };
  });

  return `Bạn là giáo viên soát đề CSCA. Hãy giải lại từng câu từ đầu, không tin đáp án/lời giải cũ.

Yêu cầu:
- Chỉ trả JSON hợp lệ, không markdown.
- Không tự sửa nội dung đề trong JSON.
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
    status: "needs_review",
    confidence: 0,
    suggestedCorrectAnswer: "",
    formulaIssues: [],
    explanationIssues: [],
    note,
  };
}

async function reviewImportedItemsWithAI(items, context = {}) {
  const entries = collectImportedQuestions(items);
  if (!entries.length) {
    return { items, summary: { total: 0, ok: 0, issues: 0 }, reviews: [] };
  }

  const reviews = [];
  const batchSize = Math.max(1, Math.min(12, REVIEW_BATCH_SIZE || 6));
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    try {
      const raw = await aiService.callBeeknoee(buildReviewPrompt(batch, context), {
        model: aiConfig.beeknoee.reviewModel || aiConfig.beeknoee.importModel,
        temperature: 0.1,
        maxTokens: Number.parseInt(process.env.AI_EXAM_REVIEW_MAX_TOKENS || "3000", 10),
        timeout: Number.parseInt(process.env.AI_EXAM_REVIEW_TIMEOUT_MS || "90000", 10),
      });
      const parsed = parseAiJson(raw);
      const batchReviews = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
      for (const entry of batch) {
        const localIndex = batch.indexOf(entry);
        const review = batchReviews.find((item) => item?.path === entry.path || item?.index === localIndex);
        if (!review) {
          reviews.push(buildFallbackReview(entry, "AI không trả review cho câu này."));
          continue;
        }
        reviews.push({
          path: entry.path,
          label: entry.label,
          status: normalizeReviewStatus(review.status),
          confidence: Math.max(0, Math.min(1, Number(review.confidence) || 0)),
          suggestedCorrectAnswer: stringValue(review.suggestedCorrectAnswer).toUpperCase().slice(0, 1),
          formulaIssues: Array.isArray(review.formulaIssues) ? review.formulaIssues.map(stringValue).filter(Boolean) : [],
          explanationIssues: Array.isArray(review.explanationIssues) ? review.explanationIssues.map(stringValue).filter(Boolean) : [],
          note: stringValue(review.note).slice(0, 600),
        });
      }
    } catch (error) {
      for (const entry of batch) {
        reviews.push(buildFallbackReview(entry, error.message === "RATE_LIMITED" ? "AI đang bị giới hạn, thử lại sau." : "AI review lỗi, cần chạy lại."));
      }
    }
  }

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

  const counts = reviews.reduce((acc, review) => {
    acc.total += 1;
    if (review.status === "ok") acc.ok += 1;
    else acc.issues += 1;
    acc[review.status] = (acc[review.status] || 0) + 1;
    return acc;
  }, { total: 0, ok: 0, issues: 0 });

  return {
    items: nextItems,
    reviews,
    summary: counts,
  };
}

module.exports = {
  normalizeExamFormulas,
  normalizeField,
  normalizeStoredFormulaText,
  reviewImportedItemsWithAI,
};
