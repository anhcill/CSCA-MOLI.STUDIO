ALTER TABLE admin_exam_source_files
  ADD COLUMN IF NOT EXISTS is_solution_file BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_admin_exam_source_files_exam_solution
ON admin_exam_source_files(exam_id, is_solution_file, created_at DESC)
WHERE is_solution_file = TRUE;
