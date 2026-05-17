-- External arcade games are embedded but rewards are still verified by backend.
-- 2048 by Gabriele Cirulli is MIT licensed: https://github.com/gabrielecirulli/2048

INSERT INTO game_modes (
  slug, name, description, mode_type, is_active, entry_fee_coins, reward_coins,
  daily_reward_cap, question_count, time_limit_seconds, min_accuracy_reward,
  sort_order, config
) VALUES (
  'arcade-2048',
  '2048 Arcade',
  'Game xếp số 2048 bản web mã nguồn mở. Chơi thư giãn, rèn tư duy và nhận thưởng nhỏ theo cap ngày.',
  'external',
  TRUE,
  0,
  5,
  25,
  0,
  180,
  0,
  20,
  '{
    "tone": "fuchsia",
    "provider": "Gabriele Cirulli",
    "license": "MIT",
    "external_url": "https://gabrielecirulli.github.io/2048/",
    "cover_url": "",
    "instructions": "Dùng phím mũi tên hoặc vuốt để ghép các ô cùng số. Chơi tối thiểu 30 giây để hệ thống ghi nhận.",
    "min_play_seconds": 30,
    "max_score": 1500
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mode_type = EXCLUDED.mode_type,
  is_active = EXCLUDED.is_active,
  entry_fee_coins = EXCLUDED.entry_fee_coins,
  reward_coins = EXCLUDED.reward_coins,
  daily_reward_cap = EXCLUDED.daily_reward_cap,
  question_count = EXCLUDED.question_count,
  time_limit_seconds = EXCLUDED.time_limit_seconds,
  min_accuracy_reward = EXCLUDED.min_accuracy_reward,
  sort_order = EXCLUDED.sort_order,
  config = EXCLUDED.config,
  updated_at = CURRENT_TIMESTAMP;
