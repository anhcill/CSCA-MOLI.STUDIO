-- Migration: Create transactions table for VIP payments
-- Run: psql -U postgres -d csca_db -f add_transactions_table.sql

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL,           -- 'momo', 'vnpay', 'atm', 'qr'
    package_duration INTEGER,                      -- days: 30, 180, 365
    package_name VARCHAR(100),                    -- 'Gói Xem', 'Gói Kiểm tra', 'Gói Làm bài'
    transaction_code VARCHAR(255) UNIQUE NOT NULL,  -- MoMo orderId / VNPay txnRef
    status VARCHAR(20) DEFAULT 'pending',          -- pending, completed, failed, cancelled, refunded
    payment_channel VARCHAR(50),                   -- channel gửi về từ cổng (MoMo / VNPay)
    trans_id VARCHAR(100),                        -- transaction ID từ cổng thanh toán
    raw_response JSONB,                            -- lưu raw response từ webhook
    paid_at TIMESTAMP,                            -- thời điểm thanh toán thành công
    vip_expires_at TIMESTAMP,                    -- VIP hết hạn sau gói này
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_code ON transactions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

COMMENT ON TABLE transactions IS 'Lịch sử thanh toán VIP — MoMo, VNPay, ATM';
