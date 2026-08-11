-- Lesson files, homework assignments, learner submissions and teacher grading.

INSERT INTO permissions (code, name, description)
VALUES ('courses.manage_assigned', 'Manage Assigned Courses', 'Manage only courses explicitly assigned to the teacher')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO roles (code, name, description, is_system)
VALUES ('course_teacher', 'Course Teacher', 'Teach and grade explicitly assigned courses', TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'course_teacher' AND p.code IN ('admin.dashboard.view', 'courses.manage_assigned')
ON CONFLICT (role_id, permission_id) DO NOTHING;

ALTER TABLE lesson_resources
  ADD COLUMN IF NOT EXISTS original_name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150),
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS storage_public_id VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS file_kind VARCHAR(20);

CREATE TABLE IF NOT EXISTS lesson_assignments (
  id BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT NOT NULL UNIQUE REFERENCES course_lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  instructions TEXT,
  due_at TIMESTAMPTZ,
  max_score NUMERIC(7,2) NOT NULL DEFAULT 10,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lesson_assignments_score CHECK (max_score > 0 AND max_score <= 1000)
);

CREATE TABLE IF NOT EXISTS assignment_attachments (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES lesson_assignments(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_kind VARCHAR(20) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  storage_public_id VARCHAR(1000) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assignment_attachments_kind CHECK (file_kind IN ('image', 'document')),
  CONSTRAINT chk_assignment_attachments_size CHECK (size_bytes >= 0),
  CONSTRAINT chk_assignment_attachments_order CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS lesson_submissions (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES lesson_assignments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score NUMERIC(7,2),
  teacher_feedback TEXT,
  graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lesson_submissions_assignment_user UNIQUE (assignment_id, user_id),
  CONSTRAINT chk_lesson_submissions_status CHECK (status IN ('submitted', 'graded')),
  CONSTRAINT chk_lesson_submissions_score CHECK (score IS NULL OR score >= 0)
);

CREATE TABLE IF NOT EXISTS submission_attachments (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES lesson_submissions(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_kind VARCHAR(20) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  storage_public_id VARCHAR(1000) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_submission_attachments_kind CHECK (file_kind IN ('image', 'document')),
  CONSTRAINT chk_submission_attachments_size CHECK (size_bytes >= 0),
  CONSTRAINT chk_submission_attachments_order CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment
  ON assignment_attachments(assignment_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_lesson_submissions_assignment
  ON lesson_submissions(assignment_id, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_submissions_user
  ON lesson_submissions(user_id, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission
  ON submission_attachments(submission_id, sort_order, id);

DROP TRIGGER IF EXISTS update_lesson_assignments_updated_at ON lesson_assignments;
CREATE TRIGGER update_lesson_assignments_updated_at
  BEFORE UPDATE ON lesson_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_submissions_updated_at ON lesson_submissions;
CREATE TRIGGER update_lesson_submissions_updated_at
  BEFORE UPDATE ON lesson_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
