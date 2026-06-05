-- Add subject-level VIP entitlements for the four 3-month packages.

ALTER TABLE vip_packages
  ADD COLUMN IF NOT EXISTS subject_prices JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subject_original_prices JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_subjects TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_subject_choice BOOLEAN DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vip_package_id INTEGER REFERENCES vip_packages(id),
  ADD COLUMN IF NOT EXISTS vip_allowed_subjects TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS user_vip_entitlements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES vip_packages(id),
  transaction_id INTEGER REFERENCES transactions(id),
  tier VARCHAR(20) NOT NULL DEFAULT 'vip',
  allowed_subjects TEXT[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  source VARCHAR(30) NOT NULL DEFAULT 'payment',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_vip_entitlements_active
  ON user_vip_entitlements(user_id, expires_at)
  WHERE is_active = true;

UPDATE vip_packages
SET allowed_subjects = CASE
      WHEN COALESCE(tier, 'vip') IN ('premium', 'pre') OR LOWER(name) LIKE '%premium%' THEN ARRAY['*']::text[]
      WHEN LOWER(name) LIKE '%mini%' OR sort_order = 4 THEN ARRAY['MATH','PHYSICS','CHEMISTRY']::text[]
      WHEN sort_order = 2 THEN ARRAY['MATH','PHYSICS','CHEMISTRY','CHINESE_SCI']::text[]
      WHEN sort_order = 3 THEN ARRAY['MATH','CHINESE_SOC']::text[]
      ELSE allowed_subjects
    END,
    requires_subject_choice = CASE
      WHEN LOWER(name) LIKE '%mini%' OR sort_order = 4 THEN true
      ELSE false
    END,
    subject_prices = CASE
      WHEN LOWER(name) LIKE '%mini%' OR sort_order = 4
        THEN '{"MATH":188000,"PHYSICS":122000,"CHEMISTRY":122000}'::jsonb
      ELSE COALESCE(subject_prices, '{}'::jsonb)
    END,
    subject_original_prices = CASE
      WHEN LOWER(name) LIKE '%mini%' OR sort_order = 4
        THEN '{"MATH":200000,"PHYSICS":150000,"CHEMISTRY":150000}'::jsonb
      ELSE COALESCE(subject_original_prices, '{}'::jsonb)
    END,
    updated_at = NOW()
WHERE name IN ('Premium', 'Gói Tự Nhiên', 'Gói Xã Hội', 'Gói Mini')
   OR sort_order IN (1, 2, 3, 4);

WITH latest_completed AS (
  SELECT DISTINCT ON (t.user_id)
    t.user_id,
    t.id AS transaction_id,
    t.package_id,
    COALESCE(p.tier, 'vip') AS tier,
    CASE
      WHEN COALESCE(p.tier, 'vip') IN ('premium', 'pre') THEN ARRAY['*']::text[]
      WHEN COALESCE(array_length(p.allowed_subjects, 1), 0) > 0 THEN p.allowed_subjects
      ELSE ARRAY['*']::text[]
    END AS allowed_subjects,
    COALESCE(t.vip_expires_at, u.vip_expires_at) AS expires_at
  FROM transactions t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN vip_packages p ON p.id = t.package_id
  WHERE t.status = 'completed'
    AND (u.is_vip = true OR u.subscription_tier IN ('vip', 'premium'))
    AND (u.vip_expires_at IS NULL OR u.vip_expires_at > NOW())
  ORDER BY t.user_id, t.paid_at DESC NULLS LAST, t.created_at DESC NULLS LAST, t.id DESC
)
INSERT INTO user_vip_entitlements (
  user_id, package_id, transaction_id, tier, allowed_subjects, starts_at, expires_at, source
)
SELECT
  user_id,
  package_id,
  transaction_id,
  tier,
  allowed_subjects,
  NOW(),
  expires_at,
  'migration'
FROM latest_completed lc
WHERE NOT EXISTS (
  SELECT 1
  FROM user_vip_entitlements e
  WHERE e.transaction_id = lc.transaction_id
);

UPDATE users u
SET vip_allowed_subjects = ARRAY['*']::text[]
WHERE (u.is_vip = true OR u.subscription_tier IN ('vip', 'premium'))
  AND (u.vip_expires_at IS NULL OR u.vip_expires_at > NOW())
  AND NOT EXISTS (
    SELECT 1
    FROM user_vip_entitlements e
    WHERE e.user_id = u.id
      AND e.is_active = true
      AND (e.expires_at IS NULL OR e.expires_at > NOW())
  )
  AND COALESCE(array_length(u.vip_allowed_subjects, 1), 0) = 0;

WITH active AS (
  SELECT
    e.user_id,
    BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre') OR '*' = ANY(e.allowed_subjects)) AS has_all,
    BOOL_OR(COALESCE(e.tier, 'vip') IN ('premium', 'pre')) AS has_premium,
    MAX(e.expires_at) AS max_expires_at,
    MAX(e.package_id) AS latest_package_id,
    ARRAY_AGG(DISTINCT subject) FILTER (WHERE subject IS NOT NULL AND subject <> '*') AS subjects
  FROM user_vip_entitlements e
  LEFT JOIN LATERAL UNNEST(e.allowed_subjects) AS subject ON true
  WHERE e.is_active = true
    AND (e.expires_at IS NULL OR e.expires_at > NOW())
  GROUP BY e.user_id
)
UPDATE users u
SET is_vip = true,
    subscription_tier = CASE WHEN active.has_premium THEN 'premium' ELSE 'vip' END,
    vip_expires_at = active.max_expires_at,
    vip_package_id = active.latest_package_id,
    vip_allowed_subjects = CASE
      WHEN active.has_all THEN ARRAY['*']::text[]
      ELSE COALESCE(active.subjects, ARRAY[]::text[])
    END,
    updated_at = NOW()
FROM active
WHERE u.id = active.user_id;
