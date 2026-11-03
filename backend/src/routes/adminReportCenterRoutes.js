const express = require('express');
const controller = require('../controllers/adminReportCenterController');
const { authenticate, authorizePermission } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/summary', authorizePermission('reports.view'), controller.getSummary);
router.get('/items', authorizePermission('reports.view'), controller.getItems);
router.get('/items/:source/:id', authorizePermission('reports.view'), controller.getItemDetail);
router.post('/items/:source/:id/action', authorizePermission('reports.manage'), controller.actionItem);

module.exports = router;
