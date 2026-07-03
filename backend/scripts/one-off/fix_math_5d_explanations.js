"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client } = require("pg");

const EXAM_ID = 146;

function fixExplanationLatex(text) {
  if (!text) return text;

  // Fix inside math blocks
  text = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (mathBlock) => {
    // Fix \le ft → \left and \rig ht → \right (MTEF spacing bug)
    mathBlock = mathBlock.replace(/\\le\s+ft\b/g, "\\left");
    mathBlock = mathBlock.replace(/\\rig\s+ht\b/g, "\\right");

    // Fix \Leftrightarrow stuck to next word
    mathBlock = mathBlock.replace(/(\\Leftrightarrow)([a-zA-Z0-9\\{])/g, "$1 $2");
    mathBlock = mathBlock.replace(/(\\Rightarrow)([a-zA-Z0-9\\{])/g, "$1 $2");

    // Fix \rm{} artifacts from MTEF
    mathBlock = mathBlock.replace(/\{\\rm\{\s*\}\s*\}/g, " ");
    mathBlock = mathBlock.replace(/\{\s*\\rm\{([^}]*)\}\s*\}/g, "\\text{$1}");

    // Fix unescaped function names
    mathBlock = mathBlock.replace(/(?<!\\)\bsin\b/g, "\\sin ");
    mathBlock = mathBlock.replace(/(?<!\\)\bcos\b/g, "\\cos ");
    mathBlock = mathBlock.replace(/(?<!\\)\btan\b/g, "\\tan ");
    mathBlock = mathBlock.replace(/(?<!\\)\bcot\b/g, "\\cot ");
    mathBlock = mathBlock.replace(/(?<!\\)\blog\b/g, "\\log ");
    mathBlock = mathBlock.replace(/(?<!\\)\bln\b/g, "\\ln ");
    mathBlock = mathBlock.replace(/(?<!\\)\blim\b/g, "\\lim ");
    mathBlock = mathBlock.replace(/(?<!\\)\bmax\b/g, "\\max ");
    mathBlock = mathBlock.replace(/(?<!\\)\bmin\b/g, "\\min ");
    mathBlock = mathBlock.replace(/(?<!\\)\bcost\b/g, "\\cos t");
    
    // Fix \\sin\\alpha → \\sin \\alpha (space between command and next command)
    mathBlock = mathBlock.replace(/(\\(?:sin|cos|tan|cot|log|ln|lim))\s*(\\[a-zA-Z])/g, "$1 $2");

    // Fix compact braces
    mathBlock = mathBlock.replace(/\{\s+(\S+?)\s+\}/g, "{$1}");

    // Fix Unicode symbols  
    mathBlock = mathBlock.replace(/≤/g, "\\le ");
    mathBlock = mathBlock.replace(/≥/g, "\\ge ");
    mathBlock = mathBlock.replace(/≠/g, "\\neq ");
    mathBlock = mathBlock.replace(/∈/g, "\\in ");
    mathBlock = mathBlock.replace(/⊥/g, "\\perp ");
    mathBlock = mathBlock.replace(/⋅/g, "\\cdot ");
    mathBlock = mathBlock.replace(/π/g, "\\pi ");
    mathBlock = mathBlock.replace(/α/g, "\\alpha ");
    mathBlock = mathBlock.replace(/β/g, "\\beta ");
    mathBlock = mathBlock.replace(/θ/g, "\\theta ");
    mathBlock = mathBlock.replace(/∞/g, "\\infty ");
    mathBlock = mathBlock.replace(/→/g, "\\to ");
    mathBlock = mathBlock.replace(/⇒/g, "\\Rightarrow ");
    mathBlock = mathBlock.replace(/⇔/g, "\\Leftrightarrow ");
    mathBlock = mathBlock.replace(/±/g, "\\pm ");
    mathBlock = mathBlock.replace(/∪/g, "\\cup ");
    mathBlock = mathBlock.replace(/∩/g, "\\cap ");

    // Fix \\setminus stuck to next char
    mathBlock = mathBlock.replace(/\\setminus([A-Za-z{])/g, "\\setminus $1");

    // Clean double spaces  
    mathBlock = mathBlock.replace(/\s{2,}/g, " ");

    return mathBlock;
  });

  // Also fix $ delimiters in explanations
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\\[${math.trim()}\\]`);
  text = text.replace(/(?<![\\])\$((?:[^$\\]|\\.)+?)\$/g, (_, math) => `\\(${math.trim()}\\)`);

  return text;
}

async function main() {
  console.log("Fix explanation LaTeX rendering — MATH_5D (Exam 146)");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Fix questions (explanations + question text)
    const qr = await client.query(
      `SELECT id, question_number, question_text, question_text_cn, question_text_en,
              explanation, explanation_cn, explanation_en
       FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       ORDER BY question_number`,
      [EXAM_ID]
    );

    let qFix = 0;
    for (const q of qr.rows) {
      const fixes = {};
      for (const col of ["question_text", "question_text_cn", "question_text_en", "explanation", "explanation_cn", "explanation_en"]) {
        if (!q[col]) continue;
        const fixed = fixExplanationLatex(q[col]);
        if (fixed !== q[col]) fixes[col] = fixed;
      }
      if (Object.keys(fixes).length > 0) {
        const sets = Object.keys(fixes).map((c, i) => `${c} = $${i + 2}`);
        await client.query(`UPDATE questions SET ${sets.join(", ")} WHERE id = $1`, [q.id, ...Object.values(fixes)]);
        qFix++;
        console.log(`  ✏️ Q${q.question_number}: ${Object.keys(fixes).join(", ")}`);
      }
    }

    // Fix answers
    const ar = await client.query(
      `SELECT a.id, a.answer_text, a.answer_text_cn, a.answer_text_en, q.question_number, a.answer_key
       FROM answers a JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL`,
      [EXAM_ID]
    );

    let aFix = 0;
    for (const a of ar.rows) {
      const fixes = {};
      for (const col of ["answer_text", "answer_text_cn", "answer_text_en"]) {
        if (!a[col]) continue;
        const fixed = fixExplanationLatex(a[col]);
        if (fixed !== a[col]) fixes[col] = fixed;
      }
      if (Object.keys(fixes).length > 0) {
        const sets = Object.keys(fixes).map((c, i) => `${c} = $${i + 2}`);
        await client.query(`UPDATE answers SET ${sets.join(", ")} WHERE id = $1`, [a.id, ...Object.values(fixes)]);
        aFix++;
      }
    }

    await client.query("COMMIT");

    console.log(`\n✅ Fixed ${qFix} questions, ${aFix} answers`);

    // Sample verification
    console.log("\n─── Sample Explanations After Fix ──────────────────────");
    const sample = await client.query(
      `SELECT question_number, LEFT(explanation_en, 250) as expl
       FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       AND question_number IN (3, 8, 27, 33, 34, 39)
       ORDER BY question_number`,
      [EXAM_ID]
    );
    for (const row of sample.rows) {
      console.log(`\n  Q${row.question_number}: ${row.expl}`);
    }

    // Check for remaining issues
    const issues = await client.query(
      `SELECT question_number, explanation_en FROM questions
       WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       AND (explanation_en LIKE '%\\le ft%' OR explanation_en LIKE '%\\rig ht%' 
            OR explanation_en LIKE '%$%')
       ORDER BY question_number`,
      [EXAM_ID]
    );
    if (issues.rows.length === 0) {
      console.log("\n  ✅ No remaining \\le ft / \\rig ht / $ issues!");
    } else {
      console.log(`\n  ⚠ ${issues.rows.length} questions still have issues:`);
      issues.rows.forEach(r => console.log(`    Q${r.question_number}`));
    }

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error("❌", err.message, err.stack); process.exit(1); });
