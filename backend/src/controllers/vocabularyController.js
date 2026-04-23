const db = require("../config/database");

// GET /api/vocabulary?subject=toan&topic=&search=&limit=20&offset=0&is_premium=true&vip_tier=premium
exports.getVocabulary = async (req, res) => {
  try {
    const { subject, topic, search, is_premium, vip_tier } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    let whereClause = "WHERE is_active = TRUE";
    const params = [];

    if (subject) {
      params.push(subject);
      whereClause += ` AND subject = $${params.length}`;
    }
    if (topic) {
      params.push(topic);
      whereClause += ` AND topic = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (word_cn ILIKE $${params.length} OR pinyin ILIKE $${params.length} OR word_vn ILIKE $${params.length} OR word_en ILIKE $${params.length})`;
    }
    if (is_premium === 'true') {
      whereClause += ` AND is_premium = TRUE`;
    } else if (is_premium === 'false') {
      whereClause += ` AND is_premium = FALSE`;
    }
    if (vip_tier) {
      params.push(vip_tier);
      whereClause += ` AND vip_tier = $${params.length}`;
    }

    params.push(limit, offset);
    const query = `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM vocabulary_items
      ${whereClause}
      ORDER BY subject ASC, topic ASC, id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await db.query(query, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    // Strip total_count from individual rows
    const data = result.rows.map(({ total_count, ...row }) => row);

    res.json({
      success: true,
      data,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    console.error("Get vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/vocabulary/topics - Lấy danh sách topics theo subject
exports.getTopics = async (req, res) => {
  try {
    const { subject } = req.query;
    let query =
      "SELECT DISTINCT topic, subject FROM vocabulary_items WHERE is_active = TRUE";
    const params = [];
    if (subject) {
      params.push(subject);
      query += ` AND subject = $1`;
    }
    query += " ORDER BY subject, topic";
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/vocabulary (admin only)
exports.createVocabulary = async (req, res) => {
  try {
    const {
      word_cn, pinyin, word_vn, word_en, subject, topic,
      example_cn, example_vn, is_premium, vip_tier,
    } = req.body;

    if (!word_cn || !pinyin || !word_vn || !subject || !topic) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc: từ Hán, pinyin, nghĩa tiếng Việt, môn, chủ đề",
      });
    }

    const result = await db.query(
      `INSERT INTO vocabulary_items (word_cn, pinyin, word_vn, word_en, subject, topic, example_cn, example_vn, is_premium, vip_tier, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        word_cn, pinyin, word_vn, word_en || null, subject, topic,
        example_cn || null, example_vn || null,
        is_premium === true, vip_tier || 'basic', req.user.id,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0], message: "Thêm từ vựng thành công" });
  } catch (error) {
    console.error("Create vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// PUT /api/vocabulary/:id (admin only)
exports.updateVocabulary = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      word_cn, pinyin, word_vn, word_en, subject, topic,
      example_cn, example_vn, is_active, is_premium, vip_tier,
    } = req.body;

    const result = await db.query(
      `UPDATE vocabulary_items SET
         word_cn=COALESCE($1, word_cn),
         pinyin=COALESCE($2, pinyin),
         word_vn=COALESCE($3, word_vn),
         word_en=COALESCE($4, word_en),
         subject=COALESCE($5, subject),
         topic=COALESCE($6, topic),
         example_cn=$7,
         example_vn=$8,
         is_active=$9,
         is_premium=$10,
         vip_tier=COALESCE($11, vip_tier),
         updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [
        word_cn, pinyin, word_vn, word_en, subject, topic,
        example_cn || null, example_vn || null,
        is_active !== false,
        is_premium,
        vip_tier || 'basic',
        id,
      ],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Không tìm thấy từ vựng" });

    res.json({ success: true, data: result.rows[0], message: "Cập nhật thành công" });
  } catch (error) {
    console.error("Update vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/vocabulary/:id (admin only) - soft delete
exports.deleteVocabulary = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "UPDATE vocabulary_items SET is_active = FALSE WHERE id = $1",
      [id],
    );
    res.json({ success: true, message: "Đã xóa từ vựng" });
  } catch (error) {
    console.error("Delete vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/vocabulary/bulk (admin only) - Import nhiều từ cùng lúc
exports.bulkCreate = async (req, res) => {
  try {
    const { words } = req.body; // Array of vocabulary items
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Cần truyền mảng words" });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const w of words) {
        if (!w.word_cn || !w.pinyin || !w.word_vn || !w.subject || !w.topic)
          continue;
        await client.query(
          `INSERT INTO vocabulary_items (word_cn, pinyin, word_vn, word_en, subject, topic, example_cn, example_vn, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (word_cn, subject) DO NOTHING`,
          [
            w.word_cn,
            w.pinyin,
            w.word_vn,
            w.word_en || null,
            w.subject,
            w.topic,
            w.example_cn || null,
            w.example_vn || null,
            req.user.id,
          ],
        );
        inserted++;
      }
      await client.query("COMMIT");
      res.json({ success: true, message: `Đã import ${inserted} từ` });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Bulk create vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
