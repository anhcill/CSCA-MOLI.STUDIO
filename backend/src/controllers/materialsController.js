const db = require("../config/database");
const { checkVipAccess } = require("../middleware/authMiddleware");

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
    query += " ORDER BY subject, topic, created_at DESC";
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
    } = req.body;

    if (!title || !file_url || !category) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (title, file_url, category)",
      });
    }

    const result = await db.query(
      `INSERT INTO materials (title, description, file_url, file_type, category, subject, topic, uploaded_by, is_active, is_premium)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9) RETURNING *`,
      [
        title,
        description,
        file_url,
        file_type,
        category,
        subject,
        topic || null,
        req.user.id,
        is_premium === true,
      ],
    );

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
    } = req.body;

    const result = await db.query(
      `UPDATE materials SET title=$1, description=$2, file_url=$3, category=$4, subject=$5, topic=$6, is_active=$7, is_premium=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        title,
        description,
        file_url,
        category,
        subject,
        topic || null,
        is_active !== false,
        is_premium === true ? true : null,
        id,
      ],
    );

    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài liệu" });
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
    res.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (error) {
    console.error("Delete material error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
