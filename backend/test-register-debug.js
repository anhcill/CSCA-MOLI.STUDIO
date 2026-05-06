require("dotenv").config();
const express = require("express");
const http = require("http");
const app = express();

app.use(express.json());

// Mock authController.register with detailed logging
const register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;
    console.log("1. Received request:", { username, email, password, full_name });

    // Validate
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    console.log("2. Validation passed");

    // Check email exists
    const User = require("./src/models/User");
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "Email này đã được đăng ký" });
    }
    console.log("3. Email check passed");

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ success: false, message: "Tên đăng nhập đã được sử dụng" });
    }
    console.log("4. Username check passed");

    // Create user
    const user = await User.create({ username, email, password, full_name });
    console.log("5. User created:", user.id);

    // Generate verify token
    const crypto = require("crypto");
    const rawVerifyToken = crypto.randomBytes(32).toString("hex");
    console.log("6. Verify token generated");

    // Update user with verify token
    const db = require("./src/config/database");
    await db.query(
      "UPDATE users SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3",
      [rawVerifyToken, new Date(Date.now() + 24 * 60 * 60 * 1000), user.id],
    );
    console.log("7. Verify token saved");

    // Try sending emails
    const emailService = require("./src/services/emailService");
    console.log("8. Attempting to send welcome email...");
    await emailService.sendWelcomeEmail(email, user.full_name || username);
    console.log("9. Welcome email sent");

    console.log("10. Attempting to send verification email...");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawVerifyToken}&id=${user.id}`;
    await emailService.sendVerificationEmail(email, user.full_name || username, verifyUrl);
    console.log("11. Verification email sent");

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công!",
      userId: user.id
    });
  } catch (error) {
    console.error("ERROR:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({ success: false, message: "Đăng ký thất bại: " + error.message });
  }
};

app.post("/api/auth/register", register);

const server = app.listen(5001, () => {
  console.log("Test server running on port 5001");
  
  // Test the endpoint
  const http2 = require("http");
  const data = JSON.stringify({
    username: 'testserver99',
    email: 'testserver99@example.com',
    password: 'Test1234',
    full_name: 'Test Server'
  });

  const req = http2.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log("\n=== Response ===");
      console.log('Status:', res.statusCode);
      console.log('Body:', body);
      server.close();
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
    server.close();
  });

  req.write(data);
  req.end();
});
