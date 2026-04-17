-- ====================================================
-- Migration: 006_add_forum_moderation_fields
-- Add forum moderation columns to posts
-- ====================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type VARCHAR(30) DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP NULL;

-- Backfill for old rows
UPDATE posts
SET moderation_status = 'approved'
WHERE moderation_status IS NULL;

-- Keep moderation status constrained to known states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_moderation_status_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON posts(moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_moderated_by ON posts(moderated_by);
