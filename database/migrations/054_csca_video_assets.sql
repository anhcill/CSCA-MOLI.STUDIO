-- CSCA course video assets: private R2 source uploads and HLS renditions.
-- Additive migration. Apply after 052_csca_courses_core.sql.

CREATE TABLE IF NOT EXISTS video_assets (
  id BIGSERIAL PRIMARY KEY,
  external_key VARCHAR(80) NOT NULL UNIQUE,
  course_id BIGINT REFERENCES courses(id) ON DELETE RESTRICT,
  lesson_id BIGINT REFERENCES course_lessons(id) ON DELETE RESTRICT,
  purpose VARCHAR(20) NOT NULL DEFAULT 'lesson'
    CHECK (purpose IN ('lesson', 'preview')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'processing', 'ready', 'failed', 'deleted')),
  source_object_key TEXT,
  source_etag VARCHAR(255),
  source_checksum_sha256 CHAR(64),
  source_mime_type VARCHAR(100),
  source_size_bytes BIGINT CHECK (source_size_bytes IS NULL OR source_size_bytes >= 0),
  source_width INTEGER CHECK (source_width IS NULL OR source_width > 0),
  source_height INTEGER CHECK (source_height IS NULL OR source_height > 0),
  duration_seconds NUMERIC(12,3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  thumbnail_object_key TEXT,
  hls_master_object_key TEXT,
  hls_segment_duration_seconds NUMERIC(6,3)
    CHECK (hls_segment_duration_seconds IS NULL OR hls_segment_duration_seconds > 0),
  hls_manifest_version VARCHAR(30),
  processing_error_code VARCHAR(80),
  processing_error_message TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (course_id IS NOT NULL OR purpose = 'preview'),
  CHECK (lesson_id IS NULL OR purpose = 'lesson'),
  CHECK (status <> 'ready' OR hls_master_object_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_video_assets_lesson_status
  ON video_assets(lesson_id, status)
  WHERE lesson_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_video_assets_course_status
  ON video_assets(course_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_video_assets_created_by
  ON video_assets(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS video_variants (
  id BIGSERIAL PRIMARY KEY,
  video_asset_id BIGINT NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  resolution VARCHAR(10) NOT NULL
    CHECK (resolution IN ('360p', '480p', '720p', '1080p')),
  delivery_type VARCHAR(10) NOT NULL DEFAULT 'hls'
    CHECK (delivery_type = 'hls'),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  video_codec VARCHAR(30) NOT NULL DEFAULT 'h264',
  audio_codec VARCHAR(30) NOT NULL DEFAULT 'aac',
  bandwidth_bps INTEGER NOT NULL CHECK (bandwidth_bps > 0),
  average_bandwidth_bps INTEGER CHECK (average_bandwidth_bps IS NULL OR average_bandwidth_bps > 0),
  frame_rate NUMERIC(7,3) CHECK (frame_rate IS NULL OR frame_rate > 0),
  duration_seconds NUMERIC(12,3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  playlist_object_key TEXT NOT NULL,
  segment_prefix TEXT NOT NULL,
  segment_count INTEGER CHECK (segment_count IS NULL OR segment_count >= 0),
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  manifest_checksum_sha256 CHAR(64),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(video_asset_id, resolution, delivery_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_variants_one_default
  ON video_variants(video_asset_id)
  WHERE is_default = TRUE AND is_ready = TRUE;
CREATE INDEX IF NOT EXISTS idx_video_variants_ready
  ON video_variants(video_asset_id, height) WHERE is_ready = TRUE;

CREATE TABLE IF NOT EXISTS video_upload_sessions (
  id BIGSERIAL PRIMARY KEY,
  external_key VARCHAR(80) NOT NULL UNIQUE,
  video_asset_id BIGINT NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'r2' CHECK (provider = 'r2'),
  provider_upload_id TEXT,
  object_key TEXT NOT NULL,
  upload_kind VARCHAR(20) NOT NULL DEFAULT 'source'
    CHECK (upload_kind IN ('source', 'hls_bundle')),
  mode VARCHAR(20) NOT NULL DEFAULT 'single'
    CHECK (mode IN ('single', 'multipart')),
  content_type VARCHAR(100),
  expected_size_bytes BIGINT CHECK (expected_size_bytes IS NULL OR expected_size_bytes >= 0),
  part_size_bytes BIGINT CHECK (part_size_bytes IS NULL OR part_size_bytes > 0),
  expected_checksum_sha256 CHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'uploading', 'completed', 'aborted', 'expired', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  aborted_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (mode <> 'multipart' OR provider_upload_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_upload_sessions_active_object
  ON video_upload_sessions(object_key)
  WHERE status IN ('created', 'uploading');
CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_asset_status
  ON video_upload_sessions(video_asset_id, status, expires_at);

COMMENT ON COLUMN video_assets.hls_master_object_key IS
  'Private R2 key; never expose through public course or curriculum APIs.';
COMMENT ON TABLE video_upload_sessions IS
  'Upload state only. Presigned URLs and playback bearer tokens must never be persisted.';

-- The core migration intentionally reserves these columns because the two table
-- groups reference each other. Add the reverse FKs only after video_assets exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_courses_preview_video_asset' AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT fk_courses_preview_video_asset
      FOREIGN KEY (preview_video_asset_id) REFERENCES video_assets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_course_lessons_video_asset' AND conrelid = 'course_lessons'::regclass
  ) THEN
    ALTER TABLE course_lessons
      ADD CONSTRAINT fk_course_lessons_video_asset
      FOREIGN KEY (video_asset_id) REFERENCES video_assets(id) ON DELETE SET NULL;
  END IF;
END $$;
