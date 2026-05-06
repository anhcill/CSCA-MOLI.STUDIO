require("dotenv").config();
const db = require("./src/config/database");

async function testRegister() {
  console.log("=== Test Register ===");
  
  // Test 1: Kiểm tra database connection
  try {
    const testDb = await db.query("SELECT NOW()");
    console.log("✅ Database connected:", testDb.rows[0].now);
  } catch (err) {
    console.error("❌ Database error:", err.message);
    return;
  }

  // Test 2: Kiểm tra bảng users
  try {
    const tables = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    console.log("\n✅ Users table columns:");
    tables.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  } catch (err) {
    console.error("❌ Error checking users table:", err.message);
  }

  // Test 3: Thử tạo user trực tiếp
  try {
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash("Test1234", 12);
    
    const result = await db.query(`
      INSERT INTO users (username, email, password, full_name, role, avatar, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, username, email
    `, ['testdirect99', 'testdirect99@example.com', hashedPassword, 'Test Direct', 'student', 'https://ui-avatars.com/api/?name=Test']);
    
    console.log("\n✅ Direct insert successful:", result.rows[0]);
  } catch (err) {
    console.error("❌ Direct insert error:", err.message);
    if (err.code) console.error("   Error code:", err.code);
    if (err.constraint) console.error("   Constraint:", err.constraint);
  }

  // Test 4: Kiểm tra bảng user_stats
  try {
    await db.query("SELECT 1 FROM user_stats LIMIT 1");
    console.log("\n✅ user_stats table exists");
  } catch (err) {
    console.error("❌ user_stats table error:", err.message);
  }

  // Test 5: Kiểm tra user_sessions
  try {
    await db.query("SELECT 1 FROM user_sessions LIMIT 1");
    console.log("✅ user_sessions table exists");
  } catch (err) {
    console.error("❌ user_sessions table error:", err.message);
  }

  console.log("\n=== Done ===");
  await db.pool.end();
}

testRegister().catch(console.error);
