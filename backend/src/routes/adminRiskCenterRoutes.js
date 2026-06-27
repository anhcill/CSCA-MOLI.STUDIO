const express = require('express');
const router = express.Router();
const riskCenterController = require('../controllers/riskCenterController');
const examRiskActions = require('../controllers/examRiskActionsController');
const paymentRiskActions = require('../controllers/paymentRiskActionsController');
const questionReportActions = require('../controllers/questionReportActionsController');
const {
  authenticate,
  authorizePermission,
} = require('../middleware/authMiddleware');

// All risk center routes require auth
router.use(authenticate);

//  Read-only routes (risk_center.view)
router.get(
  '/summary',
  authorizePermission('risk_center.view'),
  riskCenterController.getSummary
);

router.get(
  '/exam-risks',
  authorizePermission('risk_center.view'),
  riskCenterController.getExamRisks
);

router.get(
  '/payment-risks',
  authorizePermission('risk_center.view'),
  riskCenterController.getPaymentRisks
);

router.get(
  '/question-reports',
  authorizePermission('risk_center.view'),
  questionReportActions.getQuestionReports
);

router.get(
  '/notifications',
  authorizePermission('risk_center.view'),
  riskCenterController.getNotifications
);

router.get(
  '/notifications/unread-count',
  authorizePermission('risk_center.view'),
  riskCenterController.getUnreadCount
);

router.get(
  '/audit-logs',
  authorizePermission('risk_center.view'),
  riskCenterController.getAuditLogs
);

//  Notification actions
router.post(
  '/notifications/:id/read',
  authorizePermission('risk_center.view'),
  riskCenterController.markNotificationRead
);

router.post(
  '/notifications/read-all',
  authorizePermission('risk_center.view'),
  riskCenterController.markAllNotificationsRead
);

//  Phase B: Exam Risk Actions

// Scan violations  create/update risk cases (manage permission)
router.post(
  '/exam-risks/scan',
  authorizePermission('risk_center.manage'),
  examRiskActions.scanViolations
);

// Get single risk case detail
router.get(
  '/exam-risks/:id',
  authorizePermission('risk_center.view'),
  examRiskActions.getExamRiskDetail
);

// Light actions (view permission)
router.post(
  '/exam-risks/:id/note',
  authorizePermission('risk_center.view'),
  examRiskActions.addNote
);

router.post(
  '/exam-risks/:id/resolve',
  authorizePermission('risk_center.manage'),
  examRiskActions.resolve
);

router.post(
  '/exam-risks/:id/ignore',
  authorizePermission('risk_center.manage'),
  examRiskActions.ignore
);

router.post(
  '/exam-risks/:id/escalate',
  authorizePermission('risk_center.view'),
  examRiskActions.escalate
);

router.post(
  '/exam-risks/:id/warn-user',
  authorizePermission('risk_center.manage'),
  examRiskActions.warnUser
);

// Strong actions (manage permission)
router.post(
  '/exam-risks/:id/lock-attempt',
  authorizePermission('risk_center.manage'),
  examRiskActions.lockAttempt
);

router.post(
  '/exam-risks/:id/force-submit',
  authorizePermission('risk_center.manage'),
  examRiskActions.forceSubmit
);

router.post(
  '/exam-risks/:id/invalidate-attempt',
  authorizePermission('risk_center.manage'),
  examRiskActions.invalidateAttempt
);

router.post(
  '/exam-risks/:id/restore-attempt',
  authorizePermission('risk_center.manage'),
  examRiskActions.restoreAttempt
);

router.post(
  '/exam-risks/:id/ban-exam-access',
  authorizePermission('risk_center.manage'),
  examRiskActions.banExamAccess
);

router.post(
  '/exam-risks/:id/suspend-user',
  authorizePermission('risk_center.manage'),
  examRiskActions.suspendUser
);

router.post(
  '/exam-risks/:id/ban-user',
  authorizePermission('risk_center.manage'),
  examRiskActions.banUser
);

router.post(
  '/exam-risks/:id/mark-clean',
  authorizePermission('risk_center.manage'),
  examRiskActions.markClean
);

//  Phase C: Payment Risk Actions

// Get single payment risk detail
router.get(
  '/payment-risks/:id',
  authorizePermission('risk_center.view'),
  paymentRiskActions.getPaymentRiskDetail
);

router.post(
  '/payment-risks/:id/sync',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.syncPayment
);

router.post(
  '/payment-risks/:id/resolve',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.resolvePayment
);

router.post(
  '/payment-risks/:id/mark-suspicious',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.markSuspicious
);

router.post(
  '/payment-risks/:id/manual-credit-coins',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.manualCreditCoins
);

router.post(
  '/payment-risks/:id/manual-grant-vip',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.manualGrantVip
);

router.post(
  '/payment-risks/:id/revoke-coins',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.revokeCoins
);

router.post(
  '/payment-risks/:id/revoke-vip',
  authorizePermission('risk_center.manage'),
  paymentRiskActions.revokeVip
);

//  Phase D: Question Report Actions

// Get single report detail
router.get(
  '/question-reports/:id',
  authorizePermission('risk_center.view'),
  questionReportActions.getReportDetail
);

router.post(
  '/question-reports/:id/resolve',
  authorizePermission('risk_center.manage'),
  questionReportActions.resolveReport
);

router.post(
  '/question-reports/:id/ignore',
  authorizePermission('risk_center.manage'),
  questionReportActions.ignoreReport
);

router.post(
  '/question-reports/:id/hide-question',
  authorizePermission('risk_center.manage'),
  questionReportActions.hideQuestion
);

router.post(
  '/question-reports/:id/hide-exam',
  authorizePermission('risk_center.manage'),
  questionReportActions.hideExam
);

router.post(
  '/question-reports/:id/regrade-affected-attempts',
  authorizePermission('risk_center.manage'),
  questionReportActions.regradeAffectedAttempts
);

module.exports = router;
