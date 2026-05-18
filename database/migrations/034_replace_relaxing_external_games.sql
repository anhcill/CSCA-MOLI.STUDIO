-- Replace unreliable relaxing iframe games with CrazyGames embed URLs that return 200
-- from their official /embed/ pages. Old external rows are kept for historical
-- game_sessions references, but hidden from the user hub by is_active = FALSE.

UPDATE game_modes
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
  'arcade-2048',
  'arcade-hextris',
  'arcade-tetris',
  'arcade-clumsy-bird',
  'arcade-slope',
  'arcade-brick-breaker',
  'arcade-t-rex',
  'arcade-minesweeper',
  'arcade-sudoku',
  'arcade-memory-match'
);

INSERT INTO game_modes (
  slug, name, description, mode_type, is_active, entry_fee_coins, reward_coins,
  daily_reward_cap, question_count, time_limit_seconds, min_accuracy_reward,
  sort_order, config
) VALUES
  (
    'arcade-cg-2048',
    '2048',
    'Game xep so kinh dien, de vao nhanh va hop de nghi giai lao ngan.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 20,
    '{
      "tone": "fuchsia",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/2048",
      "cover_url": "",
      "instructions": "Ghep cac o cung so de tao diem cao. Choi toi thieu 30 giay de he thong ghi nhan.",
      "min_play_seconds": 30,
      "max_score": 2000
    }'::jsonb
  ),
  (
    'arcade-cg-snake-io',
    'Snake.io',
    'Ran san moi toc do nhanh, dieu khien don gian va de choi lai nhieu lan.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 21,
    '{
      "tone": "emerald",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/snake-io",
      "cover_url": "",
      "instructions": "Dieu khien ran an nang luong, tranh va cham va co gang song lau nhat co the.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-space-waves',
    'Space Waves',
    'Game phan xa mot cham, nhanh gon va hap dan khi nghi giua gio hoc.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 22,
    '{
      "tone": "cyan",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/space-waves",
      "cover_url": "",
      "instructions": "Giu nhip dieu khien tau qua duong hep, tranh vat can va di cang xa cang tot.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-paper-io-2',
    'Paper.io 2',
    'Chiem lan ban do, de hieu nhung cuon va phu hop de doi gio sau khi on bai.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 23,
    '{
      "tone": "violet",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/paper-io-2",
      "cover_url": "",
      "instructions": "Mo rong vung dat, quay ve vung an toan va tranh bi cat duong.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-cut-the-rope',
    'Cut the Rope',
    'Giai do vat ly nhe, cat day dung luc de dua keo toi chu ech xanh.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 24,
    '{
      "tone": "lime",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/cut-the-rope",
      "cover_url": "",
      "instructions": "Cat day, can thoi diem va thu nhieu cach de qua man.",
      "min_play_seconds": 30,
      "max_score": 2000
    }'::jsonb
  ),
  (
    'arcade-cg-mahjongg',
    'Mahjongg Solitaire',
    'Noi cap o Mahjongg thu gian, hop voi nguoi thich game tinh mat va tap trung.',
    'external', TRUE, 0, 5, 25, 0, 240, 0, 25,
    '{
      "tone": "amber",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/mahjongg-solitaire",
      "cover_url": "",
      "instructions": "Tim cac cap o giong nhau va don sach ban co.",
      "min_play_seconds": 30,
      "max_score": 2000
    }'::jsonb
  ),
  (
    'arcade-cg-sandtrix',
    'Sandtrix',
    'Bien the xep khoi dang cat, la mat hon Tetris va choi rat cuon.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 26,
    '{
      "tone": "orange",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/sandtrix",
      "cover_url": "",
      "instructions": "Xep khoi, tao hang mau lien mach va giu man choi khong bi day.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-blockbuster',
    'BlockBuster Puzzle',
    'Xep block phong cach puzzle, de choi tren ca desktop lan dien thoai.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 27,
    '{
      "tone": "blue",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/blockbuster-puzzle",
      "cover_url": "",
      "instructions": "Dat cac khoi vao bang, tao hang hoac cot day de ghi diem.",
      "min_play_seconds": 30,
      "max_score": 2000
    }'::jsonb
  ),
  (
    'arcade-cg-8-ball',
    '8 Ball Billiards',
    'Bi-a 8 bong co dien, choi cham hon va thich hop de thu gian.',
    'external', TRUE, 0, 5, 25, 0, 240, 0, 28,
    '{
      "tone": "slate",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/8-ball-billiards-classic",
      "cover_url": "",
      "instructions": "Can luc, chon goc danh va dua bong vao lo.",
      "min_play_seconds": 30,
      "max_score": 2000
    }'::jsonb
  ),
  (
    'arcade-cg-table-tennis',
    'Table Tennis World Tour',
    'Bong ban toc do vua phai, phan xa nhanh va vao tran rat gon.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 29,
    '{
      "tone": "rose",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/table-tennis-world-tour",
      "cover_url": "",
      "instructions": "Keo vot de tra bong, can thoi diem va huong danh.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-worldguessr',
    'WorldGuessr',
    'Doan dia diem tren ban do, vua giai tri vua hoc them dia ly.',
    'external', TRUE, 0, 5, 25, 0, 240, 0, 30,
    '{
      "tone": "sky",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/worldguessr",
      "cover_url": "",
      "instructions": "Quan sat canh vat, doan vi tri tren ban do va ghi diem cang cao cang tot.",
      "min_play_seconds": 30,
      "max_score": 2500
    }'::jsonb
  ),
  (
    'arcade-cg-wood-blocks',
    'Wood Blocks',
    'Puzzle go nhe nhang, luat don gian va khong can phan xa qua nhanh.',
    'external', TRUE, 0, 5, 25, 0, 180, 0, 31,
    '{
      "tone": "yellow",
      "provider": "CrazyGames",
      "license": "Official embed",
      "external_url": "https://www.crazygames.com/embed/wood-blocks",
      "cover_url": "",
      "instructions": "Dat cac khoi go vao bang de tao hang hoac cot day.",
      "min_play_seconds": 30,
      "max_score": 2000
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
