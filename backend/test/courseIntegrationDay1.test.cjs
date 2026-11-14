const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { PGlite } = require("@electric-sql/pglite");
const { applyMigration, TABLES } = require("../scripts/apply_course_integration_migration");
const { createCourseIntegrationMappingService } = require("../src/services/courseIntegrationMappingService");
const { createCourseIntegrationAdminRoutes } = require("../src/routes/courseIntegrationAdminRoutes");
const { applyManualMappingsFromList } = require("../scripts/seed_manual_course_mappings");

const migrationSql = (name) =>
  fs.readFileSync(path.join(__dirname, "../../database/migrations", name), "utf8");

async function setupMolyDb({ withVideoCommerce = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL DEFAULT 'hashed',
      role VARCHAR(20) DEFAULT 'student',
      is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE materials (id SERIAL PRIMARY KEY);
    CREATE TABLE vip_packages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      tier TEXT,
      allowed_subjects TEXT[],
      requires_subject_choice BOOLEAN DEFAULT FALSE,
      price INTEGER,
      duration_days INTEGER,
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      package_id INTEGER REFERENCES vip_packages(id),
      amount INTEGER,
      status TEXT
    );
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
  `);
  await db.exec(migrationSql("052_csca_courses_core.sql"));
  if (withVideoCommerce) {
    await db.exec(migrationSql("067_video_commerce_foundation.sql"));
  }
  const client = {
    query: async (sql, values) => (values ? db.query(sql, values) : (await db.exec(sql)).at(-1)),
  };
  await applyMigration(client);
  return { db, client };
}

describe("Day 1 Moly Studio integration migration & manual course mapping", () => {
  test("migration 076 creates all 6 tables cleanly, runs idempotently a second time, and keeps existing rows intact", async (t) => {
    const { db, client } = await setupMolyDb({ withVideoCommerce: true });
    t.after(() => db.close());

    const u = (
      await db.query("INSERT INTO users (username, email) VALUES ('moly_u1', 'moly_u1@test.local') RETURNING id")
    ).rows[0];
    const c = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('m-math', 'm-math', 'Moly Math', 'MATH', 'published') RETURNING id",
      )
    ).rows[0];

    const tablesRes = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [TABLES],
    );
    assert.deepEqual(
      tablesRes.rows.map((r) => r.table_name).sort(),
      [...TABLES].sort(),
    );

    // Second run must be completely idempotent and leave existing rows untouched.
    await applyMigration(client);
    const preservedUser = (await db.query("SELECT email FROM users WHERE id = $1", [u.id])).rows[0];
    const preservedCourse = (await db.query("SELECT slug FROM courses WHERE id = $1", [c.id])).rows[0];
    assert.equal(preservedUser.email, "moly_u1@test.local");
    assert.equal(preservedCourse.slug, "m-math");

    const idxRes = await db.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [[
        "idx_integration_inbox_worker_claim",
        "idx_integration_outbox_worker_claim",
        "idx_external_identities_user_lookup",
        "idx_external_course_mappings_local_course",
        "idx_external_entitlements_user_lookup",
        "idx_integration_inbox_pending",
      ]],
    );
    assert.equal(idxRes.rows.length, 6);
  });

  test("migration 076 also succeeds cleanly without optional video_packages table", async (t) => {
    const { db } = await setupMolyDb({ withVideoCommerce: false });
    t.after(() => db.close());
    const tablesRes = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [TABLES],
    );
    assert.equal(tablesRes.rows.length, TABLES.length);
  });

  test("enforces unique constraints, cross-source isolation, FK, status CHECK, and ON DELETE RESTRICT", async (t) => {
    const { db } = await setupMolyDb({ withVideoCommerce: true });
    t.after(() => db.close());

    const u1 = (
      await db.query("INSERT INTO users (username, email) VALUES ('u1', 'u1@test.local') RETURNING id")
    ).rows[0];
    const u2 = (
      await db.query("INSERT INTO users (username, email) VALUES ('u2', 'u2@test.local') RETURNING id")
    ).rows[0];
    const c1 = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('c1', 'c1', 'Course 1', 'MATH', 'published') RETURNING id",
      )
    ).rows[0];
    const c2 = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('c2', 'c2', 'Course 2', 'PHYSICS', 'published') RETURNING id",
      )
    ).rows[0];

    await db.query(
      `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
       VALUES ('csca-course', 'course-user-10', $1, 'active', '2026-11-14T08:00:00Z')`,
      [u1.id],
    );
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
           VALUES ('csca-course', 'course-user-10', $1, 'active', '2026-11-14T08:01:00Z')`,
          [u2.id],
        ),
      (err) => err.code === "23505",
    );
    // Same external_user_id under a different source_system is allowed.
    await db.query(
      `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
       VALUES ('moly', 'course-user-10', $1, 'active', '2026-11-14T08:01:00Z')`,
      [u2.id],
    );

    // FK violation & CHECK constraint violation checks.
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
           VALUES ('csca-course', 'bad-fk', 99999, 'active', '2026-11-14T08:00:00Z')`,
        ),
      (err) => err.code === "23503",
    );
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
           VALUES ('csca-course', 'bad-status', $1, 'unknown', '2026-11-14T08:00:00Z')`,
          [u2.id],
        ),
      (err) => err.code === "23514",
    );

    await db.query(
      `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id)
       VALUES ('csca-course', 'ext-course-10', $1)`,
      [c1.id],
    );
    await db.query(
      `INSERT INTO external_course_mappings (source_system, external_course_id, local_course_id)
       VALUES ('internal-management', 'ext-course-10', $1)`,
      [c2.id],
    );

    for (const [idx, st] of ["active", "suspended", "expired", "revoked"].entries()) {
      await db.query(
        `INSERT INTO external_entitlements (
           source_system, external_grant_id, external_user_id, external_course_id,
           user_id, local_course_id, status, valid_from, valid_until, revoked_at, source_updated_at
         )
         VALUES ('csca-course', $1, 'course-user-10', 'ext-course-10', $2, $3, $4, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', $5, '2026-11-14T08:00:00Z')`,
        [
          `grant-${idx}`,
          u1.id,
          c1.id,
          st,
          st === "revoked" ? "2026-11-14T08:00:00Z" : null,
        ],
      );
    }
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO external_entitlements (
             source_system, external_grant_id, external_user_id, external_course_id,
             user_id, local_course_id, status, valid_from, source_updated_at
           )
           VALUES ('csca-course', 'grant-bad-status', 'course-user-10', 'ext-course-10', $1, $2, 'deleted', '2026-11-01T00:00:00Z', '2026-11-14T08:00:00Z')`,
          [u1.id, c1.id],
        ),
      (err) => err.code === "23514",
    );

    // ON DELETE RESTRICT prevents cascading wipe of paid/external entitlements.
    await assert.rejects(() => db.query("DELETE FROM users WHERE id = $1", [u1.id]), (err) => err.code === "23001");
    await assert.rejects(() => db.query("DELETE FROM courses WHERE id = $1", [c1.id]), (err) => err.code === "23001");
  });

  test("stale events carrying older source_updated_at are marked stale and blocked by trigger", async (t) => {
    const { db } = await setupMolyDb({ withVideoCommerce: true });
    t.after(() => db.close());

    const u = (
      await db.query("INSERT INTO users (username, email) VALUES ('u_stale', 'stale@test.local') RETURNING id")
    ).rows[0];
    const c = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('c-stale', 'c-stale', 'Course Stale', 'MATH', 'published') RETURNING id",
      )
    ).rows[0];
    const service = createCourseIntegrationMappingService(db);
    await service.upsertManualCourseMapping({
      sourceSystem: "csca-course",
      externalCourseId: "csca-course:course:99",
      localCourseId: c.id,
    });

    const newer = await service.ingestEntitlementWithFreshnessGuard({
      sourceSystem: "csca-course",
      eventId: "evt-moly-new",
      idempotencyKey: "idem-moly-new",
      correlationId: "corr-moly-stale",
      externalGrantId: "csca-course:grant:77",
      externalUserId: "csca-course:99",
      externalCourseId: "csca-course:course:99",
      userId: u.id,
      status: "revoked",
      validFrom: "2026-11-14T08:00:00Z",
      validUntil: "2027-01-01T00:00:00Z",
      revokedAt: "2026-11-14T15:00:00Z",
      revokeReason: "revoked_on_course",
      sourceUpdatedAt: "2026-11-14T15:00:00Z",
    });
    assert.equal(newer.outcome, "applied");
    assert.equal(newer.entitlement.status, "revoked");

    const older = await service.ingestEntitlementWithFreshnessGuard({
      sourceSystem: "csca-course",
      eventId: "evt-moly-old",
      idempotencyKey: "idem-moly-old",
      correlationId: "corr-moly-stale",
      externalGrantId: "csca-course:grant:77",
      externalUserId: "csca-course:99",
      externalCourseId: "csca-course:course:99",
      userId: u.id,
      status: "active",
      validFrom: "2026-11-14T08:00:00Z",
      validUntil: "2027-01-01T00:00:00Z",
      sourceUpdatedAt: "2026-11-14T11:00:00Z",
    });
    assert.equal(older.outcome, "stale");
    assert.equal(older.inbox.status, "stale");
    assert.equal(older.inbox.last_error_code, "STALE_EVENT");

    const current = (
      await db.query(
        "SELECT status FROM external_entitlements WHERE source_system = 'csca-course' AND external_grant_id = 'csca-course:grant:77'",
      )
    ).rows[0];
    assert.equal(current.status, "revoked");

    await assert.rejects(
      () =>
        db.query(
          `UPDATE external_entitlements
           SET status = 'active', revoked_at = NULL, source_updated_at = '2026-11-14T10:00:00Z'
           WHERE source_system = 'csca-course' AND external_grant_id = 'csca-course:grant:77'`,
        ),
      /STALE_SOURCE_UPDATED_AT/,
    );
  });

  test("manual course mapping forbids title/slug matching, returns COURSE_MAPPING_MISSING, and serves admin router", async (t) => {
    const { db } = await setupMolyDb({ withVideoCommerce: true });
    t.after(() => db.close());

    const admin = (
      await db.query("INSERT INTO users (username, email, role) VALUES ('adm', 'adm@test.local', 'admin') RETURNING id")
    ).rows[0];
    const course1 = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('hsk-math', 'hsk-math', 'HSK Math', 'MATH', 'published') RETURNING id",
      )
    ).rows[0];
    const course2 = (
      await db.query(
        "INSERT INTO courses (external_key, slug, title, subject_code, status) VALUES ('hsk-phys', 'hsk-phys', 'HSK Physics', 'PHYSICS', 'published') RETURNING id",
      )
    ).rows[0];

    const service = createCourseIntegrationMappingService(db);

    // Matching local slug/external_key without an explicit mapping must yield COURSE_MAPPING_MISSING.
    await assert.rejects(
      () => service.resolveExternalCourseMapping({ sourceSystem: "csca-course", externalCourseId: "hsk-math" }),
      (err) => err.code === "COURSE_MAPPING_MISSING" && err.status === 422,
    );
    await assert.rejects(
      () => service.resolveLocalCourseToExternal({ sourceSystem: "csca-course", localCourseId: course1.id }),
      (err) => err.code === "COURSE_MAPPING_MISSING",
    );
    await assert.rejects(
      () =>
        service.upsertManualCourseMapping({
          sourceSystem: "csca-course",
          externalCourseId: "csca-course:course:10",
          localCourseId: course1.id,
          autoMatch: true,
        }),
      (err) => err.code === "AUTO_MAPPING_FORBIDDEN",
    );

    const seeded = await applyManualMappingsFromList(db, [
      {
        sourceSystem: "csca-course",
        externalCourseId: "csca-course:course:10",
        externalCourseCode: "hsk-math",
        externalCourseTitle: "Course Math",
        localCourseId: course1.id,
        actorId: admin.id,
      },
      {
        sourceSystem: "csca-course",
        externalCourseId: "csca-course:course:11",
        externalCourseCode: "hsk-phys",
        externalCourseTitle: "Course Physics",
        localCourseId: course2.id,
        actorId: admin.id,
      },
    ]);
    assert.equal(seeded.length, 2);

    const app = express();
    app.use(express.json());
    app.use(
      "/api/admin/course-integrations",
      createCourseIntegrationAdminRoutes({
        service,
        authenticate: (req, res, next) => {
          if (!req.headers["x-test-user"]) return res.sendStatus(401);
          req.user = { id: Number(req.headers["x-test-user"]) };
          next();
        },
        authorizeAnyPermission: (...perms) => {
          assert.deepEqual(perms, ["users.manage", "content.manage"]);
          return (req, res, next) => {
            if (req.headers["x-test-allow"] !== "true") return res.sendStatus(403);
            next();
          };
        },
      }),
    );

    await request(app).get("/api/admin/course-integrations/course-mappings").expect(401);
    await request(app)
      .get("/api/admin/course-integrations/course-mappings")
      .set("x-test-user", String(admin.id))
      .expect(403);

    const listRes = await request(app)
      .get("/api/admin/course-integrations/course-mappings")
      .set("x-test-user", String(admin.id))
      .set("x-test-allow", "true")
      .expect(200);
    assert.equal(listRes.body.data.length, 2);

    const missingRes = await request(app)
      .get("/api/admin/course-integrations/course-mappings/resolve?sourceSystem=csca-course&externalCourseId=hsk-math")
      .set("x-test-user", String(admin.id))
      .set("x-test-allow", "true")
      .expect(422);
    assert.equal(missingRes.body.code, "COURSE_MAPPING_MISSING");
  });
});
