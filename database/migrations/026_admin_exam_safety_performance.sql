-- Admin exam safety: never hard-delete exams from the app.
-- These columns support soft delete, delete requests, restore/audit, and payroll reporting.

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delete_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(30) DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_exams_deleted_at ON exams(deleted_at);
CREATE INDEX IF NOT EXISTS idx_exams_deletion_status ON exams(deletion_status);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);

