const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const request = require("supertest");
const { PGlite } = require("@electric-sql/pglite");

const { applyMigration } = require("../scripts/apply_course_integration_migration");
const { createCourseIntegrationClient } = require("../src/services/courseIntegrationClient");
const { createMolyCourseCatalogSyncService } = require("../src/services/molyCourseCatalogSyncService");
const { createCourseIntegrationV2Routes } = require("../src/routes/courseIntegrationV2Routes");
const { createCourseIntegrationAdminRoutes } = require("../src/routes/courseIntegrationAdminRoutes");
const { createVideoPaymentService } = require("../src/services/videoPaymentService");
const database = require("../src/config/database");
const courseService = require("../src/services/courseService");

const INBOUND_CFG = {
  serviceToken: "moly-v2-inbound-secret",
  integrationKey: "csca-course-v2",
  hmacSecret: "moly-v2-hmac-secret",
};

const OUTBOUND_CFG = {
  baseUrl: "",
  serviceToken: "course-v2-outbound-secret",
  integrationKey: "moly-studio-v2",
  hmacSecret: "course-v2-hmac-secret",
  timeoutMs: 4000,
  maxTransportAttempts: 1,
};

const migrationSql = (name) =>
  fs.readFileSync(path.join(__dirname, "../../database/migrations", name), "utf8");

function makeDbAdapter(pg) {
  return {
    pool: {
      connect: async () => ({
        query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
        release: () => {},
      }),
      query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
    },
    query: (sql, params) => (params ? pg.query(sql, params) : pg.query(sql)),
    transaction: async (fn) => pg.transaction(fn),
  };
}

function buildInboundHeaders(rawBody, {
  cfg = INBOUND_CFG,
  timestamp = new Date().toISOString(),
  correlationId = "corr-moly-day2",
  signatureOverride = null,
} = {}) {
  const sigHex = crypto
    .createHmac("sha256", cfg.hmacSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), Buffer.from(rawBody, "utf8")]))
    .digest("hex");
  return {
    Authorization: `Bearer ${cfg.serviceToken}`,
    "X-Integration-Key": cfg.integrationKey,
    "X-Event-Timestamp": timestamp,
    "X-Correlation-ID": correlationId,
    "X-Signature": signatureOverride || `sha256=${sigHex}`,
    "Content-Type": "application/json",
  };
}

function verifyCourseGetSignature(req, { cfg = OUTBOUND_CFG } = {}) {
  const auth = String(req.get("Authorization") || "");
  if (auth !== `Bearer ${cfg.serviceToken}`) return false;
  if (req.get("X-Integration-Key") !== cfg.integrationKey) return false;
  const ts = req.get("X-Event-Timestamp") || "";
  const canonical = `GET\n${req.originalUrl || req.url}`;
  const expected = `sha256=${crypto
    .createHmac("sha256", cfg.hmacSecret)
    .update(Buffer.from(`${ts}.${canonical}`, "utf8"))
    .digest("hex")}`;
  return String(req.get("X-Signature") || "").toLowerCase() === expected.toLowerCase();
}

async function setupMolyCatalogDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name TEXT,
      password VARCHAR(255) NOT NULL DEFAULT 'hashed',
      role VARCHAR(20) DEFAULT 'student',
      coins INTEGER DEFAULT 0,
      is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',
      vip_expires_at TIMESTAMPTZ,
      vip_package_id INTEGER,
      vip_allowed_subjects TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL DEFAULT 'tok',
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE permissions (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT
    );
    CREATE TABLE roles (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE materials (id SERIAL PRIMARY KEY);
    CREATE TABLE vip_packages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      tier TEXT DEFAULT 'vip',
      allowed_subjects TEXT[],
      requires_subject_choice BOOLEAN DEFAULT FALSE,
      price INTEGER,
      duration_days INTEGER,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      package_id INTEGER REFERENCES vip_packages(id),
      amount BIGINT NOT NULL CHECK (amount >= 0),
      payment_method TEXT,
      package_duration INTEGER NOT NULL DEFAULT 30,
      package_name VARCHAR(100) NOT NULL DEFAULT 'pkg',
      transaction_code TEXT UNIQUE,
      status TEXT,
      payment_channel TEXT,
      trans_id TEXT,
      raw_response JSONB,
      paid_at TIMESTAMPTZ,
      vip_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE coupons (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      description TEXT,
      created_by INTEGER REFERENCES users(id),
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
      applicable_tiers TEXT[] DEFAULT ARRAY['all']
    );
    CREATE TABLE coupon_usages (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER REFERENCES coupons(id),
      user_id INTEGER REFERENCES users(id),
      transaction_id INTEGER REFERENCES transactions(id),
      discount_amount INTEGER,
      final_amount INTEGER,
      original_amount INTEGER
    );
    CREATE TABLE coin_ledger (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER,
      amount INTEGER,
      balance_after INTEGER,
      source TEXT,
      description TEXT,
      metadata JSONB,
      idempotency_key TEXT UNIQUE
    );
    CREATE TABLE user_vip_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      package_id INTEGER,
      transaction_id INTEGER,
      tier TEXT,
      allowed_subjects TEXT[],
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      source TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
  `);

  await pg.exec(migrationSql("052_csca_courses_core.sql"));
  await pg.exec(migrationSql("053_csca_course_progress.sql"));
  await pg.exec(migrationSql("055_csca_course_package_access.sql"));
  await pg.exec(migrationSql("057_course_assignments.sql"));
  await pg.exec(migrationSql("058_course_lesson_questions.sql"));
  await pg.exec(migrationSql("067_video_commerce_foundation.sql"));
  await pg.exec(migrationSql("068_video_commerce_payments.sql"));
  await pg.exec(migrationSql("069_video_commerce_admin.sql"));
  await pg.exec(migrationSql("072_paid_device_policy.sql"));

  const adapter = makeDbAdapter(pg);
  await applyMigration({
    query: async (sql, values) => (values !== undefined ? pg.query(sql, values) : (await pg.exec(sql)).at(-1)),
  });
  return { pg, db: adapter };
}

function makeCourseEnvelope({
  eventId,
  eventType = "course.upserted",
  courseId = "101",
  revision = 1,
  slug = "toan-csca-2026",
  title = "Toán CSCA Tổng Ôn 2026",
  description = "<p>Lộ trình Toán CSCA chuyên sâu.</p>",
  subjectCode = "MATH",
  level = "intermediate",
  thumbnailUrl = "https://cdn.csca.local/math-2026.png",
  priceVnd,
  isFree,
  isPublished = true,
  deleted = false,
  deletedAt = null,
  sourceUpdatedAt = "2026-11-15T10:00:00.000Z",
  instructor = { id: "7", displayName: "Thầy Minh Toán", avatarUrl: "https://cdn.csca.local/t.png", headline: "Thủ khoa Sư Phạm" },
  profiles = [],
}) {
  return {
    schemaVersion: "2.0",
    eventId: eventId || `csca-course:course:${courseId}:rev:${revision}`,
    idempotencyKey: `csca-course:course:${courseId}:rev:${revision}`,
    eventType,
    sourceSystem: "csca-course",
    aggregateType: "course",
    aggregateId: String(courseId),
    revision,
    deleted,
    deletedAt,
    sourceUpdatedAt,
    occurredAt: sourceUpdatedAt,
    correlationId: `corr-${courseId}-${revision}`,
    payload: {
      courseId: String(courseId),
      revision,
      slug,
      title,
      description,
      thumbnailUrl,
      category: subjectCode,
      subjectCode,
      level,
      ...(priceVnd === undefined ? {} : { priceVnd }),
      ...(isFree === undefined ? {} : { isFree }),
      isPublished: !deleted && isPublished,
      totalLessons: 18,
      instructor,
      deleted,
      deletedAt,
      sourceUpdatedAt,
      profiles,
    },
  };
}

describe("Day 2 Moly Studio Catalog Sync v2, Backfill, Legacy Protection, and Unpriced Checkout Block", () => {
  test("POST /api/integrations/v2/events/ingest handles valid 1:N offerings, duplicate idempotency, conflict 409, stale events, and kill switch", async (t) => {
    const { pg, db } = await setupMolyCatalogDb();
    t.after(() => pg.close());

    let envState = {};
    const catalogSync = createMolyCourseCatalogSyncService({
      db,
      env: new Proxy({}, { get: (_t, prop) => envState[prop] }),
    });

    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
    app.use("/api/integrations/v2", createCourseIntegrationV2Routes({
      catalogSync,
      inboundConfig: INBOUND_CFG,
      env: new Proxy({}, { get: (_t, prop) => envState[prop] }),
    }));

    const eventV5 = makeCourseEnvelope({
      courseId: "101",
      revision: 5,
      profiles: [
        {
          profileId: "501",
          externalOfferingId: "CLS-101-MIRROR",
          courseId: "101",
          mode: "MIRROR",
          managementClassId: "CLS-101-MIRROR",
          sourceLiveClassId: "88",
          allowFileDownload: true,
          deviceLimit: 2,
          enforceTrustedDevices: true,
          badgeLabel: "Bản ghi lớp Live",
          status: "active",
          revision: 5,
          deleted: false,
          sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        },
        {
          profileId: "502",
          externalOfferingId: "CLS-101-INDEP",
          courseId: "101",
          mode: "INDEPENDENT",
          managementClassId: "CLS-101-INDEP",
          sourceLiveClassId: null,
          allowFileDownload: false,
          deviceLimit: 3,
          enforceTrustedDevices: true,
          badgeLabel: "Khóa video độc lập",
          status: "active",
          revision: 6,
          deleted: false,
          sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        },
      ],
    });

    // Reject tampered signature
    const raw1 = JSON.stringify(eventV5);
    await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(raw1, { signatureOverride: `sha256=${"0".repeat(64)}` }))
      .send(raw1)
      .expect(401);

    // Valid ingest
    const res1 = await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(raw1))
      .send(raw1)
      .expect(202);
    assert.equal(res1.body.data.accepted, 1);
    assert.equal(res1.body.data.results[0].action, "inserted");
    assert.equal(res1.body.data.results[0].profiles.length, 2);

    const coursesRows = (await pg.query(`SELECT * FROM courses WHERE remote_course_id = '101'`)).rows;
    assert.equal(coursesRows.length, 1);
    assert.equal(coursesRows[0].content_origin, "csca_course");
    assert.equal(coursesRows[0].access_type, "private");
    assert.equal(Number(coursesRows[0].price_vnd), 0);
    assert.equal(coursesRows[0].status, "published");

    const projRows = (await pg.query(`SELECT * FROM course_profile_projections ORDER BY id ASC`)).rows;
    assert.equal(projRows.length, 2);
    assert.deepEqual(projRows.map((p) => p.mode), ["MIRROR", "INDEPENDENT"]);
    assert.equal(projRows[0].checkout_ready, false);
    assert.equal(projRows[1].device_limit, 3);
    assert.equal(projRows[1].allow_file_download, false);

    // Identical duplicate replay -> deduplicated
    const resDup = await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(raw1))
      .send(raw1)
      .expect(202);
    assert.equal(resDup.body.data.results[0].deduplicated, true);

    // Same eventId/idempotencyKey with mutated payload -> 409 IDEMPOTENCY_CONFLICT
    const mutatedDup = makeCourseEnvelope({ courseId: "101", revision: 5, title: "Tampered Title" });
    const rawMut = JSON.stringify(mutatedDup);
    const res409 = await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(rawMut))
      .send(rawMut)
      .expect(409);
    assert.equal(res409.body.code, "IDEMPOTENCY_CONFLICT");

    // Stale lower revision arrives out-of-order -> ignored cleanly without regression
    const staleEv = makeCourseEnvelope({ courseId: "101", revision: 2, title: "Old Outdated Title" });
    const rawStale = JSON.stringify(staleEv);
    const resStale = await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(rawStale))
      .send(rawStale)
      .expect(202);
    assert.equal(resStale.body.data.results[0].action, "stale");
    assert.equal(resStale.body.data.results[0].inboxStatus, "stale");
    assert.equal((await pg.query(`SELECT title, sync_revision FROM courses WHERE id = $1`, [coursesRows[0].id])).rows[0].title, "Toán CSCA Tổng Ôn 2026");

    // Kill switch blocks ingestion with 503
    envState.COURSE_CATALOG_SYNC_DISABLED = "true";
    const ksEv = makeCourseEnvelope({ courseId: "102", revision: 1 });
    const rawKs = JSON.stringify(ksEv);
    const resKs = await request(app)
      .post("/api/integrations/v2/events/ingest")
      .set(buildInboundHeaders(rawKs))
      .send(rawKs)
      .expect(503);
    assert.equal(resKs.body.errorCode, "SYNC_KILL_SWITCH_ACTIVE");
  });

  test("Resumable >2,000-record backfill checkpoints mid-run, converges concurrent mutations, and finishes idle via admin route", async (t) => {
    const { pg, db } = await setupMolyCatalogDb();
    t.after(() => pg.close());

    // Build mock CSCA-Course export dataset (2,080 courses across 5 pages of limit=500)
    const total = 2080;
    const remoteCatalog = Array.from({ length: total }, (_, idx) => {
      const n = idx + 1;
      return {
        courseId: String(n),
        revision: n,
        slug: `csca-sync-course-${n}`,
        title: `CSCA Synced Course #${n}`,
        description: `Content ${n}`,
        thumbnailUrl: `https://cdn.csca.local/c-${n}.png`,
        category: n % 2 === 0 ? "PHYSICS" : "MATH",
        subjectCode: n % 2 === 0 ? "PHYSICS" : "MATH",
        level: "basic",
        isPublished: true,
        totalLessons: 12,
        instructor: { id: "9", displayName: "GV Trần Khoa", avatarUrl: null, headline: "CSCA" },
        deleted: false,
        deletedAt: null,
        sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        profiles: n <= 5
          ? [{
              profileId: `90${n}`,
              externalOfferingId: `OFF-${n}`,
              courseId: String(n),
              mode: "INDEPENDENT",
              managementClassId: `OFF-${n}`,
              allowFileDownload: false,
              deviceLimit: 2,
              enforceTrustedDevices: true,
              badgeLabel: "Khóa video độc lập",
              status: "active",
              revision: n,
              deleted: false,
              sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
            }]
          : [],
      };
    });

    const remoteApp = express();
    remoteApp.get("/api/integrations/v2/catalog/courses", (req, res) => {
      if (!verifyCourseGetSignature(req)) {
        return res.status(401).json({ success: false, errorCode: "INVALID_SIGNATURE" });
      }
      const limit = Math.min(Number(req.query.limit || 500), 500);
      let afterRev = Number(req.query.afterRevision || 0);
      let afterId = Number(req.query.afterId || 0);
      if (req.query.cursor) {
        const dec = JSON.parse(Buffer.from(String(req.query.cursor), "base64url").toString("utf8"));
        afterRev = Number(dec.r || 0);
        afterId = Number(dec.i || 0);
      }
      const sorted = [...remoteCatalog].sort((a, b) => (a.revision - b.revision) || (Number(a.courseId) - Number(b.courseId)));
      const filtered = sorted.filter((c) => c.revision > afterRev || (c.revision === afterRev && Number(c.courseId) > afterId));
      const slice = filtered.slice(0, limit);
      const hasMore = filtered.length > limit;
      const last = slice[slice.length - 1] || null;
      const hw = Math.max(...remoteCatalog.map((c) => c.revision));
      const nextCursor = hasMore
        ? Buffer.from(JSON.stringify({ r: String(last.revision), i: String(last.courseId) }), "utf8").toString("base64url")
        : null;
      return res.json({
        success: true,
        data: {
          courses: slice,
          pagination: {
            afterRevision: afterRev,
            afterId,
            nextAfterRevision: last ? last.revision : afterRev,
            nextAfterId: last ? Number(last.courseId) : afterId,
            nextCursor,
            hasMore,
            limit,
            snapshotAnchorRevision: Number(req.query.snapshotAnchorRevision || total),
            highWaterRevision: hw,
          },
        },
      });
    });

    const server = http.createServer(remoteApp);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    }));
    const port = server.address().port;

    const client = createCourseIntegrationClient({
      config: { ...OUTBOUND_CFG, baseUrl: `http://127.0.0.1:${port}` },
    });
    const catalogSync = createMolyCourseCatalogSyncService({
      db,
      client,
    });

    // Pass 1: process only 2 pages (1,000 courses) then stop ("crash / interrupt simulation")
    const part1 = await catalogSync.runCatalogBackfill({ limit: 500, maxPages: 2 });
    assert.equal(part1.pagesProcessed, 2);
    assert.equal(part1.coursesApplied, 1000);
    const cpMid = (await pg.query(`SELECT * FROM course_sync_checkpoints WHERE stream_name = 'catalog_courses'`)).rows[0];
    assert.equal(cpMid.sync_status, "backfilling");
    assert.ok(cpMid.last_cursor);
    assert.equal(Number(cpMid.high_water_revision), 1000);

    // Mid-backfill concurrent mutation on course #1 (already fetched in page 1) -> revision 5000
    remoteCatalog[0].title = "CSCA Synced Course #1 (Mid-Backfill Live Update)";
    remoteCatalog[0].revision = 5000;
    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({
        courseId: "1",
        revision: 5000,
        title: "CSCA Synced Course #1 (Mid-Backfill Live Update)",
        slug: "csca-sync-course-1",
      }),
      { processImmediately: false },
    );

    // Pass 2 via admin route: resume from checkpoint, apply remaining pages + converge inbox queue
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use("/api/admin/course-integrations", createCourseIntegrationAdminRoutes({
      catalogSync,
      db,
      authenticate: (req, _res, next) => { req.user = { id: 1, role: "admin" }; next(); },
      authorizeAnyPermission: () => (_req, _res, next) => next(),
    }));

    const resumeRes = await request(adminApp)
      .post("/api/admin/course-integrations/catalog/backfill")
      .send({ limit: 500, maxPages: 20 })
      .expect(200);
    assert.equal(resumeRes.body.data.pagesProcessed, 3);
    assert.equal(resumeRes.body.data.highWaterRevision, 5000);

    const cpDone = (await pg.query(`SELECT * FROM course_sync_checkpoints WHERE stream_name = 'catalog_courses'`)).rows[0];
    assert.equal(cpDone.sync_status, "idle");
    assert.equal(cpDone.last_cursor, null);
    assert.equal(Number(cpDone.high_water_revision), 5000);

    const totalLocal = Number((await pg.query(`SELECT COUNT(*)::int AS cnt FROM courses WHERE content_origin = 'csca_course'`)).rows[0].cnt);
    assert.equal(totalLocal, total);

    const updatedFirst = (await pg.query(`SELECT title, sync_revision FROM courses WHERE remote_course_id = '1'`)).rows[0];
    assert.equal(updatedFirst.title, "CSCA Synced Course #1 (Mid-Backfill Live Update)");
    assert.equal(Number(updatedFirst.sync_revision), 5000);

    const cpGet = await request(adminApp).get("/api/admin/course-integrations/catalog/checkpoints").expect(200);
    assert.equal(cpGet.body.data[0].sync_status, "idle");
    const inboxGet = await request(adminApp).get("/api/admin/course-integrations/catalog/inbox").expect(200);
    assert.ok(inboxGet.body.data.length >= 1);
  });

  test("Protects moly_native slugs & local pricing, opens COURSE_MAPPING_MISSING conflicts, and preserves history on unpublish/tombstone", async (t) => {
    const { pg, db } = await setupMolyCatalogDb();
    t.after(() => pg.close());

    const catalogSync = createMolyCourseCatalogSyncService({ db });

    // Seed protected moly_native course + paid VIP pricing
    const nativeCourse = (await pg.query(
      `INSERT INTO courses (external_key, slug, title, subject_code, access_type, price_vnd, status, content_origin)
       VALUES ('native:1', 'native-math-vip', 'Moly Native VIP Course', 'MATH', 'vip', 799000, 'published', 'moly_native')
       RETURNING *`,
    )).rows[0];

    // Incoming CSCA-Course collides on native slug -> 409 LEGACY_ORIGIN_CONFLICT & zero overwrite
    await assert.rejects(
      () => catalogSync.ingestCatalogEvents(
        makeCourseEnvelope({ courseId: "200", revision: 1, slug: "native-math-vip", title: "Hijack Attempt" }),
      ),
      (err) => err.code === "LEGACY_ORIGIN_CONFLICT",
    );
    const nativeAfter = (await pg.query(`SELECT title, price_vnd, access_type FROM courses WHERE id = $1`, [nativeCourse.id])).rows[0];
    assert.equal(nativeAfter.title, "Moly Native VIP Course");
    assert.equal(Number(nativeAfter.price_vnd), 799000);
    assert.equal(nativeAfter.access_type, "vip");
    const conflictsNative = (await pg.query(`SELECT * FROM integration_conflicts WHERE conflict_type = 'LEGACY_ORIGIN_CONFLICT'`)).rows;
    assert.equal(conflictsNative.length, 1);

    // Profile arrives before parent course exists -> COURSE_MAPPING_MISSING
    await assert.rejects(
      () => catalogSync.ingestCatalogEvents({
        schemaVersion: "2.0",
        eventId: "csca-course:profile:888:rev:1",
        idempotencyKey: "csca-course:profile:888:rev:1",
        eventType: "profile.upserted",
        sourceSystem: "csca-course",
        aggregateType: "profile",
        aggregateId: "888",
        revision: 1,
        sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        occurredAt: "2026-11-15T10:00:00.000Z",
        correlationId: "corr-missing-course",
        payload: {
          profileId: "888",
          courseId: "9999",
          externalOfferingId: "ORPHAN-OFF-888",
          mode: "INDEPENDENT",
          revision: 1,
          sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        },
      }),
      (err) => err.code === "COURSE_MAPPING_MISSING",
    );
    const conflictsMissing = (await pg.query(`SELECT * FROM integration_conflicts WHERE conflict_type = 'COURSE_MAPPING_MISSING'`)).rows;
    assert.equal(conflictsMissing.length, 1);

    // Sync course 300 + configure local Moly price + enroll student with progress & order, then unpublish & tombstone
    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({
        courseId: "300",
        revision: 1,
        slug: "csca-chem-300",
        title: "Hóa Học CSCA 300",
        subjectCode: "CHEMISTRY",
        profiles: [{
          profileId: "3001",
          externalOfferingId: "CHEM-300-OFF",
          courseId: "300",
          mode: "INDEPENDENT",
          managementClassId: "CHEM-300-OFF",
          badgeLabel: "Khóa video độc lập",
          status: "active",
          revision: 1,
          deleted: false,
          sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        }],
      }),
    );
    const syncedCourse = (await pg.query(`SELECT id FROM courses WHERE remote_course_id = '300'`)).rows[0];
    await pg.query(`UPDATE courses SET price_vnd = 450000, access_type = 'package' WHERE id = $1`, [syncedCourse.id]);
    await pg.query(`UPDATE course_profile_projections SET checkout_ready = TRUE WHERE local_course_id = $1`, [syncedCourse.id]);

    // Update course revision 2 -> local price_vnd, access_type, checkout_ready MUST stay intact
    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({
        courseId: "300",
        revision: 2,
        slug: "csca-chem-300",
        title: "Hóa Học CSCA 300 (Updated Title)",
        subjectCode: "CHEMISTRY",
      }),
    );
    const preserved = (await pg.query(`SELECT title, price_vnd, access_type FROM courses WHERE id = $1`, [syncedCourse.id])).rows[0];
    assert.equal(preserved.title, "Hóa Học CSCA 300 (Updated Title)");
    assert.equal(Number(preserved.price_vnd), 450000);
    assert.equal(preserved.access_type, "package");
    assert.equal((await pg.query(`SELECT checkout_ready FROM course_profile_projections WHERE local_course_id = $1`, [syncedCourse.id])).rows[0].checkout_ready, true);

    // Seed student enrollment + section/lesson + progress before unpublish/tombstone
    const stu = (await pg.query(`INSERT INTO users (username, email) VALUES ('hist_stu', 'hist@test.local') RETURNING id`)).rows[0];
    const sec = (await pg.query(`INSERT INTO course_sections (course_id, title, sort_order, is_published) VALUES ($1, 'S1', 1, TRUE) RETURNING id`, [syncedCourse.id])).rows[0];
    const les = (await pg.query(`INSERT INTO course_lessons (course_id, section_id, external_key, slug, title, lesson_type, sort_order, is_published) VALUES ($1, $2, 'l1-key', 'l1', 'L1', 'video', 1, TRUE) RETURNING id`, [syncedCourse.id, sec.id])).rows[0];
    const enr = (await pg.query(`INSERT INTO course_enrollments (user_id, course_id, source, status) VALUES ($1, $2, 'package', 'active') RETURNING id`, [stu.id, syncedCourse.id])).rows[0];
    await pg.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, status, completion_pct) VALUES ($1, $2, $3, 'completed', 100)`, [stu.id, syncedCourse.id, les.id]);

    // Unpublish (revision 3) then Tombstone (revision 4)
    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({ courseId: "300", revision: 3, eventType: "course.unpublished", slug: "csca-chem-300", title: "Hóa Học CSCA 300", isPublished: false, subjectCode: "CHEMISTRY" }),
    );
    assert.equal((await pg.query(`SELECT status FROM courses WHERE id = $1`, [syncedCourse.id])).rows[0].status, "draft");

    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({ courseId: "300", revision: 4, eventType: "course.tombstoned", slug: "csca-chem-300", title: "Hóa Học CSCA 300", deleted: true, deletedAt: "2026-11-15T12:00:00.000Z", subjectCode: "CHEMISTRY" }),
    );
    const tombRow = (await pg.query(`SELECT status, tombstoned_at FROM courses WHERE id = $1`, [syncedCourse.id])).rows[0];
    assert.equal(tombRow.status, "archived");
    assert.ok(tombRow.tombstoned_at);
    assert.equal((await pg.query(`SELECT status FROM course_profile_projections WHERE local_course_id = $1`, [syncedCourse.id])).rows[0].status, "tombstoned");

    // Learning history remains preserved!
    assert.equal((await pg.query(`SELECT COUNT(*)::int AS cnt FROM course_enrollments WHERE course_id = $1`, [syncedCourse.id])).rows[0].cnt, 1);
    assert.equal((await pg.query(`SELECT COUNT(*)::int AS cnt FROM lesson_progress WHERE course_id = $1`, [syncedCourse.id])).rows[0].cnt, 1);
  });

  test("Synced catalog surfaces instructor & offerings in courseService while blocking unpriced checkout & self-enroll until priced", async (t) => {
    const { pg, db } = await setupMolyCatalogDb();
    const origQuery = database.query;
    const origPool = database.pool;
    const prevFlag = process.env.CSCA_VIDEO_COMMERCE_ENABLED;
    database.query = db.query;
    database.pool = db.pool;
    process.env.CSCA_VIDEO_COMMERCE_ENABLED = "true";

    t.after(async () => {
      database.query = origQuery;
      database.pool = origPool;
      if (prevFlag === undefined) delete process.env.CSCA_VIDEO_COMMERCE_ENABLED;
      else process.env.CSCA_VIDEO_COMMERCE_ENABLED = prevFlag;
      await pg.close();
    });

    const catalogSync = createMolyCourseCatalogSyncService({ db });
    const stu = (await pg.query(`INSERT INTO users (username, email, full_name) VALUES ('buyer_stu', 'buyer@test.local', 'Buyer') RETURNING id`)).rows[0];

    await catalogSync.ingestCatalogEvents(
      makeCourseEnvelope({
        courseId: "400",
        revision: 1,
        slug: "vat-ly-csca-day2",
        title: "Vật Lý CSCA Day 2",
        subjectCode: "PHYSICS",
        thumbnailUrl: "https://cdn.csca.local/phys.png",
        instructor: { id: "12", displayName: "Cô Lan Vật Lý", avatarUrl: null, headline: "Chuyên gia CSCA" },
        profiles: [{
          profileId: "4001",
          externalOfferingId: "PHYS-400-MIRROR",
          courseId: "400",
          mode: "MIRROR",
          managementClassId: "PHYS-400-MIRROR",
          badgeLabel: "Bản ghi lớp Live",
          status: "active",
          revision: 1,
          deleted: false,
          sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
        }],
      }),
    );

    const synced = (await pg.query(`SELECT id FROM courses WHERE remote_course_id = '400'`)).rows[0];

    // Catalog + Landing expose instructor, thumbnail, subject, profiles, and block unpriced checkout
    const listRes = await courseService.listCatalog({ subjectCode: "PHYSICS" }, { id: stu.id });
    assert.equal(listRes.items.length, 1);
    const item = listRes.items[0];
    assert.equal(item.title, "Vật Lý CSCA Day 2");
    assert.equal(item.instructor?.displayName, "Cô Lan Vật Lý");
    assert.equal(item.profiles.length, 1);
    assert.equal(item.profiles[0].badgeLabel, "Bản ghi lớp Live");
    assert.equal(item.checkoutReady, false);
    assert.equal(item.canPurchase, false);
    assert.equal(item.blockCode, "PRICE_NOT_CONFIGURED");
    assert.equal(item.ownershipLabel, "Chưa mở bán");

    const landing = await courseService.getCourseLanding("vat-ly-csca-day2", { id: stu.id });
    assert.equal(landing.instructor?.displayName, "Cô Lan Vật Lý");
    assert.equal(landing.access.canPurchase, false);
    assert.equal(landing.access.blockCode, "PRICE_NOT_CONFIGURED");

    // Direct self-enroll rejects with 422 PRICE_NOT_CONFIGURED
    await assert.rejects(
      () => courseService.enroll(synced.id, { id: stu.id }),
      (err) => err.code === "PRICE_NOT_CONFIGURED" && err.status === 422,
    );

    // Even if a video_packages row exists while checkout_ready=FALSE, videoPaymentService blocks checkout!
    const pkg = (await pg.query(
      `INSERT INTO video_packages (name, allowed_subjects, duration_mode, duration_days, price_vnd, renewal_mode, status)
       VALUES ('Gói Lý 400', ARRAY['PHYSICS'], 'days', 180, 599000, 'extend', 'active')
       RETURNING id`,
    )).rows[0];
    await pg.query(`INSERT INTO video_package_courses (video_package_id, course_id) VALUES ($1, $2)`, [pkg.id, synced.id]);

    const gateway = {
      assertConfigured() {},
      async get() { return null; },
      async create(row) {
        return { orderCode: Number(row.id), amount: Number(row.amount), status: "PENDING", qrCode: "qr", checkoutUrl: "https://pay.test/1" };
      },
    };
    const paymentService = createVideoPaymentService({
      db,
      gateway,
      recalculateVip: async () => {},
      sendEmail: async () => ({ sent: true }),
      salesEnabled: () => true,
    });

    await assert.rejects(
      () => paymentService.quote(stu.id, { type: "video", productId: pkg.id }),
      (err) => err.code === "PRICE_NOT_CONFIGURED" && err.status === 422,
    );
    await assert.rejects(
      () => paymentService.createOrder(stu.id, {
        type: "video",
        productId: pkg.id,
        idempotencyKey: "day2-blocked-key-1",
        quoteHash: "0".repeat(64),
      }),
      (err) => err.code === "PRICE_NOT_CONFIGURED" && err.status === 422,
    );

    // Once Moly admin opens checkout_ready=TRUE on the profile projection, catalog & payment unlock!
    await pg.query(`UPDATE course_profile_projections SET checkout_ready = TRUE WHERE local_course_id = $1`, [synced.id]);

    const readyLanding = await courseService.getCourseLanding("vat-ly-csca-day2", { id: stu.id });
    assert.equal(readyLanding.checkoutReady, true);
    assert.equal(readyLanding.access.canPurchase, true);
    assert.equal(readyLanding.access.blockCode, null);

    const q = await paymentService.quote(stu.id, { type: "video", productId: pkg.id });
    assert.equal(q.originalAmount, 599000);
    const createdOrder = await paymentService.createOrder(stu.id, {
      type: "video",
      productId: pkg.id,
      idempotencyKey: "day2-ready-key-1",
      quoteHash: q.quoteHash,
    });
    assert.equal(createdOrder.amount, 599000);
    assert.equal(createdOrder.snapshot.originalAmount, 599000);
  });

  test("Internal price projection creates an idempotent Moly video offer and unlocks checkout for non-owners", async (t) => {
    const { pg, db } = await setupMolyCatalogDb();
    const origQuery = database.query;
    const origPool = database.pool;
    database.query = db.query;
    database.pool = db.pool;
    t.after(async () => {
      database.query = origQuery;
      database.pool = origPool;
      await pg.close();
    });

    const catalogSync = createMolyCourseCatalogSyncService({ db });
    const student = (await pg.query(
      `INSERT INTO users (username, email, full_name) VALUES ('priced_buyer', 'priced@test.local', 'Priced Buyer') RETURNING id`,
    )).rows[0];
    const profile = {
      profileId: "5001",
      externalOfferingId: "RECORD-500",
      courseId: "500",
      mode: "INDEPENDENT",
      managementClassId: "RECORD-500",
      badgeLabel: "Khóa video độc lập",
      status: "active",
      revision: 1,
      deleted: false,
      sourceUpdatedAt: "2026-11-15T10:00:00.000Z",
    };

    await catalogSync.ingestCatalogEvents(makeCourseEnvelope({
      courseId: "500",
      revision: 1,
      slug: "toan-record-500",
      title: "Toán Record 500",
      subjectCode: "MATH",
      priceVnd: 799000,
      isFree: false,
      profiles: [profile],
    }));

    const course = (await pg.query(
      `SELECT id, price_vnd, access_type FROM courses WHERE remote_course_id = '500'`,
    )).rows[0];
    assert.equal(Number(course.price_vnd), 799000);
    assert.equal(course.access_type, "package");

    const offer = (await pg.query(
      `SELECT vp.id, vp.price_vnd, vp.status, vp.source_system, vp.source_course_id
       FROM video_packages vp
       JOIN video_package_courses vpc ON vpc.video_package_id = vp.id
       WHERE vpc.course_id = $1`,
      [course.id],
    )).rows[0];
    assert.equal(Number(offer.price_vnd), 799000);
    assert.equal(offer.status, "active");
    assert.equal(offer.source_system, "csca-course");
    assert.equal(offer.source_course_id, "500");
    assert.equal((await pg.query(
      `SELECT checkout_ready FROM course_profile_projections WHERE local_course_id = $1`,
      [course.id],
    )).rows[0].checkout_ready, true);

    const landing = await courseService.getCourseLanding("toan-record-500", { id: student.id });
    assert.equal(landing.checkoutReady, true);
    assert.equal(landing.access.canPurchase, true);
    assert.equal(landing.commerceOffers.length, 1);
    assert.equal(landing.commerceOffers[0].id, Number(offer.id));
    assert.equal(landing.commerceOffers[0].priceVnd, 799000);

    await catalogSync.ingestCatalogEvents(makeCourseEnvelope({
      courseId: "500",
      revision: 2,
      slug: "toan-record-500",
      title: "Toán Record 500",
      subjectCode: "MATH",
      priceVnd: 699000,
      isFree: false,
      sourceUpdatedAt: "2026-11-15T11:00:00.000Z",
      profiles: [{ ...profile, revision: 2, sourceUpdatedAt: "2026-11-15T11:00:00.000Z" }],
    }));
    const offersAfter = await pg.query(
      `SELECT id, price_vnd FROM video_packages WHERE source_system = 'csca-course' AND source_course_id = '500'`,
    );
    assert.equal(offersAfter.rows.length, 1);
    assert.equal(Number(offersAfter.rows[0].id), Number(offer.id));
    assert.equal(Number(offersAfter.rows[0].price_vnd), 699000);
  });
});
