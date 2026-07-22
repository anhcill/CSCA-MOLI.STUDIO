import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const requireBackend = createRequire(resolve(repositoryRoot, "backend/package.json"));
const { HeadObjectCommand, PutObjectCommand, S3Client } = requireBackend("@aws-sdk/client-s3");
const { parseMasterPlaylist, parseVariantPlaylist } = requireBackend("./src/utils/hlsManifest");

function argumentMap(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    if (["--dry-run", "--resume"].includes(item)) { result.set(item.slice(2), true); continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}`);
    result.set(item.slice(2), value);
    index += 1;
  }
  return result;
}

function required(args, name) {
  const value = String(args.get(name) || "").trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function safePart(value, name) {
  const part = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error(`${name} is invalid`);
  return part;
}

function positiveIdPart(value, name) {
  const part = String(value || "").trim();
  if (!/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(Number(part))) {
    throw new Error(`${name} must be a positive integer`);
  }
  return part;
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push({ absolute, relative: relative(root, absolute).split(sep).join("/") });
  }
  return files;
}

function validateFiles(files) {
  const allowed = /^(?:master\.m3u8|v\d+\/(?:index\.m3u8|segment_\d{6}\.ts))$/;
  if (!files.some((file) => file.relative === "master.m3u8")) throw new Error("master.m3u8 is missing");
  for (const file of files) {
    if (!allowed.test(file.relative)) throw new Error(`Unsupported HLS output file: ${file.relative}`);
  }
  if (!files.some((file) => /^v\d+\/index\.m3u8$/.test(file.relative))) {
    throw new Error("No variant playlist was found");
  }
}

async function validateHlsDirectory(files) {
  validateFiles(files);
  const byRelativePath = new Map(files.map((file) => [file.relative, file]));
  const master = parseMasterPlaylist(await readFile(byRelativePath.get("master.m3u8").absolute, "utf8"));
  const referenced = new Set(["master.m3u8"]);
  const durations = [];
  for (const variant of master) {
    const playlistFile = byRelativePath.get(variant.playlistRelativePath);
    if (!playlistFile) throw new Error(`Referenced playlist is missing: ${variant.playlistRelativePath}`);
    referenced.add(variant.playlistRelativePath);
    const playlist = parseVariantPlaylist(
      await readFile(playlistFile.absolute, "utf8"), variant.playlistRelativePath,
    );
    durations.push(playlist.durationSeconds);
    for (const segment of playlist.segments) {
      if (!byRelativePath.has(segment.relativePath)) {
        throw new Error(`Referenced segment is missing: ${segment.relativePath}`);
      }
      referenced.add(segment.relativePath);
    }
  }
  const unreferenced = files.find((file) => !referenced.has(file.relative));
  if (unreferenced) throw new Error(`Unreferenced HLS output file: ${unreferenced.relative}`);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  if (maxDuration - minDuration > Math.max(1, maxDuration * 0.02)) {
    throw new Error("HLS rendition durations do not match");
  }
  return { variants: master.length, segments: referenced.size - master.length - 1 };
}

function orderUploadFiles(files) {
  const rank = (path) => path === "master.m3u8" ? 2 : path.endsWith("/index.m3u8") ? 1 : 0;
  return [...files].sort((left, right) => rank(left.relative) - rank(right.relative)
    || left.relative.localeCompare(right.relative));
}

function contentType(path) {
  return path.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
}

async function retry(work, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await work(); }
    catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 250));
    }
  }
  throw lastError;
}

function isMissingObject(error) {
  return error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404;
}

async function objectMatches({ client, bucket, key, sizeBytes, checksumSha256 }) {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return Number(head.ContentLength) === sizeBytes
      && String(head.Metadata?.sha256 || "").toLowerCase() === checksumSha256;
  } catch (error) {
    if (isMissingObject(error)) return false;
    throw error;
  }
}

async function uploadAll({ client, bucket, prefix, files, concurrency, resume = false }) {
  const orderedFiles = orderUploadFiles(files);
  let completed = 0;
  let skipped = 0;
  async function uploadFile(file) {
      const body = await readFile(file.absolute);
      const checksumSha256 = createHash("sha256").update(body).digest("hex");
      const key = `${prefix}${file.relative}`;
      if (resume && await objectMatches({
        client, bucket, key, sizeBytes: body.length, checksumSha256,
      })) {
        skipped += 1;
        completed += 1;
        process.stdout.write(`\rProcessed ${completed}/${orderedFiles.length} (${skipped} unchanged)`);
        return;
      }
      await retry(() => client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: contentType(file.relative),
        CacheControl: file.relative.endsWith(".m3u8") ? "private, no-store" : "private, max-age=31536000, immutable",
        Metadata: { sha256: checksumSha256 },
      })));
      completed += 1;
      process.stdout.write(`\rProcessed ${completed}/${orderedFiles.length} (${skipped} unchanged)`);
  }
  async function uploadBatch(batch) {
    let cursor = 0;
    async function worker() {
      while (cursor < batch.length) {
        const index = cursor;
        cursor += 1;
        await uploadFile(batch[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, () => worker()));
  }
  const segments = orderedFiles.filter((file) => file.relative.endsWith(".ts"));
  const variants = orderedFiles.filter((file) => file.relative.endsWith("/index.m3u8"));
  const master = orderedFiles.filter((file) => file.relative === "master.m3u8");
  // Barriers prevent a playlist from becoming visible before every object it references.
  await uploadBatch(segments);
  await uploadBatch(variants);
  await uploadBatch(master);
  process.stdout.write("\n");
  return { uploaded: orderedFiles.length - skipped, skipped, total: orderedFiles.length };
}

async function finalize({ apiBaseUrl, adminToken, assetId, manifestVersion }) {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/api/admin/course-media/assets/${assetId}/hls/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ manifestVersion }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(`Finalize failed (${response.status}): ${payload?.code || "UNKNOWN_ERROR"}`);
  }
  return payload.data;
}

async function main() {
  const args = argumentMap(process.argv.slice(2));
  const directory = resolve(required(args, "directory"));
  const directoryStat = await stat(directory);
  if (!directoryStat.isDirectory()) throw new Error("--directory must point to an HLS output directory");
  const courseId = positiveIdPart(required(args, "course-id"), "course-id");
  const lessonId = positiveIdPart(required(args, "lesson-id"), "lesson-id");
  const assetKey = safePart(required(args, "asset-key"), "asset-key");
  const concurrency = Number(args.get("concurrency") || 8);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error("--concurrency must be 1..32");
  const files = await listFiles(directory);
  const validation = await validateHlsDirectory(files);
  const prefix = `private/courses/${courseId}/lessons/${lessonId}/${assetKey}/hls/`;
  console.log(`Validated ${files.length} HLS files (${validation.variants} variants, ${validation.segments} segments).`);
  if (args.get("dry-run")) { console.log("Dry run complete; nothing uploaded or finalized."); return; }

  const endpoint = String(process.env.VIDEO_R2_ENDPOINT || "").replace(/\/+$/, "");
  const bucket = String(process.env.VIDEO_R2_BUCKET || "").trim();
  const accessKeyId = String(process.env.VIDEO_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.VIDEO_R2_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("VIDEO_R2_* environment variables are required");
  const client = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  const uploadResult = await uploadAll({
    client, bucket, prefix, files, concurrency, resume: Boolean(args.get("resume")),
  });
  console.log(`Upload result: ${uploadResult.uploaded} uploaded, ${uploadResult.skipped} unchanged.`);

  const finalizeValues = [args.get("api-base-url"), args.get("asset-id")];
  if (finalizeValues.some(Boolean) && !finalizeValues.every(Boolean)) {
    throw new Error("--api-base-url and --asset-id must be supplied together");
  }
  if (finalizeValues.every(Boolean)) {
    const adminToken = String(process.env.CSCA_ADMIN_TOKEN || "").trim();
    if (!adminToken) throw new Error("CSCA_ADMIN_TOKEN is required to call finalize");
    const assetId = Number(args.get("asset-id"));
    if (!Number.isSafeInteger(assetId) || assetId <= 0) throw new Error("--asset-id must be a positive integer");
    const data = await finalize({
      apiBaseUrl: args.get("api-base-url"),
      adminToken,
      assetId,
      manifestVersion: String(args.get("manifest-version") || "hls-v1"),
    });
    console.log(`Asset #${data.assetId} is ${data.status} with ${data.variants.length} variants.`);
  } else {
    console.log("Upload complete. Call the protected HLS finalize endpoint before publishing the course.");
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`Publish failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  argumentMap, orderUploadFiles, positiveIdPart, safePart, uploadAll, validateFiles,
  validateHlsDirectory,
};
