const fs = require("fs/promises");
const path = require("path");
const UserActivity = require("../models/UserActivity");
const databaseBackupService = require("../services/databaseBackupService");

async function getStatus(req, res) {
  try {
    const data = await databaseBackupService.getStatus();
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Database backup] Status error:", error.message);
    res.status(500).json({ success: false, message: "Không thể đọc thư mục sao lưu." });
  }
}

async function create(req, res) {
  try {
    const backup = await databaseBackupService.createBackup();
    await UserActivity.log(req.user.id, "database_backup_created", {
      fileName: backup.fileName,
      size: backup.size,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(201).json({
      success: true,
      message: "Đã sao lưu dữ liệu thành công.",
      data: backup,
    });
  } catch (error) {
    console.error("[Database backup] Create error:", error.message);
    const status = error.code === "BACKUP_IN_PROGRESS" ? 409 : 500;
    res.status(status).json({ success: false, message: error.message || "Không thể tạo bản sao lưu." });
  }
}

async function download(req, res) {
  const filePath = databaseBackupService.getBackupFilePath(req.params.fileName);
  if (!filePath) {
    return res.status(400).json({ success: false, message: "Tên file sao lưu không hợp lệ." });
  }

  try {
    await fs.access(filePath);
    return res.download(filePath, path.basename(filePath));
  } catch {
    return res.status(404).json({ success: false, message: "Không tìm thấy file sao lưu." });
  }
}

async function remove(req, res) {
  try {
    const backup = await databaseBackupService.deleteBackup(req.params.fileName);
    await UserActivity.log(req.user.id, "database_backup_deleted", {
      fileName: backup.fileName,
      size: backup.size,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    return res.json({
      success: true,
      message: "Đã xóa bản sao lưu khỏi máy chủ.",
      data: backup,
    });
  } catch (error) {
    console.error("[Database backup] Delete error:", error.message);
    const status = error.code === "INVALID_BACKUP_FILE"
      ? 400
      : error.code === "BACKUP_NOT_FOUND"
        ? 404
        : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Không thể xóa bản sao lưu.",
    });
  }
}

module.exports = { getStatus, create, download, remove };
