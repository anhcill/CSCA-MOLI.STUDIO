const { extractImportFileText, normalizeUploadedFileName } = require("../adminExamImportService");
const { SOURCE_FILE_TEXT_LIMIT, SOURCE_PROMPT_TEXT_LIMIT } = require("./types");

function compactSourceText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSourceFileRow(row, options = {}) {
  if (!row) return null;
  const text = String(row.text_content || "");
  const normalized = {
    id: row.id,
    examId: row.exam_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    textLength: text.length || Number(row.text_length) || 0,
    pages: row.pages ?? null,
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
  };

  if (options.includeText) {
    normalized.textContent = options.promptSafe
      ? text.slice(0, SOURCE_PROMPT_TEXT_LIMIT)
      : text;
    normalized.truncatedForPrompt = text.length > SOURCE_PROMPT_TEXT_LIMIT;
  }

  return normalized;
}

async function extractExamSourceFile(file) {
  const extracted = await extractImportFileText(file);
  const text = compactSourceText(extracted.text).slice(0, SOURCE_FILE_TEXT_LIMIT);
  if (text.length < 20) {
    const error = new Error("SOURCE_FILE_TEXT_TOO_SHORT");
    error.statusCode = 422;
    throw error;
  }

  return {
    fileName: normalizeUploadedFileName(file.originalname),
    fileType: extracted.fileType,
    fileSize: Number(file.size) || Number(file.buffer?.length) || 0,
    textContent: text,
    pages: extracted.pages || null,
    warnings: extracted.warnings || [],
    truncated: compactSourceText(extracted.text).length > SOURCE_FILE_TEXT_LIMIT,
  };
}

async function listExamSourceFiles(client, examId) {
  const result = await client.query(
    `SELECT id, exam_id, file_name, file_type, file_size, pages, uploaded_by, created_at,
            LENGTH(text_content)::int AS text_length
     FROM admin_exam_source_files
     WHERE exam_id = $1
     ORDER BY created_at DESC, id DESC`,
    [examId],
  );
  return result.rows.map(row => normalizeSourceFileRow(row));
}

async function saveExamSourceFile(client, examId, file, userId) {
  const extracted = await extractExamSourceFile(file);
  const result = await client.query(
    `INSERT INTO admin_exam_source_files
       (exam_id, file_name, file_type, file_size, text_content, pages, uploaded_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, exam_id, file_name, file_type, file_size, text_content, pages, uploaded_by, created_at`,
    [
      examId,
      extracted.fileName,
      extracted.fileType,
      extracted.fileSize,
      extracted.textContent,
      extracted.pages,
      userId || null,
    ],
  );
  return {
    sourceFile: normalizeSourceFileRow(result.rows[0]),
    warnings: extracted.warnings,
    truncated: extracted.truncated,
  };
}

async function deleteExamSourceFile(client, examId, sourceFileId) {
  const result = await client.query(
    `DELETE FROM admin_exam_source_files
     WHERE id = $1 AND exam_id = $2
     RETURNING id, file_name`,
    [sourceFileId, examId],
  );
  return result.rows[0] || null;
}

async function getLatestExamSourceForReview(client, examId) {
  const result = await client.query(
    `SELECT id, exam_id, file_name, file_type, file_size, text_content, pages, uploaded_by, created_at
     FROM admin_exam_source_files
     WHERE exam_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [examId],
  );
  return normalizeSourceFileRow(result.rows[0], { includeText: true, promptSafe: true });
}

module.exports = {
  compactSourceText,
  extractExamSourceFile,
  listExamSourceFiles,
  saveExamSourceFile,
  deleteExamSourceFile,
  getLatestExamSourceForReview,
  normalizeSourceFileRow,
};
