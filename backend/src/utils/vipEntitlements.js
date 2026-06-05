const ALL_SUBJECTS = '*';

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  if (tier === 'premium' || tier === 'pre') return 'premium';
  if (tier === 'vip') return 'vip';
  return 'basic';
}

function normalizeSubjectCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeSubjectList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(normalizeSubjectCode).filter(Boolean))];
}

function hasAllSubjects(subjects) {
  return normalizeSubjectList(subjects).includes(ALL_SUBJECTS);
}

function isActiveVipLike(user) {
  if (!user) return false;
  const tier = normalizeTier(user.subscription_tier);
  const hasTier = user.is_vip === true || tier === 'vip' || tier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return hasTier && notExpired;
}

function getEffectiveAllowedSubjects(user) {
  if (!isActiveVipLike(user)) return [];
  const tier = normalizeTier(user.subscription_tier);
  if (tier === 'premium') return [ALL_SUBJECTS];
  const subjects = normalizeSubjectList(user.vip_allowed_subjects);
  return subjects.length > 0 ? subjects : [ALL_SUBJECTS];
}

function canAccessSubject(user, subjectCode) {
  const subjects = getEffectiveAllowedSubjects(user);
  if (!subjectCode) return subjects.length > 0;
  return hasAllSubjects(subjects) || subjects.includes(normalizeSubjectCode(subjectCode));
}

function canAccessVipContent(user, contentTier = 'vip', subjectCode = null) {
  const requiredTier = normalizeTier(contentTier);
  if (requiredTier === 'basic') return true;
  if (!isActiveVipLike(user)) return false;

  const userTier = normalizeTier(user.subscription_tier);
  if (requiredTier === 'premium' && userTier !== 'premium') return false;
  return canAccessSubject(user, subjectCode);
}

function resolveSelectedSubjects(pkg, selectedSubjectCode) {
  const allowedSubjects = normalizeSubjectList(pkg?.allowed_subjects);
  if (normalizeTier(pkg?.tier) === 'premium' || hasAllSubjects(allowedSubjects)) {
    return [ALL_SUBJECTS];
  }

  if (pkg?.requires_subject_choice === true) {
    const selected = normalizeSubjectCode(selectedSubjectCode);
    if (!selected) {
      const error = new Error('Vui long chon mon hoc cho goi nay.');
      error.code = 'SUBJECT_REQUIRED';
      throw error;
    }
    if (!allowedSubjects.includes(selected)) {
      const error = new Error('Mon hoc khong nam trong goi da chon.');
      error.code = 'SUBJECT_NOT_ALLOWED';
      throw error;
    }
    return [selected];
  }

  return allowedSubjects.length > 0 ? allowedSubjects : [ALL_SUBJECTS];
}

module.exports = {
  ALL_SUBJECTS,
  normalizeTier,
  normalizeSubjectCode,
  normalizeSubjectList,
  hasAllSubjects,
  isActiveVipLike,
  getEffectiveAllowedSubjects,
  canAccessSubject,
  canAccessVipContent,
  resolveSelectedSubjects,
};
