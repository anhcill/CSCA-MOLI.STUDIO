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
  await pg.exec(`CREATE TABLE users(id INT PRIMARY KEY, device_limit_attempts INT DEFAULT 0, device_limit_locked_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE, is_banned BOOLEAN DEFAULT FALSE, banned_at TIMESTAMPTZ,
      banned_by INT, ban_reason TEXT, updated_at TIMESTAMPTZ);
    INSERT INTO users(id) VALUES (7);
    CREATE TABLE user_roles(user_id INT, role_id INT);
    CREATE TABLE roles(id INT, code TEXT);
    CREATE TABLE role_permissions(role_id INT, permission_id INT);
    CREATE TABLE permissions(id INT, code TEXT);
    CREATE TABLE auth_challenges(id SERIAL PRIMARY KEY, user_id INT, purpose TEXT, challenge_hash TEXT,
      otp_hash TEXT, otp_expires_at TIMESTAMPTZ, attempts INT DEFAULT 0, consumed_at TIMESTAMPTZ);
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
  await pg.exec('UPDATE users SET device_limit_attempts = 0, device_limit_locked_at = NULL, is_active = TRUE, is_banned = FALSE');
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
    const result = await service.registerSession(returning);
    assert.equal(result.jti, jtiA);
    assert.equal((await service.getActiveSessions(7)).length, 2);
    assert.equal(await service.assertActiveSession(jtiB, 7), true);
    assert.equal(await service.assertActiveSession(jtiA, 7), true);
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

const response = () => ({ statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('admin reset allows the same browser back, but never revives its old token', async () => {
  paid = true;
  const admin = require('../src/controllers/adminDeviceController');
  await service.registerSession(login(jtiA, deviceA));
  const res = response();
  await admin.resetDevicesAndUnlock({ params: { userId: '7' }, user: { id: 99 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(await service.assertActiveSession(jtiA, 7), false);
  const next = await service.registerSession(login(jtiB, deviceA));
  assert.equal(next.jti, jtiB);
  assert.equal((await service.getRememberedDevices(7)).length, 1);
  assert.equal(await service.renewSession(jtiA, 7, new Date(Date.now() + 86400000)), false);
});

test('a revoked browser cannot reclaim a slot already occupied by new devices', async () => {
  paid = true;
  await service.registerSession(login(jtiA, deviceA));
  const admin = require('../src/controllers/adminDeviceController');
  const [device] = await service.getRememberedDevices(7);
  const res = response();
  await admin.revokeDevice({ params: { userId: '7', deviceId: String(device.id) }, user: { id: 99 } }, res);
  assert.equal(res.statusCode, 200);
  await service.registerSession(login(jtiB, deviceB));
  await service.registerSession(login(jtiC, 'browser-c-123456789'));
  await assert.rejects(service.registerSession(login('d'.repeat(32), deviceA)), { code: 'DEVICE_LIMIT_REACHED' });
  assert.equal((await service.getRememberedDevices(7)).length, 2);
});

test('revoking a remembered legacy device also removes its unlinked session', async () => {
  await service.registerSession(login(jtiA, null));
  paid = true;
  await service.hydrateRememberedDevices(7);
  const [legacy] = await service.getRememberedDevices(7);
  // Reproduce pre-fix data: remembered device exists but session has no key.
  await pg.query('UPDATE user_sessions SET device_key = NULL WHERE jti = $1', [jtiA]);
  await service.registerSession(login(jtiB, deviceB));
  await pg.query('UPDATE user_sessions SET device_key = NULL WHERE jti = $1', [jtiA]);
  const admin = require('../src/controllers/adminDeviceController');
  const res = response();
  await admin.revokeDevice({ params: { userId: '7', deviceId: String(legacy.id) }, user: { id: 99 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(await service.assertActiveSession(jtiA, 7), false);
  assert.equal(await service.assertActiveSession(jtiB, 7), true);
  assert.equal((await pg.query('SELECT 1 FROM token_blacklist WHERE token_jti = $1', [jtiA])).rows.length, 1);
});

test('repeated full-capacity login attempts do not lock the account or revoke existing sessions', async () => {
  paid = true;
  const User = require('../src/models/User');
  const controller = require('../src/controllers/authController');
  const find = User.findByEmail;
  const compare = User.comparePassword;
  User.findByEmail = async () => ({ id: 7, email: 'test@example.com', password: 'hash', is_active: true, role: 'student' });
  User.comparePassword = async () => true;
  try {
    await service.registerSession(login(jtiA, deviceA));
    await service.registerSession(login(jtiB, deviceB));
    for (let i = 0; i < 6; i++) {
      const res = response();
      await controller.login({ body: { email: 'test@example.com', password: 'valid' },
        headers: { 'x-device-id': 'browser-c-123456789' }, get: () => 'Chrome', ip: '203.0.113.1' }, res);
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, 'DEVICE_LIMIT_REACHED');
    }
    const user = (await pg.query('SELECT * FROM users WHERE id = 7')).rows[0];
    assert.equal(user.device_limit_attempts, 6);
    assert.equal(user.is_active, true);
    assert.equal(user.is_banned, false);
    assert.equal(user.device_limit_locked_at, null);
    assert.equal(await service.assertActiveSession(jtiA, 7), true);
    assert.equal(await service.assertActiveSession(jtiB, 7), true);
    assert.equal((await service.getRememberedDevices(7)).length, 2);
  } finally {
    User.findByEmail = find;
    User.comparePassword = compare;
  }
});

for (const paidPolicy of [false, true]) {
  test(`${paidPolicy ? 'paid' : 'free'}: re-login keeps both tabs valid until explicit logout`, async () => {
    paid = paidPolicy;
    const first = await service.registerSession(login(jtiA, deviceA));
    const originalId = (await service.getActiveSessions(7))[0].id;
    const second = await service.registerSession(login(jtiB, deviceA, { expiresAt: new Date(Date.now() + 60000) }));
    assert.equal(first.jti, second.jti);
    const sessions = await service.getActiveSessions(7);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, originalId);
    assert.ok(+sessions[0].expires_at > Date.now() + 3600000);
    assert.equal((await pg.query('SELECT * FROM token_blacklist')).rows.length, 0);
    assert.equal(await service.renewSession(first.jti, 7, new Date(Date.now() + 86400000)), true);
    assert.equal(await service.renewSession(second.jti, 7, new Date(Date.now() + 86400000)), true);
    await service.removeSession(second.jti, 7);
    assert.equal(await service.assertActiveSession(first.jti, 7), false);
  });
}

test('OTP login signs tokens using the reused server session', async () => {
  const User = require('../src/models/User');
  const controller = require('../src/controllers/authController');
  const find = User.findById;
  const oldSecret = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_REFRESH_SECRET = 'login-test-secret';
  User.findById = async () => ({ id: 7, email: 'test@example.com', role: 'student', is_active: true });
  try {
    await service.registerSession(login(jtiA, deviceA));
    const challengeToken = 'q'.repeat(64);
    const challengeHash = require('node:crypto').createHash('sha256').update(challengeToken).digest('hex');
    const otpHash = await require('bcrypt').hash('123456', 4);
    await pg.query(`INSERT INTO auth_challenges(user_id, purpose, challenge_hash, otp_hash, otp_expires_at)
      VALUES (7, 'login', $1, $2, NOW() + INTERVAL '5 minutes')`, [challengeHash, otpHash]);
    const res = response();
    await controller.verifyOtp({ body: { challengeToken, otp: '123456' }, headers: { 'x-device-id': deviceA },
      get: () => 'Chrome', ip: '203.0.113.1' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(jwt.verify(res.body.data.token, process.env.JWT_SECRET).jti, jtiA);
    assert.equal(jwt.verify(res.body.data.refreshToken, process.env.JWT_REFRESH_SECRET).jti, jtiA);
  } finally {
    User.findById = find;
    if (oldSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = oldSecret;
  }
});
