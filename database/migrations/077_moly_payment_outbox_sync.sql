-- Day 3 additive migration on Moly Studio: payment fulfillment outbox tracking,
-- CSCA-Course /moly/events/status reconciliation, retained external ownership
-- projection (distinct from effective access), and order refund audit columns.
-- Safe to run repeatedly and resilient when optional commerce tables are absent.

ALTER TABLE integration_outbox
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS transaction_id INTEGER,
  ADD COLUMN IF NOT EXISTS entitlement_id BIGINT,
  ADD COLUMN IF NOT EXISTS external_grant_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS external_course_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS remote_inbox_id BIGINT,
  ADD COLUMN IF NOT EXISTS remote_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS remote_response_status INTEGER,
  ADD COLUMN IF NOT EXISTS remote_response_body JSONB,
  ADD COLUMN IF NOT EXISTS remote_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_checked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'integration_outbox'::regclass
      AND conname = 'chk_integration_outbox_remote_status'
  ) THEN
    ALTER TABLE integration_outbox
      ADD CONSTRAINT chk_integration_outbox_remote_status
      CHECK (
        remote_status IS NULL OR remote_status IN (
          'queued', 'pending', 'processing', 'processed',
          'stale', 'failed', 'dead_letter', 'ignored', 'conflict'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'integration_outbox'::regclass
      AND conname = 'fk_integration_outbox_user'
  ) THEN
    ALTER TABLE integration_outbox
      ADD CONSTRAINT fk_integration_outbox_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('transactions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'integration_outbox'::regclass
      AND conname = 'fk_integration_outbox_transaction'
  ) THEN
    ALTER TABLE integration_outbox
      ADD CONSTRAINT fk_integration_outbox_transaction
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('user_video_entitlements') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'integration_outbox'::regclass
      AND conname = 'fk_integration_outbox_entitlement'
  ) THEN
    ALTER TABLE integration_outbox
      ADD CONSTRAINT fk_integration_outbox_entitlement
      FOREIGN KEY (entitlement_id) REFERENCES user_video_entitlements(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_outbox_remote_reconcile
  ON integration_outbox (last_status_checked_at NULLS FIRST, id)
  WHERE status = 'sent' AND remote_status IN ('queued', 'pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_integration_outbox_user_inflight
  ON integration_outbox (user_id, event_type, status, id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_outbox_tx
  ON integration_outbox (transaction_id, id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_outbox_grant
  ON integration_outbox (external_grant_id, id)
  WHERE external_grant_id IS NOT NULL;

-- Track whether an external grant is effectively accessible vs retained-but-blocked
-- on CSCA-Course (per Codex Day 2 rule #7: owned=false does not mean free to buy).
ALTER TABLE external_entitlements
  ADD COLUMN IF NOT EXISTS effective_owned BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS origin_system VARCHAR(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'external_entitlements'::regclass
      AND conname = 'chk_external_entitlements_origin_system'
  ) THEN
    ALTER TABLE external_entitlements
      ADD CONSTRAINT chk_external_entitlements_origin_system
      CHECK (origin_system IS NULL OR origin_system IN ('moly', 'csca-course', 'internal-management'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_entitlements_user_course_status
  ON external_entitlements (user_id, local_course_id, status, valid_until);

-- Additive refund tracking on video commerce orders and local entitlement snapshots.
DO $$
BEGIN
  IF to_regclass('video_commerce_orders') IS NOT NULL THEN
    ALTER TABLE video_commerce_orders
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refund_reason TEXT,
      ADD COLUMN IF NOT EXISTS refunded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(180);
  END IF;

  IF to_regclass('user_video_entitlements') IS NOT NULL THEN
    ALTER TABLE user_video_entitlements
      ADD COLUMN IF NOT EXISTS snapshot JSONB;
  END IF;
END $$;
