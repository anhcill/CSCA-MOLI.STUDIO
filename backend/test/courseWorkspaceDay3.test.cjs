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
const { createCourseIntegrationAdminRoutes } = require("../src/routes/courseIntegrationAdminRoutes");
const { createCourseIntegrationV2Routes } = require("../src/routes/courseIntegrationV2Routes");

const OUTBOUND_CFG = {
  serviceToken: "course-service-tok-day3",
  integrationKey: "moly-v2-key",
  hmacSecret: "day3-shared-outbound-secret-999",
};

const INBOUND_CFG = {
  serviceToken: "moly-inbound-tok-day3",
  integrationKey: "csca-course-v2-key",
  hmacSecret: "day3-shared-inbound-secret-888",
};

const TEST_JWT_SECRET = "day3-test-jwt-secret-key";

function makeDbAdapter(pg) {
  return {
    query: (sql, params) => pg.query(sql, params),
    pool: {
      connect: async () => ({
        query: (sql, params) => pg.query(sql, params),
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

async function setupDay3MolyEnv(t, stubHandler) {
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
      full_name VARCHAR(255),
      avatar_url TEXT,
      role VARCHAR(32) NOT NULL DEFAULT 'student',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      ban_reason TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT TRUE,
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
    CREATE TABLE IF NOT EXISTS course_outcomes (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS course_requirements (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id SERIAL PRIMARY KEY,
      token_jti VARCHAR(255) NOT NULL
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content_updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS vip_packages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS course_package_access (
      course_id INTEGER NOT NULL,
      package_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS external_course_mappings (
      id SERIAL PRIMARY KEY,
      source_system VARCHAR(50) NOT NULL,
      external_course_id VARCHAR(255) NOT NULL,
      local_course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      local_video_package_id INTEGER,
      remote_profile_id VARCHAR(128),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE (source_system, external_course_id)
    );
    CREATE TABLE IF NOT EXISTS external_identities (
      id SERIAL PRIMARY KEY,
      source_system VARCHAR(50) NOT NULL,
      external_user_id VARCHAR(255) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      source_updated_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      UNIQUE (source_system, external_user_id)
    );
    CREATE TABLE IF NOT EXISTS external_entitlements (
      id SERIAL PRIMARY KEY,
      source_system VARCHAR(50) NOT NULL,
      origin_system VARCHAR(32) NOT NULL DEFAULT 'csca-course',
      external_grant_id VARCHAR(255) NOT NULL,
      external_user_id VARCHAR(255) NOT NULL,
      external_course_id VARCHAR(255) NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      local_course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      course_mapping_id INTEGER REFERENCES external_course_mappings(id) ON DELETE SET NULL,
      external_identity_id INTEGER REFERENCES external_identities(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      effective_owned BOOLEAN NOT NULL DEFAULT TRUE,
      valid_from TIMESTAMPTZ DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      source_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      correlation_id VARCHAR(128),
      metadata JSONB DEFAULT '{}'::jsonb,
      UNIQUE (source_system, external_grant_id)
    );
    CREATE TABLE IF NOT EXISTS integration_conflicts (
      id SERIAL PRIMARY KEY,
      source_system VARCHAR(50) NOT NULL,
      conflict_type VARCHAR(64) NOT NULL,
      candidate_user_id INTEGER,
      existing_user_id INTEGER,
      external_user_id VARCHAR(255),
      email_hint VARCHAR(255),
      reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS integration_outbox (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      event_type VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      remote_status VARCHAR(20),
      external_course_id VARCHAR(255),
      metadata JSONB DEFAULT '{}'::jsonb,
      payload JSONB DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS video_packages (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price_vnd INTEGER NOT NULL,
      compare_at_price_vnd INTEGER,
      duration_days INTEGER,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      is_featured BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS video_package_courses (
      video_package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      PRIMARY KEY (video_package_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS user_video_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      allowed_subjects TEXT[] DEFAULT ARRAY[]::text[],
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS video_entitlement_courses (
      entitlement_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS course_sections (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS course_lessons (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      section_id INTEGER NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
      external_key VARCHAR(255),
      slug VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      summary TEXT,
      lesson_type VARCHAR(32) DEFAULT 'video',
      content_html TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      estimated_duration_seconds INTEGER DEFAULT 0,
      effective_duration_seconds INTEGER DEFAULT 0,
      video_asset_id INTEGER,
      material_id INTEGER,
      passing_score INTEGER DEFAULT 0,
      is_free_preview BOOLEAN DEFAULT FALSE,
      is_required BOOLEAN DEFAULT TRUE,
      is_published BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      source VARCHAR(32) NOT NULL DEFAULT 'purchase',
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, course_id)
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

  const migration081 = fs.readFileSync(
    path.resolve(__dirname, "../../database/migrations/081_moly_course_full_sync_foundation.sql"),
    "utf8",
  );
  await pg.exec(migration081);

  const db = makeDbAdapter(pg);
  const requests = [];
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
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: bodyJson,
    });
    const result = stubHandler
      ? await stubHandler({ method: req.method, url: req.url, headers: req.headers, body: bodyJson })
      : { status: 404, body: { success: false, code: "NOT_FOUND" } };
    res.writeHead(result.status || 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

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

  // Wire require.cache so Express learningRoutes + courseService + learningService use PGlite + workspace
  const prevJwtSecret = process.env.JWT_SECRET;
  const prevDelegatedLearningEnabled = process.env.COURSE_DELEGATED_LEARNING_ENABLED;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.COURSE_DELEGATED_LEARNING_ENABLED = "true";

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

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwtSecret;
    if (prevDelegatedLearningEnabled === undefined) delete process.env.COURSE_DELEGATED_LEARNING_ENABLED;
    else process.env.COURSE_DELEGATED_LEARNING_ENABLED = prevDelegatedLearningEnabled;

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
    client,
    ownership,
    catalogSync,
    workspace,
    courseService,
    learningService,
    learningRoutes,
    requests,
  };
}

function buildAdminAndV2App(envCtx) {
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use("/api/integrations/v2", createCourseIntegrationV2Routes({
    catalogSync: envCtx.catalogSync,
    inboundConfig: INBOUND_CFG,
  }));
  app.use("/api/admin/course-integrations", createCourseIntegrationAdminRoutes({
    service: {
      listCourseMappings: async () => [],
    },
    catalogSync: envCtx.catalogSync,
    db: envCtx.db,
    authenticate: (req, _res, next) => {
      req.user = { id: 1, role: "admin" };
      next();
    },
    authorizeAnyPermission: () => (_req, _res, next) => next(),
  }));
  app.use("/api/learning", envCtx.learningRoutes);
  return app;
}

test("Day 3 curriculum backfill + admin route projects MIRROR & INDEPENDENT units cleanly with zero native table writes", async (t) => {
  const curriculumPages = {
    "501": {
      course: { courseId: "501", externalOfferingId: "moly:off_501", slug: "vat-ly-day3", title: "Vật Lý CSCA Day 3", status: "published" },
      profiles: [
        {
          profileId: "prof_ind_501",
          courseId: "501",
          externalOfferingId: "moly:off_501",
          mode: "INDEPENDENT",
          title: "Lộ trình Video Tự Chủ",
          status: "active",
          revision: 5,
          capabilities: { allowFileDownload: true, deviceLimit: 2 },
          sections: [{ sectionId: "sec:ind-1", title: "Chương 1: Cơ học", sortOrder: 1 }],
          units: [
            {
              unitType: "lesson",
              unitId: "101",
              sectionId: "sec:ind-1",
              sectionTitle: "Chương 1: Cơ học",
              sectionSortOrder: 1,
              sessionNumber: 1,
              title: "Bài 1: Động học chất điểm (Preview)",
              summary: "Mở đầu cơ học",
              sortOrder: 1,
              durationSeconds: 900,
              isPublished: true,
              isPublicPreview: true,
              revision: 5,
              updatedAt: "2026-11-15T10:00:00Z",
              videoPartCount: 2,
              counts: { videos: 2, vocab: 4, formulas: 2, files: 1, quizzes: 1, assignments: 0 },
              theory: { hasTheory: true, hasTranscript: true },
              quizzes: [{ quizId: "q-1", title: "Quiz Động học", questionCount: 5 }],
              assignments: [],
              files: [
                {
                  fileId: "file-ind-1",
                  title: "Slide Động học",
                  originalFilename: "dong-hoc-slide.pdf",
                  mimeType: "application/pdf",
                  fileKind: "slide",
                  sizeBytes: 245760,
                  isSlide: true,
                  sortOrder: 0,
                  isPublished: true,
                },
              ],
            },
            {
              unitType: "lesson",
              unitId: "102",
              sectionId: "sec:ind-1",
              sectionTitle: "Chương 1: Cơ học",
              sectionSortOrder: 1,
              sessionNumber: 2,
              title: "Bài 2: Định luật Newton",
              summary: "Ba định luật Newton",
              sortOrder: 2,
              durationSeconds: 1200,
              isPublished: true,
              isPublicPreview: false,
              revision: 5,
              updatedAt: "2026-11-15T10:05:00Z",
              videoPartCount: 1,
              counts: { videos: 1, vocab: 3, formulas: 3, files: 0, quizzes: 0, assignments: 1 },
              theory: { hasTheory: true, hasTranscript: false },
              quizzes: [],
              assignments: [{ assignmentId: "as-1", title: "Bài tập Newton", submissionType: "text" }],
              files: [],
            },
          ],
        },
        {
          profileId: "prof_mir_501",
          courseId: "501",
          externalOfferingId: "moly:off_501",
          mode: "MIRROR",
          title: "Lớp Live Song Song",
          status: "active",
          revision: 4,
          capabilities: { allowFileDownload: false, deviceLimit: 2 },
          sections: [{ sectionId: "sec:mir-1", title: "Buổi Live Chuyên đề", sortOrder: 1 }],
          units: [
            {
              unitType: "class_session",
              unitId: "201",
              sectionId: "sec:mir-1",
              sectionTitle: "Buổi Live Chuyên đề",
              sectionSortOrder: 1,
              sessionNumber: 1,
              title: "Buổi 1: Ôn tập Live Cơ học",
              summary: "Record từ lớp Zoom",
              sortOrder: 1,
              durationSeconds: 1800,
              isPublished: true,
              isPublicPreview: false,
              revision: 4,
              updatedAt: "2026-11-15T10:10:00Z",
              videoPartCount: 1,
              counts: { videos: 1, vocab: 2, formulas: 1, files: 1, quizzes: 0, assignments: 0 },
              theory: { hasTheory: true, hasTranscript: true },
              quizzes: [],
              assignments: [],
              files: [
                {
                  fileId: "file-mir-1",
                  title: "Phiếu bài tập Live",
                  originalFilename: "phieu-bt.pdf",
                  mimeType: "application/pdf",
                  fileKind: "worksheet",
                  sizeBytes: 120000,
                  isSlide: false,
                  sortOrder: 0,
                  isPublished: true,
                },
              ],
            },
          ],
        },
      ],
      hasMore: false,
      nextCursor: null,
    },
  };

  const envCtx = await setupDay3MolyEnv(t, async ({ url }) => {
    if (url.startsWith("/api/integrations/v2/catalog/courses/501/curriculum")) {
      return { status: 200, body: { success: true, data: curriculumPages["501"] } };
    }
    return { status: 404, body: { success: false, code: "NOT_FOUND" } };
  });

  // Seed synced csca_course + 2 profiles + native course for non-regression isolation check
  await envCtx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, content_origin, status, subject_code, level)
    VALUES
      (501, 'csca-course:501', 'vat-ly-day3', 'Vật Lý CSCA Day 3', 'csca_course', 'published', 'PHYSICS', 'basic'),
      (599, NULL, 'native-khong-doi', 'Native Course 599', 'moly_native', 'published', 'MATH', 'basic')
  `);
  await envCtx.db.query(`
    INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at)
    VALUES
      ('csca-course', 'prof_ind_501', 'moly:off_501', '501', 501, 'INDEPENDENT', 'Lộ trình Video Tự Chủ', 'active', 5, NOW()),
      ('csca-course', 'prof_mir_501', 'moly:off_501', '501', 501, 'MIRROR', 'Lớp Live Song Song', 'active', 4, NOW())
  `);
  await envCtx.db.query(`
    INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
    VALUES ('moly', 'moly:off_501', 501, 'active')
  `);

  const app = buildAdminAndV2App(envCtx);
  const res = await request(app)
    .post("/api/admin/course-integrations/catalog/courses/501/curriculum/backfill")
    .send({ limit: 100 });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.coursesProcessed, 1);
  assert.equal(res.body.data.unitsApplied, 3);

  const unitsRes = await envCtx.db.query(
    `SELECT u.*, p.remote_profile_id, p.mode
     FROM course_unit_projections u
     JOIN course_profile_projections p ON p.id = u.profile_projection_id
     ORDER BY u.id ASC`,
  );
  assert.equal(unitsRes.rows.length, 3);
  assert.equal(unitsRes.rows.filter((u) => u.mode === "INDEPENDENT").length, 2);
  assert.equal(unitsRes.rows.filter((u) => u.mode === "MIRROR" && u.unit_type === "class_session").length, 1);

  const filesRes = await envCtx.db.query(`SELECT * FROM course_file_projections ORDER BY id ASC`);
  assert.equal(filesRes.rows.length, 2);

  // Course totals derived from primary/active profile projection (INDEPENDENT = 2 lessons, 1 section, 2100s)
  const courseRow = (await envCtx.db.query(`SELECT total_sections, total_lessons, total_duration_seconds FROM courses WHERE id = 501`)).rows[0];
  assert.equal(Number(courseRow.total_sections), 1);
  assert.equal(Number(courseRow.total_lessons), 2);
  assert.equal(Number(courseRow.total_duration_seconds), 2100);

  // Zero writes to native course_sections / course_lessons / course_enrollments!
  assert.equal((await envCtx.db.query(`SELECT COUNT(*)::int AS c FROM course_sections WHERE course_id = 501`)).rows[0].c, 0);
  assert.equal((await envCtx.db.query(`SELECT COUNT(*)::int AS c FROM course_lessons WHERE course_id = 501`)).rows[0].c, 0);
  assert.equal((await envCtx.db.query(`SELECT COUNT(*)::int AS c FROM course_enrollments WHERE course_id = 501`)).rows[0].c, 0);
});

test("Day 3 webhook ingestion handles curriculum.upserted, unit_content.upserted, stale rejection, and curriculum.tombstoned", async (t) => {
  const envCtx = await setupDay3MolyEnv(t);
  await envCtx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, content_origin, status, subject_code, level)
    VALUES (601, 'csca-course:601', 'hoa-day3', 'Hóa Học Day 3', 'csca_course', 'published', 'CHEMISTRY', 'basic')
  `);
  await envCtx.db.query(`
    INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at)
    VALUES ('csca-course', 'prof_601', 'moly:off_601', '601', 601, 'INDEPENDENT', 'Tự học Hóa', 'active', 2, NOW())
  `);

  const app = buildAdminAndV2App(envCtx);

  // 1) Push curriculum.upserted rev 10
  const ev1 = {
    schemaVersion: "2.0",
    eventId: "evt_curr_up_10",
    idempotencyKey: "curr:601:rev10",
    eventType: "curriculum.upserted",
    sourceSystem: "csca-course",
    aggregateType: "curriculum",
    aggregateId: "course:601",
    revision: 10,
    deleted: false,
    sourceUpdatedAt: "2026-11-15T11:00:00Z",
    occurredAt: "2026-11-15T11:00:00Z",
    payload: {
      profiles: [
        {
          profileId: "prof_601",
          courseId: "601",
          mode: "INDEPENDENT",
          capabilities: { allowFileDownload: true, deviceLimit: 2 },
          sections: [{ sectionId: "sec:1", title: "Chương 1", sortOrder: 1 }],
          units: [
            {
              unitType: "lesson",
              unitId: "701",
              sectionId: "sec:1",
              sectionTitle: "Chương 1",
              sectionSortOrder: 1,
              title: "Bài Hóa 1 rev10",
              sortOrder: 1,
              durationSeconds: 600,
              isPublished: true,
              isPublicPreview: true,
              revision: 10,
              updatedAt: "2026-11-15T11:00:00Z",
              videoPartCount: 1,
              counts: { videos: 1, vocab: 1, formulas: 1, files: 1, quizzes: 0, assignments: 0 },
              theory: { hasTheory: true, hasTranscript: true },
              files: [
                { fileId: "f-701", title: "Tài liệu Hóa", originalFilename: "hoa.pdf", mimeType: "application/pdf", fileKind: "document", sizeBytes: 50000, isSlide: false },
              ],
            },
            {
              unitType: "lesson",
              unitId: "702",
              sectionId: "sec:1",
              sectionTitle: "Chương 1",
              sectionSortOrder: 1,
              title: "Bài Hóa 2 rev10",
              sortOrder: 2,
              durationSeconds: 500,
              isPublished: true,
              isPublicPreview: false,
              revision: 10,
              updatedAt: "2026-11-15T11:00:00Z",
              videoPartCount: 1,
              counts: { videos: 1, vocab: 0, formulas: 0, files: 0, quizzes: 0, assignments: 0 },
              theory: { hasTheory: false, hasTranscript: false },
              files: [],
            },
          ],
        },
      ],
    },
  };
  const req1 = signInboundBody(ev1);
  const res1 = await request(app).post("/api/integrations/v2/events/ingest").set(req1.headers).send(req1.rawBody);
  assert.equal(res1.status, 202);
  assert.equal(res1.body.data.results[0].unitsApplied, 2);

  // 2) unit_content.upserted bumps unit 701 to rev 12 and changes title + counts
  const ev2 = {
    schemaVersion: "2.0",
    eventId: "evt_unit_up_12",
    idempotencyKey: "unit:701:rev12",
    eventType: "unit_content.upserted",
    sourceSystem: "csca-course",
    aggregateType: "unit_content",
    aggregateId: "lesson:701",
    revision: 12,
    deleted: false,
    sourceUpdatedAt: "2026-11-15T11:05:00Z",
    occurredAt: "2026-11-15T11:05:00Z",
    payload: {
      profiles: [
        {
          profileId: "prof_601",
          capabilities: { allowFileDownload: false, deviceLimit: 3 },
          unit: {
            unitType: "lesson",
            unitId: "701",
            sectionId: "sec:1",
            sectionTitle: "Chương 1",
            sectionSortOrder: 1,
            title: "Bài Hóa 1 Updated rev12",
            sortOrder: 1,
            durationSeconds: 750,
            isPublished: true,
            isPublicPreview: true,
            revision: 12,
            updatedAt: "2026-11-15T11:05:00Z",
            videoPartCount: 3,
            counts: { videos: 3, vocab: 6, formulas: 4, files: 1, quizzes: 2, assignments: 0 },
            theory: { hasTheory: true, hasTranscript: true },
            files: [
              { fileId: "f-701", title: "Tài liệu Hóa", originalFilename: "hoa.pdf", mimeType: "application/pdf", fileKind: "document", sizeBytes: 50000, isSlide: false },
            ],
          },
        },
      ],
    },
  };
  const req2 = signInboundBody(ev2);
  const res2 = await request(app).post("/api/integrations/v2/events/ingest").set(req2.headers).send(req2.rawBody);
  assert.equal(res2.status, 202);
  assert.equal(res2.body.data.results[0].unitsApplied, 1);

  const unit701AfterUp = (await envCtx.db.query(`SELECT title, last_revision, video_part_count, vocab_count FROM course_unit_projections WHERE remote_unit_id = '701'`)).rows[0];
  assert.equal(unit701AfterUp.title, "Bài Hóa 1 Updated rev12");
  assert.equal(Number(unit701AfterUp.last_revision), 12);
  assert.equal(Number(unit701AfterUp.video_part_count), 3);

  // 3) Out-of-order stale unit_content.upserted rev 9 must NOT overwrite rev 12
  const evStale = {
    schemaVersion: "2.0",
    eventId: "evt_unit_stale_9",
    idempotencyKey: "unit:701:rev9",
    eventType: "unit_content.upserted",
    sourceSystem: "csca-course",
    aggregateType: "unit_content",
    aggregateId: "lesson:701",
    revision: 9,
    deleted: false,
    sourceUpdatedAt: "2026-11-15T10:50:00Z",
    occurredAt: "2026-11-15T10:50:00Z",
    payload: {
      profiles: [
        {
          profileId: "prof_601",
          unit: {
            unitType: "lesson",
            unitId: "701",
            sectionId: "sec:1",
            sectionTitle: "Chương 1",
            sectionSortOrder: 1,
            title: "STALE REGRESSION TITLE",
            sortOrder: 1,
            durationSeconds: 100,
            isPublished: true,
            revision: 9,
            updatedAt: "2026-11-15T10:50:00Z",
            files: [],
          },
        },
      ],
    },
  };
  const reqStale = signInboundBody(evStale);
  const resStale = await request(app).post("/api/integrations/v2/events/ingest").set(reqStale.headers).send(reqStale.rawBody);
  assert.equal(resStale.status, 202);
  assert.equal(resStale.body.data.results[0].inboxStatus, "stale");

  const unit701Still12 = (await envCtx.db.query(`SELECT title, last_revision FROM course_unit_projections WHERE remote_unit_id = '701'`)).rows[0];
  assert.equal(unit701Still12.title, "Bài Hóa 1 Updated rev12");
  assert.equal(Number(unit701Still12.last_revision), 12);

  // 4) curriculum.tombstoned marks unit 702 + children soft-deleted
  const evTomb = {
    schemaVersion: "2.0",
    eventId: "evt_curr_tomb_13",
    idempotencyKey: "curr:601:tomb13",
    eventType: "curriculum.tombstoned",
    sourceSystem: "csca-course",
    aggregateType: "curriculum",
    aggregateId: "lesson:702",
    revision: 13,
    deleted: true,
    deletedAt: "2026-11-15T11:10:00Z",
    sourceUpdatedAt: "2026-11-15T11:10:00Z",
    occurredAt: "2026-11-15T11:10:00Z",
    payload: {
      courseId: "601",
      profileIds: ["prof_601"],
      tombstonedUnits: [
        { unitType: "lesson", unitId: "702", deletedAt: "2026-11-15T11:10:00Z" },
      ],
    },
  };
  const reqTomb = signInboundBody(evTomb);
  const resTomb = await request(app).post("/api/integrations/v2/events/ingest").set(reqTomb.headers).send(reqTomb.rawBody);
  assert.equal(resTomb.status, 202);
  assert.equal(resTomb.body.data.results[0].tombstonedCount, 1);

  const unit702Row = (await envCtx.db.query(`SELECT deleted_at, is_published FROM course_unit_projections WHERE remote_unit_id = '702'`)).rows[0];
  assert.ok(unit702Row.deleted_at != null);
  assert.equal(unit702Row.is_published, false);
});

test("Day 3 landing & MyLearning expose projected MIRROR/INDEPENDENT units while keeping moly_native untouched", async (t) => {
  const envCtx = await setupDay3MolyEnv(t);
  const learner = (await envCtx.db.query(
    `INSERT INTO users (email, username, full_name, role, is_active, is_verified)
     VALUES ('student.day3@example.com', 'student_day3', 'Hoc Vien Day 3', 'student', true, true) RETURNING *`,
  )).rows[0];

  await envCtx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, content_origin, status, access_type, subject_code, level, total_sections, total_lessons, total_duration_seconds)
    VALUES
      (801, 'csca-course:801', 'toan-day3', 'Toán CSCA Day 3', 'csca_course', 'published', 'package', 'MATH', 'basic', 1, 2, 1500),
      (802, NULL, 'native-day3', 'Khóa Native Day 3', 'moly_native', 'published', 'free', 'MATH', 'basic', 1, 1, 600)
  `);
  await envCtx.db.query(`
    INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
    VALUES ('moly', 'moly:off_801', 801, 'active')
  `);
  await envCtx.db.query(
    `INSERT INTO external_entitlements (source_system, external_grant_id, external_user_id, external_course_id, user_id, local_course_id, status, effective_owned, source_updated_at)
     VALUES ('csca-course', 'g-801', 'csca-course:8010', 'moly:off_801', $1, 801, 'active', TRUE, NOW())`,
    [learner.id],
  );
  const profRows = (await envCtx.db.query(`
    INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at, metadata)
    VALUES
      ('csca-course', 'p_ind_801', 'moly:off_801', '801', 801, 'INDEPENDENT', 'Tự học Toán', 'active', 2, NOW(), '{"capabilities":{"allowFileDownload":true}}'::jsonb),
      ('csca-course', 'p_mir_801', 'moly:off_801', '801', 801, 'MIRROR', 'Live Toán', 'active', 2, NOW(), '{"capabilities":{"allowFileDownload":false}}'::jsonb)
    RETURNING id, remote_profile_id, mode
  `)).rows;
  const indProf = profRows.find((r) => r.remote_profile_id === "p_ind_801");
  const mirProf = profRows.find((r) => r.remote_profile_id === "p_mir_801");

  await envCtx.db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
       unit_type, remote_unit_id, title, sort_order, duration_seconds, is_published, is_public_preview,
       video_part_count, has_theory, vocab_count, formula_count, file_count, quiz_count, assignment_count, last_revision, source_updated_at
     ) VALUES
       ($1, 801, 'sec:ind', 'Chương Video', 1, 'lesson', '9001', 'Bài 1 Independent', 1, 900, TRUE, TRUE, 2, TRUE, 5, 3, 1, 1, 0, 2, NOW()),
       ($1, 801, 'sec:ind', 'Chương Video', 1, 'lesson', '9002', 'Bài 2 Independent', 2, 600, TRUE, FALSE, 1, FALSE, 0, 1, 0, 0, 1, 2, NOW()),
       ($2, 801, 'sec:mir', 'Buổi Live', 1, 'class_session', '9501', 'Buổi 1 Mirror', 1, 1800, TRUE, FALSE, 1, TRUE, 2, 1, 1, 0, 0, 2, NOW())`,
    [indProf.id, mirProf.id],
  );

  // Native course section & lesson & enrollment
  const secId = (await envCtx.db.query(`INSERT INTO course_sections (course_id, title, sort_order) VALUES (802, 'Native Sec 1', 1) RETURNING id`)).rows[0].id;
  await envCtx.db.query(`INSERT INTO course_lessons (course_id, section_id, title, slug, sort_order, effective_duration_seconds) VALUES (802, $1, 'Native Lesson 1', 'native-1', 1, 600)`, [secId]);
  await envCtx.db.query(`INSERT INTO course_enrollments (user_id, course_id, status, source) VALUES ($1, 802, 'active', 'free')`, [learner.id]);

  // Landing default profile
  const landingDefault = await envCtx.courseService.getCourseLanding("toan-day3", { id: learner.id, role: "student" });
  assert.equal(landingDefault.activeProfileId, "p_ind_801");
  assert.equal(landingDefault.projectedProfiles.length, 2);
  assert.equal(landingDefault.curriculum.length, 1);
  assert.equal(landingDefault.curriculum[0].lessons.length, 2);
  assert.match(landingDefault.curriculum[0].lessons[0].id, /^u-\d+$/);
  assert.match(landingDefault.curriculum[0].lessons[0].href, /^\/hoc\/toan-day3\/bai-hoc\/u-\d+\?profileId=p_ind_801$/);
  assert.equal(landingDefault.firstUnitHref, landingDefault.curriculum[0].lessons[0].href);

  // Landing switched to MIRROR profile via ?profileId=p_mir_801
  const landingMirror = await envCtx.courseService.getCourseLanding("toan-day3", { id: learner.id, role: "student" }, { profileId: "p_mir_801" });
  assert.equal(landingMirror.activeProfileId, "p_mir_801");
  assert.equal(landingMirror.curriculum[0].lessons.length, 1);
  assert.equal(landingMirror.curriculum[0].lessons[0].title, "Buổi 1 Mirror");
  assert.match(landingMirror.curriculum[0].lessons[0].href, /\?profileId=p_mir_801$/);

  // Native landing remains completely untouched
  const nativeLanding = await envCtx.courseService.getCourseLanding("native-day3", { id: learner.id, role: "student" });
  assert.equal(nativeLanding.curriculum[0].lessons[0].title, "Native Lesson 1");

  // MyLearning returns firstUnitHref & mōly_workspace PLUS ssoTargetPath fallback
  const enrollments = await envCtx.learningService.listMyEnrollments({ id: learner.id, role: "student" });
  const extEnr = enrollments.find((e) => e.course.id === 801);
  const natEnr = enrollments.find((e) => e.course.id === 802);
  assert.ok(extEnr);
  assert.equal(extEnr.course.learningDestination, "moly_workspace");
  assert.match(extEnr.course.firstUnitHref, /^\/hoc\/toan-day3\/bai-hoc\/u-\d+\?profileId=p_ind_801$/);
  assert.equal(extEnr.course.ssoTargetPath, "/video-courses/moly:off_801");
  assert.ok(natEnr);
  assert.equal(natEnr.course.contentOrigin, undefined);
});

test("Day 3 workspace HTTP endpoints enforce JWT identity, preview-only fallback, UNIT_LOCKED, PROFILE_SCOPE_MISMATCH, and revoked grants", async (t) => {
  let activeStubScenario = "ok";
  const mintedCalls = [];

  const envCtx = await setupDay3MolyEnv(t, async ({ method, url, body }) => {
    if (method === "POST" && url === "/api/integrations/v2/learning/sessions") {
      mintedCalls.push(body);
      return {
        status: 201,
        body: {
          success: true,
          data: {
            sessionToken: "dlg_tok_abc123",
            expiresAt: "2026-11-15T12:00:00Z",
            ttlSeconds: 240,
            scopes: body.scopes,
          },
        },
      };
    }
    if (method === "GET" && url.startsWith("/api/integrations/v2/learning/offerings/") && url.includes("/workspace")) {
      if (activeStubScenario === "unit_locked") {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              videoCourseProfileId: "prof_ws_901",
              mode: "RECORD_INDEPENDENT",
              capabilities: { allowFileDownload: true, deviceLimit: 2 },
              units: [
                { id: "1001", type: "lesson", isLocked: false, isCompleted: false, progressPercent: 0 },
                { id: "1002", type: "lesson", isLocked: true, isCompleted: false, progressPercent: 0, lockReason: "Cần hoàn thành bài 1 trước." },
              ],
              activeUnit: null,
              selectedUnitLock: { locked: true, code: "UNIT_LOCKED", reason: "Cần hoàn thành bài 1 trước." },
            },
          },
        };
      }
      return {
        status: 200,
        body: {
          success: true,
          data: {
            videoCourseProfileId: "prof_ws_901",
            mode: "RECORD_INDEPENDENT",
            capabilities: { allowFileDownload: true, deviceLimit: 2, canPlayVideo: true },
            progress: { completedUnits: 1, totalUnits: 2, overallPercent: 50 },
            units: [
              { id: "1001", type: "lesson", isLocked: false, isCompleted: true, progressPercent: 100 },
              { id: "1002", type: "lesson", isLocked: false, isCompleted: false, progressPercent: 35 },
            ],
            activeUnit: {
              id: "1001",
              unitType: "lesson",
              title: "Bài 1 Live Workspace",
              video: { id: "asset-1", assetId: "asset-1", partNumber: 1, title: "Phần 1", provider: "bunny_stream", durationSeconds: 600 },
              videos: [{ id: "asset-1", assetId: "asset-1", partNumber: 1, title: "Phần 1", provider: "bunny_stream", durationSeconds: 600 }],
              theory: { title: "Lý thuyết", contentHtml: "<p>Nội dung an toàn</p>", transcript: "00:10 Mở đầu" },
              vocabulary: [{ term: "力", pinyin: "lì", sinoVietnamese: "lực", meaning: "lực" }],
              formulas: [{ nameVi: "Định luật II Newton", latexExpression: "F = m \\cdot a" }],
              files: [{ id: "f-1001", title: "Slide bài 1", fileName: "slide1.pdf", mimeType: "application/pdf", fileKind: "slide", sizeBytes: 1024, allowView: true, allowDownload: true }],
              quizzes: [{ id: "q-1", title: "Quiz 1", durationMinutes: 15, passingScore: 60, attemptsCount: 0, isCompleted: false }],
              assignments: [],
            },
          },
        },
      };
    }
    if (method === "GET" && url.startsWith("/api/integrations/v2/learning/offerings/") && url.includes("/units/")) {
      if (activeStubScenario === "unit_locked") {
        return {
          status: 403,
          body: {
            success: false,
            code: "UNIT_LOCKED",
            errorCode: "UNIT_LOCKED",
            message: "Bài học này đang bị khóa theo thứ tự.",
          },
        };
      }
      return {
        status: 200,
        body: {
          success: true,
          data: {
            id: "1002",
            unitType: "lesson",
            title: "Bài 2 Unlocked Detail",
            videos: [{ id: "asset-2", assetId: "asset-2", partNumber: 1, title: "Phần 1", provider: "bunny_stream", durationSeconds: 600 }],
            theory: null,
            vocabulary: [],
            formulas: [],
            files: [],
            quizzes: [],
            assignments: [],
          },
        },
      };
    }
    if (method === "GET" && url.startsWith("/api/integrations/v2/learning/preview/offerings/")) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            videoCourseProfileId: "prof_ws_901",
            mode: "RECORD_INDEPENDENT",
            capabilities: { allowFileDownload: false, isPublicPreviewAccess: true },
            units: [
              { id: "1001", type: "lesson", isLocked: false, isPublicPreview: true },
              { id: "1002", type: "lesson", isLocked: true, isPublicPreview: false },
            ],
            activeUnit: {
              id: "1001",
              unitType: "lesson",
              title: "Bài 1 Public Preview",
              isPublicPreview: true,
              videos: [{ id: "asset-1", assetId: "asset-1", partNumber: 1, title: "Preview Part", provider: "bunny_stream", durationSeconds: 300 }],
              theory: { title: "Mở đầu", contentHtml: "<p>Học thử miễn phí</p>" },
              vocabulary: [],
              formulas: [],
              files: [],
              quizzes: [],
              assignments: [],
            },
          },
        },
      };
    }
    return { status: 404, body: { success: false, code: "NOT_FOUND" } };
  });

  const usersRes = (await envCtx.db.query(`
    INSERT INTO users (email, username, role, is_active, is_verified)
    VALUES
      ('entitled@example.com', 'entitled_u', 'student', true, true),
      ('revoked@example.com', 'revoked_u', 'student', true, true)
    RETURNING id, email
  `)).rows;
  const entitledUser = usersRes[0];
  const revokedUser = usersRes[1];

  await envCtx.db.query(`
    INSERT INTO courses (id, external_key, slug, title, content_origin, status, subject_code, level)
    VALUES
      (901, 'csca-course:901', 'ly-ws-day3', 'Lý Workspace 901', 'csca_course', 'published', 'PHYSICS', 'basic'),
      (902, 'csca-course:902', 'hoa-ws-day3', 'Hóa Workspace 902', 'csca_course', 'published', 'CHEMISTRY', 'basic')
  `);
  await envCtx.db.query(`
    INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id, status)
    VALUES
      ('moly', 'moly:off_901', 901, 'active'),
      ('moly', 'moly:off_902', 902, 'active')
  `);
  await envCtx.db.query(
    `INSERT INTO external_entitlements (source_system, external_grant_id, external_user_id, external_course_id, user_id, local_course_id, status, effective_owned, source_updated_at)
     VALUES
       ('csca-course', 'g-901-ok', 'csca-course:9011', 'moly:off_901', $1, 901, 'active', TRUE, NOW()),
       ('csca-course', 'g-901-blk', 'csca-course:9012', 'moly:off_901', $2, 901, 'suspended', FALSE, NOW())`,
    [entitledUser.id, revokedUser.id],
  );

  const prof901 = (await envCtx.db.query(`
    INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at)
    VALUES ('csca-course', 'prof_ws_901', 'moly:off_901', '901', 901, 'INDEPENDENT', 'Workspace 901', 'active', 1, NOW())
    RETURNING id
  `)).rows[0].id;
  const prof902 = (await envCtx.db.query(`
    INSERT INTO course_profile_projections (source_system, remote_profile_id, external_offering_id, remote_course_id, local_course_id, mode, badge_label, status, last_revision, source_updated_at)
    VALUES ('csca-course', 'prof_ws_902', 'moly:off_902', '902', 902, 'INDEPENDENT', 'Workspace 902', 'active', 1, NOW())
    RETURNING id
  `)).rows[0].id;

  const uRows = (await envCtx.db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
       unit_type, remote_unit_id, title, sort_order, duration_seconds, is_published, is_public_preview,
       last_revision, source_updated_at
     ) VALUES
       ($1, 901, 'sec:1', 'Chương 1', 1, 'lesson', '1001', 'Bài 1 Preview', 1, 600, TRUE, TRUE, 1, NOW()),
       ($1, 901, 'sec:1', 'Chương 1', 1, 'lesson', '1002', 'Bài 2 Locked/Owned', 2, 600, TRUE, FALSE, 1, NOW()),
       ($2, 902, 'sec:1', 'Chương 1', 1, 'lesson', '2001', 'Bài Khóa 902', 1, 600, TRUE, TRUE, 1, NOW())
     RETURNING id, remote_unit_id`,
    [prof901, prof902],
  )).rows;
  const uPreview = uRows.find((r) => r.remote_unit_id === "1001");
  const uPaidOnly = uRows.find((r) => r.remote_unit_id === "1002");
  const uCourse902 = uRows.find((r) => r.remote_unit_id === "2001");

  const app = buildAdminAndV2App(envCtx);
  const entitledJwt = jwt.sign({ id: entitledUser.id, role: "student" }, TEST_JWT_SECRET);
  const revokedJwt = jwt.sign({ id: revokedUser.id, role: "student" }, TEST_JWT_SECRET);

  // Rollout gate is fail-closed even for a public preview unit.
  process.env.COURSE_DELEGATED_LEARNING_ENABLED = "false";
  const rolloutBlockedRes = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?unitId=u-${uPreview.id}`);
  assert.equal(rolloutBlockedRes.status, 503);
  assert.equal(rolloutBlockedRes.body.code, "DELEGATED_LEARNING_DISABLED");
  process.env.COURSE_DELEGATED_LEARNING_ENABLED = "true";

  // 1) Unauthenticated access to explicit public-preview unit -> 200 (allowFileDownload forced false)
  const previewRes = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?unitId=u-${uPreview.id}`);
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.data.isPublicPreviewAccess, true);
  assert.equal(previewRes.body.data.profile.capabilities.allowFileDownload, false);
  assert.equal(previewRes.body.data.activeUnit.title, "Bài 1 Public Preview");

  // 2) Unauthenticated access to non-preview unit -> 401 AUTH_REQUIRED
  const unauthPaidRes = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?unitId=u-${uPaidOnly.id}`);
  assert.equal(unauthPaidRes.status, 401);
  assert.equal(unauthPaidRes.body.code, "AUTH_REQUIRED");

  // 3) Entitled user -> 200, delegated session minted ONLY from JWT user ID (`moly:<entitledUser.id>`), ignoring spoofed query user_id & x-device-id
  mintedCalls.length = 0;
  const wsRes = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?user_id=99999&unitId=u-${uPreview.id}`)
    .set("Authorization", `Bearer ${entitledJwt}`)
    .set("X-Device-Id", "spoofed-device-abc");
  assert.equal(wsRes.status, 200);
  assert.equal(wsRes.body.data.isPublicPreviewAccess, false);
  assert.equal(mintedCalls.length, 1);
  assert.equal(mintedCalls[0].externalUserId, `moly:${entitledUser.id}`);
  assert.equal(wsRes.body.data.activeUnit.projectionSlug, `u-${uPreview.id}`);

  // 4) Sequential lock -> 403 UNIT_LOCKED propagated from CSCA-Course v2
  activeStubScenario = "unit_locked";
  const lockedUnitRes = await request(app)
    .get(`/api/learning/external/offerings/prof_ws_901/units/u-${uPaidOnly.id}?courseId=901`)
    .set("Authorization", `Bearer ${entitledJwt}`);
  assert.equal(lockedUnitRes.status, 403);
  assert.equal(lockedUnitRes.body.code, "UNIT_LOCKED");

  // 5) Cross-profile / cross-course mismatch -> 409 PROFILE_SCOPE_MISMATCH
  activeStubScenario = "ok";
  const scopeMismatchProf = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?profileId=prof_ws_902`)
    .set("Authorization", `Bearer ${entitledJwt}`);
  assert.equal(scopeMismatchProf.status, 409);
  assert.equal(scopeMismatchProf.body.code, "PROFILE_SCOPE_MISMATCH");

  const scopeMismatchUnit = await request(app)
    .get(`/api/learning/external/offerings/prof_ws_901/units/u-${uCourse902.id}`)
    .set("Authorization", `Bearer ${entitledJwt}`);
  assert.equal(scopeMismatchUnit.status, 409);
  assert.equal(scopeMismatchUnit.body.code, "PROFILE_SCOPE_MISMATCH");

  // 6) Revoked / suspended user blocked from paid unit -> 403
  const revokedRes = await request(app)
    .get(`/api/learning/external/offerings/prof_ws_901/units/u-${uPaidOnly.id}`)
    .set("Authorization", `Bearer ${revokedJwt}`);
  assert.equal(revokedRes.status, 403);

  // 7) Admin user unlocks all units & course landing without external_entitlements row and forwards actorRole='admin'
  const adminUser = (await envCtx.db.query(
    `INSERT INTO users (email, username, role, is_active, is_verified)
     VALUES ('admin@example.com', 'admin_u', 'admin', true, true) RETURNING id, email`,
  )).rows[0];
  const adminJwt = jwt.sign({ id: adminUser.id, role: "admin", email: adminUser.email }, TEST_JWT_SECRET);
  const adminLanding = await envCtx.courseService.getCourseLanding("ly-ws-day3", { id: adminUser.id, role: "admin" });
  assert.equal(adminLanding.access.owned, true);
  assert.equal(adminLanding.access.ownershipLabel, "Quyền Admin");
  assert.equal(adminLanding.access.canLearn, true);
  assert.equal(adminLanding.curriculum[0].lessons.every((l) => l.isLocked === false), true);

  mintedCalls.length = 0;
  activeStubScenario = "unit_locked";
  const adminWsRes = await request(app)
    .get(`/api/learning/external/courses/ly-ws-day3/workspace?unitId=u-${uPaidOnly.id}`)
    .set("Authorization", `Bearer ${adminJwt}`);
  assert.equal(adminWsRes.status, 200);
  assert.equal(mintedCalls.length, 1);
  assert.equal(mintedCalls[0].actorRole, "admin");
  assert.equal(adminWsRes.body.data.units.every((u) => u.isLocked === false), true);
});
