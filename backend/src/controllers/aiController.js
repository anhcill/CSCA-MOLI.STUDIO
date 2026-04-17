const db = require("../config/database");
const aiService = require("../services/aiService");
const { cache, TTL } = require("../config/cache");

// Per-user cooldown: userId → timestamp khi được phép call AI tiếp
const userCooldowns = new Map();
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000; // 30 phút giữa các lần refresh

// In-flight deduplication: nếu đang có request chờ Gemini cho userId X,
// các request tiếp theo sẽ dùng chung promise thay vì gọi thêm vào Gemini
const inFlightRequests = new Map(); // userId → Promise<fullAnalysis>

/**
 * GET /api/ai/analyze - Phân tích toàn diện cho user
 * Cache hierarchy: in-memory (30 min) → DB (24h) → call AI API
 */
async function analyzeUserPerformance(req, res) {
  try {
    const userId = req.user.id;
    const memKey = `ai:full_analysis:${userId}`;

    // Tier 0: Nếu đang trong backoff window (vừa bị 429) — trả stale cache ngay
    if (aiService.isRateLimited()) {
      const retryAfter = aiService.getRateLimitRemaining();
      const staleImmediate = await db.query(
        `SELECT data, created_at FROM ai_insights
         WHERE user_id = $1 AND insight_type = 'full_analysis'
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      if (staleImmediate.rows.length > 0) {
        const age = Math.floor(
          (Date.now() - new Date(staleImmediate.rows[0].created_at)) / 60000,
        );
        return res.json({
          success: true,
          cached: true,
          cacheSource: "stale",
          cacheAge: age,
          rateLimited: true,
          retryAfter,
          message:
            "Hệ thống AI đang tạm thời bận, đang hiển thị kết quả phân tích gần nhất.",
          data: staleImmediate.rows[0].data,
        });
      }
      return res.json({
        success: false,
        rateLimited: true,
        retryAfter,
        message: "Hệ thống AI đang quá tải, vui lòng thử lại sau vài phút.",
      });
    }

    // Tier 1: In-memory cache (30 phút) — không tốn DB round-trip
    const memCached = cache.get(memKey);
    if (memCached) {
      return res.json({
        success: true,
        cached: true,
        cacheSource: "memory",
        cacheAge: memCached.cacheAge,
        data: memCached.data,
      });
    }

    // Tier 2: DB cache (24 giờ) — persist qua server restart
    const cached = await db.query(
      `SELECT data, created_at 
       FROM ai_insights 
       WHERE user_id = $1 AND insight_type = 'full_analysis'
       AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId],
    );

    if (cached.rows.length > 0) {
      const cacheAge = Math.floor(
        (Date.now() - new Date(cached.rows[0].created_at)) / 1000 / 60,
      );
      // Warm in-memory cache từ DB để tránh DB query tiếp theo
      cache.set(memKey, { data: cached.rows[0].data, cacheAge }, TTL.VERY_LONG);
      return res.json({
        success: true,
        cached: true,
        cacheSource: "db",
        cacheAge,
        data: cached.rows[0].data,
      });
    }

    // Helper lấy stale cache
    const getStaleOrError = async (msg) => {
      const retryAfter = aiService.getRateLimitRemaining();
      const stale = await db.query(
        `SELECT data, created_at FROM ai_insights
         WHERE user_id = $1 AND insight_type = 'full_analysis'
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      if (stale.rows.length > 0) {
        const age = Math.floor(
          (Date.now() - new Date(stale.rows[0].created_at)) / 60000,
        );
        return res.json({
          success: true,
          cached: true,
          cacheSource: "stale",
          cacheAge: age,
          rateLimited: true,
          retryAfter,
          message: msg,
          data: stale.rows[0].data,
        });
      }
      return res.json({
        success: false,
        rateLimited: true,
        retryAfter,
        message: "Hệ thống AI đang quá tải, vui lòng thử lại sau vài phút.",
      });
    };

    // ── In-flight deduplication ──────────────────────────────────────────────
    // CRITICAL: register a deferred promise SYNCHRONOUSLY (no await before .set)
    // so any concurrent request arriving after this line will wait on it instead
    // of creating a second Gemini call.
    if (inFlightRequests.has(userId)) {
      // Another request is already calling AI — wait for its result
      const data = await inFlightRequests.get(userId);
      if (data) {
        cache.set(memKey, { data, cacheAge: 0 }, TTL.VERY_LONG);
        return res.json({
          success: true,
          cached: true,
          cacheSource: "inflight",
          cacheAge: 0,
          data,
        });
      }
      // inflight failed (null) — re-check rate limit, serve stale or 429
      if (aiService.isRateLimited()) {
        return getStaleOrError(
          "Hệ thống AI đang tạm thời bận, đang hiển thị kết quả phân tích gần nhất.",
        );
      }
      // rate limit already cleared — fall through to try again below
    } else {
      // No inflight yet — register a DEFERRED promise synchronously so the next
      // concurrent request sees it before we do any async work.
      let resolveInflight;
      const inflightPromise = new Promise((resolve) => {
        resolveInflight = resolve;
      });
      inFlightRequests.set(userId, inflightPromise);
      // Store resolver on a closure variable accessible to the rest of this request
      req._resolveInflight = resolveInflight;
      req._inflightPromise = inflightPromise;
    }

    // Cleanup helper — resolves the deferred and removes from map
    const cleanupInflight = (result) => {
      if (req._resolveInflight) {
        req._resolveInflight(result ?? null);
        req._resolveInflight = null;
        setImmediate(() => {
          if (inFlightRequests.get(userId) === req._inflightPromise) {
            inFlightRequests.delete(userId);
          }
        });
      }
    };

    // Re-check rate limit (may have changed while we were awaiting cache queries)
    if (aiService.isRateLimited()) {
      cleanupInflight(null);
      return getStaleOrError(
        "Hệ thống AI đang tạm thời bận, đang hiển thị kết quả phân tích gần nhất.",
      );
    }

    // Fetch exam attempts — dùng schema thực tế (user_exam_attempts)
    // Lưu ý: table thực có thể là exam_attempts (schema mới) hoặc user_exam_attempts (schema cũ)
    // Dùng COALESCE để tương thích cả hai
    let attempts;
    try {
      // Thử schema mới trước (có table exam_attempts + subjects)
      attempts = await db.query(
        `SELECT 
          ea.id,
          ea.total_score as score,
          ea.total_correct,
          ea.total_incorrect as total_wrong,
          ea.submit_time as completed_at,
          s.name as subject,
          e.title as exam_title,
          e.total_questions
         FROM exam_attempts ea
         JOIN exams e ON ea.exam_id = e.id
         JOIN subjects s ON e.subject_id = s.id
         WHERE ea.user_id = $1 AND ea.status = 'completed'
         ORDER BY ea.submit_time DESC
         LIMIT 20`,
        [userId],
      );
    } catch {
      // Fallback schema cũ (user_exam_attempts, subject column trên exams)
      attempts = await db.query(
        `SELECT 
          uea.id,
          uea.score,
          uea.total_correct,
          uea.total_wrong,
          uea.completed_at,
          e.subject as subject,
          e.title as exam_title,
          e.total_questions
         FROM user_exam_attempts uea
         JOIN exams e ON uea.exam_id = e.id
         WHERE uea.user_id = $1 AND uea.is_completed = true
         ORDER BY uea.completed_at DESC
         LIMIT 20`,
        [userId],
      );
    }

    if (attempts.rows.length === 0) {
      cleanupInflight(null);
      return res.json({
        success: true,
        hasEnoughData: false,
        message:
          "Bạn chưa hoàn thành đề thi nào. Hãy làm ít nhất 3 đề để AI phân tích.",
      });
    }

    // Helper lấy stale cache
    const getStaleCache = async () => {
      const stale = await db.query(
        `SELECT data, created_at FROM ai_insights
         WHERE user_id = $1 AND insight_type = 'full_analysis'
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      return stale.rows[0] || null;
    };

    // Final rate-limit guard (một lần nữa, phòng request tới trong khoảng await attempts)
    if (aiService.isRateLimited()) {
      cleanupInflight(null);
      return getStaleOrError(
        "Hệ thống AI đang tạm thời bận, đang hiển thị kết quả phân tích gần nhất.",
      );
    }

    // AI Analysis — gọi trực tiếp, không cần wrap promise riêng
    // vì dedup đã được đăng ký đồng bộ ở trên rồi
    let weaknessAnalysis;
    let roadmap;
    let recommendedMaterials;
    try {
      const weakness = await aiService.analyzeWeaknesses(attempts.rows);
      if (!weakness.hasEnoughData) {
        cleanupInflight(null);
        return res.json({ success: true, ...weakness });
      } else {
        const [rm, materialsRes] = await Promise.all([
          aiService.generateRoadmap(weakness),
          db.query(
            "SELECT * FROM materials WHERE is_active = true ORDER BY created_at DESC LIMIT 50",
          ),
        ]);
        const recommended = await aiService.recommendMaterials(
          weakness,
          materialsRes.rows,
        );
        weaknessAnalysis = weakness;
        roadmap = rm;
        recommendedMaterials = recommended;
      }
    } catch (aiErr) {
      cleanupInflight(null);
      if (aiErr.isRateLimit) {
        const staleRow = await getStaleCache();
        if (staleRow) {
          const staleAge = Math.floor(
            (Date.now() - new Date(staleRow.created_at)) / 60000,
          );
          console.warn(
            `⚠️  Gemini rate limited — trả cache cũ (${staleAge} phút) cho user ${userId}`,
          );
          return res.json({
            success: true,
            cached: true,
            cacheSource: "stale",
            cacheAge: staleAge,
            rateLimited: true,
            retryAfter: aiService.getRateLimitRemaining(),
            message:
              "Hệ thống AI đang bận, đang hiển thị kết quả phân tích gần nhất.",
            data: staleRow.data,
          });
        }
        return res.json({
          success: false,
          rateLimited: true,
          retryAfter: aiService.getRateLimitRemaining(),
          message:
            "Hệ thống AI hiện đang quá tải, vui lòng thử lại sau vài phút.",
        });
      }
      throw aiErr;
    }

    const fullAnalysis = {
      totalExams: attempts.rows.length,
      weaknesses: weaknessAnalysis.weaknesses || [],
      strengths: weaknessAnalysis.strengths || [],
      suggestions: weaknessAnalysis.suggestions || [],
      subjectStats: weaknessAnalysis.subjectStats || [],
      roadmap: roadmap?.roadmap || [],
      recommendedMaterials: recommendedMaterials || [],
      analyzedAt: new Date().toISOString(),
    };

    await db.query(
      `INSERT INTO ai_insights (user_id, insight_type, data)
       VALUES ($1, $2, $3)`,
      [userId, "full_analysis", JSON.stringify(fullAnalysis)],
    );

    cache.set(memKey, { data: fullAnalysis, cacheAge: 0 }, TTL.VERY_LONG);
    cleanupInflight(fullAnalysis); // unblock waiting requests with the fresh result

    res.json({
      success: true,
      cached: false,
      cacheSource: "none",
      data: fullAnalysis,
    });
  } catch (error) {
    // Release any inflight deferred so waiting requests don't hang
    if (req._resolveInflight) {
      req._resolveInflight(null);
      req._resolveInflight = null;
    }
    console.error("AI Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi phân tích dữ liệu, vui lòng thử lại",
    });
  }
}

/**
 * POST /api/ai/refresh - Force refresh analysis (rate limited per user)
 */
async function refreshAnalysis(req, res) {
  try {
    const userId = req.user.id;

    // Kiểm tra cooldown per-user
    const cooldownUntil = userCooldowns.get(userId) || 0;
    if (Date.now() < cooldownUntil) {
      const remainMin = Math.ceil((cooldownUntil - Date.now()) / 60000);
      return res.json({
        success: false,
        rateLimited: true,
        message: `Bạn vừa làm mới phân tích. Vui lòng đợi thêm ${remainMin} phút trước khi làm mới lại.`,
      });
    }

    // Set cooldown cho user này
    userCooldowns.set(userId, Date.now() + REFRESH_COOLDOWN_MS);

    // Xóa in-memory cache
    cache.del(`ai:full_analysis:${userId}`);

    // Chỉ xóa DB cache cũ hơn 30 phút (giữ lại để fallback nếu API bị 429)
    await db.query(
      `DELETE FROM ai_insights
       WHERE user_id = $1 AND insight_type = 'full_analysis'
       AND created_at < NOW() - INTERVAL '30 minutes'`,
      [userId],
    );

    // Gọi lại analyze để sinh kết quả mới
    await analyzeUserPerformance(req, res);
  } catch (error) {
    console.error("Refresh Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi làm mới phân tích",
    });
  }
}

module.exports = {
  analyzeUserPerformance,
  refreshAnalysis,
};
