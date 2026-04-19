const nodemailer = require('nodemailer');

/**
 * Email service for sending emails
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  /**
   * Send welcome email to new user
   * @param {string} email - User email
   * @param {string} name - User name
   */
  async sendWelcomeEmail(email, name) {
    try {
      // Skip if SMTP not configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('⚠️  SMTP not configured, skipping welcome email');
        return;
      }

      const mailOptions = {
        from: `"CSCA Platform" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🎉 Chào mừng bạn đến với CSCA!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              .feature { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 CSCA Platform</h1>
                <p>Hệ thống luyện thi học bổng Trung Quốc</p>
              </div>
              <div class="content">
                <h2>Xin chào ${name}! 👋</h2>
                <p>Chào mừng bạn đã tham gia <strong>CSCA Platform</strong> - nền tảng luyện thi đầu vào học bổng Trung Quốc hàng đầu!</p>
                
                <p>Chúng tôi rất vui khi có bạn trong cộng đồng học viên của mình. Dưới đây là những gì bạn có thể làm ngay:</p>
                
                <div class="feature">
                  <strong>📝 Làm đề thi thử</strong><br>
                  Hơn 10+ đề thi mô phỏng theo cấu trúc thật
                </div>
                
                <div class="feature">
                  <strong>📊 Theo dõi tiến độ</strong><br>
                  Xem thống kê chi tiết điểm số và độ chính xác
                </div>
                
                <div class="feature">
                  <strong>💬 Tham gia cộng đồng</strong><br>
                  Chia sẻ kinh nghiệm và học hỏi từ người khác
                </div>
                
                <div class="feature">
                  <strong>📚 Tài liệu học tập</strong><br>
                  Truy cập kho tài liệu phong phú và chất lượng
                </div>
                
                <center>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">
                    Bắt đầu học ngay →
                  </a>
                </center>
                
                <p style="margin-top: 30px;">Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!</p>
                
                <p>Chúc bạn học tập hiệu quả! 🚀</p>
                
                <p style="margin-top: 20px;">
                  Trân trọng,<br>
                  <strong>Đội ngũ CSCA Platform</strong>
                </p>
              </div>
              <div class="footer">
                <p>Email này được gửi tự động, vui lòng không trả lời.</p>
                <p>&copy; 2026 CSCA Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending welcome email:', error.message);
      // Don't throw error - email failure shouldn't block registration
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} resetUrl - Full reset URL with token
   */
  async sendPasswordResetEmail(email, resetUrl) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('⚠️  SMTP not configured, reset URL:', resetUrl);
        return;
      }

      const mailOptions = {
        from: `"CSCA Platform" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🔐 Đặt lại mật khẩu CSCA',
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; }
              .wrap { max-width: 560px; margin: 0 auto; padding: 24px; }
              .logo { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 24px; }
              .card { background: #f9f9f9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
              .btn { display: inline-block; padding: 14px 28px; background: #111827; color: #fff !important;
                     text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .note { font-size: 12px; color: #6b7280; margin-top: 20px; }
              .url { word-break: break-all; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <div class="logo">🎯 CSCA Platform</div>
              <div class="card">
                <h2 style="margin:0 0 12px; font-size:20px;">Đặt lại mật khẩu</h2>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này.</p>
                <p>Nhấn vào nút bên dưới để tạo mật khẩu mới. Liên kết này chỉ có hiệu lực trong <strong>15 phút</strong>.</p>
                <center><a href="${resetUrl}" class="btn">Đặt lại mật khẩu →</a></center>
                <p>Nếu nút không hoạt động, sao chép đường dẫn sau vào trình duyệt:</p>
                <p class="url">${resetUrl}</p>
                <p class="note">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending reset email:', error.message);
      throw error; // Rethrow so caller knows
    }
  }
  /**
   * Send email verification link to new user
   * @param {string} email - User email
   * @param {string} name - User name
   * @param {string} verifyUrl - Full verification URL with token
   */
  async sendVerificationEmail(email, name, verifyUrl) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('⚠️  SMTP not configured, verify URL:', verifyUrl);
        return;
      }

      const mailOptions = {
        from: `"CSCA Platform" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '✅ Xác nhận email đăng ký CSCA',
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; }
              .wrap { max-width: 560px; margin: 0 auto; padding: 24px; }
              .logo { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 24px; }
              .card { background: #f9f9f9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
              .btn { display: inline-block; padding: 14px 28px; background: #4F46E5; color: #fff !important;
                     text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .note { font-size: 12px; color: #6b7280; margin-top: 20px; }
              .url { word-break: break-all; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <div class="logo">🎯 CSCA Platform</div>
              <div class="card">
                <h2 style="margin:0 0 12px; font-size:20px;">Xác nhận email của bạn</h2>
                <p>Xin chào <strong>${name}</strong>, cảm ơn bạn đã đăng ký tài khoản CSCA!</p>
                <p>Nhấn vào nút bên dưới để xác nhận email. Liên kết có hiệu lực trong <strong>24 giờ</strong>.</p>
                <center><a href="${verifyUrl}" class="btn">Xác nhận email →</a></center>
                <p>Nếu nút không hoạt động, sao chép đường dẫn sau:</p>
                <p class="url">${verifyUrl}</p>
                <p class="note">Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending verification email:', error.message);
      // Don't throw — email failure shouldn't block registration
    }
  }
}

module.exports = new EmailService();
