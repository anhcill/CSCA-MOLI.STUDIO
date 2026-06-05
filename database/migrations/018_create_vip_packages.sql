-- Migration: Tạo bảng vip_packages và vip_features_comparison
-- Chỉ giữ lại 2 gói: VIP và Premium

-- 1. Tạo bảng vip_packages
CREATE TABLE IF NOT EXISTS vip_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'vip', -- 'vip' hoặc 'premium'
    duration_days INTEGER NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    original_price INTEGER,
    price_note TEXT,
    original_price_note TEXT,
    description TEXT,
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger update_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_vip_packages_updated_at'
    ) THEN
        CREATE TRIGGER update_vip_packages_updated_at
        BEFORE UPDATE ON vip_packages
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 2. Tạo bảng so sánh tính năng
CREATE TABLE IF NOT EXISTS vip_features_comparison (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(255) NOT NULL,
    basic_has BOOLEAN DEFAULT false,
    vip_has BOOLEAN DEFAULT false,
    premium_has BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger update_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_vip_features_comparison_updated_at'
    ) THEN
        CREATE TRIGGER update_vip_features_comparison_updated_at
        BEFORE UPDATE ON vip_features_comparison
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
