-- Migration: Add is_premium field to exams and materials tables
-- Premium/PAID content only accessible to VIP members

-- 1. exams.is_premium
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- 2. materials.is_premium
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- 3. Create indexes for fast VIP filter queries
CREATE INDEX IF NOT EXISTS idx_exams_is_premium ON exams(is_premium) WHERE is_premium = TRUE;
CREATE INDEX IF NOT EXISTS idx_materials_is_premium ON materials(is_premium) WHERE is_premium = TRUE;
