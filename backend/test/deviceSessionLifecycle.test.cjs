const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const jwt = require('jsonwebtoken');
const db = require('../src/config/database');
const service = require('../src/services/deviceSessionService');
let pg;
let paid = false;
const deviceA = 'browser-a-123456789';
const deviceB = 'browser-b-123456789';
const jtiA = 'a'.repeat(32);
const jtiB = 'b'.repeat(32);
const jtiC = 'c'.repeat(32);
const login = (jti, deviceId, extra = {}) => ({ userId: 7, jti, deviceId,
  deviceType: 'desktop', deviceInfo: 'Chrome', userAgent: 'Chrome', ipAddress: '203.0.113.1',
  expiresAt: new Date(Date.now() + 86400000), ...extra });
const previous = () => jwt.sign({ id: 7, email: 'test@example.com', jti: jtiA },
  process.env.JWT_SECRET, { issuer: 'csca-app', expiresIn: '-1d' });
const original = { query: db.query, connect: db.pool.connect, admin: service.isUserAdmin,
  paid: service.hasPaidDevicePolicy, max: service.getUserMaxDevices, secret: process.env.JWT_SECRET };

before(async () => {
  process.env.JWT_SECRET = 'lifecycle-test-secret';
  pg = new PGlite();
  db.query = async (sql, params) => sql.includes('pg_advisory_xact_lock')
    ? { rows: [] } : pg.query(sql, params);
  db.pool.connect = async () => ({ query: db.query, release() {} });
  service.isUserAdmin = async () => false;
  service.hasPaidDevicePolicy = async () => paid;
  service.getUserMaxDevices = async () => 2;
  await pg.exec(`CREATE TABLE users(id INT PRIMARY KEY, device_limit_attempts INT DEFAULT 0, device_limit_locked_at TIMESTAMPTZ);
    INSERT INTO users(id) VALUES (7);
    CREATE TABLE user_sessions(id SERIAL PRIMARY KEY, user_id INT, jti TEXT UNIQUE, device_key TEXT,
      device_type TEXT, device_info TEXT, user_agent TEXT, ip_address TEXT,
      expires_at TIMESTAMPTZ, last_active TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE token_blacklist(id SERIAL PRIMARY KEY, token_jti TEXT UNIQUE, user_id INT, expires_at TIMESTAMPTZ);
    CREATE TABLE user_remembered_devices(id SERIAL PRIMARY KEY, user_id INT, device_key TEXT,
      device_type TEXT, device_info TEXT, user_agent TEXT, ip_address TEXT,
      first_seen_at TIMESTAMPTZ DEFAULT NOW(), last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ DEFAULT NOW(), revoked_at TIMESTAMPTZ, revoked_by INT,
      UNIQUE(user_id, device_key));`);
});
beforeEach(async () => {
  paid = false;
  await pg.exec('TRUNCATE user_sessions, user_remembered_devices, token_blacklist');
});
after(async () => {
  db.query = original.query;
  db.pool.connect = original.connect;
  service.isUserAdmin = original.admin;
  service.hasPaidDevicePolicy = original.paid;
  service.getUserMaxDevices = original.max;
  if (original.secret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = original.secret;
  await pg?.close();
});

for (const paidPolicy of [false, true]) {
  test(`${paidPolicy ? 'paid' : 'free'}: stable browser reuses its slot after IP/UA change without a previous token`, async () => {
    paid = paidPolicy;
    await service.registerSession(login(jtiA, deviceA));
    await service.registerSession(login(jtiB, deviceB));
    const returning = login(jtiC, deviceA, { ipAddress: '198.51.100.2', userAgent: 'New Chrome' });
    assert.equal(await service.hasMatchingDeviceSession(returning), true);
    await service.registerSession(returning);
    assert.equal((await service.getActiveSessions(7)).length, 2);
    assert.equal(await service.assertActiveSession(jtiB, 7), true);
    assert.equal(await service.assertActiveSession(jtiA, 7), false);
    await assert.rejects(service.registerSession(login('d'.repeat(32), 'browser-c-123456789')),
      { code: 'DEVICE_LIMIT_REACHED' });
    if (paid) assert.equal((await service.getRememberedDevices(7)).length, 2);
  });
}

test('identical IP and UA do not evict a different browser or bypass capacity', async () => {
  await service.registerSession(login(jtiA, deviceA));
  await service.registerSession(login(jtiB, deviceB));
  const unknown = login(jtiC, null);
  assert.equal(await service.hasMatchingDeviceSession(unknown), false);
  await assert.rejects(service.registerSession(unknown), { code: 'DEVICE_LIMIT_REACHED' });
  assert.equal(await service.assertActiveSession(jtiA, 7), true);
});

test('signed old session migrates to a stable browser key without consuming another slot', async () => {
  await service.registerSession(login(jtiA, null));
  await service.registerSession(login(jtiB, deviceB));
  await service.registerSession(login(jtiC, deviceA, { previousSessionToken: previous() }));
  assert.equal((await service.getActiveSessions(7)).length, 2);
  assert.equal(await service.hasMatchingDeviceSession(login('d'.repeat(32), deviceA)), true);
});

test('paid legacy browser is migrated at capacity using signed previous session', async () => {
  paid = true;
  await service.registerSession(login(jtiA, null));
  await service.registerSession(login(jtiB, deviceB));
  const returning = login(jtiC, deviceA, { previousSessionToken: previous(), ipAddress: '198.51.100.2' });
  assert.equal(await service.hasMatchingDeviceSession(returning), true);
  await service.registerSession(returning);
  assert.equal((await service.getRememberedDevices(7)).length, 2);
  assert.equal((await service.getActiveSessions(7)).length, 2);
});

test('refresh extends the same session and never revives expired or revoked sessions', async () => {
  await service.registerSession(login(jtiA, deviceA));
  const later = new Date(Date.now() + 7 * 86400000);
  assert.equal(await service.renewSession(jtiA, 7, later), true);
  assert.equal(+(await service.getActiveSessions(7))[0].expires_at, +later);
  assert.equal(await service.renewSession(jtiA, 8, later), false);
  await pg.query('INSERT INTO token_blacklist(token_jti) VALUES ($1)', [jtiA]);
  assert.equal(await service.renewSession(jtiA, 7, later), false);
  await pg.exec('TRUNCATE token_blacklist');
  await pg.query("UPDATE user_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE jti = $1", [jtiA]);
  assert.equal(await service.renewSession(jtiA, 7, later), false);
  assert.equal(await service.renewSession(jtiB, 7, later), false);
});

test('refresh endpoint keeps database expiry aligned with its newly issued refresh token', async () => {
  const User = require('../src/models/User');
  const controller = require('../src/controllers/authController');
  const originalFind = User.findById;
  const oldSecret = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_REFRESH_SECRET = 'refresh-lifecycle-secret';
  User.findById = async () => ({ id: 7, email: 'test@example.com', role: 'student', is_active: true });
  try {
    await service.registerSession(login(jtiA, deviceA));
    const token = jwt.sign({ id: 7, jti: jtiA }, process.env.JWT_REFRESH_SECRET,
      { issuer: 'csca-app', expiresIn: '7d' });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; } };
    await controller.refreshToken({ body: { refreshToken: token } }, res);
    assert.equal(res.statusCode, 200);
    const decoded = jwt.verify(res.body.data.refreshToken, process.env.JWT_REFRESH_SECRET);
    assert.equal(decoded.jti, jtiA);
    assert.equal(+(await service.getActiveSessions(7))[0].expires_at, decoded.exp * 1000);
    await pg.query('DELETE FROM user_sessions WHERE jti = $1', [jtiA]);
    await controller.refreshToken({ body: { refreshToken: token } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'SESSION_REVOKED');
  } finally {
    User.findById = originalFind;
    if (oldSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = oldSecret;
  }
});

test('authentication reports a database outage as temporary failure, not invalid credentials', async () => {
  const { authenticate } = require('../src/middleware/authMiddleware');
  const query = db.query;
  const logError = console.error;
  db.query = async () => { throw new Error('Simulated database outage'); };
  console.error = () => {};
  try {
    const token = jwt.sign({ id: 7, jti: jtiA }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; } };
    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('must not authorize'));
    assert.equal(res.statusCode, 503);
    await authenticate({ headers: { authorization: 'Bearer invalid' } }, res, () => assert.fail('must not authorize'));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'INVALID_TOKEN');
  } finally {
    db.query = query;
    console.error = logError;
  }
});
