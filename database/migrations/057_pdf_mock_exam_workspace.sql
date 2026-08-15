ALTER TABLE admin_exam_source_files
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS is_exam_paper BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_admin_exam_source_files_exam_paper
ON admin_exam_source_files(exam_id, is_exam_paper, created_at DESC)
WHERE is_exam_paper = TRUE;
