/**
 * One-off script: Import "CSCA MATHEMATICS EXAM 2D (1).docx" into production DB.
 * Sets is_premium = true, vip_tier = 'vip', and distributes points to sum exactly to 100.
 *
 * Usage:
 *   cd backend
 *   node scripts/one-off/import_math_2d.js
 */

"use strict";

// Set Python path BEFORE loading any modules that use it
process.env.PYTHON_PATH = "C:\\Users\\ducan\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

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

const DOCX_PATH = path.resolve(
  "C:\\Users\\ducan\\Downloads\\CSCA MATHEMATICS EXAM 2D (1).docx"
);
const EXAM_CODE = "MATH_2D";
const EXAM_TITLE = "CSCA Mathematics Exam 2D";
const EXAM_TITLE_CN = "CSCA数学考试2D";
const EXAM_DESCRIPTION = "Đề thi thử Toán mẫu 2D - CSCA";
const EXAM_DURATION = 90;
const EXAM_DIFFICULTY = "medium";
const SUBJECT_CODE = "MATH";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Check backend/.env");
}

async function syncExamTotalsAndDistributePoints(client, examId, targetTotalPoints = 100) {
  // 1. Get all question IDs
  const questionsResult = await client.query(
    `SELECT id FROM questions
     WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL
     ORDER BY question_number`,
    [examId]
  );
  const qCount = questionsResult.rows.length;
  if (qCount === 0) return { count: 0, total_points: 0 };

  // Calculate points per question
  const basePoints = Math.floor((targetTotalPoints / qCount) * 100) / 100; // Round down to 2 decimals
  const remainder = Math.round((targetTotalPoints - (basePoints * qCount)) * 100) / 100;

  console.log(`      Distributing ${targetTotalPoints} points across ${qCount} questions...`);
  console.log(`      Base points per question: ${basePoints}`);
  console.log(`      Remainder to add to the last question: ${remainder}`);

  // Update base points for all questions
  await client.query(
    `UPDATE questions SET points = $1 WHERE exam_id = $2 AND question_number > 0 AND deleted_at IS NULL`,
    [basePoints, examId]
  );

  // Add remainder to the last question
  const lastQuestionId = questionsResult.rows[qCount - 1].id;
  const finalLastPoints = Math.round((basePoints + remainder) * 100) / 100;
  await client.query(
    `UPDATE questions SET points = $1 WHERE id = $2`,
    [finalLastPoints, lastQuestionId]
  );

  // Sync to exam totals
  await client.query(
    "UPDATE exams SET total_questions = $1, total_points = $2, updated_at = NOW() WHERE id = $3",
    [qCount, targetTotalPoints, examId]
  );

  return { count: qCount, total_points: targetTotalPoints };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CSCA MATH 2D DOCX → VIP 100-Point Production DB Import");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`DOCX:  ${DOCX_PATH}`);
  console.log();

  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`File not found: ${DOCX_PATH}`);
  }
  const buffer = fs.readFileSync(DOCX_PATH);
  const file = {
    buffer,
    originalname: path.basename(DOCX_PATH),
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  console.log("[1/5] Extracting text from DOCX...");
  const importFile = await extractImportFileText(file);
  console.log(`      Text length: ${importFile.text.length} chars`);
  
  const debugDir = path.resolve(__dirname, "../../tmp");
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
  fs.writeFileSync(
    path.join(debugDir, "math_2d_extracted.txt"),
    importFile.text,
    "utf8"
  );
  console.log(`      Saved extracted text → tmp/math_2d_extracted.txt`);

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
    throw new Error("No questions found by rule-based parser");
  }
  console.log(`      Found ${preview.items.length} items (${preview.totalQuestionCount || "?"} questions)`);

  console.log("[3/5] Normalizing items...");
  const items = preview.items
    .map((item, index) => normalizeImportedItem(item, index))
    .filter(Boolean);

  const totalQuestions = items.reduce(
    (sum, item) => sum + countImportedItemQuestions(item),
    0
  );

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

    let examId;
    if (existingExam.rows.length > 0) {
      const existing = existingExam.rows[0];
      examId = existing.id;
      console.log(`      ⚠ Exam "${existing.title}" (id=${examId}) already exists. Re-importing questions...`);
      await client.query("DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)", [examId]);
      await client.query("DELETE FROM questions WHERE exam_id = $1", [examId]);
      await client.query(
        `UPDATE exams SET title = $1, title_cn = $2, description = $3, duration = $4,
         difficulty_level = $5, status = 'draft', is_premium = true, vip_tier = 'vip', updated_at = NOW()
         WHERE id = $6`,
        [EXAM_TITLE, EXAM_TITLE_CN, EXAM_DESCRIPTION, EXAM_DURATION, EXAM_DIFFICULTY, examId]
      );
    } else {
      const subjectResult = await client.query("SELECT id FROM subjects WHERE code = $1", [SUBJECT_CODE]);
      const subjectId = subjectResult.rows[0].id;

      const examResult = await client.query(
        `INSERT INTO exams (
          subject_id, code, title, title_cn, description,
          duration, total_questions, total_points,
          difficulty_level, status, publish_date, is_premium, vip_tier
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 'draft', NOW(), true, 'vip')
        RETURNING id`,
        [subjectId, EXAM_CODE, EXAM_TITLE, EXAM_TITLE_CN, EXAM_DESCRIPTION, EXAM_DURATION, EXAM_DIFFICULTY]
      );
      examId = examResult.rows[0].id;
    }

    console.log(`      Exam ID: ${examId}`);
    console.log("[5/5] Inserting questions...");
    
    let questionNumber = 0;
    for (const item of items) {
      const startQuestionNumber = questionNumber + 1;
      if (item.itemType === "reading_group") {
        await insertImportedReadingGroup(client, { examId, group: item, startQuestionNumber });
      } else if (item.itemType === "fill_blank_group") {
        await insertImportedFillBlankGroup(client, { examId, group: item, startQuestionNumber });
      } else {
        await insertImportedSingleChoice(client, { examId, question: item, questionNumber: startQuestionNumber });
      }
      questionNumber += countImportedItemQuestions(item);
      process.stdout.write(`      Q${questionNumber} `);
    }
    console.log();

    // Distribute 100 points and sync
    const totals = await syncExamTotalsAndDistributePoints(client, examId, 100);

    await client.query("COMMIT");

    console.log();
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  ✅ IMPORT COMPLETE (VIP & 100 POINTS CONFIGURED)");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Exam ID:         ${examId}`);
    console.log(`  Exam Code:       ${EXAM_CODE}`);
    console.log(`  Total Questions:  ${totals.count}`);
    console.log(`  Total Points:     ${totals.total_points}`);
    console.log();

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ FATAL ERROR:", error.message);
  process.exit(1);
});
