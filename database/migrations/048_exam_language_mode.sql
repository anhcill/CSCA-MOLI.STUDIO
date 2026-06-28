ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS language_mode TEXT NOT NULL DEFAULT 'zh';

UPDATE exams
SET language_mode = 'zh'
WHERE language_mode IS NULL OR language_mode = '';
