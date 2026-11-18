const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { PGlite } = require("@electric-sql/pglite");

const { createCourseIntegrationClient } = require("../src/services/courseIntegrationClient");
const { createCourseOwnershipProjectionService } = require("../src/services/courseOwnershipProjectionService");
const { createMolyCourseCatalogSyncService } = require("../src/services/molyCourseCatalogSyncService");
const { createMolyCourseWorkspaceService } = require("../src/services/molyCourseWorkspaceService");
const { createCourseSsoService } = require("../src/services/courseSsoService");
const { createCourseIntegrationV2Routes } = require("../src/routes/courseIntegrationV2Routes");
const { createMolySsoRouters } = require("../src/routes/ssoRoutes");
const { applyMigration: applyVideoCommerceMigration } = require("../scripts/apply_video_commerce_migration");
const { applyMigration: applyCourseIntegrationMigration } = require("../scripts/apply_course_integration_migration");

const OUTBOUND_CFG = {
  serviceToken: "course-service-tok-day4",
  integrationKey: "moly-v2-key",
  hmacSecret: "day4-shared-outbound-secret-999",
};

const INBOUND_CFG = {
  serviceToken: "moly-inbound-tok-day4",
  integrationKey: "csca-course-v2-key",
  hmacSecret: "day4-shared-inbound-secret-888",
};

const TEST_JWT_SECRET = "day4-test-jwt-secret-key";

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

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
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

function verifyProofHeader(proofHeader, secret = OUTBOUND_CFG.hmacSecret) {
  assert.ok(proofHeader && typeof proofHeader === "string", "Expected X-Device-Slot-Proof header");
  const parsed = JSON.parse(Buffer.from(proofHeader, "base64url").toString("utf8"));
  const canonical = `v1:${parsed.externalUserId}:${parsed.molyDeviceTokenHash}:${parsed.issuedAt}:${parsed.nonce}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(parsed.signature, expectedSig);
  return parsed;
}

function extractCookieValue(setCookies, name) {
  for (const raw of setCookies || []) {
    const first = String(raw).split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0 && first.slice(0, eq).trim() === name) {
      return decodeURIComponent(first.slice(eq + 1).trim());
    }
  }
  return null;
}

async function setupDay4MolyEnv(t, stubHandler) {
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
      ban_reason TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      is_vip BOOLEAN NOT NULL DEFAULT FALSE,
      subscription_tier VARCHAR(32) DEFAULT 'basic',
      vip_tier VARCHAR(32) DEFAULT 'free',
      vip_expires_at TIMESTAMPTZ,
      vip_package_id INTEGER,
      vip_allowed_subjects TEXT[] DEFAULT ARRAY[]::text[],
      vip_source VARCHAR(32),
      device_limit_locked_at TIMESTAMPTZ,
      device_limit_attempts INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_vip_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      package_id INTEGER,
      tier VARCHAR(32) DEFAULT 'free',
      source VARCHAR(32),
      ends_at TIMESTAMPTZ,
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT FALSE,
      allowed_subjects TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status VARCHAR(32) DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS course_outcomes (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL, content TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS course_requirements (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL, content TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS token_blacklist (id SERIAL PRIMARY KEY, token_jti VARCHAR(255) NOT NULL);
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content_updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS vip_packages (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sort_order INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS course_package_access (course_id INTEGER NOT NULL, package_id INTEGER NOT NULL);
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
      user_id INTEGER REFERENCES users(id)
    );
  `);

  const db = makeDbAdapter(pg);
  await applyVideoCommerceMigration(db);
  await applyCourseIntegrationMigration(db);

  const migration081 = fs.readFileSync(
    path.resolve(__dirname, "../../database/migrations/081_moly_course_full_sync_foundation.sql"),
    "utf8",
  );
  await pg.exec(migration081);

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let bodyJson = null;
    try {
      bodyJson = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      bodyJson = null;
    }
    const result = stubHandler
      ? await stubHandler({ method: req.method, url: req.url, headers: req.headers, body: bodyJson })
      : { status: 404, body: { success: false, code: "NOT_FOUND" } };
    res.writeHead(result.status || 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const prevEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    COURSE_DELEGATED_LEARNING_ENABLED: process.env.COURSE_DELEGATED_LEARNING_ENABLED,
    COURSE_LMS_HMAC_SECRET: process.env.COURSE_LMS_HMAC_SECRET,
    MOLY_DEVICE_PROOF_SECRET: process.env.MOLY_DEVICE_PROOF_SECRET,
    SSO_COOKIE_SECURE: process.env.SSO_COOKIE_SECURE,
  };
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.COURSE_DELEGATED_LEARNING_ENABLED = "true";
  process.env.COURSE_LMS_HMAC_SECRET = OUTBOUND_CFG.hmacSecret;
  process.env.MOLY_DEVICE_PROOF_SECRET = OUTBOUND_CFG.hmacSecret;
  process.env.SSO_COOKIE_SECURE = "false";

  const client = createCourseIntegrationClient({
    config: {
      baseUrl,
      serviceToken: OUTBOUND_CFG.serviceToken,
      integrationKey: OUTBOUND_CFG.integrationKey,
      hmacSecret: OUTBOUND_CFG.hmacSecret,
      timeoutMs: 5000,
    },
  });
  const ownership = createCourseOwnershipProjectionService({ db, client });
  const catalogSync = createMolyCourseCatalogSyncService({ db, client });
  const workspace = createMolyCourseWorkspaceService({ db, client, ownership });
  const ssoService = createCourseSsoService({
    db,
    courseClient: client,
    ownershipService: ownership,
    env: {
      ...process.env,
      COURSE_WEB_BASE_URL: "https://course.example.test",
      COURSE_SSO_TTL_SECONDS: "90",
      MOLY_DEVICE_PROOF_SECRET: OUTBOUND_CFG.hmacSecret,
    },
  });

  const dbPath = require.resolve("../src/config/database");
  const runtimePath = require.resolve("../src/services/courseIntegrationRuntime");
  const reloadPaths = [
    require.resolve("../src/middleware/authMiddleware"),
    require.resolve("../src/repositories/courseRepository"),
    require.resolve("../src/repositories/learningRepository"),
    require.resolve("../src/services/videoLearningAccess"),
    require.resolve("../src/services/courseAssignmentService"),
    require.resolve("../src/services/courseService"),
    require.resolve("../src/services/learningService"),
    require.resolve("../src/controllers/courseController"),
    require.resolve("../src/controllers/learningController"),
    require.resolve("../src/routes/learningRoutes"),
  ];
  const prevDbMod = require.cache[dbPath];
  const prevRuntimeMod = require.cache[runtimePath];
  const prevReloadMods = new Map(reloadPaths.map((p) => [p, require.cache[p]]));

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: (...args) => db.query(...args), pool: db.pool },
  };
  require.cache[runtimePath] = {
    id: runtimePath,
    filename: runtimePath,
    loaded: true,
    exports: { client, ownership, catalogSync, workspace },
  };
  for (const p of reloadPaths) delete require.cache[p];

  const courseService = require("../src/services/courseService");
  const learningService = require("../src/services/learningService");
  const learningRoutes = require("../src/routes/learningRoutes");

  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use("/api/integrations/v2", createCourseIntegrationV2Routes({
    catalogSync,
    inboundConfig: INBOUND_CFG,
  }));
  const ssoRouters = createMolySsoRouters({
    ssoService,
    authenticate: (req, _res, next) => {
      const auth = String(req.headers.authorization || "");
      if (auth.startsWith("Bearer ")) {
        req.user = jwt.verify(auth.slice(7), TEST_JWT_SECRET);
      }
      next();
    },
    optionalAuth: (req, _res, next) => {
      const auth = String(req.headers.authorization || "");
      if (auth.startsWith("Bearer ")) {
        try { req.user = jwt.verify(auth.slice(7), TEST_JWT_SECRET); } catch { /* ignore */ }
      }
      next();
    },
    env: process.env,
  });
  app.use("/api/sso", ssoRouters.userRouter);
  app.use("/api/learning", learningRoutes);

  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (prevDbMod) require.cache[dbPath] = prevDbMod; else delete require.cache[dbPath];
    if (prevRuntimeMod) require.cache[runtimePath] = prevRuntimeMod; else delete require.cache[runtimePath];
    for (const [p, mod] of prevReloadMods.entries()) {
      if (mod) require.cache[p] = mod; else delete require.cache[p];
    }
    await pg.close();
  });

  return {
    pg,
    db,
    app,
    client,
    catalogSync,
    courseService,
    learningService,
  };
}

test("Day 4 Moly BFF: HttpOnly trusted cookie + HMAC device proof, <=60s playback token, session retry, immediate projection & SSO forwarding", async (t) => {
  const upstreamCalls = [];
  let expireNextPlaybackOnce = false;
  let simulateUpstreamError = null;

  const ctx = await setupDay4MolyEnv(t, async ({ method, url, headers, body }) => {
    upstreamCalls.push({ method, url, headers, body });

    if (method === "POST" && url === "/api/integrations/v2/sso/exchange") {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            source_system: "csca-course",
            source_user_id: "7001",
            email: "learner.day4@example.com",
            email_verified: true,
            username: "learner_day4",
            display_name: "Hoc Vien Day 4",
            role: "student",
            target_path: "/khoa-hoc",
            nonce: body.nonce,
          },
        },
      };
    }

    if (method === "POST" && url === "/api/integrations/v2/sso/bind-identity") {
      return { status: 200, body: { success: true, data: { bound: true } } };
    }

    if (method === "POST" && url === "/api/integrations/v2/learning/sessions") {
      if (simulateUpstreamError) {
        const err = simulateUpstreamError;
        simulateUpstreamError = null;
        return err;
      }
      verifyProofHeader(headers["x-device-slot-proof"]);
      assert.ok(body.scopes.includes("progress:write"));
      return {
        status: 201,
        body: {
          success: true,
          data: {
            sessionToken: `del_sess_${upstreamCalls.length}`,
            expiresAt: new Date(Date.now() + 240 * 1000).toISOString(),
            ttlSeconds: 240,
            scopes: body.scopes,
          },
        },
      };
    }

    if (method === "GET" && url.includes("/learning/offerings/prof_d4/workspace")) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            profile: { id: "prof_d4", mode: "INDEPENDENT", capabilities: { canPlayVideo: true, deviceLimit: 2 } },
            progress: { completedUnits: 0, totalUnits: 2, overallPercent: 0 },
            units: [
              { id: "1001", unitType: "lesson", title: "Bai 1", isLocked: false, isCompleted: false, progressPercent: 0 },
              { id: "1002", unitType: "lesson", title: "Bai 2", isLocked: true, isCompleted: false, progressPercent: 0 },
            ],
            activeUnit: {
              id: "1001",
              unitType: "lesson",
              title: "Bai 1",
              videos: [{ id: "5001", assetId: "5001", title: "Phan 1", durationSeconds: 100 }],
            },
          },
        },
      };
    }

    if (method === "POST" && /^\/api\/integrations\/v2\/learning\/videos\/\d+\/playback-token$/.test(url)) {
      if (simulateUpstreamError) {
        const err = simulateUpstreamError;
        simulateUpstreamError = null;
        return err;
      }
      if (expireNextPlaybackOnce) {
        expireNextPlaybackOnce = false;
        return {
          status: 401,
          body: { success: false, errorCode: "DELEGATED_SESSION_EXPIRED", message: "Expired" },
        };
      }
      verifyProofHeader(headers["x-device-slot-proof"]);
      assert.match(headers["idempotency-key"], /^playback:\d+:[0-9a-f-]{36}$/);
      assert.ok(body.ttlSeconds <= 60, `Expected ttlSeconds <= 60, got ${body.ttlSeconds}`);
      return {
        status: 200,
        body: {
          success: true,
          data: {
            playbackSessionId: "pb_d4_1",
            deliveryType: "bunny",
            videoAssetId: "5001",
            unitId: "1001",
            unitType: "lesson",
            profileId: "prof_d4",
            courseId: "601",
            title: "Phan 1",
            embedUrl: "https://iframe.mediadelivery.net/embed/99001/guid-5001?token=abc&expires=9999999999",
            hlsPlaylistUrl: "https://vz-d4.b-cdn.net/guid-5001/playlist.m3u8?token=xyz",
            durationSeconds: 100,
            ttlSeconds: body.ttlSeconds,
            expiresAt: new Date(Date.now() + body.ttlSeconds * 1000).toISOString(),
            watermark: { label: "learner.day4@example.com" },
            resumePositionSeconds: 0,
            unitProgress: { totalDurationSeconds: 100, watchedSeconds: 0, completionPercent: 0, isCompleted: false },
          },
        },
      };
    }

    if (method === "PUT" && url === "/api/integrations/v2/learning/videos/5001/progress") {
      assert.match(headers["idempotency-key"], /^progress:\d+:[0-9a-f-]{36}$/);
      const completed = Number(body.currentTimeSeconds) >= 60;
      return {
        status: 200,
        body: {
          success: true,
          data: {
            stale: false,
            ignoredReason: null,
            videoAssetId: "5001",
            unitId: "1001",
            unitType: "lesson",
            profileId: "prof_d4",
            courseId: "601",
            lastPositionSeconds: body.currentTimeSeconds,
            watchedSeconds: completed ? 65 : 25,
            completionPercent: completed ? 65 : 25,
            isVideoCompleted: completed,
            isUnitCompleted: completed,
            completedAt: completed ? "2026-11-15T10:05:00.000Z" : null,
            lastHeartbeatAt: "2026-11-15T10:05:00.000Z",
            durationSeconds: 100,
            clientSequence: body.clientSequence || 1,
            syncRevision: completed ? 11 : 10,
            unitProgress: {
              totalDurationSeconds: 100,
              watchedSeconds: completed ? 65 : 25,
              completionPercent: completed ? 65 : 25,
              isCompleted: completed,
            },
            courseProgress: {
              completedUnits: completed ? 1 : 0,
              totalUnits: 2,
              overallPercent: completed ? 50 : 0,
            },
            units: [
              { id: "1001", unitType: "lesson", sessionNumber: 1, isLocked: false, isCompleted: completed, progressPercent: completed ? 65 : 25 },
              { id: "1002", unitType: "lesson", sessionNumber: 2, isLocked: !completed, isCompleted: false, progressPercent: 0 },
            ],
          },
        },
      };
    }

    return { status: 404, body: { success: false, errorCode: "NOT_FOUND", message: url } };
  });

  // Seed external course 601 + native course 602 + learner + projections
  const learner = (await ctx.db.query(
    `INSERT INTO users (email, username, full_name, role, is_active, is_verified)
     VALUES ('learner.day4@example.com', 'learner_day4', 'Hoc Vien Day 4', 'student', true, true) RETURNING *`,
  )).rows[0];
  await ctx.db.query(
    `INSERT INTO courses (id, external_key, slug, title, content_origin, status, access_type, subject_code, level, total_sections, total_lessons, total_duration_seconds)
     VALUES
       (601, 'csca-course:601', 'toan-day4', 'Toán CSCA Day 4', 'csca_course', 'published', 'package', 'MATH', 'basic', 1, 2, 200),
       (602, NULL, 'native-day4', 'Khóa Native Day 4', 'moly_native', 'published', 'free', 'MATH', 'basic', 1, 1, 100)`,
  );
  await ctx.db.query(
    `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
     VALUES ('moly', 'moly:off_601', 601, 'active')`,
  );
  await ctx.db.query(
    `INSERT INTO external_entitlements (source_system, external_grant_id, external_user_id, external_course_id, user_id, local_course_id, status, effective_owned, valid_from, source_updated_at)
     VALUES ('csca-course', 'g-601', '7001', 'moly:off_601', $1, 601, 'active', TRUE, NOW(), NOW())`,
    [learner.id],
  );
  const profId = (await ctx.db.query(
    `INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at, metadata)
     VALUES ('csca-course', 'prof_d4', 'moly:off_601', '601', 601, 'INDEPENDENT', 'Tự học Toán', 'active', 1, NOW(), '{"capabilities":{"allowFileDownload":true,"deviceLimit":2}}'::jsonb)
     RETURNING id`,
  )).rows[0].id;
  const units = (await ctx.db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
       unit_type, remote_unit_id, title, sort_order, duration_seconds, is_published, is_public_preview,
       last_revision, source_updated_at
     ) VALUES
       ($1, 601, 'sec:1', 'Chương 1', 1, 'lesson', '1001', 'Bai 1', 1, 100, TRUE, TRUE, 1, NOW()),
       ($1, 601, 'sec:1', 'Chương 1', 1, 'lesson', '1002', 'Bai 2', 2, 100, TRUE, FALSE, 1, NOW())
     RETURNING id, remote_unit_id`,
    [profId],
  )).rows;
  const u1 = units.find((u) => u.remote_unit_id === "1001");
  const u2 = units.find((u) => u.remote_unit_id === "1002");

  // Seed native lesson & progress to verify non-regression
  const natSec = (await ctx.db.query(`INSERT INTO course_sections (course_id, title, sort_order) VALUES (602, 'Native S1', 1) RETURNING id`)).rows[0].id;
  const natLesson = (await ctx.db.query(`INSERT INTO course_lessons (course_id, section_id, title, slug, sort_order, estimated_duration_seconds) VALUES (602, $1, 'Native L1', 'native-l1', 1, 100) RETURNING id`, [natSec])).rows[0].id;
  await ctx.db.query(`INSERT INTO course_enrollments (user_id, course_id, status, source) VALUES ($1, 602, 'active', 'free')`, [learner.id]);
  await ctx.db.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, status, completion_pct) VALUES ($1, 602, $2, 'completed', 100)`, [learner.id, natLesson]);

  const token = jwt.sign({ id: learner.id, role: "student" }, TEST_JWT_SECRET);

  // 1) Workspace request without cookie mints HttpOnly `moly_trusted_device` cookie and sends valid HMAC X-Device-Slot-Proof
  const wsRes = await request(ctx.app)
    .get(`/api/learning/external/courses/toan-day4/workspace?unitId=u-${u1.id}`)
    .set("Authorization", `Bearer ${token}`)
    .set("User-Agent", "Mozilla/5.0 Chrome/126.0.0.0")
    .set("X-Device-Id", "spoofed-local-storage-device");
  assert.equal(wsRes.status, 200);

  const setCookies = wsRes.headers["set-cookie"] || [];
  const rawCookieTok = extractCookieValue(setCookies, "moly_trusted_device");
  assert.ok(rawCookieTok, "Expected HttpOnly moly_trusted_device cookie");
  assert.ok(setCookies.some((c) => c.includes("moly_trusted_device=") && /HttpOnly/i.test(c)));

  const deviceRow = (await ctx.db.query(`SELECT device_token_hash FROM moly_trusted_browser_devices WHERE user_id = $1`, [learner.id])).rows[0];
  assert.equal(deviceRow.device_token_hash, sha256Hex(rawCookieTok));

  const mintCall1 = upstreamCalls.find((c) => c.url === "/api/integrations/v2/learning/sessions");
  const verifiedProof1 = verifyProofHeader(mintCall1.headers["x-device-slot-proof"]);
  assert.equal(verifiedProof1.molyDeviceTokenHash, deviceRow.device_token_hash);

  // 2) Second workspace call with cookie reuses the same device hash without inserting a new slot row
  const wsRes2 = await request(ctx.app)
    .get(`/api/learning/external/courses/toan-day4/workspace?unitId=u-${u1.id}`)
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", `moly_trusted_device=${encodeURIComponent(rawCookieTok)}`)
    .set("X-Device-Id", "different-spoofed-id");
  assert.equal(wsRes2.status, 200);
  const deviceCount = Number((await ctx.db.query(`SELECT COUNT(*)::int AS cnt FROM moly_trusted_browser_devices WHERE user_id = $1`, [learner.id])).rows[0].cnt);
  assert.equal(deviceCount, 1);

  // 3) Playback token clamps TTL<=60s and automatically retries once on DELEGATED_SESSION_EXPIRED
  expireNextPlaybackOnce = true;
  const pbRes = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof_d4/units/u-${u1.id}/videos/5001/playback-token`)
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", `moly_trusted_device=${encodeURIComponent(rawCookieTok)}`)
    .send({ ttlSeconds: 999 });
  assert.equal(pbRes.status, 200);
  assert.equal(pbRes.body.data.ttlSeconds, 60);
  assert.ok(pbRes.body.data.embedUrl.includes("iframe.mediadelivery.net/embed/"));

  // 4) Progress proxy updates local course_progress_projections, unlocks next unit, and populates Landing + MyLearning
  const prog1 = await request(ctx.app)
    .put(`/api/learning/external/offerings/prof_d4/units/u-${u1.id}/videos/5001/progress`)
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", `moly_trusted_device=${encodeURIComponent(rawCookieTok)}`)
    .send({ currentTimeSeconds: 65, watchedDeltaSeconds: 30, clientSequence: 1, eventTimestamp: new Date().toISOString() });
  assert.equal(prog1.status, 200);
  assert.equal(prog1.body.data.isUnitCompleted, true);

  const projRows = (await ctx.db.query(`SELECT remote_unit_id, is_unit_completed, is_unlocked, completion_pct FROM course_progress_projections WHERE user_id = $1 ORDER BY remote_unit_id ASC`, [learner.id])).rows;
  assert.equal(projRows.length, 2);
  assert.equal(projRows[0].remote_unit_id, "1001");
  assert.equal(projRows[0].is_unit_completed, true);
  assert.equal(projRows[1].remote_unit_id, "1002");
  assert.equal(projRows[1].is_unlocked, true);

  const landing = await ctx.courseService.getCourseLanding("toan-day4", { id: learner.id, role: "student" });
  assert.equal(landing.progress.completedLessons, 1);
  assert.equal(landing.progress.totalLessons, 2);
  assert.equal(landing.progress.completionPct, 32.5); // avg(65, 0) / 2 = 32.5%

  const enrollments = await ctx.learningService.listMyEnrollments({ id: learner.id, role: "student" });
  const extEnr = enrollments.find((e) => e.course.id === 601);
  const natEnr = enrollments.find((e) => e.course.id === 602);
  assert.ok(extEnr);
  assert.equal(extEnr.enrollment.progress.completedLessons, 1);
  assert.equal(extEnr.enrollment.progress.lastLessonId, `u-${u1.id}`);
  assert.equal(extEnr.enrollment.progress.lastPositionSeconds, 65);
  assert.ok(natEnr);

  // 5) Propagates upstream 403 UNIT_LOCKED and 403 DEVICE_SLOT_LIMIT_REACHED cleanly
  simulateUpstreamError = {
    status: 403,
    body: { success: false, errorCode: "UNIT_LOCKED", message: "Locked" },
  };
  const lockedRes = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof_d4/units/u-${u2.id}/videos/5002/playback-token`)
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", `moly_trusted_device=${encodeURIComponent(rawCookieTok)}`)
    .send({ ttlSeconds: 60 });
  assert.equal(lockedRes.status, 403);
  assert.equal(lockedRes.body.code, "UNIT_LOCKED");

  // 6) Inbound v2 webhook handles monotonic learning.progress.updated & stale rejection cleanly, plus device.binding.revoked
  const freshEvt = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "csca-course:learning_progress:rev20",
    eventType: "learning.progress.updated",
    aggregateType: "learning_progress",
    aggregateId: "prof_d4:lesson:1002:user:7001",
    revision: 20,
    sourceUpdatedAt: "2026-11-15T12:00:00.000Z",
    payload: {
      profileId: "prof_d4",
      unitType: "lesson",
      unitId: "1002",
      externalUserId: `moly:${learner.id}`,
      watchedSeconds: 45,
      lastPositionSeconds: 45,
      completionPercent: 45,
      isVideoCompleted: false,
      isQuizCompleted: false,
      isUnitCompleted: false,
      isUnlocked: true,
      courseCompletionPct: 50,
    },
  };
  const signedFresh = signInboundBody(freshEvt);
  const ingestFresh = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signedFresh.headers)
    .send(signedFresh.rawBody);
  assert.equal(ingestFresh.status, 202);

  const staleEvt = {
    ...freshEvt,
    eventId: "csca-course:learning_progress:rev5_stale",
    revision: 5,
    sourceUpdatedAt: "2026-11-15T11:00:00.000Z",
    payload: { ...freshEvt.payload, completionPercent: 10, watchedSeconds: 10 },
  };
  const signedStale = signInboundBody(staleEvt);
  const ingestStale = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signedStale.headers)
    .send(signedStale.rawBody);
  assert.equal(ingestStale.status, 202);

  const u2Proj = (await ctx.db.query(`SELECT completion_pct FROM course_progress_projections WHERE user_id = $1 AND remote_unit_id = '1002'`, [learner.id])).rows[0];
  assert.equal(Number(u2Proj.completion_pct), 45);

  // Admin device revocation via inbox event revokes local browser cookie & blocks subsequent calls immediately
  const revokeEvt = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "csca-course:device_binding:rev21",
    eventType: "device.binding.revoked",
    aggregateType: "device_binding",
    aggregateId: `user:${learner.id}`,
    revision: 21,
    sourceUpdatedAt: "2026-11-15T12:05:00.000Z",
    payload: {
      externalUserId: `moly:${learner.id}`,
      molyDeviceTokenHashes: [deviceRow.device_token_hash],
      reason: "admin_revoked",
    },
  };
  const signedRevoke = signInboundBody(revokeEvt);
  const ingestRevoke = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signedRevoke.headers)
    .send(signedRevoke.rawBody);
  assert.equal(ingestRevoke.status, 202);

  const revokedWorkspaceRes = await request(ctx.app)
    .get(`/api/learning/external/courses/toan-day4/workspace?unitId=u-${u1.id}`)
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", `moly_trusted_device=${encodeURIComponent(rawCookieTok)}`);
  assert.equal(revokedWorkspaceRes.status, 403);
  assert.equal(revokedWorkspaceRes.body.code, "DEVICE_BINDING_REVOKED");

  // 7) DEVICE_LIMIT_LOCKED revocation (case-insensitive) sets users.device_limit_locked_at and blocks SSO/workspace
  const lockEvt = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "csca-course:device_binding:rev22_lock",
    eventType: "device.binding.revoked",
    aggregateType: "device_binding",
    aggregateId: `user:${learner.id}`,
    revision: 22,
    sourceUpdatedAt: "2026-11-15T12:06:00.000Z",
    payload: {
      externalUserId: `moly:${learner.id}`,
      reason: "device_limit_locked",
    },
  };
  const signedLock = signInboundBody(lockEvt);
  const ingestLock = await request(ctx.app)
    .post("/api/integrations/v2/events/ingest")
    .set(signedLock.headers)
    .send(signedLock.rawBody);
  assert.equal(ingestLock.status, 202);

  const lockedRow = (await ctx.db.query(`SELECT device_limit_locked_at FROM users WHERE id = $1`, [learner.id])).rows[0];
  assert.ok(lockedRow.device_limit_locked_at != null);

  const lockedWsRes = await request(ctx.app)
    .get(`/api/learning/external/courses/toan-day4/workspace?unitId=u-${u1.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(lockedWsRes.status, 403);
  assert.equal(lockedWsRes.body.code, "DEVICE_LIMIT_LOCKED");
});
