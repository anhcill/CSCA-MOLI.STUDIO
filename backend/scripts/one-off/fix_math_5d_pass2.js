"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client } = require("pg");

const EXAM_ID = 146;

// Additional LaTeX fixes after initial pass
function fixLatexPass2(text) {
  if (!text) return text;

  // Fix missing space after \setminus and other commands before letters/braces
  text = text.replace(/\\setminus([A-Za-z{])/g, "\\setminus $1");

  // Fix \le, \ge, etc. missing space before next char
  text = text.replace(/(\\(?:le|ge|neq|approx|infty|in|notin|to|perp|cdot|pm|cup|cap|subset|supset|times|div|wedge|vee)\s?)([A-Za-z0-9{\\])/g, (m, cmd, next) => {
    if (cmd.endsWith(" ")) return m;
    return cmd + " " + next;
  });

  // Fix \\log_{2} should be \log_{2} (already correct)
  // But fix cases like "log_{2}" without backslash inside math
  text = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (mathBlock) => {
    // Fix \sin\alpha → \sin \alpha (space after trig functions before backslash)
    mathBlock = mathBlock.replace(/(\\(?:sin|cos|tan|cot|log|ln|lim|max|min))(\\)/g, "$1 $2");
    
    // Fix empty braces like ^{} or _{}
    // Don't touch these - they might be intentional
    
    // Fix double spaces
    mathBlock = mathBlock.replace(/\s{2,}/g, " ");
    
    return mathBlock;
  });

  return text;
}

async function main() {
  console.log("Pass 2: Additional LaTeX fixes for MATH_5D");
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const cols = [
      { table: "questions", idCol: "id", textCols: ["question_text", "question_text_cn", "question_text_en", "explanation", "explanation_cn", "explanation_en"],
        where: "exam_id = $1 AND question_number > 0 AND deleted_at IS NULL" },
      { table: "answers", idCol: "a.id", textCols: ["answer_text", "answer_text_cn", "answer_text_en"],
        where: null }
    ];

    await client.query("BEGIN");

    // Fix questions
    const qr = await client.query(
      `SELECT id, question_number, question_text, question_text_cn, question_text_en, explanation, explanation_cn, explanation_en
       FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL ORDER BY question_number`,
      [EXAM_ID]
    );

    let fixCount = 0;
    for (const q of qr.rows) {
      const fixes = {};
      for (const col of ["question_text", "question_text_cn", "question_text_en", "explanation", "explanation_cn", "explanation_en"]) {
        if (!q[col]) continue;
        const fixed = fixLatexPass2(q[col]);
        if (fixed !== q[col]) fixes[col] = fixed;
      }
      if (Object.keys(fixes).length > 0) {
        const setClauses = Object.keys(fixes).map((c, i) => `${c} = $${i + 2}`);
        await client.query(`UPDATE questions SET ${setClauses.join(", ")} WHERE id = $1`, [q.id, ...Object.values(fixes)]);
        fixCount++;
        console.log(`  ✏️ Q${q.question_number}: ${Object.keys(fixes).join(", ")}`);
      }
    }

    // Fix answers
    const ar = await client.query(
      `SELECT a.id, a.answer_text, a.answer_text_cn, a.answer_text_en, q.question_number, a.answer_key
       FROM answers a JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       ORDER BY q.question_number, a.answer_key`,
      [EXAM_ID]
    );

    let ansFixCount = 0;
    for (const a of ar.rows) {
      const fixes = {};
      for (const col of ["answer_text", "answer_text_cn", "answer_text_en"]) {
        if (!a[col]) continue;
        const fixed = fixLatexPass2(a[col]);
        if (fixed !== a[col]) fixes[col] = fixed;
      }
      if (Object.keys(fixes).length > 0) {
        const setClauses = Object.keys(fixes).map((c, i) => `${c} = $${i + 2}`);
        await client.query(`UPDATE answers SET ${setClauses.join(", ")} WHERE id = $1`, [a.id, ...Object.values(fixes)]);
        ansFixCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`\n✅ Pass 2 complete: ${fixCount} questions, ${ansFixCount} answers fixed`);

    // Final verification
    console.log("\n─── Final Verification ─────────────────────────────────");
    const verify = await client.query(
      `SELECT q.question_number, q.question_text, q.explanation,
              (SELECT a.answer_key FROM answers a WHERE a.question_id = q.id AND a.is_correct = true LIMIT 1) as correct
       FROM questions q
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       ORDER BY q.question_number`,
      [EXAM_ID]
    );

    let issues = 0;
    for (const row of verify.rows) {
      const problems = [];
      const fullText = (row.question_text || "") + (row.explanation || "");
      
      if (!row.correct) problems.push("NO_CORRECT_ANSWER");
      
      // Check \( \) balance
      const io = (fullText.match(/\\\(/g) || []).length;
      const ic = (fullText.match(/\\\)/g) || []).length;
      if (io !== ic) problems.push(`\\( balance: ${io}/${ic}`);
      
      // Check { } balance inside math
      const bo = (fullText.match(/{/g) || []).length;
      const bc = (fullText.match(/}/g) || []).length;
      if (bo !== bc) problems.push(`brace balance: ${bo}/${bc}`);
      
      // Check for $
      if (/(?<!\\)\$/.test(fullText)) problems.push("raw $");
      
      // Check for common broken patterns
      if (/\\[a-z]+[A-Z]/.test(fullText) && !/\\mathbb|\\sqrt|\\frac|\\left|\\right|\\overrightarrow|\\varnothing|\\varphi|\\varepsilon/.test(fullText.match(/\\[a-z]+[A-Z]/)?.[0] || "")) {
        const match = fullText.match(/\\[a-z]+[A-Z][a-z]*/);
        if (match && !/\\mathbb|\\varnothing|\\varphi|\\varepsilon|\\Rightarrow|\\Leftrightarrow|\\Delta|\\Omega/.test(match[0])) {
          problems.push(`possible missing space: ${match[0]}`);
        }
      }
      
      if (problems.length > 0) {
        issues++;
        console.log(`  Q${row.question_number} [${row.correct || "?"}]: ${problems.join("; ")}`);
      }
    }
    
    if (issues === 0) {
      console.log("  ✅ All 48 questions pass verification!");
    } else {
      console.log(`\n  ⚠ ${issues} question(s) have remaining issues`);
    }

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
