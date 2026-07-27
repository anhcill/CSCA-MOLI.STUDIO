const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { assertUploadConfig } = require("../config/videoStorage");
class VideoStorageNotImplementedError extends Error {
  constructor(operation) {
    super(`VIDEO_STORAGE_ADAPTER_NOT_IMPLEMENTED:${operation}`);
    this.code = "VIDEO_STORAGE_ADAPTER_NOT_IMPLEMENTED";
    this.statusCode = 503;
  }
}

function createR2VideoStorageAdapter({ config, client, signer = getSignedUrl } = {}) {
  const resolved = assertUploadConfig(config);
  const s3 = client || new S3Client({
    region: "auto",
    endpoint: resolved.endpoint,
    credentials: {
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
    },
  });

  return Object.freeze({
    async createUploadUrl({ objectKey, contentType, sizeBytes, checksumSha256 }) {
      const metadata = { sha256: checksumSha256.toLowerCase() };
      const command = new PutObjectCommand({
        Bucket: resolved.bucket,
        Key: objectKey,
        ContentType: contentType,
        Metadata: metadata,
      });
      return {
        uploadUrl: await signer(s3, command, {
          expiresIn: resolved.uploadTtlSeconds,
          // Keep integrity metadata in the signed request headers. Hoisting this
          // value into the query while also sending the required browser header
          // makes Cloudflare R2 reject the PUT with SignatureDoesNotMatch.
          unhoistableHeaders: new Set(["x-amz-meta-sha256"]),
        }),
        expiresInSeconds: resolved.uploadTtlSeconds,
        requiredHeaders: {
          "content-type": contentType,
          "x-amz-meta-sha256": metadata.sha256,
        },
      };
    },
    async headObject({ objectKey }) {
      const result = await s3.send(new HeadObjectCommand({ Bucket: resolved.bucket, Key: objectKey }));
      return {
        sizeBytes: Number(result.ContentLength),
        contentType: result.ContentType || null,
        etag: result.ETag ? String(result.ETag).replace(/^\"|\"$/g, "") : null,
        checksumSha256: result.Metadata?.sha256 || null,
      };
    },
    async getTextObject({ objectKey, maxBytes = 1024 * 1024 }) {
      const result = await s3.send(new GetObjectCommand({ Bucket: resolved.bucket, Key: objectKey }));
      const sizeBytes = Number(result.ContentLength);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > maxBytes) {
        const error = new Error("VIDEO_PLAYLIST_SIZE_INVALID");
        error.code = "VIDEO_PLAYLIST_SIZE_INVALID";
        throw error;
      }
      if (!result.Body || typeof result.Body.transformToString !== "function") {
        throw new Error("VIDEO_PLAYLIST_BODY_INVALID");
      }
      return {
        text: await result.Body.transformToString("utf-8"),
        sizeBytes,
        contentType: result.ContentType || null,
        etag: result.ETag ? String(result.ETag).replace(/^\"|\"$/g, "") : null,
      };
    },
    async deletePrefix({ prefix }) {
      const normalizedPrefix = String(prefix || "");
      if (!normalizedPrefix || !normalizedPrefix.endsWith("/")) {
        const error = new Error("VIDEO_DELETE_PREFIX_INVALID");
        error.code = "VIDEO_DELETE_PREFIX_INVALID";
        throw error;
      }
      let continuationToken;
      let deletedObjectCount = 0;
      do {
        const listed = await s3.send(new ListObjectsV2Command({
          Bucket: resolved.bucket,
          Prefix: normalizedPrefix,
          ContinuationToken: continuationToken,
        }));
        const objectKeys = (listed.Contents || [])
          .map((object) => object.Key)
          .filter((key) => typeof key === "string" && key.startsWith(normalizedPrefix));
        if (objectKeys.length > 0) {
          const deleted = await s3.send(new DeleteObjectsCommand({
            Bucket: resolved.bucket,
            Delete: {
              Objects: objectKeys.map((Key) => ({ Key })),
              Quiet: true,
            },
          }));
          if (deleted.Errors?.length) {
            const error = new Error("VIDEO_STORAGE_DELETE_FAILED");
            error.code = "VIDEO_STORAGE_DELETE_FAILED";
            error.details = deleted.Errors.map(({ Key, Code }) => ({ key: Key, code: Code }));
            throw error;
          }
          deletedObjectCount += objectKeys.length;
        }
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);
      return { deletedObjectCount };
    },
  });
}

function createPlaceholderVideoStorageAdapter() {
  const unavailable = (operation) => async () => {
    throw new VideoStorageNotImplementedError(operation);
  };
  return Object.freeze({
    createUploadUrl: unavailable("createUploadUrl"),
    completeMultipartUpload: unavailable("completeMultipartUpload"),
    abortMultipartUpload: unavailable("abortMultipartUpload"),
    deletePrefix: unavailable("deletePrefix"),
    getTextObject: unavailable("getTextObject"),
    headObject: unavailable("headObject"),
  });
}

module.exports = { VideoStorageNotImplementedError, createPlaceholderVideoStorageAdapter, createR2VideoStorageAdapter };
