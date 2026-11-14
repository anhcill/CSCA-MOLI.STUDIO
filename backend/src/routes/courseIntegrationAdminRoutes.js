const express = require("express");
const { sendData, sendCourseError, CourseApiError } = require("../utils/courseResponses");

/**
 * Creates admin router for manual external course mappings in Moly Studio.
 */
function createCourseIntegrationAdminRoutes({
  service,
  authenticate,
  authorizeAnyPermission,
}) {
  const router = express.Router();
  router.use(authenticate, authorizeAnyPermission("users.manage", "content.manage"));

  const handle = (work, status = 200) => async (req, res) => {
    try {
      return sendData(res, await work(req), { status });
    } catch (error) {
      if (error?.code === "23503") {
        return sendCourseError(
          res,
          new CourseApiError(422, "FOREIGN_KEY_VIOLATION", "Referenced local course or package does not exist."),
        );
      }
      return sendCourseError(res, error);
    }
  };

  router.get(
    "/course-mappings",
    handle((req) =>
      service.listCourseMappings({
        sourceSystem: req.query.sourceSystem,
        status: req.query.status,
        localCourseId: req.query.localCourseId,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    ),
  );

  router.get(
    "/course-mappings/resolve",
    handle((req) =>
      service.resolveExternalCourseMapping({
        sourceSystem: req.query.sourceSystem,
        externalCourseId: req.query.externalCourseId,
        requireActive: req.query.requireActive !== "false",
      }),
    ),
  );

  router.post(
    "/course-mappings",
    handle(
      (req) =>
        service.upsertManualCourseMapping({
          ...req.body,
          actorId: req.user?.id ?? null,
        }),
      201,
    ),
  );

  router.patch(
    "/course-mappings/:id/status",
    handle((req) =>
      service.updateCourseMappingStatus({
        id: req.params.id,
        status: req.body?.status,
        notes: req.body?.notes,
        actorId: req.user?.id ?? null,
      }),
    ),
  );

  return router;
}

module.exports = { createCourseIntegrationAdminRoutes };
