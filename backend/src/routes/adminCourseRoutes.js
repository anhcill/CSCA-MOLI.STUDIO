const express = require("express");
const controller = require("../controllers/adminCourseController");
const { authenticate, authorizePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, authorizePermission("content.manage"));

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:courseId", controller.get);
router.patch("/:courseId", controller.update);
router.post("/:courseId/sections", controller.createSection);
router.patch("/:courseId/sections/:sectionId", controller.updateSection);
router.post("/:courseId/lessons", controller.createLesson);
router.patch("/:courseId/lessons/:lessonId", controller.updateLesson);
router.post("/:courseId/publish", controller.publish);
router.post("/:courseId/unpublish", controller.unpublish);
router.post("/:courseId/archive", controller.archive);

module.exports = router;
