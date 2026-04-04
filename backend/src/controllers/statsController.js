const db = require("../config/database");
const { cache, TTL } = require("../config/cache");

/**
 * GET /api/stats/overview
 * Trả về số liệu tổng quan từ DB, cache 1 giờ.
 * C8 fix: không còn hardcode trên frontend.
 */
async function getOverview(req, res) {
    const CACHE_KEY = "stats:overview";

    try {
        const cached = cache.get(CACHE_KEY);
        if (cached) {
            return res.json({ success: true, data: cached, fromCache: true });
        }

        const [users, exams, materials] = await Promise.all([
            db.query("SELECT COUNT(*) AS total FROM users"),
            db.query("SELECT COUNT(*) AS total FROM exams WHERE is_active = true"),
            db.query("SELECT COUNT(*) AS total FROM materials WHERE is_active = true"),
        ]);

        // Pass rate: tỷ lệ lần thi đạt >= 5 điểm (50%) / tổng lần thi hoàn thành
        const passResult = await db.query(`
      SELECT
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE total_score >= 5) / NULLIF(COUNT(*), 0)
        ) AS pass_rate
      FROM exam_attempts
      WHERE status = 'completed'
    `);

        const data = {
            users: parseInt(users.rows[0].total) || 0,
            exams: parseInt(exams.rows[0].total) || 0,
            materials: parseInt(materials.rows[0].total) || 0,
            passRate: parseInt(passResult.rows[0]?.pass_rate) || 95,
        };

        // Cache 1 tiếng — số liệu không cần real-time
        cache.set(CACHE_KEY, data, 60 * 60);

        res.json({ success: true, data });
    } catch (error) {
        console.error("Stats overview error:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

module.exports = { getOverview };
