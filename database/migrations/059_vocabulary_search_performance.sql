-- Accelerate contains-search used by the native vocabulary catalog.
-- pg_trgm supports ILIKE '%term%' through GIN indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_vocab_word_cn_trgm
  ON vocabulary_items USING GIN (word_cn gin_trgm_ops)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vocab_pinyin_trgm
  ON vocabulary_items USING GIN (pinyin gin_trgm_ops)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vocab_word_vn_trgm
  ON vocabulary_items USING GIN (word_vn gin_trgm_ops)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vocab_word_en_trgm
  ON vocabulary_items USING GIN (word_en gin_trgm_ops)
  WHERE is_active = TRUE;
