const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../src/config/database');
const emailService = require('../src/services/emailService');
const authController = require('../src/controllers/authController');

function responseRecorder() {
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

test('failed OTP resend delivery restores the previously usable OTP record', async () => {
  const originalConnect = db.pool.connect;
  const originalQuery = db.query;
  const originalSendOtp = emailService.sendOtpEmail;
  const originalConsoleError = console.error;
  const previousExpiry = new Date(Date.now() + 2 * 60 * 1000);
  const previousSentAt = new Date(Date.now() - 2 * 60 * 1000);
  const transactionStatements = [];
  let restored;

  db.pool.connect = async () => ({
    query: async (sql, params = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      transactionStatements.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT') return { rows: [] };
      if (normalized.startsWith('SELECT c.id')) {
        return {
          rows: [{
            id: 501,
            user_id: 7,
            otp_hash: 'previous-hash',
            otp_expires_at: previousExpiry,
            otp_sent_at: previousSentAt,
            attempts: 2,
            consumed_at: null,
            email: 'otp@example.com',
            full_name: 'OTP User',
            username: 'otp_user',
            is_active: true,
          }],
        };
      }
      if (normalized.startsWith('UPDATE auth_challenges')) return { rows: [] };
      throw new Error(`Unexpected transaction query: ${normalized}`);
    },
    release() {},
  });
  db.query = async (sql, params) => {
    restored = { sql: sql.replace(/\s+/g, ' ').trim(), params };
    return { rows: [] };
  };
  emailService.sendOtpEmail = async () => {
    throw new Error('simulated email failure');
  };
  console.error = () => {};

  const req = { body: { challengeToken: 'a'.repeat(48) } };
  const res = responseRecorder();

  try {
    await authController.resendOtp(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.ok(restored, 'the previous OTP record should be restored');
    assert.match(restored.sql, /WHERE id = \$5 AND otp_hash = \$6 AND consumed_at IS NULL/);
    assert.equal(restored.params[0], 'previous-hash');
    assert.equal(restored.params[1], previousExpiry);
    assert.equal(restored.params[2], previousSentAt);
    assert.equal(restored.params[3], 2);
    assert.equal(restored.params[4], 501);
    const replacementHash = transactionStatements
      .find(item => item.sql.startsWith('UPDATE auth_challenges')).params[1];
    assert.equal(restored.params[5], replacementHash);
  } finally {
    db.pool.connect = originalConnect;
    db.query = originalQuery;
    emailService.sendOtpEmail = originalSendOtp;
    console.error = originalConsoleError;
  }
});
