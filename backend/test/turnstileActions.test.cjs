const assert = require('node:assert/strict');
const test = require('node:test');

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  TURNSTILE_ALLOWED_HOSTNAMES: process.env.TURNSTILE_ALLOWED_HOSTNAMES,
  TURNSTILE_DISABLED: process.env.TURNSTILE_DISABLED,
  TURNSTILE_EXPECTED_ACTION: process.env.TURNSTILE_EXPECTED_ACTION,
};

process.env.NODE_ENV = 'production';
process.env.TURNSTILE_SECRET_KEY = 'test-secret';
process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'molystudio.online';
delete process.env.TURNSTILE_DISABLED;
delete process.env.TURNSTILE_EXPECTED_ACTION;

const { createTurnstileVerifier } = require('../src/middleware/turnstileMiddleware');

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

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

async function runVerifier(expectedAction, verifiedAction) {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      hostname: 'molystudio.online',
      action: verifiedAction,
    }),
  });

  const req = {
    body: { turnstileToken: 'valid-token' },
    headers: {},
    ip: '203.0.113.10',
  };
  const res = responseRecorder();
  let passed = false;

  try {
    await createTurnstileVerifier(expectedAction)(req, res, () => { passed = true; });
    return { res, passed };
  } finally {
    global.fetch = originalFetch;
  }
}

test('route-specific Turnstile action accepts its own widget token', async () => {
  const result = await runVerifier('register', 'register');
  assert.equal(result.passed, true);
  assert.equal(result.res.body, null);
});

test('route-specific Turnstile action rejects a token minted for another route', async () => {
  const result = await runVerifier('register', 'login');
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body.code, 'TURNSTILE_ACTION_MISMATCH');
});
