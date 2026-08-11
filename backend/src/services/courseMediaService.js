const crypto = require("crypto");
const mediaRepository = require("../repositories/courseMediaRepository");
const { assertCanManageCourse } = require("../middleware/courseManagementScope");
const { CourseApiError } = require("../utils/courseResponses");
const { parseMasterPlaylist, parseVariantPlaylist } = require("../utils/hlsManifest");
const { createR2VideoStorageAdapter } = require("./videoStorageAdapter");

const SOURCE_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_SOURCE_BYTES = 20 * 1024 * 1024 * 1024;
const MAX_SINGLE_PUT_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_HLS_SEGMENTS = 20000;

function cleanPart(value) {
  const part = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new CourseApiError(400, "INVALID_VIDEO_KEY_PART", "Video key is invalid.");
  return part;
}

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new CourseApiError(400, "VIDEO_UPLOAD_INPUT_INVALID", `${field} must be a positive integer.`);
  return parsed;
}

function createSourceObjectKey({ courseId, lessonId, assetExternalKey, extension = "mp4" }) {
  const ext = extension === "mov" ? "mov" : "mp4";
  return `private/courses/${cleanPart(courseId)}/lessons/${cleanPart(lessonId)}/${cleanPart(assetExternalKey)}/source/${crypto.randomUUID()}.${ext}`;
}

function createHlsPrefix({ courseId, lessonId, assetExternalKey }) {
  return `private/courses/${cleanPart(courseId)}/lessons/${cleanPart(lessonId)}/${cleanPart(assetExternalKey)}/hls/`;
}

function createAssetPrefix({ courseId, lessonId, assetExternalKey }) {
  return `private/courses/${cleanPart(courseId)}/lessons/${cleanPart(lessonId)}/${cleanPart(assetExternalKey)}/`;
}

function validateSourceUpload({ contentType, sizeBytes, checksumSha256 }) {
  const mime = String(contentType || "").toLowerCase();
  if (!SOURCE_MIME_TYPES.has(mime)) throw new CourseApiError(415, "VIDEO_MIME_NOT_ALLOWED", "Only MP4 and MOV source videos are accepted.");
  const size = Number(sizeBytes);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SOURCE_BYTES) throw new CourseApiError(413, "VIDEO_SIZE_NOT_ALLOWED", "Video size is outside the supported range.");
  if (size > MAX_SINGLE_PUT_BYTES) throw new CourseApiError(422, "VIDEO_MULTIPART_REQUIRED", "Files larger than 4 GiB require multipart upload, which is not enabled yet.");
  const checksum = String(checksumSha256 || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new CourseApiError(400, "VIDEO_CHECKSUM_REQUIRED", "A lowercase hexadecimal SHA-256 checksum is required.");
  return { contentType: mime, sizeBytes: size, checksumSha256: checksum };
}

function storageMissing(error) {
  return error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404;
}

async function verifySegmentObjects(storage, objectKeys, concurrency = 16) {
  let cursor = 0;
  async function worker() {
    while (cursor < objectKeys.length) {
      const index = cursor;
      cursor += 1;
      let head;
      try { head = await storage.headObject({ objectKey: objectKeys[index] }); }
      catch (error) {
        if (storageMissing(error)) throw new CourseApiError(409, "VIDEO_HLS_SEGMENT_MISSING", "One or more HLS segments are missing.");
        throw error;
      }
      if (!Number.isSafeInteger(head.sizeBytes) || head.sizeBytes <= 0) {
        throw new CourseApiError(409, "VIDEO_HLS_SEGMENT_INVALID", "One or more HLS segments are empty or invalid.");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, objectKeys.length) }, () => worker()));
}

function createCourseMediaService({ storage, repository = mediaRepository, now = () => new Date(), authorizeCourse = assertCanManageCourse } = {}) {
  const getStorage = () => {
    try { return storage || createR2VideoStorageAdapter(); }
    catch (error) {
      if (error.code === "VIDEO_UPLOAD_CONFIG_MISSING") throw new CourseApiError(503, error.code, "Video upload storage is not configured.");
      throw error;
    }
  };
  return {
    async requestDirectUpload(input, actor) {
      const createdBy = positiveId(actor?.id, "actor.id");
      const courseId = positiveId(input.courseId, "courseId");
      const lessonId = positiveId(input.lessonId, "lessonId");
      await authorizeCourse(actor, courseId);
      const validated = validateSourceUpload(input);
      if (!await repository.findCourseLesson(courseId, lessonId)) {
        throw new CourseApiError(404, "COURSE_LESSON_NOT_FOUND", "The lesson does not belong to the selected course.");
      }
      const sessionId = crypto.randomUUID();
      const assetExternalKey = crypto.randomUUID();
      const extension = validated.contentType === "video/quicktime" ? "mov" : "mp4";
      const objectKey = createSourceObjectKey({ courseId, lessonId, assetExternalKey, extension });
      const upload = await getStorage().createUploadUrl({ ...validated, objectKey });
      const expiresAt = new Date(now().getTime() + upload.expiresInSeconds * 1000);
      const created = await repository.createSourceUpload({
        externalKey: sessionId, assetExternalKey, courseId, lessonId, objectKey,
        ...validated, expiresAt, createdBy,
      });
      return {
        sessionId,
        videoAssetId: Number(created.video_asset_id),
        assetExternalKey,
        uploadUrl: upload.uploadUrl,
        method: "PUT",
        requiredHeaders: upload.requiredHeaders,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async deleteVideoAsset(assetIdValue, actor) {
      positiveId(actor?.id, "actor.id");
      const assetId = positiveId(assetIdValue, "assetId");
      const asset = await repository.findAssetForDelete(assetId);
      if (!asset) throw new CourseApiError(404, "VIDEO_ASSET_NOT_FOUND", "Video asset was not found.");
      if (!asset.course_id || !asset.lesson_id) {
        throw new CourseApiError(409, "VIDEO_ASSET_NOT_DELETABLE", "Video asset is not attached to a course lesson.");
      }
      await authorizeCourse(actor, asset.course_id);
      const prefix = createAssetPrefix({
        courseId: asset.course_id,
        lessonId: asset.lesson_id,
        assetExternalKey: asset.external_key,
      });
      let storageResult;
      try {
        storageResult = await getStorage().deletePrefix({ prefix });
      } catch (error) {
        if (error?.code === "VIDEO_DELETE_PREFIX_INVALID") {
          throw new CourseApiError(409, error.code, "Video storage path is invalid.");
        }
        throw error;
      }
      try {
        const deleted = await repository.markAssetDeleted(assetId);
        return {
          ...deleted,
          status: "deleted",
          deletedObjectCount: Number(storageResult.deletedObjectCount || 0),
        };
      } catch (error) {
        if (error.code === "VIDEO_ASSET_NOT_FOUND") {
          throw new CourseApiError(404, error.code, "Video asset was not found.");
        }
        throw error;
      }
    },

    async completeDirectUpload(sessionId, actor) {
      const createdBy = positiveId(actor?.id, "actor.id");
      const key = String(sessionId || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(key)) throw new CourseApiError(400, "VIDEO_UPLOAD_ID_INVALID", "Upload session id is invalid.");
      const session = await repository.findSessionForAdmin(key, createdBy);
      if (!session) throw new CourseApiError(404, "VIDEO_UPLOAD_NOT_FOUND", "Upload session was not found.");
      await authorizeCourse(actor, session.course_id);
      if (session.status === "completed") return { sessionId: key, videoAssetId: Number(session.video_asset_id), status: "processing", alreadyCompleted: true };
      if (new Date(session.expires_at) <= now()) {
        await repository.expireSession(key, createdBy);
        throw new CourseApiError(409, "VIDEO_UPLOAD_NOT_COMPLETABLE", "Upload session is expired or no longer completable.");
      }
      if (!["created", "uploading"].includes(session.status)) {
        throw new CourseApiError(409, "VIDEO_UPLOAD_NOT_COMPLETABLE", "Upload session is expired or no longer completable.");
      }
      let head;
      try { head = await getStorage().headObject({ objectKey: session.object_key }); }
      catch (error) {
        if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) throw new CourseApiError(409, "VIDEO_SOURCE_NOT_FOUND", "The source object has not been uploaded.");
        throw error;
      }
      if (head.sizeBytes !== Number(session.expected_size_bytes)) throw new CourseApiError(409, "VIDEO_SIZE_MISMATCH", "Uploaded object size does not match the upload request.");
      if (String(head.contentType || "").toLowerCase() !== String(session.content_type).toLowerCase()) throw new CourseApiError(409, "VIDEO_MIME_MISMATCH", "Uploaded object content type does not match.");
      if (!head.checksumSha256 || head.checksumSha256.toLowerCase() !== String(session.expected_checksum_sha256).toLowerCase()) {
        throw new CourseApiError(409, "VIDEO_CHECKSUM_MISMATCH", "Uploaded object checksum metadata does not match.");
      }
      try {
        const completed = await repository.completeSourceUpload(key, createdBy, { etag: head.etag });
        return { sessionId: key, videoAssetId: Number(completed.video_asset_id), status: "processing", alreadyCompleted: completed.alreadyCompleted };
      } catch (error) {
        if (error.code === "VIDEO_UPLOAD_NOT_FOUND") throw new CourseApiError(404, error.code, "Upload session was not found.");
        if (error.code === "VIDEO_UPLOAD_NOT_COMPLETABLE") throw new CourseApiError(409, error.code, "Upload session is no longer completable.");
        throw error;
      }
    },

    async finalizeHlsAsset(assetIdValue, input, actor) {
      positiveId(actor?.id, "actor.id");
      const assetId = positiveId(assetIdValue, "assetId");
      const manifestVersion = input?.manifestVersion === undefined
        ? "hls-v1"
        : String(input.manifestVersion).trim();
      if (!/^[A-Za-z0-9._-]{1,30}$/.test(manifestVersion)) {
        throw new CourseApiError(422, "VIDEO_HLS_VERSION_INVALID", "HLS manifest version is invalid.");
      }
      const asset = await repository.findAssetForFinalize(assetId);
      if (!asset) throw new CourseApiError(404, "VIDEO_ASSET_NOT_FOUND", "Video asset was not found.");
      await authorizeCourse(actor, asset.course_id);
      if (!asset.course_id || !asset.lesson_id || !["processing", "ready"].includes(asset.status)) {
        throw new CourseApiError(409, "VIDEO_ASSET_NOT_FINALIZABLE", "Video asset is not ready for HLS finalization.");
      }

      const prefix = createHlsPrefix({
        courseId: asset.course_id,
        lessonId: asset.lesson_id,
        assetExternalKey: asset.external_key,
      });
      const masterObjectKey = `${prefix}master.m3u8`;
      const r2 = getStorage();
      let master;
      try { master = await r2.getTextObject({ objectKey: masterObjectKey }); }
      catch (error) {
        if (storageMissing(error)) throw new CourseApiError(409, "VIDEO_HLS_MASTER_MISSING", "HLS master playlist is missing.");
        if (error?.code === "VIDEO_PLAYLIST_SIZE_INVALID") throw new CourseApiError(409, error.code, "HLS master playlist is too large.");
        throw error;
      }

      let masterVariants;
      try { masterVariants = parseMasterPlaylist(master.text); }
      catch (error) { throw new CourseApiError(409, error.code || "VIDEO_HLS_MANIFEST_INVALID", "HLS master playlist is invalid."); }

      const verifiedVariants = await Promise.all(masterVariants.map(async (variant) => {
        const playlistObjectKey = `${prefix}${variant.playlistRelativePath}`;
        let playlist;
        try { playlist = await r2.getTextObject({ objectKey: playlistObjectKey }); }
        catch (error) {
          if (storageMissing(error)) throw new CourseApiError(409, "VIDEO_HLS_VARIANT_MISSING", "An HLS variant playlist is missing.");
          if (error?.code === "VIDEO_PLAYLIST_SIZE_INVALID") {
            throw new CourseApiError(409, error.code, "An HLS variant playlist is too large.");
          }
          throw error;
        }
        let parsed;
        try { parsed = parseVariantPlaylist(playlist.text, variant.playlistRelativePath); }
        catch (error) { throw new CourseApiError(409, error.code || "VIDEO_HLS_MANIFEST_INVALID", "An HLS variant playlist is invalid."); }
        return { ...variant, ...parsed, playlistObjectKey, segmentPrefix: `${prefix}${variant.playlistRelativePath.split("/")[0]}/` };
      }));

      const segmentPaths = [...new Set(verifiedVariants.flatMap((variant) => variant.segments.map((segment) => segment.relativePath)))];
      if (segmentPaths.length === 0 || segmentPaths.length > MAX_HLS_SEGMENTS) {
        throw new CourseApiError(409, "VIDEO_HLS_SEGMENT_COUNT_INVALID", "HLS segment count is outside the supported range.");
      }
      await verifySegmentObjects(r2, segmentPaths.map((relativePath) => `${prefix}${relativePath}`));

      const durations = verifiedVariants.map((variant) => variant.durationSeconds);
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      if (maxDuration - minDuration > Math.max(1, maxDuration * 0.02)) {
        throw new CourseApiError(409, "VIDEO_HLS_DURATION_MISMATCH", "HLS rendition durations do not match.");
      }
      const variants = verifiedVariants.map((variant) => ({
        resolution: variant.resolution,
        width: variant.width,
        height: variant.height,
        videoCodec: variant.videoCodec,
        audioCodec: variant.audioCodec,
        bandwidthBps: variant.bandwidthBps,
        averageBandwidthBps: variant.averageBandwidthBps ? Math.round(variant.averageBandwidthBps) : null,
        frameRate: variant.frameRate,
        durationSeconds: variant.durationSeconds,
        playlistObjectKey: variant.playlistObjectKey,
        segmentPrefix: variant.segmentPrefix,
        segmentCount: variant.segmentCount,
      }));
      try {
        const result = await repository.markHlsReady({
          assetId,
          masterObjectKey,
          manifestVersion,
          durationSeconds: maxDuration,
          segmentDurationSeconds: Math.max(...verifiedVariants.map((variant) => variant.targetDurationSeconds)),
          variants,
        });
        return {
          ...result,
          status: "ready",
          durationSeconds: maxDuration,
          variants: variants.map(({ resolution, width, height, bandwidthBps }) => ({
            resolution, width, height, bitrateKbps: Math.round(bandwidthBps / 1000), isReady: true,
          })),
        };
      } catch (error) {
        if (["VIDEO_ASSET_NOT_FOUND", "VIDEO_ASSET_NOT_FINALIZABLE", "VIDEO_ASSET_LESSON_MISMATCH"].includes(error.code)) {
          throw new CourseApiError(error.code === "VIDEO_ASSET_NOT_FOUND" ? 404 : 409, error.code, "Video asset could not be finalized.");
        }
        throw error;
      }
    },
  };
}

module.exports = {
  MAX_SINGLE_PUT_BYTES,
  createCourseMediaService,
  createAssetPrefix,
  createHlsPrefix,
  createSourceObjectKey,
  validateSourceUpload,
  verifySegmentObjects,
};
