const express = require("express");
const db = require("../config/database");
const { authenticate } = require("../middleware/authMiddleware");
const coinService = require("../services/coinService");

const router = express.Router();

const UNLOCK_CATALOG = {
  skin: {
    "moli-neon": { title: "Hồ sơ Neon", cost: 80 },
    "rank-warrior": { title: "Khung Rank Warrior", cost: 120 },
  },
  "boss-pass": {
    "daily-extra": { title: "Lượt Boss Challenge thêm", cost: 30 },
  },
  "hint-pack": {
    basic: { title: "Gói 3 gợi ý mini game", cost: 25 },
  },
};

router.get("/catalog", authenticate, async (req, res) => {
  const unlocked = await db.query(
    `SELECT unlock_type, unlock_key, created_at
     FROM user_unlocks
     WHERE user_id = $1`,
    [req.user.id],
  );
  res.json({ success: true, data: { catalog: UNLOCK_CATALOG, unlocked: unlocked.rows } });
});

router.post("/:type/:id/purchase", authenticate, async (req, res) => {
  const unlockType = String(req.params.type || "");
  const unlockKey = String(req.params.id || "");
  const item = UNLOCK_CATALOG[unlockType]?.[unlockKey];
  if (!item) {
    return res.status(404).json({ success: false, message: "Vật phẩm mở khóa không tồn tại" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM user_unlocks WHERE user_id = $1 AND unlock_type = $2 AND unlock_key = $3`,
      [req.user.id, unlockType, unlockKey],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return res.json({ success: true, data: { unlock: existing.rows[0], alreadyUnlocked: true } });
    }

    await coinService.debit(req.user.id, item.cost, "unlock_purchase", {
      description: `Mở khóa ${item.title}`,
      metadata: { unlockType, unlockKey, title: item.title },
      idempotencyKey: `unlock:${req.user.id}:${unlockType}:${unlockKey}`,
      client,
    });

    const unlock = await client.query(
      `INSERT INTO user_unlocks (user_id, unlock_type, unlock_key, cost_coins, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [req.user.id, unlockType, unlockKey, item.cost, JSON.stringify({ title: item.title })],
    );

    await client.query("COMMIT");
    res.json({ success: true, data: { unlock: unlock.rows[0], alreadyUnlocked: false } });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể mở khóa vật phẩm",
      code: error.code,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
