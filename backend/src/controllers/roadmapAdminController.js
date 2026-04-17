const db = require("../config/database");

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

exports.getMilestones = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const params = [];
    let where = "";
    if (!includeInactive) {
      params.push(true);
      where = "WHERE is_active = $1";
    }

    const { rows } = await db.query(
      `SELECT
         id,
         title,
         description,
         min_attempts,
         min_avg_score,
         icon,
         color,
         sort_order,
         is_active,
         created_at,
         updated_at
       FROM roadmap_milestones
       ${where}
       ORDER BY sort_order ASC`,
      params,
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Get roadmap milestones error:", error);
    return res.status(500).json({ success: false, message: "Lỗi tải roadmap milestones" });
  }
};

exports.createMilestone = async (req, res) => {
  try {
    const {
      title,
      description,
      min_attempts,
      min_avg_score,
      icon,
      color,
      sort_order,
      is_active,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Thiếu title hoặc description",
      });
    }

    const parsedSortOrder = parseOptionalNumber(sort_order);
    if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 1) {
      return res.status(400).json({
        success: false,
        message: "sort_order phải là số nguyên dương",
      });
    }

    const parsedMinAttempts = parseOptionalNumber(min_attempts);
    const parsedMinAvgScore = parseOptionalNumber(min_avg_score);

    if (parsedMinAttempts !== undefined && parsedMinAttempts < 0) {
      return res.status(400).json({
        success: false,
        message: "min_attempts không hợp lệ",
      });
    }
    if (parsedMinAvgScore !== undefined && parsedMinAvgScore < 0) {
      return res.status(400).json({
        success: false,
        message: "min_avg_score không hợp lệ",
      });
    }

    const { rows } = await db.query(
      `INSERT INTO roadmap_milestones
       (title, description, min_attempts, min_avg_score, icon, color, sort_order, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        parsedMinAttempts ?? 0,
        parsedMinAvgScore ?? 0,
        icon || "FiTarget",
        color || "bg-indigo-500",
        parsedSortOrder,
        is_active !== false,
        req.user.id,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Tạo milestone thành công",
      data: rows[0],
    });
  } catch (error) {
    console.error("Create roadmap milestone error:", error);
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "sort_order đã tồn tại",
      });
    }
    return res.status(500).json({ success: false, message: "Lỗi tạo milestone" });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "title",
      "description",
      "min_attempts",
      "min_avg_score",
      "icon",
      "color",
      "sort_order",
      "is_active",
    ];

    const updates = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${index}`);
        if (field === "title" || field === "description") {
          values.push(String(req.body[field]).trim());
        } else {
          values.push(req.body[field]);
        }
        index++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có trường hợp lệ để cập nhật",
      });
    }

    updates.push(`updated_by = $${index}`);
    values.push(req.user.id);
    index++;

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const { rows } = await db.query(
      `UPDATE roadmap_milestones
       SET ${updates.join(", ")}
       WHERE id = $${index}
       RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy milestone" });
    }

    return res.json({
      success: true,
      message: "Cập nhật milestone thành công",
      data: rows[0],
    });
  } catch (error) {
    console.error("Update roadmap milestone error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "sort_order đã tồn tại" });
    }
    return res.status(500).json({ success: false, message: "Lỗi cập nhật milestone" });
  }
};

exports.deleteMilestone = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE roadmap_milestones
       SET is_active = FALSE,
           updated_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id`,
      [req.user.id, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy milestone" });
    }

    return res.json({ success: true, message: "Đã ẩn milestone" });
  } catch (error) {
    console.error("Delete roadmap milestone error:", error);
    return res.status(500).json({ success: false, message: "Lỗi xóa milestone" });
  }
};
