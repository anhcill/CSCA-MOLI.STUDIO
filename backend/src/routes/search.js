const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET /api/search?q=keyword&limit=5&offset=0&type=all
router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().slice(0, 100);
    if (q.length < 2)
      return res.json({
        success: true,
        results: { materials: [], vocabulary: [], exams: [], posts: [] },
      });

    const pattern = `%${q}%`;
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const type = req.query.type || "all"; // all | materials | vocabulary | exams | posts

    const run = (fn) => (type === "all" || type === fn ? true : false);

    const [materialsRes, vocabRes, examsRes, postsRes] = await Promise.all([
      run("materials")
        ? db.query(
            `SELECT id, title, description, category, subject, topic
         FROM materials
         WHERE (is_active IS NULL OR is_active = TRUE)
           AND (title ILIKE $1 OR description ILIKE $1 OR topic ILIKE $1)
         ORDER BY title
         LIMIT $2 OFFSET $3`,
            [pattern, limit, offset],
          )
        : Promise.resolve({ rows: [] }),

      run("vocabulary")
        ? db
            .query(
              `SELECT id, word_cn, pinyin, word_vn, word_en, subject, topic
         FROM vocabulary_items
         WHERE (is_active IS NULL OR is_active = TRUE)
           AND (word_cn ILIKE $1 OR pinyin ILIKE $1 OR word_vn ILIKE $1 OR word_en ILIKE $1 OR topic ILIKE $1)
         ORDER BY word_vn
         LIMIT $2 OFFSET $3`,
              [pattern, limit, offset],
            )
            .catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),

      run("exams")
        ? db
            .query(
              `SELECT e.id, e.title, s.name AS subject_name, e.created_at
         FROM exams e
         LEFT JOIN subjects s ON e.subject_id = s.id
         WHERE e.status = 'published' AND e.title ILIKE $1
         ORDER BY e.title
         LIMIT $2 OFFSET $3`,
              [pattern, limit, offset],
            )
            .catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),

      run("posts")
        ? db
            .query(
              `SELECT p.id, p.content, p.created_at,
                u.full_name AS author_name, u.avatar AS author_avatar,
                COUNT(DISTINCT pl.id) AS like_count,
                COUNT(DISTINCT pc.id) AS comment_count
         FROM posts p
         INNER JOIN users u ON p.user_id = u.id
         LEFT JOIN post_likes pl ON p.id = pl.post_id
         LEFT JOIN post_comments pc ON p.id = pc.post_id
         WHERE p.content ILIKE $1
         GROUP BY p.id, u.id
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
              [pattern, limit, offset],
            )
            .catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      success: true,
      results: {
        materials: materialsRes.rows,
        vocabulary: vocabRes.rows,
        exams: examsRes.rows,
        posts: postsRes.rows,
      },
      meta: { q, limit, offset },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: "Lỗi tìm kiếm" });
  }
});

module.exports = router;
