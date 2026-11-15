-- Day 5 Moly Studio Integration Operations:
-- Persistent audit trail for reconciliation runs and per-item detection/repair actions.
-- Strictly additive & idempotent.

CREATE TABLE IF NOT EXISTS integration_reconciliation_runs (
  id BIGSERIAL PRIMARY KEY,
  correlation_id VARCHAR(128) NOT NULL,
  trigger_mode VARCHAR(32) NOT NULL CHECK (trigger_mode IN ('scheduled', 'manual', 'api')),
  dry_run BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('running', 'completed', 'partial_failed', 'failed', 'aborted_kill_switch')),
  triggered_by BIGINT NULL,
  scope_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error_code VARCHAR(80) NULL,
  last_error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_recon_runs_created
  ON integration_reconciliation_runs (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS integration_reconciliation_actions (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES integration_reconciliation_runs(id) ON DELETE CASCADE,
  correlation_id VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  action_taken VARCHAR(64) NOT NULL,
  source_system VARCHAR(50) NOT NULL DEFAULT 'csca-course',
  user_id BIGINT NULL,
  local_course_id BIGINT NULL,
  external_user_id VARCHAR(191) NULL,
  external_course_id VARCHAR(191) NULL,
  external_grant_id VARCHAR(191) NULL,
  outbox_id BIGINT NULL,
  conflict_id BIGINT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_recon_actions_run_cat
  ON integration_reconciliation_actions (run_id, category);

CREATE INDEX IF NOT EXISTS idx_integration_recon_actions_user_course
  ON integration_reconciliation_actions (user_id, local_course_id);
