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
  return { create, status, authorization, sync, recover };
}
module.exports = { createBunnyMediaService, providerState };
