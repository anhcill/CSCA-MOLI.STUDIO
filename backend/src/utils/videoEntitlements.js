// This policy is isolated until the learning integration is enabled on day 4.
function evaluateVideoAccess({ userId, courseId, subjectCode, entitlements = [], now = new Date() }) {
  const at = new Date(now).getTime();
  if (!userId || !Number.isFinite(at)) return { allowed: false, entitlementIds: [] };
  const matches = entitlements.filter(item => {
    const startsAt = new Date(item.starts_at).getTime();
    const expiresAt = item.expires_at == null ? null : new Date(item.expires_at).getTime();
    const validDuration = item.duration_mode === 'lifetime'
      ? expiresAt === null
      : item.duration_mode === 'days' && expiresAt !== null && Number.isFinite(expiresAt) && expiresAt > at;
    return item.starts_at != null && String(item.user_id) === String(userId) && item.status === 'active'
      && Number.isFinite(startsAt) && startsAt <= at && validDuration
      && Array.isArray(item.course_ids) && item.course_ids.some(id => String(id) === String(courseId))
      && Array.isArray(item.allowed_subjects) && item.allowed_subjects.includes(subjectCode);
  });
  return { allowed: matches.length > 0, entitlementIds: matches.map(item => Number(item.id)) };
}

module.exports = { evaluateVideoAccess };
