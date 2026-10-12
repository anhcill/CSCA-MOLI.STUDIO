const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const db = require('../src/config/database');
const DeviceSessionService = require('../src/services/deviceSessionService');
const { getPreviousSessionJti } = require('../src/utils/previousSession');

const ownJti = 'a'.repeat(32);
const otherJti = 'b'.repeat(32);
const newJti = 'c'.repeat(32);
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'device-session-regression-test-secret';
test.after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

function token(payload = {}, options = {}) {
  return jwt.sign({ id: 7, email: 'student@example.com', jti: ownJti, ...payload }, process.env.JWT_SECRET,
    { issuer: 'csca-app', expiresIn: '-1d', ...options });
}

test('expired signed access token identifies its own slot without granting authentication', () => {
  const previousToken = token();
  assert.throws(() => jwt.verify(previousToken, process.env.JWT_SECRET), { name: 'TokenExpiredError' });
  assert.equal(getPreviousSessionJti(previousToken, 7), ownJti);
});

test('identity rejects forgery, another account, another token purpose and wrong issuer', () => {
  const forged = jwt.sign({ id: 7, email: 'student@example.com', jti: ownJti }, 'wrong-secret', { issuer: 'csca-app' });
  for (const invalid of [forged, token({ id: 8 }), token({ aud: 'admin-mfa' }), token({}, { issuer: 'another-app' }), token({ email: undefined }), 'invalid', 'x'.repeat(8193)]) {
    assert.equal(getPreviousSessionJti(invalid, 7), null);
  }
});

// Model only the session statements used by registerSession, with transaction
// snapshots to verify both slot accounting and rollback without a live DB.
async function withSessions(initial, run, { failInsert = false } = {}) {
  let sessions = structuredClone(initial);
  let blacklist = [];
  let snapshot;
  const queries = [];
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  const originalMax = DeviceSessionService.getUserMaxDevices;
  const active = (row, userId, deviceType) => row.user_id === userId
    && (!deviceType || row.device_type === deviceType) && row.expires_at > Date.now();
  const query = async (sql, params = []) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    queries.push({ sql, params });
    if (sql === 'BEGIN') { snapshot = { sessions: structuredClone(sessions), blacklist: [...blacklist] }; return { rows: [] }; }
    if (sql === 'COMMIT' || sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql === 'ROLLBACK') { ({ sessions, blacklist } = snapshot); return { rows: [] }; }
    if (sql.startsWith('SELECT id FROM user_sessions')) {
      return { rows: sessions.filter(row => row.jti === params[0] && active(row, params[1])) };
    }
    if (sql.startsWith('SELECT 1 FROM user_sessions')) {
      return { rows: sessions.filter(row => active(row, params[0], params[1]) && row.jti === params[2]) };
    }
    if (sql.startsWith('DELETE FROM user_sessions')) {
      assert.match(sql, /AND jti = \$3/);
      const removed = sessions.filter(row => active(row, params[0], params[1]) && row.jti === params[2]);
      sessions = sessions.filter(row => !removed.includes(row));
      return { rows: removed };
    }
    if (sql.startsWith('INSERT INTO token_blacklist')) { blacklist.push(params[0]); return { rows: [] }; }
    if (sql.startsWith('SELECT id, jti')) return { rows: sessions.filter(row => active(row, params[0], params[1])) };
    if (sql.startsWith('INSERT INTO user_sessions')) {
      if (failInsert) throw new Error('Simulated database failure');
      sessions.push({ user_id: params[0], jti: params[1], device_type: params[3], expires_at: +params[6] });
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  db.query = query;
  db.pool.connect = async () => ({ query, release() {} });
  DeviceSessionService.getUserMaxDevices = async () => 2;
  try {
    await run({ sessions: () => sessions, blacklist: () => blacklist, queries });
  } finally {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    DeviceSessionService.getUserMaxDevices = originalMax;
  }
}

const session = (jti, extra = {}) => ({ user_id: 7, jti, device_type: 'desktop', expires_at: Date.now() + 86400000, ...extra });
const login = (previousSessionToken) => ({ userId: 7, jti: newJti, deviceType: 'desktop',
  userAgent: 'Updated browser', ipAddress: '203.0.113.2', expiresAt: new Date(Date.now() + 604800000), previousSessionToken });

test('same browser with a new IP and UA reuses its own slot when both slots are occupied', async () => {
  await withSessions([session(ownJti), session(otherJti)], async state => {
    assert.equal(await DeviceSessionService.hasMatchingDeviceSession(login(token())), true);
    await DeviceSessionService.registerSession(login(token()));
    assert.deepEqual(state.sessions().map(row => row.jti), [otherJti, newJti]);
    assert.deepEqual(state.blacklist(), [ownJti]);
    assert.ok(state.queries.some(query => query.sql.startsWith('SELECT pg_advisory_xact_lock')));
  });
});

test('invalid proof cannot evict a similar browser or bypass a full device limit', async () => {
  await withSessions([session(ownJti), session(otherJti)], async state => {
    assert.equal(await DeviceSessionService.hasMatchingDeviceSession(login(token({ id: 8 }))), false);
    await assert.rejects(DeviceSessionService.registerSession(login(token({ id: 8 }))), { code: 'DEVICE_LIMIT_REACHED' });
    assert.deepEqual(state.sessions().map(row => row.jti), [ownJti, otherJti]);
    assert.deepEqual(state.blacklist(), []);
  });
});

test('revoked or expired previous sessions cannot claim another active slot', async () => {
  for (const previous of [[], [session(ownJti, { expires_at: Date.now() - 1000 })]]) {
    await withSessions([...previous, session(otherJti), session('d'.repeat(32))], async state => {
      assert.equal(await DeviceSessionService.hasMatchingDeviceSession(login(token())), false);
      await assert.rejects(DeviceSessionService.registerSession(login(token())), { code: 'DEVICE_LIMIT_REACHED' });
      assert.deepEqual(state.blacklist(), []);
    });
  }
});

test('expired sessions do not consume slots on the seventh-day re-login', async () => {
  await withSessions([session(ownJti, { expires_at: Date.now() - 1000 }), session(otherJti)], async state => {
    await DeviceSessionService.registerSession(login(token()));
    assert.equal(state.sessions().filter(row => row.expires_at > Date.now()).length, 2);
    assert.deepEqual(state.blacklist(), []);
  });
});

test('a failed replacement restores the old session and blacklist atomically', async () => {
  await withSessions([session(ownJti), session(otherJti)], async state => {
    await assert.rejects(DeviceSessionService.registerSession(login(token())), /Simulated database failure/);
    assert.deepEqual(state.sessions().map(row => row.jti), [ownJti, otherJti]);
    assert.deepEqual(state.blacklist(), []);
  }, { failInsert: true });
});
