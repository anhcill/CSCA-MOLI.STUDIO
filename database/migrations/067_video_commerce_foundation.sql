-- Day 1 foundation only. No changes to legacy VIP, payments, courses or assets.
-- Prices and durations may remain unset while an administrator prepares a draft.
CREATE TABLE IF NOT EXISTS video_packages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  features TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  price_vnd INTEGER CHECK (price_vnd >= 0),
  original_price_vnd INTEGER CHECK (original_price_vnd >= 0),
  duration_mode VARCHAR(20) NOT NULL DEFAULT 'unconfigured'
    CHECK (duration_mode IN ('unconfigured', 'days', 'lifetime')),
  duration_days INTEGER CHECK (duration_days > 0),
  allowed_subjects TEXT[] NOT NULL DEFAULT '{}',
  requires_subject_choice BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((duration_mode = 'days' AND duration_days IS NOT NULL)
    OR (duration_mode <> 'days' AND duration_days IS NULL)),
  CHECK (allowed_subjects <@ ARRAY['MATH','PHYSICS','CHEMISTRY','CHINESE_SCI','CHINESE_SOC']::TEXT[]),
  CHECK (array_position(allowed_subjects, NULL) IS NULL),
  CHECK (status <> 'active' OR (price_vnd IS NOT NULL AND duration_mode <> 'unconfigured'
    AND cardinality(allowed_subjects) > 0))
);

CREATE TABLE IF NOT EXISTS video_package_courses (
  video_package_id BIGINT NOT NULL REFERENCES video_packages(id) ON DELETE RESTRICT,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  PRIMARY KEY (video_package_id, course_id)
);

CREATE TABLE IF NOT EXISTS combo_packages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  features TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  vip_package_id INTEGER REFERENCES vip_packages(id) ON DELETE RESTRICT,
  video_package_id BIGINT REFERENCES video_packages(id) ON DELETE RESTRICT,
  price_vnd INTEGER CHECK (price_vnd >= 0),
  original_price_vnd INTEGER CHECK (original_price_vnd >= 0),
  vip_duration_days INTEGER CHECK (vip_duration_days > 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, video_package_id),
  CHECK (status <> 'active' OR (price_vnd IS NOT NULL AND vip_duration_days IS NOT NULL
    AND vip_package_id IS NOT NULL AND video_package_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS user_video_entitlements (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  video_package_id BIGINT NOT NULL REFERENCES video_packages(id) ON DELETE RESTRICT,
  combo_package_id BIGINT REFERENCES combo_packages(id) ON DELETE RESTRICT,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE RESTRICT,
  grant_key VARCHAR(200) NOT NULL UNIQUE CHECK (length(trim(grant_key)) > 0),
  source VARCHAR(20) NOT NULL CHECK (source IN ('payment', 'manual')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  allowed_subjects TEXT[] NOT NULL CHECK (cardinality(allowed_subjects) > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  duration_mode VARCHAR(20) NOT NULL CHECK (duration_mode IN ('days', 'lifetime')),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (combo_package_id, video_package_id) REFERENCES combo_packages(id, video_package_id) ON DELETE RESTRICT,
  CHECK (allowed_subjects <@ ARRAY['MATH','PHYSICS','CHEMISTRY','CHINESE_SCI','CHINESE_SOC']::TEXT[]),
  CHECK (array_position(allowed_subjects, NULL) IS NULL),
  CHECK ((duration_mode = 'days' AND expires_at IS NOT NULL AND expires_at > starts_at)
    OR (duration_mode = 'lifetime' AND expires_at IS NULL)),
  CHECK (source <> 'payment' OR transaction_id IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

-- Snapshot the purchased course set so draft/catalog edits cannot revoke a sale.
CREATE TABLE IF NOT EXISTS video_entitlement_courses (
  entitlement_id BIGINT NOT NULL REFERENCES user_video_entitlements(id) ON DELETE RESTRICT,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  PRIMARY KEY (entitlement_id, course_id)
);

CREATE TABLE IF NOT EXISTS video_commerce_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('video', 'combo')),
  product_id BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL CHECK (action IN ('draft_created', 'draft_updated')),
  before_data JSONB,
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_packages_catalog ON video_packages(status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_combo_packages_catalog ON combo_packages(status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_video_package_courses_course ON video_package_courses(course_id, video_package_id);
CREATE INDEX IF NOT EXISTS idx_video_entitlements_user ON user_video_entitlements(user_id, starts_at, expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_video_entitlements_transaction ON user_video_entitlements(transaction_id)
  WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_entitlement_courses_course ON video_entitlement_courses(course_id, entitlement_id);
CREATE INDEX IF NOT EXISTS idx_video_commerce_audit_product ON video_commerce_audit(product_type, product_id, created_at DESC);

COMMENT ON TABLE video_packages IS 'Independent video products. Draft pricing and duration can be configured later.';
COMMENT ON TABLE combo_packages IS 'New products referencing legacy VIP packages without changing their price or behavior.';
COMMENT ON TABLE user_video_entitlements IS 'Video-only rights. Never used as a substitute for legacy VIP entitlements.';
