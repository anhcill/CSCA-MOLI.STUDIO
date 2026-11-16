const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');
const Exam = require('../src/models/Exam');
const ExamAttempt = require('../src/models/ExamAttempt');
const examController = require('../src/controllers/examController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('learner exam queries only return published exams', async () => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql) => {
    statements.push(sql);
    return { rows: [] };
  };

  try {
    await Exam.getSummaryForUser(238, 7);
    await Exam.getById(238, false);

    assert.equal(statements.length, 2);
    for (const sql of statements) {
      assert.match(sql, /e\.status\s*=\s*'published'/);
      assert.match(sql, /e\.deleted_at\s+IS\s+NULL/);
    }
  } finally {
    pool.query = originalQuery;
  }
});

test('public exam detail returns 404 when a draft reaches the controller', async () => {
  const originalGetById = Exam.getById;
  Exam.getById = async () => ({ id: 238, status: 'draft', deleted_at: null });

  try {
    const res = createResponse();
    await examController.getExamDetail({ params: { examId: '238' }, user: null }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    Exam.getById = originalGetById;
  }
});

test('preflight returns 404 when a draft reaches the controller', async () => {
  const originalGetSummaryForUser = Exam.getSummaryForUser;
  Exam.getSummaryForUser = async () => ({ id: 238, status: 'draft', deleted_at: null });

  try {
    const res = createResponse();
    await examController.getExamPreflight({ params: { examId: '238' }, user: { id: 7 } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    Exam.getSummaryForUser = originalGetSummaryForUser;
  }
});

test('start endpoint never creates an attempt for a draft exam', async () => {
  const originalGetById = Exam.getById;
  const originalStart = ExamAttempt.start;
  let startCalled = false;

  Exam.getById = async () => ({ id: 238, status: 'draft', deleted_at: null });
  ExamAttempt.start = async () => {
    startCalled = true;
    throw new Error('must not start a draft exam');
  };

  try {
    const res = createResponse();
    await examController.startExam({
      params: { examId: '238' },
      body: {},
      user: { id: 7, role: 'user' },
    }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(startCalled, false);
  } finally {
    Exam.getById = originalGetById;
    ExamAttempt.start = originalStart;
  }
});
