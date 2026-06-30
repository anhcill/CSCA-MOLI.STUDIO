const express = require('express');
const router = express.Router();
const riskCenterController = require('../controllers/riskCenterController');
const examRiskActions = require('../controllers/examRiskActionsController');
const paymentRiskActions = require('../controllers/paymentRiskActionsController');
const questionReportActions = require('../controllers/questionReportActionsController');
const {
  authenticate,
  authorizeAnyPermission,
  authorizePermission,
} = require('../middleware/authMiddleware');

// All risk center routes require auth
router.use(authenticate);

const viewRiskCenter = authorizeAnyPermission('risk_center.view', 'exams.manage');
const manageRiskCenter = authorizePermission('risk_center.manage');
const viewPaymentRisk = authorizePermission('risk_center.view');

//  Read-only routes (risk_center.view)
router.get(
  '/summary',
  viewRiskCenter,
  riskCenterController.getSummary
);

router.get(
  '/exam-risks',
  viewRiskCenter,
  riskCenterController.getExamRisks
);

router.get(
  '/payment-risks',
  viewPaymentRisk,
  riskCenterController.getPaymentRisks
);

router.get(
  '/question-reports',
  viewRiskCenter,
  questionReportActions.getQuestionReports
);

router.get(
  '/notifications',
  viewRiskCenter,
  riskCenterController.getNotifications
);

router.get(
  '/notifications/unread-count',
  viewRiskCenter,
  riskCenterController.getUnreadCount
);

router.get(
  '/audit-logs',
  viewRiskCenter,
  riskCenterController.getAuditLogs
);

//  Notification actions
router.post(
  '/notifications/:id/read',
  viewRiskCenter,
  riskCenterController.markNotificationRead
);

router.post(
  '/notifications/read-all',
  viewRiskCenter,
  riskCenterController.markAllNotificationsRead
);

//  Phase B: Exam Risk Actions

// Scan violations  create/update risk cases (manage permission)
router.post(
  '/exam-risks/scan',
  manageRiskCenter,
  examRiskActions.scanViolations
);

// Get single risk case detail
router.get(
  '/exam-risks/:id',
  viewRiskCenter,
  examRiskActions.getExamRiskDetail
);

// Light actions (view permission)
router.post(
  '/exam-risks/:id/note',
  viewRiskCenter,
  examRiskActions.addNote
);

router.post(
  '/exam-risks/:id/resolve',
  manageRiskCenter,
  examRiskActions.resolve
);

router.post(
  '/exam-risks/:id/ignore',
  manageRiskCenter,
  examRiskActions.ignore
);

router.post(
  '/exam-risks/:id/escalate',
  viewRiskCenter,
  examRiskActions.escalate
);

router.post(
  '/exam-risks/:id/warn-user',
  manageRiskCenter,
  examRiskActions.warnUser
);

// Strong actions (manage permission)
router.post(
  '/exam-risks/:id/lock-attempt',
  manageRiskCenter,
  examRiskActions.lockAttempt
);

router.post(
  '/exam-risks/:id/force-submit',
  manageRiskCenter,
  examRiskActions.forceSubmit
);

router.post(
  '/exam-risks/:id/invalidate-attempt',
  manageRiskCenter,
  examRiskActions.invalidateAttempt
);

router.post(
  '/exam-risks/:id/restore-attempt',
  manageRiskCenter,
  examRiskActions.restoreAttempt
);

router.post(
  '/exam-risks/:id/ban-exam-access',
  manageRiskCenter,
  examRiskActions.banExamAccess
);

router.post(
  '/exam-risks/:id/suspend-user',
  manageRiskCenter,
  examRiskActions.suspendUser
);

router.post(
  '/exam-risks/:id/ban-user',
  manageRiskCenter,
  examRiskActions.banUser
);

router.post(
  '/exam-risks/:id/mark-clean',
  manageRiskCenter,
  examRiskActions.markClean
);

//  Phase C: Payment Risk Actions

// Get single payment risk detail
router.get(
  '/payment-risks/:id',
  viewPaymentRisk,
  paymentRiskActions.getPaymentRiskDetail
);

router.post(
  '/payment-risks/:id/sync',
  manageRiskCenter,
  paymentRiskActions.syncPayment
);

router.post(
  '/payment-risks/:id/resolve',
  manageRiskCenter,
  paymentRiskActions.resolvePayment
);

router.post(
  '/payment-risks/:id/mark-suspicious',
  manageRiskCenter,
  paymentRiskActions.markSuspicious
);

router.post(
  '/payment-risks/:id/manual-credit-coins',
  manageRiskCenter,
  paymentRiskActions.manualCreditCoins
);

router.post(
  '/payment-risks/:id/manual-grant-vip',
  manageRiskCenter,
  paymentRiskActions.manualGrantVip
);

router.post(
  '/payment-risks/:id/revoke-coins',
  manageRiskCenter,
  paymentRiskActions.revokeCoins
);

router.post(
  '/payment-risks/:id/revoke-vip',
  manageRiskCenter,
  paymentRiskActions.revokeVip
);

//  Phase D: Question Report Actions

// Get single report detail
router.get(
  '/question-reports/:id',
  viewRiskCenter,
  questionReportActions.getReportDetail
);

router.post(
  '/question-reports/:id/resolve',
  manageRiskCenter,
  questionReportActions.resolveReport
);

router.post(
  '/question-reports/:id/ignore',
  manageRiskCenter,
  questionReportActions.ignoreReport
);

router.post(
  '/question-reports/:id/hide-question',
  manageRiskCenter,
  questionReportActions.hideQuestion
);

router.post(
  '/question-reports/:id/hide-exam',
  manageRiskCenter,
  questionReportActions.hideExam
);

router.post(
  '/question-reports/:id/regrade-affected-attempts',
  manageRiskCenter,
  questionReportActions.regradeAffectedAttempts
);

module.exports = router;
