"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client } = require("pg");

/**
 * Fix math delimiters and LaTeX rendering issues for MATH_5D exam (id=146).
 * 
 * Problems to fix:
 * 1. $...$ → \(...\) inline math delimiters
 * 2. $$...$$ → \[...\] display math delimiters
 * 3. Unicode math symbols → LaTeX commands (≤ → \le, etc.)
 * 4. \sqrt[] → \sqrt (empty optional arg)
 * 5. log → \log, sin → \sin, etc.
 * 6. Extra spaces in LaTeX commands
 */

const EXAM_ID = 146;

// ── LaTeX fixes ─────────────────────────────────────────────────────────

function fixDollarDelimiters(text) {
  if (!text) return text;

  // First handle display math $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\\[${math.trim()}\\]`);

  // Then handle inline math $...$
  // Match $ ... $ but not escaped \$
  text = text.replace(/(?<![\\])\$((?:[^$\\]|\\.)+?)\$/g, (_, math) => `\\(${math.trim()}\\)`);

  return text;
}

function fixUnicodeSymbols(text) {
  if (!text) return text;

  const replacements = [
    [/≤/g, "\\le "],
    [/≥/g, "\\ge "],
    [/≠/g, "\\neq "],
    [/≈/g, "\\approx "],
    [/∞/g, "\\infty "],
    [/∈/g, "\\in "],
    [/∉/g, "\\notin "],
    [/∅/g, "\\varnothing "],
    [/→/g, "\\to "],
    [/⇒/g, "\\Rightarrow "],
    [/⇔/g, "\\Leftrightarrow "],
    [/⊥/g, "\\perp "],
    [/⋅/g, "\\cdot "],
    [/±/g, "\\pm "],
    [/∀/g, "\\forall "],
    [/∃/g, "\\exists "],
    [/∪/g, "\\cup "],
    [/∩/g, "\\cap "],
    [/⊂/g, "\\subset "],
    [/⊃/g, "\\supset "],
    [/∧/g, "\\wedge "],
    [/∨/g, "\\vee "],
    [/×/g, "\\times "],
    [/÷/g, "\\div "],
  ];

  // Only replace inside math delimiters
  text = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (mathBlock) => {
    for (const [pattern, replacement] of replacements) {
      mathBlock = mathBlock.replace(pattern, replacement);
    }
    return mathBlock;
  });

  return text;
}

function fixLatexCommands(text) {
  if (!text) return text;

  // Fix inside math delimiters only
  text = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (mathBlock) => {
    // Fix \sqrt[] → \sqrt (empty optional arg is invalid)
    mathBlock = mathBlock.replace(/\\sqrt\[\s*\]/g, "\\sqrt");

    // Fix unescaped math function names
    mathBlock = mathBlock.replace(/(?<!\\)\blog\b/g, "\\log");
    mathBlock = mathBlock.replace(/(?<!\\)\bln\b/g, "\\ln");
    mathBlock = mathBlock.replace(/(?<!\\)\bsin\b/g, "\\sin");
    mathBlock = mathBlock.replace(/(?<!\\)\bcos\b/g, "\\cos");
    mathBlock = mathBlock.replace(/(?<!\\)\btan\b/g, "\\tan");
    mathBlock = mathBlock.replace(/(?<!\\)\bcot\b/g, "\\cot");
    mathBlock = mathBlock.replace(/(?<!\\)\blim\b/g, "\\lim");
    mathBlock = mathBlock.replace(/(?<!\\)\bmax\b/g, "\\max");
    mathBlock = mathBlock.replace(/(?<!\\)\bmin\b/g, "\\min");

    // Fix log_{ 2 } → \log_{ 2 } (already fixed above, but handle log_ specifically)
    mathBlock = mathBlock.replace(/\\log_/g, "\\log_");

    // Compact excessive spaces in braces: { 2 } → {2}
    mathBlock = mathBlock.replace(/\{\s+(\S+?)\s+\}/g, "{$1}");

    // Fix π → \pi inside math
    mathBlock = mathBlock.replace(/π/g, "\\pi ");
    mathBlock = mathBlock.replace(/α/g, "\\alpha ");
    mathBlock = mathBlock.replace(/β/g, "\\beta ");
    mathBlock = mathBlock.replace(/γ/g, "\\gamma ");
    mathBlock = mathBlock.replace(/δ/g, "\\delta ");
    mathBlock = mathBlock.replace(/θ/g, "\\theta ");
    mathBlock = mathBlock.replace(/λ/g, "\\lambda ");
    mathBlock = mathBlock.replace(/φ/g, "\\varphi ");
    mathBlock = mathBlock.replace(/Δ/g, "\\Delta ");
    mathBlock = mathBlock.replace(/Ω/g, "\\Omega ");
    mathBlock = mathBlock.replace(/ε/g, "\\varepsilon ");
    mathBlock = mathBlock.replace(/σ/g, "\\sigma ");

    // Clean up double spaces
    mathBlock = mathBlock.replace(/\s{2,}/g, " ");

    return mathBlock;
  });

  return text;
}

function fixAllLatex(text) {
  if (!text) return text;
  text = fixDollarDelimiters(text);
  text = fixUnicodeSymbols(text);
  text = fixLatexCommands(text);
  return text;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Fix LaTeX Rendering — MATH_5D (Exam ID: 146)");
  console.log("═══════════════════════════════════════════════════════════");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Get all questions
    const questionsResult = await client.query(
      `SELECT id, question_number, question_text, question_text_cn, question_text_en,
              explanation, explanation_cn, explanation_en
       FROM questions
       WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       ORDER BY question_number`,
      [EXAM_ID]
    );

    // Get all answers
    const answersResult = await client.query(
      `SELECT a.id, a.question_id, a.answer_key, a.answer_text, a.answer_text_cn, a.answer_text_en
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       ORDER BY q.question_number, a.answer_key`,
      [EXAM_ID]
    );

    await client.query("BEGIN");

    let questionFixCount = 0;
    let answerFixCount = 0;

    // Fix questions
    for (const q of questionsResult.rows) {
      const fixes = {};
      for (const col of ["question_text", "question_text_cn", "question_text_en", "explanation", "explanation_cn", "explanation_en"]) {
        const original = q[col];
        if (!original) continue;
        const fixed = fixAllLatex(original);
        if (fixed !== original) {
          fixes[col] = fixed;
        }
      }

      if (Object.keys(fixes).length > 0) {
        const setClauses = Object.keys(fixes).map((col, i) => `${col} = $${i + 2}`);
        const values = Object.values(fixes);
        await client.query(
          `UPDATE questions SET ${setClauses.join(", ")} WHERE id = $1`,
          [q.id, ...values]
        );
        questionFixCount++;
        console.log(`  ✏️  Q${q.question_number} (id=${q.id}): fixed ${Object.keys(fixes).join(", ")}`);
      }
    }

    // Fix answers
    for (const a of answersResult.rows) {
      const fixes = {};
      for (const col of ["answer_text", "answer_text_cn", "answer_text_en"]) {
        const original = a[col];
        if (!original) continue;
        const fixed = fixAllLatex(original);
        if (fixed !== original) {
          fixes[col] = fixed;
        }
      }

      if (Object.keys(fixes).length > 0) {
        const setClauses = Object.keys(fixes).map((col, i) => `${col} = $${i + 2}`);
        const values = Object.values(fixes);
        await client.query(
          `UPDATE answers SET ${setClauses.join(", ")} WHERE id = $1`,
          [a.id, ...values]
        );
        answerFixCount++;
      }
    }

    await client.query("COMMIT");

    console.log();
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  ✅ Fixed ${questionFixCount} questions, ${answerFixCount} answers`);
    console.log("═══════════════════════════════════════════════════════════");

    // Verify: show sample
    console.log();
    console.log("─── Sample After Fix ──────────────────────────────────────");
    const sample = await client.query(
      `SELECT q.question_number, LEFT(q.question_text, 150) as qt, LEFT(q.explanation, 150) as ex,
              (SELECT string_agg(LEFT(a.answer_text, 50), ' | ' ORDER BY a.answer_key)
               FROM answers a WHERE a.question_id = q.id) as ans
       FROM questions q
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       ORDER BY q.question_number LIMIT 5`,
      [EXAM_ID]
    );
    for (const row of sample.rows) {
      console.log(`\n  Q${row.question_number}:`);
      console.log(`    ${row.qt}`);
      console.log(`    Ans: ${row.ans}`);
      if (row.ex) console.log(`    Expl: ${row.ex}`);
    }

    // Final check: any remaining $ signs?
    const dollarCheck = await client.query(
      `SELECT COUNT(*) as count FROM questions
       WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       AND (question_text LIKE '%$%' OR explanation LIKE '%$%')`,
      [EXAM_ID]
    );
    const answerDollarCheck = await client.query(
      `SELECT COUNT(*) as count FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       AND a.answer_text LIKE '%$%'`,
      [EXAM_ID]
    );
    console.log(`\n  Remaining $ in questions: ${dollarCheck.rows[0].count}`);
    console.log(`  Remaining $ in answers: ${answerDollarCheck.rows[0].count}`);

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ FATAL ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
});
