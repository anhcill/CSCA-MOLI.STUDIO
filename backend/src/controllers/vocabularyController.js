const db = require("../config/database");
const UserActivity = require("../models/UserActivity");

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function vocabularyKey(wordCn, subject) {
  return `${normalizeKey(subject)}::${normalizeKey(wordCn)}`;
}

function normalizeVocabularyPayload(raw = {}) {
  const vipTier = cleanText(raw.vip_tier) || "basic";
  return {
    word_cn: cleanText(raw.word_cn),
    pinyin: cleanText(raw.pinyin),
    word_vn: cleanText(raw.word_vn),
    word_en: cleanText(raw.word_en) || null,
    subject: cleanText(raw.subject),
    topic: cleanText(raw.topic),
    example_cn: cleanText(raw.example_cn) || null,
    example_vn: cleanText(raw.example_vn) || null,
    is_premium: raw.is_premium === true || vipTier !== "basic",
    vip_tier: vipTier,
  };
}

async function findVocabularyDuplicate(client, wordCn, subject, excludeId = null) {
  const params = [wordCn, subject];
  let excludeClause = "";
  if (excludeId) {
    params.push(excludeId);
    excludeClause = ` AND id <> $${params.length}`;
  }

  const result = await client.query(
    `SELECT id, word_cn, pinyin, word_vn, subject, topic, is_active
     FROM vocabulary_items
     WHERE LOWER(TRIM(word_cn)) = LOWER(TRIM($1))
       AND subject = $2
       ${excludeClause}
     ORDER BY is_active DESC, id ASC
     LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
}

// GET /api/vocabulary?subject=toan&topic=&search=&limit=20&offset=0&is_premium=true&vip_tier=premium
exports.getVocabulary = async (req, res) => {
  try {
    const { subject, topic, search, is_premium, vip_tier } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

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
    const payload = normalizeVocabularyPayload(req.body);
    const {
      word_cn, pinyin, word_vn, word_en, subject, topic,
      example_cn, example_vn, is_premium, vip_tier,
    } = payload;

    if (!word_cn || !pinyin || !word_vn || !subject || !topic) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc: từ Hán, pinyin, nghĩa tiếng Việt, môn, chủ đề",
      });
    }

    const duplicate = await findVocabularyDuplicate(db, word_cn, subject);
    if (duplicate?.is_active) {
      return res.status(409).json({
        success: false,
        code: "VOCABULARY_DUPLICATE",
        message: `Từ "${word_cn}" đã tồn tại trong môn này`,
        duplicate,
      });
    }

    if (duplicate) {
      const restored = await db.query(
        `UPDATE vocabulary_items SET
           word_cn=$1, pinyin=$2, word_vn=$3, word_en=$4, subject=$5, topic=$6,
           example_cn=$7, example_vn=$8, is_active=TRUE, is_premium=$9, vip_tier=$10,
           created_by=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [
          word_cn, pinyin, word_vn, word_en, subject, topic,
          example_cn, example_vn, is_premium, vip_tier, req.user.id, duplicate.id,
        ],
      );

      UserActivity.log(req.user.id, 'admin.create_vocabulary', { vocabularyId: restored.rows[0].id, word_cn, restored: true, ip: req.ip, userAgent: req.headers['user-agent'] });
      return res.status(200).json({ success: true, data: restored.rows[0], message: "Đã khôi phục từ vựng đã xóa" });
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

    UserActivity.log(req.user.id, 'admin.create_vocabulary', { vocabularyId: result.rows[0].id, word_cn, ip: req.ip, userAgent: req.headers['user-agent'] });
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
    const payload = normalizeVocabularyPayload(req.body);
    const {
      word_cn, pinyin, word_vn, word_en, subject, topic,
      example_cn, example_vn, is_premium, vip_tier,
    } = payload;
    const { is_active } = req.body;

    if (word_cn && subject) {
      const duplicate = await findVocabularyDuplicate(db, word_cn, subject, id);
      if (duplicate?.is_active) {
        return res.status(409).json({
          success: false,
          code: "VOCABULARY_DUPLICATE",
          message: `Từ "${word_cn}" đã tồn tại trong môn này`,
          duplicate,
        });
      }
    }

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

    UserActivity.log(req.user.id, 'admin.update_vocabulary', { vocabularyId: id, updates: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
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
    UserActivity.log(req.user.id, 'admin.delete_vocabulary', { vocabularyId: id, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: "Đã xóa từ vựng" });
  } catch (error) {
    console.error("Delete vocabulary error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/vocabulary/topics (admin only) - soft delete a whole topic
exports.deleteTopic = async (req, res) => {
  try {
    const subject = (req.body?.subject || req.query?.subject || "").trim();
    const topic = (req.body?.topic || req.query?.topic || "").trim();

    if (!subject || !topic) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn đầy đủ môn và chủ đề cần xóa",
      });
    }

    const result = await db.query(
      `UPDATE vocabulary_items
       SET is_active = FALSE, updated_at = NOW()
       WHERE subject = $1 AND topic = $2 AND is_active = TRUE
       RETURNING id`,
      [subject, topic],
    );

    const deletedCount = result.rowCount || 0;
    UserActivity.log(req.user.id, "admin.delete_vocabulary_topic", {
      subject,
      topic,
      deletedCount,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      deletedCount,
      message: deletedCount > 0
        ? `Đã xóa ${deletedCount} từ trong chủ đề "${topic}"`
        : "Không có từ nào cần xóa trong chủ đề này",
    });
  } catch (error) {
    console.error("Delete vocabulary topic error:", error);
    res.status(500).json({ success: false, message: "Lỗi xóa chủ đề từ vựng" });
  }
};

// PUT /api/vocabulary/topics (admin only) - rename a whole topic
exports.renameTopic = async (req, res) => {
  try {
    const subject = (req.body?.subject || "").trim();
    const oldTopic = (req.body?.oldTopic || req.body?.topic || "").trim();
    const newTopic = (req.body?.newTopic || "").trim();

    if (!subject || !oldTopic || !newTopic) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập môn, tên chủ đề cũ và tên chủ đề mới" });
    }
    if (oldTopic === newTopic) {
      return res.status(400).json({ success: false, message: "Tên chủ đề mới phải khác tên cũ" });
    }

    const result = await db.query(
      `UPDATE vocabulary_items
       SET topic = $3, updated_at = NOW()
       WHERE subject = $1 AND topic = $2 AND is_active = TRUE
       RETURNING id`,
      [subject, oldTopic, newTopic],
    );

    const updatedCount = result.rowCount || 0;
    UserActivity.log(req.user.id, "admin.rename_vocabulary_topic", { subject, oldTopic, newTopic, updatedCount, ip: req.ip, userAgent: req.headers["user-agent"] });

    res.json({ success: true, updatedCount, message: updatedCount > 0 ? `Đã đổi tên ${updatedCount} từ sang chủ đề "${newTopic}"` : "Không tìm thấy từ nào trong chủ đề này" });
  } catch (error) {
    console.error("Rename vocabulary topic error:", error);
    res.status(500).json({ success: false, message: "Lỗi đổi tên chủ đề từ vựng" });
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
      const normalized = [];
      const invalidRows = [];
      const inputDuplicates = [];
      const seen = new Set();

      words.forEach((raw, index) => {
        const item = normalizeVocabularyPayload(raw);
        const line = index + 1;
        if (!item.word_cn || !item.pinyin || !item.word_vn || !item.subject || !item.topic) {
          invalidRows.push(line);
          return;
        }
        const key = vocabularyKey(item.word_cn, item.subject);
        if (seen.has(key)) {
          inputDuplicates.push({ line, word_cn: item.word_cn, subject: item.subject, reason: "input_duplicate" });
          return;
        }
        seen.add(key);
        normalized.push({ ...item, line, key });
      });

      let inserted = 0;
      let reactivated = 0;
      const duplicates = [...inputDuplicates];
      const subjects = [...new Set(normalized.map((item) => item.subject))];
      const wordKeys = [...new Set(normalized.map((item) => normalizeKey(item.word_cn)))];
      const existingMap = new Map();

      if (subjects.length > 0 && wordKeys.length > 0) {
        const existing = await client.query(
          `SELECT id, word_cn, pinyin, word_vn, subject, topic, is_active,
                  LOWER(TRIM(word_cn)) AS normalized_word
           FROM vocabulary_items
           WHERE subject = ANY($1::text[])
             AND LOWER(TRIM(word_cn)) = ANY($2::text[])`,
          [subjects, wordKeys],
        );
        existing.rows.forEach((row) => {
          existingMap.set(vocabularyKey(row.normalized_word, row.subject), row);
        });
      }

      for (const w of normalized) {
        const existing = existingMap.get(w.key);
        if (existing?.is_active) {
          duplicates.push({ line: w.line, id: existing.id, word_cn: existing.word_cn, subject: existing.subject, topic: existing.topic, reason: "existing" });
          continue;
        }

        if (existing) {
          await client.query(
            `UPDATE vocabulary_items SET
               word_cn=$1, pinyin=$2, word_vn=$3, word_en=$4, subject=$5, topic=$6,
               example_cn=$7, example_vn=$8, is_active=TRUE, is_premium=$9, vip_tier=$10,
               created_by=$11, updated_at=NOW()
             WHERE id=$12`,
            [
              w.word_cn,
              w.pinyin,
              w.word_vn,
              w.word_en,
              w.subject,
              w.topic,
              w.example_cn,
              w.example_vn,
              w.is_premium,
              w.vip_tier,
              req.user.id,
              existing.id,
            ],
          );
          reactivated++;
          existingMap.set(w.key, { ...existing, is_active: true });
          continue;
        }

        const result = await client.query(
          `INSERT INTO vocabulary_items (word_cn, pinyin, word_vn, word_en, subject, topic, example_cn, example_vn, is_premium, vip_tier, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (word_cn, subject) DO NOTHING
           RETURNING id`,
          [
            w.word_cn,
            w.pinyin,
            w.word_vn,
            w.word_en,
            w.subject,
            w.topic,
            w.example_cn,
            w.example_vn,
            w.is_premium,
            w.vip_tier,
            req.user.id,
          ],
        );
        if (result.rows.length > 0) {
          inserted++;
          existingMap.set(w.key, { id: result.rows[0].id, word_cn: w.word_cn, subject: w.subject, topic: w.topic, is_active: true });
        } else {
          duplicates.push({ line: w.line, word_cn: w.word_cn, subject: w.subject, reason: "conflict" });
        }
      }
      await client.query("COMMIT");
      UserActivity.log(req.user.id, 'admin.bulk_create_vocabulary', { count: inserted, reactivated, duplicates: duplicates.length, invalid: invalidRows.length, ip: req.ip, userAgent: req.headers['user-agent'] });
      res.json({
        success: true,
        data: {
          created: inserted,
          reactivated,
          skippedInvalid: invalidRows.length,
          skippedDuplicates: duplicates.length,
          invalidRows,
          duplicates: duplicates.slice(0, 50),
        },
        message: `Đã import ${inserted} từ, khôi phục ${reactivated}, bỏ qua ${duplicates.length} trùng và ${invalidRows.length} dòng lỗi`,
      });
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

// POST /api/vocabulary/record-learning
// Cập nhật tiến độ học từ vựng cho nhiệm vụ hằng ngày (learn_vocab)
exports.recordLearning = async (req, res) => {
  try {
    const userId = req.user.id;
    const { wordsCount = 1 } = req.body;
    
    // Update learn_vocab quest
    await db.query(
      `UPDATE user_quests 
       SET progress = LEAST(progress + $1, target)
       WHERE user_id = $2 AND quest_type = 'learn_vocab' AND date = CURRENT_DATE AND progress < target`,
      [wordsCount, userId]
    );

    res.json({ success: true, message: "Đã ghi nhận tiến độ học từ vựng" });
  } catch (error) {
    console.error("Record vocabulary learning error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

