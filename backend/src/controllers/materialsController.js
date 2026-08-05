const db = require("../config/database");
const { checkVipAccess } = require("../middleware/authMiddleware");
const UserActivity = require("../models/UserActivity");
const { prepareMaterialContent } = require("../services/materialContentService");

const normalizeAllDisplayOrder = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999999) return undefined;
  return parsed;
};

// GET /api/materials?category=cau-truc-de&subject=toan&topic=...&limit=20&offset=0
exports.getMaterials = async (req, res) => {
  try {
    const { category, subject, topic } = req.query;
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;

    let query =
      "SELECT * FROM materials WHERE (is_active IS NULL OR is_active = TRUE)";
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (subject) {
      params.push(subject);
      query += ` AND subject = $${params.length}`;
    }
    if (topic) {
      params.push(topic);
      query += ` AND topic = $${params.length}`;
    }
    query += category || subject || topic
      ? " ORDER BY subject, topic, created_at DESC"
      : " ORDER BY all_display_order ASC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC";
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { limit, offset, count: result.rows.length },
    });
  } catch (error) {
    console.error("Get materials error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// POST /api/materials (admin only)
exports.createMaterial = async (req, res) => {
  try {
    const {
      title,
      description,
      file_url,
      file_type = "pdf",
      category,
      subject,
      topic,
      is_premium,
      content_text,
      content_html,
      content_meta,
      all_display_order,
    } = req.body;

    const normalizedAllDisplayOrder = normalizeAllDisplayOrder(all_display_order);
    if (normalizedAllDisplayOrder === undefined) {
      return res.status(400).json({
        success: false,
        message: "Thứ tự ở mục Tất cả phải là số nguyên từ 1 đến 999999",
      });
    }

    const preparedContent = prepareMaterialContent({
      content_text,
      content_html,
      content_meta,
      file_type,
    });
    const normalizedFileUrl = String(file_url || "").trim();
    const imageItems = Array.isArray(preparedContent.contentMeta?.images)
      ? preparedContent.contentMeta.images.filter((item) => item && item.url)
      : [];
    const hasImageContent = imageItems.length > 0;

    if (!title || !category || (!normalizedFileUrl && !preparedContent.contentHtml && !hasImageContent)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (title, category, file_url hoặc nội dung web)",
      });
    }

    const result = await db.query(
      `INSERT INTO materials (
         title, description, file_url, file_type, category, subject, topic,
         uploaded_by, is_active, is_premium, content_text, content_html, content_source, content_meta,
         all_display_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11, $12, $13::jsonb, $14)
       RETURNING *`,
      [
        title,
        description,
        normalizedFileUrl,
        file_type,
        category,
        subject,
        topic || null,
        req.user.id,
        is_premium === true,
        preparedContent.contentText,
        preparedContent.contentHtml,
        (hasImageContent ? "image_gallery" : preparedContent.contentSource),
        JSON.stringify(preparedContent.contentMeta),
        normalizedAllDisplayOrder,
      ],
    );

    UserActivity.log(req.user.id, 'admin.create_material', { materialId: result.rows[0].id, title, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Tạo tài liệu thành công",
    });
  } catch (error) {
    console.error("Create material error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// PUT /api/materials/:id (admin only)
exports.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      file_url,
      category,
      subject,
      topic,
      is_active,
      is_premium,
      content_text,
      content_html,
      content_meta,
      all_display_order,
    } = req.body;

    const normalizedAllDisplayOrder = normalizeAllDisplayOrder(all_display_order);
    if (normalizedAllDisplayOrder === undefined) {
      return res.status(400).json({
        success: false,
        message: "Thứ tự ở mục Tất cả phải là số nguyên từ 1 đến 999999",
      });
    }

    const preparedContent = prepareMaterialContent({
      content_text,
      content_html,
      content_meta,
      file_type: req.body.file_type || "pdf",
    });
    const normalizedFileUrl = String(file_url || "").trim();
    const imageItems = Array.isArray(preparedContent.contentMeta?.images)
      ? preparedContent.contentMeta.images.filter((item) => item && item.url)
      : [];
    const hasImageContent = imageItems.length > 0;

    if (!title || !category || (!normalizedFileUrl && !preparedContent.contentHtml && !hasImageContent)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (title, category, file_url hoặc nội dung web)",
      });
    }

    const result = await db.query(
      `UPDATE materials SET
         title=$1, description=$2, file_url=$3, category=$4, subject=$5, topic=$6,
         is_active=$7, is_premium=$8, content_text=$9, content_html=$10,
         content_source=$11, content_meta=$12::jsonb, all_display_order=$13,
         updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        title,
        description,
        normalizedFileUrl,
        category,
        subject,
        topic || null,
        is_active !== false,
        is_premium === true ? true : null,
        preparedContent.contentText,
        preparedContent.contentHtml,
        (hasImageContent ? "image_gallery" : preparedContent.contentSource),
        JSON.stringify(preparedContent.contentMeta),
        normalizedAllDisplayOrder,
        id,
      ],
    );

    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài liệu" });
        
    UserActivity.log(req.user.id, 'admin.update_material', { materialId: id, updates: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Update material error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/materials/:id (admin only)
exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE materials SET is_active = FALSE WHERE id = $1", [
      id,
    ]);
    UserActivity.log(req.user.id, 'admin.delete_material', { materialId: id, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (error) {
    console.error("Delete material error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
