const repository = require("../repositories/courseRepository");
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

function hasEntitlement(user, course, enrollment = null) {
  if (user?.role === "admin") return true;
  if (!course) return false;
  if (course.access_type === "free") return true;
  if (course.access_type === "vip") {
    return canAccessVipContent(user, "vip", course.subject_code);
  }
  if (course.access_type === "premium") {
    return canAccessVipContent(user, "premium", course.subject_code);
  }
  // contact/private are granted explicitly by an admin enrollment.
  return isActiveEnrollment(enrollment) && enrollment.source === "admin";
}

function accessView(user, course, enrollment) {
  const enrolled = isActiveEnrollment(enrollment);
  const entitled = hasEntitlement(user, course, enrollment);
  return {
    isEnrolled: enrolled,
    enrollmentStatus: enrollment?.status || null,
    canEnroll: Boolean(user) && !enrolled && entitled && !["contact", "private"].includes(course.access_type),
    canLearn: Boolean(user) && enrolled && entitled,
    denialCode: !user
      ? "AUTH_REQUIRED"
      : !entitled
        ? course.access_type === "vip" ? "VIP_REQUIRED"
          : course.access_type === "premium" ? "PREMIUM_REQUIRED"
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
  const progress = row.enrollment_id ? {
    completedLessons,
    totalLessons,
    completionPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0,
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
    totalDurationSeconds: course.totalDurationSeconds, instructor: null, progress,
    publishedAt: course.publishedAt, contentUpdatedAt: course.contentUpdatedAt,
  };
}

async function mapEnrollmentDto(enrollment, course) {
  const row = await repository.getCourseProgress(enrollment.user_id, course.id);
  const totalLessons = toFiniteNumber(row?.required_lessons);
  const completedLessons = toFiniteNumber(row?.completed_lessons);
  return {
    ...mapEnrollment(enrollment),
    courseSlug: course.slug,
    progress: {
      completedLessons,
      totalLessons,
      completionPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0,
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
  const total = toFiniteNumber(rows[0]?.total_count);
  return {
    items: rows.map(mapCatalogItem), page, pageSize: limit,
    totalItems: total, totalPages: Math.ceil(total / limit),
  };
}

async function getCourseLanding(slug, user) {
  const row = await repository.findPublishedBySlug(String(slug || "").trim());
  if (!row) throw new CourseApiError(404, "COURSE_NOT_FOUND", "Course not found.");
  const enrollment = user ? await repository.findEnrollment(user.id, row.id) : null;
  const [{ sections, lessons }, metadata, progressRow] = await Promise.all([
    repository.listCurriculum(row.id, { userId: user?.id || null }),
    repository.listCourseMetadata(row.id),
    user && enrollment ? repository.getCourseProgress(user.id, row.id) : null,
  ]);
  const access = accessView(user, row, enrollment);
  const totalLessons = toFiniteNumber(progressRow?.required_lessons);
  const completedLessons = toFiniteNumber(progressRow?.completed_lessons);
  const detailCurriculum = buildCurriculum(sections, lessons).map((section) => {
    const mappedLessons = section.lessons.map((lesson) => ({
      id: lesson.id, externalKey: lesson.externalKey, slug: lesson.slug,
      title: lesson.title, summary: lesson.summary, lessonType: lesson.lessonType,
      sortOrder: lesson.sortOrder, durationSeconds: lesson.estimatedDurationSeconds,
      isFreePreview: lesson.isFreePreview, isRequired: lesson.isRequired,
      isLocked: !lesson.isFreePreview && !access.canLearn,
      progressStatus: lesson.progress?.status || "not_started",
    }));
    return {
      id: section.id, title: section.title, description: section.description,
      sortOrder: section.sortOrder,
      totalDurationSeconds: mappedLessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
      lessons: mappedLessons,
    };
  });
  return {
    ...mapCatalogItem({
      ...row,
      enrollment_id: enrollment?.id,
      completed_required: completedLessons,
      total_required: totalLessons,
    }),
    descriptionHtml: row.description || "",
    outcomes: metadata.outcomes.map((item) => item.content),
    requirements: metadata.requirements.map((item) => item.content),
    suitableFor: [],
    certificateEnabled: row.certificate_enabled === true,
    access: {
      accessType: row.access_type,
      canEnroll: access.canEnroll,
      canLearn: access.canLearn,
      isEnrolled: access.isEnrolled,
      reasonCode: access.denialCode,
      ctaLabel: access.canLearn ? "Tiếp tục học" : access.canEnroll ? "Đăng ký học" : "Xem quyền truy cập",
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
  if (isActiveEnrollment(existing)) return mapEnrollmentDto(existing, course);
  if (!hasEntitlement(user, course, existing)) {
    throw new CourseApiError(
      403,
      course.access_type === "premium" ? "PREMIUM_REQUIRED" : course.access_type === "vip" ? "VIP_REQUIRED" : "ADMIN_ENROLLMENT_REQUIRED",
      "You do not have access to enroll in this course.",
    );
  }
  if (["contact", "private"].includes(course.access_type)) {
    throw new CourseApiError(403, "ADMIN_ENROLLMENT_REQUIRED", "This course requires enrollment by an administrator.");
  }
  const source = course.access_type === "free" ? "free" : course.access_type;
  const created = await repository.createEnrollment({
    userId: user.id,
    courseId,
    source,
    expiresAt: source === "free" ? null : user.vip_expires_at || null,
  });
  if (!isActiveEnrollment(created)) {
    throw new CourseApiError(409, "ENROLLMENT_INACTIVE", "An inactive enrollment already exists.");
  }
  return mapEnrollmentDto(created, course);
}

async function requireLearningAccess(courseIdValue, user) {
  const courseId = positiveInteger(courseIdValue, "courseId");
  const [course, enrollment] = await Promise.all([
    repository.findPublishedById(courseId),
    repository.findEnrollment(user.id, courseId),
  ]);
  if (!course) throw new CourseApiError(404, "COURSE_NOT_FOUND", "Course not found.");
  if (!isActiveEnrollment(enrollment)) {
    throw new CourseApiError(403, "ENROLLMENT_REQUIRED", "An active enrollment is required.");
  }
  if (!hasEntitlement(user, course, enrollment)) {
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
};
