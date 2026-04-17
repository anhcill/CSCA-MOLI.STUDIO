-- Migration: Add slug field to subjects table
-- This enables URL-friendly subject slugs like /mon/toan, /mon/vat-ly

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- Populate slug values for existing subjects
UPDATE subjects SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;

-- Make slug NOT NULL after population
ALTER TABLE subjects ALTER COLUMN slug SET NOT NULL;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_subjects_slug ON subjects(slug);
