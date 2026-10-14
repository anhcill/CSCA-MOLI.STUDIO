const { SUBJECT_CODES } = require('./courseContract');
const { CourseApiError } = require('./courseResponses');

function invalid(code, message) {
  throw new CourseApiError(422, code, message);
}

function positiveId(value, name = 'id') {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    invalid('VIDEO_COMMERCE_INVALID_ID', `${name} must be a positive integer.`);
  }
  return Number(value);
}

function productType(value) {
  if (!['video', 'combo'].includes(value)) invalid('VIDEO_COMMERCE_INVALID_TYPE', 'Expected video or combo.');
  return value;
}

function nullableInteger(value, name, minimum = 0) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > 2147483647) {
    invalid('VIDEO_COMMERCE_INVALID_FIELD', `${name} must be an integer >= ${minimum}.`);
  }
  return value;
}

function textList(value, name, maxLength) {
  if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string'
    || !item.trim() || item.length > maxLength)) {
    invalid('VIDEO_COMMERCE_INVALID_FIELD', `${name} must be a list of non-empty strings.`);
  }
  return [...new Set(value.map(item => item.trim()))];
}

function normalizeDraft(type, input) {
  productType(type);
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('VIDEO_COMMERCE_INVALID_FIELD', 'Expected an object.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160) {
    invalid('VIDEO_COMMERCE_INVALID_FIELD', 'name must contain 1-160 characters.');
  }
  if (input.status !== undefined && input.status !== 'draft') {
    invalid('VIDEO_COMMERCE_DRAFT_ONLY', 'Publishing is not available in the foundation API.');
  }
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 10000)) {
    invalid('VIDEO_COMMERCE_INVALID_FIELD', 'description must be text up to 10000 characters.');
  }
  const common = {
    name: input.name.trim(), description: input.description || '',
    features: textList(input.features ?? [], 'features', 500), status: 'draft',
    priceVnd: nullableInteger(input.priceVnd, 'priceVnd'),
    originalPriceVnd: nullableInteger(input.originalPriceVnd, 'originalPriceVnd'),
    sortOrder: nullableInteger(input.sortOrder ?? 0, 'sortOrder'),
  };
  if (type === 'combo') return {
    ...common,
    vipPackageId: input.vipPackageId == null ? null : positiveId(input.vipPackageId, 'vipPackageId'),
    videoPackageId: input.videoPackageId == null ? null : positiveId(input.videoPackageId, 'videoPackageId'),
    vipDurationDays: nullableInteger(input.vipDurationDays, 'vipDurationDays', 1),
  };
  const allowedSubjects = textList(input.allowedSubjects ?? [], 'allowedSubjects', 30);
  if (allowedSubjects.some(subject => !SUBJECT_CODES.includes(subject))) {
    invalid('VIDEO_COMMERCE_INVALID_SUBJECT', 'Unsupported subject code.');
  }
  const durationMode = input.durationMode ?? 'unconfigured';
  const durationDays = nullableInteger(input.durationDays, 'durationDays', 1);
  if (!['unconfigured', 'days', 'lifetime'].includes(durationMode)
    || (durationMode === 'days' ? durationDays === null : durationDays !== null)) {
    invalid('VIDEO_COMMERCE_INVALID_DURATION', 'Set days explicitly, or choose unconfigured/lifetime without durationDays.');
  }
  if (input.requiresSubjectChoice !== undefined && typeof input.requiresSubjectChoice !== 'boolean') {
    invalid('VIDEO_COMMERCE_INVALID_FIELD', 'requiresSubjectChoice must be boolean.');
  }
  const courseIds = input.courseIds ?? [];
  if (!Array.isArray(courseIds) || courseIds.length > 500) invalid('VIDEO_COMMERCE_INVALID_FIELD', 'courseIds must contain at most 500 IDs.');
  return {
    ...common, durationMode, durationDays, allowedSubjects,
    requiresSubjectChoice: input.requiresSubjectChoice ?? false,
    courseIds: [...new Set(courseIds.map(id => positiveId(id, 'courseId')))],
  };
}

function mapProduct(row, type) {
  const value = {
    id: Number(row.id), type, name: row.name, description: row.description, features: row.features,
    status: row.status, priceVnd: row.price_vnd, originalPriceVnd: row.original_price_vnd,
    sortOrder: row.sort_order,
  };
  if (type === 'combo') return { ...value,
    vipPackageId: row.vip_package_id == null ? null : Number(row.vip_package_id),
    videoPackageId: row.video_package_id == null ? null : Number(row.video_package_id),
    vipDurationDays: row.vip_duration_days,
  };
  return { ...value, durationMode: row.duration_mode, durationDays: row.duration_days,
    allowedSubjects: row.allowed_subjects, requiresSubjectChoice: row.requires_subject_choice,
    courseIds: (row.course_ids || []).map(Number),
  };
}

function configurationIssues(product) {
  const issues = [];
  if (product.priceVnd == null) issues.push('PRICE_REQUIRED');
  if (product.type === 'video') {
    if (product.durationMode === 'unconfigured') issues.push('DURATION_REQUIRED');
    if (!product.allowedSubjects.length) issues.push('SUBJECTS_REQUIRED');
    if (!product.courseIds.length) issues.push('COURSES_REQUIRED');
  } else {
    if (!product.vipPackageId) issues.push('VIP_PACKAGE_REQUIRED');
    if (!product.videoPackageId) issues.push('VIDEO_PACKAGE_REQUIRED');
    if (product.vipDurationDays == null) issues.push('VIP_DURATION_REQUIRED');
  }
  return issues;
}

module.exports = { positiveId, productType, normalizeDraft, mapProduct, configurationIssues };
