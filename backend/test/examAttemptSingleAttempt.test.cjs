const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/database');
const ExamAttempt = require('../src/models/ExamAttempt');

test('official exam rejects another attempt after submission', async () => {
  const originalConnect = pool.connect;
  const statements = [];
  pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('SELECT *\n           FROM exam_attempts')) {
        return { rows: [{ id: 42, status: 'completed' }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    for (const restart of [false, true]) {
      await assert.rejects(
        ExamAttempt.start(7, 223, { singleAttempt: true, restart, paperLanguageMode: 'en' }),
        (error) => error.statusCode === 409 && error.appCode === 'OFFICIAL_ATTEMPT_LIMIT_REACHED',
      );
    }
    assert.equal(statements.some((sql) => sql.includes('INSERT INTO exam_attempts')), false);
  } finally {
    pool.connect = originalConnect;
  }
});

test('official exam resumes its existing in-progress attempt', async () => {
  const originalConnect = pool.connect;
  const statements = [];
  pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('SELECT *\n           FROM exam_attempts')) {
        return { rows: [{ id: 43, status: 'in_progress', paper_language_mode: 'zh' }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    const attempt = await ExamAttempt.start(7, 223, { singleAttempt: true, paperLanguageMode: 'zh' });
    assert.equal(attempt.id, 43);
    assert.equal(statements.some((sql) => sql.includes('INSERT INTO exam_attempts')), false);
  } finally {
    pool.connect = originalConnect;
  }
});

test('official exam history cannot be deleted to bypass the one-attempt limit', async () => {
  const originalConnect = pool.connect;
  const statements = [];
  pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('SELECT ea.id, ea.exam_id')) {
        return { rows: [{ id: 43, exam_id: 223, user_id: 7, exam_start_time: new Date() }] };
      }
      return { rows: [] };
    },
    release() {},
  });

  try {
    await assert.rejects(
      ExamAttempt.deleteHistoryAttempt(43, 7),
      (error) => error.statusCode === 403,
    );
    assert.equal(statements.some((sql) => sql.includes('DELETE FROM exam_attempts')), false);
  } finally {
    pool.connect = originalConnect;
  }
});

test('room history filter keeps completed official attempts visible while review is locked', async () => {
  const originalQuery = pool.query;
  let captured;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  };

  try {
    await ExamAttempt.getUserHistory(7, 'MATH', 100, 'room');
    assert.deepEqual(captured.params, [7, 'MATH', 100]);
    assert.match(captured.sql, /e\.start_time IS NOT NULL/);
    assert.doesNotMatch(captured.sql, /e\.end_time <= CURRENT_TIMESTAMP/);
  } finally {
    pool.query = originalQuery;
  }
});
