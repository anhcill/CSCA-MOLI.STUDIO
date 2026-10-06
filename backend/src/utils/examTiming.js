function toTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getAttemptDeadline({
  examStartTime,
  examEndTime,
  attemptStartTime,
  durationMinutes,
}) {
  const scheduledStart = toTimestamp(examStartTime);
  const scheduledEnd = toTimestamp(examEndTime);

  // A scheduled room has one shared closing time for every learner. Someone
  // entering late therefore receives only the time remaining until end_time.
  if (scheduledStart !== null && scheduledEnd !== null) {
    return scheduledEnd;
  }

  const attemptStart = toTimestamp(attemptStartTime);
  const duration = Number(durationMinutes);
  if (attemptStart === null || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return attemptStart + duration * 60 * 1000;
}

function getTimeLeftSeconds(timing, now = Date.now()) {
  const deadline = getAttemptDeadline(timing);
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

module.exports = {
  getAttemptDeadline,
  getTimeLeftSeconds,
};
