const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const bcrypt = require('bcrypt');
const express = require('express');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');

const { applyMigration: applyVideoCommerceMigration } = require('../scripts/apply_video_commerce_migration');
const { applyMigration: applyCourseIntegrationMigration } = require('../scripts/apply_course_integration_migration');
const { createCourseIntegrationClient, buildMolySignature } = require('../src/services/courseIntegrationClient');
const { createCourseOutboxSyncService } = require('../src/services/courseOutboxSyncService');
const { createCourseOwnershipProjectionService } = require('../src/services/courseOwnershipProjectionService');
const { createVideoCommerceRepository } = require('../src/repositories/videoCommerceRepository');
const { createVideoAdminService } = require('../src/services/videoAdminService');
const { createCourseInboundAuth } = require('../src/middleware/courseInboundAuth');
const { createCourseSsoService } = require('../src/services/courseSsoService');
const { createMolySsoRouters } = require('../src/routes/ssoRoutes');
const {
  buildSsoCallbackUrl,
  computePkceChallengeS256,
  generatePkceVerifier,
  resolveSsoTtlSeconds,
  validateSsoTargetPath,
} = require('../src/utils/ssoPathPolicy');

async function startMolyBrowserSso(agent, { targetPath = '/khoa-hoc' } = {}) {
  const res = await agent.post('/api/sso/csca-course/start').send({ targetPath });
  assert.equal(res.status, 200);
  const authUrl = new URL(res.body.data.authorizeUrl);
  return {
    state: authUrl.searchParams.get('state'),
    codeChallenge: authUrl.searchParams.get('code_challenge'),
    codeChallengeMethod: authUrl.searchParams.get('code_challenge_method'),
    targetPath: res.body.data.targetPath,
    authorizeUrl: res.body.data.authorizeUrl,
  };
}

test('Codex: exact identity state, safe-link drift, response nonce and unverified email', async (t) => {
  const ctx = await setupDay4MolyEnv(t);
  const agent = request.agent(ctx.app);
  const assertion = {
    source_system: 'csca-course', source_user_id: '9501', email: 'codex-unverified@test.local',
    email_verified: false, role: 'student', target_path: '/khoa-hoc',
  };
  ctx.setSsoExchangeHandler(async ({ nonce }) => ({
    status: 200, body: { success: true, data: { ...assertion, nonce } },
  }));
  const consumeWithBrowserTx = async (code = 'codex-code') => {
    const tx = await startMolyBrowserSso(agent, { targetPath: '/khoa-hoc' });
    return agent.post('/api/sso/consume').send({ code, state: tx.state });
  };
  const loginRes = await consumeWithBrowserTx('codex-code-1');
  assert.equal(loginRes.status, 200);
  const userId = loginRes.body.data.user.id;
  const flags = (await ctx.db.query('SELECT email_verified,is_verified FROM users WHERE id=$1', [userId])).rows[0];
  assert.equal(flags.email_verified, false);
  assert.equal(flags.is_verified, false);
  await ctx.db.query("UPDATE external_identities SET status='expired' WHERE user_id=$1", [userId]);
  const revokedRes = await consumeWithBrowserTx('codex-code-2');
  assert.equal(revokedRes.status, 403);
  assert.equal(revokedRes.body.code, 'SSO_IDENTITY_REVOKED');
  ctx.setSsoExchangeHandler(async () => ({
    status: 200, body: { success: true, data: { ...assertion, nonce: 'different-state' } },
  }));
  const mismatchRes = await consumeWithBrowserTx('codex-code-3');
  assert.equal(mismatchRes.body.code, 'SSO_INVALID_RESPONSE');
  ctx.setSsoExchangeHandler(async ({ nonce }) => ({
    status: 200, body: { success: true, data: { ...assertion, nonce } },
  }));
  assertion.source_user_id = '9502';
  const challengeRes = await consumeWithBrowserTx('codex-code-4');
  assert.equal(challengeRes.status, 200);
  assert.equal(challengeRes.body.data.status, 'LINK_REQUIRED');
  const other = (await ctx.db.query(
    "INSERT INTO users(username,email,role,is_active) VALUES ('codex-other','codex-other@test.local','student',true) RETURNING id",
  )).rows[0];
  await ctx.db.query(
    "INSERT INTO external_identities(source_system,external_user_id,user_id,status,source_updated_at) VALUES ('csca-course','csca-course:9502',$1,'active',NOW())",
    [other.id],
  );
  const driftRes = await agent
    .post('/api/sso/link/confirm')
    .set('x-test-user-id', String(userId))
    .send({ linkToken: challengeRes.body.data.linkToken });
  assert.equal(driftRes.status, 409);
  assert.equal(driftRes.body.code, 'IDENTITY_ALREADY_LINKED');
  assert.equal((await ctx.db.query('SELECT completed_at FROM integration_sso_link_requests')).rows[0].completed_at, null);
  await ctx.db.query("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE");
  await ctx.db.query("UPDATE users SET is_banned=TRUE WHERE id=$1", [userId]);
  const bannedVerifier = generatePkceVerifier();
  const bannedIntent = await request(ctx.app).post('/api/sso/course/intent').set('x-test-user-id', String(userId)).send({});
  assert.equal(bannedIntent.status, 403);
  assert.equal(bannedIntent.body.code, 'SSO_USER_REVOKED');
  const bannedAuth = await request(ctx.app).post('/api/sso/course/authorize').set('x-test-user-id', String(userId)).send({
    state: 'banned-state-valid-001',
    codeChallenge: computePkceChallengeS256(bannedVerifier),
    codeChallengeMethod: 'S256',
  });
  assert.equal(bannedAuth.status, 403);
  assert.equal(bannedAuth.body.code, 'SSO_USER_REVOKED');
  await ctx.db.query("UPDATE users SET is_banned=FALSE WHERE id=$1", [userId]);
  await ctx.db.query("CREATE TABLE roles(id INTEGER PRIMARY KEY, code TEXT)");
  await ctx.db.query("CREATE TABLE user_roles(user_id INTEGER, role_id INTEGER)");
  await ctx.db.query("INSERT INTO roles VALUES (1,'exam_admin')");
  await ctx.db.query("INSERT INTO user_roles VALUES ($1,1)", [userId]);
  const privAuth = await request(ctx.app).post('/api/sso/course/authorize').set('x-test-user-id', String(userId)).send({
    state: 'priv-role-state-valid-001',
    codeChallenge: computePkceChallengeS256(generatePkceVerifier()),
    codeChallengeMethod: 'S256',
  });
  assert.equal(privAuth.status, 403);
  assert.equal(privAuth.body.code, 'PRIVILEGED_ROLE_COLLISION');
});

test('Codex: local ownership cannot advertise purchase or bypass a remote access block', () => {
  const { mergeCourseOwnershipView } = require('../src/services/courseService');
  const view = mergeCourseOwnershipView({}, {
    status: 'grant_blocked', canPurchase: false, canLaunchCourse: false, courseOfferingId: 'moly:1',
  }, true);
  assert.equal(view.canLaunchCourse, false);
  assert.equal(view.canPurchase, false);
  assert.equal(mergeCourseOwnershipView({}, { status: 'not_owned', canPurchase: true }, true).canPurchase, false);
});

test('Codex: inbound HMAC fails closed without captured raw bytes', () => {
  const body = { code: 'private-code', nonce: 'state' };
  const signed = signInboundCourseRequest(body);
  let response;
  createCourseInboundAuth({ config: INBOUND_CFG })(
    { body, get: (name) => signed.headers[name] },
    { status: (status) => ({ json: (payload) => { response = { status, ...payload }; } }) },
    () => assert.fail('Reconstructed JSON must not authenticate'),
  );
  assert.equal(response.code, 'RAW_BODY_REQUIRED');
});
const OUTBOUND_CFG = {
  serviceToken: 'moly-outbound-course-token',
  integrationKey: 'moly-studio-prod',
  hmacSecret: 'moly-outbound-course-hmac-secret',
};

const INBOUND_CFG = {
  serviceToken: 'course-inbound-moly-token',
  integrationKey: 'csca-course-prod',
  hmacSecret: 'course-inbound-moly-hmac-secret',
};

const readMigration = (name) =>
  fs.readFileSync(path.join(__dirname, '../../database/migrations', name), 'utf8');

function pgliteMigrationClient(pg) {
  return {
    query: async (sql, values) => (values ? pg.query(sql, values) : (await pg.exec(sql)).at(-1)),
  };
}

function wrapPgliteDb(pg) {
  let txChain = Promise.resolve();
  return {
    query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
    transaction(work) {
      const run = txChain.then(async () => {
        await pg.exec('BEGIN');
        try {
          const out = await work({
            query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
          });
          await pg.exec('COMMIT');
          return out;
        } catch (err) {
          await pg.exec('ROLLBACK').catch(() => {});
          throw err;
        }
      });
      txChain = run.catch(() => {});
      return run;
    },
    pool: {
      connect: async () => ({
        query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
        release: () => {},
      }),
    },
  };
}

async function createBootstrappedSchema(pg) {
  await pg.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT,
      password TEXT NULL,
      full_name TEXT,
      avatar TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'student',
      oauth_provider TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      is_verified BOOLEAN DEFAULT TRUE,
      is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',
      vip_tier TEXT,
      vip_status TEXT DEFAULT 'inactive',
      vip_package_id INTEGER,
      vip_started_at TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      vip_allowed_subjects TEXT[] DEFAULT ARRAY[]::TEXT[],
      coin_balance INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      device_limit_locked_at TIMESTAMPTZ,
      locked_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE materials (id SERIAL PRIMARY KEY);
    CREATE TABLE vip_packages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      tier TEXT,
      allowed_subjects TEXT[] DEFAULT ARRAY['MATH'],
      requires_subject_choice BOOLEAN DEFAULT FALSE,
      price INTEGER,
      duration_days INTEGER DEFAULT 90,
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      package_id INTEGER REFERENCES vip_packages(id),
      order_code BIGINT UNIQUE,
      transaction_code TEXT UNIQUE,
      amount INTEGER,
      final_amount INTEGER,
      discount_amount INTEGER DEFAULT 0,
      package_duration INTEGER DEFAULT 90,
      package_name TEXT,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'payos',
      payment_channel TEXT,
      paid_at TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      raw_response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE user_vip_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      package_id INTEGER REFERENCES vip_packages(id),
      transaction_id INTEGER REFERENCES transactions(id),
      allowed_subjects TEXT[],
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE coupons (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER,
      max_uses_per_user INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      valid_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 day',
      valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
      is_active BOOLEAN DEFAULT TRUE,
      min_purchase_amount INTEGER DEFAULT 0,
      applicable_package_ids INTEGER[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE coupon_usages (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER REFERENCES coupons(id),
      user_id INTEGER REFERENCES users(id),
      transaction_id INTEGER REFERENCES transactions(id),
      discount_amount INTEGER DEFAULT 0,
      used_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE coin_ledger (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      amount INTEGER NOT NULL,
      type TEXT,
      reason TEXT,
      reference_id INTEGER,
      balance_after INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END $$;
  `);

  await pg.exec(readMigration('052_csca_courses_core.sql'));
  await pg.exec(readMigration('053_csca_course_progress.sql'));
  await pg.exec(readMigration('054_csca_video_assets.sql'));
  await pg.exec(readMigration('055_csca_course_package_access.sql'));
  await applyVideoCommerceMigration({
    query: async (sql, values) => (values ? pg.query(sql, values) : (await pg.exec(sql)).at(-1)),
  });
  await pg.exec(readMigration('068_video_commerce_payments.sql'));
  await pg.exec(readMigration('069_video_commerce_admin.sql'));
  await applyCourseIntegrationMigration(pgliteMigrationClient(pg));
}

async function setupDay4MolyEnv(t) {
  const pg = new PGlite();
  t.after(async () => {
    await pg.close();
  });
  await createBootstrappedSchema(pg);
  const db = wrapPgliteDb(pg);

  let fakeNow = new Date('2026-11-15T10:00:00.000Z');
  const peerRequests = [];
  const boundPeerIdentities = [];
  let ssoExchangeHandler = async () => ({
    status: 401,
    body: { success: false, errorCode: 'SSO_CODE_INVALID', message: 'Unexpected course sso exchange' },
  });
  let ownershipQueryHandler = async ({ external_course_ids }) => ({
    items: (external_course_ids || []).map((id) => ({
      external_course_id: id,
      owned: false,
      status: 'not_owned',
    })),
  });

  const peerServer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const rawBuf = Buffer.concat(chunks);
      const auth = req.headers.authorization;
      const key = req.headers['x-integration-key'];
      const ts = req.headers['x-event-timestamp'];
      const sig = req.headers['x-signature'];
      assert.equal(auth, `Bearer ${OUTBOUND_CFG.serviceToken}`);
      assert.equal(key, OUTBOUND_CFG.integrationKey);
      const expected = buildMolySignature({ timestamp: ts, rawBody: rawBuf, secret: OUTBOUND_CFG.hmacSecret });
      assert.equal(sig, expected);

      const body = rawBuf.length ? JSON.parse(rawBuf.toString('utf8')) : {};
      peerRequests.push({ url: req.url, body });

      if (req.url === '/api/integrations/v1/sso/exchange') {
        const out = await ssoExchangeHandler(body);
        res.writeHead(out.status || 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(out.body));
        return;
      }
      if (req.url === '/api/integrations/v1/sso/bind-identity') {
        boundPeerIdentities.push(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { bound: true } }));
        return;
      }
      if (req.url === '/api/integrations/v1/ownership/query') {
        const data = await ownershipQueryHandler(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { inbox_id: peerRequests.length, status: 'completed' } }));
    });
  });

  await new Promise((resolve) => peerServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => peerServer.close((err) => (err ? reject(err) : resolve()))));
  const peerBaseUrl = `http://127.0.0.1:${peerServer.address().port}`;

  const courseClient = createCourseIntegrationClient({
    config: {
      baseUrl: peerBaseUrl,
      courseWebBaseUrl: 'https://course.example.test',
      serviceToken: OUTBOUND_CFG.serviceToken,
      integrationKey: OUTBOUND_CFG.integrationKey,
      hmacSecret: OUTBOUND_CFG.hmacSecret,
      maxTransportAttempts: 1,
    },
    now: () => fakeNow.getTime(),
  });

  const outbox = createCourseOutboxSyncService({ db, client: courseClient });
  const ownership = createCourseOwnershipProjectionService({ db, client: courseClient, outbox });

  const ssoService = createCourseSsoService({
    db,
    courseClient,
    ownership,
    issueMolySession: async ({ user }) => ({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token: `moly-jwt-${user.id}`,
      refreshToken: `moly-rt-${user.id}`,
    }),
    now: () => fakeNow,
    env: { ...process.env, COURSE_WEB_BASE_URL: 'https://course.example.test', COURSE_SSO_TTL_SECONDS: '90' },
  });

  const verifyInbound = createCourseInboundAuth({ config: INBOUND_CFG });
  const { userRouter, inboundRouter } = createMolySsoRouters({
    ssoService,
    verifyInbound,
    authenticateUser: (req, res, next) => {
      const uid = Number(req.get('x-test-user-id'));
      if (!uid) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
      req.user = { id: uid, role: req.get('x-test-user-role') || 'student', email: req.get('x-test-user-email') || '' };
      return next();
    },
    optionalAuth: (req, _res, next) => {
      const uid = Number(req.get('x-test-user-id'));
      if (uid) {
        req.user = { id: uid, role: req.get('x-test-user-role') || 'student', email: req.get('x-test-user-email') || '' };
      }
      return next();
    },
  });

  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }));
  app.get('/sso/callback', (_req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.status(200).send('<html>moly sso callback</html>');
  });
  app.use('/api/sso', userRouter);
  app.use('/api/integrations/v1/sso', inboundRouter);

  return {
    pg,
    db,
    app,
    ownership,
    ssoService,
    peerRequests,
    boundPeerIdentities,
    setNow: (d) => { fakeNow = d instanceof Date ? d : new Date(d); },
    setSsoExchangeHandler: (fn) => { ssoExchangeHandler = fn; },
    setOwnershipQueryHandler: (fn) => { ownershipQueryHandler = fn; },
  };
}

function signInboundCourseRequest(bodyObj, {
  secret = INBOUND_CFG.hmacSecret,
  token = INBOUND_CFG.serviceToken,
  key = INBOUND_CFG.integrationKey,
  timestamp = new Date().toISOString(),
} = {}) {
  const rawBody = JSON.stringify(bodyObj);
  const sigDigest = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), Buffer.from(rawBody, 'utf8')]))
    .digest('hex');
  return {
    rawBody,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Integration-Key': key,
      'X-Event-Timestamp': timestamp,
      'X-Signature': `sha256=${sigDigest}`,
    },
  };
}

test('Moly SSO path policy clamps 60..120s TTL, builds #code fragment URLs, and rejects open redirects', () => {
  assert.equal(resolveSsoTtlSeconds(undefined), 90);
  assert.equal(resolveSsoTtlSeconds(20), 60);
  assert.equal(resolveSsoTtlSeconds(500), 120);
  assert.equal(validateSsoTargetPath('/video-courses/off_101', { targetSystem: 'csca-course' }), '/video-courses/off_101');
  assert.equal(validateSsoTargetPath('/video-courses/moly:off_101', { targetSystem: 'csca-course' }), '/video-courses/moly:off_101');
  assert.equal(validateSsoTargetPath('/khoa-hoc/toan-1', { targetSystem: 'moly' }), '/khoa-hoc/toan-1');

  for (const bad of [
    'https://evil.com',
    'javascript:alert(1)',
    '/video-courses/javascript:alert(1)',
    '//evil.com',
    '/%2f%2fevil.com',
    '/admin',
    '/lms/teach',
    '/courses?code=leak',
    '/courses#hash',
    '/video-courses/../secret',
  ]) {
    assert.throws(() => validateSsoTargetPath(bad, { targetSystem: 'csca-course' }));
    assert.throws(() => validateSsoTargetPath(bad, { targetSystem: 'moly' }));
  }

  const built = new URL(buildSsoCallbackUrl({
    webBaseUrl: 'https://course.example.com',
    code: 'secret_code_1',
    state: 'state_1',
  }));
  assert.equal(built.search, '');
  const hash = new URLSearchParams(built.hash.slice(1));
  assert.equal(hash.get('code'), 'secret_code_1');
  assert.equal(hash.get('state'), 'state_1');
});

test('Case 1 & Happy Path: Course-only learner SSO -> Moly JIT account, buys course, and outbound Course SSO works with concurrent replay protection', async (t) => {
  const ctx = await setupDay4MolyEnv(t);

  // Seed course 101 mapped to offering off_101
  await ctx.db.query(
    `INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status)
     VALUES (101, 'toan-101', 'toan-101', 'Toan CSCA', 'MATH', 'basic', 'package', 'published')`,
  );
  await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
     VALUES ('moly', 'moly:off_101', 101, 'active')`,
  );

  // /sso/callback sets no-referrer & no-store
  const cbRes = await request(ctx.app).get('/sso/callback');
  assert.equal(cbRes.status, 200);
  assert.equal(cbRes.headers['referrer-policy'], 'no-referrer');
  assert.match(cbRes.headers['cache-control'] || '', /no-store/);

  // 1) Course-only user starts browser-bound PKCE SSO and consumes Course -> Moly SSO code
  const used = new Set();
  const seenExchangePayloads = [];
  ctx.setSsoExchangeHandler(async ({ code, nonce, code_verifier }) => {
    seenExchangePayloads.push({ code, nonce, code_verifier });
    if (used.has(code)) {
      return { status: 409, body: { success: false, errorCode: 'SSO_CODE_ALREADY_USED', message: 'Replayed' } };
    }
    used.add(code);
    return {
      status: 200,
      body: {
        success: true,
        data: {
          source_system: 'csca-course',
          source_user_id: '501',
          email: 'course.only@example.com',
          email_verified: true,
          username: 'course_only',
          display_name: 'Course Only Learner',
          role: 'student',
          target_path: '/khoa-hoc/toan-101',
          nonce,
        },
      },
    };
  });

  const agentA = request.agent(ctx.app);
  const tx1 = await startMolyBrowserSso(agentA, { targetPath: '/khoa-hoc/toan-101' });
  assert.equal(tx1.codeChallengeMethod, 'S256');
  assert.ok(tx1.codeChallenge && tx1.state);

  const consumeRes = await agentA
    .post('/api/sso/consume')
    .send({ code: 'course-code-501', state: tx1.state });
  assert.equal(consumeRes.status, 200);
  assert.equal(consumeRes.body.data.status, 'AUTHENTICATED');
  assert.equal(consumeRes.body.data.redirectPath, '/khoa-hoc/toan-101');
  assert.ok(consumeRes.body.data.token.startsWith('moly-jwt-'));
  assert.equal(seenExchangePayloads[0].nonce, tx1.state);
  assert.ok(seenExchangePayloads[0].code_verifier && seenExchangePayloads[0].code_verifier.length >= 43);

  const molyUser = (await ctx.db.query("SELECT * FROM users WHERE email = 'course.only@example.com'")).rows[0];
  assert.equal(molyUser.password, null);
  assert.equal(molyUser.oauth_provider, 'sso');
  assert.equal(molyUser.role, 'student');

  const ident = (await ctx.db.query(
    "SELECT * FROM external_identities WHERE source_system = 'csca-course' AND external_user_id = 'csca-course:501'",
  )).rows[0];
  assert.equal(Number(ident.user_id), Number(molyUser.id));
  assert.equal(ident.link_method, 'sso');

  // Peer bind-identity notified cleanly with canonical moly:<id> & raw target 501
  assert.equal(ctx.boundPeerIdentities.length, 1);
  assert.equal(ctx.boundPeerIdentities[0].external_user_id, `moly:${molyUser.id}`);
  assert.equal(ctx.boundPeerIdentities[0].target_user_id, '501');

  // Same-browser replay fails on cleared/consumed tx cookie; fresh browser tx still hits 409 SSO_CODE_ALREADY_USED
  const sameTxReplay = await agentA
    .post('/api/sso/consume')
    .send({ code: 'course-code-501', state: tx1.state });
  assert.equal(sameTxReplay.status, 403);
  assert.equal(sameTxReplay.body.code, 'SSO_BROWSER_BINDING_REQUIRED');

  const txReplay = await startMolyBrowserSso(agentA, { targetPath: '/khoa-hoc/toan-101' });
  const replay = await agentA
    .post('/api/sso/consume')
    .send({ code: 'course-code-501', state: txReplay.state });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.code, 'SSO_CODE_ALREADY_USED');

  // Legacy non-PKCE /launch fails closed
  const legacyLaunch = await request(ctx.app)
    .post('/api/sso/course/launch')
    .set('x-test-user-id', String(molyUser.id))
    .send({ courseId: 101 });
  assert.equal(legacyLaunch.status, 400);
  assert.equal(legacyLaunch.body.code, 'SSO_PKCE_REQUIRED');

  // 2) Before owning course 101, launching scoped course 101 is blocked on intent & authorize
  const verifier101 = generatePkceVerifier();
  const challenge101 = computePkceChallengeS256(verifier101);
  const blockedIntent = await request(ctx.app)
    .post('/api/sso/course/intent')
    .set('x-test-user-id', String(molyUser.id))
    .send({ courseId: 101 });
  assert.equal(blockedIntent.status, 403);
  assert.equal(blockedIntent.body.code, 'COURSE_OWNERSHIP_REQUIRED');

  const blockedAuth = await request(ctx.app)
    .post('/api/sso/course/authorize')
    .set('x-test-user-id', String(molyUser.id))
    .send({ state: 'course-state-blocked', codeChallenge: challenge101, codeChallengeMethod: 'S256', courseId: 101 });
  assert.equal(blockedAuth.status, 403);
  assert.equal(blockedAuth.body.code, 'COURSE_OWNERSHIP_REQUIRED');

  // 3) Grant course ownership on Moly (simulating purchase), then authorize PKCE Moly -> Course SSO
  await ctx.db.query(
    `INSERT INTO video_packages (id, name, description, status, price_vnd, duration_mode, duration_days, allowed_subjects)
     VALUES (101, 'Goi 101', 'Mo ta', 'active', 500000, 'lifetime', NULL, ARRAY['MATH'])`,
  );
  await ctx.db.query(
    `INSERT INTO video_package_courses (video_package_id, course_id) VALUES (101, 101)`,
  );
  const ent101 = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, expires_at, duration_mode)
     VALUES ($1, 101, 'grant-101', 'manual', 'active', ARRAY['MATH'], NOW(), NULL, 'lifetime') RETURNING id`,
    [molyUser.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 101)`,
    [ent101.id],
  );
  const intentRes = await request(ctx.app)
    .post('/api/sso/course/intent')
    .set('x-test-user-id', String(molyUser.id))
    .send({ courseId: 101 });
  assert.equal(intentRes.status, 200);
  assert.match(intentRes.body.data.destinationStartUrl, /\/sso\/start/);

  const okLaunch = await request(ctx.app)
    .post('/api/sso/course/authorize')
    .set('x-test-user-id', String(molyUser.id))
    .send({
      state: 'course-state-101',
      codeChallenge: challenge101,
      codeChallengeMethod: 'S256',
      courseId: 101,
    });
  assert.equal(okLaunch.status, 200);
  const launchUrl = new URL(okLaunch.body.data.launchUrl);
  assert.equal(launchUrl.pathname, '/sso/callback');
  assert.equal(launchUrl.search, '');
  const frag = new URLSearchParams(launchUrl.hash.slice(1));
  const rawCode = frag.get('code');
  const rawState = frag.get('state');
  assert.ok(rawCode && rawState === 'course-state-101');

  // Verify DB holds SHA-256 code_hash & PKCE challenge only, never raw code
  const codeRow = (await ctx.db.query(
    'SELECT code_hash, pkce_challenge, pkce_method FROM integration_sso_codes ORDER BY id DESC LIMIT 1',
  )).rows[0];
  assert.equal(codeRow.code_hash, crypto.createHash('sha256').update(rawCode).digest('hex'));
  assert.equal(codeRow.pkce_challenge, challenge101);
  assert.equal(codeRow.pkce_method, 'S256');

  // Inbound S2S HMAC check rejects outbound secret or bad signature
  const wrongSigned = signInboundCourseRequest(
    { code: rawCode, nonce: rawState, code_verifier: verifier101, consumer_system: 'csca-course' },
    { secret: OUTBOUND_CFG.hmacSecret },
  );
  const badHmacRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(wrongSigned.headers)
    .send(wrongSigned.rawBody);
  assert.equal(badHmacRes.status, 401);

  // Concurrent 5x S2S exchange replay: strictly 1 succeeds, 4 fail 409 SSO_CODE_ALREADY_USED
  const validSigned = signInboundCourseRequest({
    code: rawCode,
    nonce: rawState,
    code_verifier: verifier101,
    consumer_system: 'csca-course',
  });
  const exchangeResults = await Promise.all(
    Array.from({ length: 5 }, () =>
      request(ctx.app)
        .post('/api/integrations/v1/sso/exchange')
        .set(validSigned.headers)
        .send(validSigned.rawBody),
    ),
  );
  assert.equal(exchangeResults.filter((r) => r.status === 200).length, 1);
  const replayedResults = exchangeResults.filter((r) => r.status === 409);
  assert.equal(replayedResults.length, 4);
  assert.equal(replayedResults[0].body.code, 'SSO_CODE_ALREADY_USED');
});

test('Expired code, open redirect launch, and revocation at exchange time fail closed', async (t) => {
  const ctx = await setupDay4MolyEnv(t);
  const u = (await ctx.db.query(
    "INSERT INTO users (email, username, role, is_active) VALUES ('rev@example.com', 'rev_user', 'student', true) RETURNING *",
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status)
     VALUES (102, 'ly-102', 'ly-102', 'Ly CSCA', 'PHYSICS', 'basic', 'package', 'published')`,
  );
  await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
     VALUES ('moly', 'moly:off_102', 102, 'active')`,
  );
  await ctx.db.query(
    `INSERT INTO video_packages (id, name, description, status, price_vnd, duration_mode, duration_days, allowed_subjects)
     VALUES (102, 'Goi 102', 'Mo ta', 'active', 500000, 'lifetime', NULL, ARRAY['PHYSICS'])`,
  );
  await ctx.db.query(
    `INSERT INTO video_package_courses (video_package_id, course_id) VALUES (102, 102)`,
  );
  const ent102 = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, expires_at, duration_mode)
     VALUES ($1, 102, 'grant-102', 'manual', 'active', ARRAY['PHYSICS'], NOW(), NULL, 'lifetime') RETURNING id`,
    [u.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 102)`,
    [ent102.id],
  );

  // Open redirect rejected at HTTP authorize
  const vBad = generatePkceVerifier();
  const badRedirect = await request(ctx.app)
    .post('/api/sso/course/authorize')
    .set('x-test-user-id', String(u.id))
    .send({
      state: 'open-redir-state',
      codeChallenge: computePkceChallengeS256(vBad),
      codeChallengeMethod: 'S256',
      targetPath: '//evil.com',
    });
  assert.equal(badRedirect.status, 400);
  assert.equal(badRedirect.body.code, 'INVALID_SSO_TARGET_PATH');

  // Issue scoped PKCE code, then revoke entitlement before Course exchanges it -> 403 SSO_ENTITLEMENT_REVOKED
  const vRev = generatePkceVerifier();
  const issued = await ctx.ssoService.authorizeCourseSsoRequest({
    userId: u.id,
    courseId: 102,
    state: 'rev-state-102-valid',
    codeChallenge: computePkceChallengeS256(vRev),
    codeChallengeMethod: 'S256',
  });
  await ctx.db.query("UPDATE user_video_entitlements SET status = 'revoked', revoked_at = NOW() WHERE id = $1", [ent102.id]);
  const revExchange = signInboundCourseRequest({
    code: issued.code,
    nonce: issued.state,
    code_verifier: vRev,
    consumer_system: 'csca-course',
  });
  const revRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(revExchange.headers)
    .send(revExchange.rawBody);
  assert.equal(revRes.status, 403);
  assert.equal(revRes.body.code, 'SSO_ENTITLEMENT_REVOKED');

  // Re-activate entitlement, issue another code, advance clock beyond 90s -> 401 SSO_CODE_EXPIRED
  await ctx.db.query("UPDATE user_video_entitlements SET status = 'active', revoked_at = NULL WHERE id = $1", [ent102.id]);
  const vExp = generatePkceVerifier();
  const issuedExp = await ctx.ssoService.authorizeCourseSsoRequest({
    userId: u.id,
    courseId: 102,
    state: 'exp-state-102-valid',
    codeChallenge: computePkceChallengeS256(vExp),
    codeChallengeMethod: 'S256',
  });
  ctx.setNow(new Date('2026-11-15T10:02:30.000Z')); // +150s > 90s
  const expReq = signInboundCourseRequest({
    code: issuedExp.code,
    nonce: issuedExp.state,
    code_verifier: vExp,
    consumer_system: 'csca-course',
  });
  const expRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(expReq.headers)
    .send(expReq.rawBody);
  assert.equal(expRes.status, 401);
  assert.equal(expRes.body.code, 'SSO_CODE_EXPIRED');
});

test('Case 3: Unlinked email collision never auto-merges, verifies via password/session, resolves conflict, and blocks privileged accounts', async (t) => {
  const ctx = await setupDay4MolyEnv(t);
  const hash = await bcrypt.hash('MolyPass123!', 6);

  const student = (await ctx.db.query(
    `INSERT INTO users (email, username, password, role, is_active, is_verified)
     VALUES ('dual.learner@example.com', 'moly_dual', $1, 'student', true, true) RETURNING *`,
    [hash],
  )).rows[0];
  const admin = (await ctx.db.query(
    `INSERT INTO users (email, username, password, role, is_active, is_verified)
     VALUES ('moly.admin@example.com', 'moly_admin', $1, 'admin', true, true) RETURNING *`,
    [hash],
  )).rows[0];

  // Privileged role cannot launch Course SSO
  const adminLaunch = await request(ctx.app)
    .post('/api/sso/course/authorize')
    .set('x-test-user-id', String(admin.id))
    .set('x-test-user-role', 'admin')
    .send({
      state: 'admin-state-valid-001',
      codeChallenge: computePkceChallengeS256(generatePkceVerifier()),
      codeChallengeMethod: 'S256',
      targetPath: '/courses',
    });
  assert.equal(adminLaunch.status, 403);
  assert.equal(adminLaunch.body.code, 'PRIVILEGED_ROLE_SSO_BLOCKED');

  // Privileged email collision blocked on consume
  ctx.setSsoExchangeHandler(async ({ nonce }) => ({
    status: 200,
    body: {
      success: true,
      data: {
        source_system: 'csca-course',
        source_user_id: '9001',
        email: 'moly.admin@example.com',
        role: 'student',
        target_path: '/khoa-hoc',
        nonce,
      },
    },
  }));
  const privAgent = request.agent(ctx.app);
  const privTx = await startMolyBrowserSso(privAgent, { targetPath: '/khoa-hoc' });
  const privRes = await privAgent
    .post('/api/sso/consume')
    .send({ code: 'c-priv', state: privTx.state });
  assert.equal(privRes.status, 403);
  assert.equal(privRes.body.code, 'PRIVILEGED_ROLE_COLLISION');
  assert.equal((await ctx.db.query(
    "SELECT COUNT(*)::int AS count FROM integration_conflicts WHERE external_user_id='csca-course:9001'",
  )).rows[0].count, 1);

  // Student email collision returns LINK_REQUIRED without issuing JWT, and binds link cookie to initiator browser
  ctx.setSsoExchangeHandler(async ({ nonce }) => ({
    status: 200,
    body: {
      success: true,
      data: {
        source_system: 'csca-course',
        source_user_id: '601',
        email: 'dual.learner@example.com',
        email_verified: true,
        role: 'student',
        target_path: '/khoa-hoc',
        nonce,
      },
    },
  }));
  const agentA = request.agent(ctx.app);
  const colTx = await startMolyBrowserSso(agentA, { targetPath: '/khoa-hoc' });
  const colRes = await agentA
    .post('/api/sso/consume')
    .send({ code: 'c-col-1', state: colTx.state });
  assert.equal(colRes.status, 200);
  assert.equal(colRes.body.data.status, 'LINK_REQUIRED');
  assert.ok(colRes.body.data.linkToken);
  assert.equal(colRes.body.data.token, undefined);

  // Status endpoint allows initiating browser to resume Safe-Link after refresh
  const statusRes = await agentA.get('/api/sso/link/status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.data.status, 'LINK_REQUIRED');
  assert.equal(statusRes.body.data.email, 'dual.learner@example.com');
  assert.equal(statusRes.body.data.hasPassword, true);

  // Ownership projection shows 'Cần xác minh tài khoản' while conflict is open
  await ctx.db.query(
    `INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status)
     VALUES (103, 'hoa-103', 'hoa-103', 'Hoa CSCA', 'CHEMISTRY', 'basic', 'package', 'published')`,
  );
  const verifyEval = await ctx.ownership.evaluatePackageOwnership(student.id, { courseIds: [103] });
  assert.equal(verifyEval.status, 'verification_required');
  assert.equal(verifyEval.label, 'Cần xác minh tài khoản');
  assert.equal(verifyEval.canPurchase, false);

  // Wrong password fails
  const wrongConfirm = await agentA
    .post('/api/sso/link/confirm')
    .send({ linkToken: colRes.body.data.linkToken, password: 'WrongPassword!' });
  assert.equal(wrongConfirm.status, 401);

  // Correct password links, resolves conflict, issues JWT, and binds peer
  const okConfirm = await agentA
    .post('/api/sso/link/confirm')
    .send({ linkToken: colRes.body.data.linkToken, password: 'MolyPass123!' });
  assert.equal(okConfirm.status, 200);
  assert.equal(okConfirm.body.data.status, 'AUTHENTICATED');
  assert.equal(Number(okConfirm.body.data.user.id), Number(student.id));
  assert.ok(okConfirm.body.data.token.startsWith('moly-jwt-'));

  const conflictAfter = (await ctx.db.query(
    "SELECT status FROM integration_conflicts WHERE candidate_user_id = $1 AND conflict_type = 'IDENTITY_EMAIL_COLLISION'",
    [student.id],
  )).rows[0];
  assert.equal(conflictAfter.status, 'resolved');
  assert.equal(ctx.boundPeerIdentities[0].target_user_id, '601');

  // Reusing linkToken fails after link cookie is cleared & row completed
  const reuseConfirm = await agentA
    .post('/api/sso/link/confirm')
    .send({ linkToken: colRes.body.data.linkToken, password: 'MolyPass123!' });
  assert.equal(reuseConfirm.status, 403);
  assert.equal(reuseConfirm.body.code, 'SSO_BROWSER_BINDING_REQUIRED');
  const linkRow = (await ctx.db.query('SELECT completed_at FROM integration_sso_link_requests ORDER BY id DESC LIMIT 1')).rows[0];
  assert.ok(linkRow.completed_at);
});

test('Moly ownership projection exposes all 6 Day 4 UI states and videoAdminService SSO launch metadata', async (t) => {
  const ctx = await setupDay4MolyEnv(t);
  const learner = (await ctx.db.query(
    "INSERT INTO users (email, username, role, is_active) VALUES ('states@example.com', 'states_u', 'student', true) RETURNING *",
  )).rows[0];

  await ctx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status) VALUES
      (201, 'c-not-owned', 'c-not-owned', 'Not Owned', 'MATH', 'basic', 'package', 'published'),
      (202, 'c-owned', 'c-owned', 'Owned', 'MATH', 'basic', 'package', 'published'),
      (203, 'c-pending', 'c-pending', 'Pending Sync', 'PHYSICS', 'basic', 'package', 'published'),
      (204, 'c-expired', 'c-expired', 'Expired', 'CHEMISTRY', 'basic', 'package', 'published'),
      (205, 'c-blocked', 'c-blocked', 'Blocked', 'CHINESE_SCI', 'basic', 'package', 'published')
  `);
  await ctx.db.query(`
    INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status) VALUES
      ('moly', 'moly:off_201', 201, 'active'),
      ('moly', 'moly:off_202', 202, 'active'),
      ('moly', 'moly:off_203', 203, 'active'),
      ('moly', 'moly:off_204', 204, 'active'),
      ('moly', 'moly:off_205', 205, 'active')
  `);

  // 202 owned locally + pkg 11 configured
  await ctx.db.query(
    `INSERT INTO video_packages (id, name, description, price_vnd, duration_mode, duration_days, allowed_subjects, status, renewal_mode)
     VALUES (11, 'Goi Video Owned', 'Mo ta', 500000, 'lifetime', NULL, ARRAY['MATH'], 'active', 'new_period')`,
  );
  await ctx.db.query("INSERT INTO video_package_courses (video_package_id, course_id) VALUES (11, 202)");
  const ent202 = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, expires_at, duration_mode)
     VALUES ($1, 11, 'grant-202', 'manual', 'active', ARRAY['MATH'], '2026-01-01T00:00:00Z', NULL, 'lifetime') RETURNING id`,
    [learner.id],
  )).rows[0];
  await ctx.db.query("INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 202)", [ent202.id]);
  // 203 pending sync in outbox
  await ctx.db.query(
    `INSERT INTO integration_outbox (
       source_system, target_system, event_id, idempotency_key, correlation_id,
       event_type, aggregate_type, aggregate_id, payload, source_updated_at,
       user_id, external_course_id, metadata, status
     ) VALUES (
       'moly', 'csca-course', 'evt-203', 'idem-203', 'corr-203',
       'entitlement.granted', 'entitlement', 'e-203', '{}'::jsonb, NOW(),
       $1, 'moly:off_203', '{"local_course_id":203}'::jsonb, 'pending'
     )`,
    [learner.id],
  );
  // 204 expired external projection
  await ctx.db.query(
    `INSERT INTO external_entitlements (
       source_system, external_grant_id, external_user_id, external_course_id,
       user_id, local_course_id, status, valid_from, valid_until, source_updated_at
     ) VALUES (
       'csca-course', 'csca-course:g-204', 'csca-course:801', 'moly:off_204',
       $1, 204, 'active', '2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z', NOW()
     )`,
    [learner.id],
  );
  // 205 suspended/blocked external grant
  await ctx.db.query(
    `INSERT INTO external_entitlements (
       source_system, external_grant_id, external_user_id, external_course_id,
       user_id, local_course_id, status, effective_owned, valid_from, valid_until, source_updated_at
     ) VALUES (
       'csca-course', 'csca-course:g-205', 'csca-course:801', 'moly:off_205',
       $1, 205, 'suspended', FALSE, '2024-01-01T00:00:00Z', NULL, NOW()
     )`,
    [learner.id],
  );

  const states = await ctx.ownership.evaluateCoursesForUser(learner.id, [201, 202, 203, 204, 205], {
    currentNow: new Date('2026-11-15T10:00:00Z'),
  });

  assert.equal(states.get(201).status, 'not_owned');
  assert.equal(states.get(201).label, 'Mua khóa học');
  assert.equal(states.get(201).canLaunchCourse, false);

  assert.equal(states.get(202).status, 'owned');
  assert.equal(states.get(202).label, 'Đã sở hữu');
  assert.equal(states.get(202).canLaunchCourse, true);
  assert.equal(states.get(202).ssoTargetPath, '/video-courses/moly:off_202');

  assert.equal(states.get(203).status, 'pending_sync');
  assert.equal(states.get(203).label, 'Đang đồng bộ quyền');
  assert.equal(states.get(203).canLaunchCourse, false);

  assert.equal(states.get(204).status, 'expired');
  assert.equal(states.get(204).label, 'Quyền đã hết hạn');
  assert.equal(states.get(204).canPurchase, true);
  assert.equal(states.get(204).canLaunchCourse, false);

  assert.equal(states.get(205).status, 'grant_blocked');
  assert.equal(states.get(205).label, 'Đang tạm khóa quyền');
  assert.equal(states.get(205).canPurchase, false);

  // Also check videoAdminService catalog exposes canLaunchCourse & ssoTargetPath
  const repo = createVideoCommerceRepository(ctx.db);
  const adminSvc = createVideoAdminService({
    db: ctx.db,
    repository: repo,
    payments: { productSnapshot: async () => ({}) },
    courseOwnership: ctx.ownership,
    salesEnabled: () => true,
  });
  const catalogPage = await adminSvc.catalog('video', { page: 1 }, false, { userId: learner.id, refreshOwnership: false });
  const pkg = catalogPage.items.find((x) => Number(x.id) === 11);
  assert.equal(pkg.ownershipStatus, 'owned');
  assert.equal(pkg.ownershipLabel, 'Đã sở hữu');
  assert.equal(pkg.canLaunchCourse, true);
  assert.equal(pkg.ssoTargetPath, '/video-courses/moly:off_202');
});

test('P1 Security: 2-browser-context Login-CSRF & Safe-Link cookie isolation, passwordless candidate refresh, wrong PKCE verifier, tx replay/expiry', async (t) => {
  const ctx = await setupDay4MolyEnv(t);

  // Create victim B already logged in on Context B, and attacker-controlled external identity A on Context A
  const victimB = (await ctx.db.query(
    `INSERT INTO users (email, username, password, role, is_active, is_verified)
     VALUES ('victim.b@example.com', 'victim_b', NULL, 'student', true, true) RETURNING *`,
  )).rows[0];
  const passwordlessLocal = (await ctx.db.query(
    `INSERT INTO users (email, username, password, role, is_active, is_verified)
     VALUES ('pwless.local@example.com', 'pwless_local', NULL, 'student', true, true) RETURNING *`,
  )).rows[0];

  const exchangeCalls = [];
  ctx.setSsoExchangeHandler(async ({ code, nonce, code_verifier }) => {
    exchangeCalls.push({ code, nonce, code_verifier });
    return {
      status: 200,
      body: {
        success: true,
        data: {
          source_system: 'csca-course',
          source_user_id: code === 'code-pwless' ? '7702' : '7701',
          email: code === 'code-pwless' ? 'pwless.local@example.com' : 'attacker.a@example.com',
          email_verified: true,
          role: 'student',
          target_path: '/khoa-hoc',
          nonce,
        },
      },
    };
  });

  // 1) Context A initiates SSO -> gets stateA + HttpOnly moly_sso_tx cookie
  const contextA = request.agent(ctx.app);
  const startA = await startMolyBrowserSso(contextA, { targetPath: '/khoa-hoc' });

  // Context B (separate cookie jar, logged in as Victim B) tries to consume Attacker A's { code, stateA }
  const contextB = request.agent(ctx.app);
  const csrfNoCookie = await contextB
    .post('/api/sso/consume')
    .set('x-test-user-id', String(victimB.id))
    .send({ code: 'code-attacker', state: startA.state });
  assert.equal(csrfNoCookie.status, 403);
  assert.equal(csrfNoCookie.body.code, 'SSO_BROWSER_BINDING_REQUIRED');
  assert.equal(exchangeCalls.length, 0);

  // Even if Context B starts its own txB, injecting Context A's state fails with 403 SSO_BROWSER_STATE_MISMATCH
  const startB = await startMolyBrowserSso(contextB, { targetPath: '/khoa-hoc' });
  assert.notEqual(startB.state, startA.state);
  const csrfWrongState = await contextB
    .post('/api/sso/consume')
    .set('x-test-user-id', String(victimB.id))
    .send({ code: 'code-attacker', state: startA.state });
  assert.equal(csrfWrongState.status, 403);
  assert.equal(csrfWrongState.body.code, 'SSO_BROWSER_STATE_MISMATCH');
  assert.equal(exchangeCalls.length, 0);

  // Expired browser tx fails closed before contacting peer
  const contextExpired = request.agent(ctx.app);
  const startExp = await startMolyBrowserSso(contextExpired, { targetPath: '/khoa-hoc' });
  ctx.setNow(new Date('2026-11-15T10:04:00.000Z')); // +240s > 180s
  const expTxRes = await contextExpired
    .post('/api/sso/consume')
    .send({ code: 'code-exp', state: startExp.state });
  assert.equal(expTxRes.status, 401);
  assert.equal(expTxRes.body.code, 'SSO_BROWSER_TX_EXPIRED');
  assert.equal(exchangeCalls.length, 0);
  ctx.setNow(new Date('2026-11-15T10:00:00.000Z'));

  // 2) Safe-Linking on passwordless local user: Context A initiates -> LINK_REQUIRED
  const startLink = await startMolyBrowserSso(contextA, { targetPath: '/khoa-hoc' });
  const linkConsume = await contextA
    .post('/api/sso/consume')
    .send({ code: 'code-pwless', state: startLink.state });
  assert.equal(linkConsume.status, 200);
  assert.equal(linkConsume.body.data.status, 'LINK_REQUIRED');
  assert.equal(linkConsume.body.data.hasPassword, false);
  const leakedLinkToken = linkConsume.body.data.linkToken;
  assert.ok(leakedLinkToken);

  // Simulated browser refresh recovers status from HttpOnly moly_sso_link cookie cleanly
  const refreshStatus = await contextA.get('/api/sso/link/status');
  assert.equal(refreshStatus.status, 200);
  assert.equal(refreshStatus.body.data.status, 'LINK_REQUIRED');
  assert.equal(refreshStatus.body.data.email, 'pwless.local@example.com');
  assert.equal(refreshStatus.body.data.hasPassword, false);

  // Victim B in Context B cannot check status or steal leaked linkToken even with matching session/cookie injection attempt
  const contextBStatus = await contextB.get('/api/sso/link/status');
  assert.equal(contextBStatus.status, 404);
  assert.equal(contextBStatus.body.code, 'SSO_LINK_SESSION_NOT_FOUND');

  const victimStealConfirm = await contextB
    .post('/api/sso/link/confirm')
    .set('x-test-user-id', String(passwordlessLocal.id))
    .send({ linkToken: leakedLinkToken });
  assert.equal(victimStealConfirm.status, 403);
  assert.equal(victimStealConfirm.body.code, 'SSO_BROWSER_BINDING_REQUIRED');

  // Even if Context A confirms WITHOUT authenticating as passwordlessLocal (or as Victim B), it fails closed
  const mismatchUserConfirm = await contextA
    .post('/api/sso/link/confirm')
    .set('x-test-user-id', String(victimB.id))
    .set('x-test-user-email', 'victim.b@example.com')
    .send({ linkToken: leakedLinkToken });
  assert.equal(mismatchUserConfirm.status, 401);
  assert.equal(mismatchUserConfirm.body.code, 'SSO_LINK_VERIFICATION_REQUIRED');

  // Passwordless local user signs in in Context A and confirms Safe-Link without linkToken in body (cookie-bound refresh recovery!)
  const okPwlessConfirm = await contextA
    .post('/api/sso/link/confirm')
    .set('x-test-user-id', String(passwordlessLocal.id))
    .set('x-test-user-email', 'pwless.local@example.com')
    .send({});
  assert.equal(okPwlessConfirm.status, 200);
  assert.equal(okPwlessConfirm.body.data.status, 'AUTHENTICATED');
  assert.equal(Number(okPwlessConfirm.body.data.user.id), Number(passwordlessLocal.id));

  // 3) Outbound PKCE S256 verification: wrong code_verifier must fail closed
  await ctx.db.query(
    `INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status)
     VALUES (301, 'toan-301', 'toan-301', 'Toan 301', 'MATH', 'basic', 'package', 'published')`,
  );
  await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
     VALUES ('moly', 'moly:off_301', 301, 'active')`,
  );
  await ctx.db.query(
    `INSERT INTO video_packages (id, name, description, status, price_vnd, duration_mode, duration_days, allowed_subjects)
     VALUES (301, 'Goi 301', 'Mo ta', 'active', 300000, 'lifetime', NULL, ARRAY['MATH'])`,
  );
  await ctx.db.query(`INSERT INTO video_package_courses (video_package_id, course_id) VALUES (301, 301)`);
  const ent301 = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, expires_at, duration_mode)
     VALUES ($1, 301, 'grant-301', 'manual', 'active', ARRAY['MATH'], NOW(), NULL, 'lifetime') RETURNING id`,
    [passwordlessLocal.id],
  )).rows[0];
  await ctx.db.query(`INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 301)`, [ent301.id]);

  const goodVerifier = generatePkceVerifier();
  const wrongVerifier = generatePkceVerifier();
  const authRes = await request(ctx.app)
    .post('/api/sso/course/authorize')
    .set('x-test-user-id', String(passwordlessLocal.id))
    .send({
      state: 'pkce-verify-state',
      codeChallenge: computePkceChallengeS256(goodVerifier),
      codeChallengeMethod: 'S256',
      courseId: 301,
    });
  assert.equal(authRes.status, 200);
  const rawPkceCode = new URLSearchParams(new URL(authRes.body.data.launchUrl).hash.slice(1)).get('code');

  const wrongVerifierSigned = signInboundCourseRequest({
    code: rawPkceCode,
    nonce: 'pkce-verify-state',
    code_verifier: wrongVerifier,
    consumer_system: 'csca-course',
  });
  const badPkceRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(wrongVerifierSigned.headers)
    .send(wrongVerifierSigned.rawBody);
  assert.equal(badPkceRes.status, 403);
  assert.equal(badPkceRes.body.code, 'SSO_PKCE_MISMATCH');
});

test('P2 /hoc external-only courses surface verified mapped grants without creating course_enrollments or lesson_progress', async (t) => {
  const ctx = await setupDay4MolyEnv(t);
  const learner = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('hoc.ext@example.com', 'hoc_ext', 'student', true, true) RETURNING *`,
  )).rows[0];

  // Published mapped courses: 401 owned externally & verified, 402 revoked/unowned, 403 unmapped external grant
  await ctx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, subject_code, level, access_type, status) VALUES
      (401, 'toan-401', 'toan-401', 'Toan External Verified', 'MATH', 'basic', 'package', 'published'),
      (402, 'ly-402', 'ly-402', 'Ly Revoked External', 'PHYSICS', 'basic', 'package', 'published'),
      (403, 'hoa-403', 'hoa-403', 'Hoa Unmapped Local', 'CHEMISTRY', 'basic', 'package', 'published')
  `);
  await ctx.db.query(`
    INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status) VALUES
      ('moly', 'moly:off_401', 401, 'active'),
      ('moly', 'moly:off_402', 402, 'active')
  `);
  await ctx.db.query(
    `INSERT INTO external_entitlements (
       source_system, external_grant_id, external_user_id, external_course_id,
       user_id, local_course_id, status, effective_owned, valid_from, valid_until, revoked_at, source_updated_at
     ) VALUES
       ('csca-course', 'g-ext-401', 'csca-course:4010', 'moly:off_401', $1, 401, 'active', TRUE, '2026-01-01T00:00:00Z', NULL, NULL, NOW()),
       ('csca-course', 'g-ext-402', 'csca-course:4010', 'moly:off_402', $1, 402, 'revoked', FALSE, '2026-01-01T00:00:00Z', NULL, NOW(), NOW()),
       ('csca-course', 'g-ext-403', 'csca-course:4010', 'course:unmapped', $1, 403, 'active', TRUE, '2026-01-01T00:00:00Z', NULL, NULL, NOW())`,
    [learner.id],
  );

  // Add remaining columns/tables queried by learningRepository.listUserEnrollments in PGlite
  await ctx.pg.exec(`
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description TEXT;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_vnd INTEGER;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS compare_at_price_vnd INTEGER;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT FALSE;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating_avg NUMERIC DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrolled_count INTEGER DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_sections INTEGER DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_lessons INTEGER DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER DEFAULT 0;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      source VARCHAR(32) NOT NULL DEFAULT 'purchase',
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS course_sections (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_published BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS course_lessons (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      external_key TEXT,
      slug TEXT,
      title TEXT,
      summary TEXT,
      lesson_type VARCHAR(32) DEFAULT 'video',
      sort_order INTEGER DEFAULT 0,
      estimated_duration_seconds INTEGER DEFAULT 0,
      effective_duration_seconds INTEGER DEFAULT 0,
      is_free_preview BOOLEAN DEFAULT FALSE,
      is_required BOOLEAN DEFAULT TRUE,
      is_published BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      status VARCHAR(32) DEFAULT 'not_started',
      watched_seconds INTEGER DEFAULT 0,
      max_position_seconds INTEGER DEFAULT 0,
      last_position_seconds INTEGER DEFAULT 0,
      completion_pct NUMERIC DEFAULT 0,
      attempt_count INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, lesson_id)
    );
  `);

  const dbPath = require.resolve('../src/config/database');
  const runtimePath = require.resolve('../src/services/courseIntegrationRuntime');
  const reloadPaths = [
    require.resolve('../src/repositories/learningRepository'),
    require.resolve('../src/repositories/courseRepository'),
    require.resolve('../src/services/videoLearningAccess'),
    require.resolve('../src/services/courseAssignmentService'),
    require.resolve('../src/services/courseService'),
    require.resolve('../src/services/learningService'),
  ];
  const prevDbMod = require.cache[dbPath];
  const prevRuntimeMod = require.cache[runtimePath];
  const prevReloadMods = new Map(reloadPaths.map((p) => [p, require.cache[p]]));

  t.after(() => {
    if (prevDbMod) require.cache[dbPath] = prevDbMod; else delete require.cache[dbPath];
    if (prevRuntimeMod) require.cache[runtimePath] = prevRuntimeMod; else delete require.cache[runtimePath];
    for (const [p, mod] of prevReloadMods.entries()) {
      if (mod) require.cache[p] = mod; else delete require.cache[p];
    }
  });

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: (...args) => ctx.db.query(...args), pool: ctx.db.pool },
  };
  require.cache[runtimePath] = {
    id: runtimePath,
    filename: runtimePath,
    loaded: true,
    exports: { client: { isConfigured: () => false }, outbox: ctx.outbox, ownership: ctx.ownership },
  };
  for (const p of reloadPaths) delete require.cache[p];

  const learningService = require('../src/services/learningService');
  const enrollments = await learningService.listMyEnrollments({ id: learner.id, role: 'student' });

  // Only verified mapped active course 401 surfaces as external-only
  assert.equal(enrollments.length, 1);
  assert.equal(enrollments[0].course.id, 401);
  assert.equal(enrollments[0].enrollment.source, 'external');
  assert.equal(enrollments[0].enrollment.isExternalOnly, true);
  assert.equal(enrollments[0].enrollment.learningDestination, 'csca-course');
  assert.equal(enrollments[0].enrollment.progress, null);
  assert.equal(enrollments[0].course.isExternalOnly, true);
  assert.equal(enrollments[0].course.learningDestination, 'csca-course');
  assert.equal(enrollments[0].course.canLaunchCourse, true);
  assert.equal(enrollments[0].course.ssoTargetPath, '/video-courses/moly:off_401');

  // Verify zero local enrollment or progress rows were fabricated
  assert.equal((await ctx.db.query('SELECT COUNT(*)::int AS count FROM course_enrollments')).rows[0].count, 0);
  assert.equal((await ctx.db.query('SELECT COUNT(*)::int AS count FROM lesson_progress')).rows[0].count, 0);

  // Open identity conflict hides unverified external courses from /hoc
  await ctx.db.query(
    `INSERT INTO integration_conflicts (source_system, conflict_type, candidate_user_id, external_user_id, email_hint, reason, status)
     VALUES ('csca-course', 'IDENTITY_EMAIL_COLLISION', $1, 'csca-course:4010', 'hoc.ext@example.com', 'Pending verify', 'open')`,
    [learner.id],
  );
  const blockedEnrollments = await learningService.listMyEnrollments({ id: learner.id, role: 'student' });
  assert.equal(blockedEnrollments.length, 0);
});
