const crypto = require('crypto');
const db = require('../config/database');
const { assertCanManageCourse } = require('../middleware/courseManagementScope');
const { CourseApiError } = require('../utils/courseResponses');
const { createBunnyStreamAdapter, bunnyConfigFromEnv } = require('./bunnyStreamAdapter');
const { positiveInteger } = require('./courseService');

function providerState(video) {
  const status = Number(video.status);
  const duration = Number(video.length);
  // Finished encoding only. A playable partial rendition does not finish ingestion.
  if (status === 4 && Number.isFinite(duration) && duration > 0) return { status: 'ready', duration };
  if ([5, 6].includes(status)) return { status: 'failed', duration: null };
  if ([0, 1].includes(status)) return { status: 'uploading', duration: null };
  return { status: 'processing', duration: null };
}
function createBunnyMediaService({ database = db, adapter, config = bunnyConfigFromEnv(), authorize = assertCanManageCourse } = {}) {
  const bunny = adapter || createBunnyStreamAdapter(config);
  async function transaction(work) {
    const client = await database.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  function dto(row) {
    return { videoAssetId: Number(row.id), provider: row.provider, status: row.status,
      assetExternalKey: row.external_key, durationSeconds: Number(row.duration_seconds || 0),
      providerVideoId: row.bunny_video_id || null, checkedAt: row.bunny_checked_at || null,
      thumbnailFile: row.bunny_thumbnail_file || null };
  }
  async function assetForActor(id, actor, client = database, lock = false) {
    const row = (await client.query(`SELECT * FROM video_assets WHERE id=$1 AND deleted_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [positiveInteger(id, 'assetId')])).rows[0];
    if (!row) throw new CourseApiError(404, 'VIDEO_ASSET_NOT_FOUND', 'Video not found.');
    await authorize(actor, row.course_id);
    return row;
  }
  function requireBunny(row) {
    if (row.provider !== 'bunny' || String(row.bunny_library_id) !== String(config.libraryId))
      throw new CourseApiError(409, 'BUNNY_LIBRARY_MISMATCH', 'Video does not belong to the configured library.');
  }
  async function status(id, actor) { return dto(await assetForActor(id, actor)); }
  async function create(input, actor) {
    const courseId = positiveInteger(input.courseId, 'courseId'), lessonId = positiveInteger(input.lessonId, 'lessonId');
    await authorize(actor, courseId);
    // Validate credentials before allocating local state; no API key reaches the browser.
    bunny.createTusAuthorization('00000000-0000-0000-0000-000000000000');
    const allocated = await transaction(async client => {
      await client.query('SELECT id FROM courses WHERE id=$1 FOR UPDATE', [courseId]);
      const lesson = (await client.query('SELECT * FROM course_lessons WHERE id=$1 AND course_id=$2 FOR UPDATE', [lessonId, courseId])).rows[0];
      if (!lesson || lesson.lesson_type !== 'video') throw new CourseApiError(422, 'BUNNY_LESSON_INVALID', 'Select a video lesson.');
      if (lesson.video_asset_id) {
        const existing = await assetForActor(lesson.video_asset_id, actor, client);
        requireBunny(existing);
        return { row: existing, fresh: false };
      }
      const row = (await client.query(`INSERT INTO video_assets(external_key,course_id,lesson_id,purpose,status,provider,bunny_library_id,created_by)
        VALUES($1,$2,$3,'lesson','pending','bunny',$4,$5) RETURNING *`, [crypto.randomUUID(), courseId, lessonId, String(config.libraryId), actor.id])).rows[0];
      await client.query('UPDATE course_lessons SET video_asset_id=$1 WHERE id=$2', [row.id, lessonId]);
      return { row, fresh: true };
    });
    if (allocated.fresh) {
      // Persist the allocation first. Ambiguous provider failures must never create another remote video on retry.
      try {
        const video = await bunny.createVideo(`lesson-${lessonId}-${allocated.row.external_key}`);
        await database.query("UPDATE video_assets SET bunny_video_id=$2,status='uploading',updated_at=NOW() WHERE id=$1", [allocated.row.id, video.guid]);
      } catch {
        throw new CourseApiError(409,'BUNNY_CREATE_UNCERTAIN','Check the provider allocation before retrying.',{ videoAssetId: Number(allocated.row.id) });
      }
    }
    return authorization(allocated.row.id, actor);
  }
  async function authorization(id, actor) {
    const row = await assetForActor(id, actor); requireBunny(row);
    if (!row.bunny_video_id) throw new CourseApiError(409, 'BUNNY_CREATE_UNCERTAIN', 'Check the Bunny library and recover this allocation before retrying.', { videoAssetId: Number(row.id) });
    if (!['uploading','pending','failed'].includes(row.status)) throw new CourseApiError(409, 'BUNNY_UPLOAD_ALREADY_RECEIVED', 'Video is already processing or ready.');
    return { ...dto(row), upload: bunny.createTusAuthorization(row.bunny_video_id) };
  }
  async function recover(id, videoId, actor) {
    return transaction(async client => {
      const row = await assetForActor(id, actor, client, true); requireBunny(row);
      if (row.bunny_video_id) throw new CourseApiError(409, 'BUNNY_ALREADY_LINKED', 'Video is already linked.');
      const video = await bunny.getVideo(videoId);
      if (video.title !== `lesson-${row.lesson_id}-${row.external_key}`)
        throw new CourseApiError(422, 'BUNNY_RECOVERY_MISMATCH', 'Remote video does not match this allocation.');
      const saved = (await client.query("UPDATE video_assets SET bunny_video_id=$2,status='uploading',updated_at=NOW() WHERE id=$1 RETURNING *", [id, video.guid])).rows[0];
      return dto(saved);
    });
  }
  async function sync(id, actor) {
    const initial = await assetForActor(id, actor); requireBunny(initial);
    return transaction(async client => {
      // Same lock order as course editing, then fetch inside the lock to prevent stale sync overwrites.
      await client.query('SELECT id FROM courses WHERE id=$1 FOR UPDATE', [initial.course_id]);
      const row = await assetForActor(id, actor, client, true); requireBunny(row);
      if (!row.bunny_video_id) throw new CourseApiError(409, 'BUNNY_CREATE_UNCERTAIN', 'Recover the provider identity first.');
      const video = await bunny.getVideo(row.bunny_video_id), state = providerState(video);
      const saved = (await client.query(`UPDATE video_assets SET status=$2,duration_seconds=$3,bunny_status=$4,
        bunny_checked_at=NOW(),bunny_thumbnail_file=$5,updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id,state.status,state.duration,video.status,video.thumbnailFileName || null])).rows[0];
      if (state.status === 'ready') {
        await client.query('UPDATE course_lessons SET estimated_duration_seconds=$2 WHERE video_asset_id=$1 AND id=$3 AND course_id=$4',
          [id,Math.ceil(state.duration),row.lesson_id,row.course_id]);
        await client.query(`UPDATE courses SET total_duration_seconds=(SELECT COALESCE(SUM(estimated_duration_seconds),0)
          FROM course_lessons WHERE course_id=$1),content_updated_at=NOW() WHERE id=$1`,[row.course_id]);
      }
      return dto(saved);
    });
  }
  async function preview(id, actor) {
    if (!actor?.rbacRoles?.includes('super_admin'))
      throw new CourseApiError(403, 'SUPER_ADMIN_REQUIRED', 'Only super admins can preview unpublished videos.');
    const row = await assetForActor(id, actor); requireBunny(row);
    if (row.status !== 'ready') throw new CourseApiError(409, 'VIDEO_NOT_READY', 'Video is not ready.');
    const signed = bunny.createEmbedUrl(row.bunny_video_id, 300);
    return { sessionId: crypto.randomUUID(), lessonId: Number(row.lesson_id), viewerCode: `ADMIN-${actor.id}`,
      deliveryType: 'bunny', embedUrl: signed.url, manifestUrl: '', expiresAt: signed.expiresAt,
      variants: [], resumePositionSeconds: 0 };
  }
  // Counts published lessons that would remain if `lessonId` stopped being published.
  async function remainingPublishedLessons(client, courseId, lessonId) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM course_lessons l
      JOIN course_sections s ON s.id=l.section_id AND s.course_id=l.course_id
      WHERE l.course_id=$1 AND l.id<>$2 AND l.is_published AND s.is_published`, [courseId, lessonId]);
    return Number(rows[0]?.count || 0);
  }
  async function remove(id, actor) {
    const initial = await assetForActor(id, actor); requireBunny(initial);
    // Pre-check before touching the provider so a refused removal never deletes the remote video.
    const course = (await database.query('SELECT status FROM courses WHERE id=$1', [initial.course_id])).rows[0];
    const lesson = initial.lesson_id
      ? (await database.query('SELECT id,is_published,video_asset_id FROM course_lessons WHERE id=$1', [initial.lesson_id])).rows[0]
      : null;
    const attached = lesson && String(lesson.video_asset_id) === String(initial.id);
    if (course?.status === 'published' && attached && lesson.is_published
      && await remainingPublishedLessons(database, initial.course_id, lesson.id) < 1) {
      throw new CourseApiError(409, 'COURSE_UNPUBLISH_REQUIRED',
        'Đây là bài duy nhất đang hiển thị của khóa đã xuất bản. Hãy gỡ xuất bản khóa học trước khi xóa video.');
    }
    // A missing remote video is treated as deleted, which also releases BUNNY_CREATE_UNCERTAIN allocations.
    if (initial.bunny_video_id) await bunny.deleteVideo(initial.bunny_video_id);
    return transaction(async client => {
      await client.query('SELECT id FROM courses WHERE id=$1 FOR UPDATE', [initial.course_id]);
      const row = await assetForActor(id, actor, client, true);
      const detached = await client.query(`UPDATE course_lessons SET video_asset_id=NULL,estimated_duration_seconds=0,
        is_published=CASE WHEN lesson_type='video' THEN FALSE ELSE is_published END
        WHERE video_asset_id=$1 AND course_id=$2 RETURNING id`, [row.id, row.course_id]);
      await client.query("UPDATE video_assets SET status='deleted',deleted_at=COALESCE(deleted_at,NOW()),updated_at=NOW() WHERE id=$1", [row.id]);
      await client.query(`UPDATE courses SET total_duration_seconds=(SELECT COALESCE(SUM(estimated_duration_seconds),0)
        FROM course_lessons WHERE course_id=$1),content_updated_at=NOW() WHERE id=$1`, [row.course_id]);
      return { deleted: true, videoAssetId: Number(row.id), detachedLessonIds: detached.rows.map(r => Number(r.id)) };
    });
  }
  return { create, status, authorization, sync, recover, preview, remove };
}
module.exports = { createBunnyMediaService, providerState };
