const axios = require('axios');

/**
 * Email Service — Brevo (Sendinblue) SMTP
 * Sender: cloudlystudio05@gmail.com
 * API Key: xkeysib-...
 */
class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.senderEmail = process.env.EMAIL_SENDER || 'cloudlystudio05@gmail.com';
    this.senderName = process.env.EMAIL_SENDER_NAME || 'CSCA Platform';
    this.baseUrl = 'https://api.brevo.com/v3';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  // ─── Core sender ────────────────────────────────────────────────────────────
  async _send({ to, subject, html, text }) {
    if (!this.apiKey) {
      console.warn('⚠️ BREVO_API_KEY not configured, email skipped:', subject);
      return;
    }
    try {
      await this.client.post('/smtp/email', {
        sender: { email: this.senderEmail, name: this.senderName },
        to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || subject,
      });
      console.log(`✅ Email sent: "${subject}" → ${Array.isArray(to) ? to.join(', ') : to}`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      console.error(`❌ Email failed: "${subject}" — ${msg}`);
    }
  }

  // ─── Shared HTML wrapper ────────────────────────────────────────────────────
  _wrapper({ title, emoji, content }) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 40px;text-align:center">
      <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,.2);border-radius:14px;line-height:56px;font-size:28px;margin-bottom:12px">${emoji}</div>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px">CSCA Platform</h1>
      <p style="color:rgba(255,255,255,.75);font-size:13px;margin:6px 0 0">${title}</p>
    </div>
    <!-- Body -->
    <div style="padding:36px 40px;font-size:15px;line-height:1.7;color:#333">
      ${content}
    </div>
    <!-- Footer -->
    <div style="padding:24px 40px;background:#f9f9f9;border-top:1px solid #eee;text-align:center">
      <p style="margin:0 0 4px;color:#999;font-size:12px">Email này được gửi tự động từ CSCA Platform.</p>
      <p style="margin:0;color:#999;font-size:12px">© 2026 CSCA Platform. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Mail xác nhận đăng ký + chào mừng
  // ─────────────────────────────────────────────────────────────────────────────
  async sendWelcomeEmail(email, name) {
    const content = `
      <h2 style="margin:0 0 16px;font-size:20px">Xin chào <strong style="color:#667eea">${name}</strong>! 👋</h2>
      <p style="margin:0 0 20px">Chào mừng bạn đến với <strong>CSCA Platform</strong> — nền tảng luyện thi học bổng Trung Quốc hàng đầu!</p>
      <p style="margin:0 0 24px">Cảm ơn bạn đã đăng ký. Dưới đây là những gì bạn có thể làm ngay:</p>
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin:0 0 24px">
        <div style="margin:0 0 12px"><strong>📝</strong> Làm đề thi thử — Hơn 500+ đề mô phỏng chuẩn cấu trúc thật</div>
        <div style="margin:0 0 12px"><strong>📊</strong> Theo dõi tiến độ — Thống kê chi tiết điểm số &amp; độ chính xác</div>
        <div style="margin:0 0 12px"><strong>💬</strong> Tham gia cộng đồng — Chia sẻ kinh nghiệm &amp; học hỏi từ người khác</div>
        <div style="margin:0"><strong>📚</strong> Tài liệu học tập — Kho tài liệu phong phú &amp; chất lượng</div>
      </div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:14px 32px;background:#667eea;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Bắt đầu học ngay →</a>`;

    await this._send({
      to: email,
      subject: '🎉 Chào mừng bạn đến với CSCA Platform!',
      html: this._wrapper({ title: 'Chào mừng thành viên mới', emoji: '🎓', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Mail xác nhận thanh toán (QUAN TRỌNG)
  // ─────────────────────────────────────────────────────────────────────────────
  async sendPaymentConfirmation({ email, name, packageName, amount, durationDays, transactionCode, method }) {
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    const methodLabel = { momo: 'MoMo', vnpay: 'VNPay', bank_transfer: 'Chuyển khoản ngân hàng', manual: 'Thủ công' }[method] || method;

    const content = `
      <div style="background:#f0f4ff;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">💳</div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#333">Thanh toán thành công!</h2>
        <p style="margin:0;font-size:14px;color:#666">Mã giao dịch: <strong>${transactionCode}</strong></p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">Gói dịch vụ</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:14px">${packageName}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">Thời hạn</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${durationDays} ngày</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">Phương thức</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${methodLabel}</td></tr>
        <tr><td style="padding:12px 0;color:#666;font-size:15px;font-weight:600">Số tiền</td><td style="padding:12px 0;text-align:right;font-size:20px;font-weight:800;color:#16a34a">${formattedAmount}</td></tr>
      </table>
      <p style="background:#fef9c3;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#713f12">🎉 <strong>Tài khoản VIP của bạn đã được kích hoạt!</strong> Bạn có thể tận hưởng toàn bộ tính năng cao cấp ngay bây giờ.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:14px 32px;background:#667eea;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Khám phá CSCA ngay →</a>`;

    await this._send({
      to: email,
      subject: `💳 Xác nhận thanh toán CSCA — ${packageName}`,
      html: this._wrapper({ title: 'Xác nhận thanh toán', emoji: '💳', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Mail OTP (2FA) — đăng nhập / đổi mật khẩu
  // ─────────────────────────────────────────────────────────────────────────────
  async sendOtpEmail({ email, name, otp, reason }) {
    const reasonLabel = reason === 'login' ? 'đăng nhập' : reason === 'password_change' ? 'thay đổi mật khẩu' : 'xác thực';

    const content = `
      <h2 style="margin:0 0 20px;font-size:20px">Mã xác thực của bạn</h2>
      <p style="margin:0 0 24px">Chúng tôi nhận được yêu cầu ${reasonLabel} cho tài khoản liên kết với email này.</p>
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;padding:32px;text-align:center;margin:0 0 24px">
        <p style="margin:0 0 8px;color:rgba(255,255,255,.75);font-size:13px;text-transform:uppercase;letter-spacing:1px">Mã OTP</p>
        <p style="margin:0;font-size:40px;font-weight:900;color:#fff;letter-spacing:8px;font-family:monospace">${otp}</p>
        <p style="margin:16px 0 0;color:rgba(255,255,255,.65);font-size:12px">Mã có hiệu lực trong <strong>5 phút</strong>. Không chia sẻ mã này cho ai.</p>
      </div>
      <p style="background:#fee2e2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;margin:0;font-size:14px;color:#991b1b">⚠️ Nếu bạn <strong>không</strong> yêu cầu mã này, ai đó có thể đang cố truy cập tài khoản của bạn. Vui lòng <strong>không</strong> chia sẻ mã và đổi mật khẩu ngay.</p>`;

    await this._send({
      to: email,
      subject: `🔐 Mã OTP CSCA — ${otp}`,
      html: this._wrapper({ title: `Mã xác thực (${reasonLabel})`, emoji: '🔐', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Mail reset mật khẩu
  // ─────────────────────────────────────────────────────────────────────────────
  async sendPasswordResetEmail(email, resetUrl) {
    const content = `
      <h2 style="margin:0 0 20px;font-size:20px">Đặt lại mật khẩu</h2>
      <p style="margin:0 0 16px">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.</p>
      <p style="margin:0 0 24px">Nhấn vào nút bên dưới để tạo mật khẩu mới. Liên kết này chỉ có hiệu lực trong <strong style="color:#ef4444">15 phút</strong>.</p>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${resetUrl}" style="display:inline-block;padding:16px 36px;background:#111827;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Đặt lại mật khẩu →</a>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#666">Nếu nút không hoạt động, sao chép đường dẫn sau vào trình duyệt:</p>
      <p style="margin:0 0 24px;word-break:break-all;background:#f4f4f8;padding:12px 16px;border-radius:8px;font-size:12px;color:#666">${resetUrl}</p>
      <p style="background:#fef9c3;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:14px 18px;margin:0;font-size:14px;color:#713f12">⏰ Liên kết đặt lại sẽ hết hạn sau 15 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>`;

    await this._send({
      to: email,
      subject: '🔐 Đặt lại mật khẩu CSCA Platform',
      html: this._wrapper({ title: 'Đặt lại mật khẩu', emoji: '🔐', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Mail nhắc hết hạn VIP (2-3 ngày trước)
  // ─────────────────────────────────────────────────────────────────────────────
  async sendVipExpirationReminder({ email, name, daysLeft, expiresAt }) {
    const formattedDate = new Date(expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

    const content = `
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-size:48px;margin-bottom:12px">⏰</div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff">Tài khoản VIP sắp hết hạn!</h2>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,.85)">Còn <strong>${daysLeft} ngày</strong> nữa là VIP của bạn hết hạn.</p>
      </div>
      <p style="margin:0 0 16px">Xin chào <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px">Tài khoản VIP của bạn sẽ hết hạn vào ngày <strong>${formattedDate}</strong>. Đừng để gián đoạn quá trình học tập của bạn!</p>
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin:0 0 24px">
        <p style="margin:0 0 12px;font-weight:700;color:#333">🎁 Quyền lợi VIP của bạn:</p>
        <div style="margin:0 0 8px;font-size:14px">✓ Truy cập toàn bộ đề thi cao cấp</div>
        <div style="margin:0 0 8px;font-size:14px">✓ Phân tích AI chi tiết từng câu trả lời</div>
        <div style="margin:0 0 8px;font-size:14px">✓ Không giới hạn luyện tập</div>
        <div style="margin:0;font-size:14px">✓ Hỗ trợ ưu tiên từ đội ngũ CSCA</div>
      </div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/vip" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Gia hạn ngay →</a>`;

    await this._send({
      to: email,
      subject: `⏰ [Nhắc nhở] Tài khoản VIP CSCA sắp hết hạn — Còn ${daysLeft} ngày!`,
      html: this._wrapper({ title: `VIP sắp hết hạn — Còn ${daysLeft} ngày`, emoji: '⏰', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Mail kích hoạt VIP thành công
  // ─────────────────────────────────────────────────────────────────────────────
  async sendVipActivatedEmail({ email, name, packageName, durationDays, expiresAt }) {
    const formattedDate = new Date(expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

    const content = `
      <div style="background:linear-gradient(135deg,#16a34a 0%,#059669 100%);border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <h2 style="margin:0 0 8px;font-size:22px;color:#fff">Bạn đã trở thành VIP!</h2>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,.85)">Chúc mừng bạn — ${packageName}</p>
      </div>
      <p style="margin:0 0 16px">Xin chào <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px">Cảm ơn bạn đã tin tưởng và lựa chọn CSCA Platform! Tài khoản VIP của bạn đã được kích hoạt thành công.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">Gói VIP</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:14px">${packageName}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">Thời hạn</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${durationDays} ngày</td></tr>
        <tr><td style="padding:10px 0;color:#666;font-size:14px">Hết hạn</td><td style="padding:10px 0;text-align:right;font-size:14px">${formattedDate}</td></tr>
      </table>
      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:0 0 24px">
        <p style="margin:0 0 12px;font-weight:700;color:#15803d">🌟 Quyền lợi VIP bạn nhận được:</p>
        <div style="margin:0 0 8px;font-size:14px;color:#166534">✓ Truy cập 500+ đề thi mô phỏng thực tế</div>
        <div style="margin:0 0 8px;font-size:14px;color:#166534">✓ Phân tích chi tiết từng câu trả lời bằng AI</div>
        <div style="margin:0 0 8px;font-size:14px;color:#166534">✓ Lộ trình học tập cá nhân hoá</div>
        <div style="margin:0 0 8px;font-size:14px;color:#166534">✓ Diễn đàn Hỏi-Đáp VIP ưu tiên</div>
        <div style="margin:0;font-size:14px;color:#166534">✓ Không giới hạn luyện tập mọi lúc</div>
      </div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Bắt đầu học VIP ngay →</a>`;

    await this._send({
      to: email,
      subject: `🎉 Chúc mừng ${name} — Bạn đã là VIP CSCA!`,
      html: this._wrapper({ title: 'Kích hoạt VIP thành công', emoji: '🎉', content }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Mail cảnh báo bảo mật (login từ IP lạ / đổi mật khẩu)
  // ─────────────────────────────────────────────────────────────────────────────
  async sendSecurityAlert({ email, name, event, ip, location, device, time }) {
    const eventLabel = {
      login: 'Đăng nhập từ thiết bị mới',
      password_change: 'Mật khẩu vừa được thay đổi',
      suspicious: 'Hoạt động đáng ngờ',
    }[event] || 'Thông báo bảo mật';

    const eventEmoji = event === 'login' ? '🔔' : event === 'password_change' ? '🔑' : '🚨';
    const bgGradient = event === 'login' ? 'linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)'
      : event === 'password_change' ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
      : 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)';

    const content = `
      <div style="background:${bgGradient.replace('background:', '')};border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-size:48px;margin-bottom:12px">${eventEmoji}</div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff">${eventLabel}</h2>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,.85)">CSCA Platform — Thông báo bảo mật tài khoản</p>
      </div>
      <p style="margin:0 0 16px">Xin chào <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px">Chúng tôi phát hiện một hoạt động trên tài khoản của bạn:</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">⏰ Thời gian</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${time}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">🌐 Địa chỉ IP</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;font-family:monospace">${ip}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#666;font-size:14px">📍 Vị trí</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${location || 'Không xác định'}</td></tr>
        <tr><td style="padding:10px 0;color:#666;font-size:14px">💻 Thiết bị</td><td style="padding:10px 0;text-align:right;font-size:14px">${device || 'Không xác định'}</td></tr>
      </table>
      ${event === 'suspicious' ? `
      <p style="background:#fee2e2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#991b1b">🚨 Nếu đây <strong>không phải</strong> là bạn, hãy <strong>đổi mật khẩu ngay</strong> và liên hệ hỗ trợ.</p>` : ''}
      ${event === 'login' ? `
      <p style="background:#dbeafe;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#1e40af">💡 Nếu đây <strong>là bạn</strong> — có thể bỏ qua email này.<br>Nếu <strong>không phải bạn</strong> — hãy đổi mật khẩu ngay và liên hệ hỗ trợ.</p>` : ''}
      <div style="text-align:center;margin:0 0 24px">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile" style="display:inline-block;padding:14px 32px;background:#1f2937;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;font-size:15px">Kiểm tra tài khoản →</a>
      </div>
      <p style="margin:0;font-size:13px;color:#999">📧 Email này được gửi tự động bởi CSCA Platform. Nếu có thắc mắc, hãy liên hệ cloudlystudio05@gmail.com</p>`;

    await this._send({
      to: email,
      subject: `🔐 [Bảo mật] ${eventLabel} — CSCA Platform`,
      html: this._wrapper({ title: 'Thông báo bảo mật', emoji: '🔐', content }),
    });
  }
}

module.exports = new EmailService();
