require("dotenv").config();
const User = require("./src/models/User");

async function testFullRegister() {
  console.log("=== Test Full Register ===\n");

  // Test 1: Thử tạo user giống như authController
  const testData = {
    username: 'testfull99',
    email: 'testfull99@example.com',
    password: 'Test1234',
    full_name: 'Test Full'
  };

  try {
    console.log("1. Đang tạo user...");
    const user = await User.create(testData);
    console.log("✅ User created:", {
      id: user.id,
      username: user.username,
      email: user.email
    });

    console.log("\n2. Đang tìm user theo email...");
    const found = await User.findByEmail(testData.email);
    console.log("✅ User found:", found ? found.username : 'NOT FOUND');

    console.log("\n3. Đang so sánh password...");
    const match = await User.comparePassword(testData.password, found.password);
    console.log("✅ Password match:", match);

  } catch (err) {
    console.error("❌ Error during test:", err.message);
    console.error("   Stack:", err.stack);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

testFullRegister().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
