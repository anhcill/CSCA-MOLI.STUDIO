const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');

const { applyMigration: applyVideoCommerceMigration } = require('../scripts/apply_video_commerce_migration');
const { applyMigration: applyCourseIntegrationMigration } = require('../scripts/apply_course_integration_migration');
const { createCourseIntegrationMappingService } = require('../src/services/courseIntegrationMappingService');
const {
  CourseIntegrationClientError,
  buildMolySignature,
  createCourseIntegrationClient,
} = require('../src/services/courseIntegrationClient');
const { createCourseOutboxSyncService } = require('../src/services/courseOutboxSyncService');
const { createCourseOwnershipProjectionService } = require('../src/services/courseOwnershipProjectionService');
const { createVideoCommerceRepository } = require('../src/repositories/videoCommerceRepository');
const { createVideoPaymentService } = require('../src/services/videoPaymentService');
const { createVideoAdminService } = require('../src/services/videoAdminService');
const { createVideoCouponAdminService } = require('../src/services/videoCouponAdminService');
const { createVideoShopRoutes } = require('../src/routes/videoShopRoutes');
const { createVideoPaymentRoutes } = require('../src/routes/videoPaymentRoutes');
const { createCourseIntegrationAdminRoutes } = require('../src/routes/courseIntegrationAdminRoutes');
const { parseFeatureFlag } = require('../src/utils/courseFeatureConfig');

const SERVICE_TOKEN = 'test-course-service-token-secret';
const INTEGRATION_KEY = 'moly-studio-test-key';
const HMAC_SECRET = 'test-course-hmac-secret-value';

const readMigration = (name) =>
  fs.readFileSync(path.join(__dirname, '../../database/migrations', name), 'utf8');

function pgliteMigrationClient(pg) {
  return {
    query: async (sql, values) => (values ? pg.query(sql, values) : (await pg.exec(sql)).at(-1)),
  };
}

function wrapPgliteDb(pg) {
  let txChain = Promise.resolve();
  const db = {
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
  return db;
}

async function createBootstrappedSchema(pg, { includeVideoCommerce = true } = {}) {
  await pg.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'student',
      is_active BOOLEAN DEFAULT TRUE,
      is_verified BOOLEAN DEFAULT TRUE,
      is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',
      vip_tier TEXT,
      vip_status TEXT DEFAULT 'inactive',
      vip_started_at TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      vip_allowed_subjects TEXT[] DEFAULT ARRAY[]::TEXT[],
      coin_balance INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

  if (includeVideoCommerce) {
    const adapter = {
      query: async (sql, values) => (values ? pg.query(sql, values) : (await pg.exec(sql)).at(-1)),
    };
    await applyVideoCommerceMigration(adapter);
    await pg.exec(readMigration('068_video_commerce_payments.sql'));
    await pg.exec(readMigration('069_video_commerce_admin.sql'));
  }

  await applyCourseIntegrationMigration(pgliteMigrationClient(pg));
}

async function startMockCourseServer() {
  const requests = [];
  const inbox = new Map();
  let inboxSeq = 1;
  let routeBehavior = {
    provision: [],
    grant: [],
    revoke: [],
    ownership: null,
  };

  function verifyRequestSignature(req, rawBuf) {
    const auth = req.headers.authorization;
    const key = req.headers['x-integration-key'];
    const ts = req.headers['x-event-timestamp'];
    const sig = req.headers['x-signature'];
    const corr = req.headers['x-correlation-id'];
    assert.equal(auth, `Bearer ${SERVICE_TOKEN}`);
    assert.equal(key, INTEGRATION_KEY);
    assert.ok(typeof ts === 'string' && Number.isFinite(Date.parse(ts)));
    assert.ok(typeof corr === 'string' && corr.length > 0);
    const expectedSig = buildMolySignature({
      timestamp: ts,
      rawBody: rawBuf,
      secret: HMAC_SECRET,
    });
    assert.equal(sig, expectedSig);
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const rawBuf = Buffer.concat(chunks);
      const rawText = rawBuf.toString('utf8');
      let body = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: false, code: 'INVALID_JSON', message: 'Invalid JSON' }));
        return;
      }

      verifyRequestSignature(req, rawBuf);
      const record = {
        path: req.url,
        headers: { ...req.headers },
        rawBody: rawText,
        body,
      };
      requests.push(record);

      const sendJson = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      const popOverride = (queueName) => {
        const queue = routeBehavior[queueName];
        if (!Array.isArray(queue) || queue.length === 0) return null;
        return typeof queue[0] === 'function' ? queue.shift()(body, req) : queue.shift();
      };

      if (req.url === '/api/integrations/v1/users/provision') {
        const override = popOverride('provision');
        if (override?.delayMs) {
          await new Promise((r) => setTimeout(r, override.delayMs));
          if (res.writableEnded || req.destroyed) return;
        }
        if (override?.httpStatus >= 400) {
          return sendJson(override.httpStatus, override.payload);
        }
        const status = override?.httpStatus || 202;
        const inboxStatus = override?.inboxStatus || (status === 202 ? 'queued' : 'processed');
        const rowId = inboxSeq++;
        inbox.set(body.event_id, {
          id: rowId,
          event_id: body.event_id,
          idempotency_key: body.idempotency_key,
          event_type: 'user.provisioned',
          status: inboxStatus,
          response_status: status,
          processed_at: inboxStatus === 'processed' ? new Date().toISOString() : null,
          last_error_code: null,
          last_error_message: null,
          payload: body,
        });
        return sendJson(status, {
          success: true,
          data: {
            inbox_id: rowId,
            inbox_status: inboxStatus,
            status: inboxStatus,
            applied: inboxStatus === 'processed',
          },
        });
      }

      if (req.url === '/api/integrations/v1/entitlements/grant') {
        const override = popOverride('grant');
        if (override?.delayMs) {
          await new Promise((r) => setTimeout(r, override.delayMs));
          if (res.writableEnded || req.destroyed) return;
        }
        if (override?.httpStatus >= 400) {
          return sendJson(override.httpStatus, override.payload);
        }
        const status = override?.httpStatus || 202;
        const inboxStatus = override?.inboxStatus || (status === 202 ? 'queued' : 'processed');
        const rowId = inboxSeq++;
        inbox.set(body.event_id, {
          id: rowId,
          event_id: body.event_id,
          idempotency_key: body.idempotency_key,
          event_type: 'entitlement.granted',
          status: inboxStatus,
          response_status: status,
          processed_at: inboxStatus === 'processed' ? new Date().toISOString() : null,
          last_error_code: null,
          last_error_message: null,
          payload: body,
        });
        return sendJson(status, {
          success: true,
          data: {
            inbox_id: rowId,
            inbox_status: inboxStatus,
            status: inboxStatus,
            applied: inboxStatus === 'processed',
          },
        });
      }

      if (req.url === '/api/integrations/v1/entitlements/revoke') {
        const override = popOverride('revoke');
        if (override?.httpStatus >= 400) {
          return sendJson(override.httpStatus, override.payload);
        }
        const status = override?.httpStatus || 202;
        const inboxStatus = override?.inboxStatus || (status === 202 ? 'queued' : 'processed');
        const rowId = inboxSeq++;
        inbox.set(body.event_id, {
          id: rowId,
          event_id: body.event_id,
          idempotency_key: body.idempotency_key,
          event_type: 'entitlement.revoked',
          status: inboxStatus,
          response_status: status,
          processed_at: inboxStatus === 'processed' ? new Date().toISOString() : null,
          last_error_code: null,
          last_error_message: null,
          payload: body,
        });
        return sendJson(status, {
          success: true,
          data: {
            inbox_id: rowId,
            inbox_status: inboxStatus,
            status: inboxStatus,
            applied: inboxStatus === 'processed',
          },
        });
      }

      if (req.url === '/api/integrations/v1/moly/events/status') {
        const matched = [];
        for (const row of inbox.values()) {
          if (
            (body.event_id && row.event_id === body.event_id)
            || (body.idempotency_key && row.idempotency_key === body.idempotency_key)
          ) {
            matched.push({
              id: row.id,
              event_id: row.event_id,
              idempotency_key: row.idempotency_key,
              status: row.status,
              response_status: row.response_status,
              processed_at: row.processed_at,
              last_error_code: row.last_error_code,
              last_error_message: row.last_error_message,
              response_body: { status: row.status },
            });
          }
        }
        return sendJson(200, { success: true, data: matched });
      }

      if (req.url === '/api/integrations/v1/ownership/query') {
        if (typeof routeBehavior.ownership === 'function') {
          const custom = routeBehavior.ownership(body);
          return sendJson(custom.httpStatus || 200, custom.payload);
        }
        const items = (body.external_course_ids || []).map((externalCourseId) => {
          const matchingGrants = [];
          for (const row of inbox.values()) {
            if (row.event_type === 'entitlement.granted' && row.status === 'processed') {
              if (
                row.payload.external_course_id === externalCourseId
                && row.payload.external_user_id === body.subject?.external_user_id
              ) {
                matchingGrants.push({
                  external_grant_id: row.payload.external_grant_id,
                  status: row.payload.status || 'active',
                  valid_from: row.payload.valid_from,
                  valid_until: row.payload.valid_until || null,
                  source_updated_at: row.payload.source_updated_at,
                });
              }
            }
          }
          const latest = matchingGrants.at(-1) || null;
          return latest
            ? { external_course_id: externalCourseId, owned: true, ...latest }
            : { external_course_id: externalCourseId, owned: false, external_grant_id: null, status: null };
        });
        return sendJson(200, {
          success: true,
          data: {
            checked_at: new Date().toISOString(),
            items,
          },
        });
      }

      return sendJson(404, { success: false, code: 'NOT_FOUND', message: 'Unknown route' });
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    inbox,
    behavior: routeBehavior,
    markEvent(eventId, status, extra = {}) {
      const row = inbox.get(eventId);
      assert.ok(row, `Inbox event ${eventId} not found`);
      row.status = status;
      row.processed_at = status === 'processed' ? new Date().toISOString() : row.processed_at;
      Object.assign(row, extra);
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('Day 3 Moly <-> CSCA-Course payment & entitlement sync', () => {
  let pg;
  let db;
  let server;
  let fakeNowMs;
  let payosPayments;
  let emailLog;
  let client;
  let outbox;
  let ownership;
  let mappingService;
  let payments;
  let admin;
  let app;

  beforeEach(async () => {
    fakeNowMs = Date.now() + 120_000;
    const getNow = () => new Date(fakeNowMs);
    pg = new PGlite();
    await createBootstrappedSchema(pg, { includeVideoCommerce: true });
    db = wrapPgliteDb(pg);

    await pg.exec(`
      INSERT INTO users(id, email, username, full_name, is_active, is_verified, is_vip, subscription_tier, coin_balance, coins)
      VALUES
        (10, 'learner10@moly.test', 'learner10', 'Learner Ten', TRUE, TRUE, FALSE, 'basic', 0, 0),
        (11, 'admin11@moly.test', 'admin11', 'Admin Eleven', TRUE, TRUE, FALSE, 'basic', 0, 0);
      INSERT INTO vip_packages(id, name, tier, allowed_subjects, price, duration_days, is_active)
      VALUES (1, 'VIP Math+Physics', 'vip', ARRAY['MATH','PHYSICS'], 150000, 90, TRUE);
      INSERT INTO courses(id, external_key, slug, title, subject_code, status, access_type)
      VALUES
        (101, 'math-core', 'math-core', 'Toan CSCA Co Ban', 'MATH', 'published', 'package'),
        (102, 'physics-core', 'physics-core', 'Ly CSCA Co Ban', 'PHYSICS', 'published', 'package'),
        (103, 'local-only', 'local-only', 'Local Unmapped Course', 'MATH', 'published', 'package');
    `);

    server = await startMockCourseServer();
    payosPayments = new Map();
    emailLog = [];

    let clientNowOffset = 0;
    client = createCourseIntegrationClient({
      config: {
        baseUrl: server.baseUrl,
        serviceToken: SERVICE_TOKEN,
        integrationKey: INTEGRATION_KEY,
        hmacSecret: HMAC_SECRET,
        timeoutMs: 1200,
        maxTransportAttempts: 2,
        retryBaseDelayMs: 5,
      },
      now: () => fakeNowMs + (clientNowOffset++),
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 20))),
      logger: { warn: () => {}, error: () => {} },
    });

    outbox = createCourseOutboxSyncService({
      db,
      client,
      now: getNow,
      retryBaseSeconds: 30,
      maxBackoffSeconds: 600,
      logger: { warn: () => {}, error: () => {} },
    });

    ownership = createCourseOwnershipProjectionService({
      db,
      client,
      outbox,
      now: getNow,
      logger: { warn: (msg, meta) => console.warn('[TEST-OWNERSHIP-WARN]', msg, meta), error: console.error },
    });

    mappingService = createCourseIntegrationMappingService(db);

    const gateway = {
      isConfigured: () => true,
      assertConfigured: () => {},
      verifyWebhook: (body) => ({
        orderCode: Number(body.orderCode),
        amount: Number(body.amount),
        reference: body.reference || `ref_${body.orderCode}`,
        description: body.description || 'Paid via PayOS',
        accountNumber: '000123',
        transactionDateTime: new Date(fakeNowMs).toISOString(),
        currency: body.currency || 'VND',
      }),
      create: async (orderRow) => {
        const orderCode = Number(orderRow.id);
        const link = {
          orderCode,
          paymentLinkId: `plink_${orderCode}`,
          checkoutUrl: `https://payos.test/check/${orderCode}`,
          qrCode: `000201010212${orderCode}`,
          amount: Number(orderRow.amount),
          transactionCode: orderRow.transaction_code,
        };
        payosPayments.set(orderCode, { ...link, status: 'PENDING', amountPaid: 0 });
        return link;
      },
      get: async (orderCode) => {
        const found = payosPayments.get(Number(orderCode));
        if (!found) {
          const err = new Error('Payment link not found');
          err.status = 404;
          throw err;
        }
        return found;
      },
      cancel: async (orderCode) => {
        const cur = payosPayments.get(Number(orderCode));
        if (cur) cur.status = 'CANCELLED';
        return { orderCode, status: 'CANCELLED' };
      },
    };

    payments = createVideoPaymentService({
      db,
      gateway,
      recalculateVip: async () => {},
      sendEmail: async (payload) => { emailLog.push(payload); },
      salesEnabled: () => true,
      now: getNow,
      courseOutbox: outbox,
      courseOwnership: ownership,
    });

    const repo = createVideoCommerceRepository(db);
    admin = createVideoAdminService({
      db,
      repository: repo,
      payments,
      recalculateVip: async () => {},
      sendRightsEmail: async (payload) => { emailLog.push(payload); },
      salesEnabled: () => true,
      now: getNow,
      courseOutbox: outbox,
      courseOwnership: ownership,
    });

    app = express();
    app.use(express.json());
    const auth = (req, res, next) => {
      if (!req.headers['x-test-user']) return res.sendStatus(401);
      req.user = { id: Number(req.headers['x-test-user']) };
      next();
    };
    const optAuth = (req, _res, next) => {
      if (req.headers['x-test-user']) req.user = { id: Number(req.headers['x-test-user']) };
      next();
    };
    const perm = () => (req, res, next) => {
      if (req.headers['x-test-admin'] !== 'true') return res.sendStatus(403);
      next();
    };
    app.use('/api/video-commerce', createVideoShopRoutes({
      service: admin,
      coupons: createVideoCouponAdminService({ db, admin }),
      authenticate: auth,
      authorizePermission: perm,
      optionalAuth: optAuth,
    }));
    app.use('/api/video-commerce/payments', createVideoPaymentRoutes({
      service: payments,
      authenticate: auth,
      authorizePermission: perm,
    }));
    app.use('/api/admin/course-integrations', createCourseIntegrationAdminRoutes({
      service: mappingService,
      outbox,
      ownership,
      db,
      authenticate: auth,
      authorizeAnyPermission: perm,
    }));
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  async function seedMappings() {
    await mappingService.upsertManualCourseMapping({
      sourceSystem: 'moly',
      externalCourseId: 'moly:course:101',
      localCourseId: 101,
      actorId: 11,
      notes: 'Manual mapping 101',
    });
    await mappingService.upsertManualCourseMapping({
      sourceSystem: 'moly',
      externalCourseId: 'moly:course:102',
      localCourseId: 102,
      actorId: 11,
      notes: 'Manual mapping 102',
    });
  }

  async function seedVideoPkg({ name = 'Video Math Only', priceVnd = 200000, durationDays = 90, courseIds = [101], allowedSubjects = ['MATH'] } = {}) {
    const pkg = await admin.saveProduct('video', null, {
      name,
      description: 'Video course package',
      priceVnd,
      durationMode: 'days',
      durationDays,
      status: 'active',
      courseIds,
      allowedSubjects,
    }, 11);
    await payments.configureProduct('video', pkg.id, { renewalMode: 'new_period' }, 11);
    return pkg;
  }

  async function simulatePayosWebhook(order) {
    const txRow = (await db.query('SELECT id FROM transactions WHERE transaction_code = $1', [order.orderId])).rows[0];
    const orderCode = Number(order.payment?.orderCode ?? txRow?.id);
    const payment = payosPayments.get(orderCode);
    if (payment) {
      payment.status = 'PAID';
      payment.amountPaid = order.amount;
    }
    return payments.acceptPayment(orderCode, {
      provider: 'payos',
      orderCode,
      amount: order.amount,
      currency: 'VND',
      reference: `bank_${orderCode}`,
    });
  }

  test('migration 077 applies cleanly and idempotently without or with video commerce tables', async () => {
    const barePg = new PGlite();
    await barePg.exec(`
      CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT);
      CREATE TABLE courses (id SERIAL PRIMARY KEY, slug TEXT, title TEXT);
    `);
    await applyCourseIntegrationMigration(pgliteMigrationClient(barePg));
    await applyCourseIntegrationMigration(pgliteMigrationClient(barePg));

    const colCheck = await barePg.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'integration_outbox' AND column_name IN ('user_id', 'transaction_id', 'remote_status', 'external_grant_id')`,
    );
    assert.equal(colCheck.rows.length, 4);

    // Repeat apply on full commerce schema also stays idempotent.
    await applyCourseIntegrationMigration(pgliteMigrationClient(pg));
    const fullCheck = await pg.query(
      `SELECT
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='video_commerce_orders' AND column_name='refunded_at') AS has_refund,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_video_entitlements' AND column_name='snapshot') AS has_snapshot,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='external_entitlements' AND column_name='effective_owned') AS has_eff`,
    );
    assert.deepEqual(fullCheck.rows[0], { has_refund: true, has_snapshot: true, has_eff: true });
  });

  test('feature flags fail closed by default and .env.example keeps worker & sales disabled', () => {
    assert.equal(parseFeatureFlag(undefined, 'CSCA_VIDEO_COMMERCE_SALES_ENABLED'), false);
    assert.equal(parseFeatureFlag(undefined, 'COURSE_INTEGRATION_WORKER_ENABLED'), false);
    const envExample = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    assert.match(envExample, /CSCA_VIDEO_COMMERCE_SALES_ENABLED=false/);
    assert.match(envExample, /COURSE_INTEGRATION_WORKER_ENABLED=false/);
    assert.match(envExample, /COURSE_LMS_BASE_URL=/);
    assert.match(envExample, /COURSE_LMS_SERVICE_TOKEN=/);
    assert.match(envExample, /COURSE_LMS_INTEGRATION_KEY=/);
    assert.match(envExample, /COURSE_LMS_HMAC_SECRET=/);
    assert.match(envExample, /COURSE_LMS_REQUEST_TIMEOUT_MS=/);
  });

  test('signed HTTP client regenerates timestamp & HMAC per retry while keeping idempotency key unchanged and redacting secrets on timeout', async () => {
    server.behavior.provision.push({
      httpStatus: 503,
      payload: { success: false, errorCode: 'COURSE_TEMP_BUSY', message: 'Try again Bearer secret-leak' },
    });

    const payload = {
      event_id: 'moly:evt:test:1',
      idempotency_key: 'moly:idem:test:1',
      correlation_id: 'corr_test_1',
      source_system: 'moly',
      external_user_id: 'moly:user:10',
    };

    const res = await client.provisionUser(payload, {
      afterAttempt: undefined,
    });
    assert.equal(res.httpStatus, 202);
    assert.equal(res.attemptCount, 2);
    assert.equal(server.requests.length, 2);
    assert.equal(server.requests[0].headers['idempotency-key'], 'moly:idem:test:1');
    assert.equal(server.requests[1].headers['idempotency-key'], 'moly:idem:test:1');
    assert.notEqual(server.requests[0].headers['x-event-timestamp'], server.requests[1].headers['x-event-timestamp']);
    assert.notEqual(server.requests[0].headers['x-signature'], server.requests[1].headers['x-signature']);
    assert.equal(server.requests[0].rawBody, server.requests[1].rawBody);

    // Timeout enforcement + no secret leakage
    server.behavior.provision.push({ delayMs: 400, httpStatus: 202 });
    const capturedLogs = [];
    const shortTimeoutClient = createCourseIntegrationClient({
      config: {
        baseUrl: server.baseUrl,
        serviceToken: SERVICE_TOKEN,
        integrationKey: INTEGRATION_KEY,
        hmacSecret: HMAC_SECRET,
        timeoutMs: 120,
        maxTransportAttempts: 1,
      },
      logger: { warn: (...args) => capturedLogs.push(JSON.stringify(args)) },
    });
    await assert.rejects(
      shortTimeoutClient.provisionUser({ ...payload, event_id: 'moly:evt:timeout', idempotency_key: 'moly:idem:timeout' }),
      (err) => err instanceof CourseIntegrationClientError && err.code === 'COURSE_LMS_TIMEOUT' && err.retryable === true,
    );
    const logBlob = capturedLogs.join('\n');
    assert.ok(!logBlob.includes(SERVICE_TOKEN));
    assert.ok(!logBlob.includes(HMAC_SECRET));
  });

  test('incomplete manual mappings fail closed without title/slug guessing; pure unmapped local packages stay local', async () => {
    await seedMappings(); // maps 101 & 102 only, NOT 103
    const mixedPkg = await seedVideoPkg({ name: 'Mixed Package', courseIds: [101, 103] });
    const mappedPkg = await seedVideoPkg({ name: 'Math Temp Mapped', courseIds: [101] });
    const localPkg = await seedVideoPkg({ name: 'Local Package', courseIds: [103] });

    await assert.rejects(
      payments.quote(10, { type: 'video', productId: mixedPkg.id }),
      { code: 'COURSE_MAPPING_MISSING' },
    );

    // Also verify createOrder fails closed before PayOS link creation if a manual mapping is disabled after quote.
    const validQuote = await payments.quote(10, { type: 'video', productId: mappedPkg.id });
    const mappings = await mappingService.listCourseMappings({ localCourseId: 101 });
    await mappingService.updateCourseMappingStatus({ id: mappings[0].id, status: 'inactive', actorId: 11 });
    await assert.rejects(
      payments.createOrder(10, {
        type: 'video',
        productId: mappedPkg.id,
        quoteHash: validQuote.quoteHash,
        idempotencyKey: 'disabled_mapping_key_1',
      }),
      { code: 'COURSE_MAPPING_MISSING' },
    );
    assert.equal(payosPayments.size, 0);

    const quoteLocal = await payments.quote(10, { type: 'video', productId: localPkg.id });
    const localOrder = await payments.createOrder(10, {
      type: 'video',
      productId: localPkg.id,
      quoteHash: quoteLocal.quoteHash,
      idempotencyKey: 'local_pkg_key_1',
    });
    const paidLocal = await simulatePayosWebhook(localOrder);
    assert.equal(paidLocal.status, 'completed');
    const outboxCount = (await db.query('SELECT COUNT(*)::int AS c FROM integration_outbox')).rows[0].c;
    assert.equal(outboxCount, 0);
  });

  test('full purchase -> transactional outbox -> pending_sync (HTTP 202) blocks duplicate buy -> status reconciliation -> owned + webhook idempotency', async () => {
    await seedMappings();
    const pkg = await seedVideoPkg({
      name: 'Course 101+102 Bundle',
      courseIds: [101, 102],
      allowedSubjects: ['MATH', 'PHYSICS'],
    });
    const quote = await payments.quote(10, { type: 'video', productId: pkg.id });
    const order = await payments.createOrder(10, {
      type: 'video',
      productId: pkg.id,
      quoteHash: quote.quoteHash,
      idempotencyKey: 'buy_bundle_101_102',
    });

    // Pay + duplicate webhook replay inside same purchase flow.
    const [paid1, paid2] = await Promise.all([
      simulatePayosWebhook(order),
      simulatePayosWebhook(order),
    ]);
    assert.equal(paid1.status, 'completed');
    assert.equal(paid2.status, 'completed');
    assert.equal(paid1.rights.videoEntitlementId, paid2.rights.videoEntitlementId);

    const entRow = (await db.query('SELECT * FROM user_video_entitlements WHERE id=$1', [paid1.rights.videoEntitlementId])).rows[0];
    assert.equal(entRow.snapshot.name, 'Course 101+102 Bundle');

    const outboxRows = (await db.query('SELECT * FROM integration_outbox ORDER BY id ASC')).rows;
    assert.equal(outboxRows.length, 3); // 1 user.provisioned + 2 entitlement.granted (101, 102)
    assert.equal(outboxRows[0].event_type, 'user.provisioned');
    assert.equal(outboxRows[1].event_type, 'entitlement.granted');
    assert.equal(outboxRows[2].event_type, 'entitlement.granted');

    // Step 1: dispatch next -> ONLY user.provisioned is dispatched (202 queued); grants wait!
    const step1 = await outbox.processAvailableOutboxJobs({ reconcileBefore: false, reconcileAfter: false });
    assert.equal(step1.dispatched.length, 1);
    assert.equal(step1.dispatched[0].outbox.event_type, 'user.provisioned');
    assert.equal(step1.dispatched[0].outbox.status, 'sent');
    assert.equal(step1.dispatched[0].outbox.remote_status, 'queued');

    // Ownership shows 'Đang đồng bộ quyền' & blocks duplicate purchase even with local entitlement!
    const catalogPending = await request(app)
      .get('/api/video-commerce/shop/catalog/video')
      .set('x-test-user', '10');
    assert.equal(catalogPending.status, 200);
    assert.equal(catalogPending.body.data.items[0].ownershipStatus, 'pending_sync');
    assert.equal(catalogPending.body.data.items[0].ownershipLabel, 'Đang đồng bộ quyền');
    assert.equal(catalogPending.body.data.items[0].canPurchase, false);

    await assert.rejects(
      payments.quote(10, { type: 'video', productId: pkg.id }),
      { code: 'PENDING_SYNC' },
    );

    // Step 2: Course worker completes user.provisioned -> grants dispatch (202 queued)
    server.markEvent(outboxRows[0].event_id, 'processed');
    const step2 = await outbox.processAvailableOutboxJobs({ reconcileBefore: true, reconcileAfter: false });
    assert.equal(step2.reconciledBefore.length, 1);
    assert.equal(step2.reconciledBefore[0].remoteStatus, 'processed');
    assert.equal(step2.dispatched.length, 2);
    assert.equal(step2.dispatched.every((d) => d.outbox.status === 'sent' && d.outbox.remote_status === 'queued'), true);

    // Still pending_sync until grants are confirmed processed via /moly/events/status!
    const stillPending = await ownership.evaluatePackageOwnership(10, { courseIds: [101, 102], videoPackageId: pkg.id });
    assert.equal(stillPending.status, 'pending_sync');

    // Step 3: Course marks grants processed -> admin outbox sync transitions Moly state to 'Đã sở hữu'
    server.markEvent(outboxRows[1].event_id, 'processed');
    server.markEvent(outboxRows[2].event_id, 'processed');
    const syncRes = await request(app)
      .post('/api/admin/course-integrations/outbox/sync')
      .set('x-test-user', '11')
      .set('x-test-admin', 'true')
      .send({});
    assert.equal(syncRes.status, 200);

    const meOwnership = await request(app)
      .get('/api/video-commerce/me/ownership')
      .set('x-test-user', '10');
    assert.equal(meOwnership.status, 200);
    assert.equal(meOwnership.body.data.summary.status, 'owned');
    assert.equal(meOwnership.body.data.summary.label, 'Đã sở hữu');

    await assert.rejects(
      payments.quote(10, { type: 'video', productId: pkg.id }),
      { code: 'ALREADY_OWNED' },
    );
  });

  test('outage retry, expired lease recovery, and 409 conflict quarantine to dead_letter + integration_conflicts', async () => {
    await seedMappings();
    const pkg = await seedVideoPkg({ name: 'Math Resilience Course', courseIds: [101] });
    const q = await payments.quote(10, { type: 'video', productId: pkg.id });
    const order = await payments.createOrder(10, {
      type: 'video',
      productId: pkg.id,
      quoteHash: q.quoteHash,
      idempotencyKey: 'resilience_buy_1',
    });
    await simulatePayosWebhook(order);

    // Provision fails with persistent 503 outage across transport retries -> moves to 'failed' with backoff
    server.behavior.provision.push(
      { httpStatus: 503, payload: { success: false, errorCode: 'COURSE_DOWN', message: 'Down 1' } },
      { httpStatus: 503, payload: { success: false, errorCode: 'COURSE_DOWN', message: 'Down 2' } },
    );
    const failRun = await outbox.dispatchNextOutboxJob();
    assert.equal(failRun.outcome, 'failed');
    assert.equal(failRun.outbox.status, 'failed');

    // Immediate retry before next_retry_at picks nothing; advancing clock past 30s recovers cleanly!
    assert.equal(await outbox.dispatchNextOutboxJob(), null);
    fakeNowMs += 35_000;
    const recoveredRun = await outbox.dispatchNextOutboxJob();
    assert.equal(recoveredRun.outcome, 'sent');
    server.markEvent(recoveredRun.outbox.event_id, 'processed');
    await outbox.reconcileSentOutboxEvents();

    // Simulate crashed worker leaving 'processing' lease expired on entitlement.granted + 409 conflict!
    const grantRow = (await db.query("SELECT * FROM integration_outbox WHERE event_type='entitlement.granted'")).rows[0];
    await db.query(
      "UPDATE integration_outbox SET status='processing', locked_by='crashed-worker', locked_until=$2 WHERE id=$1",
      [grantRow.id, new Date(fakeNowMs - 5_000).toISOString()],
    );
    server.behavior.grant.push({
      httpStatus: 409,
      payload: {
        success: false,
        errorCode: 'IDENTITY_CONFLICT',
        message: 'External user already bound to another learner',
        details: { conflicting_user_id: 99 },
      },
    });
    const conflictRun = await outbox.dispatchNextOutboxJob();
    assert.equal(conflictRun.outcome, 'dead_letter');
    assert.equal(conflictRun.outbox.status, 'dead_letter');

    const conflictsRes = await request(app)
      .get('/api/admin/course-integrations/conflicts?status=open')
      .set('x-test-user', '11')
      .set('x-test-admin', 'true');
    assert.equal(conflictsRes.status, 200);
    assert.equal(conflictsRes.body.data.length, 1);
    assert.equal(conflictsRes.body.data[0].conflict_type, 'IDENTITY_ALREADY_LINKED');
  });

  test('Course -> Moly ownership projection blocks duplicate buy on owned=true AND on Codex #7 blocked/retained grants', async () => {
    await seedMappings();
    const pkg101 = await seedVideoPkg({ name: 'Math Only', courseIds: [101], allowedSubjects: ['MATH'] });
    const pkg102 = await seedVideoPkg({ name: 'Physics Only', courseIds: [102], allowedSubjects: ['PHYSICS'] });

    server.behavior.ownership = (body) => ({
      httpStatus: 200,
      payload: {
        success: true,
        data: {
          checked_at: new Date(fakeNowMs).toISOString(),
          items: body.external_course_ids.map((extCourseId) => {
            if (extCourseId === 'moly:course:101') {
              return {
                external_course_id: extCourseId,
                owned: true,
                external_grant_id: 'internal-management:grant:88',
                status: 'active',
                valid_from: new Date(fakeNowMs - 86400_000).toISOString(),
                valid_until: new Date(fakeNowMs + 30 * 86400_000).toISOString(),
                source_updated_at: new Date(fakeNowMs - 1000).toISOString(),
              };
            }
            // Codex #7: owned=false while retaining non-expired active/suspended grant!
            return {
              external_course_id: extCourseId,
              owned: false,
              external_grant_id: 'csca-course:grant:77',
              status: 'suspended',
              valid_from: new Date(fakeNowMs - 86400_000).toISOString(),
              valid_until: new Date(fakeNowMs + 30 * 86400_000).toISOString(),
              source_updated_at: new Date(fakeNowMs - 1000).toISOString(),
            };
          }),
        },
      },
    });

    const catRes = await request(app)
      .get('/api/video-commerce/shop/catalog/video')
      .set('x-test-user', '10');
    assert.equal(catRes.status, 200);
    const byName = new Map(catRes.body.data.items.map((i) => [i.name, i]));

    assert.equal(byName.get('Math Only').ownershipStatus, 'owned');
    assert.equal(byName.get('Math Only').ownershipLabel, 'Đã sở hữu');
    assert.equal(byName.get('Math Only').canPurchase, false);

    assert.equal(byName.get('Physics Only').ownershipStatus, 'grant_blocked');
    assert.equal(byName.get('Physics Only').ownershipLabel, 'Đang tạm khóa quyền');
    assert.equal(byName.get('Physics Only').canPurchase, false);

    await assert.rejects(
      payments.quote(10, { type: 'video', productId: pkg101.id }),
      { code: 'ALREADY_OWNED' },
    );
    await assert.rejects(
      payments.quote(10, { type: 'video', productId: pkg102.id }),
      { code: 'EXTERNAL_GRANT_BLOCKED' },
    );

    // Zero outbound echo events generated when syncing Course -> Moly ownership.
    const echoCount = (await db.query('SELECT COUNT(*)::int AS c FROM integration_outbox')).rows[0].c;
    assert.equal(echoCount, 0);
  });

  test('scoped refund & admin revoke keep sibling purchases, manual grants, and Course/Management entitlements intact with monotonic source_updated_at', async () => {
    await seedMappings();
    const pkg101 = await seedVideoPkg({ name: 'Math Order Package', courseIds: [101], allowedSubjects: ['MATH'] });
    const pkg102 = await seedVideoPkg({ name: 'Physics Paid Package', priceVnd: 300000, courseIds: [102], allowedSubjects: ['PHYSICS'] });

    // Create order on pkg102 FIRST (before sibling grants/projections exist on 102).
    const q102 = await payments.quote(10, { type: 'video', productId: pkg102.id });
    const order102 = await payments.createOrder(10, {
      type: 'video',
      productId: pkg102.id,
      quoteHash: q102.quoteHash,
      idempotencyKey: 'refund_target_order_102',
    });

    // Mutate catalog price & courses AFTER order creation; snapshot immutability preserves original terms on fulfill & refund!
    await admin.saveProduct('video', pkg102.id, {
      name: 'Physics Mutated Price Package',
      description: 'Updated',
      priceVnd: 999000,
      durationMode: 'days',
      durationDays: 10,
      status: 'active',
      courseIds: [101, 102],
      allowedSubjects: ['MATH', 'PHYSICS'],
    }, 11);

    const paid102 = await simulatePayosWebhook(order102);
    assert.equal(paid102.snapshot.originalAmount, 300000);
    assert.deepEqual(paid102.snapshot.video.courseIds, [102]);

    // Seed sibling local manual grant on course 101 AND sibling Course/Internal-Management grant covering BOTH 102 & 101!
    const manualGrant = await admin.grant({
      userId: 10,
      type: 'video',
      productId: pkg101.id,
      reason: 'Sibling manual scholarship grant',
      requestKey: 'manual_grant_key_101',
      videoExpiresAt: new Date(fakeNowMs + 60 * 86400_000).toISOString(),
    }, 11);
    await db.query(
      `INSERT INTO external_entitlements(
         user_id, source_system, origin_system, external_user_id, external_course_id,
         external_grant_id, local_course_id, status, effective_owned, valid_from, source_updated_at
       ) VALUES (10, 'csca-course', 'internal-management', 'moly:user:10', 'moly:course:102', 'internal-management:grant:501', 102, 'active', TRUE, NOW(), NOW())`,
    );

    // Dispatch provision + grant for 102 (plus manualGrant on 101).
    const initialProvision = (await db.query("SELECT * FROM integration_outbox WHERE event_type='user.provisioned' ORDER BY id ASC LIMIT 1")).rows[0];
    await outbox.processAvailableOutboxJobs({ reconcileBefore: false, reconcileAfter: false });
    server.markEvent(initialProvision.event_id, 'processed');
    await outbox.processAvailableOutboxJobs({ reconcileBefore: true, reconcileAfter: false });
    for (const row of (await db.query("SELECT * FROM integration_outbox WHERE event_type='entitlement.granted'")).rows) {
      if (row.status === 'sent') server.markEvent(row.event_id, 'processed');
    }
    await outbox.reconcileSentOutboxEvents();

    // Admin refunds ONLY order102 via HTTP route.
    const refundRes = await request(app)
      .post(`/api/video-commerce/manage/orders/${order102.orderId}/refund`)
      .set('x-test-user', '11')
      .set('x-test-admin', 'true')
      .send({ reason: 'Customer requested refund within 24h', refundReference: 'RF-2026-01' });
    assert.equal(refundRes.status, 200);
    assert.equal(refundRes.body.data.revokedEntitlementIds.length, 1);

    // Check paid102 entitlement revoked while manualGrant (tx sibling) AND internal-management:grant:501 stay active!
    const entStates = (await db.query(
      'SELECT id, status FROM user_video_entitlements WHERE user_id = 10 ORDER BY id ASC',
    )).rows;
    const manualState = entStates.find((r) => Number(r.id) === Number(manualGrant.id));
    const refundedState = entStates.find((r) => Number(r.id) === Number(paid102.rights.videoEntitlementId));
    assert.equal(manualState.status, 'active');
    assert.equal(refundedState.status, 'revoked');

    const mgmtRow = (await db.query("SELECT status FROM external_entitlements WHERE external_grant_id='internal-management:grant:501'")).rows[0];
    assert.equal(mgmtRow.status, 'active');

    // Outbox contains scoped entitlement.revoked with strictly greater source_updated_at than its grant!
    const revokeRow = (await db.query("SELECT * FROM integration_outbox WHERE event_type='entitlement.revoked' AND entitlement_id=$1", [paid102.rights.videoEntitlementId])).rows[0];
    const grantRow = (await db.query("SELECT * FROM integration_outbox WHERE event_type='entitlement.granted' AND entitlement_id=$1", [paid102.rights.videoEntitlementId])).rows[0];
    assert.equal(revokeRow.external_grant_id, grantRow.external_grant_id);
    assert.ok(new Date(revokeRow.source_updated_at).getTime() > new Date(grantRow.source_updated_at).getTime());

    // Admin explicitly revokes manualGrant too -> scoped revoke event queued cleanly!
    const adminRevoke = await request(app)
      .post(`/api/video-commerce/manage/rights/${manualGrant.id}/revoke`)
      .set('x-test-user', '11')
      .set('x-test-admin', 'true')
      .send({ reason: 'End of scholarship term' });
    assert.equal(adminRevoke.status, 200);

    await outbox.processAvailableOutboxJobs({ reconcileBefore: false, reconcileAfter: false });
    const revokeRequests = server.requests.filter((r) => r.path === '/api/integrations/v1/entitlements/revoke');
    assert.equal(revokeRequests.length, 2);
    assert.ok(revokeRequests.every((r) => r.body.external_grant_id !== 'internal-management:grant:501'));
  });
});
