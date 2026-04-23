-- Migration: Create coupons table for discount codes
-- Run: psql -U postgres -d csca_db -f create_coupons_table.sql

CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
    discount_value INTEGER NOT NULL CHECK (discount_value > 0),
    min_order_amount INTEGER DEFAULT 0,            -- Giá trị đơn hàng tối thiểu (0 = không giới hạn)
    max_uses INTEGER,                             -- Số lần sử dụng tối đa (NULL = không giới hạn)
    used_count INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 1,                  -- Số lần mỗi user được dùng
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    applicable_packages TEXT[],                    -- NULL = áp dụng tất cả, ['all'] = tất cả, [1,2,3] = chỉ các package IDs
    applicable_tiers TEXT[] DEFAULT ARRAY['all'],-- ['vip'] | ['premium'] | ['all']
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_dates ON coupons(valid_from, valid_until);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_coupons_updated_at();

COMMENT ON TABLE coupons IS 'Mã giảm giá VIP — coupon/discount codes for VIP packages';
