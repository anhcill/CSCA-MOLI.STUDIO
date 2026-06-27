-- ============================================================
-- Risk Center Foundation: Phase A
-- Tables: admin_notifications, admin_audit_logs, exam_risk_cases
-- ============================================================

-- 1. admin_notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(60) NOT NULL,        -- 'exam_risk', 'payment_risk', 'question_report', 'system'
  severity      VARCHAR(20) NOT NULL DEFAULT 'low',  -- low, medium, high, critical
  title         VARCHAR(255) NOT NULL,
  message       TEXT,
  entity_type   VARCHAR(60),                 -- 'exam_risk_case', 'transaction', 'question', 'user'
  entity_id     INTEGER,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- related user (offender / reporter)
  read_at       TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  resolved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications(created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_severity
  ON admin_notifications(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type
  ON admin_notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_entity
  ON admin_notifications(entity_type, entity_id);

-- 2. admin_audit_logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            SERIAL PRIMARY KEY,
  admin_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,       -- 'lock_attempt', 'invalidate_attempt', 'manual_credit_coins', ...
  entity_type   VARCHAR(60),                 -- 'exam_risk_case', 'attempt', 'transaction', 'question', 'user'
  entity_id     INTEGER,
  before_data   JSONB,
  after_data    JSONB,
  reason        TEXT,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_audit_logs
  ALTER COLUMN admin_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin
  ON admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
  ON admin_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON admin_audit_logs(created_at DESC);

-- 3. exam_risk_cases
CREATE TABLE IF NOT EXISTS exam_risk_cases (
  id              SERIAL PRIMARY KEY,
  attempt_id      INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id         INTEGER REFERENCES exams(id) ON DELETE SET NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'low',   -- low, medium, high, critical
  status          VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, reviewing, resolved, ignored, escalated, reverted
  risk_score      INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  summary         TEXT,
  admin_note      TEXT,
  resolved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_risk_cases_status
  ON exam_risk_cases(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_risk_cases_user
  ON exam_risk_cases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_risk_cases_exam
  ON exam_risk_cases(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_cases_attempt
  ON exam_risk_cases(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_cases_open
  ON exam_risk_cases(created_at DESC) WHERE status = 'open';

-- Add risk_center permissions
INSERT INTO permissions (code, name, description)
VALUES
  ('risk_center.view', 'Risk Center View', 'Xem Risk Center tổng quan'),
  ('risk_center.manage', 'Risk Center Manage', 'Thao tác xử lý case trong Risk Center')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Grant risk_center permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('risk_center.view', 'risk_center.manage')
WHERE r.code = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
