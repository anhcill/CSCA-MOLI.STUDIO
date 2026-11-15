const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const { CourseIntegrationClientError } = require("./courseIntegrationClient");
const {
  createIntegrationLogger,
  isIntegrationKillSwitchActive,
  observeMetricLatency,
  recordMetric,
  resolveCorrelationId,
} = require("../utils/integrationLogger");

const SOURCE_SYSTEM = "moly";
const TARGET_SYSTEM = "csca-course";
const VALID_CONFLICT_TYPES = new Set([
  "IDENTITY_EMAIL_COLLISION",
  "PRIVILEGED_ROLE_COLLISION",
  "IDENTITY_ALREADY_LINKED",
  "COURSE_MAPPING_MISSING",
  "ENTITLEMENT_CONFLICT",
  "STALE_EVENT_CONFLICT",
  "UNRESOLVED_IDENTITY",
  "MANUAL_REVIEW_REQUIRED",
]);

function mapConflictType(errorCode) {
  const normalized = String(errorCode || "").trim().toUpperCase();
  if (VALID_CONFLICT_TYPES.has(normalized)) return normalized;
  if (normalized === "IDENTITY_CONFLICT") return "IDENTITY_ALREADY_LINKED";
  return "MANUAL_REVIEW_REQUIRED";
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeMolyOfferingId(row) {
  if (!row) return null;
  const candidate = row.source_system === "moly"
    ? row.external_course_id
    : row.metadata?.moly_external_course_id;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.startsWith("moly:") && trimmed.length > 5 ? trimmed : null;
}

/**
 * Coordinates transactional integration outbox writes in Moly Studio and
 * asynchronously delivers + reconciles signed events with CSCA-Course.
 */
function createCourseOutboxSyncService({
  db,
  client,
  now = () => new Date(),
  retryBaseSeconds = 30,
  maxBackoffSeconds = 1800,
  logger = console,
  env = process.env,
} = {}) {
  const integrationLog = logger && logger !== console && typeof logger.info === "function"
    ? logger
    : createIntegrationLogger({ component: "course-outbox", env });
  async function withTx(work, existingClient = null) {
    if (existingClient) return work(existingClient);
    if (typeof db.transaction === "function") return db.transaction(work);
    if (db.pool && typeof db.pool.connect === "function") {
      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");
        const value = await work(conn);
        await conn.query("COMMIT");
        return value;
      } catch (err) {
        await conn.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        conn.release();
      }
    }
    return work(db);
  }

  async function hasIntegrationTables(runner) {
    const res = await runner.query(
      `SELECT
         to_regclass('integration_outbox') IS NOT NULL AS has_outbox,
         to_regclass('external_course_mappings') IS NOT NULL AS has_mappings`,
    );
    return Boolean(res.rows[0]?.has_outbox && res.rows[0]?.has_mappings);
  }

  /**
   * Resolves explicit manual course mappings for purchase/fulfillment.
   * Never matches by title or slug.
   */
  async function resolveCourseMappingsForPurchase(
    runner,
    { courseIds = [], videoPackageId = null, requireMappings = false } = {},
  ) {
    const uniqueIds = [...new Set((courseIds || []).map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (!uniqueIds.length) return { syncEnabled: false, mappings: [] };
    if (!(await hasIntegrationTables(runner))) {
      return { syncEnabled: false, mappings: [] };
    }

    const pkgId = videoPackageId != null && Number.isSafeInteger(Number(videoPackageId))
      ? Number(videoPackageId)
      : null;

    const rows = (await runner.query(
      `SELECT id, source_system, external_course_id, local_course_id, local_video_package_id, status, metadata
       FROM external_course_mappings
       WHERE local_course_id = ANY($1::bigint[])
         AND (
           source_system = 'moly'
           OR (source_system = 'csca-course' AND (metadata ? 'moly_external_course_id'))
         )
       ORDER BY
         (local_video_package_id IS NOT NULL AND local_video_package_id = $2) DESC,
         (local_video_package_id IS NULL) DESC,
         (source_system = 'moly') DESC,
         id ASC`,
      [uniqueIds, pkgId],
    )).rows;

    const packageScopeDisabled = [];
    const resolved = [];
    const unmappedCourseIds = [];

    for (const courseId of uniqueIds) {
      const candidates = rows.filter((row) => (
        Number(row.local_course_id) === courseId
        && (row.local_video_package_id == null || (pkgId != null && Number(row.local_video_package_id) === pkgId))
      ));
      const activeMatch = candidates.find(
        (row) => row.status === "active" && normalizeMolyOfferingId(row),
      );
      if (activeMatch) {
        resolved.push({
          mappingId: Number(activeMatch.id),
          localCourseId: courseId,
          externalCourseId: normalizeMolyOfferingId(activeMatch),
          localVideoPackageId: activeMatch.local_video_package_id != null ? Number(activeMatch.local_video_package_id) : null,
        });
      } else if (candidates.some((row) => row.status !== "active" && normalizeMolyOfferingId(row))) {
        packageScopeDisabled.push(courseId);
      } else {
        unmappedCourseIds.push(courseId);
      }
    }

    if (packageScopeDisabled.length > 0) {
      throw new CourseApiError(
        422,
        "COURSE_MAPPING_MISSING",
        `Course integration mapping is inactive or incomplete for local course(s): ${packageScopeDisabled.join(", ")}.`,
        { localCourseIds: packageScopeDisabled },
      );
    }

    if (resolved.length > 0 && unmappedCourseIds.length > 0) {
      throw new CourseApiError(
        422,
        "COURSE_MAPPING_MISSING",
        `All courses in a synced package must have active manual mappings. Missing: ${unmappedCourseIds.join(", ")}.`,
        { localCourseIds: unmappedCourseIds },
      );
    }

    if (requireMappings && resolved.length !== uniqueIds.length) {
      throw new CourseApiError(
        422,
        "COURSE_MAPPING_MISSING",
        `No active manual course mapping found for local course(s): ${unmappedCourseIds.join(", ")}.`,
        { localCourseIds: unmappedCourseIds },
      );
    }

    return {
      syncEnabled: resolved.length > 0,
      mappings: resolved,
    };
  }

  /**
   * Allocates strictly increasing source_updated_at per aggregate key so
   * out-of-order or same-millisecond grant -> revoke transitions never collide as stale.
   */
  async function allocateMonotonicTimestamp(txClient, aggregateId, preferredDate) {
    await txClient.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      ["moly:outbox-ts", aggregateId],
    );
    const maxRes = await txClient.query(
      "SELECT MAX(source_updated_at) AS max_ts FROM integration_outbox WHERE aggregate_id = $1",
      [aggregateId],
    );
    const baseMs = Math.max(
      preferredDate ? new Date(preferredDate).getTime() : 0,
      now().getTime(),
    );
    const prevMs = maxRes.rows[0]?.max_ts ? new Date(maxRes.rows[0].max_ts).getTime() : 0;
    return new Date(Math.max(baseMs, prevMs + 1));
  }

  async function enqueueProvisionEventTx(
    txClient,
    { user, correlationId, trigger = "course_purchase", metadata = {} },
  ) {
    const userId = Number(user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Valid user.id is required for provisioning.");
    }
    const externalUserId = `moly:${userId}`;

    // Serialize provision enqueue decisions per user.
    await txClient.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      ["moly:outbox-prov", externalUserId],
    );

    const existingRows = (await txClient.query(
      `SELECT id, status, remote_status, event_id, idempotency_key
       FROM integration_outbox
       WHERE source_system = $1
         AND target_system = $2
         AND event_type = 'user.provisioned'
         AND aggregate_id = $3
       ORDER BY id DESC
       LIMIT 5`,
      [SOURCE_SYSTEM, TARGET_SYSTEM, externalUserId],
    )).rows;

    // Reuse an already processed or active in-flight provision row to avoid redundant chatter.
    const reusable = existingRows.find(
      (row) => !["dead_letter", "cancelled"].includes(row.status),
    );
    if (reusable) {
      return { enqueued: false, outbox: reusable };
    }

    const version = existingRows.length + 1;
    const sourceUpdatedAt = await allocateMonotonicTimestamp(txClient, externalUserId, now());
    const eventId = version === 1
      ? `moly:evt:user.provisioned:${externalUserId}:v1`
      : `moly:evt:user.provisioned:${externalUserId}:v${version}:${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = `moly:user.provisioned:${externalUserId}:v${version}`;

    const accountStatus = user.is_active === false ? "suspended" : "active";
    const wirePayload = {
      event_id: eventId,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      source_system: SOURCE_SYSTEM,
      external_user_id: externalUserId,
      account_status: accountStatus,
      source_updated_at: sourceUpdatedAt.toISOString(),
      profile: {
        full_name: user.full_name || user.username || null,
        email_hint: user.email || null,
        email_verified: Boolean(user.is_verified),
      },
      metadata: {
        trigger,
        local_user_id: userId,
        ...metadata,
      },
    };

    const inserted = (await txClient.query(
      `INSERT INTO integration_outbox (
         source_system, target_system, event_id, idempotency_key, correlation_id,
         event_type, aggregate_type, aggregate_id, payload, source_updated_at,
         status, user_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5, 'user.provisioned', 'user', $6, $7::jsonb, $8, 'pending', $9, $10::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        SOURCE_SYSTEM,
        TARGET_SYSTEM,
        eventId,
        idempotencyKey,
        correlationId,
        externalUserId,
        JSON.stringify(wirePayload),
        sourceUpdatedAt.toISOString(),
        userId,
        JSON.stringify({ trigger }),
      ],
    )).rows[0] || null;

    return { enqueued: Boolean(inserted), outbox: inserted || existingRows[0] };
  }

  /**
   * Enqueues `user.provisioned` (if needed) + transaction-scoped `entitlement.granted`
   * events inside the same SQL transaction as payment fulfillment.
   */
  async function enqueueProvisionAndGrantTx(
    txClient,
    {
      user,
      transactionId,
      transactionCode = null,
      entitlementId,
      videoPackageId,
      productType = "video",
      durationMode = "days",
      durationDays = null,
      validFrom,
      validUntil = null,
      snapshot = {},
      mappedCourses = [],
      correlationId = null,
    },
  ) {
    if (!(await hasIntegrationTables(txClient))) {
      return { enqueuedCount: 0, provisionOutbox: null, grantOutboxes: [] };
    }
    if (!mappedCourses.length) {
      return { enqueuedCount: 0, provisionOutbox: null, grantOutboxes: [] };
    }

    const userId = Number(user.id);
    const txId = transactionId != null ? Number(transactionId) : null;
    const entId = Number(entitlementId);
    const corr = correlationId || (txId ? `corr_moly_tx_${txId}` : `corr_moly_ent_${entId}`);
    const validFromIso = toIso(validFrom || now());
    const validUntilIso = toIso(validUntil);

    const provisionRes = await enqueueProvisionEventTx(txClient, {
      user,
      correlationId: corr,
      trigger: txId ? "video_purchase" : "manual_grant",
      metadata: {
        transaction_id: txId,
        entitlement_id: entId,
      },
    });

    const grantOutboxes = [];
    for (const mapped of mappedCourses) {
      const grantScope = txId ? `tx_${txId}` : `ent_${entId}`;
      const externalGrantId = `moly:grant:${grantScope}:course_${mapped.localCourseId}`;
      const eventId = `moly:evt:grant:${grantScope}:course_${mapped.localCourseId}`;
      const idempotencyKey = `moly:entitlement.granted:${externalGrantId}:v1`;
      const sourceUpdatedAt = await allocateMonotonicTimestamp(txClient, externalGrantId, validFromIso);

      const wirePayload = {
        event_id: eventId,
        idempotency_key: idempotencyKey,
        correlation_id: corr,
        source_system: SOURCE_SYSTEM,
        external_user_id: `moly:${userId}`,
        external_course_id: mapped.externalCourseId,
        external_grant_id: externalGrantId,
        status: "active",
        valid_from: validFromIso,
        valid_until: validUntilIso,
        source_updated_at: sourceUpdatedAt.toISOString(),
        metadata: {
          transaction_id: txId,
          order_ref: transactionCode,
          entitlement_id: entId,
          video_package_id: Number(videoPackageId),
          local_course_id: mapped.localCourseId,
          course_mapping_id: mapped.mappingId,
          product_type: productType,
          duration_mode: durationMode,
          duration_days: durationDays,
          snapshot_name: snapshot?.name || null,
        },
      };

      const inserted = (await txClient.query(
        `INSERT INTO integration_outbox (
           source_system, target_system, event_id, idempotency_key, correlation_id,
           event_type, aggregate_type, aggregate_id, payload, source_updated_at,
           status, user_id, transaction_id, entitlement_id, external_grant_id, external_course_id, metadata
         )
         VALUES (
           $1, $2, $3, $4, $5,
           'entitlement.granted', 'entitlement', $6, $7::jsonb, $8,
           'pending', $9, $10, $11, $12, $13, $14::jsonb
         )
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING *`,
        [
          SOURCE_SYSTEM,
          TARGET_SYSTEM,
          eventId,
          idempotencyKey,
          corr,
          externalGrantId,
          JSON.stringify(wirePayload),
          sourceUpdatedAt.toISOString(),
          userId,
          txId,
          entId,
          externalGrantId,
          mapped.externalCourseId,
          JSON.stringify({
            course_mapping_id: mapped.mappingId,
            local_course_id: mapped.localCourseId,
          }),
        ],
      )).rows[0];

      if (inserted) {
        grantOutboxes.push(inserted);
      }
    }

    return {
      enqueuedCount: (provisionRes.enqueued ? 1 : 0) + grantOutboxes.length,
      provisionOutbox: provisionRes.outbox,
      grantOutboxes,
    };
  }

  /**
   * Enqueues scoped `entitlement.revoked` events for a specific Moly transaction or entitlement.
   * Uses the grant's original saved offering target when available so disabling a mapping later
   * never strands revocation, and never touches unrelated sibling/Course/Management grants.
   */
  async function enqueueEntitlementRevokeTx(
    txClient,
    {
      userId,
      transactionId = null,
      entitlementId = null,
      courseIds = [],
      videoPackageId = null,
      reason = "payment_refunded",
      revokedAt = null,
      validFrom = null,
      validUntil = null,
      correlationId = null,
      actorId = null,
      refundReference = null,
    },
  ) {
    if (!(await hasIntegrationTables(txClient))) {
      return { enqueuedCount: 0, revokeOutboxes: [] };
    }

    const uid = Number(userId);
    const txId = transactionId != null ? Number(transactionId) : null;
    const entId = entitlementId != null ? Number(entitlementId) : null;

    // Prefer exact grant records previously enqueued for this transaction/entitlement.
    const priorGrants = (await txClient.query(
      `SELECT *
       FROM integration_outbox
       WHERE source_system = $1
         AND target_system = $2
         AND event_type = 'entitlement.granted'
         AND (
           ($3::int IS NOT NULL AND transaction_id = $3)
           OR ($4::bigint IS NOT NULL AND entitlement_id = $4)
         )
       ORDER BY id ASC`,
      [SOURCE_SYSTEM, TARGET_SYSTEM, txId, entId],
    )).rows;

    let targets = priorGrants.map((grantRow) => ({
      externalGrantId: grantRow.external_grant_id || grantRow.payload?.external_grant_id,
      externalCourseId: grantRow.external_course_id || grantRow.payload?.external_course_id,
      validFrom: grantRow.payload?.valid_from || toIso(validFrom),
      validUntil: grantRow.payload?.valid_until ?? toIso(validUntil),
      localCourseId: grantRow.payload?.metadata?.local_course_id ?? null,
    })).filter((target) => target.externalGrantId && target.externalCourseId);

    if (!targets.length && courseIds.length) {
      const mappingLookup = await resolveCourseMappingsForPurchase(txClient, {
        courseIds,
        videoPackageId,
        requireMappings: false,
      });
      const grantScope = txId ? `tx_${txId}` : `ent_${entId}`;
      targets = mappingLookup.mappings.map((m) => ({
        externalGrantId: `moly:grant:${grantScope}:course_${m.localCourseId}`,
        externalCourseId: m.externalCourseId,
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
        localCourseId: m.localCourseId,
      }));
    }

    if (!targets.length) {
      return { enqueuedCount: 0, revokeOutboxes: [] };
    }

    const corr = correlationId || (txId ? `corr_moly_refund_tx_${txId}` : `corr_moly_revoke_ent_${entId}`);
    const revokeScope = txId ? `refund_tx_${txId}` : `revoke_ent_${entId}`;
    const revokedOutboxes = [];

    for (const target of targets) {
      const sourceUpdatedAt = await allocateMonotonicTimestamp(
        txClient,
        target.externalGrantId,
        revokedAt || now(),
      );
      const revokedAtIso = toIso(revokedAt) || sourceUpdatedAt.toISOString();
      const eventId = `moly:evt:revoke:${target.externalGrantId}:${revokeScope}`;
      const idempotencyKey = `moly:entitlement.revoked:${target.externalGrantId}:${revokeScope}`;

      const wirePayload = {
        event_id: eventId,
        idempotency_key: idempotencyKey,
        correlation_id: corr,
        source_system: SOURCE_SYSTEM,
        external_user_id: `moly:${uid}`,
        external_course_id: target.externalCourseId,
        external_grant_id: target.externalGrantId,
        status: "revoked",
        revoked_at: revokedAtIso,
        reason: String(reason || "payment_refunded").trim().slice(0, 500),
        valid_from: target.validFrom || null,
        valid_until: target.validUntil || null,
        source_updated_at: sourceUpdatedAt.toISOString(),
        metadata: {
          transaction_id: txId,
          entitlement_id: entId,
          local_course_id: target.localCourseId,
          refund_reference: refundReference || null,
          actor: actorId ? `admin:${actorId}` : null,
        },
      };

      const inserted = (await txClient.query(
        `INSERT INTO integration_outbox (
           source_system, target_system, event_id, idempotency_key, correlation_id,
           event_type, aggregate_type, aggregate_id, payload, source_updated_at,
           status, user_id, transaction_id, entitlement_id, external_grant_id, external_course_id, metadata
         )
         VALUES (
           $1, $2, $3, $4, $5,
           'entitlement.revoked', 'entitlement', $6, $7::jsonb, $8,
           'pending', $9, $10, $11, $12, $13, $14::jsonb
         )
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING *`,
        [
          SOURCE_SYSTEM,
          TARGET_SYSTEM,
          eventId,
          idempotencyKey,
          corr,
          target.externalGrantId,
          JSON.stringify(wirePayload),
          sourceUpdatedAt.toISOString(),
          uid,
          txId,
          entId,
          target.externalGrantId,
          target.externalCourseId,
          JSON.stringify({ refund_reference: refundReference || null, actor_id: actorId || null }),
        ],
      )).rows[0];

      if (inserted) {
        revokedOutboxes.push(inserted);
      }
    }

    return { enqueuedCount: revokedOutboxes.length, revokeOutboxes: revokedOutboxes };
  }

  async function recordConflict(
    txClient,
    {
      outboxRow,
      errorCode,
      message,
      conflictDetails = null,
    },
  ) {
    const hasConflicts = (await txClient.query("SELECT to_regclass('integration_conflicts') AS rel")).rows[0]?.rel;
    if (!hasConflicts) return null;

    const payload = outboxRow.payload || {};
    const externalUserId = payload.external_user_id || (outboxRow.user_id ? `moly:${outboxRow.user_id}` : null);
    const conflictType = mapConflictType(
      conflictDetails?.conflict_type || conflictDetails?.errorCode || errorCode,
    );

    const res = await txClient.query(
      `INSERT INTO integration_conflicts (
         source_system, conflict_type, status,
         external_user_id, external_course_id, external_grant_id,
         candidate_user_id, correlation_id, source_updated_at,
         reason, payload, metadata
       )
       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
       RETURNING *`,
      [
        SOURCE_SYSTEM,
        conflictType,
        externalUserId,
        outboxRow.external_course_id || payload.external_course_id || null,
        outboxRow.external_grant_id || payload.external_grant_id || null,
        outboxRow.user_id || null,
        outboxRow.correlation_id || payload.correlation_id || null,
        outboxRow.source_updated_at || null,
        String(message || errorCode || "Course integration conflict requires review.").slice(0, 1000),
        JSON.stringify({
          event_id: outboxRow.event_id,
          idempotency_key: outboxRow.idempotency_key,
          event_type: outboxRow.event_type,
        }),
        JSON.stringify({
          outbox_id: Number(outboxRow.id),
          transaction_id: outboxRow.transaction_id ? Number(outboxRow.transaction_id) : null,
          entitlement_id: outboxRow.entitlement_id ? Number(outboxRow.entitlement_id) : null,
          error_code: String(errorCode || "UNKNOWN"),
        }),
      ],
    );
    return res.rows[0] || null;
  }

  async function dispatchPayloadForOutboxRow(row) {
    const opts = { correlationId: row.correlation_id || row.payload?.correlation_id || `corr_outbox_${row.id}` };
    if (row.event_type === "user.provisioned") {
      return client.provisionUser(row.payload, opts);
    }
    if (row.event_type === "entitlement.granted") {
      return client.grantEntitlement(row.payload, opts);
    }
    if (row.event_type === "entitlement.revoked") {
      return client.revokeEntitlement(row.payload, opts);
    }
    throw new CourseIntegrationClientError(
      422,
      "UNSUPPORTED_EVENT_TYPE",
      `Unsupported outbox event_type: ${row.event_type}`,
      { retryable: false },
    );
  }

  function classifySuccessReceipt(outboxRow, result) {
    const httpStatus = result.httpStatus;
    const body = result.payload || {};
    const remoteData = body.data && typeof body.data === "object" ? body.data : {};
    const inboxId = remoteData.inbox_id ?? null;

    if (httpStatus === 202 || body.queued === true) {
      return {
        outboxStatus: "sent",
        remoteStatus: ["pending", "processing", "queued"].includes(remoteData.status) ? remoteData.status : "queued",
        remoteInboxId: inboxId,
        remoteProcessedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
    }

    if (remoteData.inbox_status === "stale" || remoteData.status === "stale") {
      return {
        outboxStatus: "sent",
        remoteStatus: "stale",
        remoteInboxId: inboxId,
        remoteProcessedAt: now().toISOString(),
        lastErrorCode: "STALE_EVENT",
        lastErrorMessage: "Course recorded this event as stale compared with newer state.",
      };
    }

    if (remoteData.status === "processed" || remoteData.applied === true || body.duplicate === true) {
      return {
        outboxStatus: "sent",
        remoteStatus: ["pending", "processing"].includes(remoteData.status) ? remoteData.status : "processed",
        remoteInboxId: inboxId,
        remoteProcessedAt: ["pending", "processing"].includes(remoteData.status) ? null : now().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      };
    }

    return {
      outboxStatus: "sent",
      remoteStatus: "queued",
      remoteInboxId: inboxId,
      remoteProcessedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
  }

  /**
   * Claims and dispatches one ready outbox job (FOR UPDATE SKIP LOCKED + expired-lease recovery).
   */
  async function dispatchNextOutboxJob({ workerId = "moly-outbox-worker", leaseSeconds = 120 } = {}) {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.outbox.dispatch_halted_kill_switch");
      integrationLog.warn("outbox_dispatch_halted_kill_switch", { workerId });
      return null;
    }
    if (!client || typeof client.provisionUser !== "function") {
      return null;
    }

    const currentNow = now();
    const leaseUntil = new Date(currentNow.getTime() + Math.max(15, Number(leaseSeconds) || 120) * 1000);

    const claimOutcome = await withTx(async (txClient) => {
      const claimRes = await txClient.query(
        `WITH blocked_users AS (
           SELECT DISTINCT p.user_id
           FROM integration_outbox p
           WHERE p.event_type = 'user.provisioned'
             AND p.user_id IS NOT NULL
             AND (
               p.status IN ('pending', 'processing', 'failed')
               OR (p.status = 'sent' AND COALESCE(p.remote_status, 'queued') IN ('queued', 'pending', 'processing'))
             )
         )
         SELECT o.*
         FROM integration_outbox o
         WHERE o.source_system = $1
           AND o.target_system = $2
           AND (
             o.status = 'pending'
             OR (o.status = 'failed' AND o.next_retry_at <= $3)
             OR (o.status = 'processing' AND o.locked_until IS NOT NULL AND o.locked_until <= $3)
           )
           AND (
             o.event_type = 'user.provisioned'
             OR o.user_id IS NULL
             OR o.user_id NOT IN (SELECT user_id FROM blocked_users)
           )
         ORDER BY
           CASE WHEN o.event_type = 'user.provisioned' THEN 0 ELSE 1 END,
           o.next_retry_at ASC,
           o.id ASC
         LIMIT 1
         FOR UPDATE OF o SKIP LOCKED`,
        [SOURCE_SYSTEM, TARGET_SYSTEM, currentNow.toISOString()],
      );

      const candidate = claimRes.rows[0];
      if (!candidate) return null;

      if (Number(candidate.attempt_count) >= Number(candidate.max_attempts)) {
        const exhausted = (await txClient.query(
          `UPDATE integration_outbox
           SET status = 'dead_letter',
               locked_until = NULL,
               locked_by = NULL,
               last_error_code = COALESCE(last_error_code, 'MAX_ATTEMPTS_EXCEEDED'),
               last_error_message = COALESCE(last_error_message, 'Exhausted outbox retry attempts after expired lease.')
           WHERE id = $1
           RETURNING *`,
          [candidate.id],
        )).rows[0];
        await recordConflict(txClient, {
          outboxRow: exhausted,
          errorCode: exhausted.last_error_code,
          message: exhausted.last_error_message,
        });
        return { preFailed: exhausted };
      }

      const leased = (await txClient.query(
        `UPDATE integration_outbox
         SET status = 'processing',
             attempt_count = attempt_count + 1,
             locked_until = $2,
             locked_by = $3
         WHERE id = $1
         RETURNING *`,
        [candidate.id, leaseUntil.toISOString(), workerId],
      )).rows[0];

      return { claimed: leased };
    });

    if (!claimOutcome) return null;
    if (claimOutcome.preFailed) {
      return { outcome: "dead_letter", outbox: claimOutcome.preFailed };
    }

    const claimed = claimOutcome.claimed;
    try {
      const response = await dispatchPayloadForOutboxRow(claimed);
      const classified = classifySuccessReceipt(claimed, response);

      const updated = await withTx(async (txClient) => {
        const res = await txClient.query(
          `UPDATE integration_outbox
           SET status = $2,
               sent_at = COALESCE(sent_at, $3),
               remote_inbox_id = COALESCE($4, remote_inbox_id),
               remote_status = $5,
               remote_response_status = $6,
               remote_response_body = $7::jsonb,
               remote_processed_at = COALESCE($8, remote_processed_at),
               last_error_code = $9,
               last_error_message = $10,
               locked_until = NULL,
               locked_by = NULL
           WHERE id = $1 AND status = 'processing' AND locked_by = $11 AND attempt_count = $12
           RETURNING *`,
          [
            claimed.id,
            classified.outboxStatus,
            now().toISOString(),
            classified.remoteInboxId,
            classified.remoteStatus,
            response.httpStatus,
            JSON.stringify(response.payload || {}),
            classified.remoteProcessedAt,
            classified.lastErrorCode,
            classified.lastErrorMessage,
            workerId,
            claimed.attempt_count,
          ],
        );
        return res.rows[0] || null;
      });

      return updated
        ? { outcome: classified.remoteStatus === "processed" ? "processed" : "sent", httpStatus: response.httpStatus, outbox: updated }
        : { outcome: "lease_lost", outbox: claimed };
    } catch (error) {
      const errCode = String(error?.errorCode || error?.code || "COURSE_LMS_REQUEST_FAILED");
      const errMsg = String(error?.message || "Course integration dispatch failed.").slice(0, 1000);
      const retryable = error instanceof CourseIntegrationClientError
        ? error.retryable
        : true;
      const terminal = !retryable || Number(claimed.attempt_count) >= Number(claimed.max_attempts);
      const nextStatus = terminal ? "dead_letter" : "failed";
      const remoteStatus = !retryable ? "conflict" : (terminal ? "failed" : null);
      const backoffSec = Math.min(maxBackoffSeconds, retryBaseSeconds * (2 ** Math.max(0, Number(claimed.attempt_count) - 1)));
      const nextRetryAt = new Date(now().getTime() + backoffSec * 1000).toISOString();

      const updated = await withTx(async (txClient) => {
        const res = await txClient.query(
          `UPDATE integration_outbox
           SET status = $2,
               remote_status = COALESCE($3, remote_status),
               remote_response_status = COALESCE($4, remote_response_status),
               last_error_code = $5,
               last_error_message = $6,
               next_retry_at = $7,
               locked_until = NULL,
               locked_by = NULL
           WHERE id = $1 AND status = 'processing' AND locked_by = $8 AND attempt_count = $9
           RETURNING *`,
          [
            claimed.id,
            nextStatus,
            remoteStatus,
            error?.status || null,
            errCode,
            errMsg,
            nextRetryAt,
            workerId,
            claimed.attempt_count,
          ],
        );
        const row = res.rows[0] || null;
        if (row && terminal) {
          await recordConflict(txClient, {
            outboxRow: row,
            errorCode: errCode,
            message: errMsg,
            conflictDetails: error?.details,
          });
        }
        return row;
      });

      logger?.warn?.("[course-outbox] Dispatch failed", {
        outboxId: Number(claimed.id),
        eventId: claimed.event_id,
        nextStatus,
        errorCode: errCode,
        attempt: claimed.attempt_count,
      });

      return { outcome: nextStatus, errorCode: errCode, outbox: updated || claimed };
    }
  }

  /**
   * Polls CSCA-Course `/api/integrations/v1/moly/events/status` for outbox items that received
   * HTTP 202 (`queued`/`pending`/`processing`) so final sync status is authoritative.
   */
  async function reconcileSentOutboxEvents({ limit = 25 } = {}) {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.outbox.reconcile_sent_halted_kill_switch");
      integrationLog.warn("outbox_reconcile_sent_halted_kill_switch", { limit });
      return [];
    }
    if (!client || typeof client.getEventStatuses !== "function") {
      return [];
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const candidates = (await db.query(
      `SELECT *
       FROM integration_outbox
       WHERE source_system = $1
         AND target_system = $2
         AND status = 'sent'
         AND (remote_status IS NULL OR remote_status IN ('queued', 'pending', 'processing'))
       ORDER BY last_status_checked_at NULLS FIRST, id ASC
       LIMIT $3`,
      [SOURCE_SYSTEM, TARGET_SYSTEM, safeLimit],
    )).rows;

    const results = [];
    for (const row of candidates) {
      try {
        const res = await client.getEventStatuses({
          correlationId: row.correlation_id || `reconcile_${row.id}`,
          eventId: row.event_id,
          idempotencyKey: row.idempotency_key,
        });
        const inboxRow = res.payload.data.find((item) => item.event_id === row.event_id)
          || res.payload.data[0]
          || null;
        const checkedAt = now().toISOString();

        if (!inboxRow) {
          await db.query(
            "UPDATE integration_outbox SET last_status_checked_at = $2 WHERE id = $1",
            [row.id, checkedAt],
          );
          results.push({ id: Number(row.id), eventId: row.event_id, remoteStatus: row.remote_status || "unknown" });
          continue;
        }

        const remoteStatus = inboxRow.status;
        const isFinalOk = ["processed", "stale", "ignored"].includes(remoteStatus);
        const isDeadLetter = remoteStatus === "dead_letter";
        const updated = await withTx(async (txClient) => {
          const upd = (await txClient.query(
            `UPDATE integration_outbox
             SET status = CASE WHEN $2::boolean THEN 'dead_letter' ELSE status END,
                 remote_inbox_id = COALESCE($3, remote_inbox_id),
                 remote_status = $4,
                 remote_response_status = COALESCE($5, remote_response_status),
                 remote_response_body = COALESCE($6::jsonb, remote_response_body),
                 remote_processed_at = CASE WHEN $7::boolean THEN COALESCE($8, NOW()) ELSE remote_processed_at END,
                 last_status_checked_at = $9,
                 last_error_code = $10,
                 last_error_message = $11
             WHERE id = $1
             RETURNING *`,
            [
              row.id,
              isDeadLetter,
              inboxRow.id ?? null,
              remoteStatus,
              inboxRow.response_status ?? null,
              inboxRow.response_body ? JSON.stringify(inboxRow.response_body) : null,
              isFinalOk,
              inboxRow.processed_at || null,
              checkedAt,
              inboxRow.last_error_code || null,
              inboxRow.last_error_message || null,
            ],
          )).rows[0];

          if (isDeadLetter && upd) {
            await recordConflict(txClient, {
              outboxRow: upd,
              errorCode: inboxRow.last_error_code || "REMOTE_DEAD_LETTER",
              message: inboxRow.last_error_message || "Course inbox worker moved event to dead_letter.",
            });
          }
          return upd;
        });

        results.push({
          id: Number(row.id),
          eventId: row.event_id,
          remoteStatus,
          outbox: updated,
        });
      } catch (error) {
        await db.query(
          "UPDATE integration_outbox SET last_status_checked_at = $2 WHERE id = $1",
          [row.id, now().toISOString()],
        ).catch(() => {});
        results.push({
          id: Number(row.id),
          eventId: row.event_id,
          errorCode: error?.errorCode || error?.code || "STATUS_POLL_FAILED",
        });
      }
    }

    return results;
  }

  /**
   * Reconciles previously dispatched 202 events, dispatches pending/retryable jobs,
   * and optionally polls newly dispatched items.
   */
  async function processAvailableOutboxJobs({
    workerId = "moly-outbox-worker",
    limit = 20,
    leaseSeconds = 120,
    reconcileBefore = true,
    reconcileAfter = false,
  } = {}) {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.outbox.batch_halted_kill_switch");
      integrationLog.warn("outbox_batch_halted_kill_switch", { workerId, limit });
      return {
        dispatched: [],
        reconciledBefore: [],
        reconciledAfter: [],
        haltedByKillSwitch: true,
      };
    }
    if (!(await hasIntegrationTables(db))) {
      return { reconciledBefore: [], dispatched: [], reconciledAfter: [] };
    }
    const reconciledBefore = reconcileBefore ? await reconcileSentOutboxEvents({ limit }) : [];
    const dispatched = [];
    const cap = Math.min(Math.max(Number(limit) || 20, 1), 100);
    for (let i = 0; i < cap; i += 1) {
      const item = await dispatchNextOutboxJob({ workerId, leaseSeconds });
      if (!item) break;
      dispatched.push(item);
    }
    const reconciledAfter = reconcileAfter ? await reconcileSentOutboxEvents({ limit }) : [];
    return { reconciledBefore, dispatched, reconciledAfter };
  }

  async function retryOutboxItem({ outboxId, actorId = null, correlationId = null, dispatchNow = false } = {}) {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.outbox.manual_retry_blocked_kill_switch");
      throw new CourseApiError(
        503,
        "INTEGRATION_KILL_SWITCH_ACTIVE",
        "Course integration sync is disabled by emergency kill switch.",
      );
    }
    const id = Number(outboxId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Valid outboxId is required.");
    }
    const corr = resolveCorrelationId(correlationId);

    const updated = await withTx(async (txClient) => {
      const row = (await txClient.query(
        "SELECT * FROM integration_outbox WHERE id = $1 FOR UPDATE",
        [id],
      )).rows[0];
      if (!row) {
        throw new CourseApiError(404, "NOT_FOUND", `Outbox event ${id} not found.`);
      }
      if (row.status === "sent" && row.remote_status === "processed") {
        return { retried: false, alreadyProcessed: true, outbox: row };
      }
      if (!["failed", "dead_letter", "pending", "sent"].includes(row.status)) {
        throw new CourseApiError(
          409,
          "OUTBOX_RETRY_NOT_ALLOWED",
          `Cannot manually retry outbox event while status is '${row.status}'.`,
        );
      }

      if (row.user_id) {
        const openIdentityConflicts = (await txClient.query(
          `SELECT id, conflict_type
           FROM integration_conflicts
           WHERE status = 'open'
             AND conflict_type LIKE 'IDENTITY_%'
             AND (candidate_user_id = $1 OR external_user_id = $2)
           LIMIT 1`,
          [row.user_id, `moly:${row.user_id}`],
        )).rows;
        if (openIdentityConflicts.length > 0) {
          throw new CourseApiError(
            409,
            "OPEN_IDENTITY_CONFLICT",
            "Resolve open identity conflict manually before retrying this outbox event.",
            { conflictId: Number(openIdentityConflicts[0].id), conflictType: openIdentityConflicts[0].conflict_type },
          );
        }
      }

      const resetRow = (await txClient.query(
        `UPDATE integration_outbox
         SET status = 'pending',
             remote_status = NULL,
             max_attempts = GREATEST(max_attempts, attempt_count + 3),
             next_retry_at = $2,
             locked_until = NULL,
             locked_by = NULL,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = $2
         WHERE id = $1
         RETURNING id, event_id, idempotency_key, correlation_id, event_type, aggregate_id,
                   status, remote_status, attempt_count, max_attempts, next_retry_at,
                   user_id, entitlement_id, external_grant_id, external_course_id,
                   created_at, updated_at`,
        [id, now().toISOString()],
      )).rows[0];

      recordMetric("moly.outbox.manual_retry");
      integrationLog.info(
        "outbox_manual_retry",
        {
          outboxId: id,
          eventId: row.event_id,
          eventType: row.event_type,
          previousStatus: row.status,
          actorId: actorId ?? null,
        },
        corr,
      );
      return { retried: true, outbox: resetRow };
    });

    if (dispatchNow && updated.retried && client && typeof client.provisionUser === "function") {
      const batch = await processAvailableOutboxJobs({
        workerId: `admin-retry:${actorId ?? "system"}`,
        limit: 10,
        reconcileBefore: false,
        reconcileAfter: true,
      });
      return { ...updated, batch };
    }
    return updated;
  }

  function kickSync() {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.outbox.kick_halted_kill_switch");
      return Promise.resolve(null);
    }
    if (!client?.isConfigured?.()) return Promise.resolve(null);
    return processAvailableOutboxJobs({
      workerId: `moly-kick-${process.pid}`,
      limit: 10,
      reconcileBefore: true,
      reconcileAfter: true,
    }).catch((error) => {
      integrationLog.warn("outbox_async_sync_deferred", {
        code: error?.code || "SYNC_DEFERRED",
      });
      return null;
    });
  }

  return {
    resolveCourseMappingsForPurchase,
    enqueueProvisionEventTx,
    enqueueProvisionAndGrantTx,
    enqueueEntitlementRevokeTx,
    dispatchNextOutboxJob,
    reconcileSentOutboxEvents,
    processAvailableOutboxJobs,
    retryOutboxItem,
    kickSync,
  };
}

module.exports = {
  SOURCE_SYSTEM,
  TARGET_SYSTEM,
  createCourseOutboxSyncService,
};
