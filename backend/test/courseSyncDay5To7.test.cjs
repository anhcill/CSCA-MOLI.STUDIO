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

const { createCourseIntegrationClient, buildMolySignature, buildMolyGetSignature } = require("../src/services/courseIntegrationClient");
const { createCourseOwnershipProjectionService } = require("../src/services/courseOwnershipProjectionService");
const { createMolyCourseCatalogSyncService } = require("../src/services/molyCourseCatalogSyncService");
const { createMolyCourseWorkspaceService } = require("../src/services/molyCourseWorkspaceService");
const { createCourseIntegrationV2Routes } = require("../src/routes/courseIntegrationV2Routes");
const { applyMigration: applyVideoCommerceMigration } = require("../scripts/apply_video_commerce_migration");
const { applyMigration: applyCourseIntegrationMigration } = require("../scripts/apply_course_integration_migration");

const OUTBOUND_CFG = {
  serviceToken: "course-service-tok-day57",
  integrationKey: "moly-v2-key",
  hmacSecret: "day57-shared-outbound-secret-999",
};

const INBOUND_CFG = {
  serviceToken: "moly-inbound-tok-day57",
  integrationKey: "csca-course-v2-key",
  hmacSecret: "day57-shared-inbound-secret-888",
};

const TEST_JWT_SECRET = "day57-test-jwt-secret-key";

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
  assert.ok(ts && sig, `Expected X-Event-Timestamp and X-Signature on ${req.method} ${req.url}`);
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

async function setupDay5To7Env(t, stubHandler) {
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
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
    CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id));
  `);

  const db = makeDbAdapter(pg);
  await applyVideoCommerceMigration(db);
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
    res.writeHead(result.status || 200, { "Content-Type": "application/json", ...(result.headers || {}) });
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
    require.resolve("../src/controllers/learningController"),
    require.resolve("../src/routes/learningRoutes"),
    require.resolve("../src/routes/meCourseRoutes"),
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

  const learningService = require("../src/services/learningService");
  const learningRoutes = require("../src/routes/learningRoutes");
  const meCourseRoutes = require("../src/routes/meCourseRoutes");

  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use("/api/integrations/v2", createCourseIntegrationV2Routes({
    catalogSync,
    inboundConfig: INBOUND_CFG,
  }));
  app.use("/api/learning", learningRoutes);
  app.use("/api/me", meCourseRoutes);

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

  return { pg, db, app, client, ownership, catalogSync, workspace, learningService };
}

async function seedSyncedCourseWithTwoUnits(db, {
  courseId = 701,
  profileId = "prof-701",
  allowFileDownload = true,
  userId = 88,
  entitled = true,
} = {}) {
  await db.query(
    `INSERT INTO users (id, email, username, full_name, role)
     VALUES ($1, $2, $3, 'Learner Day57', 'student')
     ON CONFLICT (id) DO NOTHING`,
    [userId, `learner${userId}@example.com`, `learner_${userId}`],
  );
  await db.query(
    `INSERT INTO courses (id, external_key, slug, title, content_origin, remote_source_system, remote_course_id, status, price_vnd)
     VALUES ($1, $2, $3, 'Khóa Toán CSCA Synced', 'csca_course', 'csca-course', $4, 'published', 990000)`,
    [courseId, `csca-course:${courseId}`, `toan-csca-${courseId}`, String(courseId)],
  );
  const mappingRes = await db.query(
    `INSERT INTO external_course_mappings (
       source_system, external_course_id, external_course_code, external_course_title,
       local_course_id, origin_mode, remote_course_id, remote_profile_id, status, metadata
     )
     VALUES ('csca-course', $1, $2, 'Khóa Toán CSCA Synced', $3, 'profile_projection', $4, $5, 'active', $6::jsonb)
     RETURNING id`,
    [
      `moly:off_${profileId}`,
      `CODE_${courseId}`,
      courseId,
      String(courseId),
      profileId,
      JSON.stringify({ moly_external_course_id: `moly:off_${profileId}` }),
    ],
  );
  const profRes = await db.query(
    `INSERT INTO course_profile_projections (
       source_system, remote_course_id, remote_profile_id, external_offering_id,
       local_course_id, course_mapping_id, mode, badge_label, allow_file_download,
       device_limit, enforce_trusted_devices, status, checkout_ready, last_revision, source_updated_at
     )
     VALUES ('csca-course', $1, $2, $3, $4, $5, 'INDEPENDENT', 'Tự học chuẩn', $6, 2, TRUE, 'active', TRUE, 1, NOW())
     RETURNING id`,
    [String(courseId), profileId, `moly:off_${profileId}`, courseId, mappingRes.rows[0].id, allowFileDownload],
  );
  const profProjId = Number(profRes.rows[0].id);

  const unit1 = (await db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
       unit_type, remote_unit_id, title, sort_order, duration_seconds,
       is_published, is_public_preview, video_part_count, file_count, quiz_count, assignment_count,
       last_revision, source_updated_at
     )
     VALUES ($1, $2, 'sec-1', 'Chương 1', 1, 'lesson', 'u-101', 'Bài 1: Khởi động', 1, 600, TRUE, TRUE, 1, 1, 1, 1, 1, NOW())
     RETURNING *`,
    [profProjId, courseId],
  )).rows[0];

  const unit2 = (await db.query(
    `INSERT INTO course_unit_projections (
       profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order,
       unit_type, remote_unit_id, title, sort_order, duration_seconds,
       is_published, is_public_preview, video_part_count, file_count, quiz_count, assignment_count,
       last_revision, source_updated_at
     )
     VALUES ($1, $2, 'sec-1', 'Chương 1', 1, 'lesson', 'u-102', 'Bài 2: Nâng cao', 2, 720, TRUE, FALSE, 1, 0, 0, 0, 1, NOW())
     RETURNING *`,
    [profProjId, courseId],
  )).rows[0];

  await db.query(
    `INSERT INTO course_file_projections (
       profile_projection_id, unit_projection_id, remote_file_id, title, original_filename,
       mime_type, file_kind, size_bytes, is_slide, allow_download_override, sort_order,
       is_published, last_revision, source_updated_at, placements_json, allow_view_override
     )
     VALUES ($1, $2, 'file-901', 'Đề thi mẫu PDF', 'Đề_thi_Vật_Lý.pdf',
       'application/pdf', 'slide', 40, TRUE, NULL, 0, TRUE, 1, NOW(), '[{"slot":"unit_slide"}]'::jsonb, TRUE)`,
    [profProjId, Number(unit1.id)],
  );

  if (entitled) {
    await db.query(
      `INSERT INTO external_identities (user_id, source_system, external_user_id, status, source_updated_at)
       VALUES ($1, 'csca-course', $2, 'active', NOW())
       ON CONFLICT DO NOTHING`,
      [userId, `moly:${userId}`],
    );
    await db.query(
      `INSERT INTO external_entitlements (
         user_id, source_system, external_user_id, external_course_id, local_course_id,
         external_grant_id, status, effective_owned, valid_from, source_updated_at
       )
       VALUES ($1, 'csca-course', $2, $3, $4, $5, 'active', TRUE, NOW(), NOW())`,
      [userId, `moly:${userId}`, `moly:off_${profileId}`, courseId, `grant-${userId}-${courseId}`],
    );
  }

  const token = jwt.sign({ id: userId, role: "student", email: `learner${userId}@example.com` }, TEST_JWT_SECRET);
  return { profProjId, unit1, unit2, token };
}

test("Migration 082 applies idempotently and enforces bookmark & Q&A stale revision triggers", async (t) => {
  const ctx = await setupDay5To7Env(t);
  const mig082 = fs.readFileSync(
    path.resolve(__dirname, "../../database/migrations/082_moly_course_sync_day5_7.sql"),
    "utf8",
  );
  // Re-run 082 a second time cleanly to confirm idempotency
  await ctx.pg.exec(mig082);

  const { profProjId } = await seedSyncedCourseWithTwoUnits(ctx.db);
  await ctx.db.query(
    `INSERT INTO course_bookmark_projections (
       user_id, profile_projection_id, unit_type, remote_unit_id, remote_bookmark_id,
       video_asset_id, timestamp_seconds, label, last_revision, source_updated_at
     ) VALUES (88, $1, 'lesson', 'u-101', 'bm-1', 'vid-1', 45, 'Công thức 1', 3, '2026-11-15T10:00:00Z')`,
    [profProjId],
  );
  await assert.rejects(
    ctx.db.query(
      `UPDATE course_bookmark_projections SET last_revision = 2, source_updated_at = '2026-11-15T11:00:00Z' WHERE remote_bookmark_id = 'bm-1'`,
    ),
    /STALE_REVISION_REGRESSION/,
  );

  await ctx.db.query(
    `INSERT INTO course_qa_thread_projections (
       profile_projection_id, unit_type, remote_unit_id, remote_thread_id,
       title, status, message_count, messages_json, last_revision, source_updated_at
     ) VALUES ($1, 'lesson', 'u-101', 'qa-1', 'Hỏi bài 1', 'open', 1, '[]'::jsonb, 4, '2026-11-15T10:00:00Z')`,
    [profProjId],
  );
  await assert.rejects(
    ctx.db.query(
      `UPDATE course_qa_thread_projections SET last_revision = 3, source_updated_at = '2026-11-15T11:00:00Z' WHERE remote_thread_id = 'qa-1'`,
    ),
    /STALE_REVISION_REGRESSION/,
  );
});

test("Day 5 delegated file streaming: Range 206, RFC 5987 Unicode filename, allow_file_download policy, preview vs auth, no R2 leak, & file.* inbox events", async (t) => {
  const samplePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\n", "utf8");
  const upstreamCalls = [];

  const ctx = await setupDay5To7Env(t, async ({ method, url, headers, body }) => {
    upstreamCalls.push({ method, url, headers, body });
    if (method === "POST" && url.endsWith("/learning/sessions")) {
      return {
        status: 201,
        body: {
          success: true,
          data: { sessionToken: "dsess-day5", sessionId: "dsess-id-5", expiresAt: new Date(Date.now() + 240_000).toISOString() },
        },
      };
    }
    if (method === "GET" && url.includes("/learning/files/file-901/stream")) {
      const parsed = new URL(url, "http://stub.local");
      const mode = parsed.searchParams.get("mode");
      const disp = parsed.searchParams.get("disposition");
      if (mode === "metadata") {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              fileId: "file-901",
              title: "Đề thi mẫu PDF",
              originalFilename: "Đề_thi_Vật_Lý.pdf",
              mimeType: "application/pdf",
              sizeBytes: samplePdf.length,
              signedUrl: "https://secret-r2.example.com/should-be-stripped",
            },
          },
        };
      }
      if (headers.range === "bytes=0-9") {
        return {
          status: 206,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Range": `bytes 0-9/${samplePdf.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": "10",
            "Content-Disposition": `${disp}; filename="fallback.pdf"`,
          },
          rawBuffer: samplePdf.subarray(0, 10),
        };
      }
      return {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Accept-Ranges": "bytes",
          "Content-Length": String(samplePdf.length),
        },
        rawBuffer: samplePdf,
      };
    }
    if (method === "GET" && url.includes("/learning/files/file-embargo/stream")) {
      return {
        status: 403,
        body: { success: false, errorCode: "SOLUTION_EMBARGOED", message: "Lời giải đang bị khóa." },
      };
    }
    return { status: 404, body: { success: false, code: "NOT_FOUND" } };
  });

  // 1) Entitled learner with allow_file_download = false -> inline 206 Range + Unicode header, attachment -> 403 FILE_DOWNLOAD_FORBIDDEN
  const { profProjId, unit1, unit2, token } = await seedSyncedCourseWithTwoUnits(ctx.db, {
    courseId: 702,
    profileId: "prof-702",
    allowFileDownload: false,
    userId: 89,
  });

  const rangeRes = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-901/stream?disposition=inline`)
    .set("Authorization", `Bearer ${token}`)
    .set("Range", "bytes=0-9");
  assert.equal(rangeRes.status, 206);
  assert.equal(rangeRes.headers["content-range"], `bytes 0-9/${samplePdf.length}`);
  assert.equal(rangeRes.headers["accept-ranges"], "bytes");
  assert.equal(rangeRes.headers["cache-control"], "private, no-store");
  assert.equal(rangeRes.headers["x-frame-options"], "SAMEORIGIN");
  assert.ok(rangeRes.headers["content-disposition"].startsWith("inline;"));
  assert.ok(rangeRes.headers["content-disposition"].includes("filename*=UTF-8''"));
  assert.equal(Buffer.from(rangeRes.body).toString("utf8"), samplePdf.subarray(0, 10).toString("utf8"));

  // Check session mint scopes exclude file:download when allow_file_download=false, include Day 6/7 scopes
  const mintCall = upstreamCalls.find((c) => c.url.endsWith("/learning/sessions"));
  assert.ok(mintCall);
  assert.equal(mintCall.body.scopes.includes("file:download"), false);
  for (const s of ["quiz:attempt", "assignment:submit", "notes:rw", "bookmarks:rw", "qa:rw"]) {
    assert.ok(mintCall.body.scopes.includes(s), `Missing scope ${s}`);
  }

  // Attachment forbidden when allow_file_download=false
  const dlForbidden = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-901/stream?disposition=attachment`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(dlForbidden.status, 403);
  assert.equal(dlForbidden.body.errorCode, "FILE_DOWNLOAD_FORBIDDEN");

  // Metadata mode strips sensitive signedUrl / r2Key
  const metaRes = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-901/stream?mode=metadata`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(metaRes.status, 200);
  assert.equal(metaRes.body.data.fileId, "file-901");
  assert.equal(metaRes.body.data.signedUrl, undefined);

  // Solution embargo mapped cleanly
  const embargoRes = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-embargo/stream`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(embargoRes.status, 403);
  assert.equal(embargoRes.body.errorCode, "SOLUTION_EMBARGOED");

  // Public preview: unauthenticated allowed inline on public preview unit1, forbidden on attachment or non-preview unit2
  const previewOk = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-901/stream?disposition=inline`);
  assert.equal(previewOk.status, 200);
  assert.equal(previewOk.headers["cache-control"], "private, no-store");

  const previewAttachmentForbidden = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit1.id}/files/file-901/stream?disposition=attachment`);
  assert.equal(previewAttachmentForbidden.status, 403);
  assert.equal(previewAttachmentForbidden.body.errorCode, "FILE_DOWNLOAD_FORBIDDEN");

  const nonPreviewUnauth = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-702/units/u-${unit2.id}/files/file-901/stream`);
  assert.equal(nonPreviewUnauth.status, 401);

  // Inbox file.upserted + stale rejection + file.tombstoned (soft tombstone, never hard delete)
  const upsertEvent = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-file-upsert-2",
    eventType: "file.upserted",
    aggregateType: "file",
    aggregateId: "file:file-901",
    revision: 2,
    sourceUpdatedAt: "2026-11-15T12:00:00Z",
    payload: {
      profileId: "prof-702",
      unitId: "u-101",
      fileId: "file-901",
      title: "Đề thi mẫu PDF v2",
      placements: [{ slot: "unit_slide", sortOrder: 1 }],
      allowViewOverride: true,
      allowDownloadOverride: true,
      isSlide: true,
    },
  };
  const signedUpsert = signInboundBody(upsertEvent);
  const ingest1 = await request(ctx.app).post("/api/integrations/v2/events/ingest").set(signedUpsert.headers).send(signedUpsert.rawBody);
  assert.equal(ingest1.status, 202);
  assert.equal(ingest1.body.data.accepted, 1);
  assert.equal(ingest1.body.data.results[0].inboxStatus, "processed");

  const staleEvent = {
    ...upsertEvent,
    eventId: "evt-file-stale-1",
    revision: 1,
    sourceUpdatedAt: "2026-11-15T11:00:00Z",
    payload: { ...upsertEvent.payload, title: "OLD REVERT" },
  };
  const signedStale = signInboundBody(staleEvent);
  const ingestStale = await request(ctx.app).post("/api/integrations/v2/events/ingest").set(signedStale.headers).send(signedStale.rawBody);
  assert.equal(ingestStale.status, 202);
  assert.equal(ingestStale.body.data.results[0].inboxStatus, "stale");

  const fileAfterStale = (await ctx.db.query(`SELECT * FROM course_file_projections WHERE profile_projection_id = $1 AND remote_file_id = 'file-901'`, [profProjId])).rows[0];
  assert.equal(fileAfterStale.title, "Đề thi mẫu PDF v2");
  assert.equal(Number(fileAfterStale.last_revision), 2);
  assert.equal(fileAfterStale.allow_view_override, true);
  assert.deepEqual(fileAfterStale.placements_json, [{ slot: "unit_slide", sortOrder: 1 }]);

  const tombEvent = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-file-tomb-3",
    eventType: "file.tombstoned",
    aggregateType: "file",
    aggregateId: "file:file-901",
    revision: 3,
    deleted: true,
    sourceUpdatedAt: "2026-11-15T13:00:00Z",
    payload: { profileId: "prof-702", unitId: "u-101", fileId: "file-901" },
  };
  const signedTomb = signInboundBody(tombEvent);
  const ingestTomb = await request(ctx.app).post("/api/integrations/v2/events/ingest").set(signedTomb.headers).send(signedTomb.rawBody);
  assert.equal(ingestTomb.status, 202);
  const fileAfterTomb = (await ctx.db.query(`SELECT * FROM course_file_projections WHERE profile_projection_id = $1 AND remote_file_id = 'file-901'`, [profProjId])).rows[0];
  assert.ok(fileAfterTomb, "Tombstone must soft-delete, not hard-delete");
  assert.ok(fileAfterTomb.deleted_at);
  assert.equal(fileAfterTomb.is_published, false);
});

test("Day 6 quizzes & assignments: start/save/submit unlocks next unit immediately, fixes isQuizCompleted bug, multipart upload, & assessment.* inbox", async (t) => {
  let attemptSubmitted = false;
  const uploadedAssets = [];
  let lastProgressCall = 0;

  const ctx = await setupDay5To7Env(t, async ({ method, url, body }) => {
    if (method === "POST" && url.endsWith("/learning/sessions")) {
      return {
        status: 201,
        body: {
          success: true,
          data: { sessionToken: "dsess-day6", sessionId: "dsess-id-6", expiresAt: new Date(Date.now() + 240_000).toISOString() },
        },
      };
    }
    if (method === "GET" && url.includes("/learning/offerings/prof-703/workspace")) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            profile: { id: "prof-703" },
            units: [
              { id: "u-101", unitType: "lesson", isLocked: false, isCompleted: attemptSubmitted },
              { id: "u-102", unitType: "lesson", isLocked: !attemptSubmitted, isCompleted: false },
            ],
          },
        },
      };
    }
    if (method === "GET" && url.includes("/learning/offerings/prof-703/units/u-101/quizzes/quiz-1")) {
      return {
        status: 200,
        body: {
          success: true,
          data: { id: "quiz-1", title: "Kiểm tra Bài 1", canViewSolution: false, questions: [{ id: "q1", prompt: "1+1=?" }] },
        },
      };
    }
    if (method === "POST" && url.includes("/learning/quizzes/quiz-1/attempts/start")) {
      return {
        status: 201,
        body: {
          success: true,
          data: { attempt: { id: "att-55", status: "in_progress", attemptNumber: 1 }, attemptCount: 1, maxAttempts: 3, syncRevision: 2 },
        },
      };
    }
    if (method === "PUT" && url.includes("/learning/quizzes/attempts/att-55/answers")) {
      if (attemptSubmitted) {
        return { status: 409, body: { success: false, errorCode: "ATTEMPT_ALREADY_SUBMITTED", message: "Đã nộp bài." } };
      }
      return { status: 200, body: { success: true, data: { attemptId: "att-55", savedCount: 1 } } };
    }
    if (method === "POST" && url.includes("/learning/quizzes/attempts/att-55/submit")) {
      attemptSubmitted = true;
      return {
        status: 200,
        body: {
          success: true,
          data: {
            quizId: "quiz-1",
            attempt: { id: "att-55", quizId: "quiz-1", status: "graded", score: 9, maxScore: 10, passed: true, submittedAt: "2026-11-15T14:00:00Z" },
            canViewSolution: false,
            isQuizCompleted: true,
            isUnitCompleted: true,
            courseCompletionPct: 50,
            syncRevision: 3,
          },
        },
      };
    }
    if (method === "PUT" && url.includes("/learning/videos/vid-101/progress")) {
      lastProgressCall += 1;
      return {
        status: 200,
        body: {
          success: true,
          data: {
            unitId: "u-101",
            unitType: "lesson",
            completionPercent: 100,
            lastPositionSeconds: 590,
            isVideoCompleted: true,
            isQuizCompleted: true,
            isUnitCompleted: true,
            syncRevision: 10 + lastProgressCall,
          },
        },
      };
    }
    if (method === "GET" && url.includes("/learning/offerings/prof-703/units/u-101/assignments/asg-1")) {
      return {
        status: 200,
        body: { success: true, data: { id: "asg-1", title: "Bài tập tự luận", maxScore: 100 } },
      };
    }
    if (method === "POST" && url.includes("/learning/assignments/asg-1/submission-assets")) {
      const aid = `asset-${uploadedAssets.length + 1}`;
      uploadedAssets.push({ assetId: aid, originalFilename: body.originalFilename, sizeBytes: body.sizeBytes });
      return { status: 201, body: { success: true, data: { assetId: aid } } };
    }
    if (method === "POST" && url.includes("/learning/assignments/asg-1/submit")) {
      return {
        status: 201,
        body: {
          success: true,
          data: {
            submission: { id: "sub-77", status: "submitted", submittedAt: "2026-11-15T14:05:00Z" },
            fileAssetIds: body.fileAssetIds,
            syncRevision: 1,
          },
        },
      };
    }
    return { status: 404, body: { success: false, code: "NOT_FOUND" } };
  });

  const { profProjId, unit1, token } = await seedSyncedCourseWithTwoUnits(ctx.db, {
    courseId: 703,
    profileId: "prof-703",
    allowFileDownload: true,
    userId: 90,
  });

  // Quiz fetch -> start -> save -> submit -> subsequent save returns 409 ATTEMPT_ALREADY_SUBMITTED
  const qRes = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/quizzes/quiz-1`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(qRes.status, 200);
  assert.equal(qRes.body.data.id, "quiz-1");

  const startRes = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/quizzes/quiz-1/attempts/start`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.data.attempt.id, "att-55");

  const saveOk = await request(ctx.app)
    .put(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/quizzes/attempts/att-55/answers`)
    .set("Authorization", `Bearer ${token}`)
    .send({ questionId: "q1", answer: "2" });
  assert.equal(saveOk.status, 200);

  const submitRes = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/quizzes/attempts/att-55/submit`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(submitRes.status, 200);

  // Immediate persistence: quiz assessment & progress unlocked next unit u-102 right away
  const progRows = (await ctx.db.query(
    `SELECT * FROM course_progress_projections WHERE user_id = 90 AND profile_projection_id = $1 ORDER BY remote_unit_id ASC`,
    [profProjId],
  )).rows;
  const p101 = progRows.find((r) => r.remote_unit_id === "u-101");
  const p102 = progRows.find((r) => r.remote_unit_id === "u-102");
  assert.equal(p101.is_quiz_completed, true);
  assert.equal(p101.is_unit_completed, true);
  assert.equal(p102.is_unlocked, true);

  const saveAfterSubmit = await request(ctx.app)
    .put(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/quizzes/attempts/att-55/answers`)
    .set("Authorization", `Bearer ${token}`)
    .send({ questionId: "q1", answer: "3" });
  assert.equal(saveAfterSubmit.status, 409);
  assert.equal(saveAfterSubmit.body.errorCode, "ATTEMPT_ALREADY_SUBMITTED");

  // Also test has_quiz fix in updateExternalVideoProgress
  const vidProgRes = await request(ctx.app)
    .put(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/videos/vid-101/progress`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currentTimeSeconds: 590, watchedDeltaSeconds: 30, durationSeconds: 600 });
  assert.equal(vidProgRes.status, 200);
  const p101AfterVid = (await ctx.db.query(
    `SELECT is_quiz_completed, is_video_completed FROM course_progress_projections WHERE user_id = 90 AND profile_projection_id = $1 AND remote_unit_id = 'u-101'`,
    [profProjId],
  )).rows[0];
  assert.equal(p101AfterVid.is_quiz_completed, true);
  assert.equal(p101AfterVid.is_video_completed, true);

  // Assignment fetch & multipart submit
  const asgGet = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/assignments/asg-1`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(asgGet.status, 200);

  const validPdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n", "utf8");
  const asgSubmit = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-703/units/u-${unit1.id}/assignments/asg-1/submit`)
    .set("Authorization", `Bearer ${token}`)
    .field("contentText", "Bài làm của học viên")
    .attach("files", validPdfBytes, { filename: "bai-lam.pdf", contentType: "application/pdf" });
  assert.equal(asgSubmit.status, 200);
  assert.equal(uploadedAssets.length, 1);
  assert.equal(uploadedAssets[0].originalFilename, "bai-lam.pdf");

  // Inbox assessment.submission.graded event with forbidden solutions key + allowed feedback
  const gradedEvt = {
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-asgn-graded-2",
    eventType: "assessment.submission.graded",
    aggregateType: "assessment",
    aggregateId: "assignment:asg-1",
    revision: 5,
    sourceUpdatedAt: "2026-11-15T15:00:00Z",
    payload: {
      profileId: "prof-703",
      unitId: "u-101",
      itemType: "assignment",
      itemId: "asg-1",
      externalUserId: "moly:90",
      submissionId: "sub-77",
      status: "graded",
      score: 92,
      maxScore: 100,
      canViewSolution: false,
      gradedAt: "2026-11-15T15:00:00Z",
      feedback: "Trình bày rất rõ ràng.",
      rubric: [{ criterion: "Logic", score: 48 }],
      solutions: [{ text: "SECRET ANSWER KEY" }],
      answerKey: "MUST_BE_STRIPPED",
    },
  };
  const signedGrade = signInboundBody(gradedEvt);
  const gradeIngest = await request(ctx.app).post("/api/integrations/v2/events/ingest").set(signedGrade.headers).send(signedGrade.rawBody);
  assert.equal(gradeIngest.status, 202);
  const asgProj = (await ctx.db.query(
    `SELECT * FROM course_assessment_projections WHERE user_id = 90 AND profile_projection_id = $1 AND item_type = 'assignment' AND remote_item_id = 'asg-1'`,
    [profProjId],
  )).rows[0];
  assert.equal(Number(asgProj.score), 92);
  assert.equal(asgProj.status, "graded");
  assert.equal(asgProj.can_view_solution, false);
  assert.equal(asgProj.metadata.feedback, "Trình bày rất rõ ràng.");
  assert.equal(asgProj.metadata.solutions, undefined);
  assert.equal(asgProj.metadata.answerKey, undefined);
});

test("Day 7 notes CRUD + 409 REVISION_CONFLICT, bookmarks, Q&A + unit detail enrichment + inbox handlers", async (t) => {
  const ctx = await setupDay5To7Env(t, async ({ method, url, body }) => {
    if (method === "POST" && url.endsWith("/learning/sessions")) {
      return {
        status: 201,
        body: {
          success: true,
          data: { sessionToken: "dsess-day7", sessionId: "dsess-id-7", expiresAt: new Date(Date.now() + 240_000).toISOString() },
        },
      };
    }
    if (method === "GET" && url.endsWith("/learning/offerings/prof-704/units/u-101")) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            id: "u-101",
            title: "Bài 1: Khởi động",
            files: [{ id: "file-901", title: "Đề thi mẫu PDF", mimeType: "application/pdf" }],
            notes: [{ id: "note-1", timestampSeconds: 30, content: "Ghi chú ban đầu" }],
          },
        },
      };
    }
    // Notes
    if (method === "GET" && url.endsWith("/learning/offerings/prof-704/units/u-101/notes")) {
      return { status: 200, body: { success: true, data: { notes: [{ id: "note-1", content: "Ghi chú ban đầu", revision: 1 }] } } };
    }
    if (method === "POST" && url.endsWith("/learning/offerings/prof-704/units/u-101/notes")) {
      return {
        status: 201,
        body: {
          success: true,
          data: {
            note: { id: "note-1", timestampSeconds: body.timestampSeconds, content: body.content, revision: 1, updatedAt: "2026-11-15T15:00:00Z" },
          },
        },
      };
    }
    if (method === "PUT" && url.endsWith("/learning/offerings/prof-704/units/u-101/notes/note-1")) {
      if (Number(body.expectedRevision) === 1) {
        return {
          status: 409,
          body: {
            success: false,
            errorCode: "REVISION_CONFLICT",
            message: "Ghi chú đã được cập nhật ở thiết bị khác.",
            details: {
              currentRevision: 2,
              note: { id: "note-1", timestampSeconds: 30, content: "Bản mới nhất từ tab khác", revision: 2, updatedAt: "2026-11-15T15:05:00Z" },
            },
          },
        };
      }
      return {
        status: 200,
        body: {
          success: true,
          data: { note: { id: "note-1", timestampSeconds: body.timestampSeconds ?? 35, content: body.content, revision: 3, updatedAt: "2026-11-15T15:10:00Z" } },
        },
      };
    }
    if (method === "DELETE" && url.endsWith("/learning/offerings/prof-704/units/u-101/notes/note-1")) {
      return { status: 200, body: { success: true, data: { deleted: true, noteId: "note-1", revision: 4, deletedAt: "2026-11-15T15:15:00Z" } } };
    }
    // Bookmarks
    if (method === "GET" && url.endsWith("/learning/offerings/prof-704/units/u-101/bookmarks")) {
      return { status: 200, body: { success: true, data: { bookmarks: [] } } };
    }
    if (method === "POST" && url.endsWith("/learning/offerings/prof-704/units/u-101/bookmarks")) {
      return {
        status: 201,
        body: {
          success: true,
          data: { bookmark: { id: "bm-10", videoAssetId: body.videoAssetId, timestampSeconds: body.timestampSeconds, label: body.label, revision: 1, updatedAt: "2026-11-15T15:20:00Z" } },
        },
      };
    }
    if (method === "DELETE" && url.endsWith("/learning/offerings/prof-704/units/u-101/bookmarks/bm-10")) {
      return { status: 200, body: { success: true, data: { deleted: true, bookmarkId: "bm-10", revision: 2, deletedAt: "2026-11-15T15:25:00Z" } } };
    }
    // Q&A
    if (method === "GET" && url.endsWith("/learning/offerings/prof-704/units/u-101/qa")) {
      return { status: 200, body: { success: true, data: { threads: [] } } };
    }
    if (method === "POST" && url.endsWith("/learning/offerings/prof-704/units/u-101/qa")) {
      return {
        status: 201,
        body: {
          success: true,
          data: {
            thread: {
              id: "qa-10",
              title: body.title,
              status: "open",
              messageCount: 1,
              messages: [{ id: "m1", authorName: "Learner", body: body.body, createdAt: "2026-11-15T15:30:00Z" }],
              revision: 1,
              updatedAt: "2026-11-15T15:30:00Z",
            },
          },
        },
      };
    }
    if (method === "POST" && url.endsWith("/learning/qa/threads/qa-10/replies")) {
      return {
        status: 201,
        body: {
          success: true,
          data: {
            thread: {
              id: "qa-10",
              title: "Thắc mắc công thức",
              status: "answered",
              messageCount: 2,
              messages: [
                { id: "m1", body: "Chưa hiểu bước 2" },
                { id: "m2", body: body.body },
              ],
              revision: 2,
              updatedAt: "2026-11-15T15:35:00Z",
              lastExpectedRevision: body.expectedRevision ?? null,
            },
          },
        },
      };
    }
    if (method === "PATCH" && url.endsWith("/learning/qa/threads/qa-10/status")) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            thread: {
              id: "qa-10",
              title: "Thắc mắc công thức",
              status: body.status,
              isPinned: Boolean(body.isPinned),
              markReadApplied: body.markRead ?? null,
              lastExpectedRevision: body.expectedRevision ?? null,
              messageCount: 2,
              revision: 3,
              updatedAt: "2026-11-15T15:40:00Z",
            },
          },
        },
      };
    }
    return { status: 404, body: { success: false, code: "NOT_FOUND" } };
  });

  const { profProjId, unit1, token } = await seedSyncedCourseWithTwoUnits(ctx.db, {
    courseId: 704,
    profileId: "prof-704",
    userId: 91,
  });

  // Notes create -> 409 conflict -> retry rev 2 -> delete
  const noteCreate = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/notes`)
    .set("Authorization", `Bearer ${token}`)
    .send({ timestampSeconds: 30, content: "Ghi chú ban đầu" });
  assert.equal(noteCreate.status, 200);

  const noteConflict = await request(ctx.app)
    .put(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/notes/note-1`)
    .set("Authorization", `Bearer ${token}`)
    .send({ timestampSeconds: 35, content: "Ghi đè cũ", expectedRevision: 1 });
  assert.equal(noteConflict.status, 409);
  assert.equal(noteConflict.body.errorCode, "REVISION_CONFLICT");
  assert.equal(noteConflict.body.details.currentRevision, 2);
  assert.equal(noteConflict.body.details.note.id, "note-1");

  // Enriched unit detail reads revision/isSlide/bookmarks/qaThreads cleanly
  const unitDetailRes = await request(ctx.app)
    .get(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(unitDetailRes.status, 200);
  assert.equal(unitDetailRes.body.data.files[0].isSlide, true);
  assert.equal(unitDetailRes.body.data.files[0].revision, 1);
  assert.ok(unitDetailRes.body.data.files[0].updatedAt);
  assert.equal(unitDetailRes.body.data.notes[0].revision, 2);
  assert.ok(Array.isArray(unitDetailRes.body.data.bookmarks));
  assert.ok(Array.isArray(unitDetailRes.body.data.qaThreads));

  const noteDel = await request(ctx.app)
    .delete(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/notes/note-1`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(noteDel.status, 200);
  const noteRow = (await ctx.db.query(`SELECT deleted_at FROM course_note_projections WHERE remote_note_id = 'note-1'`)).rows[0];
  assert.ok(noteRow.deleted_at);

  // Bookmarks create -> delete (DELETE HMAC without payload)
  const bmCreate = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/bookmarks`)
    .set("Authorization", `Bearer ${token}`)
    .send({ videoAssetId: "vid-1", timestampSeconds: 95, label: "Đoạn trọng tâm" });
  assert.equal(bmCreate.status, 200);
  const bmDel = await request(ctx.app)
    .delete(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/bookmarks/bm-10`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(bmDel.status, 200);
  const bmRow = (await ctx.db.query(`SELECT deleted_at FROM course_bookmark_projections WHERE remote_bookmark_id = 'bm-10'`)).rows[0];
  assert.ok(bmRow.deleted_at);

  // Q&A create -> reply -> PATCH status
  const qaCreate = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/qa`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Thắc mắc công thức", body: "Chưa hiểu bước 2" });
  assert.equal(qaCreate.status, 200);

  const qaReply = await request(ctx.app)
    .post(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/qa/qa-10/replies`)
    .set("Authorization", `Bearer ${token}`)
    .send({ body: "Giải thích thêm bước 2", expectedRevision: 1 });
  assert.equal(qaReply.status, 200);
  assert.equal(qaReply.body.data.thread.lastExpectedRevision, 1);

  const qaPatch = await request(ctx.app)
    .patch(`/api/learning/external/offerings/prof-704/units/u-${unit1.id}/qa/qa-10/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "resolved", isPinned: true, markRead: true, expectedRevision: 2 });
  assert.equal(qaPatch.status, 200);
  assert.equal(qaPatch.body.data.thread.markReadApplied, true);
  assert.equal(qaPatch.body.data.thread.lastExpectedRevision, 2);

  const qaRow = (await ctx.db.query(`SELECT * FROM course_qa_thread_projections WHERE remote_thread_id = 'qa-10'`)).rows[0];
  assert.equal(qaRow.status, "resolved");
  assert.equal(qaRow.is_pinned, true);
  assert.equal(qaRow.message_count, 2);

  // Inbox dispatch for note, bookmark, qa_thread + stale protection
  const noteEvt = signInboundBody({
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-note-sync-1",
    eventType: "learning.note.upserted",
    aggregateType: "note",
    aggregateId: "note:note-sync-1",
    revision: 2,
    sourceUpdatedAt: "2026-11-15T16:00:00Z",
    payload: { profileId: "prof-704", unitId: "u-101", externalUserId: "moly:91", noteId: "note-sync-1", timestampSeconds: 12, content: "Từ Course" },
  });
  assert.equal((await request(ctx.app).post("/api/integrations/v2/events/ingest").set(noteEvt.headers).send(noteEvt.rawBody)).status, 202);

  const bmEvt = signInboundBody({
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-bm-sync-1",
    eventType: "learning.bookmark.upserted",
    aggregateType: "bookmark",
    aggregateId: "bookmark:bm-sync-1",
    revision: 1,
    sourceUpdatedAt: "2026-11-15T16:00:00Z",
    payload: { profileId: "prof-704", unitId: "u-101", externalUserId: "moly:91", bookmarkId: "bm-sync-1", timestampSeconds: 50, label: "Bookmark Course" },
  });
  assert.equal((await request(ctx.app).post("/api/integrations/v2/events/ingest").set(bmEvt.headers).send(bmEvt.rawBody)).status, 202);

  const qaEvt = signInboundBody({
    schemaVersion: "2.0",
    sourceSystem: "csca-course",
    eventId: "evt-qa-sync-1",
    eventType: "qa.thread.updated",
    aggregateType: "qa_thread",
    aggregateId: "qa_thread:qa-sync-1",
    revision: 3,
    sourceUpdatedAt: "2026-11-15T16:00:00Z",
    payload: {
      profileId: "prof-704",
      unitId: "u-101",
      threadId: "qa-sync-1",
      authorExternalUserId: "moly:91",
      title: "Hỏi đáp từ Course",
      status: "answered",
      messageCount: 1,
      messages: [{ id: "msg-1", body: "Trả lời từ GV" }],
    },
  });
  assert.equal((await request(ctx.app).post("/api/integrations/v2/events/ingest").set(qaEvt.headers).send(qaEvt.rawBody)).status, 202);

  const inboxStatuses = (await ctx.db.query(`SELECT event_id, status FROM moly_course_sync_inbox WHERE event_id IN ('evt-note-sync-1', 'evt-bm-sync-1', 'evt-qa-sync-1')`)).rows;
  assert.equal(inboxStatuses.every((r) => r.status === "processed"), true);
  assert.equal(
    (await ctx.db.query(`SELECT COUNT(*)::int AS c FROM course_bookmark_projections WHERE profile_projection_id = $1 AND remote_bookmark_id = 'bm-sync-1'`, [profProjId])).rows[0].c,
    1,
  );
  assert.equal(
    (await ctx.db.query(`SELECT COUNT(*)::int AS c FROM course_qa_thread_projections WHERE profile_projection_id = $1 AND remote_thread_id = 'qa-sync-1'`, [profProjId])).rows[0].c,
    1,
  );
});

test("GET /api/me/course-enrollments excludes csca_course native 0/0 rows, exposes 0/N progress, aligns activeProfileId, and sets resumeUnitHref", async (t) => {
  const ctx = await setupDay5To7Env(t);
  const { profProjId, unit1, unit2, token } = await seedSyncedCourseWithTwoUnits(ctx.db, {
    courseId: 705,
    profileId: "prof-705",
    userId: 92,
  });

  // Insert an empty legacy native course_enrollments row for csca_course 705 to verify exclusion
  await ctx.db.query(
    `INSERT INTO course_enrollments (user_id, course_id, status, source)
     VALUES (92, 705, 'active', 'purchase')`,
  );

  // Before any progress: returns non-null 0/2 progress + aligned activeProfileId + resumeUnitHref = firstUnitHref
  const beforeRes = await request(ctx.app)
    .get("/api/me/course-enrollments")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(beforeRes.status, 200);
  assert.equal(beforeRes.body.data.length, 1);
  const beforeItem = beforeRes.body.data[0];
  assert.equal(beforeItem.enrollment.source, "external");
  assert.equal(beforeItem.enrollment.activeProfileId, "prof-705");
  assert.deepEqual(beforeItem.enrollment.progress, {
    completedLessons: 0,
    totalLessons: 2,
    completionPct: 0,
    watchedSeconds: 0,
    lastLessonId: null,
    lastLessonTitle: null,
    lastPositionSeconds: 0,
  });
  assert.equal(beforeItem.enrollment.firstUnitHref, `/hoc/toan-csca-705/bai-hoc/u-${unit1.id}?profileId=prof-705`);
  assert.equal(beforeItem.enrollment.resumeUnitHref, beforeItem.enrollment.firstUnitHref);

  // After watching unit2: resumeUnitHref updates to unit2
  await ctx.db.query(
    `INSERT INTO course_progress_projections (
       user_id, profile_projection_id, local_course_id, unit_type, remote_unit_id,
       watched_seconds, last_position_seconds, completion_pct, is_unit_completed, is_unlocked,
       last_unit_id, last_revision, source_updated_at
     ) VALUES (92, $1, 705, 'lesson', 'u-102', 180, 180, 25, FALSE, TRUE, 'u-102', 1, NOW())`,
    [profProjId],
  );

  const afterRes = await request(ctx.app)
    .get("/api/me/course-enrollments")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterRes.status, 200);
  assert.equal(afterRes.body.data.length, 1);
  const afterItem = afterRes.body.data[0];
  assert.equal(afterItem.enrollment.progress.lastLessonId, `u-${unit2.id}`);
  assert.equal(afterItem.enrollment.progress.lastPositionSeconds, 180);
  assert.equal(afterItem.enrollment.resumeUnitHref, `/hoc/toan-csca-705/bai-hoc/u-${unit2.id}?profileId=prof-705`);
  assert.equal(afterItem.course.resumeUnitHref, afterItem.enrollment.resumeUnitHref);
});
