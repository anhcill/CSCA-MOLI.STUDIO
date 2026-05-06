require("dotenv").config();
const db = require("./src/config/database");

async function checkAndFix() {
  console.log("=== Check user_sessions table ===\n");

  // 1. Kiểm tra constraints trên bảng user_sessions
  try {
    const constraints = await db.query(`
      SELECT constraint_name, column_name 
      FROM information_schema.key_column_usage 
      WHERE table_name = 'user_sessions'
    `);
    console.log("Constraints on user_sessions:");
    constraints.rows.forEach(c => {
      console.log(`  - ${c.constraint_name}: ${c.column_name}`);
    });

    // Kiểm tra có unique constraint trên jti chưa
    const hasJtiUnique = constraints.rows.some(c => c.column_name === 'jti' && c.constraint_name.includes('unique'));
    console.log("\nHas unique on jti:", hasJtiUnique);

    if (!hasJtiUnique) {
      console.log("\n⚠️ Missing UNIQUE constraint on jti! Adding...");
      try {
        // Thử add constraint
        await db.query(`
          ALTER TABLE user_sessions 
          ADD CONSTRAINT user_sessions_jti_unique UNIQUE (jti)
        `);
        console.log("✅ Added unique constraint on jti");
      } catch (err) {
        if (err.code === '42710' || err.code === '23505') {
          console.log("✅ Constraint already exists (or duplicate jti values exist)");
        } else if (err.code === '23505') {
          console.log("⚠️ Cannot add unique constraint - there are duplicate jti values");
          // Check for duplicates
          const dupes = await db.query(`
            SELECT jti, COUNT(*) as cnt 
            FROM user_sessions 
            GROUP BY jti 
            HAVING COUNT(*) > 1
          `);
          console.log("Duplicate jti values:", dupes.rows);
        } else {
          console.error("❌ Error adding constraint:", err.message);
        }
      }
    }
  } catch (err) {
    console.error("Error checking constraints:", err.message);
  }

  // 2. Kiểm tra columns của user_sessions
  try {
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' 
      ORDER BY ordinal_position
    `);
    console.log("\nColumns in user_sessions:");
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  } catch (err) {
    console.error("Error checking columns:", err.message);
  }

  // 3. Test DeviceSessionService.registerSession
  console.log("\n=== Test DeviceSessionService.registerSession ===");
  try {
    const DeviceSessionService = require("./src/services/deviceSessionService");
    
    const testSession = {
      userId: 1,
      jti: 'test-jti-' + Date.now(),
      deviceInfo: 'Test Device',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    await DeviceSessionService.registerSession(testSession);
    console.log("✅ registerSession succeeded");
  } catch (err) {
    console.error("❌ registerSession error:", err.message);
    console.error("   Code:", err.code);
    if (err.detail) console.error("   Detail:", err.detail);
  }

  console.log("\n=== Done ===");
  await db.pool.end();
}

checkAndFix().catch(console.error);
