-- ============================================================
-- Risk Center Phase B+C: Exam Cheating + Payment Risk fields
-- ============================================================

-- Phase B: Add lock/invalidate columns to exam_attempts
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_invalidated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invalidate_reason TEXT;

-- Phase B: Add ban/suspend columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspend_reason TEXT;

-- Phase B: exam_ban_access table  per-exam ban
CREATE TABLE IF NOT EXISTS exam_access_bans (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  banned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at   TIMESTAMPTZ,
  lifted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, exam_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_access_bans_user
  ON exam_access_bans(user_id) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_access_bans_exam
  ON exam_access_bans(exam_id) WHERE lifted_at IS NULL;

-- Phase B: Add violation_types JSONB to exam_risk_cases for breakdown
ALTER TABLE exam_risk_cases
  ADD COLUMN IF NOT EXISTS violation_types JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMPTZ;

-- Unique partial index on attempt_id for upsert scan
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_risk_cases_attempt_unique
  ON exam_risk_cases(attempt_id) WHERE attempt_id IS NOT NULL;

-- Phase C: Add risk flags to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS risk_flag VARCHAR(30),
  ADD COLUMN IF NOT EXISTS risk_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Phase C: user_warnings table
CREATE TABLE IF NOT EXISTS user_warnings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type        VARCHAR(60) NOT NULL DEFAULT 'exam_cheating',
  message     TEXT NOT NULL,
  case_id     INTEGER,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user
  ON user_warnings(user_id, created_at DESC);
