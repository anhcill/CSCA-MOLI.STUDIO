"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const db = require("../src/config/database");
const adminCourseService = require("../src/services/adminCourseService");
const courseService = require("../src/services/courseService");
const learningService = require("../src/services/learningService");
const playbackService = require("../src/services/videoPlaybackSessionService");
const { createBunnyMediaService } = require("../src/services/bunnyMediaService");
const { createCourseEnrollmentAdminService } = require("../src/services/courseEnrollmentAdminService");
const { createVideoCommerceRepository } = require("../src/repositories/videoCommerceRepository");
const { createVideoAdminService } = require("../src/services/videoAdminService");

const migration = (name) => fs.readFileSync(path.join(__dirname, "../../database/migrations", name), "utf8");

let pg;
let bunnyService;
let enrollmentAdmin;
let videoAdmin;
let deletedRemoteGuids = [];

const adminActor = { id: 1, role: "admin", rbacRoles: ["super_admin"], permissions: ["*"] };
const studentA = { id: 2, role: "student" };
const studentB = { id: 3, role: "student" };

before(async () => {
  pg = new PGlite();
  db.query = (sql, params) => pg.query(sql, params);
  db.pool.connect = async () => ({ query: db.query, release() {} });

  process.env.CSCA_VIDEO_COMMERCE_ENABLED = "true";
  process.env.CSCA_BUNNY_STREAM_ENABLED = "true";
  process.env.BUNNY_STREAM_LIBRARY_ID = "123";
  process.env.BUNNY_STREAM_TOKEN_KEY = "test-token-key";

  await pg.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      username TEXT,
      role TEXT DEFAULT 'student',
      is_active BOOLEAN DEFAULT TRUE,
      coins INTEGER DEFAULT 0,
      is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',
      vip_expires_at TIMESTAMPTZ,
      vip_package_id INTEGER,
      vip_allowed_subjects TEXT[] DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE materials (id SERIAL PRIMARY KEY);
    CREATE TABLE transactions (id SERIAL PRIMARY KEY, amount BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE coupons (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      description TEXT,
      created_by INTEGER,
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
      coupon_id INTEGER,
      user_id INTEGER,
      transaction_id INTEGER,
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
    CREATE TABLE vip_packages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      tier TEXT DEFAULT 'vip',
      price INTEGER DEFAULT 90000,
      duration_days INTEGER DEFAULT 90,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      allowed_subjects TEXT[],
      requires_subject_choice BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE user_vip_entitlements (
      id SERIAL PRIMARY KEY,
      user_id INT,
      package_id INT,
      transaction_id INT,
      tier TEXT,
      allowed_subjects TEXT[],
      source TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

    INSERT INTO users (id, email, full_name, username, role) VALUES
      (1, 'admin@moli.test', 'Admin Root', 'adminroot', 'admin'),
      (2, 'studentA@moli.test', 'Hoc Vien A', 'studenta', 'student'),
      (3, 'studentB@moli.test', 'Hoc Vien B', 'studentb', 'student');
    INSERT INTO vip_packages (id, name, allowed_subjects) VALUES (1, 'VIP Math', ARRAY['MATH']);
  `);

  for (const name of [
    "001_create_roles.sql",
    "002_create_permissions.sql",
    "003_create_role_permissions.sql",
    "004_create_user_roles.sql",
    "052_csca_courses_core.sql",
    "053_csca_course_progress.sql",
    "054_csca_video_assets.sql",
    "055_csca_course_package_access.sql",
    "057_course_assignments.sql",
    "058_course_lesson_questions.sql",
    "067_video_commerce_foundation.sql",
    "068_video_commerce_payments.sql",
    "069_video_commerce_admin.sql",
    "070_bunny_learning.sql",
  ]) {
    await pg.exec(migration(name));
  }

  let seq = 0;
  bunnyService = createBunnyMediaService({
    database: db,
    config: { libraryId: "123" },
    authorize: async () => {},
    adapter: {
      createTusAuthorization: () => ({
        endpoint: "https://video.bunnycdn.com/tusupload",
        headers: {},
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      createVideo: async () => ({ guid: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}` }),
      getVideo: async (guid) => ({
        guid,
        videoLibraryId: 123,
        status: 4,
        length: 180,
        thumbnailFileName: "thumb.jpg",
      }),
      deleteVideo: async (guid) => {
        deletedRemoteGuids.push(guid);
        return { deleted: true };
      },
    },
  });

  enrollmentAdmin = createCourseEnrollmentAdminService({ database: db });
  videoAdmin = createVideoAdminService({
    db,
    repository: createVideoCommerceRepository(db),
    payments: { reconcile: async () => ({}), productSnapshot: async () => ({}) },
    recalculateVip: async () => {},
    salesEnabled: () => true,
  });
});

after(async () => {
  await pg?.close();
  await db.pool.end();
});

test("curriculum workflow: publish-ready, reorder, video remove, lesson/section delete", async () => {
  const created = await adminCourseService.createCourse({
    title: "Khóa Toán CSCA Thực Chiến",
    slug: "khoa-toan-csca-thuc-chien",
    subjectCode: "MATH",
    accessType: "private",
    level: "intermediate",
  });

  const s1 = await adminCourseService.createSection(created.id, { title: "Chương 1: Hàm số" });
  const s2 = await adminCourseService.createSection(created.id, { title: "Chương 2: Đạo hàm" });

  const lVideoReady = await adminCourseService.createLesson(created.id, {
    sectionId: s1.id,
    title: "Bài 1: Khái niệm hàm số",
    slug: "bai-1-khai-niem-ham-so",
    lessonType: "video",
    isFreePreview: true,
  });
  const lVideoDraft = await adminCourseService.createLesson(created.id, {
    sectionId: s1.id,
    title: "Bài 2: Video chưa tải xong",
    slug: "bai-2-video-chua-tai",
    lessonType: "video",
  });
  const lArticle = await adminCourseService.createLesson(created.id, {
    sectionId: s2.id,
    title: "Bài 3: Tổng kết công thức",
    slug: "bai-3-tong-ket-cong-thuc",
    lessonType: "article",
    contentHtml: "<p>Công thức trọng tâm</p>",
    estimatedDurationSeconds: 300,
  });

  const asset1 = await bunnyService.create({ courseId: created.id, lessonId: lVideoReady.id }, adminActor);
  await bunnyService.sync(asset1.videoAssetId, adminActor);

  const asset2 = await bunnyService.create({ courseId: created.id, lessonId: lVideoDraft.id }, adminActor);
  // Leave asset2 in pending/uploading state

  const pubResult = await adminCourseService.publishReadyCurriculum(created.id);
  assert.equal(pubResult.publishedLessons, 2);
  assert.equal(pubResult.skippedVideoLessons, 1);
  assert.equal(pubResult.publishedSections, 2);

  const publishedCourse = await adminCourseService.publishCourse(created.id);
  assert.equal(publishedCourse.status, "published");

  // Reorder sections & move lArticle if needed
  const reordered = await adminCourseService.reorderCurriculum(created.id, {
    sectionIds: [s2.id, s1.id],
    sections: [
      { sectionId: s1.id, lessonIds: [lVideoDraft.id, lVideoReady.id] },
      { sectionId: s2.id, lessonIds: [lArticle.id] },
    ],
  });
  assert.deepEqual(
    reordered.curriculum.map((sec) => sec.id),
    [s2.id, s1.id],
  );
  assert.deepEqual(
    reordered.curriculum[1].lessons.map((l) => l.id),
    [lVideoDraft.id, lVideoReady.id],
  );

  // Deleting a lesson while live video asset is still attached must fail cleanly
  await assert.rejects(
    adminCourseService.deleteLesson(created.id, lVideoDraft.id),
    { code: "ADMIN_COURSE_LESSON_HAS_VIDEO" },
  );

  // Removing the Bunny video detaches it and soft-deletes the asset, allowing lesson deletion
  const removed = await bunnyService.remove(asset2.videoAssetId, adminActor);
  assert.equal(removed.deleted, true);
  assert.equal(deletedRemoteGuids.length, 1);

  const delLesson = await adminCourseService.deleteLesson(created.id, lVideoDraft.id);
  assert.equal(delLesson.deleted, true);
});

test("free preview allows non-enrolled student to view room and play preview video while blocking locked lessons", async () => {
  const detail = await courseService.getCourseLanding("khoa-toan-csca-thuc-chien", studentB);
  const allLessons = detail.curriculum.flatMap((s) => s.lessons);
  const previewLesson = allLessons.find((l) => l.isFreePreview);
  const lockedLesson = allLessons.find((l) => !l.isFreePreview);

  assert.ok(previewLesson, "Expected a free preview lesson");
  assert.ok(lockedLesson, "Expected a non-preview lesson");
  assert.equal(previewLesson.isLocked, false);
  assert.equal(lockedLesson.isLocked, true);

  // Non-enrolled studentB can open the learning room & create a Bunny playback session on free preview
  const room = await learningService.getLearningLesson(previewLesson.id, studentB);
  assert.equal(room.enrollment.id, 0);
  assert.equal(room.lesson.id, previewLesson.id);

  const session = await playbackService.createLessonPlaybackSession(previewLesson.id, studentB);
  assert.equal(session.deliveryType, "bunny");
  assert.match(session.embedUrl, /\/embed\/123\//);

  // Locked lesson remains strictly blocked for non-enrolled studentB
  await assert.rejects(
    learningService.getLearningLesson(lockedLesson.id, studentB),
    { code: "ENROLLMENT_REQUIRED" },
  );
});

test("direct admin course grant/revoke & never-shorten expiry rule", async () => {
  const row = (await pg.query("SELECT id FROM courses WHERE slug = 'khoa-toan-csca-thuc-chien'")).rows[0];
  const courseId = Number(row.id);

  const grantRes = await enrollmentAdmin.grantCourseEnrollments(courseId, {
    emails: ["studentA@moli.test", "missing_user@moli.test"],
    durationDays: 180,
  });
  assert.equal(grantRes.grantedCount, 1);
  assert.deepEqual(grantRes.notFoundEmails, ["missing_user@moli.test"]);

  const firstExpiry = new Date(grantRes.grantedUsers[0].expiresAt).getTime();

  // Re-granting with shorter duration (30 days) must NOT shorten existing 180-day grant
  const shorterGrant = await enrollmentAdmin.grantUserCourseAccess(studentA.id, {
    courseId,
    durationDays: 30,
  });
  const secondExpiry = new Date(shorterGrant.grantedUsers[0].expiresAt).getTime();
  assert.ok(secondExpiry >= firstExpiry - 1000, "Existing longer grant must not be shortened");

  // StudentA now has full access to locked lessons even on access_type = 'private'
  await courseService.requireLearningAccess(courseId, studentA);

  const accessInfo = await enrollmentAdmin.getUserCourseAccess(studentA.id);
  assert.equal(accessInfo.enrollments.length, 1);
  assert.equal(accessInfo.enrollments[0].source, "admin");

  // Revoking immediately blocks access
  await enrollmentAdmin.revokeUserCourseAccess(studentA.id, accessInfo.enrollments[0].id);
  await assert.rejects(courseService.requireLearningAccess(courseId, studentA), { code: "ENROLLMENT_REQUIRED" });
});

test("video commerce bulkGrant & multi-field user lookup", async () => {
  const courseId = Number((await pg.query("SELECT id FROM courses WHERE slug = 'khoa-toan-csca-thuc-chien'")).rows[0].id);

  // Lookup by full_name and username
  const byName = await videoAdmin.lookup("users", { search: "Hoc Vien B", page: 1 });
  assert.equal(byName.items.length, 1);
  assert.equal(byName.items[0].email, "studentB@moli.test");

  const byUsername = await videoAdmin.lookup("users", { search: "studenta", page: 1 });
  assert.equal(byUsername.items.length, 1);

  const pkg = await videoAdmin.saveProduct(
    "video",
    null,
    {
      name: "Gói Toán Thực Chiến",
      status: "active",
      priceVnd: 299000,
      durationMode: "days",
      durationDays: 90,
      allowedSubjects: ["MATH"],
      courseIds: [courseId],
      renewalMode: "extend",
    },
    adminActor.id,
  );

  const bulk = await videoAdmin.bulkGrant(
    {
      type: "video",
      productId: pkg.id,
      emails: ["studentB@moli.test", "unknown@moli.test"],
      videoExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      reason: "Cấp hàng loạt lớp tháng 11",
      requestKey: "bulk_test_request_key_001",
    },
    adminActor.id,
  );
  assert.equal(bulk.grantedCount, 1);
  assert.deepEqual(bulk.notFoundEmails, ["unknown@moli.test"]);
  assert.equal(bulk.failed.length, 0);

  // StudentB now gets lazy-synced enrollment and full course access
  await courseService.requireLearningAccess(courseId, studentB);
});
