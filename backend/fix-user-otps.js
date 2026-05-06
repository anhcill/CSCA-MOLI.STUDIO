require("dotenv").config();
const db = require("./src/config/database");

async function fixUserOtps() {
  console.log("=== Fix user_otps unique constraint ===\n");

  try {
    // Kiểm tra constraints hiện tại
    const constraints = await db.query(`
      SELECT constraint_name 
      FROM information_schema.key_column_usage 
      WHERE table_name = 'user_otps'
    `);
    console.log("Current constraints:", constraints.rows.map(r => r.constraint_name));

    // Thêm unique constraint
    await db.query(`
      ALTER TABLE user_otps 
      ADD CONSTRAINT user_otps_user_reason_unique UNIQUE (user_id, reason)
    `);
    console.log("✅ Added unique constraint on (user_id, reason)");

  } catch (err) {
    if (err.code === '42710' || err.message.includes('already exists')) {
      console.log("✅ Constraint already exists");
    } else {
      console.error("❌ Error:", err.message);
    }
  }

  // Kiểm tra lại login
  console.log("\n=== Test Login ===");
  try {
    const User = require("./src/models/User");
    const user = await User.findByEmail('user2026test@example.com');
    console.log("User found:", user ? user.username : 'NOT FOUND');
    
    if (user) {
      const match = await User.comparePassword('Test1234', user.password);
      console.log("Password match:", match);
    }
  } catch (err) {
    console.error("Login test error:", err.message);
  }

  console.log("\n=== Done ===");
  await db.pool.end();
}

fixUserOtps().catch(console.error);
