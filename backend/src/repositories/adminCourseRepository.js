const db = require("../config/database");

const COURSE_COLUMNS = `
  id, external_key, slug, title, short_description, description, subject_code,
  level, thumbnail_url, preview_video_asset_id, instructor_id, access_type,
  required_tier, price_vnd, compare_at_price_vnd, status, is_featured, is_new,
  is_hot, certificate_enabled, total_sections, total_lessons,
  total_duration_seconds, published_at, content_updated_at, created_at, updated_at`;

function executor(client) {
  return client || db;
}

async function transaction(work) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function list({ q = null, subjectCode = null, status = null, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS},
       ARRAY(
         SELECT cpa.package_id FROM course_package_access cpa
         WHERE cpa.course_id = courses.id ORDER BY cpa.package_id
       ) AS package_ids,
       COUNT(*) OVER()::int AS total_count
     FROM courses
     WHERE ($1::text IS NULL OR subject_code = $1)
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' OR slug ILIKE '%' || $3 || '%' OR external_key ILIKE '%' || $3 || '%')
     ORDER BY updated_at DESC, id DESC LIMIT $4 OFFSET $5`,
    [subjectCode, status, q, limit, offset],
  );
  return result.rows;
}

async function findById(courseId, client = null, { forUpdate = false } = {}) {
  const result = await executor(client).query(
    `SELECT ${COURSE_COLUMNS},
       ARRAY(
         SELECT cpa.package_id FROM course_package_access cpa
         WHERE cpa.course_id = courses.id ORDER BY cpa.package_id
       ) AS package_ids
     FROM courses WHERE id = $1${forUpdate ? " FOR UPDATE OF courses" : ""}`,
    [courseId],
  );
  return result.rows[0] || null;
}

async function listCurriculum(courseId, client = null) {
  const run = executor(client);
  const [sections, lessons] = await Promise.all([
    run.query(`SELECT * FROM course_sections WHERE course_id = $1 ORDER BY sort_order, id`, [courseId]),
    run.query(`SELECT * FROM course_lessons WHERE course_id = $1 ORDER BY section_id, sort_order, id`, [courseId]),
  ]);
  return { sections: sections.rows, lessons: lessons.rows };
}

async function createCourse(values, client) {
  const result = await executor(client).query(
    `INSERT INTO courses (
       external_key, slug, title, short_description, description, subject_code,
       level, thumbnail_url, instructor_id, access_type, required_tier,
       price_vnd, compare_at_price_vnd, status, is_featured, is_new, is_hot,
       certificate_enabled, content_updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
     RETURNING ${COURSE_COLUMNS}`,
    [values.externalKey, values.slug, values.title, values.shortDescription, values.description,
      values.subjectCode, values.level, values.thumbnailUrl, values.instructorId,
      values.accessType, values.requiredTier, values.priceVnd, values.compareAtPriceVnd,
      values.status, values.isFeatured, values.isNew, values.isHot, values.certificateEnabled],
  );
  return findById(result.rows[0].id, client);
}

const COURSE_UPDATE_COLUMNS = Object.freeze({
  externalKey: "external_key", slug: "slug", title: "title",
  shortDescription: "short_description", description: "description",
  subjectCode: "subject_code", level: "level", thumbnailUrl: "thumbnail_url",
  instructorId: "instructor_id", accessType: "access_type", requiredTier: "required_tier",
  priceVnd: "price_vnd", compareAtPriceVnd: "compare_at_price_vnd", status: "status",
  isFeatured: "is_featured", isNew: "is_new", isHot: "is_hot",
  certificateEnabled: "certificate_enabled", previewVideoAssetId: "preview_video_asset_id",
});

async function updateCourse(courseId, patch, client) {
  const entries = Object.entries(patch).filter(([key]) => COURSE_UPDATE_COLUMNS[key]);
  if (!entries.length) return findById(courseId, client);
  const sets = entries.map(([key], index) => `${COURSE_UPDATE_COLUMNS[key]} = $${index + 2}`);
  const result = await executor(client).query(
    `UPDATE courses SET ${sets.join(", ")}, content_updated_at = NOW() WHERE id = $1 RETURNING ${COURSE_COLUMNS}`,
    [courseId, ...entries.map(([, value]) => value)],
  );
  return result.rows[0] ? findById(courseId, client) : null;
}

async function replacePackageAccess(courseId, packageIds, client) {
  const run = executor(client);
  const ids = [...new Set(packageIds.map(Number))];
  if (ids.length) {
    const packages = await run.query(
      `SELECT id FROM vip_packages WHERE id = ANY($1::int[])`,
      [ids],
    );
    const found = new Set(packages.rows.map((row) => Number(row.id)));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) {
      const error = new Error(`Unknown package ids: ${missing.join(", ")}`);
      error.code = "COURSE_PACKAGE_NOT_FOUND";
      error.packageIds = missing;
      throw error;
    }
  }
  await run.query(`DELETE FROM course_package_access WHERE course_id = $1`, [courseId]);
  if (ids.length) {
    await run.query(
      `INSERT INTO course_package_access (course_id, package_id)
       SELECT $1, package_id FROM UNNEST($2::int[]) AS package_id`,
      [courseId, ids],
    );
  }
}

async function createSection(courseId, values, client) {
  const result = await executor(client).query(
    `INSERT INTO course_sections (course_id, title, description, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [courseId, values.title, values.description, values.sortOrder, values.isPublished],
  );
  return result.rows[0];
}

const SECTION_UPDATE_COLUMNS = Object.freeze({
  title: "title", description: "description", sortOrder: "sort_order", isPublished: "is_published",
});

async function updateSection(courseId, sectionId, patch, client) {
  const entries = Object.entries(patch).filter(([key]) => SECTION_UPDATE_COLUMNS[key]);
  if (!entries.length) {
    const result = await executor(client).query(`SELECT * FROM course_sections WHERE id = $1 AND course_id = $2`, [sectionId, courseId]);
    return result.rows[0] || null;
  }
  const sets = entries.map(([key], index) => `${SECTION_UPDATE_COLUMNS[key]} = $${index + 3}`);
  const result = await executor(client).query(
    `UPDATE course_sections SET ${sets.join(", ")} WHERE id = $1 AND course_id = $2 RETURNING *`,
    [sectionId, courseId, ...entries.map(([, value]) => value)],
  );
  return result.rows[0] || null;
}

async function findSection(courseId, sectionId, client = null) {
  const result = await executor(client).query(`SELECT * FROM course_sections WHERE id = $1 AND course_id = $2`, [sectionId, courseId]);
  return result.rows[0] || null;
}

async function createLesson(courseId, values, client) {
  const result = await executor(client).query(
    `INSERT INTO course_lessons (
       external_key, course_id, section_id, slug, title, summary, lesson_type,
       content_html, sort_order, is_published, is_free_preview, is_required,
       video_asset_id, material_id, estimated_duration_seconds, passing_score
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [values.externalKey, courseId, values.sectionId, values.slug, values.title,
      values.summary, values.lessonType, values.contentHtml, values.sortOrder,
      values.isPublished, values.isFreePreview, values.isRequired, values.videoAssetId,
      values.materialId, values.estimatedDurationSeconds, values.passingScore],
  );
  return result.rows[0];
}

const LESSON_UPDATE_COLUMNS = Object.freeze({
  externalKey: "external_key", sectionId: "section_id", slug: "slug", title: "title",
  summary: "summary", lessonType: "lesson_type", contentHtml: "content_html",
  sortOrder: "sort_order", isPublished: "is_published", isFreePreview: "is_free_preview",
  isRequired: "is_required", videoAssetId: "video_asset_id", materialId: "material_id",
  estimatedDurationSeconds: "estimated_duration_seconds", passingScore: "passing_score",
});

async function updateLesson(courseId, lessonId, patch, client) {
  const entries = Object.entries(patch).filter(([key]) => LESSON_UPDATE_COLUMNS[key]);
  if (!entries.length) return findLesson(courseId, lessonId, client);
  const sets = entries.map(([key], index) => `${LESSON_UPDATE_COLUMNS[key]} = $${index + 3}`);
  const result = await executor(client).query(
    `UPDATE course_lessons SET ${sets.join(", ")} WHERE id = $1 AND course_id = $2 RETURNING *`,
    [lessonId, courseId, ...entries.map(([, value]) => value)],
  );
  return result.rows[0] || null;
}

async function findLesson(courseId, lessonId, client = null) {
  const result = await executor(client).query(`SELECT * FROM course_lessons WHERE id = $1 AND course_id = $2`, [lessonId, courseId]);
  return result.rows[0] || null;
}

async function claimVideoAsset(courseId, lessonId, assetId, client) {
  const result = await executor(client).query(
    `UPDATE video_assets SET lesson_id = $2, updated_at = NOW()
     WHERE id = $1 AND course_id = $3 AND purpose = 'lesson' AND deleted_at IS NULL
       AND (lesson_id IS NULL OR lesson_id = $2)
     RETURNING id, course_id, lesson_id, status, hls_master_object_key`,
    [assetId, lessonId, courseId],
  );
  return result.rows[0] || null;
}

async function findPreviewAsset(courseId, assetId, client) {
  const result = await executor(client).query(
    `SELECT id FROM video_assets WHERE id = $1 AND course_id = $2 AND purpose = 'preview' AND deleted_at IS NULL FOR UPDATE`,
    [assetId, courseId],
  );
  return result.rows[0] || null;
}

async function recalculateAggregates(courseId, client) {
  const result = await executor(client).query(
    `UPDATE courses c SET
       total_sections = x.total_sections,
       total_lessons = x.total_lessons,
       total_duration_seconds = x.total_duration_seconds,
       content_updated_at = NOW()
     FROM (
       SELECT $1::bigint AS course_id,
         (SELECT COUNT(*)::int FROM course_sections WHERE course_id = $1) AS total_sections,
         (SELECT COUNT(*)::int FROM course_lessons WHERE course_id = $1) AS total_lessons,
         (SELECT COALESCE(SUM(estimated_duration_seconds), 0)::int FROM course_lessons WHERE course_id = $1) AS total_duration_seconds
     ) x WHERE c.id = x.course_id RETURNING ${COURSE_COLUMNS}`,
    [courseId],
  );
  return result.rows[0] || null;
}

async function getPublishReadiness(courseId, client) {
  const result = await executor(client).query(
    `SELECT
       COUNT(DISTINCT s.id) FILTER (WHERE s.is_published)::int AS published_sections,
       COUNT(l.id) FILTER (WHERE s.is_published AND l.is_published)::int AS published_lessons,
       COUNT(l.id) FILTER (
         WHERE s.is_published AND l.is_published AND l.lesson_type = 'video'
           AND NOT EXISTS (
             SELECT 1 FROM video_assets va
             WHERE va.id = l.video_asset_id AND va.course_id = l.course_id
               AND va.lesson_id = l.id AND va.status = 'ready' AND va.deleted_at IS NULL
               AND va.hls_master_object_key IS NOT NULL
               AND BTRIM(va.hls_master_object_key) <> ''
               AND EXISTS (
                 SELECT 1 FROM video_variants vv
                 WHERE vv.video_asset_id = va.id AND vv.is_ready = TRUE
                   AND BTRIM(vv.playlist_object_key) <> ''
                   AND BTRIM(vv.segment_prefix) <> ''
               )
           )
       )::int AS invalid_video_lessons
     FROM course_sections s
     LEFT JOIN course_lessons l ON l.section_id = s.id AND l.course_id = s.course_id
     WHERE s.course_id = $1`,
    [courseId],
  );
  return result.rows[0];
}

async function setStatus(courseId, status, client) {
  const result = await executor(client).query(
    `UPDATE courses SET status = $2,
       published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
       content_updated_at = NOW() WHERE id = $1 RETURNING ${COURSE_COLUMNS}`,
    [courseId, status],
  );
  return result.rows[0] || null;
}

module.exports = {
  transaction, list, findById, listCurriculum, createCourse, updateCourse,
  replacePackageAccess,
  createSection, updateSection, findSection, createLesson, updateLesson, findLesson,
  claimVideoAsset, findPreviewAsset, recalculateAggregates, getPublishReadiness, setStatus,
};
