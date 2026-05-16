-- Gamification, wallet ledger, unlocks, and ranked play.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exp INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS coin_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  idempotency_key VARCHAR(160),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user_created
  ON coin_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_source_created
  ON coin_ledger(source, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_ledger_idempotency
  ON coin_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_modes (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  mode_type VARCHAR(40) NOT NULL DEFAULT 'quiz',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  entry_fee_coins INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  daily_reward_cap INTEGER NOT NULL DEFAULT 100,
  question_count INTEGER NOT NULL DEFAULT 10,
  time_limit_seconds INTEGER NOT NULL DEFAULT 120,
  min_accuracy_reward NUMERIC(5,2) NOT NULL DEFAULT 60,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode_id INTEGER NOT NULL REFERENCES game_modes(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  score INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  combo_max INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  question_payload JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_started
  ON game_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode_started
  ON game_sessions(mode_id, started_at DESC);

CREATE TABLE IF NOT EXISTS game_session_answers (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_ref VARCHAR(80) NOT NULL,
  answer_key TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, question_ref)
);

CREATE TABLE IF NOT EXISTS rank_seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reward_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rank_ratings (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES rank_seasons(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000,
  tier VARCHAR(30) NOT NULL DEFAULT 'Bronze',
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_rank_ratings_season_rating
  ON rank_ratings(season_id, rating DESC);

CREATE TABLE IF NOT EXISTS rank_matches (
  id BIGSERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES rank_seasons(id) ON DELETE CASCADE,
  mode_id INTEGER REFERENCES game_modes(id),
  user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  question_payload JSONB NOT NULL DEFAULT '[]',
  user_a_score INTEGER,
  user_b_score INTEGER,
  user_a_accuracy NUMERIC(5,2),
  user_b_accuracy NUMERIC(5,2),
  winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rank_matches_season_status
  ON rank_matches(season_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_matches_user_a
  ON rank_matches(user_a_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_matches_user_b
  ON rank_matches(user_b_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_unlocks (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlock_type VARCHAR(40) NOT NULL,
  unlock_key VARCHAR(80) NOT NULL,
  cost_coins INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, unlock_type, unlock_key)
);

CREATE INDEX IF NOT EXISTS idx_user_unlocks_user
  ON user_unlocks(user_id, created_at DESC);

INSERT INTO game_modes (
  slug, name, description, mode_type, entry_fee_coins, reward_coins,
  daily_reward_cap, question_count, time_limit_seconds, min_accuracy_reward,
  sort_order, config
) VALUES
  ('quiz-rush', 'Quiz Rush', 'Trả lời nhanh câu hỏi từ ngân hàng đề, tính combo và tốc độ.', 'quiz', 0, 12, 60, 10, 120, 60, 1, '{"tone":"blue"}'),
  ('vocabulary-battle', 'Vocabulary Battle', 'Đấu từ vựng tiếng Trung theo nhịp nhanh, chọn nghĩa đúng trước khi hết giờ.', 'vocabulary', 0, 10, 50, 10, 100, 60, 2, '{"tone":"emerald"}'),
  ('boss-challenge', 'Boss Challenge', 'Vượt chuỗi câu khó, sai sẽ mất máu và cần độ chính xác cao hơn.', 'boss', 15, 35, 105, 12, 150, 70, 3, '{"tone":"rose","lives":3}'),
  ('daily-arcade', 'Daily Arcade', 'Thử thách hằng ngày để kiếm xu có giới hạn.', 'mixed', 0, 20, 40, 8, 90, 65, 4, '{"tone":"amber","daily":true}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mode_type = EXCLUDED.mode_type,
  sort_order = EXCLUDED.sort_order,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO rank_seasons (name, starts_at, ends_at, is_active, reward_config)
SELECT 'Mùa Khởi Động', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 days', TRUE,
       '{"bronze":20,"silver":40,"gold":80,"platinum":120,"diamond":200}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM rank_seasons WHERE is_active = TRUE);

INSERT INTO permissions (code, name, description)
VALUES ('game.manage', 'Game & Wallet Management', 'Quản lý mini game, rank và hệ xu')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'game.manage'
WHERE r.code IN ('super_admin', 'content_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;
