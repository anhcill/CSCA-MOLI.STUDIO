const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const CouponController = require('../controllers/couponController');

// Active promotion banner (public)
router.get('/promotion', CouponController.getActivePromotion);

// Validate coupon (public)
router.get('/validate', CouponController.validate);

// Apply coupon (authenticated)
router.post('/apply', authenticate, CouponController.apply);

module.exports = router;
