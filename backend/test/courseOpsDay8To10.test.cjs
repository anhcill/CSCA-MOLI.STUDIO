const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { PGlite } = require("@electric-sql/pglite");

const {
  createCourseIntegrationClient,
  buildMolySignature,
  buildMolyGetSignature,
} = require("../src/services/courseIntegrationClient");
const { createCourseOwnershipProjectionService } = require("../src/services/courseOwnershipProjectionService");
const { createCourseOutboxSyncService } = require("../src/services/courseOutboxSyncService");
const { createCourseReconciliationService } = require("../src/services/courseReconciliationService");
const { createMolyCourseCatalogSyncService } = require("../src/services/molyCourseCatalogSyncService");
const { createCourseIntegrationMappingService } = require("../src/services/courseIntegrationMappingService");
const { createCourseIntegrationAdminRoutes } = require("../src/routes/courseIntegrationAdminRoutes");
const { createCourseIntegrationV2Routes } = require("../src/routes/courseIntegrationV2Routes");
const { createVideoAdminService } = require("../src/services/videoAdminService");
const { createVideoCommerceRepository } = require("../src/repositories/videoCommerceRepository");
const { createVideoPaymentService } = require("../src/services/videoPaymentService");
const { collectIntegrationReadiness, runContractProbe } = require("../src/utils/integrationReadiness");
const { getKillSwitchesSnapshot, readRolloutPosture } = require("../src/utils/integrationLogger");
const { applyMigration: applyVideoCommerceMigration } = require("../scripts/apply_video_commerce_migration");
const {
  applyMigration: applyCourseIntegrationMigration,
  TABLES: INTEGRATION_TABLES,
} = require("../scripts/apply_course_integration_migration");

const OUTBOUND_CFG = {
  serviceToken: "course-service-tok-day8to10",
  integrationKey: "moly-v2-key",
  hmacSecret: "day8to10-outbound-hmac-secret",
};

const INBOUND_CFG = {
  serviceToken: "moly-inbound-tok-day8to10",
  integrationKey: "csca-course-v2-key",
  hmacSecret: "day8to10-inbound-hmac-secret",
};

function makeDbAdapter(pg) {
  const execOrQuery = async (sql, params) => {
    if (params !== undefined) return pg.query(sql, params);
    const trimmed = String(sql).trim();
    if (/^(BEGIN|COMMIT|ROLLBACK);?$/i.test(trimmed)) return pg.query(trimmed);
    const results = await pg.exec(sql);
    return Array.isArray(results) && results.length ? results[results.length - 1] : { rows: [] };
  };
  return {
    query: execOrQuery,
    pool: {
      connect: async () => ({
        query: execOrQuery,
        release: () => {},
      }),
    },
  };
}

function signInboundBody(bodyObj) {
  const rawBody = JSON.stringify(bodyObj);
  const timestamp = new Date().toISOString();
  const sig = crypto
    .createHmac("sha256", INBOUND_CFG.hmacSecret)
    .update(Buffer.from(`${timestamp}.${rawBody}`, "utf8"))
    .digest("hex");
  return {
    rawBody,
    headers: {
      Authorization: `Bearer ${INBOUND_CFG.serviceToken}`,
      "X-Integration-Key": INBOUND_CFG.integrationKey,
      "X-Timestamp": timestamp,
      "X-Signature": `sha256=${sig}`,
      "Content-Type": "application/json",
    },
  };
}

function verifyOutboundRequestSignature(req, rawBody) {
  const ts = req.headers["x-event-timestamp"];
  const sig = req.headers["x-signature"];
  assert.ok(ts && sig, `Missing HMAC headers on ${req.method} ${req.url}`);
  const expected = req.method === "GET"
    ? buildMolyGetSignature({
        timestamp: ts,
        method: "GET",
        originalUrl: req.url,
        secret: OUTBOUND_CFG.hmacSecret,
      })
    : buildMolySignature({
        timestamp: ts,
        rawBody,
        secret: OUTBOUND_CFG.hmacSecret,
      });
  assert.equal(sig, expected, `Invalid outbound HMAC signature for ${req.method} ${req.url}`);
}

function readMigrationSql(filename) {
  return fs.readFileSync(path.join(__dirname, "../../database/migrations", filename), "utf8");
}

async function setupDay8To10Env(t, { stubHandler = null, env = {}, applyFullVideoAdmin = false } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(255),
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      avatar_url TEXT,
      role VARCHAR(32) NOT NULL DEFAULT 'student',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      is_verified BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      is_vip BOOLEAN NOT NULL DEFAULT FALSE,
      subscription_tier VARCHAR(32) DEFAULT 'basic',
      vip_tier VARCHAR(32) DEFAULT 'free',
      vip_expires_at TIMESTAMPTZ,
      vip_package_id INTEGER,
      vip_allowed_subjects TEXT[] DEFAULT ARRAY[]::text[],
      coins INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_vip_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      package_id INTEGER,
      transaction_id INTEGER,
      tier VARCHAR(32) DEFAULT 'free',
      source VARCHAR(32),
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT FALSE,
      allowed_subjects TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status VARCHAR(32) DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS vip_packages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      tier VARCHAR(32) DEFAULT 'vip',
      price INTEGER,
      original_price INTEGER,
      subject_prices JSONB,
      subject_original_prices JSONB,
      duration_days INTEGER,
      allowed_subjects TEXT[] DEFAULT ARRAY[]::text[],
      requires_subject_choice BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      external_key VARCHAR(255) UNIQUE,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      short_description TEXT,
      description TEXT,
      thumbnail_url TEXT,
      promo_video_url TEXT,
      preview_video_asset_id INTEGER,
      instructor_id INTEGER,
      subject_code VARCHAR(50) NOT NULL DEFAULT 'MATH',
      level VARCHAR(50) NOT NULL DEFAULT 'basic',
      access_type VARCHAR(30) NOT NULL DEFAULT 'package',
      required_tier VARCHAR(32) DEFAULT 'free',
      price_vnd INTEGER,
      compare_at_price_vnd INTEGER,
      badge_text VARCHAR(100),
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_new BOOLEAN NOT NULL DEFAULT FALSE,
      is_hot BOOLEAN NOT NULL DEFAULT FALSE,
      certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      rating_avg NUMERIC DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      enrolled_count INTEGER DEFAULT 0,
      total_sections INTEGER NOT NULL DEFAULT 0,
      total_lessons INTEGER NOT NULL DEFAULT 0,
      total_duration_seconds INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      content_updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS course_package_access (course_id INTEGER NOT NULL, package_id INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS course_outcomes (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL, content TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS course_requirements (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL, content TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS course_sections (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS course_lessons (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES course_sections(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      summary TEXT,
      lesson_type VARCHAR(30) DEFAULT 'video',
      content_html TEXT,
      estimated_duration_seconds INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
      is_required BOOLEAN NOT NULL DEFAULT TRUE,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      video_asset_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      source VARCHAR(30) NOT NULL DEFAULT 'free',
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      last_lesson_id INTEGER,
      last_position_seconds INTEGER DEFAULT 0,
      progress_pct NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      amount BIGINT DEFAULT 1,
      payment_method TEXT,
      package_id INTEGER REFERENCES vip_packages(id),
      package_duration INTEGER DEFAULT 30,
      package_name VARCHAR(100),
      transaction_code TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      raw_response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      discount_type TEXT,
      discount_value INTEGER,
      min_order_amount INTEGER DEFAULT 0,
      max_discount_amount INTEGER,
      max_uses INTEGER,
      user_limit INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      valid_from TIMESTAMPTZ,
      valid_until TIMESTAMPTZ,
      applicable_packages INTEGER[],
      applicable_tiers TEXT[] DEFAULT ARRAY['all'],
      description TEXT,
      created_by INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS coupon_usages (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER REFERENCES coupons(id),
      user_id INTEGER REFERENCES users(id),
      transaction_id INTEGER REFERENCES transactions(id),
      discount_amount INTEGER,
      final_amount INTEGER,
      original_amount INTEGER
    );
    CREATE TABLE IF NOT EXISTS coin_ledger (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER,
      amount INTEGER,
      balance_after INTEGER,
      source TEXT,
      description TEXT,
      metadata JSONB,
      idempotency_key TEXT UNIQUE
    );
  `);

  const db = makeDbAdapter(pg);
  await applyVideoCommerceMigration(db);
  if (applyFullVideoAdmin) {
    await db.query(readMigrationSql("068_video_commerce_payments.sql"));
    await db.query(readMigrationSql("069_video_commerce_admin.sql"));
  }
  await applyCourseIntegrationMigration(db);

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const rawBody = Buffer.concat(chunks).toString("utf8");
    verifyOutboundRequestSignature(req, rawBody);
    let bodyJson = null;
    try {
      bodyJson = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      bodyJson = null;
    }
    const result = stubHandler
      ? await stubHandler({ method: req.method, url: req.url, headers: req.headers, rawBody, body: bodyJson })
      : { status: 404, body: { success: false, code: "NOT_FOUND" } };
    if (result.rawBuffer) {
      res.writeHead(result.status || 200, result.headers || { "Content-Type": "application/octet-stream" });
      res.end(result.rawBuffer);
      return;
    }
    res.writeHead(result.status || 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body ?? {}));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const runtimeEnv = {
    ...env,
    COURSE_LMS_BASE_URL: baseUrl,
    COURSE_LMS_SERVICE_TOKEN: OUTBOUND_CFG.serviceToken,
    COURSE_LMS_INTEGRATION_KEY: OUTBOUND_CFG.integrationKey,
    COURSE_LMS_HMAC_SECRET: OUTBOUND_CFG.hmacSecret,
    COURSE_INBOUND_SERVICE_TOKEN: INBOUND_CFG.serviceToken,
    COURSE_INBOUND_INTEGRATION_KEY: INBOUND_CFG.integrationKey,
    COURSE_INBOUND_HMAC_SECRET: INBOUND_CFG.hmacSecret,
  };

  const client = createCourseIntegrationClient({
    config: {
      baseUrl,
      serviceToken: OUTBOUND_CFG.serviceToken,
      integrationKey: OUTBOUND_CFG.integrationKey,
      hmacSecret: OUTBOUND_CFG.hmacSecret,
      timeoutMs: 4000,
    },
    env: runtimeEnv,
  });

  const outbox = createCourseOutboxSyncService({ db, client, env: runtimeEnv });
  const ownership = createCourseOwnershipProjectionService({ db, client, outbox, env: runtimeEnv });
  const catalogSync = createMolyCourseCatalogSyncService({ db, client, env: runtimeEnv });
  const reconciliation = createCourseReconciliationService({ db, client, outbox, catalogSync, env: runtimeEnv });
  const mappingService = createCourseIntegrationMappingService(db);

  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.get("/health/integration", async (_req, res) => {
    const readiness = await collectIntegrationReadiness({
      db,
      client,
      env: runtimeEnv,
      workerStatus: { active: false, running: false },
    });
    res.status(readiness.ready ? 200 : 503).json(readiness);
  });
  app.use("/api/integrations/v2", createCourseIntegrationV2Routes({ catalogSync, env: runtimeEnv }));
  app.use(
    "/api/admin/course-integrations",
    createCourseIntegrationAdminRoutes({
      service: mappingService,
      outbox,
      ownership,
      reconciliation,
      catalogSync,
      db,
      client,
      env: runtimeEnv,
      workerStatus: () => ({ active: false, running: false }),
      authenticate: (req, res, next) => {
        if (!req.headers["x-test-user"]) return res.sendStatus(401);
        req.user = { id: Number(req.headers["x-test-user"]), role: "admin" };
        next();
      },
      authorizeAnyPermission: (...perms) => (req, res, next) => {
        const hdr = String(req.headers["x-test-perms"] || "users.manage,content.manage").split(",");
        if (!perms.some((p) => hdr.includes(p))) return res.sendStatus(403);
        next();
      },
    }),
  );

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pg.close();
  });

  return {
    pg,
    db,
    baseUrl,
    runtimeEnv,
    client,
    outbox,
    ownership,
    catalogSync,
    reconciliation,
    mappingService,
    app,
  };
}

/**
 * Temporarily swaps CommonJS modules using config/database or courseIntegrationRuntime
 * so modules with module-top-level imports execute cleanly against our PGlite test DB.
 */
async function withIsolatedModules(db, { runtimeOverrides = {}, testUser = null } = {}, work) {
  const dbPath = require.resolve("../src/config/database");
  const authPath = require.resolve("../src/middleware/authMiddleware");
  const runtimePath = require.resolve("../src/services/courseIntegrationRuntime");
  const reloadPaths = [
    require.resolve("../src/repositories/learningRepository"),
    require.resolve("../src/repositories/courseRepository"),
    require.resolve("../src/services/videoLearningAccess"),
    require.resolve("../src/services/courseService"),
    require.resolve("../src/services/learningService"),
    require.resolve("../src/routes/payments"),
  ];

  const saved = new Map();
  for (const p of [dbPath, authPath, runtimePath, ...reloadPaths]) {
    saved.set(p, require.cache[p]);
    delete require.cache[p];
  }

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: db,
  };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      authenticate: (req, res, next) => {
        if (!testUser) return res.sendStatus(401);
        req.user = typeof testUser === "function" ? testUser(req) : testUser;
        next();
      },
      optionalAuth: (req, _res, next) => {
        req.user = typeof testUser === "function" ? testUser(req) : testUser;
        next();
      },
      authorizeAnyPermission: () => (_req, _res, next) => next(),
    },
  };
  require.cache[runtimePath] = {
    id: runtimePath,
    filename: runtimePath,
    loaded: true,
    exports: runtimeOverrides,
  };

  try {
    const learningRepository = require("../src/repositories/learningRepository");
    const videoLearningAccess = require("../src/services/videoLearningAccess");
    const courseService = require("../src/services/courseService");
    const learningService = require("../src/services/learningService");
    const paymentsRouter = require("../src/routes/payments");
    return await work({ learningRepository, videoLearningAccess, courseService, learningService, paymentsRouter });
  } finally {
    for (const [p, entry] of saved.entries()) {
      delete require.cache[p];
      if (entry) require.cache[p] = entry;
    }
  }
}

test("Day 8 (1/4): v2 csca-course profile_projection mappings work across ownership, outbox, /hoc, and reconciliation", async (t) => {
  const remoteSnapshot = {
    complete: true,
    identities: [{ external_user_id: "moly:1", user_id: "cu-1", status: "active" }],
    open_conflicts: [],
    entitlements: [],
    course_mappings: [
      { source_system: "csca-course", external_course_id: "profile:prof-phys-v2", status: "active" },
    ],
    inbox_summary: {},
  };

  const ctx = await setupDay8To10Env(t, {
    stubHandler: async ({ method, url }) => {
      if (method === "POST" && url.includes("/integrations/v1/moly/reconciliation/snapshot")) {
        return { status: 200, body: { success: true, data: remoteSnapshot } };
      }
      return { status: 404, body: { success: false, code: "NOT_FOUND" } };
    },
  });

  const user = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, is_active, is_verified) VALUES ('v2owner@example.com', 'v2owner', 'V2 Owner', true, true) RETURNING *",
  )).rows[0];
  remoteSnapshot.identities[0].external_user_id = `moly:${user.id}`;

  const events = [
    {
      schemaVersion: "2.0",
      eventId: "csca-course:course:rc-phys-1:rev:1",
      idempotencyKey: "idem-course-rc-phys-1",
      sourceSystem: "csca-course",
      eventType: "course.upserted",
      aggregateType: "course",
      aggregateId: "rc-phys-1",
      revision: 1,
      deleted: false,
      sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
      payload: {
        courseId: "rc-phys-1",
        slug: "vat-ly-v2-sync",
        title: "Vat Ly CSCA Synced",
        subjectCode: "PHYSICS",
        level: "basic",
        isPublished: true,
      },
    },
    {
      schemaVersion: "2.0",
      eventId: "csca-course:profile:prof-phys-v2:rev:1",
      idempotencyKey: "idem-profile-prof-phys-v2",
      sourceSystem: "csca-course",
      eventType: "profile.upserted",
      aggregateType: "profile",
      aggregateId: "prof-phys-v2",
      revision: 1,
      deleted: false,
      sourceUpdatedAt: "2026-11-15T10:01:00.000Z",
      payload: {
        courseId: "rc-phys-1",
        profileId: "prof-phys-v2",
        mode: "INDEPENDENT",
        status: "active",
        allowFileDownload: true,
        deviceLimit: 2,
      },
    },
  ];
  const signed = signInboundBody({ events });
  const ingestRes = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signed.headers)
    .send(signed.rawBody);
  assert.equal(ingestRes.status, 202);
  assert.equal(ingestRes.body.data.accepted, 2);
  assert.ok(ingestRes.body.data.results.every((r) => r.inboxStatus === "processed"));

  const localCourse = (await ctx.db.query("SELECT * FROM courses WHERE remote_course_id = 'rc-phys-1'")).rows[0];
  assert.ok(localCourse);
  const profRow = (await ctx.db.query("SELECT * FROM course_profile_projections WHERE remote_profile_id = 'prof-phys-v2'")).rows[0];
  assert.equal(profRow.checkout_ready, false, "Catalog sync must NEVER auto-enable checkout_ready");

  const pkg = (await ctx.db.query(
    "INSERT INTO video_packages (name, status, price_vnd, duration_mode, duration_days, allowed_subjects) VALUES ('Phys Package', 'active', 299000, 'days', 90, ARRAY['PHYSICS']) RETURNING *",
  )).rows[0];
  await ctx.db.query("INSERT INTO video_package_courses (video_package_id, course_id) VALUES ($1, $2)", [pkg.id, localCourse.id]);

  // User owns via external grant targeting profile:prof-phys-v2
  await ctx.db.query(
    `INSERT INTO external_identities (source_system, external_user_id, user_id, status, link_method, source_updated_at)
     VALUES ('csca-course', 'cu-1', $1, 'active', 'sso', NOW())`,
    [user.id],
  );
  await ctx.db.query(
    `INSERT INTO external_entitlements (
       source_system, external_user_id, user_id, local_course_id, external_course_id,
       external_grant_id, status, valid_from, effective_owned, origin_system, source_updated_at
     ) VALUES (
       'csca-course', 'cu-1', $1, $2, 'profile:prof-phys-v2',
       'grant-v2-phys-1', 'active', NOW(), true, 'csca-course', NOW()
     )`,
    [user.id, localCourse.id],
  );

  const courseOwnershipMap = await ctx.ownership.evaluateCoursesForUser(user.id, [localCourse.id]);
  const ownedInfo = courseOwnershipMap.get(Number(localCourse.id));
  assert.equal(ownedInfo.owned, true);
  assert.equal(ownedInfo.canPurchase, false);
  assert.equal(ownedInfo.blockCode, "ALREADY_OWNED");
  assert.equal(ownedInfo.courseOfferingId, "profile:prof-phys-v2");

  const pkgOverlap = await ctx.ownership.evaluatePackageOwnership(user.id, { videoPackageId: pkg.id, courseIds: [localCourse.id] });
  assert.equal(pkgOverlap.blockCode, "ALREADY_OWNED");
  assert.deepEqual(pkgOverlap.externalOwnedCourseIds, [Number(localCourse.id)]);

  // Verify /hoc listExternalOnlyCourses surfaces profile_projection without picking pure container
  await withIsolatedModules(ctx.db, { runtimeOverrides: { ownership: ctx.ownership } }, async ({ learningRepository }) => {
    const extCourses = await learningRepository.listExternalOnlyCourses(user.id);
    assert.equal(extCourses.length, 1);
    assert.equal(Number(extCourses[0].id), Number(localCourse.id));
    assert.equal(extCourses[0].external_course_id, "profile:prof-phys-v2");
  });

  // Verify outbox resolveCourseMappingsForPurchase picks profile:prof-phys-v2 (ignores container)
  const mappingsForPkg = await ctx.outbox.resolveCourseMappingsForPurchase(ctx.db, {
    courseIds: [localCourse.id],
    videoPackageId: pkg.id,
  });
  assert.equal(mappingsForPkg.mappings.length, 1);
  assert.equal(mappingsForPkg.mappings[0].externalCourseId, "profile:prof-phys-v2");

  // Grant a local entitlement and verify dryRun reconciliation sees ZERO false missing_course_mapping
  const ent = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode)
     VALUES ($1, $2, 'v2-local-ent', 'manual', 'active', ARRAY['PHYSICS'], NOW(), 'lifetime') RETURNING id`,
    [user.id, pkg.id],
  )).rows[0];
  await ctx.db.query("INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, $2)", [ent.id, localCourse.id]);

  const reconRes = await ctx.reconciliation.runReconciliation({ dryRun: true, domains: ["entitlement"] });
  assert.equal(reconRes.summary.missing_course_mapping, 0);
  const plannedGrant = reconRes.actions.find((a) => a.category === "local_active_remote_missing");
  assert.ok(plannedGrant);
  assert.equal(plannedGrant.externalCourseId, "profile:prof-phys-v2");
});

test("Day 8 (2/4): checkout_ready lifecycle, videoAdminService saveProduct, courseService.enroll, payments /create, videoLearningAccess, and scoped refund", async (t) => {
  const ctx = await setupDay8To10Env(t, { applyFullVideoAdmin: true });
  const prevSalesFlag = process.env.CSCA_VIDEO_COMMERCE_ENABLED;
  process.env.CSCA_VIDEO_COMMERCE_ENABLED = "true";
  t.after(() => {
    if (prevSalesFlag === undefined) delete process.env.CSCA_VIDEO_COMMERCE_ENABLED;
    else process.env.CSCA_VIDEO_COMMERCE_ENABLED = prevSalesFlag;
  });

  const user = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, role, is_active, is_verified) VALUES ('buyer8@example.com', 'buyer8', 'Buyer 8', 'student', true, true) RETURNING *",
  )).rows[0];
  const adminUser = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, role, is_active, is_verified) VALUES ('admin8@example.com', 'admin8', 'Admin 8', 'admin', true, true) RETURNING *",
  )).rows[0];

  // Create synced csca_course + active profile projection + native course
  const cSynced = (await ctx.db.query(
    `INSERT INTO courses (slug, title, subject_code, level, access_type, price_vnd, status, content_origin, remote_source_system, remote_course_id, sync_revision)
     VALUES ('synced-chem', 'Synced Chem', 'CHEMISTRY', 'basic', 'package', 0, 'published', 'csca_course', 'csca-course', 'rc-chem-1', 1) RETURNING *`,
  )).rows[0];
  const cNative = (await ctx.db.query(
    `INSERT INTO courses (slug, title, subject_code, level, access_type, price_vnd, status, content_origin)
     VALUES ('native-chem', 'Native Chem', 'CHEMISTRY', 'basic', 'free', 0, 'published', 'moly_native') RETURNING *`,
  )).rows[0];
  const mProj = (await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status, origin_mode, remote_profile_id)
     VALUES ('csca-course', 'profile:prof-chem-1', $1, 'active', 'profile_projection', 'prof-chem-1') RETURNING *`,
    [cSynced.id],
  )).rows[0];
  const origTs = "2026-11-15T12:00:00.000Z";
  const profBefore = (await ctx.db.query(
    `INSERT INTO course_profile_projections (
       source_system, remote_course_id, remote_profile_id, external_offering_id, local_course_id,
       course_mapping_id, mode, status, checkout_ready, last_revision, source_updated_at
     ) VALUES ('csca-course', 'rc-chem-1', 'prof-chem-1', 'profile:prof-chem-1', $1, $2, 'INDEPENDENT', 'active', FALSE, 1, $3) RETURNING *`,
    [cSynced.id, mProj.id, origTs],
  )).rows[0];
  assert.equal(profBefore.checkout_ready, false);

  // Unpriced synced course cannot self-enroll
  await withIsolatedModules(ctx.db, {
    runtimeOverrides: { ownership: ctx.ownership, outbox: ctx.outbox },
    testUser: user,
  }, async ({ courseService }) => {
    await assert.rejects(
      courseService.enroll(cSynced.id, user),
      (err) => err.status === 422 && (err.errorCode === "PRICE_NOT_CONFIGURED" || err.code === "PRICE_NOT_CONFIGURED"),
    );
  });

  // Save active video package via real videoAdminService.saveProduct -> flips checkout_ready = TRUE without touching last_revision
  const paymentsMock = createVideoPaymentService({ db: ctx.db, gateway: {} });
  const videoAdmin = createVideoAdminService({
    db: ctx.db,
    repository: createVideoCommerceRepository(ctx.db),
    payments: paymentsMock,
    recalculateVip: async () => {},
  });
  const createdPkg = await videoAdmin.saveProduct("video", null, {
    name: "Chem Synced Pack",
    status: "active",
    priceVnd: 250000,
    durationMode: "days",
    durationDays: 60,
    allowedSubjects: ["CHEMISTRY"],
    courseIds: [cSynced.id],
    renewalMode: "new_period",
  }, adminUser.id);

  const profAfterSave = (await ctx.db.query("SELECT * FROM course_profile_projections WHERE id = $1", [profBefore.id])).rows[0];
  assert.equal(profAfterSave.checkout_ready, true);
  assert.equal(Number(profAfterSave.last_revision), 1);

  // Setting draft / unpriced flips checkout_ready back to FALSE
  await videoAdmin.saveProduct("video", createdPkg.id, {
    name: "Chem Synced Pack",
    status: "draft",
    priceVnd: 0,
    durationMode: "days",
    durationDays: 60,
    allowedSubjects: ["CHEMISTRY"],
    courseIds: [cSynced.id],
    renewalMode: "new_period",
  }, adminUser.id);
  const profAfterDraft = (await ctx.db.query("SELECT * FROM course_profile_projections WHERE id = $1", [profBefore.id])).rows[0];
  assert.equal(profAfterDraft.checkout_ready, false);

  // Re-activate package and test VIP overlap guard + courseService.enroll conflict guards + videoLearningAccess exclusion
  await videoAdmin.saveProduct("video", createdPkg.id, {
    name: "Chem Synced Pack",
    status: "active",
    priceVnd: 250000,
    durationMode: "days",
    durationDays: 60,
    allowedSubjects: ["CHEMISTRY"],
    courseIds: [cSynced.id],
    renewalMode: "new_period",
  }, adminUser.id);

  // Pending outbox triggers 409 PENDING_SYNC in both courseService.enroll and POST /api/payments/create
  const vipPkg = (await ctx.db.query(
    "INSERT INTO vip_packages (name, tier, price, duration_days, allowed_subjects, is_active) VALUES ('VIP Chem', 'vip', 500000, 90, ARRAY['CHEMISTRY'], true) RETURNING *",
  )).rows[0];
  await ctx.db.query("INSERT INTO course_package_access (course_id, package_id) VALUES ($1, $2)", [cSynced.id, vipPkg.id]);

  await ctx.db.query(
    `INSERT INTO integration_outbox (
       source_system, target_system, event_id, idempotency_key, event_type, aggregate_type, aggregate_id,
       payload, source_updated_at, status, user_id, external_course_id
     ) VALUES (
       'moly', 'csca-course', 'evt-pend-8', 'idem-pend-8', 'entitlement.granted', 'entitlement', 'moly:grant:tx_pend:course_${cSynced.id}',
       '{}'::jsonb, NOW(), 'pending', $1, 'profile:prof-chem-1'
     )`,
    [user.id],
  );

  await withIsolatedModules(ctx.db, {
    runtimeOverrides: { ownership: ctx.ownership, outbox: ctx.outbox },
    testUser: user,
  }, async ({ courseService, paymentsRouter }) => {
    await assert.rejects(
      courseService.enroll(cSynced.id, user),
      (err) => err.status === 409 && (err.errorCode === "PENDING_SYNC" || err.code === "PENDING_SYNC"),
    );

    const payApp = express();
    payApp.use(express.json());
    payApp.use("/api/payments", paymentsRouter);
    const payPendingRes = await request(payApp)
      .post("/api/payments/create")
      .send({ package_id: vipPkg.id, payment_method: "bank_transfer" });
    assert.equal(payPendingRes.status, 409);
    assert.equal(payPendingRes.body.code, "PENDING_SYNC");
  });

  // Switch pending -> external_entitlements active grant -> triggers 409 ALREADY_OWNED on payments /create and enroll
  await ctx.db.query("DELETE FROM integration_outbox WHERE user_id = $1", [user.id]);
  await ctx.db.query(
    `INSERT INTO external_entitlements (
       source_system, external_user_id, user_id, local_course_id, external_course_id,
       external_grant_id, status, valid_from, effective_owned, origin_system, source_updated_at
     ) VALUES (
       'csca-course', 'cu-chem', $1, $2, 'profile:prof-chem-1',
       'internal-management:grant-8', 'active', NOW(), true, 'internal-management', NOW()
     )`,
    [user.id, cSynced.id],
  );

  await withIsolatedModules(ctx.db, {
    runtimeOverrides: { ownership: ctx.ownership, outbox: ctx.outbox },
    testUser: user,
  }, async ({ courseService, paymentsRouter, videoLearningAccess }) => {
    await assert.rejects(
      courseService.enroll(cSynced.id, user),
      (err) => err.status === 409 && (err.errorCode === "ALREADY_OWNED" || err.code === "ALREADY_OWNED"),
    );

    const payApp = express();
    payApp.use(express.json());
    payApp.use("/api/payments", paymentsRouter);
    const payOwnedRes = await request(payApp)
      .post("/api/payments/create")
      .send({ package_id: vipPkg.id, payment_method: "bank_transfer" });
    assert.equal(payOwnedRes.status, 409);
    assert.equal(payOwnedRes.body.code, "ALREADY_OWNED");

    // Verify videoLearningAccess.syncEnrollments only inserts native course, never csca_course
    const localEnt = (await ctx.db.query(
      `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, duration_mode)
       VALUES ($1, $2, 'native-plus-synced', 'manual', 'active', ARRAY['CHEMISTRY'], NOW(), 'lifetime') RETURNING id`,
      [user.id, createdPkg.id],
    )).rows[0];
    await ctx.db.query(
      "INSERT INTO video_entitlement_courses (entitlement_id, course_id) VALUES ($1, $2), ($1, $3)",
      [localEnt.id, cSynced.id, cNative.id],
    );
    await videoLearningAccess.syncEnrollments(user.id);
    const enrollRows = (await ctx.db.query("SELECT course_id FROM course_enrollments WHERE user_id = $1", [user.id])).rows;
    assert.deepEqual(enrollRows.map((r) => Number(r.course_id)), [Number(cNative.id)]);
  });

  // Scoped refund only revokes the refunded Moly entitlement and leaves management grant untouched
  const entRefund = (await ctx.db.query(
    `INSERT INTO user_video_entitlements (user_id, video_package_id, grant_key, source, status, allowed_subjects, starts_at, revoked_at, reason, duration_mode)
     VALUES ($1, $2, 'refund-only', 'manual', 'revoked', ARRAY['CHEMISTRY'], NOW(), NOW(), 'refunded', 'lifetime') RETURNING id`,
    [user.id, createdPkg.id],
  )).rows[0];
  await ctx.outbox.enqueueEntitlementRevokeTx(ctx.db, {
    userId: user.id,
    entitlementId: entRefund.id,
    courseIds: [cSynced.id],
    reason: "refunded",
  });
  const revRows = (await ctx.db.query("SELECT * FROM integration_outbox WHERE entitlement_id = $1", [entRefund.id])).rows;
  assert.equal(revRows.length, 1);
  assert.equal(revRows[0].event_type, "entitlement.revoked");
  assert.equal(revRows[0].external_course_id, "profile:prof-chem-1");
  const mgmtStillActive = (await ctx.db.query(
    "SELECT status, effective_owned FROM external_entitlements WHERE external_grant_id = 'internal-management:grant-8'",
  )).rows[0];
  assert.equal(mgmtStillActive.status, "active");
  assert.equal(mgmtStillActive.effective_owned, true);
});

test("Day 9-10 (3/4): Split kill switches operate independently and dryRun diagnostics work under mutations_repair kill switch", async (t) => {
  const remoteRequests = [];
  const ctx = await setupDay8To10Env(t, {
    stubHandler: async ({ method, url }) => {
      const routePath = url.split("?")[0];
      remoteRequests.push(`${method} ${routePath}`);
      if (method === "GET" && routePath.includes("/integrations/v2/health")) {
        return { status: 200, body: { success: true, data: { status: "ok", contractVersion: "2.0" } } };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/learning/offerings/")) {
        return { status: 200, body: { success: true, data: { profileId: "p-1", units: [] } } };
      }
      if (method === "POST" && routePath.includes("/integrations/v1/moly/reconciliation/snapshot")) {
        return {
          status: 200,
          body: {
            success: true,
            data: { complete: true, identities: [], open_conflicts: [], entitlements: [], course_mappings: [], inbox_summary: {} },
          },
        };
      }
      return { status: 200, body: { success: true, data: {} } };
    },
  });

  // Default rollout posture checks
  const defaults = readRolloutPosture({});
  assert.equal(defaults.courseIntegrationWorkerEnabled, false);
  assert.equal(defaults.reconcileAutoRepairEnabled, false);
  assert.equal(defaults.catalogConsumerEnabled, false);
  assert.equal(defaults.delegatedLearningEnabled, false);
  assert.equal(defaults.courseCatalogSalesEnabled, false);

  // 1) Content sync kill switch pauses catalog/curriculum/ingest ONLY; delegated reads & health probe succeed
  ctx.runtimeEnv.COURSE_CONTENT_SYNC_DISABLED = "true";
  assert.deepEqual(getKillSwitchesSnapshot(ctx.runtimeEnv), {
    global: false,
    contentSync: true,
    delegatedLearning: false,
    mutationsRepair: false,
  });

  await assert.rejects(
    ctx.client.fetchCatalogCourses({ limit: 10 }),
    (err) => err.status === 503 && err.errorCode === "SYNC_KILL_SWITCH_ACTIVE",
  );
  const signedIngest = signInboundBody({ events: [] });
  const blockedIngestRes = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signedIngest.headers)
    .send(signedIngest.rawBody);
  assert.equal(blockedIngestRes.status, 503);
  assert.equal(blockedIngestRes.body.errorCode || blockedIngestRes.body.code, "SYNC_KILL_SWITCH_ACTIVE");

  const workspaceOk = await ctx.client.fetchDelegatedWorkspace({ profileId: "p-1", externalUserId: "moly:1" });
  assert.equal(workspaceOk.profileId, "p-1");
  const probeOk = await ctx.client.probeCourseContract();
  assert.equal(probeOk.contractVersion, "2.0");

  // 2) Delegated learning kill switch blocks delegated reads/mutations while allowing mutations/repair elsewhere
  ctx.runtimeEnv.COURSE_CONTENT_SYNC_DISABLED = "false";
  ctx.runtimeEnv.COURSE_DELEGATED_LEARNING_DISABLED = "true";
  await assert.rejects(
    ctx.client.fetchDelegatedWorkspace({ profileId: "p-1", externalUserId: "moly:1" }),
    (err) => err.status === 503 && err.errorCode === "DELEGATED_LEARNING_KILL_SWITCH_ACTIVE",
  );
  await assert.rejects(
    ctx.client.fetchPublicPreviewUnit({ profileId: "p-1", unitType: "lesson", remoteUnitId: "u-1" }),
    (err) => err.status === 503 && err.errorCode === "DELEGATED_LEARNING_KILL_SWITCH_ACTIVE",
  );

  // 3) Mutations/repair kill switch blocks write/repair mutations while ALLOWING dryRun:true reconciliation diagnostics & delegated reads
  ctx.runtimeEnv.COURSE_DELEGATED_LEARNING_DISABLED = "false";
  ctx.runtimeEnv.COURSE_MUTATIONS_REPAIR_DISABLED = "true";
  await assert.rejects(
    ctx.reconciliation.runReconciliation({ dryRun: false, domains: ["entitlement"] }),
    (err) => err.status === 503 && (err.errorCode === "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE" || err.code === "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE"),
  );
  const diagOk = await ctx.reconciliation.runReconciliation({ dryRun: true, domains: ["entitlement"] });
  assert.equal(diagOk.dryRun, true);
  assert.equal(diagOk.summary.mutations_repair_paused, true);
  assert.equal((await ctx.client.fetchDelegatedWorkspace({ profileId: "p-1", externalUserId: "moly:1" })).profileId, "p-1");
  const batchHalted = await ctx.outbox.processAvailableOutboxJobs({ limit: 5 });
  assert.equal(batchHalted.haltedByKillSwitch, true);
  assert.equal(batchHalted.killSwitchDomain, "mutations_repair");
  await assert.rejects(
    ctx.client.grantEntitlement({
      correlation_id: "corr-ks-grant",
      idempotency_key: "idem-ks-grant",
      external_grant_id: "moly:grant:tx_1:course_1",
      external_user_id: "moly:1",
      external_course_id: "profile:p-1",
    }),
    (err) => err.status === 503 && err.errorCode === "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE",
  );
});

test("Day 9-10 (4/4): 3-way drift repair, inbox/subject retry, /ops/overview, /ops/contract-probe, /health/integration, and idempotent migrations 076-082", async (t) => {
  let contentDriftRepaired = false;
  const ctx = await setupDay8To10Env(t, {
    stubHandler: async ({ method, url }) => {
      const routePath = url.split("?")[0];
      if (method === "GET" && routePath.includes("/integrations/v2/health")) {
        return {
          status: 200,
          body: {
            success: true,
            data: { status: "healthy", contractVersion: "2.0", apiKeyHint: "should-not-matter", hmacSecret: "SECRET_SHOULD_BE_STRIPPED" },
          },
        };
      }
      if (method === "POST" && routePath.includes("/integrations/v1/moly/reconciliation/snapshot")) {
        return {
          status: 200,
          body: {
            success: true,
            data: { complete: true, identities: [], open_conflicts: [], entitlements: [], course_mappings: [], inbox_summary: {} },
          },
        };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/reconciliation/content-state")) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              courses: [
                {
                  courseId: "rc-math-3",
                  revision: 2,
                  sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                  status: "published",
                  profiles: [
                    {
                      profileId: "prof-math-3",
                      courseId: "rc-math-3",
                      revision: 2,
                      sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                      status: "active",
                    },
                  ],
                },
              ],
              units: [
                {
                  profileId: "prof-math-3",
                  unitId: "u-m3-1",
                  unitType: "lesson",
                  revision: 2,
                  sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                  fileCount: 1,
                },
              ],
              files: [
                {
                  profileId: "prof-math-3",
                  unitId: "u-m3-1",
                  fileId: "f-m3-1",
                  revision: 1,
                  sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                },
              ],
            },
          },
        };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/catalog/courses/rc-math-3/curriculum")) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              course: { courseId: "rc-math-3", revision: 2 },
              profiles: [
                {
                  profileId: "prof-math-3",
                  courseId: "rc-math-3",
                  sections: [
                    {
                      sectionId: "sec-1",
                      title: "Chuong 1",
                      sortOrder: 0,
                    },
                  ],
                  units: [
                    {
                      unitId: "u-m3-1",
                      unitType: "lesson",
                      title: "Bai 1",
                      sortOrder: 0,
                      revision: 2,
                      sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                      files: [
                        {
                          fileId: "f-m3-1",
                          title: "Tai lieu 1",
                          mimeType: "application/pdf",
                          revision: 1,
                          sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                        },
                      ],
                    },
                  ],
                },
              ],
              pagination: { hasMore: false, nextCursor: null },
            },
          },
        };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/catalog/courses")) {
        contentDriftRepaired = true;
        return {
          status: 200,
          body: {
            success: true,
            data: {
              courses: [
                {
                  courseId: "rc-math-3",
                  revision: 2,
                  sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                  slug: "toan-sync-3",
                  title: "Toan Sync Updated",
                  subjectCode: "MATH",
                  level: "basic",
                  isPublished: true,
                  profiles: [
                    {
                      profileId: "prof-math-3",
                      courseId: "rc-math-3",
                      revision: 2,
                      sourceUpdatedAt: "2026-11-16T02:00:00.000Z",
                      mode: "INDEPENDENT",
                      status: "active",
                    },
                  ],
                },
              ],
              pagination: {
                hasMore: false,
                nextCursor: null,
                nextAfterRevision: 2,
                nextAfterId: 0,
                snapshotAnchorRevision: 2,
              },
            },
          },
        };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/reconciliation/learning-state")) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              progress: [
                {
                  profileId: "prof-math-3",
                  externalUserId: "cu-ler-3",
                  unitType: "lesson",
                  unitId: "u-m3-1",
                  watchedSeconds: 180,
                  lastPositionSeconds: 180,
                  completionPct: 90,
                  isVideoCompleted: true,
                  isUnitCompleted: true,
                  revision: 2,
                  sourceUpdatedAt: "2026-11-16T02:10:00.000Z",
                },
              ],
              assessments: [
                {
                  profileId: "prof-math-3",
                  externalUserId: "cu-ler-3",
                  unitType: "lesson",
                  unitId: "u-m3-1",
                  itemType: "quiz",
                  itemId: "q-1",
                  status: "graded",
                  attemptCount: 1,
                  score: 9,
                  maxScore: 10,
                  canViewSolution: true,
                  revision: 2,
                  sourceUpdatedAt: "2026-11-16T02:10:00.000Z",
                },
              ],
              notes: [
                {
                  profileId: "prof-math-3",
                  externalUserId: "cu-ler-3",
                  unitType: "lesson",
                  unitId: "u-m3-1",
                  noteId: "note-1",
                  timestampSeconds: 45,
                  content: "Important formula",
                  revision: 1,
                  sourceUpdatedAt: "2026-11-16T02:10:00.000Z",
                },
              ],
              bookmarks: [
                {
                  profileId: "prof-math-3",
                  externalUserId: "cu-ler-3",
                  unitType: "lesson",
                  unitId: "u-m3-1",
                  bookmarkId: "bm-1",
                  timestampSeconds: 60,
                  label: "Check here",
                  revision: 1,
                  sourceUpdatedAt: "2026-11-16T02:10:00.000Z",
                },
              ],
              qaThreads: [
                {
                  profileId: "prof-math-3",
                  externalUserId: "cu-ler-3",
                  unitType: "lesson",
                  unitId: "u-m3-1",
                  threadId: "qa-1",
                  title: "Question 1",
                  status: "answered",
                  messageCount: 2,
                  messages: [{ id: "m1", body: "Hi" }],
                  revision: 1,
                  sourceUpdatedAt: "2026-11-16T02:10:00.000Z",
                },
              ],
            },
          },
        };
      }
      return { status: 404, body: { success: false, code: "NOT_FOUND" } };
    },
  });

  const learner = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, is_active, is_verified) VALUES ('learner9@example.com', 'learner9', 'Learner 9', true, true) RETURNING *",
  )).rows[0];
  await ctx.db.query(
    "INSERT INTO external_identities (source_system, external_user_id, user_id, status, link_method, source_updated_at) VALUES ('csca-course', 'cu-ler-3', $1, 'active', 'sso', NOW())",
    [learner.id],
  );

  // Seed rev 1 course + profile locally so rev 2 triggers content & learning drift detection
  const cMath = (await ctx.db.query(
    `INSERT INTO courses (slug, title, subject_code, level, access_type, price_vnd, status, content_origin, remote_source_system, remote_course_id, sync_revision, source_updated_at)
     VALUES ('toan-sync-3', 'Toan Sync Old', 'MATH', 'basic', 'private', 0, 'published', 'csca_course', 'csca-course', 'rc-math-3', 1, '2026-11-15T10:00:00.000Z') RETURNING *`,
  )).rows[0];
  const mProf = (await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status, origin_mode, remote_profile_id)
     VALUES ('csca-course', 'profile:prof-math-3', $1, 'active', 'profile_projection', 'prof-math-3') RETURNING *`,
    [cMath.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO course_profile_projections (
       source_system, remote_course_id, remote_profile_id, external_offering_id, local_course_id,
       course_mapping_id, mode, status, checkout_ready, last_revision, source_updated_at
     ) VALUES ('csca-course', 'rc-math-3', 'prof-math-3', 'profile:prof-math-3', $1, $2, 'INDEPENDENT', 'active', FALSE, 1, '2026-11-15T10:00:00.000Z')`,
    [cMath.id, mProf.id],
  );

  // 1) Dry-run 3-way reconciliation via POST /reconcile
  const dryHttp = await request(ctx.app)
    .post("/api/admin/course-integrations/reconcile")
    .set("x-test-user", "1")
    .send({ dryRun: true, domains: ["entitlement", "content", "progress"], courseIds: ["rc-math-3"], profileIds: ["prof-math-3"] });
  assert.equal(dryHttp.status, 200);
  const drySummary = dryHttp.body.data.summary;
  assert.equal(drySummary.content_course_drift, 1);
  assert.equal(drySummary.content_profile_drift, 1);
  assert.equal(drySummary.content_unit_drift, 1);
  assert.equal(drySummary.content_file_drift, 1);
  assert.equal(drySummary.progress_unit_drift, 1);
  assert.equal(drySummary.progress_assessment_drift, 1);
  assert.equal(drySummary.progress_note_drift, 1);
  assert.equal(drySummary.progress_bookmark_drift, 1);
  assert.equal(drySummary.progress_qa_drift, 1);
  assert.equal(contentDriftRepaired, false);

  // 2) Live repair via POST /reconcile
  const repairHttp = await request(ctx.app)
    .post("/api/admin/course-integrations/reconcile")
    .set("x-test-user", "1")
    .send({ dryRun: false, domains: ["entitlement", "content", "progress"], courseIds: ["rc-math-3"], profileIds: ["prof-math-3"] });
  assert.equal(repairHttp.status, 200);
  const repairSummary = repairHttp.body.data.summary;
  assert.ok(repairSummary.repaired_content_courses >= 1);
  assert.ok(repairSummary.repaired_content_curriculum >= 1);
  assert.equal(repairSummary.repaired_progress, 1);
  assert.equal(repairSummary.repaired_assessments, 1);
  assert.equal(repairSummary.repaired_notes, 1);
  assert.equal(repairSummary.repaired_bookmarks, 1);
  assert.equal(repairSummary.repaired_qa_threads, 1);

  assert.equal((await ctx.db.query("SELECT completion_pct FROM course_progress_projections WHERE user_id = $1", [learner.id])).rows[0].completion_pct, "90.00");
  assert.equal((await ctx.db.query("SELECT COUNT(*)::int AS c FROM course_qa_thread_projections WHERE remote_thread_id = 'qa-1'")).rows[0].c, 1);

  // 3) Retry failed v2 inbox item via POST /catalog/inbox/:id/retry
  const failedInbox = (await ctx.db.query(
    `INSERT INTO moly_course_sync_inbox (
       source_system, schema_version, event_id, idempotency_key, event_type,
       aggregate_type, aggregate_id, aggregate_revision, payload_hash, payload,
       source_updated_at, status, attempt_count, last_error_code
     ) VALUES (
       'csca-course', '2.0', 'evt-retry-note', 'idem-retry-note', 'learning.note.upserted',
       'learning_note', 'note-2', 1, $1, $2::jsonb,
       '2026-11-16T03:00:00.000Z', 'failed', 2, 'TRANSIENT_ERR'
     ) RETURNING id`,
    [
      "a".repeat(64),
      JSON.stringify({
        profileId: "prof-math-3",
        externalUserId: "cu-ler-3",
        unitType: "lesson",
        unitId: "u-m3-1",
        noteId: "note-2",
        timestampSeconds: 99,
        content: "Retried note",
      }),
    ],
  )).rows[0];

  const retryInboxRes = await request(ctx.app)
    .post(`/api/admin/course-integrations/catalog/inbox/${failedInbox.id}/retry`)
    .set("x-test-user", "1")
    .send({});
  assert.equal(retryInboxRes.status, 200);
  assert.equal(retryInboxRes.body.data.retried, true);
  assert.equal(retryInboxRes.body.data.item.status, "processed");

  // 4) POST /ops/retry-subject + GET /ops/overview
  const retrySubjectRes = await request(ctx.app)
    .post("/api/admin/course-integrations/ops/retry-subject")
    .set("x-test-user", "1")
    .send({ userId: learner.id, externalUserId: "cu-ler-3", courseId: "rc-math-3", profileId: "prof-math-3", domains: ["progress"] });
  assert.equal(retrySubjectRes.status, 200);
  assert.equal(retrySubjectRes.body.data.target.userId, learner.id);
  assert.ok(Array.isArray(retrySubjectRes.body.data.domains));

  const overviewRes = await request(ctx.app)
    .get("/api/admin/course-integrations/ops/overview")
    .set("x-test-user", "1");
  assert.equal(overviewRes.status, 200);
  assert.ok(overviewRes.body.data.killSwitches);
  assert.ok(overviewRes.body.data.rolloutFlags);
  assert.ok(overviewRes.body.data.v2InboxCounts);
  assert.ok(Array.isArray(overviewRes.body.data.v2InboxAttentionItems));
  assert.ok(Array.isArray(overviewRes.body.data.checkpoints));
  assert.ok(overviewRes.body.data.latestReconciliationRun);
  assert.ok(overviewRes.body.data.driftMetrics);

  // 5) GET /ops/contract-probe + GET /health/integration (secret-free) + unmigrated 503 readiness
  const probeRes = await request(ctx.app)
    .get("/api/admin/course-integrations/ops/contract-probe")
    .set("x-test-user", "1");
  assert.equal(probeRes.status, 200);
  assert.equal(probeRes.body.data.healthy, true);
  assert.equal(probeRes.body.data.local.ready, true);
  assert.equal(probeRes.body.data.remote.reachable, true);
  assert.equal(probeRes.body.data.remote.contract.hmacSecret, undefined, "Secrets must never appear in probe output");
  const probeSerialized = JSON.stringify(probeRes.body);
  assert.equal(probeSerialized.includes(OUTBOUND_CFG.hmacSecret), false);
  assert.equal(probeSerialized.includes(OUTBOUND_CFG.serviceToken), false);

  const healthOk = await request(ctx.app).get("/health/integration");
  assert.equal(healthOk.status, 200);
  assert.equal(healthOk.body.ready, true);
  assert.equal(healthOk.body.migrations.missingTables.length, 0);
  assert.equal(JSON.stringify(healthOk.body).includes(OUTBOUND_CFG.hmacSecret), false);

  // Check unmigrated DB returns 503 not_ready with missing tables listed cleanly
  const unmigratedPg = new PGlite();
  t.after(async () => { await unmigratedPg.close(); });
  const unmigratedReadiness = await collectIntegrationReadiness({ db: makeDbAdapter(unmigratedPg), env: ctx.runtimeEnv });
  assert.equal(unmigratedReadiness.ready, false);
  assert.equal(unmigratedReadiness.migrations.missingTables.length, INTEGRATION_TABLES.length);
  const probeUnmigrated = await runContractProbe({ db: makeDbAdapter(unmigratedPg), client: ctx.client, env: ctx.runtimeEnv });
  assert.equal(probeUnmigrated.healthy, false);

  // 6) Migrations 076-082 rerun idempotently without losing existing rows
  await applyCourseIntegrationMigration(ctx.db);
  const stillProcessed = (await ctx.db.query("SELECT status FROM moly_course_sync_inbox WHERE id = $1", [failedInbox.id])).rows[0];
  assert.equal(stillProcessed.status, "processed");
});

test("Day 8-10 (Wire Parity): reconcileContentDomain & reconcileProgressDomain understand native CSCA-Course syncRevision/sequentialUnitCompletions/quizAttempts/externalUserIds shapes", async (t) => {
  const ctx = await setupDay8To10Env(t, {
    stubHandler: async ({ method, url }) => {
      const routePath = url.split("?")[0];
      if (method === "GET" && routePath.includes("/integrations/v2/reconciliation/content-state")) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              courses: [
                {
                  courseId: "rc-wire-1",
                  syncRevision: 4,
                  isPublished: true,
                  deleted: false,
                  updatedAt: "2026-11-16T04:00:00.000Z",
                  activeLessonCount: 2,
                },
              ],
              profiles: [
                {
                  profileId: "prof-wire-1",
                  courseId: "rc-wire-1",
                  syncRevision: 4,
                  status: "active",
                  deleted: false,
                  activeUnitCount: 2,
                  activeFilePlacementCount: 1,
                  updatedAt: "2026-11-16T04:00:00.000Z",
                },
              ],
            },
          },
        };
      }
      if (method === "GET" && routePath.includes("/integrations/v2/reconciliation/learning-state")) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              checkedAt: "2026-11-16T04:05:00.000Z",
              videoWatchProgress: [
                {
                  id: "vwp-1",
                  userId: "9991",
                  externalUserIds: ["moly:2"],
                  courseId: "rc-wire-1",
                  lessonId: "u-w-1",
                  lastPositionSeconds: 210,
                  watchedSeconds: 210,
                  completionPercent: 100,
                  isCompleted: true,
                  syncRevision: 3,
                  updatedAt: "2026-11-16T04:05:00.000Z",
                },
              ],
              sequentialUnitCompletions: [
                {
                  userId: "9991",
                  externalUserIds: ["moly:2"],
                  courseId: "rc-wire-1",
                  profileId: "prof-wire-1",
                  courseCompletionPct: 50,
                  units: [
                    {
                      unitId: "u-w-1",
                      unitType: "lesson",
                      isCompleted: true,
                      isVideoCompleted: true,
                      isQuizCompleted: true,
                      isLocked: false,
                      progressPercent: 100,
                    },
                  ],
                },
              ],
              quizAttempts: [
                {
                  id: "qa-att-1",
                  quizId: "qz-w-1",
                  courseId: "rc-wire-1",
                  lessonId: "u-w-1",
                  userId: "9991",
                  externalUserIds: ["moly:2"],
                  profileId: "prof-wire-1",
                  attemptNumber: 2,
                  status: "graded",
                  score: 10,
                  maxScore: 10,
                  syncRevision: 3,
                  updatedAt: "2026-11-16T04:05:00.000Z",
                },
              ],
              assignmentSubmissions: [
                {
                  id: "sub-w-1",
                  assignmentId: "asg-w-1",
                  courseId: "rc-wire-1",
                  lessonId: "u-w-1",
                  userId: "9991",
                  externalUserIds: ["moly:2"],
                  profileId: "prof-wire-1",
                  status: "graded",
                  revision: 2,
                  syncRevision: 2,
                  latestScore: 9,
                  gradedAt: "2026-11-16T04:05:00.000Z",
                },
              ],
              notes: [
                {
                  id: "note-w-1",
                  userId: "9991",
                  externalUserIds: ["moly:2"],
                  courseId: "rc-wire-1",
                  lessonId: "u-w-1",
                  timestampSeconds: 15,
                  content: "Wire note",
                  revision: 2,
                  updatedAt: "2026-11-16T04:05:00.000Z",
                },
              ],
              bookmarks: [],
              qaThreads: [],
            },
          },
        };
      }
      return { status: 404, body: { success: false, code: "NOT_FOUND" } };
    },
  });

  const learner = (await ctx.db.query(
    "INSERT INTO users (id, email, username, full_name, is_active, is_verified) VALUES (2, 'wire@example.com', 'wire2', 'Wire Learner', true, true) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username RETURNING *",
  )).rows[0];
  const cWire = (await ctx.db.query(
    `INSERT INTO courses (slug, title, subject_code, level, access_type, price_vnd, status, content_origin, remote_source_system, remote_course_id, sync_revision, source_updated_at)
     VALUES ('wire-1', 'Wire Course', 'MATH', 'basic', 'private', 0, 'published', 'csca_course', 'csca-course', 'rc-wire-1', 1, '2026-11-15T10:00:00.000Z') RETURNING *`,
  )).rows[0];
  const mWire = (await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status, origin_mode, remote_profile_id)
     VALUES ('csca-course', 'profile:prof-wire-1', $1, 'active', 'profile_projection', 'prof-wire-1') RETURNING *`,
    [cWire.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO course_profile_projections (
       source_system, remote_course_id, remote_profile_id, external_offering_id, local_course_id,
       course_mapping_id, mode, status, checkout_ready, last_revision, source_updated_at
     ) VALUES ('csca-course', 'rc-wire-1', 'prof-wire-1', 'profile:prof-wire-1', $1, $2, 'INDEPENDENT', 'active', FALSE, 1, '2026-11-15T10:00:00.000Z')`,
    [cWire.id, mWire.id],
  );

  // Run dry-run on content (must detect syncRevision 4 > local 1 AND activeUnitCount 2 != 0)
  const dryContent = await ctx.reconciliation.runReconciliation({
    dryRun: true,
    domains: ["content", "progress"],
    courseIds: ["rc-wire-1"],
    profileIds: ["prof-wire-1"],
  });
  assert.equal(dryContent.summary.content_course_drift, 1);
  assert.equal(dryContent.summary.content_profile_drift, 1);
  assert.equal(dryContent.summary.content_unit_drift, 1);
  assert.equal(dryContent.summary.content_file_drift, 1);
  assert.equal(dryContent.summary.progress_unit_drift, 1);
  assert.equal(dryContent.summary.progress_assessment_drift, 2); // quizAttempts + assignmentSubmissions
  assert.equal(dryContent.summary.progress_note_drift, 1); // resolved profile via courseId!

  // Repair progress projections & confirm rows materialized for moly user #2
  const repairProg = await ctx.reconciliation.runReconciliation({
    dryRun: false,
    domains: ["progress"],
    courseIds: ["rc-wire-1"],
    profileIds: ["prof-wire-1"],
  });
  assert.equal(repairProg.summary.repaired_progress, 1);
  assert.equal(repairProg.summary.repaired_assessments, 2);
  assert.equal(repairProg.summary.repaired_notes, 1);

  const progRow = (await ctx.db.query("SELECT completion_pct, watched_seconds, is_quiz_completed FROM course_progress_projections WHERE user_id = $1", [learner.id])).rows[0];
  assert.equal(progRow.completion_pct, "100.00");
  assert.equal(Number(progRow.watched_seconds), 210);
  assert.equal(progRow.is_quiz_completed, true);

  const noteRow = (await ctx.db.query("SELECT content FROM course_note_projections WHERE remote_note_id = 'note-w-1'")).rows[0];
  assert.equal(noteRow.content, "Wire note");
});

test("Commerce & manual grant regression: brand-new Moly buyer and manual grants sync to CSCA-Course and surface on /hoc (pending_sync & owned)", async (t) => {
  const ctx = await setupDay8To10Env(t, { applyFullVideoAdmin: true });
  const prevSalesFlag = process.env.CSCA_VIDEO_COMMERCE_ENABLED;
  process.env.CSCA_VIDEO_COMMERCE_ENABLED = "true";
  t.after(() => {
    if (prevSalesFlag === undefined) delete process.env.CSCA_VIDEO_COMMERCE_ENABLED;
    else process.env.CSCA_VIDEO_COMMERCE_ENABLED = prevSalesFlag;
  });

  const buyer = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, is_active, is_verified) VALUES ('newbuyer@moly.test', 'newbuyer', 'New Moly Buyer', true, true) RETURNING *",
  )).rows[0];
  const directUser = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, is_active, is_verified) VALUES ('directgrant@moly.test', 'directgrant', 'Direct Grant User', true, true) RETURNING *",
  )).rows[0];
  const adminActor = (await ctx.db.query(
    "INSERT INTO users (email, username, full_name, role, is_active, is_verified) VALUES ('adm-reg@moly.test', 'admreg', 'Admin Reg', 'admin', true, true) RETURNING *",
  )).rows[0];

  const cTtxh = (await ctx.db.query(
    `INSERT INTO courses (slug, title, subject_code, level, access_type, price_vnd, status, content_origin, remote_source_system, remote_course_id)
     VALUES ('khoa-hoc-record-ttxh', 'Khóa học record TTXH', 'CHINESE_SOC', 'basic', 'package', 888000, 'published', 'csca_course', 'csca-course', '4') RETURNING *`,
  )).rows[0];
  const mapRow = (await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status, origin_mode, remote_course_id, remote_profile_id)
     VALUES ('csca-course', 'fe99d3a784614ac693328b97d49945e0', $1, 'active', 'profile_projection', '4', '2') RETURNING *`,
    [cTtxh.id],
  )).rows[0];
  const profRow = (await ctx.db.query(
    `INSERT INTO course_profile_projections (
       source_system, remote_course_id, remote_profile_id, external_offering_id, local_course_id,
       course_mapping_id, mode, status, checkout_ready, last_revision, source_updated_at
     ) VALUES ('csca-course', '4', '2', 'fe99d3a784614ac693328b97d49945e0', $1, $2, 'MIRROR', 'active', TRUE, 1, NOW()) RETURNING *`,
    [cTtxh.id, mapRow.id],
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, unit_type, remote_unit_id,
       title, sort_order, is_published, last_revision, source_updated_at
     ) VALUES ($1, $2, 'class_session', '101', 'Buổi 1 TTXH', 1, TRUE, 1, NOW())`,
    [profRow.id, cTtxh.id],
  );

  const { createVideoCommerceRepository } = require("../src/repositories/videoCommerceRepository");
  const { createVideoAdminService } = require("../src/services/videoAdminService");
  const { createCourseEnrollmentAdminService } = require("../src/services/courseEnrollmentAdminService");
  const repository = createVideoCommerceRepository(ctx.db);
  const fakePayments = { productSnapshot: async () => ({ originalAmount: 888000 }) };
  const videoAdmin = createVideoAdminService({
    db: ctx.db,
    repository,
    payments: fakePayments,
    recalculateVip: async () => {},
    sendRightsEmail: async () => ({ sent: true }),
    salesEnabled: () => true,
    courseOutbox: ctx.outbox,
    courseOwnership: ctx.ownership,
  });

  const pkg = await videoAdmin.saveProduct(
    "video",
    null,
    {
      name: "Khóa học record TTXH",
      description: "Gói TTXH",
      status: "active",
      priceVnd: 888000,
      durationMode: "lifetime",
      durationDays: null,
      allowedSubjects: ["CHINESE_SOC"],
      requiresSubjectChoice: false,
      courseIds: [cTtxh.id],
      renewalMode: "new_period",
    },
    adminActor.id,
  );

  // 1) Manual grant via videoAdminService.grant enqueues user.provisioned + entitlement.granted
  const granted = await videoAdmin.grant(
    {
      type: "video",
      productId: pkg.id,
      userId: buyer.id,
      videoExpiresAt: null,
      reason: "Cấp quyền học viên đăng ký qua chuyển khoản",
      requestKey: "reg_manual_grant_ttxh_001",
    },
    adminActor.id,
  );
  assert.ok(granted.id > 0);

  const outboxRows = (await ctx.db.query(
    "SELECT event_type, status, external_course_id, external_grant_id FROM integration_outbox WHERE user_id = $1 ORDER BY id ASC",
    [buyer.id],
  )).rows;
  assert.equal(outboxRows.length, 2);
  assert.equal(outboxRows[0].event_type, "user.provisioned");
  assert.equal(outboxRows[1].event_type, "entitlement.granted");
  assert.equal(outboxRows[1].external_course_id, "fe99d3a784614ac693328b97d49945e0");
  assert.equal(outboxRows[1].external_grant_id, `moly:grant:ent_${granted.id}:course_${cTtxh.id}`);

  // 2) Immediately after payment/grant (while outbox is still pending_sync), /hoc surfaces the course!
  await withIsolatedModules(ctx.db, { runtimeOverrides: { ownership: ctx.ownership, outbox: ctx.outbox } }, async ({ learningService }) => {
    const pendingItems = await learningService.listMyEnrollments({ id: buyer.id, role: "student" });
    assert.equal(pendingItems.length, 1);
    assert.equal(Number(pendingItems[0].course.id), Number(cTtxh.id));
    assert.equal(pendingItems[0].course.ownershipStatus, "pending_sync");

    // Once outbox events are marked processed by CSCA-Course, /hoc shows owned & canLaunchCourse!
    await ctx.db.query(
      "UPDATE integration_outbox SET status = 'sent', remote_status = 'processed', remote_processed_at = NOW() WHERE user_id = $1",
      [buyer.id],
    );
    const syncedItems = await learningService.listMyEnrollments({ id: buyer.id, role: "student" });
    assert.equal(syncedItems.length, 1);
    assert.equal(syncedItems[0].course.ownershipStatus, "owned");
    assert.equal(syncedItems[0].course.canLaunchCourse, true);
    assert.match(syncedItems[0].course.firstUnitHref, /^\/hoc\/khoa-hoc-record-ttxh\/bai-hoc\/u-\d+\?profileId=2$/);
  });

  // 3) Direct course enrollment grant & revoke via courseEnrollmentAdminService also enqueues provision/grant & revoke
  const enrollmentAdmin = createCourseEnrollmentAdminService({ database: ctx.db, courseOutbox: ctx.outbox });
  const directRes = await enrollmentAdmin.grantCourseEnrollments(cTtxh.id, {
    userIds: [directUser.id],
    durationDays: 90,
  });
  assert.equal(directRes.grantedCount, 1);

  const directOutbox = (await ctx.db.query(
    "SELECT event_type, external_course_id FROM integration_outbox WHERE user_id = $1 ORDER BY id ASC",
    [directUser.id],
  )).rows;
  assert.equal(directOutbox.length, 2);
  assert.equal(directOutbox[0].event_type, "user.provisioned");
  assert.equal(directOutbox[1].event_type, "entitlement.granted");
  assert.equal(directOutbox[1].external_course_id, "fe99d3a784614ac693328b97d49945e0");

  const enrRow = (await ctx.db.query("SELECT id FROM course_enrollments WHERE user_id = $1 AND course_id = $2", [directUser.id, cTtxh.id])).rows[0];
  await enrollmentAdmin.revokeCourseEnrollment(cTtxh.id, enrRow.id);
  const directRevoke = (await ctx.db.query(
    "SELECT event_type, external_course_id FROM integration_outbox WHERE user_id = $1 AND event_type = 'entitlement.revoked'",
    [directUser.id],
  )).rows;
  assert.equal(directRevoke.length, 1);
  assert.equal(directRevoke[0].external_course_id, "fe99d3a784614ac693328b97d49945e0");
});
