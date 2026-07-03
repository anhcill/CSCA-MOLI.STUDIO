"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client } = require("pg");

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const r = await c.query(
    `SELECT q.question_number, LEFT(q.question_text, 120) as qt, LEFT(q.explanation, 120) as ex,
            (SELECT a.answer_key FROM answers a WHERE a.question_id = q.id AND a.is_correct = true LIMIT 1) as correct
     FROM questions q
     WHERE q.exam_id = 146 AND q.question_number > 0 AND q.deleted_at IS NULL
     ORDER BY q.question_number`
  );

  let eqCount = 0;
  for (const row of r.rows) {
    const hasEq = (row.qt || "").includes("[Equation]") || (row.ex || "").includes("[Equation]");
    if (hasEq) eqCount++;
    const flag = hasEq ? " ⚠[Eq]" : " ✅";
    console.log(`Q${row.question_number} [${row.correct || "?"}]${flag} | ${(row.qt || "").slice(0, 90)}`);
  }

  // Count [Equation] occurrences in all question text and answers
  const fullR = await c.query(
    `SELECT q.question_number, q.question_text, q.explanation,
            (SELECT string_agg(a.answer_text, '|||') FROM answers a WHERE a.question_id = q.id) as all_answers
     FROM questions q
     WHERE q.exam_id = 146 AND q.question_number > 0 AND q.deleted_at IS NULL
     ORDER BY q.question_number`
  );

  let totalEqInQuestions = 0;
  let totalEqInExplanations = 0;
  let totalEqInAnswers = 0;
  for (const row of fullR.rows) {
    totalEqInQuestions += ((row.question_text || "").match(/\[Equation\]/g) || []).length;
    totalEqInExplanations += ((row.explanation || "").match(/\[Equation\]/g) || []).length;
    totalEqInAnswers += ((row.all_answers || "").match(/\[Equation\]/g) || []).length;
  }

  console.log(`\nTotal: ${r.rows.length} questions, ${eqCount} with [Equation] placeholders`);
  console.log(`[Equation] counts: ${totalEqInQuestions} in questions, ${totalEqInExplanations} in explanations, ${totalEqInAnswers} in answers`);

  await c.end();
})();
