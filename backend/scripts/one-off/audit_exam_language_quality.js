"use strict";

const path = require("path");
const { pool } = require("../../src/config/database");
const { normalizeExamFormulas } = require("../../src/services/examQualityService");

let katex = null;
try {
  katex = require(path.resolve(__dirname, "../../../frontend/node_modules/katex"));
} catch (_) {
  // The structural audit remains usable when frontend dependencies are absent.
}

const target = process.argv[2];
if (!target) throw new Error("Usage: node audit_exam_language_quality.js <exam-id-or-title>");

const hasChinese = (value) => /[\u3400-\u9fff]/u.test(value || "");
const isBlank = (value) => !String(value || "").trim();
const countToken = (value, token) => String(value || "").split(token).length - 1;

function renderIssues(value) {
  const text = String(value || "");
  const issues = [];
  if (!text) return issues;
  const proseOnly = text
    .replace(/\\\[([\s\S]*?)\\\]/g, "")
    .replace(/\\\(([\s\S]*?)\\\)/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "")
    .replace(/\$([^$\n]*?)\$/g, "");
  if (/\[Equation\]/i.test(text)) issues.push("equation_placeholder");
  if (/\\(?:le|rig)\s+(?:ft|ht)\b/.test(text)) issues.push("split_latex_command");
  if (/<\/?[A-Za-z][^>]*>/.test(proseOnly)) issues.push("raw_html");
  if (/\uFFFD/u.test(text)) issues.push("replacement_character");
  if (countToken(text, "\\(") !== countToken(text, "\\)")) issues.push("unbalanced_inline_math");
  if (countToken(text, "\\[") !== countToken(text, "\\]")) issues.push("unbalanced_display_math");
  if (countToken(text, "\\begin{") !== countToken(text, "\\end{")) issues.push("unbalanced_environment");
  if (/(?<!\\)\$/.test(text)) issues.push("raw_dollar_math");
  return issues;
}

function validateMathSegments(value) {
  const text = String(value || "");
  const results = [];
  const pattern = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]*?)\$/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const formula = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    const displayMode = match[1] !== undefined || match[3] !== undefined;
    if (!formula.trim()) {
      results.push({ formula, error: "empty_math_segment" });
      continue;
    }
    if (!katex) continue;
    try {
      katex.renderToString(formula.trim(), {
        displayMode,
        throwOnError: true,
        strict: false,
        trust: false,
      });
    } catch (error) {
      results.push({ formula: formula.slice(0, 300), error: error.message });
    }
  }
  return results;
}

async function main() {
  const examResult = await pool.query(
    `SELECT e.id, e.code, e.title, e.title_cn, e.language_mode,
            e.explanation_language_mode, e.is_premium, e.vip_tier, e.status,
            s.code AS subject_code, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON s.id = e.subject_id
     WHERE e.deleted_at IS NULL
       AND (e.id::text = $1 OR lower(e.title) = lower($1) OR lower(e.code) = lower($1))
     ORDER BY e.id
     LIMIT 1`,
    [target],
  );
  if (!examResult.rows.length) throw new Error(`Exam not found: ${target}`);

  const exam = examResult.rows[0];
  const questionResult = await pool.query(
    `SELECT q.id, q.question_number, q.question_type,
            q.question_text, q.question_text_cn, q.question_text_en,
            q.explanation, q.explanation_cn, q.explanation_en,
            q.image_url, q.explanation_image_url,
            COALESCE(json_agg(json_build_object(
              'key', a.answer_key,
              'vi', a.answer_text,
              'cn', a.answer_text_cn,
              'en', a.answer_text_en,
              'correct', a.is_correct
            ) ORDER BY a.answer_key) FILTER (WHERE a.id IS NOT NULL), '[]') AS answers
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
     GROUP BY q.id
     ORDER BY q.question_number`,
    [exam.id],
  );

  const fields = ["question_text", "question_text_cn", "question_text_en", "explanation", "explanation_cn", "explanation_en"];
  const missing = Object.fromEntries(fields.map((field) => [field, 0]));
  const missingQuestions = Object.fromEntries(fields.map((field) => [field, []]));
  const noChinese = { question_text_cn: [], explanation_cn: [], answer_text_cn: [] };
  const render = [];
  const mathRender = [];
  let mathSegmentCount = 0;
  const answerProblems = [];

  for (const question of questionResult.rows) {
    for (const field of fields) {
      if (isBlank(question[field])) {
        missing[field] += 1;
        missingQuestions[field].push(question.question_number);
      }
      const issues = renderIssues(question[field]);
      if (issues.length) render.push({
        question: question.question_number,
        field,
        issues,
        value: String(question[field] || "").slice(0, 500),
      });
      const mathIssues = validateMathSegments(question[field]);
      mathSegmentCount += (String(question[field] || "").match(/\\\[|\\\(|\$\$|\$(?!\$)/g) || []).length;
      if (mathIssues.length) mathRender.push({ question: question.question_number, field, issues: mathIssues });
    }
    if (!isBlank(question.question_text_cn) && !hasChinese(question.question_text_cn)) {
      noChinese.question_text_cn.push(question.question_number);
    }
    if (!isBlank(question.explanation_cn) && !hasChinese(question.explanation_cn)) {
      noChinese.explanation_cn.push(question.question_number);
    }

    const answers = Array.isArray(question.answers) ? question.answers : [];
    const correct = answers.filter((answer) => answer.correct === true);
    if (answers.length < 2 || correct.length !== 1) {
      answerProblems.push({ question: question.question_number, answerCount: answers.length, correctCount: correct.length });
    }
    for (const answer of answers) {
      if (!isBlank(answer.cn) && !hasChinese(answer.cn) && !/^\s*[A-H]\s*$/u.test(answer.cn)) {
        noChinese.answer_text_cn.push(`${question.question_number}${answer.key}`);
      }
      for (const [field, value] of [["answer_text", answer.vi], ["answer_text_cn", answer.cn], ["answer_text_en", answer.en]]) {
        const issues = renderIssues(value);
        if (issues.length) render.push({ question: question.question_number, answer: answer.key, field, issues });
        const mathIssues = validateMathSegments(value);
        mathSegmentCount += (String(value || "").match(/\\\[|\\\(|\$\$|\$(?!\$)/g) || []).length;
        if (mathIssues.length) mathRender.push({ question: question.question_number, answer: answer.key, field, issues: mathIssues });
      }
    }
  }

  const formulaPreview = await normalizeExamFormulas(pool, exam.id, { apply: false });
  console.log(JSON.stringify({
    exam,
    questionCount: questionResult.rowCount,
    missing,
    missingQuestions,
    noChinese: {
      question_text_cn: noChinese.question_text_cn,
      explanation_cn: noChinese.explanation_cn,
      answer_text_cn_count: noChinese.answer_text_cn.length,
      answer_text_cn_sample: noChinese.answer_text_cn.slice(0, 20),
    },
    answerProblems,
    renderIssues: render,
    katexAvailable: Boolean(katex),
    mathSegmentCount,
    mathRenderIssues: mathRender,
    safeFormulaChangeCount: formulaPreview.changedCount || formulaPreview.changes?.length || 0,
    safeFormulaWarningCount: formulaPreview.warningCount || formulaPreview.warnings?.length || 0,
    samples: questionResult.rows.slice(0, 3).map((question) => ({
      question: question.question_number,
      vi: question.question_text,
      cn: question.question_text_cn,
      en: question.question_text_en,
      explanationVi: question.explanation,
      explanationCn: question.explanation_cn,
      explanationEn: question.explanation_en,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
