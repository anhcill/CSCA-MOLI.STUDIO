const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

// All admin routes require authentication AND admin role
router.use(authenticate);
router.use(authorize("admin"));

// Dashboard
router.get("/stats", adminController.getDashboardStats);

// User management
router.get("/users", adminController.getUsers);
router.delete("/users/:userId", adminController.deleteUser);
router.put("/users/:userId/role", adminController.updateUserRole);

module.exports = router;
