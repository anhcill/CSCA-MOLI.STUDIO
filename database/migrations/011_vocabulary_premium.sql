-- Migration: Add vocabulary premium fields
-- Vocabulary premium content only accessible to VIP members

ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS vip_tier VARCHAR(20) DEFAULT 'basic'; -- 'basic' | 'vip' | 'premium'

CREATE INDEX IF NOT EXISTS idx_vocabulary_is_premium ON vocabulary_items(is_premium) WHERE is_premium = TRUE;
CREATE INDEX IF NOT EXISTS idx_vocabulary_vip_tier ON vocabulary_items(vip_tier);
