const express = require("express");
const router = express.Router();
const roadmapAdminController = require("../controllers/roadmapAdminController");
const {
  authenticate,
  authorizePermission,
} = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizePermission("roadmap.manage"));

router.get("/milestones", roadmapAdminController.getMilestones);
router.post("/milestones", roadmapAdminController.createMilestone);
router.put("/milestones/:id", roadmapAdminController.updateMilestone);
router.delete("/milestones/:id", roadmapAdminController.deleteMilestone);

module.exports = router;
