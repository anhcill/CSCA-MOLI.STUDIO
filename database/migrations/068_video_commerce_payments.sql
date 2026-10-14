-- Apply after 067. Existing transactions keep their legacy metadata and behavior.
ALTER TABLE video_packages
  ADD COLUMN IF NOT EXISTS renewal_mode TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (renewal_mode IN ('unconfigured', 'new_period', 'extend')),
  ADD COLUMN IF NOT EXISTS subject_prices JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(subject_prices) = 'object');
ALTER TABLE combo_packages
  ADD COLUMN IF NOT EXISTS renewal_mode TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (renewal_mode IN ('unconfigured', 'new_period', 'extend')),
  ADD COLUMN IF NOT EXISTS subject_prices JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(subject_prices) = 'object');

CREATE TABLE IF NOT EXISTS video_coupon_scopes (
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('video', 'combo')),
  product_ids BIGINT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (coupon_id, product_type),
  CHECK (array_position(product_ids, NULL) IS NULL)
);

-- A paid snapshot can reference an earlier combo composition after catalog
-- edits. Preserve each single FK, but do not bind sold rights to live mapping.
DO $$
DECLARE constraint_row RECORD;
BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid='user_video_entitlements'::regclass AND contype='f'
      AND confrelid='combo_packages'::regclass AND cardinality(conkey)=2
  LOOP
    EXECUTE format('ALTER TABLE user_video_entitlements DROP CONSTRAINT %I',constraint_row.conname);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS video_commerce_orders (
  transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_key VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('video', 'combo')),
  product_id BIGINT NOT NULL,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE RESTRICT,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  expires_at TIMESTAMPTZ NOT NULL,
  provider_payment JSONB,
  received_amount INTEGER CHECK (received_amount >= 0),
  provider_reference TEXT,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  fulfillment_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, request_key),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_order_provider_reference
  ON video_commerce_orders(provider_reference) WHERE provider_reference IS NOT NULL;
ALTER TABLE video_commerce_orders ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS video_payment_outbox (
  transaction_id INTEGER PRIMARY KEY REFERENCES video_commerce_orders(transaction_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Some older installations used amount > 0. Retain non-negative validation,
-- including legacy zero-amount voucher orders, without touching unrelated checks.
DO $$
DECLARE constraint_row RECORD;
BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'transactions'::regclass AND contype = 'c'
      AND regexp_replace(pg_get_constraintdef(oid), '[[:space:]()]', '', 'g') = 'CHECKamount>0'
  LOOP
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'transactions'::regclass AND conname = 'chk_transactions_nonnegative_amount') THEN
    ALTER TABLE transactions ADD CONSTRAINT chk_transactions_nonnegative_amount CHECK (amount >= 0) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_video_orders_user ON video_commerce_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_orders_unfulfilled ON video_commerce_orders(paid_at)
  WHERE paid_at IS NOT NULL AND fulfilled_at IS NULL;

CREATE TABLE IF NOT EXISTS video_payment_config_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('video','combo','coupon')),
  entity_id BIGINT NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
