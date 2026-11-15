const express = require("express");
const { sendData, sendCourseError, CourseApiError } = require("../utils/courseResponses");
const { getIntegrationMetricsSnapshot } = require("../utils/integrationLogger");

/**
 * Creates admin router for manual external course mappings and Day 5 operations in Moly Studio.
 */
function createCourseIntegrationAdminRoutes({
  service,
  outbox = null,
  ownership = null,
  reconciliation = null,
  catalogSync = null,
  db = null,
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

  if (db) {
    router.get(
      "/outbox",
      handle(async (req) => {
        const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : null;
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const rows = (await db.query(
          `SELECT id, event_id, idempotency_key, correlation_id, event_type, aggregate_id,
                  status, remote_status, remote_inbox_id, attempt_count, max_attempts,
                  next_retry_at, sent_at, remote_processed_at, last_status_checked_at,
                  last_error_code, last_error_message, user_id, transaction_id, entitlement_id,
                  external_grant_id, external_course_id, created_at, updated_at
           FROM integration_outbox
           WHERE ($1::text IS NULL OR status = $1)
           ORDER BY id DESC
           LIMIT $2`,
          [status || null, limit],
        )).rows;
        return rows;
      }),
    );

    router.get(
      "/conflicts",
      handle(async (req) => {
        const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : null;
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const rows = (await db.query(
          `SELECT id, source_system, conflict_type, status, external_user_id, external_course_id,
                  external_grant_id, candidate_user_id, existing_user_id, local_course_id,
                  correlation_id, source_updated_at, reason, resolution_note, resolved_at, created_at
           FROM integration_conflicts
           WHERE ($1::text IS NULL OR status = $1)
           ORDER BY id DESC
           LIMIT $2`,
          [status || null, limit],
        )).rows;
        return rows;
      }),
    );
  }

  if (outbox) {
    router.post(
      "/outbox/sync",
      handle((req) =>
        outbox.processAvailableOutboxJobs({
          workerId: `admin-sync:${req.user?.id ?? "system"}`,
          limit: Math.min(Math.max(Number(req.body?.limit) || 25, 1), 100),
          reconcileBefore: req.body?.reconcileBefore !== false,
          reconcileAfter: req.body?.reconcileAfter !== false,
        }),
      ),
    );

    if (typeof outbox.retryOutboxItem === "function") {
      router.post(
        "/outbox/:id/retry",
        handle((req) =>
          outbox.retryOutboxItem({
            outboxId: req.params.id,
            actorId: req.user?.id ?? null,
            correlationId: req.headers["x-correlation-id"] || req.body?.correlationId || null,
            dispatchNow: Boolean(req.body?.dispatchNow),
          }),
        ),
      );
    }
  }

  if (ownership) {
    router.post(
      "/ownership/sync",
      handle((req) =>
        ownership.syncUserOwnershipFromCourse(req.body?.userId, {
          localCourseIds: Array.isArray(req.body?.localCourseIds) ? req.body.localCourseIds : null,
          correlationId: req.body?.correlationId || null,
          throwOnError: true,
        }),
      ),
    );
  }

  if (reconciliation) {
    router.get(
      "/ops/overview",
      handle(async (req) => {
        const [overview, mappings] = await Promise.all([
          reconciliation.listAdminOperationsOverview({ limit: req.query.limit }),
          service.listCourseMappings({ limit: 200 }),
        ]);
        return {
          ...overview,
          courseMappings: mappings,
        };
      }),
    );

    router.post(
      "/conflicts/:id/resolve",
      authorizeAnyPermission("users.manage"),
      handle((req) =>
        reconciliation.resolveIntegrationConflict({
          conflictId: req.params.id,
          action: req.body?.action || "resolved",
          targetUserId: req.body?.targetUserId ?? null,
          resolutionNote: req.body?.resolutionNote ?? null,
          actorId: req.user?.id ?? null,
          correlationId: req.headers["x-correlation-id"] || req.body?.correlationId || null,
        }),
      ),
    );

    router.post(
      "/reconcile",
      handle((req) =>
        reconciliation.runReconciliation({
          dryRun: req.body?.dryRun !== false,
          triggerMode: "api",
          triggeredBy: req.user?.id ?? null,
          scopeFilter: req.body?.scopeFilter || {},
          correlationId: req.headers["x-correlation-id"] || req.body?.correlationId || null,
          dispatchRepairs: req.body?.dispatchRepairs !== false,
          staleMinutes: req.body?.staleMinutes,
        }),
      ),
    );

    router.get(
      "/reconcile/runs",
      handle((req) =>
        reconciliation.listReconciliationRuns({
          limit: req.query.limit,
          includeActions: req.query.includeActions !== "false",
        }),
      ),
    );
  }

  if (catalogSync) {
    router.post(
      "/catalog/backfill",
      handle((req) =>
        catalogSync.runCatalogBackfill({
          reset: req.body?.reset === true,
          limit: Math.min(Math.max(Number(req.body?.limit) || 100, 1), 500),
          correlationId: req.headers["x-correlation-id"] || req.body?.correlationId || null,
        }),
      ),
    );
  }

  if (db) {
    router.get(
      "/catalog/checkpoints",
      handle(async () => {
        const res = await db.query(
          `SELECT stream_name, source_system, last_cursor, after_entity_id, high_water_revision,
                  snapshot_anchor_revision, high_water_updated_at, sync_status,
                  last_error_code, last_error_message, last_synced_at, updated_at
           FROM course_sync_checkpoints
           ORDER BY stream_name ASC`,
        );
        return res.rows;
      }),
    );

    router.get(
      "/catalog/inbox",
      handle(async (req) => {
        const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : null;
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const res = await db.query(
          `SELECT id, event_id, idempotency_key, correlation_id, event_type,
                  aggregate_type, aggregate_id, aggregate_revision, status,
                  attempt_count, next_retry_at, processed_at, last_error_code,
                  last_error_message, created_at, updated_at
           FROM moly_course_sync_inbox
           WHERE ($1::text IS NULL OR status = $1)
           ORDER BY id DESC
           LIMIT $2`,
          [status || null, limit],
        );
        return res.rows;
      }),
    );
  }

  router.get("/metrics", handle(() => getIntegrationMetricsSnapshot()));

  return router;
}

module.exports = { createCourseIntegrationAdminRoutes };
