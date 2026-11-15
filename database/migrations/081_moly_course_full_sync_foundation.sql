-- Migration 081: Moly Studio <-> CSCA-Course Full Sync v2 Foundation (Day 1).
-- Strictly additive & idempotent. Preserves all pre-existing native Moly courses
-- (default content_origin = 'moly_native'), video commerce tables, and learning history.

-- 1. Distinguish native Moly courses from synced CSCA-Course projections
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS content_origin VARCHAR(32) NOT NULL DEFAULT 'moly_native',
  ADD COLUMN IF NOT EXISTS remote_source_system VARCHAR(50),
  ADD COLUMN IF NOT EXISTS remote_course_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tombstoned_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'courses'::regclass
      AND conname = 'chk_courses_content_origin'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT chk_courses_content_origin
      CHECK (content_origin IN ('moly_native', 'csca_course') AND sync_revision >= 1);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_csca_course_remote
  ON courses (remote_source_system, remote_course_id)
  WHERE content_origin = 'csca_course' AND remote_course_id IS NOT NULL;

ALTER TABLE IF EXISTS course_sections
  ADD COLUMN IF NOT EXISTS content_origin VARCHAR(32) NOT NULL DEFAULT 'moly_native',
  ADD COLUMN IF NOT EXISTS remote_section_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tombstoned_at TIMESTAMPTZ;

DO $$
BEGIN
  IF to_regclass('course_sections') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('course_sections')
      AND conname = 'chk_course_sections_content_origin'
  ) THEN
    EXECUTE 'ALTER TABLE course_sections
      ADD CONSTRAINT chk_course_sections_content_origin
      CHECK (content_origin IN (''moly_native'', ''csca_course'') AND sync_revision >= 1)';
  END IF;
END $$;

ALTER TABLE IF EXISTS course_lessons
  ADD COLUMN IF NOT EXISTS content_origin VARCHAR(32) NOT NULL DEFAULT 'moly_native',
  ADD COLUMN IF NOT EXISTS remote_unit_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS remote_unit_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tombstoned_at TIMESTAMPTZ;

DO $$
BEGIN
  IF to_regclass('course_lessons') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('course_lessons')
      AND conname = 'chk_course_lessons_content_origin'
  ) THEN
    EXECUTE 'ALTER TABLE course_lessons
      ADD CONSTRAINT chk_course_lessons_content_origin
      CHECK (
        content_origin IN (''moly_native'', ''csca_course'')
        AND (remote_unit_type IS NULL OR remote_unit_type IN (''lesson'', ''class_session''))
        AND sync_revision >= 1
      )';
  END IF;
END $$;

-- Extend external_course_mappings with additive v2 metadata
ALTER TABLE external_course_mappings
  ADD COLUMN IF NOT EXISTS origin_mode VARCHAR(32) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS remote_course_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS remote_profile_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS last_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'external_course_mappings'::regclass
      AND conname = 'chk_external_course_mappings_origin_mode'
  ) THEN
    ALTER TABLE external_course_mappings
      ADD CONSTRAINT chk_external_course_mappings_origin_mode
      CHECK (origin_mode IN ('manual', 'catalog_auto', 'profile_projection') AND last_revision >= 1);
  END IF;
END $$;

-- Expand integration_conflicts conflict_type enum safely for v2 origin & revision checks
ALTER TABLE integration_conflicts
  DROP CONSTRAINT IF EXISTS integration_conflicts_conflict_type_check;
ALTER TABLE integration_conflicts
  ADD CONSTRAINT integration_conflicts_conflict_type_check
  CHECK (conflict_type IN (
    'IDENTITY_EMAIL_COLLISION',
    'PRIVILEGED_ROLE_COLLISION',
    'IDENTITY_ALREADY_LINKED',
    'COURSE_MAPPING_MISSING',
    'ENTITLEMENT_CONFLICT',
    'STALE_EVENT_CONFLICT',
    'UNRESOLVED_IDENTITY',
    'MANUAL_REVIEW_REQUIRED',
    'LEGACY_ORIGIN_CONFLICT',
    'PROFILE_SCOPE_MISMATCH',
    'REVISION_CONFLICT'
  ));

-- Helper trigger enforcing strictly non-regressing revision & timestamp on projections
CREATE OR REPLACE FUNCTION prevent_stale_revision_regression()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_revision < OLD.last_revision THEN
    RAISE EXCEPTION 'STALE_REVISION_REGRESSION: incoming revision (%) is older than stored (%)',
      NEW.last_revision, OLD.last_revision
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.last_revision = OLD.last_revision AND NEW.source_updated_at < OLD.source_updated_at THEN
    RAISE EXCEPTION 'STALE_SOURCE_UPDATED_AT: incoming source_updated_at (%) is older than stored (%)',
      NEW.source_updated_at, OLD.source_updated_at
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 1 Course : N Offering Profile projections (supports MIRROR + INDEPENDENT offerings + tombstones)
CREATE TABLE IF NOT EXISTS course_profile_projections (
  id                      BIGSERIAL PRIMARY KEY,
  source_system           VARCHAR(50) NOT NULL DEFAULT 'csca-course'
                          CHECK (source_system IN ('csca-course')),
  remote_course_id        VARCHAR(128) NOT NULL
                          CHECK (length(btrim(remote_course_id)) > 0 AND remote_course_id = btrim(remote_course_id)),
  remote_profile_id       VARCHAR(128) NOT NULL
                          CHECK (length(btrim(remote_profile_id)) > 0 AND remote_profile_id = btrim(remote_profile_id)),
  external_offering_id    VARCHAR(160) NOT NULL
                          CHECK (length(btrim(external_offering_id)) > 0 AND external_offering_id = btrim(external_offering_id)),
  local_course_id         BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  course_mapping_id       BIGINT REFERENCES external_course_mappings(id) ON DELETE RESTRICT,
  mode                    VARCHAR(20) NOT NULL CHECK (mode IN ('MIRROR', 'INDEPENDENT')),
  management_class_id     VARCHAR(160),
  source_live_class_id    VARCHAR(128),
  badge_label             VARCHAR(120),
  allow_file_download     BOOLEAN NOT NULL DEFAULT TRUE,
  device_limit            INTEGER NOT NULL DEFAULT 2 CHECK (device_limit BETWEEN 1 AND 10),
  enforce_trusted_devices BOOLEAN NOT NULL DEFAULT TRUE,
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'archived', 'tombstoned')),
  checkout_ready          BOOLEAN NOT NULL DEFAULT FALSE,
  last_revision           BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at       TIMESTAMPTZ NOT NULL,
  deleted_at              TIMESTAMPTZ,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_profile_projections_source_profile UNIQUE (source_system, remote_profile_id),
  CONSTRAINT chk_course_profile_projections_tombstoned CHECK (status <> 'tombstoned' OR deleted_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_course_profile_projections_local_course
  ON course_profile_projections (local_course_id, status);

CREATE INDEX IF NOT EXISTS idx_course_profile_projections_offering
  ON course_profile_projections (source_system, external_offering_id);

DROP TRIGGER IF EXISTS trg_course_profile_projections_updated_at ON course_profile_projections;
CREATE TRIGGER trg_course_profile_projections_updated_at
  BEFORE UPDATE ON course_profile_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_profile_projections_prevent_stale ON course_profile_projections;
CREATE TRIGGER trg_course_profile_projections_prevent_stale
  BEFORE UPDATE ON course_profile_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

-- 3. Stream high-water mark & resumable pagination checkpoints
CREATE TABLE IF NOT EXISTS course_sync_checkpoints (
  stream_name              VARCHAR(100) PRIMARY KEY
                           CHECK (length(btrim(stream_name)) > 0 AND stream_name = btrim(stream_name)),
  source_system            VARCHAR(50) NOT NULL DEFAULT 'csca-course'
                           CHECK (source_system IN ('csca-course')),
  last_cursor              VARCHAR(255),
  after_entity_id          BIGINT NOT NULL DEFAULT 0 CHECK (after_entity_id >= 0),
  high_water_revision      BIGINT NOT NULL DEFAULT 0 CHECK (high_water_revision >= 0),
  snapshot_anchor_revision BIGINT CHECK (snapshot_anchor_revision IS NULL OR snapshot_anchor_revision >= 0),
  high_water_updated_at    TIMESTAMPTZ,
  sync_status              VARCHAR(32) NOT NULL DEFAULT 'idle'
                           CHECK (sync_status IN ('idle', 'backfilling', 'paused_kill_switch', 'error')),
  last_error_code          VARCHAR(80),
  last_error_message       TEXT,
  last_synced_at           TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_course_sync_checkpoints_updated_at ON course_sync_checkpoints;
CREATE TRIGGER trg_course_sync_checkpoints_updated_at
  BEFORE UPDATE ON course_sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Durable Course -> Moly inbox queue with aggregate revision ordering
CREATE TABLE IF NOT EXISTS moly_course_sync_inbox (
  id                 BIGSERIAL PRIMARY KEY,
  source_system      VARCHAR(50) NOT NULL DEFAULT 'csca-course'
                     CHECK (source_system IN ('csca-course')),
  schema_version     VARCHAR(16) NOT NULL DEFAULT '2.0'
                     CHECK (schema_version = '2.0'),
  event_id           VARCHAR(180) NOT NULL
                     CHECK (length(btrim(event_id)) > 0 AND event_id = btrim(event_id)),
  idempotency_key    VARCHAR(200) NOT NULL
                     CHECK (length(btrim(idempotency_key)) > 0 AND idempotency_key = btrim(idempotency_key)),
  correlation_id     VARCHAR(128),
  event_type         VARCHAR(100) NOT NULL CHECK (length(btrim(event_type)) > 0),
  aggregate_type     VARCHAR(80) NOT NULL CHECK (length(btrim(aggregate_type)) > 0),
  aggregate_id       VARCHAR(128) NOT NULL CHECK (length(btrim(aggregate_id)) > 0),
  aggregate_revision BIGINT NOT NULL CHECK (aggregate_revision >= 1),
  deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at         TIMESTAMPTZ,
  payload_hash       CHAR(64) NOT NULL CHECK (length(btrim(payload_hash)) = 64),
  payload            JSONB NOT NULL,
  source_updated_at  TIMESTAMPTZ NOT NULL,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter', 'stale', 'ignored')),
  attempt_count      INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts       INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_retry_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until       TIMESTAMPTZ,
  locked_by          VARCHAR(100),
  processed_at       TIMESTAMPTZ,
  last_error_code    VARCHAR(80),
  last_error_message TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_moly_course_sync_inbox_source_event UNIQUE (source_system, event_id),
  CONSTRAINT uq_moly_course_sync_inbox_source_idempotency UNIQUE (source_system, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_moly_course_sync_inbox_worker_claim
  ON moly_course_sync_inbox (status, next_retry_at, locked_until, id)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_moly_course_sync_inbox_aggregate
  ON moly_course_sync_inbox (aggregate_type, aggregate_id, aggregate_revision DESC, id DESC);

DROP TRIGGER IF EXISTS trg_moly_course_sync_inbox_updated_at ON moly_course_sync_inbox;
CREATE TRIGGER trg_moly_course_sync_inbox_updated_at
  BEFORE UPDATE ON moly_course_sync_inbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Read projections for Course units, files, learner progress, assessments, and timestamp notes
CREATE TABLE IF NOT EXISTS course_unit_projections (
  id                    BIGSERIAL PRIMARY KEY,
  profile_projection_id BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  local_course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  remote_section_id     VARCHAR(128),
  section_title         VARCHAR(255) NOT NULL DEFAULT '',
  section_sort_order    INTEGER NOT NULL DEFAULT 0 CHECK (section_sort_order >= 0),
  unit_type             VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id        VARCHAR(128) NOT NULL CHECK (length(btrim(remote_unit_id)) > 0),
  title                 VARCHAR(255) NOT NULL,
  summary               TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  duration_seconds      INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  is_published          BOOLEAN NOT NULL DEFAULT FALSE,
  is_public_preview     BOOLEAN NOT NULL DEFAULT FALSE,
  video_part_count      INTEGER NOT NULL DEFAULT 0 CHECK (video_part_count >= 0),
  has_theory            BOOLEAN NOT NULL DEFAULT FALSE,
  vocab_count           INTEGER NOT NULL DEFAULT 0 CHECK (vocab_count >= 0),
  formula_count         INTEGER NOT NULL DEFAULT 0 CHECK (formula_count >= 0),
  file_count            INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  quiz_count            INTEGER NOT NULL DEFAULT 0 CHECK (quiz_count >= 0),
  assignment_count      INTEGER NOT NULL DEFAULT 0 CHECK (assignment_count >= 0),
  last_revision         BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at            TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_unit_projections_profile_unit UNIQUE (profile_projection_id, unit_type, remote_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_course_unit_projections_order
  ON course_unit_projections (profile_projection_id, section_sort_order, sort_order, id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_course_unit_projections_updated_at ON course_unit_projections;
CREATE TRIGGER trg_course_unit_projections_updated_at
  BEFORE UPDATE ON course_unit_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_unit_projections_prevent_stale ON course_unit_projections;
CREATE TRIGGER trg_course_unit_projections_prevent_stale
  BEFORE UPDATE ON course_unit_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

CREATE TABLE IF NOT EXISTS course_file_projections (
  id                     BIGSERIAL PRIMARY KEY,
  profile_projection_id  BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  unit_projection_id     BIGINT NOT NULL REFERENCES course_unit_projections(id) ON DELETE RESTRICT,
  remote_file_id         VARCHAR(128) NOT NULL CHECK (length(btrim(remote_file_id)) > 0),
  title                  VARCHAR(255) NOT NULL,
  original_filename      VARCHAR(500),
  mime_type              VARCHAR(150),
  file_kind              VARCHAR(40),
  size_bytes             BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  is_slide               BOOLEAN NOT NULL DEFAULT FALSE,
  allow_download_override BOOLEAN,
  sort_order             INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_published           BOOLEAN NOT NULL DEFAULT TRUE,
  last_revision          BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at      TIMESTAMPTZ NOT NULL,
  deleted_at             TIMESTAMPTZ,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_file_projections_unit_file UNIQUE (unit_projection_id, remote_file_id)
);

DROP TRIGGER IF EXISTS trg_course_file_projections_updated_at ON course_file_projections;
CREATE TRIGGER trg_course_file_projections_updated_at
  BEFORE UPDATE ON course_file_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_file_projections_prevent_stale ON course_file_projections;
CREATE TRIGGER trg_course_file_projections_prevent_stale
  BEFORE UPDATE ON course_file_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

CREATE TABLE IF NOT EXISTS course_progress_projections (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  profile_projection_id BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  local_course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  unit_type             VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id        VARCHAR(128) NOT NULL CHECK (length(btrim(remote_unit_id)) > 0),
  watched_seconds       INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  completion_pct        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  is_video_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  is_quiz_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_unit_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_unlocked           BOOLEAN NOT NULL DEFAULT FALSE,
  course_completion_pct NUMERIC(5,2) CHECK (course_completion_pct IS NULL OR (course_completion_pct >= 0 AND course_completion_pct <= 100)),
  last_unit_id          VARCHAR(128),
  last_revision         BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at     TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_progress_projections_user_unit UNIQUE (user_id, profile_projection_id, unit_type, remote_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_projections_user_course
  ON course_progress_projections (user_id, local_course_id, source_updated_at DESC);

DROP TRIGGER IF EXISTS trg_course_progress_projections_updated_at ON course_progress_projections;
CREATE TRIGGER trg_course_progress_projections_updated_at
  BEFORE UPDATE ON course_progress_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_progress_projections_prevent_stale ON course_progress_projections;
CREATE TRIGGER trg_course_progress_projections_prevent_stale
  BEFORE UPDATE ON course_progress_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

CREATE TABLE IF NOT EXISTS course_assessment_projections (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  profile_projection_id    BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  unit_type                VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id           VARCHAR(128) NOT NULL,
  item_type                VARCHAR(20) NOT NULL CHECK (item_type IN ('quiz', 'assignment')),
  remote_item_id           VARCHAR(128) NOT NULL,
  remote_attempt_or_sub_id VARCHAR(128),
  status                   VARCHAR(32) NOT NULL,
  attempt_count            INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts             INTEGER CHECK (max_attempts IS NULL OR max_attempts >= 1),
  score                    NUMERIC(7,2) CHECK (score IS NULL OR score >= 0),
  max_score                NUMERIC(7,2) CHECK (max_score IS NULL OR max_score > 0),
  can_view_solution        BOOLEAN NOT NULL DEFAULT FALSE,
  graded_at                TIMESTAMPTZ,
  last_revision            BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at        TIMESTAMPTZ NOT NULL,
  deleted_at               TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_assessment_projections_user_item UNIQUE (user_id, profile_projection_id, item_type, remote_item_id)
);

DROP TRIGGER IF EXISTS trg_course_assessment_projections_updated_at ON course_assessment_projections;
CREATE TRIGGER trg_course_assessment_projections_updated_at
  BEFORE UPDATE ON course_assessment_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_assessment_projections_prevent_stale ON course_assessment_projections;
CREATE TRIGGER trg_course_assessment_projections_prevent_stale
  BEFORE UPDATE ON course_assessment_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

CREATE TABLE IF NOT EXISTS course_note_projections (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  profile_projection_id BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  unit_type             VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id        VARCHAR(128) NOT NULL,
  remote_note_id        VARCHAR(128) NOT NULL,
  timestamp_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (timestamp_seconds >= 0),
  content               TEXT NOT NULL,
  last_revision         BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_note_projections_remote_id UNIQUE (profile_projection_id, remote_note_id)
);

CREATE INDEX IF NOT EXISTS idx_course_note_projections_user_unit
  ON course_note_projections (user_id, profile_projection_id, unit_type, remote_unit_id, timestamp_seconds ASC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_course_note_projections_updated_at ON course_note_projections;
CREATE TRIGGER trg_course_note_projections_updated_at
  BEFORE UPDATE ON course_note_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_note_projections_prevent_stale ON course_note_projections;
CREATE TRIGGER trg_course_note_projections_prevent_stale
  BEFORE UPDATE ON course_note_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

-- 6. Server-minted HttpOnly browser device identity on Moly (prevents header spoofing & double-counting)
CREATE TABLE IF NOT EXISTS moly_trusted_browser_devices (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  device_token_hash        CHAR(64) NOT NULL CHECK (device_token_hash ~ '^[0-9a-f]{64}$'),
  device_name              VARCHAR(160) NOT NULL DEFAULT 'Browser Device',
  device_type              VARCHAR(20) NOT NULL DEFAULT 'desktop'
                           CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  user_agent               TEXT,
  first_ip                 VARCHAR(64),
  last_ip                  VARCHAR(64),
  remembered_device_id     BIGINT,
  remote_course_binding_id BIGINT,
  first_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at               TIMESTAMPTZ,
  revoked_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoked_reason           VARCHAR(255),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('user_remembered_devices') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_moly_trusted_browser_devices_remembered'
    )
  THEN
    ALTER TABLE moly_trusted_browser_devices
      ADD CONSTRAINT fk_moly_trusted_browser_devices_remembered
      FOREIGN KEY (remembered_device_id) REFERENCES user_remembered_devices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_moly_trusted_browser_devices_active
  ON moly_trusted_browser_devices (user_id, device_token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_moly_trusted_browser_devices_user_last_seen
  ON moly_trusted_browser_devices (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_moly_trusted_browser_devices_updated_at ON moly_trusted_browser_devices;
CREATE TRIGGER trg_moly_trusted_browser_devices_updated_at
  BEFORE UPDATE ON moly_trusted_browser_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
