-- Migration: Vocabulary flashcards and spaced repetition progress

CREATE TABLE IF NOT EXISTS vocabulary_user_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
  easiness NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_quality INTEGER,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  due_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vocabulary_id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_reviews_user_due
  ON vocabulary_user_reviews(user_id, due_at);

CREATE INDEX IF NOT EXISTS idx_vocab_reviews_vocab
  ON vocabulary_user_reviews(vocabulary_id);

CREATE INDEX IF NOT EXISTS idx_vocab_reviews_weak
  ON vocabulary_user_reviews(user_id, last_quality, lapses);

