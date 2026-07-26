const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");
const repository = require("../repositories/adminCourseRepository");
const { CourseApiError } = require("../utils/courseResponses");

const SUBJECTS = new Set(["MATH", "PHYSICS", "CHEMISTRY", "CHINESE_SCI", "CHINESE_SOC"]);
const LEVELS = new Set(["basic", "intermediate", "advanced"]);
const ACCESS_TYPES = new Set(["free", "package", "vip", "premium", "contact", "private"]);
const COURSE_STATUSES = new Set(["draft", "review", "published", "archived"]);
const LESSON_TYPES = new Set(["video", "article", "document", "quiz"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLEAN_HTML_OPTIONS = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li", "h2", "h3", "h4", "pre", "code", "a", "img", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title"], "*": ["class"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true) },
};

function fail(status, code, message, details) {
  throw new CourseApiError(status, code, message, details);
}

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, "ADMIN_COURSE_INVALID_ID", `${field} must be a positive integer.`);
  return id;
}

function stringValue(value, field, { required = false, max = 255, nullable = false } = {}) {
  if (value === null && nullable) return null;
  if (value === undefined) {
    if (required) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string") fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be a string.`);
  const clean = value.trim();
  if (required && !clean) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} is required.`);
  if (clean.length > max) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} is too long.`);
  return clean || (nullable ? null : clean);
}

function booleanValue(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be boolean.`);
  return value;
}

function integerValue(value, field, { min = 0, nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (!Number.isSafeInteger(value) || value < min) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be an integer >= ${min}.`);
  return value;
}

function decimalValue(value, field, { min = 0, max = 100, nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be between ${min} and ${max}.`);
  }
  return value;
}

function positiveIdList(value, field) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be an array.`);
  }
  return [...new Set(value.map((item) => positiveId(item, field)))];
}

function enumValue(value, field, allowed, { required = false } = {}) {
  if (value === undefined) {
    if (required) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} is invalid.`, { allowed: [...allowed] });
  }
  return value;
}

function slugValue(value, { required = false } = {}) {
  const slug = stringValue(value, "slug", { required, max: 160 });
  if (slug !== undefined && !SLUG_PATTERN.test(slug)) {
    fail(422, "ADMIN_COURSE_VALIDATION_FAILED", "slug must contain lowercase letters, digits and single hyphens only.");
  }
  return slug;
}

function cleanHtml(value, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") fail(422, "ADMIN_COURSE_VALIDATION_FAILED", `${field} must be a string.`);
  return sanitizeHtml(value, CLEAN_HTML_OPTIONS);
}

function requiredTierFor(accessType) {
  if (accessType === "vip") return "vip";
  if (accessType === "premium") return "premium";
  return "basic";
}

function externalKey(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function normalizeCourseInput(body, { create = false } = {}) {
  const accessType = enumValue(body.accessType, "accessType", ACCESS_TYPES, { required: create });
  const status = enumValue(body.status, "status", COURSE_STATUSES);
  if (status === "published") fail(409, "ADMIN_COURSE_PUBLISH_ENDPOINT_REQUIRED", "Use the publish endpoint to publish a course.");
  const values = {
    slug: slugValue(body.slug, { required: create }),
    title: stringValue(body.title, "title", { required: create, max: 255 }),
    shortDescription: stringValue(body.shortDescription, "shortDescription", { max: 2000, nullable: true }),
    // descriptionHtml is canonical; description remains a temporary alias for
    // the early admin scaffold so older drafts are not silently discarded.
    description: cleanHtml(
      body.descriptionHtml !== undefined ? body.descriptionHtml : body.description,
      "descriptionHtml",
    ),
    subjectCode: enumValue(body.subjectCode, "subjectCode", SUBJECTS, { required: create }),
    level: enumValue(body.level, "level", LEVELS),
    thumbnailUrl: stringValue(body.thumbnailUrl, "thumbnailUrl", { max: 1000, nullable: true }),
    instructorId: body.instructorId === undefined ? undefined : (body.instructorId === null ? null : positiveId(body.instructorId, "instructorId")),
    accessType,
    packageIds: positiveIdList(body.packageIds, "packageIds"),
    priceVnd: integerValue(body.priceVnd, "priceVnd"),
    compareAtPriceVnd: integerValue(body.compareAtPriceVnd, "compareAtPriceVnd", { nullable: true }),
    status,
    isFeatured: booleanValue(body.isFeatured, "isFeatured"),
    isNew: booleanValue(body.isNew, "isNew"),
    isHot: booleanValue(body.isHot, "isHot"),
    certificateEnabled: booleanValue(body.certificateEnabled, "certificateEnabled"),
  };
  if (body.previewVideoAssetId !== undefined) {
    values.previewVideoAssetId = body.previewVideoAssetId === null ? null : positiveId(body.previewVideoAssetId, "previewVideoAssetId");
  }
  if (accessType !== undefined) values.requiredTier = requiredTierFor(accessType);
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function normalizeSectionInput(body, { create = false } = {}) {
  const values = {
    title: stringValue(body.title, "title", { required: create, max: 255 }),
    description: stringValue(body.description, "description", { max: 5000, nullable: true }),
    sortOrder: integerValue(body.sortOrder, "sortOrder"),
    isPublished: booleanValue(body.isPublished, "isPublished"),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function normalizeLessonInput(body, { create = false } = {}) {
  const lessonType = enumValue(body.lessonType, "lessonType", LESSON_TYPES);
  const values = {
    sectionId: body.sectionId === undefined ? undefined : positiveId(body.sectionId, "sectionId"),
    slug: slugValue(body.slug, { required: create }),
    title: stringValue(body.title, "title", { required: create, max: 255 }),
    summary: stringValue(body.summary, "summary", { max: 5000, nullable: true }),
    lessonType,
    contentHtml: cleanHtml(body.contentHtml, "contentHtml"),
    sortOrder: integerValue(body.sortOrder, "sortOrder"),
    isPublished: booleanValue(body.isPublished, "isPublished"),
    isFreePreview: booleanValue(body.isFreePreview, "isFreePreview"),
    isRequired: booleanValue(body.isRequired, "isRequired"),
    videoAssetId: body.videoAssetId === undefined ? undefined : (body.videoAssetId === null ? null : positiveId(body.videoAssetId, "videoAssetId")),
    materialId: body.materialId === undefined ? undefined : (body.materialId === null ? null : positiveId(body.materialId, "materialId")),
    estimatedDurationSeconds: integerValue(body.estimatedDurationSeconds, "estimatedDurationSeconds"),
    passingScore: decimalValue(body.passingScore, "passingScore", { nullable: true }),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function mapCourse(row) {
  if (!row) return null;
  return {
    id: numberOrNull(row.id), externalKey: row.external_key, slug: row.slug, title: row.title,
    shortDescription: row.short_description, descriptionHtml: row.description || "", subjectCode: row.subject_code,
    level: row.level, thumbnailUrl: row.thumbnail_url, previewVideoAssetId: numberOrNull(row.preview_video_asset_id),
    instructorId: numberOrNull(row.instructor_id), accessType: row.access_type, requiredTier: row.required_tier,
    packageIds: Array.isArray(row.package_ids) ? row.package_ids.map(Number) : [],
    priceVnd: row.price_vnd, compareAtPriceVnd: row.compare_at_price_vnd, status: row.status,
    isFeatured: row.is_featured, isNew: row.is_new, isHot: row.is_hot,
    certificateEnabled: row.certificate_enabled, totalSections: row.total_sections,
    totalLessons: row.total_lessons, totalDurationSeconds: row.total_duration_seconds,
    publishedAt: row.published_at, contentUpdatedAt: row.content_updated_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSection(row, lessons = []) {
  return { id: numberOrNull(row.id), courseId: numberOrNull(row.course_id), title: row.title,
    description: row.description, sortOrder: row.sort_order, isPublished: row.is_published,
    createdAt: row.created_at, updatedAt: row.updated_at, lessons };
}

function mapLesson(row) {
  return { id: numberOrNull(row.id), externalKey: row.external_key, courseId: numberOrNull(row.course_id),
    sectionId: numberOrNull(row.section_id), slug: row.slug, title: row.title, summary: row.summary,
    lessonType: row.lesson_type, contentHtml: row.content_html, sortOrder: row.sort_order,
    isPublished: row.is_published, isFreePreview: row.is_free_preview, isRequired: row.is_required,
    videoAssetId: numberOrNull(row.video_asset_id), materialId: numberOrNull(row.material_id),
    estimatedDurationSeconds: row.estimated_duration_seconds,
    passingScore: row.passing_score === null ? null : Number(row.passing_score),
    createdAt: row.created_at, updatedAt: row.updated_at };
}

function translateDatabaseError(error) {
  if (error instanceof CourseApiError) throw error;
  if (error.code === "23505") {
    const key = String(error.constraint || "").includes("slug") ? "slug" : "externalKey";
    fail(409, key === "slug" ? "ADMIN_COURSE_SLUG_CONFLICT" : "ADMIN_COURSE_EXTERNAL_KEY_CONFLICT", `${key} is already in use.`);
  }
  if (error.code === "23503") fail(422, "ADMIN_COURSE_RELATION_NOT_FOUND", "A referenced instructor, material, section, lesson, or video asset does not exist.");
  if (error.code === "COURSE_PACKAGE_NOT_FOUND") {
    fail(422, "ADMIN_COURSE_PACKAGE_NOT_FOUND", "One or more packages do not exist.", { packageIds: error.packageIds });
  }
  throw error;
}

async function ensureCourse(courseId, client, forUpdate = false) {
  const course = await repository.findById(courseId, client, { forUpdate });
  if (!course) fail(404, "ADMIN_COURSE_NOT_FOUND", "Course not found.");
  return course;
}

async function ensurePublishedCourseRemainsReady(course, courseId, client) {
  if (course.status !== "published") return;
  const readiness = await repository.getPublishReadiness(courseId, client);
  if (readiness.published_sections < 1 || readiness.published_lessons < 1 || readiness.invalid_video_lessons > 0) {
    fail(409, "ADMIN_COURSE_PUBLISHED_INVARIANT", "Unpublish the course before making this curriculum change.", {
      publishedSections: readiness.published_sections,
      publishedLessons: readiness.published_lessons,
      invalidVideoLessons: readiness.invalid_video_lessons,
    });
  }
}

async function listCourses(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const subjectCode = query.subjectCode ? enumValue(query.subjectCode, "subjectCode", SUBJECTS) : null;
  const status = query.status ? enumValue(query.status, "status", COURSE_STATUSES) : null;
  const q = query.q ? stringValue(query.q, "q", { max: 100 }) : null;
  const rows = await repository.list({ q, subjectCode, status, page, limit });
  const total = rows[0]?.total_count || 0;
  return { items: rows.map(mapCourse), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getCourse(courseIdValue) {
  const courseId = positiveId(courseIdValue, "courseId");
  const course = await ensureCourse(courseId);
  const curriculum = await repository.listCurriculum(courseId);
  const lessonsBySection = new Map();
  curriculum.lessons.forEach((row) => {
    const key = String(row.section_id);
    if (!lessonsBySection.has(key)) lessonsBySection.set(key, []);
    lessonsBySection.get(key).push(mapLesson(row));
  });
  return {
    ...mapCourse(course),
    curriculum: curriculum.sections.map((row) => mapSection(
      row,
      lessonsBySection.get(String(row.id)) || [],
    )),
  };
}

async function createCourse(body) {
  try {
    const values = normalizeCourseInput(body, { create: true });
    values.externalKey = externalKey("course");
    values.level ??= "basic"; values.status ??= "draft"; values.priceVnd ??= 0;
    values.isFeatured ??= false; values.isNew ??= false; values.isHot ??= false;
    values.certificateEnabled ??= false; values.requiredTier = requiredTierFor(values.accessType);
    if (values.accessType === "package" && !values.packageIds?.length) {
      fail(422, "ADMIN_COURSE_PACKAGE_REQUIRED", "packageIds must contain at least one package for package access.");
    }
    const row = await repository.transaction(async (client) => {
      if (values.previewVideoAssetId && !await repository.findPreviewAsset(null, values.previewVideoAssetId, client)) {
        fail(422, "ADMIN_COURSE_VIDEO_ASSET_INVALID", "Create the course before attaching a preview video asset.");
      }
      const created = await repository.createCourse(values, client);
      await repository.replacePackageAccess(created.id, values.packageIds || [], client);
      return repository.findById(created.id, client);
    });
    return mapCourse(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function updateCourse(courseIdValue, body) {
  const courseId = positiveId(courseIdValue, "courseId");
  try {
    const patch = normalizeCourseInput(body);
    if (!Object.keys(patch).length) fail(422, "ADMIN_COURSE_EMPTY_PATCH", "No supported fields were supplied.");
    const row = await repository.transaction(async (client) => {
      const current = await ensureCourse(courseId, client, true);
      const resultingAccessType = patch.accessType ?? current.access_type;
      const resultingPackageIds = patch.packageIds ?? (current.package_ids || []).map(Number);
      if (resultingAccessType === "package" && resultingPackageIds.length === 0) {
        fail(422, "ADMIN_COURSE_PACKAGE_REQUIRED", "packageIds must contain at least one package for package access.");
      }
      if (patch.previewVideoAssetId && !await repository.findPreviewAsset(courseId, patch.previewVideoAssetId, client)) {
        fail(422, "ADMIN_COURSE_VIDEO_ASSET_INVALID", "Preview asset does not belong to this course.");
      }
      const packageIds = patch.packageIds;
      delete patch.packageIds;
      await repository.updateCourse(courseId, patch, client);
      if (packageIds !== undefined) await repository.replacePackageAccess(courseId, packageIds, client);
      return repository.findById(courseId, client);
    });
    return mapCourse(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function createSection(courseIdValue, body) {
  const courseId = positiveId(courseIdValue, "courseId");
  try {
    const values = normalizeSectionInput(body, { create: true });
    values.sortOrder ??= 0; values.isPublished ??= false;
    const row = await repository.transaction(async (client) => {
      const course = await ensureCourse(courseId, client, true);
      const created = await repository.createSection(courseId, values, client);
      await repository.recalculateAggregates(courseId, client);
      await ensurePublishedCourseRemainsReady(course, courseId, client);
      return created;
    });
    return mapSection(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function updateSection(courseIdValue, sectionIdValue, body) {
  const courseId = positiveId(courseIdValue, "courseId");
  const sectionId = positiveId(sectionIdValue, "sectionId");
  try {
    const patch = normalizeSectionInput(body);
    if (!Object.keys(patch).length) fail(422, "ADMIN_COURSE_EMPTY_PATCH", "No supported fields were supplied.");
    const row = await repository.transaction(async (client) => {
      const course = await ensureCourse(courseId, client, true);
      const updated = await repository.updateSection(courseId, sectionId, patch, client);
      if (!updated) fail(404, "ADMIN_COURSE_SECTION_NOT_FOUND", "Section not found in this course.");
      await repository.recalculateAggregates(courseId, client);
      await ensurePublishedCourseRemainsReady(course, courseId, client);
      return updated;
    });
    return mapSection(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function attachAsset(courseId, lessonId, assetId, client) {
  if (assetId === null || assetId === undefined) return;
  const claimed = await repository.claimVideoAsset(courseId, lessonId, assetId, client);
  if (!claimed) fail(422, "ADMIN_COURSE_VIDEO_ASSET_INVALID", "Video asset is assigned to another course or lesson.");
}

async function createLesson(courseIdValue, body) {
  const courseId = positiveId(courseIdValue, "courseId");
  try {
    const values = normalizeLessonInput(body, { create: true });
    if (!values.sectionId) fail(422, "ADMIN_COURSE_VALIDATION_FAILED", "sectionId is required.");
    values.externalKey = externalKey("lesson"); values.lessonType ??= "video";
    values.sortOrder ??= 0; values.isPublished ??= false; values.isFreePreview ??= false;
    values.isRequired ??= true; values.estimatedDurationSeconds ??= 0;
    const row = await repository.transaction(async (client) => {
      const course = await ensureCourse(courseId, client, true);
      if (!await repository.findSection(courseId, values.sectionId, client)) fail(422, "ADMIN_COURSE_SECTION_NOT_FOUND", "Section does not belong to this course.");
      // Upload flow creates the lesson first; attachment normally happens in PATCH.
      if (values.videoAssetId !== undefined && values.videoAssetId !== null) {
        fail(422, "ADMIN_COURSE_VIDEO_ATTACH_AFTER_CREATE", "Create the lesson first, then attach videoAssetId with PATCH.");
      }
      const created = await repository.createLesson(courseId, values, client);
      await repository.recalculateAggregates(courseId, client);
      await ensurePublishedCourseRemainsReady(course, courseId, client);
      return created;
    });
    return mapLesson(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function updateLesson(courseIdValue, lessonIdValue, body) {
  const courseId = positiveId(courseIdValue, "courseId");
  const lessonId = positiveId(lessonIdValue, "lessonId");
  try {
    const patch = normalizeLessonInput(body);
    if (!Object.keys(patch).length) fail(422, "ADMIN_COURSE_EMPTY_PATCH", "No supported fields were supplied.");
    const row = await repository.transaction(async (client) => {
      const course = await ensureCourse(courseId, client, true);
      const current = await repository.findLesson(courseId, lessonId, client);
      if (!current) fail(404, "ADMIN_COURSE_LESSON_NOT_FOUND", "Lesson not found in this course.");
      if (patch.sectionId && !await repository.findSection(courseId, patch.sectionId, client)) fail(422, "ADMIN_COURSE_SECTION_NOT_FOUND", "Section does not belong to this course.");
      if (patch.videoAssetId !== undefined) await attachAsset(courseId, lessonId, patch.videoAssetId, client);
      const updated = await repository.updateLesson(courseId, lessonId, patch, client);
      await repository.recalculateAggregates(courseId, client);
      await ensurePublishedCourseRemainsReady(course, courseId, client);
      return updated;
    });
    return mapLesson(row);
  } catch (error) { return translateDatabaseError(error); }
}

async function transition(courseIdValue, targetStatus) {
  const courseId = positiveId(courseIdValue, "courseId");
  const row = await repository.transaction(async (client) => {
    await ensureCourse(courseId, client, true);
    if (targetStatus === "published") {
      const readiness = await repository.getPublishReadiness(courseId, client);
      const details = {
        publishedSections: readiness.published_sections,
        publishedLessons: readiness.published_lessons,
        invalidVideoLessons: readiness.invalid_video_lessons,
      };
      if (details.publishedSections < 1 || details.publishedLessons < 1 || details.invalidVideoLessons > 0) {
        fail(409, "ADMIN_COURSE_NOT_READY_TO_PUBLISH", "Course does not satisfy publish requirements.", details);
      }
    }
    await repository.recalculateAggregates(courseId, client);
    return repository.setStatus(courseId, targetStatus, client);
  });
  return mapCourse(row);
}

module.exports = {
  listCourses, getCourse, createCourse, updateCourse, createSection, updateSection,
  createLesson, updateLesson, publishCourse: (id) => transition(id, "published"),
  unpublishCourse: (id) => transition(id, "draft"), archiveCourse: (id) => transition(id, "archived"),
  _validation: { normalizeCourseInput, normalizeSectionInput, normalizeLessonInput, requiredTierFor, positiveId, positiveIdList },
};
