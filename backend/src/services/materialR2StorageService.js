const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const R2_URL_PREFIX = "/api/materials/r2/";
const DEFAULT_REGION = "auto";

function getR2Config() {
  return {
    endpoint: String(process.env.R2_ENDPOINT || "").replace(/\/+$/, ""),
    accountId: String(process.env.R2_ACCOUNT_ID || "").trim(),
    accessKeyId: String(process.env.R2_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || "").trim(),
    bucket: String(process.env.R2_BUCKET || "").trim(),
    region: String(process.env.R2_REGION || DEFAULT_REGION).trim() || DEFAULT_REGION,
  };
}

function getR2Endpoint(config = getR2Config()) {
  if (config.endpoint) return config.endpoint;
  if (config.accountId) return `https://${config.accountId}.r2.cloudflarestorage.com`;
  return "";
}

function assertR2Configured() {
  const config = getR2Config();
  if (!getR2Endpoint(config) || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    const error = new Error("R2_CONFIG_MISSING");
    error.statusCode = 503;
    error.publicMessage = "Kho lưu trữ R2 chưa được cấu hình.";
    throw error;
  }
  return config;
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeR2Token(key) {
  return Buffer.from(String(key || ""), "utf8").toString("base64url");
}

function decodeR2Token(token) {
  try {
    const key = Buffer.from(String(token || ""), "base64url").toString("utf8").trim();
    if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return "";
    return key;
  } catch {
    return "";
  }
}

function getR2PdfUrl(key) {
  return `${R2_URL_PREFIX}${encodeR2Token(key)}`;
}

function getR2KeyFromUrl(fileUrl) {
  const value = String(fileUrl || "").trim();
  if (!value) return "";

  const markerIndex = value.indexOf(R2_URL_PREFIX);
  if (markerIndex >= 0) {
    return decodeR2Token(value.slice(markerIndex + R2_URL_PREFIX.length).split(/[?#/]/)[0]);
  }

  if (value.startsWith("moli-r2-pdf:")) {
    const key = value.slice("moli-r2-pdf:".length).trim();
    return key && !key.includes("..") && !key.startsWith("/") && !key.includes("\\") ? key : "";
  }

  return "";
}

function getSafeFileName(originalName) {
  const parsed = path.parse(String(originalName || "material.pdf"));
  const name = (parsed.name || "material")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "material";
  const ext = (parsed.ext || ".pdf").toLowerCase() === ".pdf" ? ".pdf" : ".pdf";
  return `${name}${ext}`;
}

function createR2ObjectKey(originalName) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(8).toString("hex");
  return `materials/${year}/${month}/${Date.now()}-${random}-${getSafeFileName(originalName)}`;
}

function hashFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function getSigningKey(secretAccessKey, dateStamp, region) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function getAmzDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function getCanonicalUri(bucket, key) {
  const encodedKey = String(key || "")
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
  return `/${encodeRfc3986(bucket)}/${encodedKey}`;
}

function signR2Request({ method, key, headers = {}, payloadHash = "UNSIGNED-PAYLOAD", config }) {
  const endpoint = new URL(getR2Endpoint(config));
  const { amzDate, dateStamp } = getAmzDates();
  const canonicalUri = getCanonicalUri(config.bucket, key);
  const lowerHeaders = {
    host: endpoint.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  for (const [header, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) {
      lowerHeaders[header.toLowerCase()] = String(value).trim();
    }
  }

  const sortedHeaderNames = Object.keys(lowerHeaders).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((header) => `${header}:${String(lowerHeaders[header]).replace(/\s+/g, " ")}`)
    .join("\n") + "\n";
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = hmac(getSigningKey(config.secretAccessKey, dateStamp, config.region), stringToSign, "hex");

  return {
    url: `${endpoint.origin}${canonicalUri}`,
    headers: {
      ...headers,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function requestR2({ method, key, headers = {}, bodyStream, payloadHash = "UNSIGNED-PAYLOAD", config = assertR2Configured() }) {
  const signed = signR2Request({ method, key, headers, payloadHash, config });

  return new Promise((resolve, reject) => {
    const req = https.request(signed.url, { method, headers: signed.headers }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(res);
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const message = Buffer.concat(chunks).toString("utf8") || `R2 request failed with status ${res.statusCode}`;
        const error = new Error(message);
        error.statusCode = res.statusCode;
        reject(error);
      });
    });

    req.on("error", reject);
    if (bodyStream) {
      bodyStream.on("error", reject);
      bodyStream.pipe(req);
    } else {
      req.end();
    }
  });
}

async function uploadPdfToR2({
  filePath,
  originalName,
  mimeType = "application/pdf",
  fileSize,
}) {
  const config = assertR2Configured();
  const key = createR2ObjectKey(originalName);
  const size = Number(fileSize || (await fs.promises.stat(filePath)).size);
  const payloadHash = await hashFileSha256(filePath);
  const headers = {
    "Content-Length": String(size),
    "Content-Type": mimeType || "application/pdf",
  };

  const response = await requestR2({
    method: "PUT",
    key,
    headers,
    payloadHash,
    bodyStream: fs.createReadStream(filePath),
    config,
  });
  response.resume();

  return {
    key,
    url: getR2PdfUrl(key),
    publicId: key,
    fileSize: size,
    storage: "r2",
  };
}

async function getR2ObjectStream(key, { range } = {}) {
  const config = assertR2Configured();
  const response = await requestR2({
    method: "GET",
    key,
    headers: range ? { Range: range } : {},
    payloadHash: "UNSIGNED-PAYLOAD",
    config,
  });
  return response;
}

async function deleteR2Object(key) {
  const config = assertR2Configured();
  const response = await requestR2({
    method: "DELETE",
    key,
    payloadHash: "UNSIGNED-PAYLOAD",
    config,
  });
  response.resume();
  return true;
}

module.exports = {
  R2_URL_PREFIX,
  assertR2Configured,
  deleteR2Object,
  getR2KeyFromUrl,
  getR2ObjectStream,
  getR2PdfUrl,
  uploadPdfToR2,
};
