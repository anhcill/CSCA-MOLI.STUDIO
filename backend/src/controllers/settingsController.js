const {
  DEFAULT_SETTINGS,
  ensureSettingsTable,
  getSettings,
  updateSettings: saveSettings,
} = require("../services/siteSettingsService");

const PUBLIC_KEYS = ["exam_date"];
const ADMIN_KEYS = [
  "exam_date",
  "public_ai_provider",
  "public_ai_9router_model",
  "public_ai_beeknoee_model",
  "public_ai_fallback_provider",
  "admin_question_review_model",
  "admin_question_review_fallback_model",
];

ensureSettingsTable().catch((error) => {
  console.error("initSettings error:", error.message);
});

function normalizeProvider(value, fallback = "9router") {
  const provider = String(value || "").trim().toLowerCase();
  return ["9router", "beeknoee"].includes(provider) ? provider : fallback;
}

function normalizeModel(value, fallback) {
  const model = String(value || "").trim();
  return model || fallback;
}

async function getPublicSettings(req, res) {
  try {
    const data = await getSettings(PUBLIC_KEYS);
    res.json({ success: true, data: { exam_date: data.exam_date } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Loi server" });
  }
}

async function getAdminSettings(req, res) {
  try {
    const data = await getSettings(ADMIN_KEYS);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: "Loi server" });
  }
}

async function updateSettings(req, res) {
  try {
    const next = {};

    if (req.body.exam_date !== undefined) {
      if (!req.body.exam_date) {
        return res.status(400).json({ success: false, message: "Thieu exam_date" });
      }
      if (Number.isNaN(Date.parse(req.body.exam_date))) {
        return res.status(400).json({ success: false, message: "exam_date khong hop le" });
      }
      next.exam_date = req.body.exam_date;
    }

    if (req.body.public_ai_provider !== undefined) {
      next.public_ai_provider = normalizeProvider(req.body.public_ai_provider);
    }
    if (req.body.public_ai_fallback_provider !== undefined) {
      next.public_ai_fallback_provider = normalizeProvider(req.body.public_ai_fallback_provider, "beeknoee");
    }
    if (req.body.public_ai_9router_model !== undefined) {
      next.public_ai_9router_model = normalizeModel(
        req.body.public_ai_9router_model,
        DEFAULT_SETTINGS.public_ai_9router_model,
      );
    }
    if (req.body.public_ai_beeknoee_model !== undefined) {
      next.public_ai_beeknoee_model = normalizeModel(
        req.body.public_ai_beeknoee_model,
        DEFAULT_SETTINGS.public_ai_beeknoee_model,
      );
    }
    if (req.body.admin_question_review_model !== undefined) {
      next.admin_question_review_model = normalizeModel(
        req.body.admin_question_review_model,
        DEFAULT_SETTINGS.admin_question_review_model,
      );
    }
    if (req.body.admin_question_review_fallback_model !== undefined) {
      next.admin_question_review_fallback_model = normalizeModel(
        req.body.admin_question_review_fallback_model,
        DEFAULT_SETTINGS.admin_question_review_fallback_model,
      );
    }

    if (!Object.keys(next).length) {
      return res.status(400).json({ success: false, message: "Khong co cai dat can luu" });
    }

    await saveSettings(next);
    const data = await getSettings(ADMIN_KEYS);
    res.json({ success: true, message: "Cap nhat thanh cong", data });
  } catch (e) {
    console.error("updateSettings error:", e.message);
    res.status(500).json({ success: false, message: "Loi server" });
  }
}

module.exports = { getPublicSettings, getAdminSettings, updateSettings };
