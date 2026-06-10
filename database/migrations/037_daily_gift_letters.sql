-- Daily Gift Letter: one generated letter per Vietnam calendar day,
-- plus per-user open tracking so the gift stays hidden after claim.

CREATE TABLE IF NOT EXISTS daily_gift_letters (
  id BIGSERIAL PRIMARY KEY,
  gift_date DATE NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  greeting TEXT NOT NULL,
  encouragement TEXT NOT NULL,
  study_reminder TEXT NOT NULL,
  blessing TEXT NOT NULL,
  mood VARCHAR(60),
  source_model VARCHAR(120),
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_gift_letters_date
  ON daily_gift_letters(gift_date DESC);

CREATE TABLE IF NOT EXISTS daily_gift_letter_opens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_date DATE NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, gift_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_gift_letter_opens_user_date
  ON daily_gift_letter_opens(user_id, gift_date DESC);
