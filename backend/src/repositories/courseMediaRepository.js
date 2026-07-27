const db = require("../config/database");

async function findCourseLesson(courseId, lessonId) {
  const result = await db.query(
    `SELECT c.id AS course_id, l.id AS lesson_id
     FROM courses c
     JOIN course_lessons l ON l.course_id = c.id
     WHERE c.id = $1 AND l.id = $2
     LIMIT 1`,
    [courseId, lessonId],
  );
  return result.rows[0] || null;
}

async function createSourceUpload({ externalKey, assetExternalKey, courseId, lessonId, objectKey, contentType, sizeBytes, checksumSha256, expiresAt, createdBy }) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const asset = await client.query(
      `INSERT INTO video_assets (
         external_key, course_id, lesson_id, purpose, status, source_object_key,
         source_checksum_sha256, source_mime_type, source_size_bytes, created_by
       ) VALUES ($1, $2, $3, 'lesson', 'uploading', $4, $5, $6, $7, $8)
       RETURNING id, external_key`,
      [assetExternalKey, courseId, lessonId, objectKey, checksumSha256, contentType, sizeBytes, createdBy],
    );
    const session = await client.query(
      `INSERT INTO video_upload_sessions (
         external_key, video_asset_id, object_key, upload_kind, mode, content_type,
         expected_size_bytes, expected_checksum_sha256, status, expires_at, created_by
       ) VALUES ($1, $2, $3, 'source', 'single', $4, $5, $6, 'created', $7, $8)
       RETURNING id, external_key, video_asset_id, object_key, status, expires_at`,
      [externalKey, asset.rows[0].id, objectKey, contentType, sizeBytes, checksumSha256, expiresAt, createdBy],
    );
    await client.query("COMMIT");
    return { ...session.rows[0], asset_external_key: asset.rows[0].external_key };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findSessionForAdmin(externalKey, createdBy) {
  const result = await db.query(
    `SELECT s.*, a.course_id, a.lesson_id, a.status AS asset_status
     FROM video_upload_sessions s
     JOIN video_assets a ON a.id = s.video_asset_id AND a.deleted_at IS NULL
     WHERE s.external_key = $1 AND s.created_by = $2
     LIMIT 1`,
    [externalKey, createdBy],
  );
  return result.rows[0] || null;
}

async function findAssetForFinalize(assetId) {
  const result = await db.query(
    `SELECT id, external_key, course_id, lesson_id, purpose, status, created_by
     FROM video_assets
     WHERE id = $1 AND purpose = 'lesson' AND deleted_at IS NULL
     LIMIT 1`,
    [assetId],
  );
  return result.rows[0] || null;
}

async function findAssetForDelete(assetId) {
  const result = await db.query(
    `SELECT id, external_key, course_id, lesson_id, purpose, status, deleted_at
     FROM video_assets
     WHERE id = $1 AND purpose = 'lesson'
     LIMIT 1`,
    [assetId],
  );
  return result.rows[0] || null;
}

async function expireSession(externalKey, createdBy) {
  await db.query(
    `UPDATE video_upload_sessions
     SET status = 'expired'
     WHERE external_key = $1 AND created_by = $2
       AND status IN ('created', 'uploading') AND expires_at <= NOW()`,
    [externalKey, createdBy],
  );
}

async function completeSourceUpload(externalKey, createdBy, { etag }) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT s.*, a.status AS asset_status
       FROM video_upload_sessions s
       JOIN video_assets a ON a.id = s.video_asset_id
       WHERE s.external_key = $1 AND s.created_by = $2
       FOR UPDATE OF s, a`,
      [externalKey, createdBy],
    );
    const row = locked.rows[0];
    if (!row) { const error = new Error("VIDEO_UPLOAD_NOT_FOUND"); error.code = "VIDEO_UPLOAD_NOT_FOUND"; throw error; }
    if (row.status === "completed") { await client.query("COMMIT"); return { ...row, alreadyCompleted: true }; }
    if (!["created", "uploading"].includes(row.status) || new Date(row.expires_at) <= new Date()) {
      const next = new Date(row.expires_at) <= new Date() ? "expired" : row.status;
      if (next === "expired") await client.query(`UPDATE video_upload_sessions SET status = 'expired' WHERE id = $1`, [row.id]);
      await client.query("COMMIT");
      const error = new Error("VIDEO_UPLOAD_NOT_COMPLETABLE"); error.code = "VIDEO_UPLOAD_NOT_COMPLETABLE"; throw error;
    }
    await client.query(
      `UPDATE video_upload_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [row.id],
    );
    await client.query(
      `UPDATE video_assets SET status = 'processing', source_etag = $2, updated_at = NOW() WHERE id = $1`,
      [row.video_asset_id, etag],
    );
    await client.query("COMMIT");
    return { ...row, status: "completed", alreadyCompleted: false };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function markHlsReady({ assetId, masterObjectKey, manifestVersion, durationSeconds,
  segmentDurationSeconds, variants }) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, course_id, lesson_id, status FROM video_assets
       WHERE id = $1 AND purpose = 'lesson' AND deleted_at IS NULL
       FOR UPDATE`,
      [assetId],
    );
    const asset = locked.rows[0];
    if (!asset) { const error = new Error("VIDEO_ASSET_NOT_FOUND"); error.code = "VIDEO_ASSET_NOT_FOUND"; throw error; }
    if (!asset.course_id || !asset.lesson_id || !["processing", "ready"].includes(asset.status)) {
      const error = new Error("VIDEO_ASSET_NOT_FINALIZABLE"); error.code = "VIDEO_ASSET_NOT_FINALIZABLE"; throw error;
    }

    await client.query(`DELETE FROM video_variants WHERE video_asset_id = $1`, [assetId]);
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      await client.query(
        `INSERT INTO video_variants (
           video_asset_id, resolution, delivery_type, width, height, video_codec,
           audio_codec, bandwidth_bps, average_bandwidth_bps, frame_rate,
           duration_seconds, playlist_object_key, segment_prefix, segment_count,
           is_default, is_ready
         ) VALUES ($1,$2,'hls',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)`,
        [assetId, variant.resolution, variant.width, variant.height, variant.videoCodec,
          variant.audioCodec, variant.bandwidthBps, variant.averageBandwidthBps,
          variant.frameRate, variant.durationSeconds, variant.playlistObjectKey,
          variant.segmentPrefix, variant.segmentCount, index === variants.length - 1],
      );
    }

    await client.query(
      `UPDATE video_assets SET status = 'ready', hls_master_object_key = $2,
         hls_segment_duration_seconds = $3, hls_manifest_version = $4,
         duration_seconds = $5, processing_error_code = NULL,
         processing_error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [assetId, masterObjectKey, segmentDurationSeconds, manifestVersion, durationSeconds],
    );
    const lesson = await client.query(
      `UPDATE course_lessons SET video_asset_id = $1,
         estimated_duration_seconds = GREATEST(1, ROUND($4::numeric)::int), updated_at = NOW()
       WHERE id = $2 AND course_id = $3 RETURNING id`,
      [assetId, asset.lesson_id, asset.course_id, durationSeconds],
    );
    if (!lesson.rows[0]) { const error = new Error("VIDEO_ASSET_LESSON_MISMATCH"); error.code = "VIDEO_ASSET_LESSON_MISMATCH"; throw error; }
    await client.query(
      `UPDATE courses SET total_duration_seconds = COALESCE((
         SELECT SUM(estimated_duration_seconds)::int FROM course_lessons WHERE course_id = $1
       ), 0), content_updated_at = NOW() WHERE id = $1`,
      [asset.course_id],
    );
    await client.query("COMMIT");
    return { assetId: Number(assetId), courseId: Number(asset.course_id), lessonId: Number(asset.lesson_id) };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function markAssetDeleted(assetId) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, course_id, lesson_id, status, deleted_at
       FROM video_assets
       WHERE id = $1 AND purpose = 'lesson'
       FOR UPDATE`,
      [assetId],
    );
    const asset = locked.rows[0];
    if (!asset) {
      const error = new Error("VIDEO_ASSET_NOT_FOUND");
      error.code = "VIDEO_ASSET_NOT_FOUND";
      throw error;
    }

    const detached = await client.query(
      `UPDATE course_lessons
       SET video_asset_id = NULL, estimated_duration_seconds = 0, updated_at = NOW()
       WHERE id = $1 AND course_id = $2 AND video_asset_id = $3
       RETURNING id`,
      [asset.lesson_id, asset.course_id, assetId],
    );
    await client.query(
      `UPDATE video_upload_sessions
       SET status = 'aborted', aborted_at = COALESCE(aborted_at, NOW())
       WHERE video_asset_id = $1 AND status IN ('created', 'uploading')`,
      [assetId],
    );
    await client.query(`DELETE FROM video_variants WHERE video_asset_id = $1`, [assetId]);
    await client.query(
      `UPDATE video_assets
       SET status = 'deleted', deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
       WHERE id = $1`,
      [assetId],
    );
    if (detached.rows[0]) {
      await client.query(
        `UPDATE courses SET total_duration_seconds = COALESCE((
           SELECT SUM(estimated_duration_seconds)::int FROM course_lessons WHERE course_id = $1
         ), 0), content_updated_at = NOW() WHERE id = $1`,
        [asset.course_id],
      );
    }
    await client.query("COMMIT");
    return {
      assetId: Number(assetId),
      courseId: Number(asset.course_id),
      lessonId: Number(asset.lesson_id),
      detached: Boolean(detached.rows[0]),
      alreadyDeleted: Boolean(asset.deleted_at),
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  completeSourceUpload,
  createSourceUpload,
  expireSession,
  findAssetForDelete,
  findAssetForFinalize,
  findCourseLesson,
  findSessionForAdmin,
  markAssetDeleted,
  markHlsReady,
};
