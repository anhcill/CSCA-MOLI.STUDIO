-- Migration: Create coupon_usages table for tracking coupon usage
-- Run: psql -U postgres -d csca_db -f create_coupon_usages.sql

CREATE TABLE IF NOT EXISTS coupon_usages (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    discount_amount INTEGER NOT NULL,             -- Số tiền được giảm (VNĐ)
    final_amount INTEGER NOT NULL,                -- Số tiền phải trả sau khi giảm
    original_amount INTEGER NOT NULL,             -- Số tiền gốc trước khi giảm
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, user_id)                   -- Mỗi user chỉ dùng 1 coupon 1 lần (hoặc tùy user_limit)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_transaction_id ON coupon_usages(transaction_id);

COMMENT ON TABLE coupon_usages IS 'Lịch sử sử dụng mã giảm giá coupon';
