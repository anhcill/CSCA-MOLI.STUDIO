"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client } = require("pg");
const axios = require("axios");

const EXAM_ID = 146;

// ── Google Translate Free API Client ─────────────────────────────────────

async function translateText(text, targetLang) {
  if (!text || !text.trim()) return "";
  
  // Protect LaTeX formulas
  const latexBlocks = [];
  let protectedText = text;
  
  // Replace \( ... \) blocks
  protectedText = protectedText.replace(/\\\([\s\S]*?\\\)/g, (match) => {
    const placeholder = `__LTX_${latexBlocks.length}__`;
    latexBlocks.push(match);
    return placeholder;
  });

  // Replace \[ ... \] blocks
  protectedText = protectedText.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
    const placeholder = `__LTX_${latexBlocks.length}__`;
    latexBlocks.push(match);
    return placeholder;
  });

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(protectedText)}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    // Extract translated segments
    let translated = "";
    if (response.data && response.data[0]) {
      translated = response.data[0].map(item => item[0]).join("");
    } else {
      return text; // Fallback
    }

    // Restore LaTeX formulas
    for (let i = 0; i < latexBlocks.length; i++) {
      const placeholder = `__LTX_${i}__`;
      // Google Translate might add spaces around the placeholder, e.g. "__LTX_0__" -> "__ LTX_0 __" or similar
      const regex = new RegExp(`__\\s*LTX_\\s*${i}\\s*__`, "g");
      translated = translated.replace(regex, latexBlocks[i]);
    }

    // Post-processing: clean up Google Translate spaces in math delimiters if any
    translated = translated.replace(/\\\(\s*/g, "\\(").replace(/\s*\\\)/g, "\\)");
    translated = translated.replace(/\\\[\s*/g, "\\[").replace(/\s*\\\]/g, "\\]");

    return translated;
  } catch (error) {
    console.error(`Translation error for lang ${targetLang}:`, error.message);
    return text; // Fallback to original
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Automatic Translation of Exam 146 (EN → VI, ZH)");
  console.log("═══════════════════════════════════════════════════════════");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // 1. Get questions
    console.log("[1/3] Fetching questions...");
    const qr = await client.query(
      `SELECT id, question_number, question_text_en, explanation_en
       FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       ORDER BY question_number`,
      [EXAM_ID]
    );

    // 2. Fetch answers
    console.log("[2/3] Fetching answers...");
    const ar = await client.query(
      `SELECT a.id, a.question_id, a.answer_text_en
       FROM answers a JOIN questions q ON a.question_id = q.id
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL`,
      [EXAM_ID]
    );

    console.log(`      Found ${qr.rows.length} questions and ${ar.rows.length} answers.`);
    console.log();

    await client.query("BEGIN");

    // Translate questions
    console.log("[3/3] Translating and updating database...");
    for (const q of qr.rows) {
      console.log(`      Translating Q${q.question_number}...`);

      // Translate question text
      const viText = await translateText(q.question_text_en, "vi");
      const zhText = await translateText(q.question_text_en, "zh-CN");

      // Translate explanation
      const viExpl = await translateText(q.explanation_en, "vi");
      const zhExpl = await translateText(q.explanation_en, "zh-CN");

      // Update question
      await client.query(
        `UPDATE questions 
         SET question_text = $1, question_text_cn = $2,
             explanation = $3, explanation_cn = $4
         WHERE id = $5`,
        [viText, zhText, viExpl, zhExpl, q.id]
      );

      // Translate corresponding answers
      const qAnswers = ar.rows.filter(a => a.question_id === q.id);
      for (const ans of qAnswers) {
        // If answer text is pure math/formula (contains \( but no letters except LaTeX commands), skip translating
        const isFormulaOnly = ans.answer_text_en.includes("\\(") && !/[a-zA-Z]{4,}/.test(ans.answer_text_en.replace(/\\[a-zA-Z]+/g, ""));
        
        let viAns = ans.answer_text_en;
        let zhAns = ans.answer_text_en;

        if (!isFormulaOnly && /[a-zA-Z]/.test(ans.answer_text_en)) {
          viAns = await translateText(ans.answer_text_en, "vi");
          zhAns = await translateText(ans.answer_text_en, "zh-CN");
        }

        await client.query(
          `UPDATE answers 
           SET answer_text = $1, answer_text_cn = $2
           WHERE id = $3`,
          [viAns, zhAns, ans.id]
        );
      }
    }

    // ── Additional cleanup for translation spacing and bugs ──
    // e.g. "log_ {2}" spaces introduced by translator
    await client.query(`
      UPDATE questions 
      SET question_text = REPLACE(question_text, 'log_ {2}', 'log_{2}'),
          question_text_cn = REPLACE(question_text_cn, 'log_ {2}', 'log_{2}'),
          explanation = REPLACE(explanation, 'log_ {2}', 'log_{2}'),
          explanation_cn = REPLACE(explanation_cn, 'log_ {2}', 'log_{2}')
      WHERE exam_id = $1
    `, [EXAM_ID]);

    // Also fix the \in fty -> \infty bug globally on the exam!
    await client.query(`
      UPDATE questions 
      SET question_text = REPLACE(question_text, '\\in fty', '\\infty'),
          question_text_cn = REPLACE(question_text_cn, '\\in fty', '\\infty'),
          question_text_en = REPLACE(question_text_en, '\\in fty', '\\infty'),
          explanation = REPLACE(explanation, '\\in fty', '\\infty'),
          explanation_cn = REPLACE(explanation_cn, '\\in fty', '\\infty'),
          explanation_en = REPLACE(explanation_en, '\\in fty', '\\infty')
      WHERE exam_id = $1
    `, [EXAM_ID]);

    await client.query(`
      UPDATE answers 
      SET answer_text = REPLACE(answer_text, '\\in fty', '\\infty'),
          answer_text_cn = REPLACE(answer_text_cn, '\\in fty', '\\infty'),
          answer_text_en = REPLACE(answer_text_en, '\\in fty', '\\infty')
      WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)
    `, [EXAM_ID]);

    await client.query("COMMIT");

    console.log();
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  ✅ TRANSLATION & POST-PROCESSING COMPLETED SUCCESSFULLY");
    console.log("═══════════════════════════════════════════════════════════");

    // Print sample translated data
    const sample = await client.query(
      `SELECT question_number, LEFT(question_text, 100) as qt_vi, LEFT(question_text_cn, 100) as qt_zh,
              LEFT(explanation, 100) as ex_vi, LEFT(explanation_cn, 100) as ex_zh
       FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
       ORDER BY question_number LIMIT 3`,
      [EXAM_ID]
    );

    for (const row of sample.rows) {
      console.log(`\n  Q${row.question_number}:`);
      console.log(`    VI: ${row.qt_vi}`);
      console.log(`    ZH: ${row.qt_zh}`);
      console.log(`    Expl VI: ${row.ex_vi}`);
      console.log(`    Expl ZH: ${row.ex_zh}`);
    }

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
