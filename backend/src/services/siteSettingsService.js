const db = require("../config/database");

const DEFAULT_SETTINGS = {
  exam_date: "2026-06-10T08:00:00",
  public_ai_provider: "9router",
  premium_ai_provider: "deepseek",
  premium_ai_deepseek_model: "deepseek-v4-pro",
  public_ai_9router_model: process.env.PUBLIC_AI_9ROUTER_MODEL || "ag/gemini-3.7-flash-high",
  public_ai_free_9router_model: process.env.PUBLIC_AI_FREE_9ROUTER_MODEL || process.env.PUBLIC_AI_9ROUTER_MODEL || "ag/gemini-3.7-flash-high",
  public_ai_beeknoee_model: "gpt-5.4-mini",
  public_ai_fallback_provider: "beeknoee",
  admin_question_review_model: "cx/gpt-5.5",
  admin_question_review_fallback_model: "ag/claude-opus-4-6-thinking",
  welcome_settings: JSON.stringify({
    enabled: true,
    version: 2,
    badge: "CSCA MOLI.STUDIO",
    title: "Chào mừng bạn đến với CSCA MOLI.STUDIO",
    description: "Nền tảng luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc hàng đầu.",
    buttonText: "Bắt đầu khám phá ngay",
    autoTransitionDuration: 5,
    autoTransitionEnabled: true,
    notFoundTitle: "Không tìm thấy trang",
    notFoundMessage: "Đường dẫn bạn truy cập có thể không đúng, đã bị xóa hoặc tạm thời không thể kết nối.",
    offlineTitle: "Mất kết nối mạng",
    offlineMessage: "Thiết bị của bạn đang ngoại tuyến. Vui lòng kiểm tra lại đường truyền Internet.",
    homeButtonText: "Về trang chủ",
    backButtonText: "Quay lại",
  }),
};

let initPromise = null;

async function ensureSettingsTable() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db.query(
          `INSERT INTO site_settings (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) DO NOTHING`,
          [key, value],
        );
      }
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

async function getSettings(keys) {
  await ensureSettingsTable();
  const { rows } = await db.query(
    "SELECT key, value FROM site_settings WHERE key = ANY($1)",
    [keys],
  );
  const data = { ...DEFAULT_SETTINGS };
  for (const row of rows) data[row.key] = row.value;
  return data;
}

async function updateSettings(values) {
  await ensureSettingsTable();
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  for (const [key, value] of entries) {
    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, String(value)],
    );
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  ensureSettingsTable,
  getSettings,
  updateSettings,
};
