const db = require("../config/database");

class CoinError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function withClient(existingClient, fn) {
  if (existingClient) return fn(existingClient);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getBalance(userId, client = db) {
  const result = await client.query(
    "SELECT COALESCE(coins, 0)::int AS coins FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0]?.coins || 0;
}

async function getReservedPaymentCoins(userId, { excludeTransactionId = null, client = db } = {}) {
  const params = [userId];
  let excludeClause = "";
  const excludedId = Number.parseInt(excludeTransactionId, 10);
  if (Number.isFinite(excludedId) && excludedId > 0) {
    params.push(excludedId);
    excludeClause = `AND id <> $${params.length}`;
  }

  const result = await client.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN raw_response ? 'coinsUsed'
          AND (raw_response->>'coinsUsed') ~ '^[0-9]+$'
         THEN (raw_response->>'coinsUsed')::int
         ELSE 0
       END
     ), 0)::int AS reserved
     FROM transactions
     WHERE user_id = $1
       AND status IN ('pending', 'processing')
       AND created_at >= NOW() - INTERVAL '24 hours'
       ${excludeClause}`,
    params,
  );
  return result.rows[0]?.reserved || 0;
}

async function adjustBalance({
  userId,
  amount,
  source,
  description = null,
  metadata = {},
  idempotencyKey = null,
  client = null,
}) {
  const delta = Number.parseInt(amount, 10);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new CoinError("Số xu thay đổi không hợp lệ", "INVALID_COIN_AMOUNT");
  }

  return withClient(client, async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.query(
        "SELECT * FROM coin_ledger WHERE idempotency_key = $1 LIMIT 1",
        [idempotencyKey],
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    const locked = await tx.query(
      "SELECT COALESCE(coins, 0)::int AS coins FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    if (!locked.rows[0]) {
      throw new CoinError("Không tìm thấy người dùng", "USER_NOT_FOUND", 404);
    }

    const current = locked.rows[0].coins || 0;
    const next = current + delta;
    if (next < 0) {
      throw new CoinError("Bạn không đủ xu", "INSUFFICIENT_COINS", 402);
    }

    if (delta < 0) {
      const reservedCoins = await getReservedPaymentCoins(userId, {
        excludeTransactionId: metadata?.transactionId,
        client: tx,
      });
      if (next < reservedCoins) {
        throw new CoinError(
          "Ban khong du xu kha dung vi dang co xu giu cho don thanh toan cho xu ly",
          "INSUFFICIENT_COINS",
          402,
        );
      }
    }

    await tx.query("UPDATE users SET coins = $1, updated_at = NOW() WHERE id = $2", [
      next,
      userId,
    ]);

    const ledger = await tx.query(
      `INSERT INTO coin_ledger (
         user_id, amount, balance_after, source, description, metadata, idempotency_key
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        userId,
        delta,
        next,
        source,
        description,
        JSON.stringify(metadata || {}),
        idempotencyKey,
      ],
    );

    return ledger.rows[0];
  });
}

async function credit(userId, amount, source, options = {}) {
  return adjustBalance({ userId, amount: Math.abs(amount), source, ...options });
}

async function debit(userId, amount, source, options = {}) {
  return adjustBalance({ userId, amount: -Math.abs(amount), source, ...options });
}

async function getLedger(userId, { limit = 30, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 30, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const result = await db.query(
    `SELECT id, amount, balance_after, source, description, metadata, created_at
     FROM coin_ledger
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset],
  );
  return result.rows;
}

async function getAdminSummary() {
  const [totals, bySource, recent] = await Promise.all([
    db.query(
      `SELECT
         COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM coin_ledger), 0)::int AS total_issued,
         COALESCE((SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) FROM coin_ledger), 0)::int AS total_spent,
         COALESCE((SELECT SUM(coins) FROM users), 0)::int AS total_balance`,
    ),
    db.query(
      `SELECT source,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::int AS issued,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::int AS spent,
              COUNT(*)::int AS entries
       FROM coin_ledger
       GROUP BY source
       ORDER BY entries DESC, source ASC`,
    ),
    db.query(
      `SELECT l.id, l.user_id, u.full_name, u.email, l.amount, l.balance_after,
              l.source, l.description, l.created_at
       FROM coin_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT 20`,
    ),
  ]);

  return {
    totals: totals.rows[0] || { total_issued: 0, total_spent: 0, total_balance: 0 },
    bySource: bySource.rows,
    recent: recent.rows,
  };
}

module.exports = {
  CoinError,
  adjustBalance,
  credit,
  debit,
  getBalance,
  getReservedPaymentCoins,
  getLedger,
  getAdminSummary,
};
