require("dotenv").config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

function resolveSqlPath() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    return path.join(__dirname, '../../database/migrations/add_vip_features.sql');
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(__dirname, inputPath);
}

async function applyMigration() {
  try {
    const sqlPath = resolveSqlPath();
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log(`Đang chạy migration: ${sqlPath}`);
    await db.query(sql);
    console.log("Migration thành công!");
    
    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi chạy migration:", error);
    process.exit(1);
  }
}

applyMigration();
