const express = require('express');
const rateLimit = require('express-rate-limit');
const emailPreferenceController = require('../controllers/emailPreferenceController');

const router = express.Router();

router.post('/brevo-events', emailPreferenceController.brevoEvents);

const unsubscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  },
});

router.post(
  '/unsubscribe/:token',
  unsubscribeLimiter,
  emailPreferenceController.unsubscribe,
);

module.exports = router;
