const repository = require("../repositories/courseRepository");
const videoAccess = require('./videoLearningAccess');
const courseIntegrationRuntime = require('./courseIntegrationRuntime');
const { canAccessVipContent } = require("../utils/vipEntitlements");
const {
  SUBJECT_CODES,
  ACCESS_TYPES,
  mapCourse,
  mapEnrollment,
  mapLesson,
  toFiniteNumber,
} = require("../utils/courseContract");
const { CourseApiError } = require("../utils/courseResponses");

const ACTIVE_ENROLLMENT_STATUSES = new Set(["active", "completed"]);

function mergeCourseOwnershipView(base, ownershipInfo, localOwned = false) {
  const status = ownershipInfo && ownershipInfo.status !== "not_owned"
    ? ownershipInfo.status
    : (localOwned ? "owned" : "not_owned");
  const label = ownershipInfo && ownershipInfo.status !== "not_owned"
    ? ownershipInfo.label
    : (localOwned ? "Đã sở hữu" : "Mua khóa học");
  const owned = Boolean(ownershipInfo?.owned || localOwned);
  const checkoutReady = base?.checkoutReady !== false;
  const blockedUnpriced = !owned && !checkoutReady;
  return {
    ...base,
    checkoutReady,
    ownershipStatus: status,
    ownershipLabel: blockedUnpriced ? "Chưa mở bán" : label,
    owned,
    canPurchase: blockedUnpriced ? false : (!localOwned && (ownershipInfo?.canPurchase ?? true)),
    blockCode: ownershipInfo?.blockCode || (blockedUnpriced ? "PRICE_NOT_CONFIGURED" : null),
    canLaunchCourse: Boolean(ownershipInfo?.canLaunchCourse),
    courseOfferingId: ownershipInfo?.courseOfferingId || null,
    ssoTargetPath: ownershipInfo?.ssoTargetPath || null,
  };
}

async function loadCourseOwnershipMap(userId, courseIds, options = {}) {
  try {
    return await courseIntegrationRuntime.ownership.evaluateCoursesForUser(userId || null, courseIds, options);
  } catch {
    return new Map();
  }
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CourseApiError(400, "INVALID_PARAMETER", `${name} must be a positive integer.`);
  }
  return parsed;
}

function isActiveEnrollment(enrollment) {
  if (!enrollment || !ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)) return false;
  return !enrollment.expires_at || new Date(enrollment.expires_at) > new Date();
}

function hasEntitlement(user, course, enrollment = null, packageEntitlement = null, videoEntitlement = null) {
  if (user?.role === "admin") return true;
  if (!course) return false;
  if (videoEntitlement) return true;
  // An explicit, live admin grant opens the course regardless of its access type.
  if (isActiveEnrollment(enrollment) && enrollment.source === "admin") return true;
  if (course.access_type === "free") return true;
  if (course.access_type === "package") return Boolean(packageEntitlement);
  if (course.access_type === "vip") {
    return canAccessVipContent(user, "vip", course.subject_code);
  }
  if (course.access_type === "premium") {
    return canAccessVipContent(user, "premium", course.subject_code);
  }
  // contact/private are granted explicitly by an admin enrollment.
  return isActiveEnrollment(enrollment) && enrollment.source === "admin";
}

function accessView(user, course, enrollment, packageEntitlement = null, videoEntitlement = null) {
  const enrolled = isActiveEnrollment(enrollment);
  const entitled = hasEntitlement(user, course, enrollment, packageEntitlement, videoEntitlement);
  return {
    isEnrolled: enrolled,
    enrollmentStatus: enrollment?.status || null,
    canEnroll: Boolean(user) && enrollment?.status !== 'revoked' && !enrolled && entitled && (Boolean(videoEntitlement) || !["contact", "private"].includes(course.access_type)),
    canLearn: Boolean(user) && enrolled && entitled,
    denialCode: !user
      ? "AUTH_REQUIRED"
      : !entitled
        ? course.access_type === "vip" ? "VIP_REQUIRED"
          : course.access_type === "premium" ? "PREMIUM_REQUIRED"
            : course.access_type === "package" ? "PACKAGE_REQUIRED"
            : "ADMIN_ENROLLMENT_REQUIRED"
        : !enrolled ? "ENROLLMENT_REQUIRED" : null,
  };
}

function buildCurriculum(sections, lessons) {
  const bySection = new Map();
  for (const section of sections) {
    const mapped = {
      id: toFiniteNumber(section.id),
      courseId: toFiniteNumber(section.course_id),
      title: section.title,
      description: section.description,
      sortOrder: toFiniteNumber(section.sort_order),
      isPublished: section.is_published === true,
      lessons: [],
    };
    bySection.set(mapped.id, mapped);
  }
  for (const lesson of lessons) {
    bySection.get(toFiniteNumber(lesson.section_id))?.lessons.push(mapLesson(lesson));
  }
  return [...bySection.values()];
}

function mapCatalogItem(row) {
  const course = mapCourse(row);
  const totalLessons = toFiniteNumber(row.total_required);
  const completedLessons = toFiniteNumber(row.completed_required);
  const partialCompletionPct = row.course_completion_pct == null
    ? null
    : toFiniteNumber(row.course_completion_pct);
  const progress = row.enrollment_id ? {
    completedLessons,
    totalLessons,
    completionPct: partialCompletionPct == null
      ? (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0)
      : Math.min(100, Math.max(0, Math.round(partialCompletionPct * 100) / 100)),
    lastLessonId: null,
    lastLessonTitle: null,
    lastPositionSeconds: 0,
  } : null;
  return {
    id: course.id, externalKey: course.externalKey, slug: course.slug,
    title: course.title, shortDescription: course.shortDescription,
    subjectCode: course.subjectCode, level: course.level, thumbnailUrl: course.thumbnailUrl,
    accessType: course.accessType, priceVnd: row.price_vnd == null ? null : course.priceVnd,
    compareAtPriceVnd: course.compareAtPriceVnd, isFeatured: course.isFeatured,
    isNew: course.isNew, isHot: course.isHot, ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount, enrolledCount: course.enrolledCount,
    totalSections: course.totalSections, totalLessons: course.totalLessons,
    totalDurationSeconds: course.totalDurationSeconds, instructor: course.instructor, progress,
    contentOrigin: course.contentOrigin, remoteCourseId: course.remoteCourseId,
    checkoutReady: course.checkoutReady, profiles: course.profiles,
    commerceOffers: course.commerceOffers,
    packages: course.packages,
    publishedAt: course.publishedAt, contentUpdatedAt: course.contentUpdatedAt,
  };
}

async function mapEnrollmentDto(enrollment, course) {
  const row = await repository.getCourseProgress(enrollment.user_id, course.id);
  const totalLessons = toFiniteNumber(row?.required_lessons);
  const completedLessons = toFiniteNumber(row?.completed_lessons);
  const partialCompletionPct = row?.course_completion_pct == null
    ? null
    : toFiniteNumber(row.course_completion_pct);
  return {
    ...mapEnrollment(enrollment),
    courseSlug: course.slug,
    progress: {
      completedLessons,
      totalLessons,
      completionPct: partialCompletionPct == null
        ? (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0)
        : Math.min(100, Math.max(0, Math.round(partialCompletionPct * 100) / 100)),
      lastLessonId: null,
      lastLessonTitle: null,
      lastPositionSeconds: 0,
    },
  };
}

async function listCatalog(query, user) {
  const subjectCode = query.subjectCode ? String(query.subjectCode).toUpperCase() : null;
  const accessType = query.accessType ? String(query.accessType).toLowerCase() : null;
  if (subjectCode && !SUBJECT_CODES.includes(subjectCode)) {
    throw new CourseApiError(400, "INVALID_SUBJECT_CODE", "Unsupported CSCA subject code.");
  }
  if (accessType && !ACCESS_TYPES.includes(accessType)) {
    throw new CourseApiError(400, "INVALID_ACCESS_TYPE", "Unsupported course access type.");
  }
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.pageSize ?? query.limit, 10) || 12));
  const rows = await repository.listPublished({ userId: user?.id || null, subjectCode, accessType, page, limit });
  const ownershipByCourseId = await loadCourseOwnershipMap(user?.id || null, rows.map((r) => r.id));
  const total = toFiniteNumber(rows[0]?.total_count);
  return {
    items: rows.map((r) => mergeCourseOwnershipView(mapCatalogItem(r), ownershipByCourseId.get(Number(r.id)), Boolean(r.enrollment_id))), page, pageSize: limit,
    totalItems: total, totalPages: Math.ceil(total / limit),
  };
}

function buildProjectedCurriculum(row, projected, canLearnCourse) {
  const { profiles = [], activeProfile = null, units = [] } = projected || {};
  const bySection = new Map();
  const activeProfileRemoteId = activeProfile ? String(activeProfile.remote_profile_id) : null;
  const activeProfileProjId = activeProfile ? Number(activeProfile.id) : null;

  for (const unit of units) {
    const secKey = unit.remote_section_id || unit.section_title || "sec:default";
    if (!bySection.has(secKey)) {
      bySection.set(secKey, {
        id: Number(unit.section_sort_order ?? bySection.size) + 1,
        remoteSectionId: secKey,
        title: unit.section_title || "Chương 1",
        description: null,
        sortOrder: toFiniteNumber(unit.section_sort_order),
        totalDurationSeconds: 0,
        lessons: [],
      });
    }
    const sec = bySection.get(secKey);
    const durationSeconds = toFiniteNumber(unit.duration_seconds);
    const isPublicPreview = unit.is_public_preview === true;
    const slugId = `u-${unit.id}`;
    const href = activeProfileRemoteId
      ? `/hoc/${row.slug}/bai-hoc/${slugId}?profileId=${encodeURIComponent(activeProfileRemoteId)}`
      : `/hoc/${row.slug}/bai-hoc/${slugId}`;

    sec.totalDurationSeconds += durationSeconds;
    sec.lessons.push({
      id: slugId,
      unitProjectionId: Number(unit.id),
      externalKey: `${unit.unit_type}:${unit.remote_unit_id}`,
      slug: slugId,
      title: unit.title,
      summary: unit.summary || null,
      lessonType: "video",
      unitType: unit.unit_type,
      remoteUnitId: String(unit.remote_unit_id),
      profileId: activeProfileRemoteId,
      profileProjectionId: activeProfileProjId,
      href,
      sortOrder: toFiniteNumber(unit.sort_order),
      durationSeconds,
      isFreePreview: isPublicPreview,
      isPublicPreview,
      isRequired: true,
      isLocked: !isPublicPreview && !canLearnCourse,
      progressStatus: unit.progress_status || "not_started",
      videoPartCount: toFiniteNumber(unit.video_part_count),
      hasTheory: unit.has_theory === true,
      vocabCount: toFiniteNumber(unit.vocab_count),
      formulaCount: toFiniteNumber(unit.formula_count),
      fileCount: toFiniteNumber(unit.file_count),
      quizCount: toFiniteNumber(unit.quiz_count),
      assignmentCount: toFiniteNumber(unit.assignment_count),
    });
  }

  return {
    projectedProfiles: profiles.map((p) => {
      const caps = (p.metadata && typeof p.metadata === "object" && p.metadata.capabilities) || {};
      return {
        id: Number(p.id),
        profileProjectionId: Number(p.id),
        remoteProfileId: String(p.remote_profile_id),
        externalOfferingId: String(p.external_offering_id),
        mode: String(p.mode || "MIRROR").toUpperCase(),
        title: p.title || null,
        status: p.status || "active",
        allowFileDownload: caps.allowFileDownload != null
          ? Boolean(caps.allowFileDownload)
          : p.allow_file_download !== false,
        deviceLimit: toFiniteNumber(caps.deviceLimit ?? p.device_limit ?? 2),
      };
    }),
    activeProfileId: activeProfileRemoteId,
    activeProfileProjectionId: activeProfileProjId,
    detailCurriculum: [...bySection.values()],
  };
}

async function getCourseLanding(slug, user, options = {}) {
  const row = await repository.findPublishedBySlug(String(slug || "").trim());
  if (!row) throw new CourseApiError(404, "COURSE_NOT_FOUND", "Course not found.");
  const isExternalOrigin = row.content_origin === "csca_course";
  const enrollment = user && !isExternalOrigin ? await repository.findEnrollment(user.id, row.id) : null;
  const [curriculumData, projected, metadata, progressRow, packageEntitlement] = await Promise.all([
    isExternalOrigin
      ? Promise.resolve({ sections: [], lessons: [] })
      : repository.listCurriculum(row.id, { userId: user?.id || null }),
    isExternalOrigin
      ? repository.listProjectedCurriculum(row.id, {
          profileId: options?.profileId || null,
          userId: user?.id || null,
        })
      : Promise.resolve(null),
    repository.listCourseMetadata(row.id),
    user && enrollment ? repository.getCourseProgress(user.id, row.id) : null,
    user && row.access_type === "package"
      ? repository.findActivePackageEntitlement(user.id, row.id)
      : null,
  ]);
  const videoEntitlement = user ? await videoAccess.find(user.id, row.id) : null;
  const access = accessView(user, row, enrollment, packageEntitlement, videoEntitlement);
  const ownershipInfo = (await loadCourseOwnershipMap(user?.id || null, [row.id], {
    refreshFromCourse: Boolean(user && isExternalOrigin),
  })).get(Number(row.id)) || null;
  const effectiveCanLearn = isExternalOrigin
    ? Boolean(access.canLearn || (ownershipInfo?.owned && ownershipInfo?.canLaunchCourse))
    : access.canLearn;

  let totalLessons = toFiniteNumber(progressRow?.required_lessons);
  let completedLessons = toFiniteNumber(progressRow?.completed_lessons);
  let effectiveCompletionPct = progressRow?.course_completion_pct;
  let detailCurriculum;
  let projectedMeta = {};

  if (isExternalOrigin) {
    const built = buildProjectedCurriculum(row, projected, effectiveCanLearn);
    detailCurriculum = built.detailCurriculum;
    const extUnits = Array.isArray(projected?.units) ? projected.units : [];
    totalLessons = extUnits.length;
    if (user) {
      completedLessons = extUnits.filter((u) => u.progress_status === "completed").length;
      const pctSum = extUnits.reduce((sum, u) => sum + Math.min(100, Math.max(0, toFiniteNumber(u.watched_percent))), 0);
      effectiveCompletionPct = totalLessons > 0 ? Math.round((pctSum / totalLessons) * 100) / 100 : 0;
    } else {
      completedLessons = 0;
      effectiveCompletionPct = 0;
    }
    const firstUnit = detailCurriculum[0]?.lessons?.[0] || null;
    projectedMeta = {
      projectedProfiles: built.projectedProfiles,
      activeProfileId: built.activeProfileId,
      activeProfileProjectionId: built.activeProfileProjectionId,
      firstUnitHref: firstUnit?.href || null,
    };
  } else {
    detailCurriculum = buildCurriculum(curriculumData.sections, curriculumData.lessons).map((section) => {
      const mappedLessons = section.lessons.map((lesson) => ({
        id: lesson.id, externalKey: lesson.externalKey, slug: lesson.slug,
        title: lesson.title, summary: lesson.summary, lessonType: lesson.lessonType,
        sortOrder: lesson.sortOrder, durationSeconds: lesson.estimatedDurationSeconds,
        isFreePreview: lesson.isFreePreview, isRequired: lesson.isRequired,
        isLocked: !lesson.isFreePreview && !effectiveCanLearn,
        progressStatus: lesson.progress?.status || "not_started",
      }));
      return {
        id: section.id, title: section.title, description: section.description,
        sortOrder: section.sortOrder,
        totalDurationSeconds: mappedLessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
        lessons: mappedLessons,
      };
    });
  }

  const catalogItem = mapCatalogItem({
    ...row,
    enrollment_id: enrollment?.id
      || (isExternalOrigin && user && (effectiveCanLearn || ownershipInfo?.owned) ? -1 : null),
    completed_required: completedLessons,
    total_required: totalLessons,
    course_completion_pct: effectiveCompletionPct,
  });
  const unpricedSyncedBlock = !effectiveCanLearn && !ownershipInfo?.owned && catalogItem.checkoutReady === false;
  return {
    ...catalogItem,
    ...projectedMeta,
    descriptionHtml: row.description || "",
    outcomes: metadata.outcomes.map((item) => item.content),
    requirements: metadata.requirements.map((item) => item.content),
    suitableFor: [],
    certificateEnabled: row.certificate_enabled === true,
    access: {
      accessType: row.access_type,
      canEnroll: unpricedSyncedBlock ? false : access.canEnroll,
      canLearn: effectiveCanLearn,
      isEnrolled: isExternalOrigin ? Boolean(ownershipInfo?.owned) : access.isEnrolled,
      reasonCode: unpricedSyncedBlock ? "PRICE_NOT_CONFIGURED" : access.denialCode,
      ...mergeCourseOwnershipView({
        checkoutReady: catalogItem.checkoutReady,
        ctaLabel: effectiveCanLearn
          ? "Tiếp tục học"
          : unpricedSyncedBlock
            ? "Chưa mở bán"
            : access.canEnroll
              ? "Đăng ký học"
              : "Xem quyền truy cập",
      }, ownershipInfo, effectiveCanLearn),
    },
    curriculum: detailCurriculum,
  };
}

async function enroll(courseIdValue, user) {
  const courseId = positiveInteger(courseIdValue, "courseId");
  const course = await repository.findPublishedById(courseId);
  if (!course) throw new CourseApiError(404, "COURSE_NOT_FOUND", "Course not found.");
  const existing = await repository.findEnrollment(user.id, courseId);
  if (existing?.status === "revoked") {
    throw new CourseApiError(403, "ENROLLMENT_REVOKED", "This enrollment was revoked by an administrator.");
  }
  const [packageEntitlement, videoEntitlement, ownershipMap] = await Promise.all([
    course.access_type === "package"
      ? repository.findActivePackageEntitlement(user.id, courseId)
      : Promise.resolve(null),
    videoAccess.find(user.id, courseId),
    loadCourseOwnershipMap(user.id, [courseId]),
  ]);
  const ownershipInfo = ownershipMap.get(courseId) || null;
  if (ownershipInfo) {
    if (ownershipInfo.blockCode === "EXTERNAL_GRANT_BLOCKED" || ownershipInfo.status === "grant_blocked") {
      throw new CourseApiError(409, "EXTERNAL_GRANT_BLOCKED", "Course access is suspended or blocked on the linked CSCA-Course account.", { courseId });
    }
    if (ownershipInfo.blockCode === "PENDING_SYNC" || ownershipInfo.status === "pending_sync") {
      throw new CourseApiError(409, "PENDING_SYNC", "Course entitlement synchronization is currently pending.", { courseId });
    }
    if (ownershipInfo.blockCode === "IDENTITY_VERIFICATION_REQUIRED" || ownershipInfo.status === "verification_required") {
      throw new CourseApiError(409, "IDENTITY_VERIFICATION_REQUIRED", "Resolve account linking conflict before enrolling in this course.", { courseId });
    }
    const courseDtoCheck = mapCourse(course);
    if (
      ownershipInfo.externalOwnedCourseIds?.includes(courseId)
      || (courseDtoCheck.contentOrigin === "csca_course" && (ownershipInfo.owned || ownershipInfo.blockCode === "ALREADY_OWNED"))
    ) {
      throw new CourseApiError(409, "ALREADY_OWNED", "You already own access to this course.", {
        courseId,
        courseOfferingId: ownershipInfo.courseOfferingId || null,
        ssoTargetPath: ownershipInfo.ssoTargetPath || null,
      });
    }
  }
  const courseDto = mapCourse(course);
  if (courseDto.contentOrigin === "csca_course" && !courseDto.checkoutReady && !videoEntitlement && !packageEntitlement && !isActiveEnrollment(existing)) {
    throw new CourseApiError(422, "PRICE_NOT_CONFIGURED", "Course pricing is not configured for self-enrollment yet.");
  }
  if (!hasEntitlement(user, course, existing, packageEntitlement, videoEntitlement)) {
    throw new CourseApiError(
      403,
      course.access_type === "premium" ? "PREMIUM_REQUIRED"
        : course.access_type === "vip" ? "VIP_REQUIRED"
          : course.access_type === "package" ? "PACKAGE_REQUIRED"
            : "ADMIN_ENROLLMENT_REQUIRED",
      "You do not have access to enroll in this course.",
    );
  }
  if (isActiveEnrollment(existing)) return mapEnrollmentDto(existing, course);
  if (!videoEntitlement && ["contact", "private"].includes(course.access_type)) {
    throw new CourseApiError(403, "ADMIN_ENROLLMENT_REQUIRED", "This course requires enrollment by an administrator.");
  }
  const source = videoEntitlement ? 'video' : course.access_type === "free" ? "free" : course.access_type;
  const created = await repository.createEnrollment({
    userId: user.id,
    courseId,
    source,
    expiresAt: source === "free" || source === 'video'
      ? null
      : source === "package"
        ? packageEntitlement?.expires_at || null
        : user.vip_expires_at || null,
  });
  if (!isActiveEnrollment(created)) {
    throw new CourseApiError(409, "ENROLLMENT_INACTIVE", "An inactive enrollment already exists.");
  }
  return mapEnrollmentDto(created, course);
}

async function requireLearningAccess(courseIdValue, user) {
  const courseId = positiveInteger(courseIdValue, "courseId");
  // A newly purchased right may reactivate an expired enrollment, never a revoked one.
  if (await videoAccess.find(user.id, courseId)) await videoAccess.syncEnrollments(user.id);
  const [course, enrollment] = await Promise.all([
    repository.findPublishedById(courseId),
    repository.findEnrollment(user.id, courseId),
  ]);
  if (!course) throw new CourseApiError(404, "COURSE_NOT_FOUND", "Course not found.");
  if (!isActiveEnrollment(enrollment)) {
    throw new CourseApiError(403, "ENROLLMENT_REQUIRED", "An active enrollment is required.");
  }
  const packageEntitlement = course.access_type === "package"
    ? await repository.findActivePackageEntitlement(user.id, courseId)
    : null;
  const videoEntitlement = await videoAccess.find(user.id, courseId);
  if (!hasEntitlement(user, course, enrollment, packageEntitlement, videoEntitlement)) {
    throw new CourseApiError(403, "ENTITLEMENT_EXPIRED", "The entitlement for this course is no longer active.");
  }
  return { course, enrollment };
}

module.exports = {
  listCatalog,
  getCourseLanding,
  enroll,
  // Shared server-side authorization primitives for the canonical learner service.
  // They are not HTTP handlers and must never accept entitlement fields from clients.
  requireLearningAccess,
  isActiveEnrollment,
  hasEntitlement,
  buildCurriculum,
  positiveInteger,
  mergeCourseOwnershipView,
  loadCourseOwnershipMap,
};
