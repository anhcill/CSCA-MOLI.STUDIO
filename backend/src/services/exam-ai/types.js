const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const REVIEW_STATUSES = [
  "ok",
  "question_issue",
  "formula_issue",
  "answer_issue",
  "explanation_issue",
  "needs_review",
  "missing_from_db",
  "missing_answer_from_source",
  "source_mismatch",
  "needs_source_review",
];

const SOURCE_REVIEW_STATUSES = [
  "missing_from_db",
  "missing_answer_from_source",
  "source_mismatch",
  "needs_source_review",
];

const SOURCE_FILE_TEXT_LIMIT = Math.max(
  2000,
  Math.min(200000, Number.parseInt(process.env.ADMIN_EXAM_SOURCE_FILE_TEXT_LIMIT || "120000", 10) || 120000),
);

const SOURCE_PROMPT_TEXT_LIMIT = Math.max(
  2000,
  Math.min(30000, Number.parseInt(process.env.AI_EXAM_SOURCE_PROMPT_TEXT_LIMIT || "12000", 10) || 12000),
);

module.exports = {
  ANSWER_KEYS,
  REVIEW_STATUSES,
  SOURCE_REVIEW_STATUSES,
  SOURCE_FILE_TEXT_LIMIT,
  SOURCE_PROMPT_TEXT_LIMIT,
};
