-- Migration: Personal learning action flows

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('question', 'material', 'vocabulary', 'exam')),
  entity_id INTEGER NOT NULL,
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_type
  ON user_bookmarks(user_id, entity_type, created_at DESC);

CREATE TABLE IF NOT EXISTS user_question_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_user_question_notes_user
  ON user_question_notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_practice_sets (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_type VARCHAR(30) NOT NULL CHECK (set_type IN ('wrong_questions', 'weak_topic')),
  title TEXT NOT NULL,
  description TEXT,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  source_topic_id INTEGER REFERENCES question_topics(id) ON DELETE SET NULL,
  question_ids INTEGER[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_practice_sets_user
  ON user_practice_sets(user_id, created_at DESC);

