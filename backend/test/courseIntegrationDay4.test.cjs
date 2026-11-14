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
  resolveSsoTtlSeconds,
  validateSsoTargetPath,
} = require('../src/utils/ssoPathPolicy');

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

  // 1) Course-only user consumes Course -> Moly SSO code
  const used = new Set();
  ctx.setSsoExchangeHandler(async ({ code, nonce }) => {
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

  const consumeRes = await request(ctx.app)
    .post('/api/sso/consume')
    .send({ code: 'course-code-501', state: 'course-state-501' });
  assert.equal(consumeRes.status, 200);
  assert.equal(consumeRes.body.data.status, 'AUTHENTICATED');
  assert.equal(consumeRes.body.data.redirectPath, '/khoa-hoc/toan-101');
  assert.ok(consumeRes.body.data.token.startsWith('moly-jwt-'));

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

  // Sequential replay rejected with 409 SSO_CODE_ALREADY_USED
  const replay = await request(ctx.app)
    .post('/api/sso/consume')
    .send({ code: 'course-code-501', state: 'course-state-501' });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.code, 'SSO_CODE_ALREADY_USED');

  // 2) Before owning course 101, launching scoped course 101 is blocked
  const blockedLaunch = await request(ctx.app)
    .post('/api/sso/course/launch')
    .set('x-test-user-id', String(molyUser.id))
    .send({ courseId: 101 });
  assert.equal(blockedLaunch.status, 403);
  assert.equal(blockedLaunch.body.code, 'COURSE_OWNERSHIP_REQUIRED');

  // 3) Grant course ownership on Moly (simulating purchase), then launch Moly -> Course SSO
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
  const okLaunch = await request(ctx.app)
    .post('/api/sso/course/launch')
    .set('x-test-user-id', String(molyUser.id))
    .send({ courseId: 101 });
  assert.equal(okLaunch.status, 200);
  const launchUrl = new URL(okLaunch.body.data.launchUrl);
  assert.equal(launchUrl.pathname, '/sso/callback');
  assert.equal(launchUrl.search, '');
  const frag = new URLSearchParams(launchUrl.hash.slice(1));
  const rawCode = frag.get('code');
  const rawState = frag.get('state');
  assert.ok(rawCode && rawState);

  // Verify DB holds SHA-256 code_hash only, never raw code
  const codeRow = (await ctx.db.query('SELECT code_hash FROM integration_sso_codes ORDER BY id DESC LIMIT 1')).rows[0];
  assert.equal(codeRow.code_hash, crypto.createHash('sha256').update(rawCode).digest('hex'));

  // Inbound S2S HMAC check rejects outbound secret or bad signature
  const wrongSigned = signInboundCourseRequest({ code: rawCode, nonce: rawState, consumer_system: 'csca-course' }, { secret: OUTBOUND_CFG.hmacSecret });
  const badHmacRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(wrongSigned.headers)
    .send(wrongSigned.rawBody);
  assert.equal(badHmacRes.status, 401);

  // Concurrent 5x S2S exchange replay: strictly 1 succeeds, 4 fail 409 SSO_CODE_ALREADY_USED
  const validSigned = signInboundCourseRequest({ code: rawCode, nonce: rawState, consumer_system: 'csca-course' });
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

  // Open redirect rejected at HTTP launch
  const badRedirect = await request(ctx.app)
    .post('/api/sso/course/launch')
    .set('x-test-user-id', String(u.id))
    .send({ targetPath: '//evil.com' });
  assert.equal(badRedirect.status, 400);
  assert.equal(badRedirect.body.code, 'INVALID_SSO_TARGET_PATH');

  // Issue scoped code, then revoke entitlement before Course exchanges it -> 403 SSO_ENTITLEMENT_REVOKED
  const issued = await ctx.ssoService.issueCourseLaunch({ userId: u.id, courseId: 102 });
  await ctx.db.query("UPDATE user_video_entitlements SET status = 'revoked', revoked_at = NOW() WHERE id = $1", [ent102.id]);
  const revExchange = signInboundCourseRequest({ code: issued.code, nonce: issued.state, consumer_system: 'csca-course' });
  const revRes = await request(ctx.app)
    .post('/api/integrations/v1/sso/exchange')
    .set(revExchange.headers)
    .send(revExchange.rawBody);
  assert.equal(revRes.status, 403);
  assert.equal(revRes.body.code, 'SSO_ENTITLEMENT_REVOKED');

  // Re-activate entitlement, issue another code, advance clock beyond 90s -> 401 SSO_CODE_EXPIRED
  await ctx.db.query("UPDATE user_video_entitlements SET status = 'active', revoked_at = NULL WHERE id = $1", [ent102.id]);
  const issuedExp = await ctx.ssoService.issueCourseLaunch({ userId: u.id, courseId: 102 });
  ctx.setNow(new Date('2026-11-15T10:02:30.000Z')); // +150s > 90s
  const expReq = signInboundCourseRequest({ code: issuedExp.code, nonce: issuedExp.state, consumer_system: 'csca-course' });
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
    .post('/api/sso/course/launch')
    .set('x-test-user-id', String(admin.id))
    .set('x-test-user-role', 'admin')
    .send({ targetPath: '/courses' });
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
  const privRes = await request(ctx.app)
    .post('/api/sso/consume')
    .send({ code: 'c-priv', state: 's-priv' });
  assert.equal(privRes.status, 403);
  assert.equal(privRes.body.code, 'PRIVILEGED_ROLE_COLLISION');

  // Student email collision returns LINK_REQUIRED without issuing JWT
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
  const colRes = await request(ctx.app)
    .post('/api/sso/consume')
    .send({ code: 'c-col-1', state: 's-col-1' });
  assert.equal(colRes.status, 200);
  assert.equal(colRes.body.data.status, 'LINK_REQUIRED');
  assert.ok(colRes.body.data.linkToken);
  assert.equal(colRes.body.data.token, undefined);

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
  const wrongConfirm = await request(ctx.app)
    .post('/api/sso/link/confirm')
    .send({ linkToken: colRes.body.data.linkToken, password: 'WrongPassword!' });
  assert.equal(wrongConfirm.status, 401);

  // Correct password links, resolves conflict, issues JWT, and binds peer
  const okConfirm = await request(ctx.app)
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

  // Reusing linkToken fails
  const reuseConfirm = await request(ctx.app)
    .post('/api/sso/link/confirm')
    .send({ linkToken: colRes.body.data.linkToken, password: 'MolyPass123!' });
  assert.equal(reuseConfirm.status, 400);
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
