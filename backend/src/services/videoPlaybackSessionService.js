const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { assertPlaybackConfig } = require("../config/videoStorage");
const learningRepository = require("../repositories/learningRepository");
const videoPlaybackRepository = require("../repositories/videoPlaybackRepository");
const courseService = require("./courseService");
const { CourseApiError } = require("../utils/courseResponses");
const { toFiniteNumber } = require("../utils/courseContract");

function assertSafeAssetKey(value) {
  const key = String(value || "").trim();
  if (!/^private\/courses\/[A-Za-z0-9_-]+\/lessons\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/hls\/$/.test(key)) {
    throw new Error("INVALID_VIDEO_ASSET_PREFIX");
  }
  return key;
}

function assetPrefixFromMasterKey(value) {
  const masterKey = String(value || "").trim();
  const match = masterKey.match(
    /^(private\/courses\/[A-Za-z0-9_-]+\/lessons\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/hls\/)master\.m3u8$/,
  );
  if (!match) throw new Error("INVALID_VIDEO_MASTER_MANIFEST");
  return assertSafeAssetKey(match[1]);
}

function createPlaybackSession({ userId, lessonId, videoAssetId, assetPrefix, config }) {
  if (!userId || !lessonId || !videoAssetId) throw new Error("PLAYBACK_SCOPE_REQUIRED");
  const resolvedConfig = assertPlaybackConfig(config);
  const safePrefix = assertSafeAssetKey(assetPrefix);
  const sessionId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: String(userId),
      lessonId: String(lessonId),
      videoAssetId: String(videoAssetId),
      assetPrefix: safePrefix,
      scope: "video:read",
      jti: sessionId,
    },
    resolvedConfig.playbackTokenSecret,
    {
      algorithm: "HS256",
      expiresIn: resolvedConfig.playbackTtlSeconds,
      issuer: resolvedConfig.playbackTokenIssuer,
      audience: resolvedConfig.playbackTokenAudience,
    }
  );

  const decoded = jwt.decode(token);

  return {
    sessionId,
    playbackUrl: `${resolvedConfig.gatewayBaseUrl}/hls/master.m3u8?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(decoded.exp * 1000).toISOString(),
    expiresInSeconds: resolvedConfig.playbackTtlSeconds,
  };
}

function mapVariant(row) {
  return {
    resolution: row.resolution,
    width: toFiniteNumber(row.width),
    height: toFiniteNumber(row.height),
    bitrateKbps: Math.round(toFiniteNumber(row.bandwidth_bps) / 1000),
    isReady: row.is_ready === true,
  };
}

function playbackUnavailable(error) {
  if (error instanceof CourseApiError) return error;
  return new CourseApiError(503, "VIDEO_PLAYBACK_UNAVAILABLE", "Video playback is temporarily unavailable.");
}

async function createLessonPlaybackSessionUnsafe(lessonIdValue, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");

  await courseService.requireLearningAccess(lesson.course_id, user);
  if (lesson.lesson_type !== "video") {
    throw new CourseApiError(409, "LESSON_NOT_VIDEO", "This lesson does not contain video playback.");
  }

  const asset = await videoPlaybackRepository.findLessonVideoAsset(lessonId);
  if (!asset || asset.status !== "ready") {
    throw new CourseApiError(409, "VIDEO_NOT_READY", "The lesson video is not ready for playback.");
  }

  const [variantRows, resumePosition] = await Promise.all([
    videoPlaybackRepository.listReadyVariants(asset.id),
    videoPlaybackRepository.getResumePosition(user.id, lessonId),
  ]);
  if (variantRows.length === 0) {
    throw new CourseApiError(409, "VIDEO_NOT_READY", "The lesson video is not ready for playback.");
  }

  const session = createPlaybackSession({
    userId: user.id,
    lessonId,
    videoAssetId: asset.id,
    assetPrefix: assetPrefixFromMasterKey(asset.hls_master_object_key),
  });
  const durationSeconds = Math.max(0, Math.floor(toFiniteNumber(lesson.estimated_duration_seconds)));
  const storedResumeSeconds = Math.max(0, Math.floor(toFiniteNumber(resumePosition)));
  return {
    sessionId: session.sessionId,
    lessonId,
    deliveryType: "hls",
    manifestUrl: session.playbackUrl,
    expiresAt: session.expiresAt,
    variants: variantRows.map(mapVariant),
    resumePositionSeconds: durationSeconds > 0
      ? Math.min(storedResumeSeconds, durationSeconds)
      : storedResumeSeconds,
  };
}

async function createLessonPlaybackSession(lessonIdValue, user) {
  try {
    return await createLessonPlaybackSessionUnsafe(lessonIdValue, user);
  } catch (error) {
    throw playbackUnavailable(error);
  }
}

module.exports = {
  assetPrefixFromMasterKey,
  createPlaybackSession,
  createLessonPlaybackSession,
  mapVariant,
};
