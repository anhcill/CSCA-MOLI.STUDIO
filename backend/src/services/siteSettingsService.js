const db = require("../config/database");

const DEFAULT_SETTINGS = {
  exam_date: "2026-06-10T08:00:00",
  public_ai_provider: "9router",
  public_ai_9router_model: "ag/claude-sonnet-4-6",
  public_ai_beeknoee_model: "gpt-5.4-mini",
  public_ai_fallback_provider: "beeknoee",
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
