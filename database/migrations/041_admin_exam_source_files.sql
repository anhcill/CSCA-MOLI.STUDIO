CREATE TABLE IF NOT EXISTS admin_exam_source_files (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_data BYTEA,
  is_exam_paper BOOLEAN NOT NULL DEFAULT FALSE,
  text_content TEXT NOT NULL DEFAULT '',
  pages INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_exam_source_files_exam_created
ON admin_exam_source_files(exam_id, created_at DESC);
