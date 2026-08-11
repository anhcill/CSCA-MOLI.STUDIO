const express = require("express");
const controller = require("../controllers/teacherCourseController");
const { authenticate, authorizeAnyPermission } = require("../middleware/authMiddleware");
const { courseFiles } = require("../middleware/courseFileUpload");
const { scopeCourseList, requireAssignedCourse } = require("../middleware/courseManagementScope");

const router = express.Router();

router.use(authenticate, authorizeAnyPermission("content.manage", "courses.manage_assigned"));
router.get("/", scopeCourseList, controller.list);
router.use("/:courseId", requireAssignedCourse);
router.get("/:courseId", controller.get);
router.get("/:courseId/lessons/:lessonId/work", controller.getLessonWork);
router.put("/:courseId/lessons/:lessonId/assignment", controller.saveAssignment);
router.post("/:courseId/lessons/:lessonId/assignment/attachments", courseFiles("files"), controller.uploadAssignmentAttachments);
router.delete("/:courseId/lessons/:lessonId/assignment/attachments/:attachmentId", controller.deleteAssignmentAttachment);
router.patch("/:courseId/lessons/:lessonId/submissions/:submissionId/grade", controller.gradeSubmission);
router.get("/:courseId/lessons/:lessonId/questions", controller.listLessonQuestions);
router.post("/:courseId/lessons/:lessonId/questions/:threadId/replies", courseFiles("files"), controller.replyLessonQuestion);
router.patch("/:courseId/lessons/:lessonId/questions/:threadId/status", controller.updateQuestionStatus);

module.exports = router;
