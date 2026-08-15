ALTER TABLE exam_registrations
  ALTER COLUMN status SET DEFAULT 'approved';

UPDATE exam_registrations er
SET status = 'approved',
    approved_by = NULL,
    approved_at = COALESCE(approved_at, NOW()),
    updated_at = NOW()
FROM exams e
WHERE e.id = er.exam_id
  AND er.status = 'registered'
  AND e.status = 'published'
  AND e.start_time > CURRENT_TIMESTAMP;
