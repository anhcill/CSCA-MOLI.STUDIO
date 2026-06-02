const express = require('express');
const rateLimit = require('express-rate-limit');
const emailService = require('../services/emailService');

const router = express.Router();

const CONTACT_RECIPIENT = process.env.CONTACT_RECIPIENT_EMAIL || 'ducanhle28072003@gmail.com';

const contactLimiter = rateLimit({
  windowMs: Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.CONTACT_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau.',
  },
});

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const clean = (value, max) => String(value || '').trim().slice(0, max);

router.post('/', contactLimiter, async (req, res) => {
  try {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 160);
    const phone = clean(req.body.phone, 40);
    const subject = clean(req.body.subject, 160) || 'Liên hệ từ website';
    const message = clean(req.body.message, 4000);
    const honeypot = clean(req.body.website, 200);

    if (honeypot) {
      return res.status(200).json({ success: true, message: 'Đã nhận tin nhắn.' });
    }

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập họ tên, email và nội dung tin nhắn.',
      });
    }

    if (!isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    }

    await emailService.sendContactMessage({
      to: CONTACT_RECIPIENT,
      name,
      email,
      phone,
      subject,
      message,
    });

    res.json({ success: true, message: 'Đã gửi tin nhắn liên hệ.' });
  } catch (error) {
    console.error('Contact form email error:', error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Không gửi được tin nhắn. Vui lòng thử lại sau.',
    });
  }
});

module.exports = router;
