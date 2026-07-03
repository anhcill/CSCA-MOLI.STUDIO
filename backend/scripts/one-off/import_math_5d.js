/**
 * One-off script: Import "CSCA MATHEMATICS EXAM 5D.docx" into production DB.
 *
 * Usage:
 *   cd backend
 *   node scripts/one-off/import_math_5d.js
 *
 * Reads DATABASE_URL from backend/.env
 */

"use strict";

// Set Python path BEFORE loading any modules that use it
process.env.PYTHON_PATH = "C:\\Users\\ducan\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// ── Import service functions (reuse existing backend logic) ─────────────
const importService = require("../../src/services/adminExamImportService");
const {
  extractImportFileText,
  parsePdfTextWithRules,
  normalizeImportedItem,
  validateImportItems,
  countImportedItemQuestions,
  insertImportedSingleChoice,
  insertImportedReadingGroup,
  insertImportedFillBlankGroup,
} = importService;

// ── Configuration ───────────────────────────────────────────────────────
const DOCX_PATH = path.resolve(
  "C:\\Users\\ducan\\Downloads\\CSCA MATHEMATICS EXAM 5D.docx"
);
const EXAM_CODE = "MATH_5D";
const EXAM_TITLE = "CSCA Mathematics Exam 5D";
const EXAM_TITLE_CN = "CSCA数学考试5D";
const EXAM_DESCRIPTION = "Đề thi thử Toán mẫu 5D - CSCA";
const EXAM_DURATION = 90; // minutes
const EXAM_DIFFICULTY = "medium";
const SUBJECT_CODE = "MATH";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Check backend/.env");
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function syncExamTotals(client, examId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(points), 0)::numeric AS total_points
     FROM questions
     WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL`,
    [examId]
  );
  const { count, total_points } = result.rows[0];
  await client.query(
    "UPDATE exams SET total_questions = $1, total_points = $2, updated_at = NOW() WHERE id = $3",
    [count, total_points, examId]
  );
  return { count, total_points };
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CSCA MATH 5D DOCX → Production DB Import");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`DOCX:  ${DOCX_PATH}`);
  console.log(`DB:    ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log();

  // 1. Read the DOCX file
  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`File not found: ${DOCX_PATH}`);
  }
  const buffer = fs.readFileSync(DOCX_PATH);
  const file = {
    buffer,
    originalname: path.basename(DOCX_PATH),
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  // 2. Extract text with math
  console.log("[1/5] Extracting text from DOCX...");
  const importFile = await extractImportFileText(file);
  console.log(`      Text length: ${importFile.text.length} chars`);
  console.log(`      File type: ${importFile.fileType}`);
  if (importFile.warnings?.length) {
    console.log(`      Warnings: ${importFile.warnings.join("; ")}`);
  }

  // Save extracted text for debugging
  const debugDir = path.resolve(__dirname, "../../tmp");
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
  fs.writeFileSync(
    path.join(debugDir, "math_5d_extracted.txt"),
    importFile.text,
    "utf8"
  );
  console.log(`      Saved extracted text → tmp/math_5d_extracted.txt`);
  console.log();

  // 3. Parse questions with rule-based parser
  console.log("[2/5] Parsing questions with rule-based parser...");
  const sourceMeta = {
    fileName: file.originalname,
    pages: importFile.pages || null,
    textLength: importFile.text.length,
    truncated: false,
    importPreset: "vietnamese",
    importLanguageMode: "vi",
    subjectCode: SUBJECT_CODE,
    subjectName: "Toán",
    fileType: importFile.fileType,
  };

  const preview = parsePdfTextWithRules(importFile.text, sourceMeta);
  if (!preview || !preview.items || preview.items.length === 0) {
    console.error("❌ Rule-based parser found 0 questions!");
    console.log("\n--- First 2000 chars of extracted text ---");
    console.log(importFile.text.slice(0, 2000));
    throw new Error("No questions found by rule-based parser");
  }
  console.log(`      Found ${preview.items.length} items (${preview.totalQuestionCount || "?"} questions)`);
  if (preview.warnings?.length) {
    preview.warnings.forEach((w) => console.log(`      ⚠ ${w}`));
  }
  console.log();

  // Save preview JSON for debugging
  fs.writeFileSync(
    path.join(debugDir, "math_5d_preview.json"),
    JSON.stringify(preview, null, 2),
    "utf8"
  );
  console.log(`      Saved preview → tmp/math_5d_preview.json`);

  // 4. Normalize items
  console.log("[3/5] Normalizing items...");
  const items = preview.items
    .map((item, index) => normalizeImportedItem(item, index))
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error("All items were rejected during normalization");
  }

  // ── Manual correct answer overrides (from original DOCX analysis) ──
  const CORRECT_ANSWER_OVERRIDES = {
    38: "A",  // Circle x²+y²+8x-6y=0 → center(-4,3) → distance to x-axis = |3| = 3 → A
  };

  for (const item of items) {
    const qNum = item.subQuestionNumber || item.importIndex;
    if (!item.correctAnswer && CORRECT_ANSWER_OVERRIDES[qNum]) {
      item.correctAnswer = CORRECT_ANSWER_OVERRIDES[qNum];
      console.log(`      🔧 Fixed Q${qNum} correct answer → ${item.correctAnswer}`);
    }
  }

  // Check for remaining items without correct answers - warn but allow
  const missingAnswers = items.filter((it) => !it.correctAnswer);
  if (missingAnswers.length > 0) {
    console.warn(`      ⚠ ${missingAnswers.length} item(s) still missing correct answer:`);
    missingAnswers.forEach((it) => {
      console.warn(`        Q${it.subQuestionNumber || it.importIndex}: ${(it.questionText || "").slice(0, 60)}`);
      // Default to "A" if not specified
      it.correctAnswer = "A";
      console.warn(`        → Defaulted to "A"`);
    });
  }

  const validationError = validateImportItems(items);
  if (validationError) {
    console.warn(`      ⚠ Validation warning (proceeding anyway): ${validationError}`);
  }

  const totalQuestions = items.reduce(
    (sum, item) => sum + countImportedItemQuestions(item),
    0
  );
  console.log(`      ${items.length} valid items → ${totalQuestions} questions`);
  console.log();

  // Save normalized items for debugging
  fs.writeFileSync(
    path.join(debugDir, "math_5d_normalized.json"),
    JSON.stringify(items, null, 2),
    "utf8"
  );

  // 5. Insert into database
  console.log("[4/5] Connecting to production database...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Check if exam already exists
    const existingExam = await client.query(
      "SELECT id, title FROM exams WHERE code = $1 AND deleted_at IS NULL",
      [EXAM_CODE]
    );
    if (existingExam.rows.length > 0) {
      const existing = existingExam.rows[0];
      console.log(`      ⚠ Exam "${existing.title}" (id=${existing.id}) already exists with code ${EXAM_CODE}`);
      console.log(`      Deleting existing questions and re-importing...`);
      await client.query("DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)", [existing.id]);
      await client.query("DELETE FROM questions WHERE exam_id = $1", [existing.id]);
      var examId = existing.id;
      await client.query(
        `UPDATE exams SET title = $1, title_cn = $2, description = $3, duration = $4,
         difficulty_level = $5, status = 'draft', updated_at = NOW()
         WHERE id = $6`,
        [EXAM_TITLE, EXAM_TITLE_CN, EXAM_DESCRIPTION, EXAM_DURATION, EXAM_DIFFICULTY, examId]
      );
    } else {
      // Get subject ID
      const subjectResult = await client.query(
        "SELECT id FROM subjects WHERE code = $1",
        [SUBJECT_CODE]
      );
      if (subjectResult.rows.length === 0) {
        throw new Error(`Subject with code "${SUBJECT_CODE}" not found`);
      }
      const subjectId = subjectResult.rows[0].id;

      // Create exam
      const examResult = await client.query(
        `INSERT INTO exams (
          subject_id, code, title, title_cn, description,
          duration, total_questions, total_points,
          difficulty_level, status, publish_date
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 'draft', NOW())
        RETURNING id`,
        [subjectId, EXAM_CODE, EXAM_TITLE, EXAM_TITLE_CN, EXAM_DESCRIPTION, EXAM_DURATION, EXAM_DIFFICULTY]
      );
      var examId = examResult.rows[0].id;
    }

    console.log(`      Exam ID: ${examId}`);
    console.log();

    // Insert questions
    console.log("[5/5] Inserting questions...");
    let questionNumber = 0;
    const insertedItems = [];
    const renderIssues = [];

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

        // ── Check for rendering issues in explanation ──
        const explanation = item.explanation || "";
        const explanationCn = item.explanationCn || "";
        if (explanation || explanationCn) {
          const issues = checkExplanationRendering(explanation, explanationCn, startQuestionNumber);
          if (issues.length > 0) {
            renderIssues.push(...issues);
          }
        }
      }

      questionNumber += countImportedItemQuestions(item);
      insertedItems.push(insertedItem);
      process.stdout.write(`      Q${questionNumber} `);
    }
    console.log();

    // Sync exam totals
    const totals = await syncExamTotals(client, examId);

    await client.query("COMMIT");

    console.log();
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  ✅ IMPORT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Exam ID:         ${examId}`);
    console.log(`  Exam Code:       ${EXAM_CODE}`);
    console.log(`  Total Questions:  ${totals.count}`);
    console.log(`  Total Points:     ${totals.total_points}`);
    console.log(`  Items Inserted:   ${insertedItems.length}`);
    console.log();

    // 6. Verify: read back and check rendering
    console.log("─── Rendering Verification ────────────────────────────────");
    const verifyResult = await client.query(
      `SELECT q.id, q.question_number, q.question_text, q.question_text_cn,
              q.explanation, q.explanation_cn,
              (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answer_count,
              (SELECT string_agg(a.answer_key || ':' || COALESCE(SUBSTRING(a.answer_text, 1, 40), ''), ', ' ORDER BY a.answer_key)
               FROM answers a WHERE a.question_id = q.id) AS answers_preview,
              (SELECT a.answer_key FROM answers a WHERE a.question_id = q.id AND a.is_correct = true LIMIT 1) AS correct_key
       FROM questions q
       WHERE q.exam_id = $1 AND q.question_number > 0 AND q.deleted_at IS NULL
       ORDER BY q.question_number`,
      [examId]
    );

    let issueCount = 0;
    for (const row of verifyResult.rows) {
      const problems = [];

      // Check missing correct answer
      if (!row.correct_key) {
        problems.push("❌ NO CORRECT ANSWER");
      }

      // Check answer count
      if (row.answer_count < 2) {
        problems.push(`❌ Only ${row.answer_count} answer(s)`);
      }

      // Check empty question text
      if (!row.question_text?.trim()) {
        problems.push("❌ Empty question_text");
      }

      // Check math delimiter balance
      const qText = (row.question_text || "") + (row.explanation || "");
      const inlineOpen = (qText.match(/\\\(/g) || []).length;
      const inlineClose = (qText.match(/\\\)/g) || []).length;
      if (inlineOpen !== inlineClose) {
        problems.push(`⚠ Unbalanced \\(...\\) delimiters: ${inlineOpen} open, ${inlineClose} close`);
      }

      const displayOpen = (qText.match(/\\\[/g) || []).length;
      const displayClose = (qText.match(/\\\]/g) || []).length;
      if (displayOpen !== displayClose) {
        problems.push(`⚠ Unbalanced \\[...\\] delimiters: ${displayOpen} open, ${displayClose} close`);
      }

      // Check brace balance in math
      const braceOpen = (qText.match(/{/g) || []).length;
      const braceClose = (qText.match(/}/g) || []).length;
      if (braceOpen !== braceClose) {
        problems.push(`⚠ Unbalanced braces: ${braceOpen} { vs ${braceClose} }`);
      }

      // Check for raw $ signs (should use \( \) or \[ \] instead)
      if (/(?<!\\)\$/.test(qText)) {
        problems.push("⚠ Raw $ sign found (should use \\( \\) delimiters)");
      }

      // Check for broken LaTeX commands
      if (/\\[a-zA-Z]+\s*$/.test(row.question_text || "")) {
        problems.push("⚠ Possible truncated LaTeX command at end");
      }

      if (problems.length > 0) {
        issueCount++;
        console.log(`  Q${row.question_number} (id=${row.id}): ${problems.join("; ")}`);
        console.log(`    text: ${(row.question_text || "").slice(0, 100)}...`);
        if (row.explanation) {
          console.log(`    expl: ${(row.explanation || "").slice(0, 100)}...`);
        }
      }
    }

    if (renderIssues.length > 0) {
      console.log();
      console.log("─── Explanation Render Issues ──────────────────────────────");
      renderIssues.forEach((issue) => console.log(`  ${issue}`));
    }

    if (issueCount === 0 && renderIssues.length === 0) {
      console.log("  ✅ No rendering issues detected.");
    } else {
      console.log();
      console.log(`  ⚠ ${issueCount} question(s) with issues, ${renderIssues.length} explanation render issue(s).`);
    }

    console.log();
    console.log("Done. Exam status: 'draft'. Publish when ready.");

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

// ── Explanation rendering checks ────────────────────────────────────────
function checkExplanationRendering(explanation, explanationCn, questionNumber) {
  const issues = [];

  for (const [label, text] of [["vi", explanation], ["cn", explanationCn]]) {
    if (!text) continue;

    // Check unbalanced inline math \( \)
    const inlineOpen = (text.match(/\\\(/g) || []).length;
    const inlineClose = (text.match(/\\\)/g) || []).length;
    if (inlineOpen !== inlineClose) {
      issues.push(`Q${questionNumber} [${label}] explanation: Unbalanced \\(...\\) (${inlineOpen} open, ${inlineClose} close)`);
    }

    // Check unbalanced display math \[ \]
    const displayOpen = (text.match(/\\\[/g) || []).length;
    const displayClose = (text.match(/\\\]/g) || []).length;
    if (displayOpen !== displayClose) {
      issues.push(`Q${questionNumber} [${label}] explanation: Unbalanced \\[...\\] (${displayOpen} open, ${displayClose} close)`);
    }

    // Check unbalanced braces
    const braceOpen = (text.match(/{/g) || []).length;
    const braceClose = (text.match(/}/g) || []).length;
    if (braceOpen !== braceClose) {
      issues.push(`Q${questionNumber} [${label}] explanation: Unbalanced braces (${braceOpen} { vs ${braceClose} })`);
    }

    // Check for common broken LaTeX patterns
    if (/\\frac\{[^}]*$/.test(text)) {
      issues.push(`Q${questionNumber} [${label}] explanation: Broken \\frac{} command`);
    }
    if (/\\sqrt\{[^}]*$/.test(text)) {
      issues.push(`Q${questionNumber} [${label}] explanation: Broken \\sqrt{} command`);
    }

    // Check for double backslash issues (\\\\( instead of \\()
    if (/\\\\\\\(/.test(text) || /\\\\\\\)/.test(text)) {
      issues.push(`Q${questionNumber} [${label}] explanation: Double-escaped math delimiters`);
    }
  }

  return issues;
}

main().catch((error) => {
  console.error("\n❌ FATAL ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
});
