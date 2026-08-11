const express = require("express");
const controller = require("../controllers/adminCourseController");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const { courseFiles } = require("../middleware/courseFileUpload");
const { requireGlobalCourseScope, scopeCourseList, requireAssignedCourse } = require("../middleware/courseManagementScope");

const router = express.Router();

router.use(authenticate, authorizeAnyPermission("content.manage", "courses.manage_assigned"));
router.use(requireGlobalCourseScope);

router.get("/teacher-options", controller.listTeacherOptions);
router.get("/:courseId/teachers", controller.listCourseTeachers);
router.put("/:courseId/teachers", controller.replaceCourseTeachers);
router.get("/", scopeCourseList, controller.list);
router.post("/", controller.create);
router.use("/:courseId", requireAssignedCourse);
router.get("/:courseId", controller.get);
router.patch("/:courseId", controller.update);
router.post("/:courseId/sections", controller.createSection);
router.patch("/:courseId/sections/:sectionId", controller.updateSection);
router.post("/:courseId/lessons", controller.createLesson);
router.patch("/:courseId/lessons/:lessonId", controller.updateLesson);
router.get("/:courseId/lessons/:lessonId/work", controller.getLessonWork);
router.post("/:courseId/lessons/:lessonId/resources", courseFiles("files"), controller.uploadLessonResources);
router.delete("/:courseId/lessons/:lessonId/resources/:resourceId", controller.deleteLessonResource);
router.put("/:courseId/lessons/:lessonId/assignment", controller.saveAssignment);
router.post("/:courseId/lessons/:lessonId/assignment/attachments", courseFiles("files"), controller.uploadAssignmentAttachments);
router.delete("/:courseId/lessons/:lessonId/assignment/attachments/:attachmentId", controller.deleteAssignmentAttachment);
router.patch("/:courseId/lessons/:lessonId/submissions/:submissionId/grade", controller.gradeSubmission);
router.post("/:courseId/publish", controller.publish);
router.post("/:courseId/unpublish", controller.unpublish);
router.post("/:courseId/archive", controller.archive);

module.exports = router;
