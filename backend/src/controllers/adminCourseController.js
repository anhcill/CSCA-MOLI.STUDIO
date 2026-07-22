const service = require("../services/adminCourseService");
const { sendCourseError, sendData } = require("../utils/courseResponses");

function action(handler, options = {}) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      return sendData(res, data, options);
    } catch (error) {
      return sendCourseError(res, error);
    }
  };
}

const list = action((req) => service.listCourses(req.query));
const get = action((req) => service.getCourse(req.params.courseId));
const create = action((req) => service.createCourse(req.body || {}), { status: 201 });
const update = action((req) => service.updateCourse(req.params.courseId, req.body || {}));
const createSection = action(
  (req) => service.createSection(req.params.courseId, req.body || {}),
  { status: 201 },
);
const updateSection = action((req) => service.updateSection(
  req.params.courseId,
  req.params.sectionId,
  req.body || {},
));
const createLesson = action(
  (req) => service.createLesson(req.params.courseId, req.body || {}),
  { status: 201 },
);
const updateLesson = action((req) => service.updateLesson(
  req.params.courseId,
  req.params.lessonId,
  req.body || {},
));
const publish = action((req) => service.publishCourse(req.params.courseId));
const unpublish = action((req) => service.unpublishCourse(req.params.courseId));
const archive = action((req) => service.archiveCourse(req.params.courseId));

module.exports = {
  list, get, create, update, createSection, updateSection,
  createLesson, updateLesson, publish, unpublish, archive,
};
