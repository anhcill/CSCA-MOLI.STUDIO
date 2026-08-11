const path = require("path");
const { cloudinary, uploadStream } = require("../config/cloudinary");

function fileKind(mimeType) {
  return String(mimeType || "").toLowerCase().startsWith("image/") ? "image" : "document";
}

function safeBaseName(filename) {
  return path.basename(String(filename || "file"))
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

async function uploadOne(file, folder) {
  const kind = fileKind(file.mimetype);
  const name = safeBaseName(file.originalname);
  const options = kind === "image"
    ? { folder, resource_type: "image", use_filename: true, unique_filename: true, filename_override: name }
    : { folder, resource_type: "raw", use_filename: true, unique_filename: true, filename_override: name };
  const result = await uploadStream(file.buffer, options);
  return {
    originalName: file.originalname || name,
    mimeType: file.mimetype,
    fileKind: kind,
    url: result.secure_url,
    storagePublicId: result.public_id,
    sizeBytes: Number(result.bytes || file.size || 0),
  };
}

async function uploadMany(files, folder) {
  const uploaded = [];
  try {
    for (const file of files || []) uploaded.push(await uploadOne(file, folder));
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => remove(item)));
    throw error;
  }
}

async function remove(file) {
  if (!file?.storagePublicId && !file?.storage_public_id) return;
  const publicId = file.storagePublicId || file.storage_public_id;
  const kind = file.fileKind || file.file_kind;
  await cloudinary.uploader.destroy(publicId, { resource_type: kind === "image" ? "image" : "raw" });
}

module.exports = { fileKind, uploadMany, remove };
