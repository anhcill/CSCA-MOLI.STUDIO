-- Commerce projection for courses whose catalog and list price are owned by CSCA-Course.
-- The source_course_id marker lets catalog replay update only its own generated package
-- without touching packages created manually by Moly administrators.
DO $$
BEGIN
  IF to_regclass('video_packages') IS NOT NULL THEN
    ALTER TABLE video_packages
      ADD COLUMN IF NOT EXISTS source_system VARCHAR(80),
      ADD COLUMN IF NOT EXISTS source_course_id VARCHAR(120);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_video_packages_source_course
      ON video_packages(source_system, source_course_id)
      WHERE source_system IS NOT NULL AND source_course_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_video_packages_source_course_lookup
      ON video_packages(source_course_id, status)
      WHERE source_system = 'csca-course';
  END IF;
END $$;
