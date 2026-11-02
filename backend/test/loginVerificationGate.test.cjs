const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../src/config/database');
const User = require('../src/models/User');
const authController = require('../src/controllers/authController');

function responseRecorder() {
  let resolve;
  const done = new Promise(value => { resolve = value; });
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve(this);
      return this;
    },
  };
  return { response, done };
}

test('a new unverified registration cannot log in before email verification', async () => {
  const originalFindByEmail = User.findByEmail;
  const originalComparePassword = User.comparePassword;
  const originalQuery = db.query;

  User.findByEmail = async () => ({
    id: 91,
    username: 'new_user',
    email: 'new@example.com',
    password: 'stored-hash',
    is_active: true,
    is_verified: false,
    terms_accepted_at: new Date('2026-04-01T00:00:00.000Z'),
    role: 'student',
  });
  User.comparePassword = async () => true;
  db.query = async (sql) => {
    if (sql.includes('device_limit_locked_at')) {
      return { rows: [{ device_limit_locked_at: null, device_limit_attempts: 0 }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const req = {
    body: { email: 'new@example.com', password: 'Password123' },
    get: () => 'RegressionTest/1.0',
    headers: {},
    ip: '203.0.113.10',
    connection: {},
  };
  const { response, done } = responseRecorder();

  try {
    await authController.login(req, response);
    const result = await done;
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, 'EMAIL_NOT_VERIFIED');
  } finally {
    User.findByEmail = originalFindByEmail;
    User.comparePassword = originalComparePassword;
    db.query = originalQuery;
  }
});
