const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorizePermission,
  optionalAuth,
  checkVipAccess,
} = require("../middleware/authMiddleware");
const vocabularyController = require("../controllers/vocabularyController");
const db = require("../config/database");

// Auto-create vocabulary_items table + columns if not exists
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS vocabulary_items (
        id SERIAL PRIMARY KEY,
        word_cn VARCHAR(100) NOT NULL,
        pinyin VARCHAR(200) NOT NULL,
        word_vn VARCHAR(255) NOT NULL,
        word_en VARCHAR(255),
        subject VARCHAR(100) NOT NULL,
        topic VARCHAR(100) NOT NULL,
        example_cn TEXT,
        example_vn TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        is_premium BOOLEAN DEFAULT FALSE,
        vip_tier VARCHAR(20) DEFAULT 'basic',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word_cn, subject)
      )
    `);
    // Add premium columns if not exist (for existing tables)
    await db.query(`ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE`);
    await db.query(`ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS vip_tier VARCHAR(20) DEFAULT 'basic'`);

    await db.query(`CREATE INDEX IF NOT EXISTS idx_vocab_subject ON vocabulary_items(subject)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_vocab_topic ON vocabulary_items(subject, topic)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_vocab_is_premium ON vocabulary_items(is_premium) WHERE is_premium = TRUE`);
  } catch (err) {
    console.error("❌ Vocabulary table init error:", err.message);
  }
})();

// ── Public routes (with optional auth for VIP filtering) ───────────────
// GET /vocabulary - authenticated users get VIP-filtered content
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const { subject, topic, search, limit, offset, is_premium, vip_tier } = req.query;
    const pageLimit = parseInt(limit) || 50;
    const pageOffset = parseInt(offset) || 0;
    const isVip = checkVipAccess(req.user);

    let whereClause = "WHERE is_active = TRUE";
    const params = [];

    if (subject) { params.push(subject); whereClause += ` AND subject = $${params.length}`; }
    if (topic) { params.push(topic); whereClause += ` AND topic = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (word_cn ILIKE $${params.length} OR pinyin ILIKE $${params.length} OR word_vn ILIKE $${params.length} OR word_en ILIKE $${params.length})`;
    }
    if (is_premium === 'true') { whereClause += ` AND is_premium = TRUE`; }
    else if (is_premium === 'false') { whereClause += ` AND is_premium = FALSE`; }
    if (vip_tier) { params.push(vip_tier); whereClause += ` AND vip_tier = $${params.length}`; }

    // Filter out premium vocabulary for non-VIP users
    if (!isVip) {
      whereClause += ` AND (is_premium = FALSE OR is_premium IS NULL)`;
    }

    params.push(pageLimit, pageOffset);
    const query = `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM vocabulary_items
      ${whereClause}
      ORDER BY subject ASC, topic ASC, id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await db.query(query, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => row);

    res.json({ success: true, data, pagination: { limit: pageLimit, offset: pageOffset, total } });
  } catch (err) {
    next(err);
  }
});

// GET /vocabulary/topics - authenticated users get VIP-filtered topics
router.get("/topics", optionalAuth, async (req, res, next) => {
  try {
    const { subject } = req.query;
    const isVip = checkVipAccess(req.user);

    let whereClause = "WHERE is_active = TRUE";
    if (!isVip) { whereClause += " AND (is_premium = FALSE OR is_premium IS NULL)"; }
    if (subject) {
      const safe = subject.replace(/'/g, "''");
      whereClause += ` AND subject = '${safe}'`;
    }

    const result = await db.query(
      `SELECT DISTINCT topic, subject FROM vocabulary_items ${whereClause} ORDER BY subject, topic`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Admin routes ──────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  authorizePermission("content.manage"),
  vocabularyController.createVocabulary,
);
router.post(
  "/bulk",
  authenticate,
  authorizePermission("content.manage"),
  vocabularyController.bulkCreate,
);
router.put(
  "/:id",
  authenticate,
  authorizePermission("content.manage"),
  vocabularyController.updateVocabulary,
);
router.delete(
  "/:id",
  authenticate,
  authorizePermission("content.manage"),
  vocabularyController.deleteVocabulary,
);

module.exports = router;

