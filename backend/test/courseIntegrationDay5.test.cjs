const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');

const { applyMigration: applyVideoCommerceMigration } = require('../scripts/apply_video_commerce_migration');
const { applyMigration: applyCourseIntegrationMigration } = require('../scripts/apply_course_integration_migration');
const { createCourseIntegrationClient, buildMolySignature } = require('../src/services/courseIntegrationClient');
const { createCourseOutboxSyncService } = require('../src/services/courseOutboxSyncService');
const { createCourseOwnershipProjectionService } = require('../src/services/courseOwnershipProjectionService');
const { createCourseReconciliationService } = require('../src/services/courseReconciliationService');
const { createCourseIntegrationMappingService } = require('../src/services/courseIntegrationMappingService');
const { createCourseIntegrationAdminRoutes } = require('../src/routes/courseIntegrationAdminRoutes');
const {
  REDACTED,
  createIntegrationLogger,
  getIntegrationMetricsSnapshot,
  redactSensitiveData,
  resetIntegrationMetrics,
} = require('../src/utils/integrationLogger');

const OUTBOUND_CFG = {
  serviceToken: 'moly-day5-outbound-token-secret',
  integrationKey: 'moly-day5-key',
  hmacSecret: 'moly-day5-hmac-secret-value',
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
      role TEXT DEFAULT 'student',
      is_active BOOLEAN DEFAULT TRUE,
      is_verified BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE user_stats (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
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
      status TEXT DEFAULT 'paid',
      payment_method TEXT DEFAULT 'payos',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
    CREATE TABLE coupons (id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL);
    CREATE TABLE coupon_usages (id SERIAL PRIMARY KEY);
    CREATE TABLE coin_ledger (id SERIAL PRIMARY KEY);
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

async function setupDay5MolyEnv(t, { envOverrides = {} } = {}) {
  resetIntegrationMetrics();
  const pg = new PGlite();
  t.after(async () => {
    await pg.close();
  });
  await createBootstrappedSchema(pg);
  const db = wrapPgliteDb(pg);

  const envState = {
    COURSE_INTEGRATION_SYNC_DISABLED: 'false',
    COURSE_INTEGRATION_KILL_SWITCH: 'false',
    ...envOverrides,
  };

  let fakeNow = new Date('2026-11-15T12:00:00.000Z');
  const httpCalls = [];
  const remoteState = {
    identities: [],
    courseMappings: [],
    openConflicts: [],
    entitlements: [],
    inboxSummary: {},
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
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
      httpCalls.push({ url: req.url, body, headers: { ...req.headers } });

      if (req.url === '/api/integrations/v1/moly/reconciliation/snapshot') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          correlation_id: body.correlation_id,
          data: {
            checked_at: fakeNow.toISOString(),
            complete: remoteState.complete !== false,
            course_mappings: remoteState.courseMappings,
            identities: remoteState.identities,
            open_conflicts: remoteState.openConflicts,
            entitlements: remoteState.entitlements,
            inbox_summary: remoteState.inboxSummary,
          },
        }));
        return;
      }

      if (req.url === '/api/integrations/v1/users/provision') {
        const exists = body.external_user_id
          ? remoteState.identities.find((i) => i.external_user_id === body.external_user_id)
          : true;
        if (!exists && body.external_user_id) {
          remoteState.identities.push({
            id: remoteState.identities.length + 1,
            source_system: 'moly',
            external_user_id: body.external_user_id,
            user_id: 9000 + remoteState.identities.length + 1,
            status: 'active',
          });
        }
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { inbox_id: httpCalls.length, status: 'pending' },
        }));
        return;
      }

      if (req.url === '/api/integrations/v1/entitlements/grant') {
        const idx = remoteState.entitlements.findIndex((e) => e.external_grant_id === body.external_grant_id);
        const updated = {
          source: 'external_entitlements',
          external_user_id: body.external_user_id,
          external_course_id: body.external_course_id,
          external_grant_id: body.external_grant_id,
          local_course_id: body.metadata?.local_course_id ?? 101,
          status: 'active',
          effective_active: true,
          identity_status: 'active',
        };
        if (idx >= 0) remoteState.entitlements[idx] = updated;
        else remoteState.entitlements.push(updated);
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { inbox_id: httpCalls.length, status: 'pending' },
        }));
        return;
      }

      if (req.url === '/api/integrations/v1/entitlements/revoke') {
        const idx = remoteState.entitlements.findIndex((e) => e.external_grant_id === body.external_grant_id);
        if (idx >= 0) {
          remoteState.entitlements[idx] = {
            ...remoteState.entitlements[idx],
            status: 'revoked',
            effective_active: false,
          };
        }
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { inbox_id: httpCalls.length, status: 'pending' },
        }));
        return;
      }

      if (req.url === '/api/integrations/v1/moly/events/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: [
            {
              id: 99,
              event_id: body.event_id,
              idempotency_key: body.idempotency_key || null,
              status: 'processed',
              response_status: 200,
              processed_at: fakeNow.toISOString(),
            },
          ],
        }));
        return;
      }

      if (req.url === '/api/integrations/v1/ownership/query') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { items: [] },
        }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: false, errorCode: 'NOT_FOUND' }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));
  const peerBaseUrl = `http://127.0.0.1:${server.address().port}`;

  const logEntries = [];
  const sinkLogger = createIntegrationLogger({
    component: 'day5-test',
    env: envState,
    sink: (entry) => logEntries.push(entry),
  });

  const client = createCourseIntegrationClient({
    config: {
      baseUrl: peerBaseUrl,
      serviceToken: OUTBOUND_CFG.serviceToken,
      integrationKey: OUTBOUND_CFG.integrationKey,
      hmacSecret: OUTBOUND_CFG.hmacSecret,
      maxTransportAttempts: 1,
    },
    env: envState,
    now: () => fakeNow.getTime(),
    logger: sinkLogger,
  });

  const outbox = createCourseOutboxSyncService({
    db,
    client,
    now: () => fakeNow,
    env: envState,
    logger: sinkLogger,
  });
  const ownership = createCourseOwnershipProjectionService({
    db,
    client,
    outbox,
    now: () => fakeNow,
    env: envState,
    logger: sinkLogger,
  });
  const reconciliation = createCourseReconciliationService({
    db,
    client,
    outbox,
    now: () => fakeNow,
    staleThresholdMinutes: 10,
    env: envState,
    logger: sinkLogger,
  });
  const mappingService = createCourseIntegrationMappingService(db);

  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin/course-integrations',
    createCourseIntegrationAdminRoutes({
      service: mappingService,
      outbox,
      ownership,
      reconciliation,
      db,
      authenticate: (req, _res, next) => {
        req.user = { id: 1, role: 'admin' };
        next();
      },
      authorizeAnyPermission: () => (_req, _res, next) => next(),
    }),
  );

  return {
    pg,
    db,
    app,
    client,
    outbox,
    ownership,
    reconciliation,
    mappingService,
    envState,
    httpCalls,
    remoteState,
    logEntries,
    setNow: (d) => { fakeNow = d; },
  };
}

async function seedCourseAndPackage(db, { courseId, title, slug, packageId, offeringId = null }) {
  await db.query(
    `INSERT INTO courses (id, external_key, slug, title, subject_code, status)
     VALUES ($1, $2, $3, $4, 'MATH', 'published')
     ON CONFLICT (id) DO NOTHING`,
    [courseId, slug, slug, title],
  );
  await db.query(
    `INSERT INTO video_packages (id, name, description, status, price_vnd, duration_mode, duration_days, allowed_subjects)
     VALUES ($1, $2, 'Test pkg', 'active', 500000, 'lifetime', NULL, ARRAY['MATH'])
     ON CONFLICT (id) DO NOTHING`,
    [packageId, `Pkg ${title}`],
  );
  await db.query(
    `INSERT INTO video_package_courses (video_package_id, course_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [packageId, courseId],
  );
  if (offeringId) {
    await db.query(
      `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
       VALUES ('moly', $1, $2, 'active')`,
      [offeringId, courseId],
    );
  }
}

test('Codex: content managers cannot resolve identity conflicts', async () => {
  let called = false;
  const app = express();
  app.use(express.json());
  app.use(createCourseIntegrationAdminRoutes({
    service: {},
    authenticate: (_req, _res, next) => next(),
    authorizeAnyPermission: (...permissions) => (_req, res, next) =>
      permissions.includes('content.manage') ? next() : res.sendStatus(403),
    reconciliation: { resolveIntegrationConflict: async () => { called = true; } },
  }));
  assert.equal((await request(app).post('/conflicts/1/resolve').send({ action: 'link_existing', targetUserId: 2 })).status, 403);
  assert.equal(called, false);
});

test('Codex: reconciliation stays inside requested scope and rejects incomplete snapshots', async (t) => {
  const ctx = await setupDay5MolyEnv(t);
  await seedCourseAndPackage(ctx.db, {
    courseId: 101, title: 'Scope', slug: 'scope', packageId: 101, offeringId: 'moly:course:101',
  });
  ctx.remoteState.courseMappings.push({ source_system: 'moly', external_course_id: 'moly:course:101', status: 'active' });
  const users = (await ctx.db.query("INSERT INTO users (email) VALUES ('scope1@example.com'), ('scope2@example.com') RETURNING id")).rows;
  for (const user of users) {
    const ent = (await ctx.db.query(
      "INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode) VALUES ($1, 101, $2, 'manual', 'active', ARRAY['MATH'], NOW(), 'lifetime') RETURNING id",
      [user.id, `scope-${user.id}`],
    )).rows[0];
    await ctx.db.query('INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 101)', [ent.id]);
  }
  const scoped = await ctx.reconciliation.runReconciliation({ scopeFilter: { externalUserId: `moly:${users[0].id}` } });
  const planned = scoped.actions.filter(a => a.actionTaken === 'planned_enqueue_grant');
  assert.equal(planned.length, 1);
  assert.equal(planned[0].externalUserId, `moly:${users[0].id}`);
  const otherCourse = await ctx.reconciliation.runReconciliation({ scopeFilter: { externalCourseId: 'moly:other' } });
  assert.equal(otherCourse.actions.filter(a => a.actionTaken === 'planned_enqueue_grant').length, 0);
  ctx.remoteState.courseMappings.length = 0;
  const unmapped = await ctx.reconciliation.runReconciliation({ dryRun: false, dispatchRepairs: false });
  assert.equal(unmapped.repairedOutboxIds.length, 0);
  ctx.remoteState.complete = false;
  await assert.rejects(ctx.reconciliation.runReconciliation({ dryRun: false }),
    error => error.code === 'RECONCILIATION_SNAPSHOT_INCOMPLETE' || error.errorCode === 'RECONCILIATION_SNAPSHOT_INCOMPLETE');
  assert.equal((await ctx.db.query('SELECT COUNT(*)::int AS count FROM integration_outbox')).rows[0].count, 0);
});

test('Day 5: Reconcile repairs missing grant & revoked entitlement, preserves conflicts, flags unknown & unmapped, and is idempotent on rerun', async (t) => {
  const ctx = await setupDay5MolyEnv(t);

  const uMissing = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('recon.missing@example.com', 'recon_missing', 'student', true, true) RETURNING *`,
  )).rows[0];
  const uRevoked = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('recon.revoked@example.com', 'recon_revoked', 'student', true, true) RETURNING *`,
  )).rows[0];
  const uConflict = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('recon.conflict@example.com', 'recon_conflict', 'student', true, true) RETURNING *`,
  )).rows[0];
  const uUnmapped = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('recon.unmapped@example.com', 'recon_unmapped', 'student', true, true) RETURNING *`,
  )).rows[0];

  await seedCourseAndPackage(ctx.db, {
    courseId: 101,
    title: 'Toan Co Ban',
    slug: 'toan-co-ban',
    packageId: 101,
    offeringId: 'moly:course:101',
  });
  // Unmapped published course 102
  await seedCourseAndPackage(ctx.db, {
    courseId: 102,
    title: 'Ly Chua Map',
    slug: 'ly-chua-map',
    packageId: 102,
    offeringId: null,
  });

  // 1) Local active entitlement missing on remote (no prior outbox event)
  const entMissing = (await ctx.db.query(
    `INSERT INTO user_video_entitlements
       (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode)
     VALUES ($1, 101, 'recon-gk-1', 'manual', 'active', ARRAY['MATH'], NOW(), 'lifetime')
     RETURNING id`,
    [uMissing.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 101)`,
    [entMissing.id],
  );

  // 2) Local revoked entitlement yet still active on remote
  const entRevoked = (await ctx.db.query(
    `INSERT INTO user_video_entitlements
       (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, revoked_at, reason, duration_mode)
     VALUES ($1, 101, 'recon-gk-2', 'manual', 'revoked', ARRAY['MATH'], NOW(), NOW(), 'refunded', 'lifetime')
     RETURNING id`,
    [uRevoked.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 101)`,
    [entRevoked.id],
  );
  ctx.remoteState.identities.push(
    { id: 1, source_system: 'moly', external_user_id: `moly:${uRevoked.id}`, user_id: 5002, status: 'active' },
    { id: 2, source_system: 'moly', external_user_id: `moly:${uConflict.id}`, user_id: 5003, status: 'active' },
  );
  ctx.remoteState.courseMappings.push(
    { source_system: 'moly', external_course_id: 'moly:course:101', local_course_id: 2001, status: 'active' },
  );
  ctx.remoteState.entitlements.push(
    // Active on Course even though Moly revoked it:
    {
      source: 'external_entitlements',
      external_user_id: `moly:${uRevoked.id}`,
      external_course_id: 'moly:course:101',
      external_grant_id: `moly:grant:ent_${entRevoked.id}:course_101`,
      local_course_id: 2001,
      status: 'active',
      effective_active: true,
      identity_status: 'active',
    },
    // Unknown active grant on Course not present anywhere on Moly:
    {
      source: 'external_entitlements',
      external_user_id: 'moly:999999',
      external_course_id: 'moly:course:101',
      external_grant_id: 'moly:grant:ghost_999:course_101',
      local_course_id: 2001,
      status: 'active',
      effective_active: true,
      identity_status: 'active',
    },
  );

  // 3) Conflicted user also has a missing grant: MUST NOT be auto-repaired or merged!
  const entConflict = (await ctx.db.query(
    `INSERT INTO user_video_entitlements
       (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode)
     VALUES ($1, 101, 'recon-gk-3', 'manual', 'active', ARRAY['MATH'], NOW(), 'lifetime')
     RETURNING id`,
    [uConflict.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 101)`,
    [entConflict.id],
  );
  const localConflict = (await ctx.db.query(
    `INSERT INTO integration_conflicts
       (source_system, conflict_type, status, external_user_id, candidate_user_id, email_hint, reason, correlation_id)
     VALUES ('csca-course', 'IDENTITY_EMAIL_COLLISION', 'open', $1, $2, 'recon.conflict@example.com', 'Needs manual confirm', 'corr-conflict-1')
     RETURNING id`,
    [`moly:${uConflict.id}`, uConflict.id],
  )).rows[0];

  // 4) Unmapped active entitlement (course 102)
  const entUnmapped = (await ctx.db.query(
    `INSERT INTO user_video_entitlements
       (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode)
     VALUES ($1, 102, 'recon-gk-4', 'manual', 'active', ARRAY['MATH'], NOW(), 'lifetime')
     RETURNING id`,
    [uUnmapped.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, 102)`,
    [entUnmapped.id],
  );

  // 5) Stale pending event (> 10 mins) and dead-letter event in outbox
  await ctx.db.query(
    `INSERT INTO integration_outbox
       (source_system, target_system, event_id, idempotency_key, correlation_id, event_type, aggregate_type, aggregate_id, payload, source_updated_at, status, created_at)
     VALUES
       ('moly', 'csca-course', 'evt-stale-1', 'idem-stale-1', 'corr-stale-1', 'user.provisioned', 'user', 'moly:stale', '{"event_id":"evt-stale-1","external_user_id":"moly:stale","source_system":"moly"}'::jsonb, NOW(), 'pending', '2026-11-15T11:30:00.000Z'),
       ('moly', 'csca-course', 'evt-dlq-1', 'idem-dlq-1', 'corr-dlq-1', 'user.provisioned', 'user', 'moly:dlq', '{}'::jsonb, NOW(), 'dead_letter', NOW())`,
  );

  // Step A: Dry-Run detects all categories with ZERO outbox mutations
  const dryRes = await ctx.reconciliation.runReconciliation({ dryRun: true, triggerMode: 'manual' });
  assert.equal(dryRes.summary.local_active_remote_missing, 2); // uMissing + uConflict
  assert.equal(dryRes.summary.local_revoked_remote_active, 1);
  assert.equal(dryRes.summary.remote_active_unknown_on_moly, 1);
  assert.equal(dryRes.summary.missing_course_mapping, 1);
  assert.equal(dryRes.summary.identity_missing_or_conflict, 1);
  assert.equal(dryRes.summary.stale_pending_event, 1);
  assert.equal(dryRes.summary.dead_letter_event, 1);
  assert.equal(dryRes.repairedOutboxIds.length, 0);
  const outboxCountBefore = (await ctx.db.query('SELECT COUNT(*)::int AS c FROM integration_outbox')).rows[0].c;
  assert.equal(outboxCountBefore, 2);

  // Step B: Auto-repair fixes ONLY unambiguous grant + revoke (and leaves conflicted user, unknown remote, and unmapped untouched!)
  const repairRes = await ctx.reconciliation.runReconciliation({
    dryRun: false,
    triggerMode: 'manual',
    dispatchRepairs: true,
    correlationId: 'corr-day5-repair-1',
  });
  assert.equal(repairRes.summary.repaired_grant, 1);
  assert.equal(repairRes.summary.repaired_revoke, 1);
  assert.ok(repairRes.repairedOutboxIds.length >= 2);

  // Confirm uMissing now granted on remote, uRevoked now revoked on remote, ghost untouched!
  const remoteMissingGrant = ctx.remoteState.entitlements.find(
    (e) => e.external_grant_id === `moly:grant:ent_${entMissing.id}:course_101`,
  );
  assert.equal(remoteMissingGrant?.effective_active, true);
  const remoteRevokedGrant = ctx.remoteState.entitlements.find(
    (e) => e.external_grant_id === `moly:grant:ent_${entRevoked.id}:course_101`,
  );
  assert.equal(remoteRevokedGrant?.effective_active, false);
  const remoteGhost = ctx.remoteState.entitlements.find(
    (e) => e.external_grant_id === 'moly:grant:ghost_999:course_101',
  );
  assert.equal(remoteGhost?.effective_active, true);

  // Conflicted user must NEVER receive an outbox grant or auto-linked identity!
  const conflictOutboxes = (await ctx.db.query(
    'SELECT * FROM integration_outbox WHERE user_id = $1',
    [uConflict.id],
  )).rows;
  assert.equal(conflictOutboxes.length, 0);
  const conflictStillOpen = (await ctx.db.query(
    'SELECT status FROM integration_conflicts WHERE id = $1',
    [localConflict.id],
  )).rows[0];
  assert.equal(conflictStillOpen.status, 'open');

  // Step C: Idempotent rerun produces ZERO new outbox events and zero grant/revoke drift!
  const outboxCountAfterRepair = (await ctx.db.query('SELECT COUNT(*)::int AS c FROM integration_outbox')).rows[0].c;
  const rerunRes = await ctx.reconciliation.runReconciliation({
    dryRun: false,
    triggerMode: 'scheduled',
    dispatchRepairs: true,
  });
  assert.equal(rerunRes.summary.repaired_grant, 0);
  assert.equal(rerunRes.summary.repaired_revoke, 0);
  assert.equal(rerunRes.summary.local_revoked_remote_active, 0);
  assert.equal(rerunRes.summary.local_active_remote_missing, 1); // only uConflict remains skipped due to open conflict
  assert.equal(rerunRes.repairedOutboxIds.length, 0);
  const outboxCountAfterRerun = (await ctx.db.query('SELECT COUNT(*)::int AS c FROM integration_outbox')).rows[0].c;
  assert.equal(outboxCountAfterRerun, outboxCountAfterRepair);

  // Verify audit trail tables captured all runs + actions
  const runs = await ctx.reconciliation.listReconciliationRuns({ limit: 10 });
  assert.equal(runs.length, 3);
  assert.ok(runs.every((r) => r.status === 'completed' && Array.isArray(r.actions)));
});

test('Day 5: Manual dead-letter retry, open conflict retry block, Admin Ops API, Kill Switch, and redacted logging', async (t) => {
  const ctx = await setupDay5MolyEnv(t);
  const u = (await ctx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('ops.learner@example.com', 'ops_learner', 'student', true, true) RETURNING *`,
  )).rows[0];

  const dlqRow = (await ctx.db.query(
    `INSERT INTO integration_outbox
       (source_system, target_system, event_id, idempotency_key, correlation_id,
        event_type, aggregate_type, aggregate_id, payload, source_updated_at,
        status, attempt_count, max_attempts, last_error_code, last_error_message, user_id)
     VALUES
       ('moly', 'csca-course', 'evt-dlq-ops-1', 'idem-dlq-ops-1', 'corr-dlq-ops-1',
        'user.provisioned', 'user', $1, $2::jsonb, NOW(),
        'dead_letter', 8, 8, 'COURSE_LMS_TIMEOUT', 'Gateway timeout', $3)
     RETURNING id`,
    [
      `moly:${u.id}`,
      JSON.stringify({
        event_id: 'evt-dlq-ops-1',
        idempotency_key: 'idem-dlq-ops-1',
        correlation_id: 'corr-dlq-ops-1',
        source_system: 'moly',
        external_user_id: `moly:${u.id}`,
        email: u.email,
        source_updated_at: '2026-11-15T12:00:00.000Z',
      }),
      u.id,
    ],
  )).rows[0];

  // Insert open conflict for user u -> retry MUST fail with 409 OPEN_IDENTITY_CONFLICT
  const conflict = (await ctx.db.query(
    `INSERT INTO integration_conflicts
       (source_system, conflict_type, status, external_user_id, candidate_user_id, email_hint, reason, correlation_id)
     VALUES ('csca-course', 'IDENTITY_EMAIL_COLLISION', 'open', $1, $2, 'ops.learner@example.com', 'Manual verify required', 'corr-dlq-ops-1')
     RETURNING id`,
    [`moly:${u.id}`, u.id],
  )).rows[0];

  const blockedRetry = await request(ctx.app)
    .post(`/api/admin/course-integrations/outbox/${dlqRow.id}/retry`)
    .send({ dispatchNow: true });
  assert.equal(blockedRetry.status, 409);
  assert.equal(blockedRetry.body.code, 'OPEN_IDENTITY_CONFLICT');

  // Resolve conflict via Admin API, then manually retry dead-letter item
  const resolveRes = await request(ctx.app)
    .post(`/api/admin/course-integrations/conflicts/${conflict.id}/resolve`)
    .send({ action: 'link_existing', targetUserId: u.id, resolutionNote: 'Verified identity' });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.data.status, 'resolved');

  const otherUser = (await ctx.db.query("INSERT INTO users (email) VALUES ('other-link@example.com') RETURNING id")).rows[0];
  const reassignment = await request(ctx.app)
    .post(`/api/admin/course-integrations/conflicts/${conflict.id}/resolve`)
    .send({ action: 'link_existing', targetUserId: otherUser.id });
  assert.equal(reassignment.status, 409);
  assert.equal(reassignment.body.code, 'IDENTITY_ALREADY_LINKED');
  assert.equal(Number((await ctx.db.query('SELECT user_id FROM external_identities WHERE external_user_id = $1', [`moly:${u.id}`])).rows[0].user_id), Number(u.id));

  const retryRes = await request(ctx.app)
    .post(`/api/admin/course-integrations/outbox/${dlqRow.id}/retry`)
    .send({ dispatchNow: true });
  assert.equal(retryRes.status, 200);
  assert.equal(retryRes.body.data.retried, true);
  assert.equal(retryRes.body.data.batch.dispatched.length, 1);
  assert.equal(retryRes.body.data.batch.dispatched[0].outcome, 'sent');

  // Check Ops overview + metrics APIs
  const overviewRes = await request(ctx.app).get('/api/admin/course-integrations/ops/overview');
  assert.equal(overviewRes.status, 200);
  assert.equal(overviewRes.body.data.killSwitchActive, false);
  assert.ok(overviewRes.body.data.metrics.counters['moly.client.http_ok'] >= 1);

  // Activate emergency kill switch -> outbox worker, client, ownership sync, retry, and reconcile stop immediately!
  const callsBeforeKill = ctx.httpCalls.length;
  ctx.envState.COURSE_INTEGRATION_SYNC_DISABLED = 'true';

  assert.equal(await ctx.outbox.dispatchNextOutboxJob(), null);
  const batchHalted = await ctx.outbox.processAvailableOutboxJobs();
  assert.equal(batchHalted.haltedByKillSwitch, true);
  assert.equal(batchHalted.dispatched.length, 0);

  const ownHalted = await ctx.ownership.syncUserOwnershipFromCourse(u.id);
  assert.equal(ownHalted.synced, false);
  assert.equal(ownHalted.reason, 'INTEGRATION_KILL_SWITCH_ACTIVE');
  await assert.rejects(
    () => ctx.outbox.retryOutboxItem({ outboxId: dlqRow.id }),
    (err) => err.status === 503 && err.code === 'INTEGRATION_KILL_SWITCH_ACTIVE',
  );
  await assert.rejects(
    () => ctx.client.provisionUser({
      event_id: 'x', idempotency_key: 'k', correlation_id: 'c', external_user_id: 'moly:1', source_updated_at: '2026-11-15T12:00:00Z',
    }),
    (err) => err.status === 503 && err.code === 'INTEGRATION_KILL_SWITCH_ACTIVE',
  );
  const killReconHttp = await request(ctx.app)
    .post('/api/admin/course-integrations/reconcile')
    .send({ dryRun: false });
  assert.equal(killReconHttp.status, 503);
  assert.equal(killReconHttp.body.code, 'INTEGRATION_KILL_SWITCH_ACTIVE');
  assert.equal(ctx.httpCalls.length, callsBeforeKill); // Zero HTTP calls made under kill switch!

  // Deactivate kill switch on envState
  ctx.envState.COURSE_INTEGRATION_SYNC_DISABLED = 'false';

  // Strict Redaction & Correlation ID check
  const leaked = redactSensitiveData({
    serviceToken: OUTBOUND_CFG.serviceToken,
    hmacSecret: OUTBOUND_CFG.hmacSecret,
    authorization: 'Bearer super-secret-jwt-999',
    codeVerifier: 'pkce-verifier-top-secret-xyz',
    linkToken: 'link-token-secret-abc',
    txToken: 'tx-token-secret-def',
    signature: 'sha256=abcdef1234567890abcdef1234567890',
    payment_payload: { amount: 500000, webhook_signature: 'sig' },
    redirectUrl: 'https://moly.test/sso/cb?code=secretcode&code_verifier=ver123&token=jwt123&ok=1',
    correlation_id: 'corr-safe-check',
  });
  const serialized = JSON.stringify(leaked);
  assert.equal(leaked.serviceToken, REDACTED);
  assert.equal(leaked.hmacSecret, REDACTED);
  assert.equal(leaked.authorization, REDACTED);
  assert.equal(leaked.codeVerifier, REDACTED);
  assert.equal(leaked.linkToken, REDACTED);
  assert.equal(leaked.txToken, REDACTED);
  assert.equal(leaked.signature, REDACTED);
  assert.equal(leaked.payment_payload, REDACTED);
  assert.ok(!serialized.includes(OUTBOUND_CFG.serviceToken));
  assert.ok(!serialized.includes(OUTBOUND_CFG.hmacSecret));
  assert.ok(!serialized.includes('pkce-verifier-top-secret-xyz'));
  assert.ok(!serialized.includes('link-token-secret-abc'));
  assert.ok(!serialized.includes('secretcode'));
  assert.ok(!serialized.includes('ver123'));
  assert.ok(!serialized.includes('jwt123'));

  // All emitted logs preserve correlation_id and never contain outbound secrets or bearer tokens
  const allLogsJson = JSON.stringify(ctx.logEntries);
  assert.ok(ctx.logEntries.length >= 3);
  assert.ok(ctx.logEntries.every((e) => typeof e.correlation_id === 'string' && e.correlation_id.length > 0));
  assert.ok(!allLogsJson.includes(OUTBOUND_CFG.serviceToken));
  assert.ok(!allLogsJson.includes(OUTBOUND_CFG.hmacSecret));
  const metricsSnap = getIntegrationMetricsSnapshot();
  assert.ok(typeof metricsSnap.counters['moly.reconciliation.blocked_kill_switch'] === 'number');
});
