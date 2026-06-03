const express = require('express');
const router = express.Router();
const { authenticate, authorizePermission } = require('../middleware/authMiddleware');
const AdminCouponController = require('../controllers/adminCouponController');

// All admin coupon routes require authentication + users.manage permission
router.use(authenticate);
router.use(authorizePermission('users.manage'));

router.get('/stats', AdminCouponController.getStats);
router.get('/promotions', AdminCouponController.getPromotions);
router.post('/promotions', AdminCouponController.createPromotion);
router.put('/promotions/:id', AdminCouponController.updatePromotion);
router.delete('/promotions/:id', AdminCouponController.deletePromotion);
router.get('/:id/usage', AdminCouponController.getUsage);
router.get('/', AdminCouponController.getAll);
router.post('/', AdminCouponController.create);
router.put('/:id', AdminCouponController.update);
router.delete('/:id', AdminCouponController.delete);

module.exports = router;
