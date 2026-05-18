-- Light external games that allow iframe embedding from GitHub Pages/static hosts.
-- Do not use play2048.co here: it sends a frame-ancestors CSP that blocks molystudio.online.

INSERT INTO game_modes (
  slug, name, description, mode_type, is_active, entry_fee_coins, reward_coins,
  daily_reward_cap, question_count, time_limit_seconds, min_accuracy_reward,
  sort_order, config
) VALUES
  (
    'arcade-2048',
    '2048 Thư Giãn',
    'Xếp số nhẹ nhàng, rèn quan sát và chiến thuật ngắn. Bản mã nguồn mở chạy trên GitHub Pages.',
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
  ),
  (
    'arcade-hextris',
    'Hextris Nhẹ Não',
    'Game phản xạ xoay lục giác, thời lượng ngắn và phù hợp để nghỉ giữa giờ học.',
    'external',
    TRUE,
    0,
    5,
    25,
    0,
    180,
    0,
    21,
    '{
      "tone": "violet",
      "provider": "Hextris",
      "license": "Open source",
      "external_url": "https://hextris.io/",
      "cover_url": "",
      "instructions": "Xoay lục giác để ghép màu, cố gắng giữ màn chơi không bị đầy. Chơi tối thiểu 30 giây để nhận thưởng.",
      "min_play_seconds": 30,
      "max_score": 1500
    }'::jsonb
  ),
  (
    'arcade-tetris',
    'Tetris Cổ Điển',
    'Xếp gạch cổ điển, giải trí nhẹ và luyện phản xạ không quá căng.',
    'external',
    TRUE,
    0,
    5,
    25,
    0,
    180,
    0,
    22,
    '{
      "tone": "blue",
      "provider": "chvin/react-tetris",
      "license": "Open source",
      "external_url": "https://chvin.github.io/react-tetris/",
      "cover_url": "",
      "instructions": "Di chuyển và xoay khối để hoàn thành hàng. Chơi tối thiểu 30 giây để hệ thống ghi nhận.",
      "min_play_seconds": 30,
      "max_score": 1500
    }'::jsonb
  ),
  (
    'arcade-clumsy-bird',
    'Clumsy Bird',
    'Game bay né chướng ngại nhẹ nhàng, chơi nhanh trong lúc nghỉ giữa các phiên học.',
    'external',
    TRUE,
    0,
    5,
    25,
    0,
    180,
    0,
    23,
    '{
      "tone": "amber",
      "provider": "ellisonleao/clumsy-bird",
      "license": "Open source",
      "external_url": "https://ellisonleao.github.io/clumsy-bird/",
      "cover_url": "",
      "instructions": "Bấm hoặc nhấn phím để bay qua chướng ngại. Chơi tối thiểu 30 giây để hệ thống ghi nhận.",
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
