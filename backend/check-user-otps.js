require("dotenv").config();
const db = require("./src/config/database");

async function checkUserOtps() {
  console.log("=== Check user_otps table ===\n");

  try {
    // Kiểm tra bảng có tồn tại không
    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'user_otps'
    `);
    
    if (tables.rows.length === 0) {
      console.log("❌ Bảng user_otps không tồn tại! Cần tạo.");
      
      // Tạo bảng
      await db.query(`
        CREATE TABLE user_otps (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          email VARCHAR(255) NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          reason VARCHAR(50) NOT NULL DEFAULT 'login',
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, reason)
        )
      `);
      console.log("✅ Đã tạo bảng user_otps");
    } else {
      console.log("✅ Bảng user_otps đã tồn tại");
    }

    // Kiểm tra columns
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_otps' 
      ORDER BY ordinal_position
    `);
    console.log("\nColumns in user_otps:");
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (err) {
    console.error("Error:", err.message);
  }

  console.log("\n=== Done ===");
  await db.pool.end();
}

checkUserOtps().catch(console.error);
