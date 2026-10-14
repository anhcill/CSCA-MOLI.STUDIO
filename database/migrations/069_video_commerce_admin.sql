-- Apply after 068. Manual grants never create revenue transactions.
ALTER TABLE user_video_entitlements
  ADD COLUMN IF NOT EXISTS vip_entitlement_id INTEGER REFERENCES user_vip_entitlements(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS snapshot JSONB;
UPDATE user_video_entitlements e SET vip_entitlement_id=(o.result->>'vipEntitlementId')::int,
  snapshot=o.snapshot FROM video_commerce_orders o
  WHERE e.transaction_id=o.transaction_id AND e.snapshot IS NULL AND o.fulfilled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS video_admin_requests (
  request_key VARCHAR(120) PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  entitlement_id BIGINT NOT NULL REFERENCES user_video_entitlements(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS video_admin_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS video_promotions (
  product_type TEXT PRIMARY KEY CHECK (product_type IN ('video','combo')),
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS idx_video_admin_events_entity ON video_admin_events(entity_type,entity_id,id DESC);
CREATE TABLE IF NOT EXISTS video_rights_outbox (
  event_key TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ
);
