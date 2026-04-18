const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
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

// User management
router.get("/users", authorizePermission("users.manage"), adminController.getUsers);
router.get("/users/:userId/activities", authorizePermission("users.manage"), adminController.getUserActivities);
router.get("/roles", authorizePermission("users.manage"), adminController.getAdminRoleOptions);
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
	authorizePermission("users.manage"),
	adminController.updateUserAdminRoles,
);
router.patch(
	"/users/:userId/profile",
	authorizePermission("users.manage"),
	adminController.updateUserProfile,
);

module.exports = router;
