const { CourseApiError } = require('../utils/courseResponses');
const { positiveId, productType, normalizeDraft, mapProduct, configurationIssues } = require('../utils/videoCommerceContract');
const { evaluateVideoAccess } = require('../utils/videoEntitlements');

function createVideoCommerceService(repository) {
  const dto = (row, type) => {
    const product = mapProduct(row, type);
    return { ...product, configurationIssues: configurationIssues(product), canPurchase: false };
  };

  async function validateReferences(type, draft, client) {
    if (type === 'video') {
      const courses = await repository.findCourses(draft.courseIds, client);
      if (courses.length !== draft.courseIds.length) {
        throw new CourseApiError(422, 'VIDEO_COMMERCE_COURSE_NOT_FOUND', 'One or more courses do not exist.');
      }
      if (draft.allowedSubjects.length && courses.some(course => !draft.allowedSubjects.includes(course.subject_code))) {
        throw new CourseApiError(422, 'VIDEO_COMMERCE_COURSE_SUBJECT_MISMATCH', 'A course is outside the package subjects.');
      }
      return;
    }
    if (draft.vipPackageId && !await repository.findVipPackage(draft.vipPackageId, client)) {
      throw new CourseApiError(422, 'VIDEO_COMMERCE_VIP_PACKAGE_NOT_FOUND', 'The referenced VIP package does not exist.');
    }
    if (draft.videoPackageId && !await repository.find('video', draft.videoPackageId, client)) {
      throw new CourseApiError(422, 'VIDEO_COMMERCE_VIDEO_PACKAGE_NOT_FOUND', 'The referenced video package does not exist.');
    }
  }

  async function saveDraft(typeValue, input, actorIdValue, idValue = null) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new CourseApiError(422, 'VIDEO_COMMERCE_INVALID_FIELD', 'Expected a draft object.');
    }
    const type = productType(typeValue);
    const actorId = positiveId(actorIdValue, 'actorId');
    const id = idValue === null ? null : positiveId(idValue);
    return repository.transaction(async client => {
      const previous = id === null ? null : await repository.find(type, id, client, { lock: true });
      if (id !== null && !previous) throw new CourseApiError(404, 'VIDEO_COMMERCE_NOT_FOUND', 'Package not found.');
      if (previous && previous.status !== 'draft') {
        throw new CourseApiError(409, 'VIDEO_COMMERCE_DRAFT_ONLY', 'Only drafts can be edited through this API.');
      }
      const draft = normalizeDraft(type, { ...(previous ? mapProduct(previous, type) : {}), ...input });
      await validateReferences(type, draft, client);
      const saved = await repository.writeDraft(type, draft, actorId, client, id);
      const result = dto(saved, type);
      await repository.audit({ actorId, type, id: result.id, before: previous ? mapProduct(previous, type) : null, after: result }, client);
      return result;
    });
  }

  async function list(typeValue, query = {}, { admin = false } = {}) {
    const type = productType(typeValue);
    const page = query.page === undefined ? 1 : positiveId(query.page, 'page');
    const limit = query.limit === undefined ? 20 : Math.min(100, positiveId(query.limit, 'limit'));
    if (!Number.isSafeInteger((page - 1) * limit)) throw new CourseApiError(422, 'VIDEO_COMMERCE_INVALID_PAGE', 'Page is too large.');
    const status = admin ? query.status || null : 'active';
    if (status !== null && !['draft', 'active', 'archived'].includes(status)) {
      throw new CourseApiError(422, 'VIDEO_COMMERCE_INVALID_STATUS', 'Unsupported package status.');
    }
    const rows = await repository.list(type, { status, limit: limit + 1, offset: (page - 1) * limit });
    return { items: rows.slice(0, limit).map(row => dto(row, type)), page, limit, hasMore: rows.length > limit,
      checkoutAvailable: false };
  }

  async function checkVideoAccess(userIdValue, courseIdValue, now = new Date()) {
    const userId = positiveId(userIdValue, 'userId');
    const courseId = positiveId(courseIdValue, 'courseId');
    const [course] = await repository.findCourses([courseId]);
    if (!course || course.status !== 'published') return { allowed: false, entitlementIds: [] };
    const entitlements = await repository.listEntitlements(userId, courseId);
    return evaluateVideoAccess({ userId, courseId, subjectCode: course.subject_code, entitlements, now });
  }

  return { saveDraft, list, checkVideoAccess };
}

module.exports = { createVideoCommerceService };
