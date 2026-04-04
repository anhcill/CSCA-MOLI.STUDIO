const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const vocabularyController = require("../controllers/vocabularyController");
const db = require("../config/database");

// Auto-create vocabulary_items table if not exists
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
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word_cn, subject)
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_vocab_subject ON vocabulary_items(subject)`,
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_vocab_topic ON vocabulary_items(subject, topic)`,
    );
    // silent init
  } catch (err) {
    console.error("❌ Vocabulary table init error:", err.message);
  }
})();

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/", vocabularyController.getVocabulary);
router.get("/topics", vocabularyController.getTopics);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  authorize("admin"),
  vocabularyController.createVocabulary,
);
router.post(
  "/bulk",
  authenticate,
  authorize("admin"),
  vocabularyController.bulkCreate,
);
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  vocabularyController.updateVocabulary,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  vocabularyController.deleteVocabulary,
);

module.exports = router;
