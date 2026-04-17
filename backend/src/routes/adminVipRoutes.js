const express = require('express');
const router = express.Router();
const { authenticate, authorizePermission } = require('../middleware/authMiddleware');
const AdminVipController = require('../controllers/adminVipController');

// Tất cả route yêu cầu đăng nhập + quyền users.manage
router.use(authenticate);
router.use(authorizePermission('users.manage'));

// Stats overview
router.get('/stats', AdminVipController.getStats);

// VIP users
router.get('/users', AdminVipController.getVipUsers);
router.post('/users/:userId/grant', AdminVipController.grantVip);
router.post('/users/:userId/revoke', AdminVipController.revokeVip);

// Transactions
router.get('/transactions', AdminVipController.getTransactions);

module.exports = router;
