-- Private lesson Q&A between enrolled learners and assigned course teachers.

CREATE TABLE IF NOT EXISTS lesson_question_threads (
  id BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lesson_question_threads_status CHECK (status IN ('open', 'answered', 'resolved'))
);

CREATE TABLE IF NOT EXISTS lesson_question_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES lesson_question_threads(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_kind VARCHAR(20) NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lesson_question_messages_author CHECK (author_kind IN ('student', 'teacher')),
  CONSTRAINT chk_lesson_question_messages_body CHECK (body IS NULL OR LENGTH(body) <= 20000)
);

CREATE TABLE IF NOT EXISTS lesson_question_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES lesson_question_messages(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_kind VARCHAR(20) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  storage_public_id VARCHAR(1000) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lesson_question_attachments_kind CHECK (file_kind IN ('image', 'document')),
  CONSTRAINT chk_lesson_question_attachments_size CHECK (size_bytes >= 0),
  CONSTRAINT chk_lesson_question_attachments_order CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lesson_question_threads_lesson
  ON lesson_question_threads(lesson_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_question_threads_owner
  ON lesson_question_threads(created_by, lesson_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_question_messages_thread
  ON lesson_question_messages(thread_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_lesson_question_attachments_message
  ON lesson_question_attachments(message_id, sort_order, id);

DROP TRIGGER IF EXISTS update_lesson_question_threads_updated_at ON lesson_question_threads;
CREATE TRIGGER update_lesson_question_threads_updated_at
  BEFORE UPDATE ON lesson_question_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_question_messages_updated_at ON lesson_question_messages;
CREATE TRIGGER update_lesson_question_messages_updated_at
  BEFORE UPDATE ON lesson_question_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
