const db = require("../config/database");

async function findLessonVideoAsset(lessonId) {
  const result = await db.query(
    `SELECT va.id, va.status, va.hls_master_object_key
     FROM course_lessons l
     JOIN video_assets va
       ON va.id = l.video_asset_id
      AND va.lesson_id = l.id
      AND va.course_id = l.course_id
      AND va.purpose = 'lesson'
      AND va.deleted_at IS NULL
     WHERE l.id = $1
     LIMIT 1`,
    [lessonId],
  );
  return result.rows[0] || null;
}

async function listReadyVariants(videoAssetId) {
  const result = await db.query(
    `SELECT resolution, width, height, bandwidth_bps, is_ready
     FROM video_variants
     WHERE video_asset_id = $1 AND delivery_type = 'hls' AND is_ready = TRUE
       AND BTRIM(playlist_object_key) <> '' AND BTRIM(segment_prefix) <> ''
     ORDER BY height, width, id`,
    [videoAssetId],
  );
  return result.rows;
}

async function getResumePosition(userId, lessonId) {
  const result = await db.query(
    `SELECT last_position_seconds
     FROM lesson_progress
     WHERE user_id = $1 AND lesson_id = $2
     LIMIT 1`,
    [userId, lessonId],
  );
  return result.rows[0]?.last_position_seconds || 0;
}

module.exports = { findLessonVideoAsset, listReadyVariants, getResumePosition };
