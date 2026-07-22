const SUBJECT_CODES = Object.freeze([
  "MATH",
  "PHYSICS",
  "CHEMISTRY",
  "CHINESE_SCI",
  "CHINESE_SOC",
]);

const ACCESS_TYPES = Object.freeze(["free", "vip", "premium", "contact", "private"]);
const ENROLLMENT_STATUSES = Object.freeze(["active", "expired", "revoked", "completed"]);
const PROGRESS_STATUSES = Object.freeze(["not_started", "in_progress", "completed"]);

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapCourse(row) {
  if (!row) return null;
  return {
    id: toFiniteNumber(row.id),
    externalKey: row.external_key,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    subjectCode: row.subject_code,
    level: row.level,
    thumbnailUrl: row.thumbnail_url,
    previewVideoAssetId: toNullableNumber(row.preview_video_asset_id),
    instructorId: toNullableNumber(row.instructor_id),
    accessType: row.access_type,
    requiredTier: row.required_tier,
    priceVnd: toFiniteNumber(row.price_vnd),
    compareAtPriceVnd: toNullableNumber(row.compare_at_price_vnd),
    status: row.status,
    isFeatured: row.is_featured === true,
    isNew: row.is_new === true,
    isHot: row.is_hot === true,
    certificateEnabled: row.certificate_enabled === true,
    totalSections: toFiniteNumber(row.total_sections),
    totalLessons: toFiniteNumber(row.total_lessons),
    totalDurationSeconds: toFiniteNumber(row.total_duration_seconds),
    ratingAvg: toFiniteNumber(row.rating_avg),
    ratingCount: toFiniteNumber(row.rating_count),
    enrolledCount: toFiniteNumber(row.enrolled_count),
    publishedAt: row.published_at,
    contentUpdatedAt: row.content_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrollment(row) {
  if (!row) return null;
  return {
    id: toFiniteNumber(row.id),
    userId: toFiniteNumber(row.user_id),
    courseId: toFiniteNumber(row.course_id),
    source: row.source,
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProgress(row) {
  if (!row) return null;
  return {
    id: toFiniteNumber(row.id),
    userId: toFiniteNumber(row.user_id),
    courseId: toFiniteNumber(row.course_id),
    lessonId: toFiniteNumber(row.lesson_id),
    status: row.status,
    watchedSeconds: toFiniteNumber(row.watched_seconds),
    maxPositionSeconds: toFiniteNumber(row.max_position_seconds),
    lastPositionSeconds: toFiniteNumber(row.last_position_seconds),
    completionPct: toFiniteNumber(row.completion_pct),
    attemptCount: toFiniteNumber(row.attempt_count),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function mapLesson(row) {
  return {
    id: toFiniteNumber(row.id),
    externalKey: row.external_key,
    courseId: toFiniteNumber(row.course_id),
    sectionId: toFiniteNumber(row.section_id),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    lessonType: row.lesson_type,
    contentHtml: row.content_html,
    sortOrder: toFiniteNumber(row.sort_order),
    isPublished: row.is_published === true,
    isFreePreview: row.is_free_preview === true,
    isRequired: row.is_required === true,
    videoAssetId: toNullableNumber(row.video_asset_id),
    materialId: toNullableNumber(row.material_id),
    estimatedDurationSeconds: toFiniteNumber(row.estimated_duration_seconds),
    passingScore: toNullableNumber(row.passing_score),
    progress: row.progress_id ? mapProgress({
      id: row.progress_id,
      user_id: row.progress_user_id,
      course_id: row.course_id,
      lesson_id: row.id,
      status: row.progress_status,
      watched_seconds: row.watched_seconds,
      max_position_seconds: row.max_position_seconds,
      last_position_seconds: row.last_position_seconds,
      completion_pct: row.completion_pct,
      attempt_count: row.attempt_count,
      started_at: row.progress_started_at,
      completed_at: row.progress_completed_at,
      updated_at: row.progress_updated_at,
    }) : null,
  };
}

module.exports = {
  SUBJECT_CODES,
  ACCESS_TYPES,
  ENROLLMENT_STATUSES,
  PROGRESS_STATUSES,
  mapCourse,
  mapEnrollment,
  mapProgress,
  mapLesson,
  toFiniteNumber,
};
