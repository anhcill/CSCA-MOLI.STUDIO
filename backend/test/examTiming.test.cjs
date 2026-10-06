const assert = require('node:assert/strict');
const test = require('node:test');
const { getAttemptDeadline, getTimeLeftSeconds } = require('../src/utils/examTiming');

test('scheduled exam uses the shared room end time for a late learner', () => {
  const timing = {
    examStartTime: '2026-10-06T08:00:00.000Z',
    examEndTime: '2026-10-06T09:00:00.000Z',
    attemptStartTime: '2026-10-06T08:10:00.000Z',
    durationMinutes: 60,
  };

  assert.equal(
    getAttemptDeadline(timing),
    new Date('2026-10-06T09:00:00.000Z').getTime(),
  );
  assert.equal(
    getTimeLeftSeconds(timing, new Date('2026-10-06T08:10:00.000Z').getTime()),
    50 * 60,
  );
});

test('unscheduled exam still uses its own attempt start plus duration', () => {
  const timing = {
    examStartTime: null,
    examEndTime: null,
    attemptStartTime: '2026-10-06T08:10:00.000Z',
    durationMinutes: 60,
  };

  assert.equal(
    getTimeLeftSeconds(timing, new Date('2026-10-06T08:20:00.000Z').getTime()),
    50 * 60,
  );
});

test('time remaining never becomes negative after the deadline', () => {
  assert.equal(getTimeLeftSeconds({
    examStartTime: '2026-10-06T08:00:00.000Z',
    examEndTime: '2026-10-06T09:00:00.000Z',
    attemptStartTime: '2026-10-06T08:10:00.000Z',
    durationMinutes: 60,
  }, new Date('2026-10-06T09:05:00.000Z').getTime()), 0);
});
