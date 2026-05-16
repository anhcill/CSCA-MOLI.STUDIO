const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAnalyticsController = require("../controllers/adminAnalyticsController");
const {
	authenticate,
	authorizePermission,
} = require("../middleware/authMiddleware");

// All admin routes require authentication
router.use(authenticate);

// Dashboard
router.get(
	"/stats",
	authorizePermission("admin.dashboard.view"),
	adminController.getDashboardStats,
);

// Online users (Socket.io connections)
router.get(
	"/online-users",
	authorizePermission("admin.dashboard.view"),
	adminController.getOnlineUsers,
);

router.get(
	"/analytics",
	authorizePermission("admin.super"),
	adminAnalyticsController.getAnalytics,
);

router.get(
	"/analytics/admin-performance",
	authorizePermission("exams.manage"),
	adminAnalyticsController.getAdminPerformance,
);

router.get(
	"/analytics/exams/:examId",
	authorizePermission("admin.super"),
	adminAnalyticsController.getExamReport,
);

router.get(
	"/analytics/export/:dataset",
	authorizePermission("admin.super"),
	adminAnalyticsController.exportDataset,
);

// User management
router.get("/users", authorizePermission("users.manage"), adminController.getUsers);
router.get("/users/:userId/activities", authorizePermission("users.manage"), adminController.getUserActivities);
router.get("/roles", authorizePermission("admin.super"), adminController.getAdminRoleOptions);
router.put("/users/:userId/status", authorizePermission("users.manage"), adminController.updateUserStatus);
router.delete(
	"/users/:userId",
	authorizePermission("users.manage"),
	adminController.deleteUser,
);
router.put(
	"/users/:userId/role",
	authorizePermission("users.manage"),
	adminController.updateUserRole,
);
router.put(
	"/users/:userId/admin-roles",
	authorizePermission("admin.super"),
	adminController.updateUserAdminRoles,
);
router.patch(
	"/users/:userId/profile",
	authorizePermission("users.manage"),
	adminController.updateUserProfile,
);

// ── Super Admin Control: Quản lý Admin khác ─────────────────────────────────
// Chỉ super_admin mới có quyền truy cập (permission: admin.super)
router.get(
	"/admins",
	authorizePermission("admin.super"),
	adminController.getAdmins,
);
router.get(
	"/admins/stats",
	authorizePermission("admin.super"),
	adminController.getAdminStats,
);
router.get(
	"/admins/activities",
	authorizePermission("admin.super"),
	adminController.getAllAdminActivities,
);
router.get(
	"/admins/:adminId/activities",
	authorizePermission("admin.super"),
	adminController.getAdminActivities,
);

module.exports = router;

