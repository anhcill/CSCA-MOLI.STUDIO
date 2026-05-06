require("dotenv").config();
const db = require("./src/config/database");

async function checkExamAttempts() {
  console.log("=== Check exam_attempts table ===\n");

  try {
    // Kiểm tra columns
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'exam_attempts' 
      ORDER BY ordinal_position
    `);
    
    console.log("Columns in exam_attempts:");
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Kiểm tra có started_at không
    const hasStartedAt = columns.rows.some(c => c.column_name === 'started_at');
    
    if (!hasStartedAt) {
      console.log("\n⚠️ Cột started_at không tồn tại! Thêm vào...");
      
      // Thêm cột started_at
      await db.query(`
        ALTER TABLE exam_attempts 
        ADD COLUMN started_at TIMESTAMP WITH TIME ZONE 
        DEFAULT NOW()
      `);
      console.log("✅ Đã thêm cột started_at");
    }

    // Thử query lại
    const result = await db.query(`
      SELECT ea.id, ea.started_at, ea.submitted_at 
      FROM exam_attempts ea 
      LIMIT 1
    `);
    console.log("\n✅ Query thành công:", result.rows[0] || 'No rows');

  } catch (err) {
    console.error("Error:", err.message);
  }

  console.log("\n=== Done ===");
  await db.pool.end();
}

checkExamAttempts().catch(console.error);
