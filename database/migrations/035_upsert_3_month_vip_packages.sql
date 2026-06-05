-- Replace public paid VIP packages with four 3-month plans.
-- Existing transactions keep FK links because old packages are only deactivated.

ALTER TABLE vip_packages
  ADD COLUMN IF NOT EXISTS original_price INTEGER,
  ADD COLUMN IF NOT EXISTS price_note TEXT,
  ADD COLUMN IF NOT EXISTS original_price_note TEXT;

WITH desired(name, tier, duration_days, price, original_price, price_note, original_price_note, description, features, sort_order) AS (
  VALUES
    (
      'Premium', 'premium', 90, 866000, 900000, NULL::text, NULL::text,
      'Truy cập full 6 môn: Toán, Vật Lý, Hoá học, Tiếng Trung Tự Nhiên, Tiếng Trung Xã Hội',
      ARRAY[
        'Truy cập toàn bộ đề, đáp án và lời giải chi tiết của tất cả các môn',
        'Truy cập toàn bộ Từ vựng và Lý thuyết của tất cả các môn học',
        'Giải đề CSCA mới nhất',
        'Tải về tài liệu liên quan',
        'Xem lại lịch sử làm bài và đáp án chi tiết',
        'AI phân tích lỗi sai, đáp án và đề xuất lộ trình học bổ sung'
      ]::text[],
      1
    ),
    (
      'Gói Tự Nhiên', 'vip', 90, 488000, 550000, NULL::text, NULL::text,
      'Tiếng Trung Tự Nhiên + Toán + Lý/Hoá',
      ARRAY[
        'Truy cập toàn bộ đề, đáp án và lời giải chi tiết của Toán + TTTN + Lý/Hoá',
        'Truy cập toàn bộ Từ vựng và Lý thuyết của Toán + TTTN + Lý/Hoá',
        'Giải đề CSCA mới nhất của Toán + TTTN + Lý/Hoá',
        'Tải về tài liệu liên quan đến Toán + TTTN + Lý/Hoá',
        'Xem lại lịch sử làm bài và đáp án chi tiết',
        'AI phân tích lỗi sai, đáp án và đề xuất lộ trình học bổ sung'
      ]::text[],
      2
    ),
    (
      'Gói Xã Hội', 'vip', 90, 333000, 400000, NULL::text, NULL::text,
      'Tiếng Trung Xã Hội + Toán',
      ARRAY[
        'Truy cập toàn bộ đề, đáp án và lời giải chi tiết của Toán và TTXH',
        'Truy cập toàn bộ Từ vựng và Lý thuyết của Toán và TTXH',
        'Giải đề CSCA mới nhất của Toán và TTXH',
        'Tải về tài liệu liên quan đến Toán và TTXH',
        'Xem lại lịch sử làm bài và đáp án chi tiết',
        'AI phân tích lỗi sai, đáp án và đề xuất lộ trình học bổ sung'
      ]::text[],
      3
    ),
    (
      'Gói Mini', 'vip', 90, 188000, 200000,
      '188.000đ môn Toán / 122.000đ môn Vật Lý hoặc Hoá',
      '200.000đ môn Toán / 150.000đ môn Vật Lý hoặc Hoá',
      '1 trong 3 môn Toán / Lý / Hoá',
      ARRAY[
        'Truy cập các đề miễn phí trên web',
        'Download tài liệu có hạn',
        'Hỏi trên diễn đàn',
        'Xem lại lịch sử làm bài',
        'Truy cập Lý thuyết và Từ vựng có hạn'
      ]::text[],
      4
    )
),
updated AS (
  UPDATE vip_packages p
  SET tier = d.tier,
      duration_days = d.duration_days,
      price = d.price,
      original_price = d.original_price,
      price_note = d.price_note,
      original_price_note = d.original_price_note,
      description = d.description,
      features = d.features,
      sort_order = d.sort_order,
      is_active = TRUE,
      updated_at = NOW()
  FROM desired d
  WHERE p.name = d.name
  RETURNING p.name
)
INSERT INTO vip_packages (
  name, tier, duration_days, price, original_price, price_note,
  original_price_note, description, features, is_active, sort_order
)
SELECT d.name, d.tier, d.duration_days, d.price, d.original_price, d.price_note,
       d.original_price_note, d.description, d.features, TRUE, d.sort_order
FROM desired d
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.name = d.name);

UPDATE vip_packages
SET is_active = FALSE,
    updated_at = NOW()
WHERE COALESCE(tier, 'vip') <> 'free'
  AND price > 0
  AND name NOT IN ('Premium', 'Gói Tự Nhiên', 'Gói Xã Hội', 'Gói Mini');
