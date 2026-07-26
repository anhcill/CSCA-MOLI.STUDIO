-- ============================================================
-- CSCA course access by checkout package
-- Additive and idempotent. Existing manual mappings are preserved.
-- ============================================================

CREATE TABLE IF NOT EXISTS course_package_access (
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES vip_packages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_course_package_access_package
  ON course_package_access(package_id, course_id);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_courses_access_type;
ALTER TABLE courses
  ADD CONSTRAINT chk_courses_access_type
  CHECK (access_type IN ('free', 'package', 'vip', 'premium', 'contact', 'private'));

-- Add mappings for legacy VIP/Premium courses only when an administrator has
-- not configured any package for that course yet. Subject-specific packages
-- are matched through allowed_subjects; Premium/all-subject packages match '*'.
INSERT INTO course_package_access (course_id, package_id)
SELECT c.id, p.id
FROM courses c
JOIN vip_packages p
  ON p.is_active = TRUE
 AND (
   '*' = ANY(COALESCE(p.allowed_subjects, ARRAY[]::text[]))
   OR c.subject_code = ANY(COALESCE(p.allowed_subjects, ARRAY[]::text[]))
 )
WHERE c.access_type IN ('vip', 'premium')
  AND (
    c.access_type = 'vip'
    OR COALESCE(p.tier, 'vip') IN ('premium', 'pre')
  )
  AND NOT EXISTS (
    SELECT 1 FROM course_package_access configured
    WHERE configured.course_id = c.id
  )
ON CONFLICT (course_id, package_id) DO NOTHING;

-- Adopt exact package-based authorization for legacy paid courses once they
-- have at least one inferred or pre-existing mapping. Unmappable rows retain
-- their legacy access_type and continue to use the compatibility path.
UPDATE courses c
SET access_type = 'package',
    required_tier = 'basic',
    content_updated_at = NOW()
WHERE c.access_type IN ('vip', 'premium')
  AND EXISTS (
    SELECT 1 FROM course_package_access cpa WHERE cpa.course_id = c.id
  );

ALTER TABLE course_enrollments DROP CONSTRAINT IF EXISTS chk_course_enrollments_source;
ALTER TABLE course_enrollments
  ADD CONSTRAINT chk_course_enrollments_source
  CHECK (source IN ('free', 'package', 'vip', 'premium', 'admin', 'coupon'));

COMMENT ON TABLE course_package_access IS
  'Explicit many-to-many mapping between courses and checkout packages.';
