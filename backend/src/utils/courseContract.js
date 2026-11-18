const SUBJECT_CODES = Object.freeze([
  "MATH",
  "PHYSICS",
  "CHEMISTRY",
  "CHINESE_SCI",
  "CHINESE_SOC",
]);

const ACCESS_TYPES = Object.freeze(["free", "package", "vip", "premium", "contact", "private"]);
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

function parseProjectedProfiles(row) {
  if (!Array.isArray(row?.projected_profiles)) return [];
  return row.projected_profiles
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: toFiniteNumber(p.id),
      remoteProfileId: p.remoteProfileId || p.remote_profile_id || null,
      externalOfferingId: p.externalOfferingId || p.external_offering_id || null,
      mode: p.mode || "INDEPENDENT",
      badgeLabel: p.badgeLabel || p.badge_label || null,
      status: p.status || "active",
      checkoutReady: p.checkoutReady === true || p.checkout_ready === true,
      managementClassId: p.managementClassId || p.management_class_id || null,
      sourceLiveClassId: p.sourceLiveClassId || p.source_live_class_id || null,
      allowFileDownload: p.allowFileDownload !== false && p.allow_file_download !== false,
      deviceLimit: toNullableNumber(p.deviceLimit ?? p.device_limit) ?? 2,
      enforceTrustedDevices: p.enforceTrustedDevices !== false && p.enforce_trusted_devices !== false,
    }));
}

function parseRemoteInstructor(row) {
  const remoteMeta = row?.remote_metadata && typeof row.remote_metadata === "object"
    ? row.remote_metadata
    : null;
  const profileWithInstructor = Array.isArray(row?.projected_profiles)
    ? row.projected_profiles.find((p) => p && typeof p === "object" && p.instructor)
    : null;
  const raw = remoteMeta?.instructor || profileWithInstructor?.instructor || null;
  if (!raw || typeof raw !== "object") return null;
  const displayName = String(raw.displayName || raw.fullName || raw.name || "").trim();
  if (!displayName) return null;
  return {
    id: raw.id ?? toNullableNumber(row.instructor_id) ?? 0,
    displayName,
    avatarUrl: raw.avatarUrl || null,
    headline: raw.headline || raw.title || raw.role || null,
  };
}

function parseCommerceOffers(row) {
  if (!Array.isArray(row?.commerce_offers)) return [];
  return row.commerce_offers
    .filter((offer) => offer && typeof offer === "object")
    .map((offer) => ({
      id: toFiniteNumber(offer.id),
      type: offer.type === "combo" ? "combo" : "video",
      name: String(offer.name || "").trim(),
      priceVnd: toNullableNumber(offer.priceVnd ?? offer.price_vnd),
      originalPriceVnd: toNullableNumber(offer.originalPriceVnd ?? offer.original_price_vnd),
      requiresSubjectChoice: offer.requiresSubjectChoice === true || offer.requires_subject_choice === true,
    }))
    .filter((offer) => offer.id > 0 && offer.name && Number(offer.priceVnd) > 0);
}

function mapCourse(row) {
  if (!row) return null;
  const profiles = parseProjectedProfiles(row);
  const commerceOffers = parseCommerceOffers(row);
  const instructor = parseRemoteInstructor(row);
  const contentOrigin = row.content_origin === "csca_course" ? "csca_course" : "moly_native";
  const priceVnd = toFiniteNumber(row.price_vnd);
  const hasReadyProfile = profiles.some((p) => p.status === "active" && p.checkoutReady === true);
  const hasPricedVideoPackage = row.has_priced_video_package === true;
  const checkoutReady = contentOrigin !== "csca_course"
    ? true
    : (
      row.access_type === "free"
      || (profiles.length > 0 ? hasReadyProfile : (priceVnd > 0 || hasPricedVideoPackage))
    );
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
    instructor,
    accessType: row.access_type,
    requiredTier: row.required_tier,
    packages: Array.isArray(row.packages)
      ? row.packages.map((pkg) => ({ id: toFiniteNumber(pkg.id), name: pkg.name }))
      : [],
    priceVnd,
    compareAtPriceVnd: toNullableNumber(row.compare_at_price_vnd),
    status: row.status,
    contentOrigin,
    remoteCourseId: row.remote_course_id || null,
    syncRevision: toNullableNumber(row.sync_revision),
    profiles,
    commerceOffers,
    checkoutReady,
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
