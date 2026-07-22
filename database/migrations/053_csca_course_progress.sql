-- ============================================================
-- CSCA enrollment and learning progress
-- Additive only: this migration never drops or rewrites existing data.
-- ============================================================

CREATE TABLE IF NOT EXISTS course_enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_enrollments_user_course UNIQUE (user_id, course_id),
  CONSTRAINT chk_course_enrollments_source CHECK (source IN ('free', 'vip', 'premium', 'admin', 'coupon')),
  CONSTRAINT chk_course_enrollments_status CHECK (status IN ('active', 'expired', 'revoked', 'completed')),
  CONSTRAINT chk_course_enrollments_dates CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id BIGINT NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  max_position_seconds INTEGER NOT NULL DEFAULT 0,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id),
  CONSTRAINT fk_lesson_progress_lesson_course
    FOREIGN KEY (lesson_id, course_id)
    REFERENCES course_lessons(id, course_id) ON DELETE CASCADE,
  CONSTRAINT chk_lesson_progress_status CHECK (status IN ('not_started', 'in_progress', 'completed')),
  CONSTRAINT chk_lesson_progress_seconds CHECK (
    watched_seconds >= 0 AND max_position_seconds >= 0 AND last_position_seconds >= 0
  ),
  CONSTRAINT chk_lesson_progress_completion CHECK (completion_pct >= 0 AND completion_pct <= 100),
  CONSTRAINT chk_lesson_progress_attempt_count CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_active
  ON course_enrollments(user_id, updated_at DESC)
  WHERE status IN ('active', 'completed');
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_status
  ON course_enrollments(course_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course
  ON lesson_progress(user_id, course_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course_lesson
  ON lesson_progress(course_id, lesson_id, status);

DROP TRIGGER IF EXISTS update_course_enrollments_updated_at ON course_enrollments;
CREATE TRIGGER update_course_enrollments_updated_at
  BEFORE UPDATE ON course_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_progress_updated_at ON lesson_progress;
CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
