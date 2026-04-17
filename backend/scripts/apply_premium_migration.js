require("dotenv").config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, '../../database/migrations/add_premium_content.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Đang chạy migration thêm cột is_premium cho exams và materials...");
    await db.query(sql);
    console.log("Migration thành công!");

    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi chạy migration:", error);
    process.exit(1);
  }
}

applyMigration();
