const db = require("../config/database");
const { cache } = require("../config/cache");

const CACHE_TTL = 10 * 60; // 10 minutes

/**
 * GET /api/leaderboard
 * Rank by highest score first. If scores tie, shorter completion time ranks higher.
 * Public.
 */
async function getLeaderboard(req, res) {
  try {
    const period = req.query.period === "week" ? "week" : "all";
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const cacheKey = `leaderboard:v4:${period}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const periodFilter = period === "week"
      ? "AND a.submit_time >= date_trunc('week', CURRENT_DATE)"
      : "";

    const { rows } = await db.query(
      `WITH completed_attempts AS (
        SELECT
          a.*,
          LEAST(100, GREATEST(0, ROUND((
            CASE
              WHEN a.score_percentage IS NOT NULL THEN a.score_percentage::numeric
              WHEN a.total_possible_score > 0 THEN a.total_score::numeric / a.total_possible_score * 100
              WHEN e.total_points > 0 THEN a.total_score::numeric / e.total_points * 100
              WHEN qp.possible_points > 0 THEN a.total_score::numeric / qp.possible_points * 100
              WHEN e.total_questions > 0 THEN a.total_correct::numeric / e.total_questions * 100
              WHEN a.total_score <= 10 THEN a.total_score::numeric * 10
              ELSE a.total_score::numeric
            END
          ), 1))) AS score_100,
          COALESCE(NULLIF(a.duration_seconds, 0), 999999999)::int AS rank_time_seconds
        FROM exam_attempts a
        JOIN exams e ON e.id = a.exam_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(q.points), 0)::numeric AS possible_points
          FROM questions q
          WHERE q.exam_id = e.id
            AND q.deleted_at IS NULL
        ) qp ON true
        WHERE a.status = 'completed'
          AND a.total_score IS NOT NULL
          ${periodFilter}
      ),
      ranked_attempts AS (
        SELECT
          ca.*,
          ROW_NUMBER() OVER (
            PARTITION BY ca.user_id
            ORDER BY ca.score_100 DESC, ca.rank_time_seconds ASC, ca.submit_time ASC NULLS LAST
          ) AS best_rank
        FROM completed_attempts ca
      ),
      user_stats AS (
        SELECT
          user_id,
          COUNT(id)::int AS total_attempts,
          ROUND(AVG(score_100)::numeric, 1) AS avg_score,
          MAX(submit_time) AS last_attempt_at
        FROM completed_attempts
        GROUP BY user_id
      )
      SELECT
        u.id,
        u.full_name,
        u.avatar_url,
        us.total_attempts,
        us.avg_score,
        ra.score_100 AS best_score,
        ra.score_100 AS best_score_percentage,
        NULLIF(ra.rank_time_seconds, 999999999)::int AS best_time_spent,
        us.last_attempt_at
      FROM user_stats us
      JOIN users u ON u.id = us.user_id
      JOIN ranked_attempts ra ON ra.user_id = us.user_id AND ra.best_rank = 1
      WHERE u.role = 'student'
      ORDER BY ra.score_100 DESC, ra.rank_time_seconds ASC, us.avg_score DESC, us.total_attempts DESC
      LIMIT $1`,
      [limit],
    );

    const data = rows.map((row, i) => ({ rank: i + 1, ...row }));

    cache.set(cacheKey, data, CACHE_TTL);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

module.exports = { getLeaderboard };
