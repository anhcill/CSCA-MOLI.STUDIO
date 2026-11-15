const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { applyMigration, TABLES } = require("../scripts/apply_course_integration_migration");

const migrationSql = (name) =>
  fs.readFileSync(path.join(__dirname, "../../database/migrations", name), "utf8");

const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function setupFullMolyDb({ withVideoCommerce = true, withPaidDevicePolicy = true } = {}) {
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
  await db.exec(migrationSql("053_csca_course_progress.sql"));
  await db.exec(migrationSql("057_course_assignments.sql"));
  await db.exec(migrationSql("058_course_lesson_questions.sql"));
  if (withVideoCommerce) {
    await db.exec(migrationSql("067_video_commerce_foundation.sql"));
  }
  if (withPaidDevicePolicy) {
    await db.exec(migrationSql("072_paid_device_policy.sql"));
  }

  const client = {
    query: async (sql, values) => (values ? db.query(sql, values) : (await db.exec(sql)).at(-1)),
  };
  await applyMigration(client);
  return { db, client };
}

describe("Day 1 Moly Studio Full Sync v2 schema, legacy isolation, revisions, and browser device slots", () => {
  test("migration 081 applies cleanly with or without optional tables, runs idempotently, and preserves native courses", async (t) => {
    const { db, client } = await setupFullMolyDb({ withVideoCommerce: false, withPaidDevicePolicy: false });
    t.after(() => db.close());

    const u = (
      await db.query("INSERT INTO users (username, email) VALUES ('native_student', 'native@test.local') RETURNING id")
    ).rows[0];
    const nativeCourse = (
      await db.query(
        `INSERT INTO courses (external_key, slug, title, subject_code, status)
         VALUES ('moly-native-math', 'moly-native-math', 'Moly Native Math', 'MATH', 'published')
         RETURNING id, content_origin, sync_revision`,
      )
    ).rows[0];
    assert.equal(nativeCourse.content_origin, "moly_native");
    assert.equal(Number(nativeCourse.sync_revision), 1);

    const nativeSection = (
      await db.query(
        `INSERT INTO course_sections (course_id, title, sort_order, is_published)
         VALUES ($1, 'Native Section 1', 1, TRUE)
         RETURNING id, content_origin`,
        [nativeCourse.id],
      )
    ).rows[0];
    assert.equal(nativeSection.content_origin, "moly_native");

    const nativeLesson = (
      await db.query(
        `INSERT INTO course_lessons (course_id, section_id, external_key, slug, title, sort_order, is_published)
         VALUES ($1, $2, 'moly-native-l1', 'moly-native-l1', 'Native Lesson 1', 1, TRUE)
         RETURNING id, content_origin`,
        [nativeCourse.id, nativeSection.id],
      )
    ).rows[0];
    assert.equal(nativeLesson.content_origin, "moly_native");

    await db.query(
      `INSERT INTO course_enrollments (user_id, course_id, source, status)
       VALUES ($1, $2, 'free', 'active')`,
      [u.id, nativeCourse.id],
    );

    // Apply again idempotently -> native rows must remain intact with content_origin='moly_native'.
    await applyMigration(client);

    const tablesRes = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [TABLES],
    );
    assert.deepEqual(
      tablesRes.rows.map((r) => r.table_name).sort(),
      [...TABLES].sort(),
    );

    const preserved = (await db.query("SELECT content_origin, slug FROM courses WHERE id = $1", [nativeCourse.id])).rows[0];
    assert.equal(preserved.content_origin, "moly_native");
    assert.equal(preserved.slug, "moly-native-math");
  });

  test("supports 1 course : N profiles, enforces monotonic revision triggers, tombstones, and ON DELETE RESTRICT", async (t) => {
    const { db } = await setupFullMolyDb({ withVideoCommerce: true, withPaidDevicePolicy: true });
    t.after(() => db.close());

    const user = (
      await db.query("INSERT INTO users (username, email) VALUES ('sync_learner', 'sync_learner@test.local') RETURNING id")
    ).rows[0];

    const syncedCourse = (
      await db.query(
        `INSERT INTO courses
           (external_key, slug, title, subject_code, status, content_origin, remote_source_system, remote_course_id, sync_revision, source_updated_at)
         VALUES ('csca-42', 'csca-42-math', 'Course Math 42', 'MATH', 'published', 'csca_course', 'csca-course', '42', 1, '2026-11-15T08:00:00Z')
         RETURNING id`,
      )
    ).rows[0];

    // 1 course : N profiles (MIRROR + INDEPENDENT) sharing local_course_id
    const profMirror = (
      await db.query(
        `INSERT INTO course_profile_projections
           (remote_course_id, remote_profile_id, external_offering_id, local_course_id, mode, management_class_id, allow_file_download, last_revision, source_updated_at)
         VALUES ('42', 'profile:101', 'CLS-LIVE-2026', $1, 'MIRROR', 'CLS-LIVE-2026', FALSE, 1, '2026-11-15T08:00:00Z')
         RETURNING id, checkout_ready`,
        [syncedCourse.id],
      )
    ).rows[0];
    const profIndep = (
      await db.query(
        `INSERT INTO course_profile_projections
           (remote_course_id, remote_profile_id, external_offering_id, local_course_id, mode, management_class_id, allow_file_download, last_revision, source_updated_at)
         VALUES ('42', 'profile:102', 'REC-V2-2026', $1, 'INDEPENDENT', 'REC-V2-2026', TRUE, 1, '2026-11-15T08:00:00Z')
         RETURNING id, checkout_ready`,
        [syncedCourse.id],
      )
    ).rows[0];
    assert.equal(profMirror.checkout_ready, false);
    assert.equal(profIndep.checkout_ready, false);
    assert.notEqual(profMirror.id, profIndep.id);

    // Tombstone check requires deleted_at when status = 'tombstoned'
    await assert.rejects(
      () =>
        db.query(
          `UPDATE course_profile_projections
           SET status = 'tombstoned', last_revision = 2, source_updated_at = '2026-11-15T09:00:00Z'
           WHERE id = $1`,
          [profIndep.id],
        ),
      /chk_course_profile_projections_tombstoned/i,
    );

    // Upgrade to revision 2 cleanly
    await db.query(
      `UPDATE course_profile_projections
       SET allow_file_download = TRUE, last_revision = 2, source_updated_at = '2026-11-15T09:00:00Z'
       WHERE id = $1`,
      [profMirror.id],
    );

    // Stale revision regression (< 2) rejected by trigger
    await assert.rejects(
      () =>
        db.query(
          `UPDATE course_profile_projections
           SET allow_file_download = FALSE, last_revision = 1, source_updated_at = '2026-11-15T10:00:00Z'
           WHERE id = $1`,
          [profMirror.id],
        ),
      /STALE_REVISION_REGRESSION/,
    );

    // Equal revision with older source_updated_at rejected by trigger
    await assert.rejects(
      () =>
        db.query(
          `UPDATE course_profile_projections
           SET allow_file_download = FALSE, last_revision = 2, source_updated_at = '2026-11-15T08:30:00Z'
           WHERE id = $1`,
          [profMirror.id],
        ),
      /STALE_SOURCE_UPDATED_AT/,
    );

    // Unit, progress, assessment, and note projections enforce revision monotonicity and protect history
    const unitProj = (
      await db.query(
        `INSERT INTO course_unit_projections
           (profile_projection_id, local_course_id, remote_section_id, section_title, section_sort_order, unit_type, remote_unit_id, title, sort_order, is_published, has_theory, vocab_count, formula_count, last_revision, source_updated_at)
         VALUES ($1, $2, 'sec:1', 'Chapter 1', 1, 'class_session', '9001', 'Unit 1', 1, TRUE, TRUE, 12, 5, 1, '2026-11-15T08:00:00Z')
         RETURNING id`,
        [profMirror.id, syncedCourse.id],
      )
    ).rows[0];

    await db.query(
      `INSERT INTO course_progress_projections
         (user_id, profile_projection_id, local_course_id, unit_type, remote_unit_id, watched_seconds, last_position_seconds, completion_pct, is_video_completed, is_quiz_completed, is_unit_completed, is_unlocked, last_revision, source_updated_at)
       VALUES ($1, $2, $3, 'class_session', '9001', 620, 620, 62.00, TRUE, TRUE, TRUE, TRUE, 3, '2026-11-15T09:05:00Z')`,
      [user.id, profMirror.id, syncedCourse.id],
    );

    await assert.rejects(
      () =>
        db.query(
          `UPDATE course_progress_projections
           SET last_position_seconds = 100, last_revision = 2, source_updated_at = '2026-11-15T09:10:00Z'
           WHERE user_id = $1 AND profile_projection_id = $2`,
          [user.id, profMirror.id],
        ),
      /STALE_REVISION_REGRESSION/,
    );

    // Hard deleting profile/unit with learner history is blocked (ON DELETE RESTRICT)
    await assert.rejects(
      () => db.query("DELETE FROM course_profile_projections WHERE id = $1", [profMirror.id]),
      /foreign key/i,
    );
    assert.ok(unitProj.id);

    // Integration conflicts accept v2 conflict types ('LEGACY_ORIGIN_CONFLICT', 'PROFILE_SCOPE_MISMATCH', 'REVISION_CONFLICT')
    await db.query(
      `INSERT INTO integration_conflicts
         (source_system, conflict_type, external_course_id, local_course_id, reason)
       VALUES ('csca-course', 'LEGACY_ORIGIN_CONFLICT', '42', $1, 'Target course is moly_native')`,
      [syncedCourse.id],
    );
  });

  test("moly_course_sync_inbox, course_sync_checkpoints, and moly_trusted_browser_devices enforce Day 1 invariants", async (t) => {
    const { db } = await setupFullMolyDb({ withVideoCommerce: true, withPaidDevicePolicy: true });
    t.after(() => db.close());

    const user = (
      await db.query("INSERT INTO users (username, email) VALUES ('dev_user', 'dev_user@test.local') RETURNING id")
    ).rows[0];
    const remDev = (
      await db.query(
        `INSERT INTO user_remembered_devices (user_id, device_key, device_type)
         VALUES ($1, $2, 'desktop')
         RETURNING id`,
        [user.id, sha256Hex("moly-legacy-key")],
      )
    ).rows[0];

    // Raw/short client header must fail SHA-256 hash format check
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO moly_trusted_browser_devices (user_id, device_token_hash, device_name)
           VALUES ($1, 'client-header-uuid-1234', 'Spoof Attempt')`,
          [user.id],
        ),
      /device_token_hash/i,
    );

    const tokenHash = sha256Hex("server-minted-moly-cookie-secret");
    await db.query(
      `INSERT INTO moly_trusted_browser_devices
         (user_id, device_token_hash, device_name, device_type, remembered_device_id)
       VALUES ($1, $2, 'Chrome Desktop', 'desktop', $3)`,
      [user.id, tokenHash, remDev.id],
    );

    // Duplicate active device_token_hash for same user rejected
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO moly_trusted_browser_devices
             (user_id, device_token_hash, device_name)
           VALUES ($1, $2, 'Chrome Duplicate')`,
          [user.id, tokenHash],
        ),
      /duplicate key|uq_moly_trusted_browser_devices_active/i,
    );

    // Checkpoints + inbox deduplication
    await db.query(
      `INSERT INTO course_sync_checkpoints (stream_name, last_cursor, after_entity_id, high_water_revision, sync_status)
       VALUES ('catalog_courses', 'rev:10:id:55', 55, 10, 'backfilling')`,
    );
    await db.query(
      `INSERT INTO moly_course_sync_inbox
         (event_id, idempotency_key, event_type, aggregate_type, aggregate_id, aggregate_revision, payload_hash, payload, source_updated_at)
       VALUES ('csca:course:42:rev:10', 'csca:course:42:rev:10', 'course.upserted', 'course', '42', 10, $1, '{"title":"Course 42"}'::jsonb, NOW())`,
      [sha256Hex('{"title":"Course 42"}')],
    );
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO moly_course_sync_inbox
             (event_id, idempotency_key, event_type, aggregate_type, aggregate_id, aggregate_revision, payload_hash, payload, source_updated_at)
           VALUES ('csca:course:42:rev:10', 'other-idem', 'course.upserted', 'course', '42', 10, $1, '{}'::jsonb, NOW())`,
          [sha256Hex("{}")],
        ),
      /duplicate key/i,
    );
  });
});
