-- ====================================================
-- Migration: 008_create_exam_schedule_logs
-- Ensure schedule columns + exam schedule logs table for exam admin
-- ====================================================

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS exam_schedule_logs (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(120),
  old_start_time TIMESTAMP,
  old_end_time TIMESTAMP,
  new_start_time TIMESTAMP,
  new_end_time TIMESTAMP,
  reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exam_schedule_logs_exam
  ON exam_schedule_logs(exam_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_schedule_logs_changed_by
  ON exam_schedule_logs(changed_by, changed_at DESC);
