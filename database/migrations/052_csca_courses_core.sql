-- ============================================================
-- CSCA course catalog and curriculum core
-- Additive only: this migration never drops or rewrites existing data.
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  external_key VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  short_description TEXT,
  description TEXT,
  subject_code VARCHAR(30) NOT NULL,
  level VARCHAR(30) NOT NULL DEFAULT 'basic',
  thumbnail_url VARCHAR(1000),
  preview_video_asset_id BIGINT,
  instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  access_type VARCHAR(20) NOT NULL DEFAULT 'free',
  required_tier VARCHAR(20) NOT NULL DEFAULT 'basic',
  price_vnd INTEGER NOT NULL DEFAULT 0,
  compare_at_price_vnd INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  is_hot BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  total_sections INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  content_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_courses_subject_code CHECK (
    subject_code IN ('MATH', 'PHYSICS', 'CHEMISTRY', 'CHINESE_SCI', 'CHINESE_SOC')
  ),
  CONSTRAINT chk_courses_level CHECK (level IN ('basic', 'intermediate', 'advanced')),
  CONSTRAINT chk_courses_access_type CHECK (access_type IN ('free', 'vip', 'premium', 'contact', 'private')),
  CONSTRAINT chk_courses_required_tier CHECK (required_tier IN ('basic', 'vip', 'premium')),
  CONSTRAINT chk_courses_status CHECK (status IN ('draft', 'review', 'published', 'archived')),
  CONSTRAINT chk_courses_prices CHECK (
    price_vnd >= 0 AND (compare_at_price_vnd IS NULL OR compare_at_price_vnd >= 0)
  ),
  CONSTRAINT chk_courses_aggregates CHECK (
    total_sections >= 0 AND total_lessons >= 0 AND total_duration_seconds >= 0
    AND rating_avg >= 0 AND rating_avg <= 5
    AND rating_count >= 0 AND enrolled_count >= 0
  )
);

CREATE TABLE IF NOT EXISTS course_sections (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_course_sections_sort_order CHECK (sort_order >= 0),
  CONSTRAINT uq_course_sections_id_course UNIQUE (id, course_id)
);

CREATE TABLE IF NOT EXISTS course_lessons (
  id BIGSERIAL PRIMARY KEY,
  external_key VARCHAR(120) NOT NULL UNIQUE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id BIGINT NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  lesson_type VARCHAR(20) NOT NULL DEFAULT 'video',
  content_html TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  video_asset_id BIGINT,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  estimated_duration_seconds INTEGER NOT NULL DEFAULT 0,
  passing_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_course_lessons_section_course
    FOREIGN KEY (section_id, course_id)
    REFERENCES course_sections(id, course_id) ON DELETE CASCADE,
  CONSTRAINT uq_course_lessons_id_course UNIQUE (id, course_id),
  CONSTRAINT uq_course_lessons_course_slug UNIQUE (course_id, slug),
  CONSTRAINT chk_course_lessons_type CHECK (lesson_type IN ('video', 'article', 'document', 'quiz')),
  CONSTRAINT chk_course_lessons_sort_order CHECK (sort_order >= 0),
  CONSTRAINT chk_course_lessons_duration CHECK (estimated_duration_seconds >= 0),
  CONSTRAINT chk_course_lessons_passing_score CHECK (
    passing_score IS NULL OR (passing_score >= 0 AND passing_score <= 100)
  )
);

CREATE TABLE IF NOT EXISTS course_outcomes (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_course_outcomes_sort_order CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS course_requirements (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_course_requirements_sort_order CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS course_instructors (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id),
  CONSTRAINT chk_course_instructors_sort_order CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS course_related_items (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  related_course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, related_course_id),
  CONSTRAINT chk_course_related_not_self CHECK (course_id <> related_course_id),
  CONSTRAINT chk_course_related_sort_order CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS lesson_resources (
  id BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  resource_type VARCHAR(30) NOT NULL DEFAULT 'link',
  url VARCHAR(1500),
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  is_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lesson_resources_type CHECK (resource_type IN ('link', 'file', 'material')),
  CONSTRAINT chk_lesson_resources_target CHECK (url IS NOT NULL OR material_id IS NOT NULL),
  CONSTRAINT chk_lesson_resources_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_courses_catalog
  ON courses(status, subject_code, access_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_featured
  ON courses(is_featured, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_course_sections_order
  ON course_sections(course_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_order
  ON course_lessons(course_id, section_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_preview
  ON course_lessons(course_id, is_free_preview) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_course_outcomes_order
  ON course_outcomes(course_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_course_requirements_order
  ON course_requirements(course_id, sort_order, id);

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_course_sections_updated_at ON course_sections;
CREATE TRIGGER update_course_sections_updated_at
  BEFORE UPDATE ON course_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_course_lessons_updated_at ON course_lessons;
CREATE TRIGGER update_course_lessons_updated_at
  BEFORE UPDATE ON course_lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN courses.preview_video_asset_id IS
  'Reserved for FK to video_assets.id; FK is added by the video migration after video_assets exists.';
COMMENT ON COLUMN course_lessons.video_asset_id IS
  'Reserved for FK to video_assets.id; FK is added by the video migration after video_assets exists.';
