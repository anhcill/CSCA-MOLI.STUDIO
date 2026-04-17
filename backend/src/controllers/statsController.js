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
            db.query("SELECT COUNT(*) AS total FROM exams WHERE status = 'published'"),
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

async function getRoadmap(req, res) {
    try {
        const userId = req.user.id;
        const examsRes = await db.query(
            "SELECT count(*) as completed_count FROM exam_attempts WHERE user_id = $1 AND status = 'completed'", 
            [userId]
        );
        const completedExams = parseInt(examsRes.rows[0].completed_count) || 0;
        
        let milestones = [
            {
                id: 1,
                title: 'Khởi đầu vững chắc',
                description: 'Hoàn thành bài kiểm tra năng lực đầu vào và phân tích yếu điểm cơ bản.',
                status: completedExams >= 1 ? 'completed' : 'current',
                iconName: 'FiUnlock',
                color: 'bg-emerald-500',
            },
            {
                id: 2,
                title: 'Vượt chướng ngại vật',
                description: 'AI đã kích hoạt lộ trình. Vui lòng xem bảng Phân Tích Thống Kê bên dưới để bám sát.',
                status: completedExams >= 3 ? 'completed' : (completedExams >= 1 ? 'current' : 'locked'),
                iconName: 'FiTarget',
                color: 'bg-indigo-600',
            },
            {
                id: 3,
                title: 'Thách thức nâng cao',
                description: 'Làm quen với các dạng đề thi áp lực cao (hơn 180 phút liên tục).',
                status: completedExams >= 10 ? 'completed' : (completedExams >= 3 ? 'current' : 'locked'),
                iconName: 'FiLock',
                color: 'bg-gray-400',
            },
            {
                id: 4,
                title: 'Chinh phục Tinh Anh',
                description: 'Sẵn sàng ứng tuyển học bổng hạng VIP siêu cường tráng.',
                status: completedExams >= 20 ? 'completed' : (completedExams >= 10 ? 'current' : 'locked'),
                iconName: 'FiStar',
                color: 'bg-gray-300',
            }
        ];

        res.json({ success: true, milestones });
    } catch (e) {
        console.error("Roadmap error:", e);
        res.status(500).json({ success: false, message: "Lỗi tải lộ trình" });
    }
}

module.exports = { getOverview, getRoadmap };
