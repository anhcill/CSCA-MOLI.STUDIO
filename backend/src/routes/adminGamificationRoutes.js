const express = require("express");
const db = require("../config/database");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const coinService = require("../services/coinService");
const rankService = require("../services/rankService");

const router = express.Router();

router.use(authenticate, authorizeAnyPermission("game.manage", "admin.super", "system.manage"));

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toInt(value, fallback, min = 0, max = 100000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function toNumeric(value, fallback, min = 0, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function normalizeConfig(modeType, bodyConfig, existingConfig = {}) {
  const incoming = bodyConfig && typeof bodyConfig === "object" ? bodyConfig : {};
  const config = { ...(existingConfig || {}), ...incoming };

  if (modeType === "external") {
    config.external_url = String(config.external_url || "").trim();
    config.provider = String(config.provider || "external").trim();
    config.license = String(config.license || "").trim();
    config.cover_url = String(config.cover_url || "").trim();
    config.instructions = String(config.instructions || "").trim();
    config.min_play_seconds = toInt(config.min_play_seconds, 30, 5, 600);
    config.max_score = toInt(config.max_score, 1500, 100, 100000);
  }

  return config;
}

function normalizeModePayload(body = {}, existing = {}) {
  const modeType = String(body.mode_type || existing.mode_type || "quiz").trim() || "quiz";
  return {
    slug: normalizeSlug(body.slug || existing.slug),
    name: String(body.name || existing.name || "").trim(),
    description: body.description !== undefined ? String(body.description || "").trim() : existing.description,
    mode_type: modeType,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active ?? true,
    entry_fee_coins: toInt(body.entry_fee_coins, existing.entry_fee_coins || 0, 0, 100000),
    reward_coins: toInt(body.reward_coins, existing.reward_coins || 0, 0, 100000),
    daily_reward_cap: toInt(body.daily_reward_cap, existing.daily_reward_cap || 100, 0, 100000),
    question_count: toInt(body.question_count, existing.question_count || 10, 0, 100),
    time_limit_seconds: toInt(body.time_limit_seconds, existing.time_limit_seconds || 120, 5, 3600),
    min_accuracy_reward: toNumeric(body.min_accuracy_reward, existing.min_accuracy_reward || 60, 0, 100),
    sort_order: toInt(body.sort_order, existing.sort_order || 0, -10000, 10000),
    config: normalizeConfig(modeType, body.config, existing.config),
  };
}

router.get("/summary", async (req, res) => {
  try {
    const [coinSummary, modes, season, gameStats, rankStats, recentSessions, topPlayers] = await Promise.all([
      coinService.getAdminSummary(),
      db.query(`SELECT * FROM game_modes ORDER BY sort_order ASC, id ASC`),
      rankService.getCurrentSeason(),
      db.query(
        `SELECT gm.slug, gm.name, gm.mode_type,
                COUNT(gs.id)::int AS sessions,
                COUNT(DISTINCT gs.user_id)::int AS players,
                COUNT(gs.id) FILTER (WHERE gs.status = 'completed')::int AS completed,
                COALESCE(SUM(gs.coins_earned), 0)::int AS coins_earned,
                COALESCE(ROUND(AVG(gs.score)::numeric, 1), 0)::float AS avg_score,
                COALESCE(ROUND(AVG((gs.metadata->>'accuracy')::numeric), 1), 0)::float AS avg_accuracy
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
      db.query(
        `SELECT gs.id, gs.status, gs.score, gs.coins_earned, gs.time_spent_seconds,
                gs.started_at, gs.completed_at, gm.slug, gm.name, gm.mode_type,
                u.full_name, u.email
         FROM game_sessions gs
         JOIN game_modes gm ON gm.id = gs.mode_id
         LEFT JOIN users u ON u.id = gs.user_id
         ORDER BY gs.started_at DESC
         LIMIT 20`,
      ),
      db.query(
        `SELECT u.id, u.full_name, u.email,
                COUNT(gs.id)::int AS sessions,
                COALESCE(SUM(gs.score), 0)::int AS total_score,
                COALESCE(SUM(gs.coins_earned), 0)::int AS coins_earned
         FROM game_sessions gs
         JOIN users u ON u.id = gs.user_id
         WHERE gs.status = 'completed'
         GROUP BY u.id
         ORDER BY total_score DESC, sessions DESC
         LIMIT 10`,
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
        recentSessions: recentSessions.rows,
        topPlayers: topPlayers.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không tải được dữ liệu gamification" });
  }
});

router.post("/modes", async (req, res) => {
  try {
    const mode = normalizeModePayload(req.body);
    if (!mode.slug || !mode.name) {
      return res.status(400).json({ success: false, message: "Thiếu slug hoặc tên mini game" });
    }
    if (mode.mode_type === "external" && !mode.config.external_url) {
      return res.status(400).json({ success: false, message: "Game nhúng cần URL" });
    }

    const result = await db.query(
      `INSERT INTO game_modes (
         slug, name, description, mode_type, is_active, entry_fee_coins,
         reward_coins, daily_reward_cap, question_count, time_limit_seconds,
         min_accuracy_reward, sort_order, config
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
       RETURNING *`,
      [
        mode.slug,
        mode.name,
        mode.description,
        mode.mode_type,
        mode.is_active,
        mode.entry_fee_coins,
        mode.reward_coins,
        mode.daily_reward_cap,
        mode.question_count,
        mode.time_limit_seconds,
        mode.min_accuracy_reward,
        mode.sort_order,
        JSON.stringify(mode.config),
      ],
    );

    res.status(201).json({ success: true, data: { mode: result.rows[0] } });
  } catch (error) {
    const isDuplicate = error.code === "23505";
    res.status(isDuplicate ? 409 : 500).json({
      success: false,
      message: isDuplicate ? "Slug mini game đã tồn tại" : "Không tạo được mini game",
    });
  }
});

router.put("/modes/:id", async (req, res) => {
  try {
    const existing = await db.query(`SELECT * FROM game_modes WHERE id = $1`, [req.params.id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mini game" });
    }

    const mode = normalizeModePayload(req.body, existing.rows[0]);
    if (!mode.slug || !mode.name) {
      return res.status(400).json({ success: false, message: "Thiếu slug hoặc tên mini game" });
    }
    if (mode.mode_type === "external" && !mode.config.external_url) {
      return res.status(400).json({ success: false, message: "Game nhúng cần URL" });
    }

    const result = await db.query(
      `UPDATE game_modes
       SET slug = $1,
           name = $2,
           description = $3,
           mode_type = $4,
           is_active = $5,
           entry_fee_coins = $6,
           reward_coins = $7,
           daily_reward_cap = $8,
           question_count = $9,
           time_limit_seconds = $10,
           min_accuracy_reward = $11,
           sort_order = $12,
           config = $13::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [
        mode.slug,
        mode.name,
        mode.description,
        mode.mode_type,
        mode.is_active,
        mode.entry_fee_coins,
        mode.reward_coins,
        mode.daily_reward_cap,
        mode.question_count,
        mode.time_limit_seconds,
        mode.min_accuracy_reward,
        mode.sort_order,
        JSON.stringify(mode.config),
        req.params.id,
      ],
    );

    res.json({ success: true, data: { mode: result.rows[0] } });
  } catch (error) {
    const isDuplicate = error.code === "23505";
    res.status(isDuplicate ? 409 : 500).json({
      success: false,
      message: isDuplicate ? "Slug mini game đã tồn tại" : "Không cập nhật được mini game",
    });
  }
});

router.delete("/modes/:id", async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE game_modes
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mini game" });
    }
    res.json({ success: true, data: { mode: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không tắt được mini game" });
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
