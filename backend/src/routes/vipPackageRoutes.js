const express = require('express');
const router = express.Router();
const { authenticate, authorizePermission } = require('../middleware/authMiddleware');
const VipPackageController = require('../controllers/vipPackageController');

// Public routes
router.get('/packages', VipPackageController.getPackages);

// Admin routes (require auth + permission)
router.get('/packages/all', authenticate, authorizePermission('users.manage'), VipPackageController.getAllPackages);
router.post('/packages', authenticate, authorizePermission('users.manage'), VipPackageController.createPackage);
router.put('/packages/:id', authenticate, authorizePermission('users.manage'), VipPackageController.updatePackage);
router.delete('/packages/:id', authenticate, authorizePermission('users.manage'), VipPackageController.deletePackage);

// Comparison Features
router.get('/comparison', VipPackageController.getComparisonFeatures);
router.post('/comparison', authenticate, authorizePermission('users.manage'), VipPackageController.createComparisonFeature);
router.put('/comparison/:id', authenticate, authorizePermission('users.manage'), VipPackageController.updateComparisonFeature);
router.delete('/comparison/:id', authenticate, authorizePermission('users.manage'), VipPackageController.deleteComparisonFeature);

module.exports = router;
