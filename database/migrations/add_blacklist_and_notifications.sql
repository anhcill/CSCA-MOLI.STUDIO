-- ====================================================
-- Migration: JWT Blacklist + Notifications
-- ====================================================

-- ── JWT Token Blacklist ──────────────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
    id          SERIAL PRIMARY KEY,
    token_jti   VARCHAR(255) UNIQUE NOT NULL,  -- JWT jti claim (unique per token)
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMP NOT NULL,            -- same as JWT exp, for auto-cleanup
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- ── Notifications ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id           SERIAL PRIMARY KEY,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- người nhận thông báo
    actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,          -- người thực hiện hành động
    type         VARCHAR(30) NOT NULL,   -- 'like_post' | 'comment_post' | 'reply_comment'
    post_id      INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    comment_id   INTEGER,               -- optional: references specific comment
    is_read      BOOLEAN DEFAULT false,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_post ON notifications(post_id);
