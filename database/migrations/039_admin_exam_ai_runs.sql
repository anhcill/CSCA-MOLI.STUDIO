CREATE TABLE IF NOT EXISTS admin_exam_ai_runs (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  action VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, action)
);

CREATE INDEX IF NOT EXISTS idx_admin_exam_ai_runs_exam_created
ON admin_exam_ai_runs(exam_id, created_at DESC);
