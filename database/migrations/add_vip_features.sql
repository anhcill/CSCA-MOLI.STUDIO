-- Migration script to add VIP and Transaction features to the existing schema

-- 1. Thêm cột VIP cho bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP NULL;

-- 2. Thêm cột premium cho bảng exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- 3. Tạo bảng transactions cho lịch sử giao dịch
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL,
    payment_method VARCHAR(50), -- 'bank_transfer', 'momo', 'vnpay'
    package_duration INTEGER, -- Số ngày của gói (VD: 30, 90, 365)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    transaction_code VARCHAR(100) UNIQUE, -- Mã giao dịch hiển thị (ví dụ: CSCA12345)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger cho update_at (hàm update_updated_at_column đã có trong schema.sql)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_transactions_updated_at'
    ) THEN
        CREATE TRIGGER update_transactions_updated_at 
        BEFORE UPDATE ON transactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
