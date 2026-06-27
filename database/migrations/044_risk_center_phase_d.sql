-- ============================================================
-- Risk Center Phase D+E: Question Reports + Realtime Support
-- ============================================================

-- Phase D: Question Reports table
CREATE TABLE IF NOT EXISTS question_reports (
  id            SERIAL PRIMARY KEY,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  reporter_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  report_type   VARCHAR(60) NOT NULL DEFAULT 'wrong_answer',
  -- Types: wrong_answer, formula_error, translation_error, missing_image,
  --        missing_data, duplicate_question, answer_mismatch, other
  description   TEXT,
  status        VARCHAR(30) NOT NULL DEFAULT 'open',
  -- Status: open, reviewing, fixed, ignored, escalated
  severity      VARCHAR(20) NOT NULL DEFAULT 'medium',
  admin_note    TEXT,
  resolved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_reports_question
  ON question_reports(question_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_exam
  ON question_reports(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status
  ON question_reports(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_reporter
  ON question_reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_open
  ON question_reports(created_at DESC) WHERE status = 'open';

-- Phase D: Add is_hidden to questions and exams
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Phase D: regrade_logs for tracking regrade operations
CREATE TABLE IF NOT EXISTS regrade_logs (
  id              SERIAL PRIMARY KEY,
  question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  old_answer      VARCHAR(30),
  new_answer      VARCHAR(30),
  affected_count  INTEGER NOT NULL DEFAULT 0,
  regraded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  report_id       INTEGER REFERENCES question_reports(id) ON DELETE SET NULL,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regrade_logs_question
  ON regrade_logs(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regrade_logs_exam
  ON regrade_logs(exam_id, created_at DESC);
