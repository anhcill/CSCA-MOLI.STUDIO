const crypto = require("crypto");
const fs = require("fs");
const db = require("../config/database");

const BLOB_URL_PREFIX = "/api/materials/blob/";
const DEFAULT_DB_PDF_MAX_MB = Number(process.env.MATERIAL_DB_PDF_MAX_MB || 80);

let ensureTablePromise = null;

function getMaxDbPdfBytes() {
  return Math.max(1, DEFAULT_DB_PDF_MAX_MB) * 1024 * 1024;
}

function createPdfToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizePdfToken(token) {
  const value = String(token || "").trim();
  return /^[a-f0-9]{32,96}$/i.test(value) ? value : "";
}

function getStoredPdfTokenFromUrl(fileUrl) {
  const value = String(fileUrl || "").trim();
  if (!value) return "";

  const markerIndex = value.indexOf(BLOB_URL_PREFIX);
  if (markerIndex >= 0) {
    return normalizePdfToken(value.slice(markerIndex + BLOB_URL_PREFIX.length).split(/[?#/]/)[0]);
  }

  if (value.startsWith("moli-db-pdf:")) {
    return normalizePdfToken(value.slice("moli-db-pdf:".length));
  }

  return "";
}

function getStoredPdfUrl(token) {
  return `${BLOB_URL_PREFIX}${token}`;
}

async function ensureMaterialPdfBlobTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS material_pdf_blobs (
          id SERIAL PRIMARY KEY,
          token VARCHAR(96) UNIQUE NOT NULL,
          original_name TEXT,
          mime_type VARCHAR(120) DEFAULT 'application/pdf',
          file_size BIGINT NOT NULL,
          data BYTEA NOT NULL,
          uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await db.query(
        "CREATE INDEX IF NOT EXISTS idx_material_pdf_blobs_token ON material_pdf_blobs(token)",
      );
      await db.query(
        "CREATE INDEX IF NOT EXISTS idx_material_pdf_blobs_created_at ON material_pdf_blobs(created_at DESC)",
      );
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

async function storePdfFileInDatabase({
  filePath,
  originalName,
  mimeType = "application/pdf",
  fileSize,
  uploadedBy,
}) {
  await ensureMaterialPdfBlobTable();

  const size = Number(fileSize || 0);
  if (size > getMaxDbPdfBytes()) {
    const error = new Error("MATERIAL_DB_PDF_TOO_LARGE");
    error.statusCode = 413;
    error.publicMessage = `File PDF quá lớn. Kho nội bộ hiện nhận tối đa ${DEFAULT_DB_PDF_MAX_MB}MB.`;
    throw error;
  }

  const token = createPdfToken();
  const data = await fs.promises.readFile(filePath);
  const result = await db.query(
    `INSERT INTO material_pdf_blobs (token, original_name, mime_type, file_size, data, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING token, original_name, mime_type, file_size, created_at`,
    [
      token,
      originalName || "material.pdf",
      mimeType || "application/pdf",
      size || data.length,
      data,
      uploadedBy || null,
    ],
  );

  const row = result.rows[0];
  return {
    token: row.token,
    url: getStoredPdfUrl(row.token),
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    createdAt: row.created_at,
  };
}

async function getStoredPdfByToken(token) {
  const normalizedToken = normalizePdfToken(token);
  if (!normalizedToken) return null;

  await ensureMaterialPdfBlobTable();
  const result = await db.query(
    `SELECT token, original_name, mime_type, file_size, data, created_at
     FROM material_pdf_blobs
     WHERE token = $1
     LIMIT 1`,
    [normalizedToken],
  );
  return result.rows[0] || null;
}

async function findMaterialByStoredPdfToken(token) {
  const normalizedToken = normalizePdfToken(token);
  if (!normalizedToken) return null;

  const blobUrl = getStoredPdfUrl(normalizedToken);
  const result = await db.query(
    `SELECT id, title, is_premium, is_active, allow_download
     FROM materials
     WHERE file_url = $1 OR file_url LIKE $2
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [blobUrl, `%${blobUrl}`],
  );
  return result.rows[0] || null;
}

module.exports = {
  BLOB_URL_PREFIX,
  ensureMaterialPdfBlobTable,
  findMaterialByStoredPdfToken,
  getStoredPdfByToken,
  getStoredPdfTokenFromUrl,
  getStoredPdfUrl,
  storePdfFileInDatabase,
};
