ALTER TABLE course_enrollments DROP CONSTRAINT IF EXISTS chk_course_enrollments_source;
ALTER TABLE course_enrollments ADD CONSTRAINT chk_course_enrollments_source
  CHECK(source IN ('free','vip','premium','admin','coupon','package','video'));

ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'r2';
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS bunny_library_id TEXT;
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS bunny_video_id UUID;
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS bunny_status INTEGER;
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS bunny_checked_at TIMESTAMPTZ;
ALTER TABLE video_assets ADD COLUMN IF NOT EXISTS bunny_thumbnail_file TEXT;

DO $$ DECLARE item RECORD; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='video_assets'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) LIKE '%hls_master_object_key%'
  LOOP EXECUTE format('ALTER TABLE video_assets DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE video_assets DROP CONSTRAINT IF EXISTS video_assets_provider_check;
ALTER TABLE video_assets ADD CONSTRAINT video_assets_provider_check CHECK(provider IN ('r2','bunny'));
ALTER TABLE video_assets DROP CONSTRAINT IF EXISTS video_assets_ready_delivery_check;
ALTER TABLE video_assets ADD CONSTRAINT video_assets_ready_delivery_check CHECK(status<>'ready' OR
  (provider='r2' AND hls_master_object_key IS NOT NULL) OR
  (provider='bunny' AND bunny_library_id IS NOT NULL AND bunny_video_id IS NOT NULL AND duration_seconds>0));
CREATE UNIQUE INDEX IF NOT EXISTS video_assets_bunny_identity ON video_assets(bunny_library_id,bunny_video_id)
  WHERE provider='bunny';
