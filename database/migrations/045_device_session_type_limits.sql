-- ============================================================
-- Device session type limits: mobile/desktop slots
-- ============================================================

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) NOT NULL DEFAULT 'desktop';

UPDATE user_sessions
SET device_type = CASE
  WHEN LOWER(COALESCE(user_agent, device_info, '')) ~ '(ipad|tablet|mobile|iphone|ipod)' THEN 'mobile'
  WHEN LOWER(COALESCE(user_agent, device_info, '')) ~ 'android'
       AND LOWER(COALESCE(user_agent, device_info, '')) !~ 'windows' THEN 'mobile'
  ELSE 'desktop'
END
WHERE device_type IS NULL OR device_type NOT IN ('mobile', 'desktop');

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_type_active
  ON user_sessions(user_id, device_type, expires_at, last_active DESC);
