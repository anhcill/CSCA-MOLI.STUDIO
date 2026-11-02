const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const db = require('../src/config/database');
const User = require('../src/models/User');
const UserActivity = require('../src/models/UserActivity');
const emailService = require('../src/services/emailService');
const authController = require('../src/controllers/authController');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
}

test('registration ignores client-supplied legal version strings', async () => {
  const originals = {
    findByEmail: User.findByEmail,
    findByUsername: User.findByUsername,
    create: User.create,
    query: db.query,
    sendVerificationEmail: emailService.sendVerificationEmail,
    sendWelcomeEmail: emailService.sendWelcomeEmail,
    activityLog: UserActivity.log,
  };
  let capturedCreate;

  User.findByEmail = async () => null;
  User.findByUsername = async () => null;
  User.create = async (data) => {
    capturedCreate = data;
    return { id: 101, username: data.username, email: data.email, full_name: data.full_name };
  };
  db.query = async (sql) => {
    assert.match(sql, /email_verify_token/);
    return { rows: [] };
  };
  emailService.sendVerificationEmail = async () => ({ sent: true });
  emailService.sendWelcomeEmail = async () => ({ sent: true });
  UserActivity.log = () => {};

  const req = {
    body: {
      username: 'legal_controller',
      email: 'legal-controller@example.com',
      password: 'Password123',
      full_name: 'Legal Controller',
      acceptedTerms: true,
      termsVersion: 'attacker-version',
      privacyVersion: 'attacker-version',
    },
    get: () => 'RegressionTest/1.0',
    ip: '203.0.113.11',
    connection: {},
  };
  const res = responseRecorder();

  try {
    await authController.register(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(capturedCreate.termsVersion, '2026-04');
    assert.equal(capturedCreate.privacyVersion, '2026-04');
    assert.notEqual(capturedCreate.termsVersion, req.body.termsVersion);
  } finally {
    User.findByEmail = originals.findByEmail;
    User.findByUsername = originals.findByUsername;
    User.create = originals.create;
    db.query = originals.query;
    emailService.sendVerificationEmail = originals.sendVerificationEmail;
    emailService.sendWelcomeEmail = originals.sendWelcomeEmail;
    UserActivity.log = originals.activityLog;
  }
});

test('Facebook registration consent is preserved in signed OAuth state', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalAppId = process.env.FACEBOOK_APP_ID;
  process.env.JWT_SECRET = 'facebook-consent-regression-secret';
  process.env.FACEBOOK_APP_ID = 'facebook-test-app';

  try {
    for (const acceptedTerms of [false, true]) {
      const redirect = 'https://molystudio.online/auth/facebook/callback';
      const req = {
        query: {
          redirect,
          ...(acceptedTerms ? { acceptedTerms: 'true' } : {}),
        },
        protocol: 'https',
        get: () => 'api.example.com',
      };
      const res = responseRecorder();
      await authController.facebookAuthStart(req, res);

      const authUrl = new URL(res.redirectUrl);
      const state = authUrl.searchParams.get('state');
      const decoded = jwt.verify(state, process.env.JWT_SECRET, {
        issuer: 'csca-app',
        audience: 'facebook-oauth',
      });
      assert.equal(decoded.redirect, redirect);
      assert.equal(decoded.acceptedTerms, acceptedTerms);
    }
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalAppId === undefined) delete process.env.FACEBOOK_APP_ID;
    else process.env.FACEBOOK_APP_ID = originalAppId;
  }
});
