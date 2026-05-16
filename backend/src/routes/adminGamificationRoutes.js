const express = require("express");
const db = require("../config/database");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const coinService = require("../services/coinService");
const rankService = require("../services/rankService");

const router = express.Router();

router.use(authenticate, authorizeAnyPermission("game.manage", "admin.super", "system.manage"));

router.get("/summary", async (req, res) => {
  try {
    const [coinSummary, modes, season, gameStats, rankStats] = await Promise.all([
      coinService.getAdminSummary(),
      db.query(`SELECT * FROM game_modes ORDER BY sort_order ASC, id ASC`),
      rankService.getCurrentSeason(),
      db.query(
        `SELECT gm.slug, gm.name, COUNT(gs.id)::int AS sessions,
                COALESCE(SUM(gs.coins_earned), 0)::int AS coins_earned,
                COALESCE(ROUND(AVG(gs.score)::numeric, 1), 0)::float AS avg_score
         FROM game_modes gm
         LEFT JOIN game_sessions gs ON gs.mode_id = gm.id
         GROUP BY gm.id
         ORDER BY gm.sort_order ASC`,
      ),
      db.query(
        `SELECT COUNT(*)::int AS matches,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
         FROM rank_matches`,
      ),
    ]);

    res.json({
      success: true,
      data: {
        coinSummary,
        modes: modes.rows,
        season,
        gameStats: gameStats.rows,
        rankStats: rankStats.rows[0] || { matches: 0, completed: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không tải được dữ liệu gamification" });
  }
});

router.put("/modes/:id", async (req, res) => {
  try {
    const fields = [
      "name",
      "description",
      "is_active",
      "entry_fee_coins",
      "reward_coins",
      "daily_reward_cap",
      "question_count",
      "time_limit_seconds",
      "min_accuracy_reward",
      "sort_order",
    ];
    const sets = [];
    const values = [];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        values.push(req.body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    });
    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: "Không có trường hợp lệ để cập nhật" });
    }
    values.push(req.params.id);
    const result = await db.query(
      `UPDATE game_modes
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mini game" });
    }
    res.json({ success: true, data: { mode: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không cập nhật được mini game" });
  }
});

router.post("/seasons", async (req, res) => {
  try {
    const { name, starts_at, ends_at, is_active = true, reward_config = {} } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Tên mùa rank là bắt buộc" });
    }
    if (is_active) {
      await db.query(`UPDATE rank_seasons SET is_active = FALSE WHERE is_active = TRUE`);
    }
    const result = await db.query(
      `INSERT INTO rank_seasons (name, starts_at, ends_at, is_active, reward_config)
       VALUES ($1, COALESCE($2::timestamp, CURRENT_TIMESTAMP), $3::timestamp, $4, $5::jsonb)
       RETURNING *`,
      [name, starts_at || null, ends_at || null, is_active, JSON.stringify(reward_config || {})],
    );
    res.status(201).json({ success: true, data: { season: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không tạo được mùa rank" });
  }
});

router.post("/wallet/grant", async (req, res) => {
  try {
    const { user_id, amount, reason } = req.body;
    const parsedAmount = Number.parseInt(amount, 10);
    if (!user_id || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ success: false, message: "Thiếu user hoặc số xu không hợp lệ" });
    }
    const entry = await coinService.adjustBalance({
      userId: Number(user_id),
      amount: parsedAmount,
      source: "admin_adjustment",
      description: reason || "Admin điều chỉnh xu",
      metadata: { adminId: req.user.id },
    });
    res.json({ success: true, data: { entry } });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không điều chỉnh được xu",
      code: error.code,
    });
  }
});

module.exports = router;
