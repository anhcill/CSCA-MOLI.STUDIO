-- CSCA-Course <-> Moly Studio Full Sync v2 (Days 5-7)
-- Strictly additive & idempotent migration extending file projections with
-- placements / view override and adding bookmark & Q&A thread projections.

BEGIN;

-- Day 5: extend course_file_projections
ALTER TABLE course_file_projections
  ADD COLUMN IF NOT EXISTS placements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_view_override BOOLEAN NULL;

-- Day 7: personal video bookmarks projection
CREATE TABLE IF NOT EXISTS course_bookmark_projections (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  profile_projection_id BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  unit_type             VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id        VARCHAR(128) NOT NULL,
  remote_bookmark_id    VARCHAR(128) NOT NULL,
  video_asset_id        VARCHAR(128),
  timestamp_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (timestamp_seconds >= 0),
  label                 VARCHAR(255) NOT NULL DEFAULT '',
  last_revision         BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_projection_id, remote_bookmark_id)
);

CREATE INDEX IF NOT EXISTS idx_course_bookmark_projections_user_unit
  ON course_bookmark_projections (user_id, profile_projection_id, unit_type, remote_unit_id, timestamp_seconds ASC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_course_bookmark_projections_updated_at ON course_bookmark_projections;
CREATE TRIGGER trg_course_bookmark_projections_updated_at
  BEFORE UPDATE ON course_bookmark_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_bookmark_projections_prevent_stale ON course_bookmark_projections;
CREATE TRIGGER trg_course_bookmark_projections_prevent_stale
  BEFORE UPDATE ON course_bookmark_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

-- Day 7: unit Q&A thread projections
CREATE TABLE IF NOT EXISTS course_qa_thread_projections (
  id                       BIGSERIAL PRIMARY KEY,
  profile_projection_id    BIGINT NOT NULL REFERENCES course_profile_projections(id) ON DELETE RESTRICT,
  unit_type                VARCHAR(32) NOT NULL CHECK (unit_type IN ('lesson', 'class_session')),
  remote_unit_id           VARCHAR(128) NOT NULL,
  remote_thread_id         VARCHAR(128) NOT NULL,
  author_external_user_id  VARCHAR(128),
  author_user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name              VARCHAR(255),
  author_role              VARCHAR(32),
  title                    VARCHAR(255) NOT NULL,
  status                   VARCHAR(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved')),
  is_pinned                BOOLEAN NOT NULL DEFAULT FALSE,
  message_count            INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  messages_json            JSONB NOT NULL DEFAULT '[]'::jsonb,
  unread                   BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at          TIMESTAMPTZ,
  last_revision            BIGINT NOT NULL DEFAULT 1 CHECK (last_revision >= 1),
  source_updated_at        TIMESTAMPTZ NOT NULL,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_projection_id, remote_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_course_qa_thread_projections_unit
  ON course_qa_thread_projections (profile_projection_id, unit_type, remote_unit_id, is_pinned DESC, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_course_qa_thread_projections_updated_at ON course_qa_thread_projections;
CREATE TRIGGER trg_course_qa_thread_projections_updated_at
  BEFORE UPDATE ON course_qa_thread_projections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_course_qa_thread_projections_prevent_stale ON course_qa_thread_projections;
CREATE TRIGGER trg_course_qa_thread_projections_prevent_stale
  BEFORE UPDATE ON course_qa_thread_projections
  FOR EACH ROW EXECUTE FUNCTION prevent_stale_revision_regression();

COMMIT;
