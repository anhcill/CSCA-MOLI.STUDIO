-- Backfill wallet ledger for balances that existed before coin_ledger writes.
-- Idempotency keys keep this safe to rerun.

INSERT INTO coin_ledger (
  user_id,
  amount,
  balance_after,
  source,
  description,
  metadata,
  idempotency_key,
  created_at
)
SELECT
  u.id,
  COALESCE(u.coins, 0),
  COALESCE(u.coins, 0),
  'initial_balance',
  'So du xu truoc khi bat dau ghi lich su vi',
  jsonb_build_object('backfill', true, 'migration', '030_backfill_coin_ledger'),
  CONCAT('initial_balance:', u.id),
  CURRENT_TIMESTAMP
FROM users u
WHERE COALESCE(u.coins, 0) <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM coin_ledger l
    WHERE l.idempotency_key = CONCAT('initial_balance:', u.id)
  );
