const db = require("../config/database");
const { cache } = require("../config/cache");

const CACHE_TTL = 10 * 60; // 10 phút

/**
 * GET /api/leaderboard
 * Top users theo avg_score, yêu cầu tối thiểu 3 lần thi.
 * Public — không cần auth.
 */
async function getLeaderboard(req, res) {
    try {
        const period = req.query.period === "week" ? "week" : "all";
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const cacheKey = `leaderboard:${period}:${limit}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json({ success: true, data: cached, fromCache: true });

        const periodFilter = period === "week"
            ? "AND a.submit_time >= date_trunc('week', CURRENT_DATE)"
            : "";

        const { rows } = await db.query(
            `SELECT
        u.id,
        u.full_name,
        u.avatar_url,
        COUNT(a.id)::int                   AS total_attempts,
        ROUND(AVG(a.total_score)::numeric, 1) AS avg_score,
        MAX(a.total_score)                 AS best_score,
        MAX(a.submit_time)                AS last_attempt_at
      FROM users u
      JOIN exam_attempts a ON a.user_id = u.id
      WHERE a.status = 'completed'
        AND u.role = 'student'
        ${periodFilter}
      GROUP BY u.id, u.full_name, u.avatar_url
      HAVING COUNT(a.id) >= 1
      ORDER BY avg_score DESC, total_attempts DESC
      LIMIT $1`,
            [limit],
        );

        // Thêm rank
        const data = rows.map((row, i) => ({ rank: i + 1, ...row }));

        cache.set(cacheKey, data, CACHE_TTL);
        res.json({ success: true, data });
    } catch (error) {
        console.error("Leaderboard error:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

module.exports = { getLeaderboard };
