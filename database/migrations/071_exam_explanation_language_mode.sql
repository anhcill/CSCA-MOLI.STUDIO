-- 071_exam_explanation_language_mode.sql
-- Adds explanation_language_mode to exams so admins can configure the language(s)
-- allowed for post-exam explanations independently from the exam paper language_mode.

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS explanation_language_mode TEXT NOT NULL DEFAULT 'vi';

-- Update language_mode check constraint to also permit 3-language modes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exams_language_mode_check'
      AND conrelid = 'exams'::regclass
  ) THEN
    ALTER TABLE exams DROP CONSTRAINT exams_language_mode_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint drop skipped: %', SQLERRM;
END $$;

ALTER TABLE exams
  ADD CONSTRAINT exams_language_mode_check
  CHECK (language_mode IN (
    'vi', 'zh', 'en',
    'vi_zh', 'vi_en', 'zh_vi', 'zh_en', 'en_vi', 'en_zh',
    'vi_en_zh', 'vi_zh_en', 'zh_vi_en', 'zh_en_vi', 'en_vi_zh', 'en_zh_vi'
  ));

-- Add check constraint for explanation_language_mode
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exams_explanation_language_mode_check'
      AND conrelid = 'exams'::regclass
  ) THEN
    ALTER TABLE exams DROP CONSTRAINT exams_explanation_language_mode_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint drop skipped: %', SQLERRM;
END $$;

ALTER TABLE exams
  ADD CONSTRAINT exams_explanation_language_mode_check
  CHECK (explanation_language_mode IN (
    'vi', 'zh', 'en',
    'vi_zh', 'vi_en', 'zh_vi', 'zh_en', 'en_vi', 'en_zh',
    'vi_en_zh', 'vi_zh_en', 'zh_vi_en', 'zh_en_vi', 'en_vi_zh', 'en_zh_vi'
  ));

CREATE TABLE IF NOT EXISTS app_maintenance_events (
  event_key VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time backfill of existing exams' explanation_language_mode based on actual question explanations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_maintenance_events
    WHERE event_key = 'backfill_exam_explanation_language_mode_v1'
  ) THEN
    -- 1. Fix Chinese exams 91 & 96 where Chinese explanations were stored in explanation while explanation_cn was NULL
    UPDATE questions q
    SET explanation_cn = q.explanation
    WHERE q.exam_id IN (91, 96)
      AND (q.explanation_cn IS NULL OR BTRIM(q.explanation_cn) = '')
      AND q.explanation IS NOT NULL
      AND BTRIM(q.explanation) <> '';

    -- 2. Backfill explanation_language_mode from actual explanation columns per exam
    WITH exam_exp_stats AS (
      SELECT
        e.id AS exam_id,
        COUNT(q.id) FILTER (WHERE q.deleted_at IS NULL) AS total_q,
        COUNT(q.id) FILTER (
          WHERE q.deleted_at IS NULL
            AND COALESCE(BTRIM(q.explanation), '') <> ''
            AND BTRIM(q.explanation) <> COALESCE(BTRIM(q.explanation_en), '')
            AND BTRIM(q.explanation) <> COALESCE(BTRIM(q.explanation_cn), '')
        ) AS vi_cnt,
        COUNT(q.id) FILTER (
          WHERE q.deleted_at IS NULL
            AND COALESCE(BTRIM(q.explanation_cn), '') <> ''
        ) AS zh_cnt,
        COUNT(q.id) FILTER (
          WHERE q.deleted_at IS NULL
            AND COALESCE(BTRIM(q.explanation_en), '') <> ''
        ) AS en_cnt
      FROM exams e
      LEFT JOIN questions q ON q.exam_id = e.id
      GROUP BY e.id
    )
    UPDATE exams e
    SET explanation_language_mode = CASE
      WHEN s.vi_cnt >= 5 AND s.zh_cnt >= 5 AND s.en_cnt >= 5 THEN 'vi_en_zh'
      WHEN s.vi_cnt = 0 AND s.zh_cnt >= 5 AND s.en_cnt >= 5 THEN 'zh_en'
      WHEN s.vi_cnt >= 5 AND s.zh_cnt >= 5 AND s.en_cnt = 0 THEN 'vi_zh'
      WHEN s.vi_cnt >= 5 AND s.zh_cnt = 0 AND s.en_cnt >= 5 THEN 'vi_en'
      WHEN s.vi_cnt > 0 AND s.zh_cnt = 0 AND s.en_cnt = 0 THEN 'vi'
      WHEN s.zh_cnt > 0 AND s.vi_cnt < 5 AND s.en_cnt = 0 THEN 'zh'
      WHEN s.en_cnt > 0 AND s.vi_cnt = 0 AND s.zh_cnt = 0 THEN 'en'
      ELSE 'vi'
    END
    FROM exam_exp_stats s
    WHERE e.id = s.exam_id;

    -- Ensure Exam 224 (2025 年 12 月 CSCA 理科（中文）试卷) has total_questions = 45, language_mode = 'zh', explanation_language_mode = 'vi'
    UPDATE exams
    SET total_questions = 45,
        language_mode = 'zh',
        explanation_language_mode = 'vi'
    WHERE id = 224;

    INSERT INTO app_maintenance_events (event_key)
    VALUES ('backfill_exam_explanation_language_mode_v1')
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END $$;
