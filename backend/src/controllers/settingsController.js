const db = require("../config/database");
const { authenticate, authorize } = require("../middleware/authMiddleware");

/**
 * Đảm bảo bảng site_settings tồn tại + insert defaults nếu chưa có.
 * Được gọi 1 lần khi controller load.
 */
const initSettings = (async () => {
    try {
        await db.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        await db.query(`
      INSERT INTO site_settings (key, value) VALUES
        ('exam_date', '2026-06-10T08:00:00')
      ON CONFLICT (key) DO NOTHING
    `);
    } catch (e) {
        console.error("initSettings error:", e.message);
    }
})();

/** GET /api/settings/public — Public */
async function getPublicSettings(req, res) {
    try {
        const { rows } = await db.query(
            "SELECT key, value FROM site_settings WHERE key = ANY($1)",
            [["exam_date"]],
        );
        const data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

/** PUT /api/admin/settings — Admin only */
async function updateSettings(req, res) {
    try {
        const { exam_date } = req.body;
        if (!exam_date) {
            return res.status(400).json({ success: false, message: "Thiếu exam_date" });
        }

        // Validate datetime string
        if (isNaN(Date.parse(exam_date))) {
            return res.status(400).json({ success: false, message: "exam_date không hợp lệ" });
        }

        await db.query(
            `INSERT INTO site_settings (key, value, updated_at)
       VALUES ('exam_date', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [exam_date],
        );

        res.json({ success: true, message: "Cập nhật thành công", data: { exam_date } });
    } catch (e) {
        console.error("updateSettings error:", e.message);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

module.exports = { getPublicSettings, updateSettings };
