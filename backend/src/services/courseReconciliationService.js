const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const {
  createIntegrationLogger,
  getIntegrationMetricsSnapshot,
  isIntegrationKillSwitchActive,
  observeMetricLatency,
  recordMetric,
  resolveCorrelationId,
} = require("../utils/integrationLogger");

const SOURCE_SYSTEM = "moly";
const TARGET_SYSTEM = "csca-course";

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

function buildExpectedGrantId({ transactionId, entitlementId, localCourseId }) {
  const scope = transactionId != null ? `tx_${transactionId}` : `ent_${entitlementId}`;
  return `moly:grant:${scope}:course_${localCourseId}`;
}

/**
 * Day 5 reconciliation, operations overview, and safe conflict resolution service
 * for Moly Studio <-> CSCA-Course integration.
 */
function createCourseReconciliationService({
  db,
  client = null,
  outbox = null,
  now = () => new Date(),
  staleThresholdMinutes = 10,
  env = process.env,
  logger = null,
} = {}) {
  const integrationLog = logger && typeof logger.info === "function"
    ? logger
    : createIntegrationLogger({ component: "course-reconciliation", env });

  async function withTx(work) {
    if (typeof db.transaction === "function") return db.transaction(work);
    if (db.pool && typeof db.pool.connect === "function") {
      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");
        const val = await work(conn);
        await conn.query("COMMIT");
        return val;
      } catch (err) {
        await conn.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        conn.release();
      }
    }
    return work(db);
  }

  async function schemaCaps(runner = db) {
    const res = await runner.query(
      `SELECT
         to_regclass('integration_outbox') IS NOT NULL AS has_outbox,
         to_regclass('integration_conflicts') IS NOT NULL AS has_conflicts,
         to_regclass('external_course_mappings') IS NOT NULL AS has_mappings,
         to_regclass('external_identities') IS NOT NULL AS has_identities,
         to_regclass('external_entitlements') IS NOT NULL AS has_ext_entitlements,
         to_regclass('user_video_entitlements') IS NOT NULL AS has_video_entitlements,
         to_regclass('video_entitlement_courses') IS NOT NULL AS has_video_ent_courses,
         to_regclass('video_package_courses') IS NOT NULL AS has_video_pkg_courses,
         to_regclass('video_packages') IS NOT NULL AS has_video_packages,
         to_regclass('integration_reconciliation_runs') IS NOT NULL AS has_recon_runs,
         to_regclass('integration_reconciliation_actions') IS NOT NULL AS has_recon_actions`,
    );
    return res.rows[0] || {};
  }

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

  async function recordRunStart({ corr, triggerMode, dryRun, triggeredBy, scopeFilter }) {
    const caps = await schemaCaps(db);
    if (!caps.has_recon_runs) return null;
    const inserted = (await db.query(
      `INSERT INTO integration_reconciliation_runs (
         correlation_id, trigger_mode, dry_run, status, triggered_by, scope_filter
       ) VALUES ($1, $2, $3, 'running', $4, $5::jsonb)
       RETURNING *`,
      [
        corr,
        ["scheduled", "manual", "api"].includes(triggerMode) ? triggerMode : "manual",
        Boolean(dryRun),
        triggeredBy ?? null,
        JSON.stringify(scopeFilter || {}),
      ],
    )).rows[0];
    return inserted || null;
  }

  async function finalizeRun(runId, { status, summaryCounts = {}, errorCode = null, errorMessage = null, actions = [] }) {
    if (!runId) return null;
    const caps = await schemaCaps(db);
    if (caps.has_recon_actions && actions.length > 0) {
      for (const act of actions) {
        await db.query(
          `INSERT INTO integration_reconciliation_actions (
             run_id, correlation_id, category, action_taken, source_system,
             user_id, local_course_id, external_user_id, external_course_id,
             external_grant_id, outbox_id, conflict_id, details
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
          [
            runId,
            act.correlationId,
            act.category,
            act.actionTaken,
            act.sourceSystem || TARGET_SYSTEM,
            act.userId ?? null,
            act.localCourseId ?? null,
            act.externalUserId ?? null,
            act.externalCourseId ?? null,
            act.externalGrantId ?? null,
            act.outboxId ?? null,
            act.conflictId ?? null,
            JSON.stringify(act.details || {}),
          ],
        );
      }
    }
    const updated = (await db.query(
      `UPDATE integration_reconciliation_runs
       SET status = $2,
           summary_counts = $3::jsonb,
           last_error_code = $4,
           last_error_message = $5,
           completed_at = $6
       WHERE id = $1
       RETURNING *`,
      [
        runId,
        status,
        JSON.stringify(summaryCounts),
        errorCode,
        errorMessage ? String(errorMessage).slice(0, 500) : null,
        now().toISOString(),
      ],
    )).rows[0];
    return updated || null;
  }

  async function enqueueRepairOutboxEvent(txClient, {
    eventType,
    externalGrantId,
    externalCourseId,
    userRow,
    entitlementRow,
    localCourseId,
    correlationId,
    reason = "reconciliation_repair",
  }) {
    const idempotencyKey = eventType === "entitlement.granted"
      ? `moly:recon:grant:${externalGrantId}:v1`
      : `moly:recon:revoke:${externalGrantId}:v1`;
    const eventId = eventType === "entitlement.granted"
      ? `moly:evt:recon:grant:${externalGrantId}:v1`
      : `moly:evt:recon:revoke:${externalGrantId}:v1`;

    // Do not duplicate an in-flight/already-created repair event or active pending outbox event.
    const existing = (await txClient.query(
      `SELECT id, status, remote_status, idempotency_key
       FROM integration_outbox
       WHERE idempotency_key = $1
          OR (external_grant_id = $2
              AND event_type = $3
              AND (status IN ('pending', 'processing')
                   OR (status = 'sent' AND remote_status IN ('queued', 'pending', 'processing'))))
       ORDER BY id DESC
       LIMIT 1`,
      [idempotencyKey, externalGrantId, eventType],
    )).rows[0];
    if (existing) {
      return { enqueued: false, outbox: existing, idempotentReuse: true };
    }

    if (eventType === "entitlement.granted" && outbox && typeof outbox.enqueueProvisionEventTx === "function") {
      await outbox.enqueueProvisionEventTx(txClient, {
        user: userRow,
        correlationId,
        trigger: "reconciliation",
        metadata: {
          entitlement_id: Number(entitlementRow.id),
          transaction_id: entitlementRow.transaction_id ?? null,
        },
      });
    }

    await txClient.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      ["moly:recon-repair", externalGrantId],
    );

    const preferredTs = eventType === "entitlement.revoked"
      ? (entitlementRow.revoked_at || entitlementRow.expires_at || now())
      : (entitlementRow.starts_at || entitlementRow.created_at || now());
    const sourceUpdatedAt = await allocateMonotonicTimestamp(txClient, externalGrantId, preferredTs);
    const uid = Number(userRow.id);
    const txId = entitlementRow.transaction_id != null ? Number(entitlementRow.transaction_id) : null;
    const entId = Number(entitlementRow.id);

    const wirePayload = eventType === "entitlement.granted"
      ? {
        event_id: eventId,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        source_system: SOURCE_SYSTEM,
        external_user_id: `moly:${uid}`,
        external_course_id: externalCourseId,
        external_grant_id: externalGrantId,
        status: "active",
        valid_from: toIso(entitlementRow.starts_at || entitlementRow.created_at || now()),
        valid_until: toIso(entitlementRow.expires_at),
        source_updated_at: sourceUpdatedAt.toISOString(),
        metadata: {
          trigger: "reconciliation",
          transaction_id: txId,
          entitlement_id: entId,
          local_course_id: Number(localCourseId),
        },
      }
      : {
        event_id: eventId,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        source_system: SOURCE_SYSTEM,
        external_user_id: `moly:${uid}`,
        external_course_id: externalCourseId,
        external_grant_id: externalGrantId,
        status: "revoked",
        revoked_at: toIso(entitlementRow.revoked_at || entitlementRow.expires_at || sourceUpdatedAt),
        reason,
        valid_from: toIso(entitlementRow.starts_at || entitlementRow.created_at),
        valid_until: toIso(entitlementRow.expires_at),
        source_updated_at: sourceUpdatedAt.toISOString(),
        metadata: {
          trigger: "reconciliation",
          transaction_id: txId,
          entitlement_id: entId,
          local_course_id: Number(localCourseId),
        },
      };

    const inserted = (await txClient.query(
      `INSERT INTO integration_outbox (
         source_system, target_system, event_id, idempotency_key, correlation_id,
         event_type, aggregate_type, aggregate_id, payload, source_updated_at,
         status, user_id, transaction_id, entitlement_id, external_grant_id, external_course_id, metadata
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, 'entitlement', $7, $8::jsonb, $9,
         'pending', $10, $11, $12, $13, $14, $15::jsonb
       )
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        SOURCE_SYSTEM,
        TARGET_SYSTEM,
        eventId,
        idempotencyKey,
        correlationId,
        eventType,
        externalGrantId,
        JSON.stringify(wirePayload),
        sourceUpdatedAt.toISOString(),
        uid,
        txId,
        entId,
        externalGrantId,
        externalCourseId,
        JSON.stringify({ trigger: "reconciliation", local_course_id: Number(localCourseId) }),
      ],
    )).rows[0] || null;

    if (!inserted) {
      const winner = (await txClient.query(
        "SELECT id, status, remote_status, idempotency_key FROM integration_outbox WHERE idempotency_key = $1",
        [idempotencyKey],
      )).rows[0] || null;
      return { enqueued: false, outbox: winner, idempotentReuse: true };
    }
    return { enqueued: true, outbox: inserted, idempotentReuse: false };
  }

  /**
   * Executes two-way reconciliation between Moly Studio and CSCA-Course.
   * Preserves all open identity conflicts untouched and never guesses missing mappings.
   */
  async function runReconciliation({
    dryRun = true,
    triggerMode = "manual",
    triggeredBy = null,
    scopeFilter = {},
    correlationId = null,
    limit = 500,
    staleMinutes = staleThresholdMinutes,
    dispatchRepairs = true,
  } = {}) {
    const startMs = Date.now();
    const corr = resolveCorrelationId(correlationId);
    const parsedUserFilter = scopeFilter?.userId != null ? Number(scopeFilter.userId) : null;
    const extUserFilter = scopeFilter?.externalUserId
      || (Number.isSafeInteger(parsedUserFilter) && parsedUserFilter > 0 ? `moly:${parsedUserFilter}` : null);
    const extCourseFilter = scopeFilter?.externalCourseId || null;

    const runRow = await recordRunStart({
      corr,
      triggerMode,
      dryRun,
      triggeredBy,
      scopeFilter: {
        ...(extUserFilter ? { externalUserId: extUserFilter } : {}),
        ...(extCourseFilter ? { externalCourseId: extCourseFilter } : {}),
        staleMinutes,
      },
    });

    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.reconciliation.blocked_kill_switch");
      integrationLog.warn("reconciliation_blocked_kill_switch", { dryRun, triggerMode }, corr);
      await finalizeRun(runRow?.id, {
        status: "aborted_kill_switch",
        summaryCounts: { blocked_by_kill_switch: true },
        errorCode: "INTEGRATION_KILL_SWITCH_ACTIVE",
        errorMessage: "Course integration sync is disabled by emergency kill switch.",
      });
      throw new CourseApiError(
        503,
        "INTEGRATION_KILL_SWITCH_ACTIVE",
        "Course integration sync is disabled by emergency kill switch.",
      );
    }

    if (!client || typeof client.queryReconciliationSnapshot !== "function" || !client.isConfigured()) {
      await finalizeRun(runRow?.id, {
        status: "failed",
        errorCode: "COURSE_LMS_NOT_CONFIGURED",
        errorMessage: "CSCA-Course integration credentials are not configured.",
      });
      throw new CourseApiError(
        503,
        "COURSE_LMS_NOT_CONFIGURED",
        "CSCA-Course integration credentials are not configured.",
      );
    }

    let snapshotRes;
    try {
      snapshotRes = await client.queryReconciliationSnapshot({
        correlationId: corr,
        externalUserId: extUserFilter,
        externalCourseId: extCourseFilter,
        limit,
      });
    } catch (error) {
      await finalizeRun(runRow?.id, {
        status: "failed",
        errorCode: error?.errorCode || error?.code || "RECONCILIATION_SNAPSHOT_FAILED",
        errorMessage: error?.message || "Failed to fetch CSCA-Course reconciliation snapshot.",
      });
      throw error;
    }

    const remote = snapshotRes.payload.data || {};
    const remoteIdentities = Array.isArray(remote.identities) ? remote.identities : [];
    const remoteConflicts = Array.isArray(remote.open_conflicts) ? remote.open_conflicts : [];
    const remoteEntitlements = Array.isArray(remote.entitlements) ? remote.entitlements : [];
    const remoteCourseMappings = Array.isArray(remote.course_mappings) ? remote.course_mappings : [];
    const remoteInboxSummary = remote.inbox_summary || {};

    const caps = await schemaCaps(db);
    const currentNow = now();
    const nowMs = currentNow.getTime();
    const staleCutoffIso = new Date(nowMs - Math.max(1, Number(staleMinutes) || 10) * 60000).toISOString();

    const localMappings = caps.has_mappings
      ? (await db.query(
        `SELECT * FROM external_course_mappings
         WHERE source_system IN ('moly', 'csca-course')
         ORDER BY id ASC`,
      )).rows
      : [];
    const localConflicts = caps.has_conflicts
      ? (await db.query(
        `SELECT id, source_system, conflict_type, status, external_user_id, external_course_id,
                external_grant_id, candidate_user_id, existing_user_id, local_course_id,
                correlation_id, reason, created_at
         FROM integration_conflicts
         WHERE status IN ('open', 'in_review')
         ORDER BY id DESC`,
      )).rows
      : [];
    const localVideoEntitlements = caps.has_video_entitlements && caps.has_video_ent_courses
      ? (await db.query(
        `SELECT e.id AS entitlement_id, e.user_id, e.video_package_id, e.transaction_id,
                e.status, e.starts_at, e.expires_at, e.revoked_at, e.reason, e.created_at,
                ec.course_id AS local_course_id,
                u.email AS user_email, u.username AS user_username, u.full_name AS user_full_name,
                u.is_active AS user_is_active, u.role AS user_role
         FROM user_video_entitlements e
         JOIN video_entitlement_courses ec ON ec.entitlement_id = e.id
         JOIN users u ON u.id = e.user_id
         WHERE ($1::int IS NULL OR e.user_id = $1)
         ORDER BY e.id DESC, ec.course_id ASC`,
        [Number.isSafeInteger(parsedUserFilter) ? parsedUserFilter : null],
      )).rows
      : [];
    const localExtEntitlements = caps.has_ext_entitlements
      ? (await db.query(
        `SELECT id, source_system, external_user_id, user_id, local_course_id,
                external_course_id, external_grant_id, status, valid_from, valid_until,
                effective_owned, origin_system, source_updated_at
         FROM external_entitlements
         WHERE ($1::int IS NULL OR user_id = $1)
         ORDER BY id DESC`,
        [Number.isSafeInteger(parsedUserFilter) ? parsedUserFilter : null],
      )).rows
      : [];
    const localOutboxRows = caps.has_outbox
      ? (await db.query(
        `SELECT id, event_id, idempotency_key, correlation_id, event_type, aggregate_id,
                status, remote_status, attempt_count, max_attempts, next_retry_at,
                sent_at, last_error_code, user_id, transaction_id, entitlement_id,
                external_grant_id, external_course_id, created_at, updated_at
         FROM integration_outbox
         WHERE ($1::int IS NULL OR user_id = $1)
         ORDER BY id DESC`,
        [Number.isSafeInteger(parsedUserFilter) ? parsedUserFilter : null],
      )).rows
      : [];

    // Build lookups.
    const activeMappingByLocalCourse = new Map();
    for (const m of localMappings) {
      if (m.status !== "active") continue;
      const offeringId = normalizeMolyOfferingId(m);
      if (offeringId && !activeMappingByLocalCourse.has(Number(m.local_course_id))) {
        activeMappingByLocalCourse.set(Number(m.local_course_id), {
          ...m,
          offeringId,
        });
      }
    }

    const remoteActiveMappingOfferings = new Set();
    for (const rm of remoteCourseMappings) {
      if (rm.status !== "active") continue;
      const offeringId = normalizeMolyOfferingId(rm);
      if (offeringId) remoteActiveMappingOfferings.add(offeringId);
    }

    const remoteIdentityByExtUser = new Map();
    for (const ident of remoteIdentities) {
      if (ident.external_user_id) {
        remoteIdentityByExtUser.set(ident.external_user_id, ident);
      }
    }

    // Open conflict tracking across BOTH systems. Never auto-repair quarantined subjects!
    const conflictExtUsers = new Set();
    const conflictLocalUsers = new Set();
    const actions = [];
    const summaryCounts = {
      local_active_remote_missing: 0,
      local_revoked_remote_active: 0,
      remote_active_unknown_on_moly: 0,
      missing_course_mapping: 0,
      identity_missing_or_conflict: 0,
      stale_pending_event: 0,
      dead_letter_event: 0,
      repaired_grant: 0,
      repaired_revoke: 0,
      reused_idempotent: 0,
      total_discrepancies: 0,
    };

    const seenConflictKeys = new Set();
    for (const c of [...localConflicts, ...remoteConflicts]) {
      if (c.external_user_id) conflictExtUsers.add(c.external_user_id);
      if (c.candidate_user_id != null) {
        conflictLocalUsers.add(Number(c.candidate_user_id));
        conflictExtUsers.add(`moly:${Number(c.candidate_user_id)}`);
      }
      if (c.existing_user_id != null) {
        conflictLocalUsers.add(Number(c.existing_user_id));
      }
      const dedupeKey = `${c.conflict_type}|${c.external_user_id || c.candidate_user_id || c.id}|${c.external_grant_id || ""}`;
      if (seenConflictKeys.has(dedupeKey)) continue;
      seenConflictKeys.add(dedupeKey);
      summaryCounts.identity_missing_or_conflict += 1;
      actions.push({
        correlationId: corr,
        category: "identity_missing_or_conflict",
        actionTaken: "preserved_untouched",
        sourceSystem: c.source_system || TARGET_SYSTEM,
        userId: c.candidate_user_id != null ? Number(c.candidate_user_id) : null,
        localCourseId: c.local_course_id != null ? Number(c.local_course_id) : null,
        externalUserId: c.external_user_id || null,
        externalCourseId: c.external_course_id || null,
        externalGrantId: c.external_grant_id || null,
        conflictId: c.id != null ? Number(c.id) : null,
        details: {
          conflict_type: c.conflict_type,
          status: c.status,
          reason: c.reason,
        },
      });
    }

    for (const ident of remoteIdentities) {
      if (ident.status !== "active") {
        conflictExtUsers.add(ident.external_user_id);
        summaryCounts.identity_missing_or_conflict += 1;
        actions.push({
          correlationId: corr,
          category: "identity_missing_or_conflict",
          actionTaken: "preserved_untouched",
          sourceSystem: TARGET_SYSTEM,
          externalUserId: ident.external_user_id,
          details: {
            identity_status: ident.status,
            remote_local_user_id: ident.user_id ?? null,
          },
        });
      }
    }

    // Index remote grants.
    const remoteByGrantId = new Map();
    for (const re of remoteEntitlements) {
      if (re.external_grant_id) {
        remoteByGrantId.set(re.external_grant_id, re);
      }
    }

    // Index outbox original saved grant ids by (entitlement_id, local_course_id) when present.
    const outboxGrantByEntCourse = new Map();
    for (const ob of localOutboxRows) {
      if (ob.event_type === "entitlement.granted" && ob.entitlement_id && ob.external_grant_id) {
        outboxGrantByEntCourse.set(`${Number(ob.entitlement_id)}:${ob.external_grant_id}`, ob);
      }
    }

    const knownLocalGrantIds = new Set();
    const knownLocalMirroredGrantIds = new Set(
      localExtEntitlements.map((row) => row.external_grant_id).filter(Boolean),
    );
    const repairedOutboxIds = [];
    const seenMissingCourseIds = new Set();

    // Check unmapped courses used in active video_package_courses too.
    if (caps.has_video_pkg_courses && caps.has_video_packages) {
      const pkgCourseRows = (await db.query(
        `SELECT DISTINCT vpc.course_id
         FROM video_package_courses vpc
         JOIN video_packages vp ON vp.id = vpc.video_package_id
         WHERE vp.status = 'active'`,
      )).rows;
      for (const row of pkgCourseRows) {
        const lcid = Number(row.course_id);
        if (!activeMappingByLocalCourse.has(lcid) && !seenMissingCourseIds.has(lcid)) {
          seenMissingCourseIds.add(lcid);
          summaryCounts.missing_course_mapping += 1;
          actions.push({
            correlationId: corr,
            category: "missing_course_mapping",
            actionTaken: "manual_mapping_required",
            sourceSystem: SOURCE_SYSTEM,
            localCourseId: lcid,
            details: { source: "published_video_package_course" },
          });
        }
      }
    }

    // 1) Reconcile every Moly local entitlement course pair -> Course.
    for (const ent of localVideoEntitlements) {
      const uid = Number(ent.user_id);
      const extUserId = `moly:${uid}`;
      const localCourseId = Number(ent.local_course_id);
      const mapping = activeMappingByLocalCourse.get(localCourseId) || null;
      const expectedGrantId = buildExpectedGrantId({
        transactionId: ent.transaction_id,
        entitlementId: ent.entitlement_id,
        localCourseId,
      });
      knownLocalGrantIds.add(expectedGrantId);

      // Track any historical tx/ent alternate key too if present in outbox.
      const startsOk = !ent.starts_at || new Date(ent.starts_at).getTime() <= nowMs;
      const notExpired = !ent.expires_at || new Date(ent.expires_at).getTime() > nowMs;
      const isLocalActive = ent.status === "active" && startsOk && notExpired && ent.user_is_active !== false;
      const isLocalRevokedOrExpired = ent.status === "revoked" || (ent.expires_at && new Date(ent.expires_at).getTime() <= nowMs);

      const remoteMatch = remoteByGrantId.get(expectedGrantId) || null;

      if (!mapping) {
        if (isLocalActive && !seenMissingCourseIds.has(localCourseId)) {
          seenMissingCourseIds.add(localCourseId);
          summaryCounts.missing_course_mapping += 1;
          actions.push({
            correlationId: corr,
            category: "missing_course_mapping",
            actionTaken: "manual_mapping_required",
            sourceSystem: SOURCE_SYSTEM,
            userId: uid,
            localCourseId,
            externalUserId: extUserId,
            externalGrantId: expectedGrantId,
            details: { entitlement_id: Number(ent.entitlement_id) },
          });
        }
        continue;
      }

      const hasRemoteMapping = remoteActiveMappingOfferings.size === 0
        || remoteActiveMappingOfferings.has(mapping.offeringId);
      if (!hasRemoteMapping && isLocalActive) {
        summaryCounts.missing_course_mapping += 1;
        actions.push({
          correlationId: corr,
          category: "missing_course_mapping",
          actionTaken: "manual_mapping_required",
          sourceSystem: TARGET_SYSTEM,
          userId: uid,
          localCourseId,
          externalUserId: extUserId,
          externalCourseId: mapping.offeringId,
          externalGrantId: expectedGrantId,
          details: { reason: "CSCA-Course lacks active mapping for external offering." },
        });
        continue;
      }

      const conflictBlocked = conflictExtUsers.has(extUserId) || conflictLocalUsers.has(uid);
      const remoteIdentity = remoteIdentityByExtUser.get(extUserId) || null;
      const identityAmbiguous = conflictBlocked || (remoteIdentity && remoteIdentity.status !== "active");

      // Category 1: local active vs remote missing.
      if (isLocalActive && (!remoteMatch || remoteMatch.effective_active !== true)) {
        summaryCounts.local_active_remote_missing += 1;
        if (identityAmbiguous) {
          actions.push({
            correlationId: corr,
            category: "identity_missing_or_conflict",
            actionTaken: "skipped_due_to_open_conflict",
            sourceSystem: SOURCE_SYSTEM,
            userId: uid,
            localCourseId,
            externalUserId: extUserId,
            externalCourseId: mapping.offeringId,
            externalGrantId: expectedGrantId,
            details: { intended_repair: "entitlement.granted" },
          });
          continue;
        }

        if (dryRun) {
          actions.push({
            correlationId: corr,
            category: "local_active_remote_missing",
            actionTaken: "planned_enqueue_grant",
            sourceSystem: SOURCE_SYSTEM,
            userId: uid,
            localCourseId,
            externalUserId: extUserId,
            externalCourseId: mapping.offeringId,
            externalGrantId: expectedGrantId,
            details: { remote_status: remoteMatch?.status || "missing" },
          });
          continue;
        }

        const repairRes = await withTx((txClient) =>
          enqueueRepairOutboxEvent(txClient, {
            eventType: "entitlement.granted",
            externalGrantId: expectedGrantId,
            externalCourseId: mapping.offeringId,
            userRow: {
              id: uid,
              email: ent.user_email,
              username: ent.user_username,
              full_name: ent.user_full_name,
              is_active: ent.user_is_active,
            },
            entitlementRow: {
              id: ent.entitlement_id,
              transaction_id: ent.transaction_id,
              starts_at: ent.starts_at,
              expires_at: ent.expires_at,
              created_at: ent.created_at,
            },
            localCourseId,
            correlationId: corr,
          }),
        );
        if (repairRes.enqueued && repairRes.outbox?.id) {
          summaryCounts.repaired_grant += 1;
          repairedOutboxIds.push(Number(repairRes.outbox.id));
        } else if (repairRes.idempotentReuse) {
          summaryCounts.reused_idempotent += 1;
        }
        actions.push({
          correlationId: corr,
          category: "local_active_remote_missing",
          actionTaken: repairRes.enqueued ? "enqueued_grant_repair" : "already_queued_idempotent",
          sourceSystem: SOURCE_SYSTEM,
          userId: uid,
          localCourseId,
          externalUserId: extUserId,
          externalCourseId: mapping.offeringId,
          externalGrantId: expectedGrantId,
          outboxId: repairRes.outbox?.id != null ? Number(repairRes.outbox.id) : null,
          details: { remote_status: remoteMatch?.status || "missing" },
        });
      }

      // Category 2: local revoked/expired vs remote active.
      if (!isLocalActive && isLocalRevokedOrExpired && remoteMatch && remoteMatch.effective_active === true) {
        summaryCounts.local_revoked_remote_active += 1;
        if (identityAmbiguous) {
          actions.push({
            correlationId: corr,
            category: "identity_missing_or_conflict",
            actionTaken: "skipped_due_to_open_conflict",
            sourceSystem: SOURCE_SYSTEM,
            userId: uid,
            localCourseId,
            externalUserId: extUserId,
            externalCourseId: mapping.offeringId,
            externalGrantId: expectedGrantId,
            details: { intended_repair: "entitlement.revoked" },
          });
          continue;
        }

        if (dryRun) {
          actions.push({
            correlationId: corr,
            category: "local_revoked_remote_active",
            actionTaken: "planned_enqueue_revoke",
            sourceSystem: SOURCE_SYSTEM,
            userId: uid,
            localCourseId,
            externalUserId: extUserId,
            externalCourseId: mapping.offeringId,
            externalGrantId: expectedGrantId,
            details: { local_status: ent.status },
          });
          continue;
        }

        const repairRes = await withTx((txClient) =>
          enqueueRepairOutboxEvent(txClient, {
            eventType: "entitlement.revoked",
            externalGrantId: expectedGrantId,
            externalCourseId: mapping.offeringId,
            userRow: { id: uid },
            entitlementRow: {
              id: ent.entitlement_id,
              transaction_id: ent.transaction_id,
              starts_at: ent.starts_at,
              expires_at: ent.expires_at,
              revoked_at: ent.revoked_at || now(),
              created_at: ent.created_at,
            },
            localCourseId,
            correlationId: corr,
            reason: ent.reason || "reconciliation_local_revoked",
          }),
        );
        if (repairRes.enqueued && repairRes.outbox?.id) {
          summaryCounts.repaired_revoke += 1;
          repairedOutboxIds.push(Number(repairRes.outbox.id));
        } else if (repairRes.idempotentReuse) {
          summaryCounts.reused_idempotent += 1;
        }
        actions.push({
          correlationId: corr,
          category: "local_revoked_remote_active",
          actionTaken: repairRes.enqueued ? "enqueued_revoke_repair" : "already_queued_idempotent",
          sourceSystem: SOURCE_SYSTEM,
          userId: uid,
          localCourseId,
          externalUserId: extUserId,
          externalCourseId: mapping.offeringId,
          externalGrantId: expectedGrantId,
          outboxId: repairRes.outbox?.id != null ? Number(repairRes.outbox.id) : null,
          details: { local_status: ent.status },
        });
      }
    }

    // 2) Detect remote active grants that do NOT have any matching Moly entitlement or local mirror.
    for (const re of remoteEntitlements) {
      if (!re.effective_active) continue;
      const grantId = re.external_grant_id;
      const isMolyOrigin = typeof grantId === "string" && grantId.startsWith("moly:grant:");
      const knownOnMoly = isMolyOrigin
        ? knownLocalGrantIds.has(grantId)
        : knownLocalMirroredGrantIds.has(grantId);
      if (!knownOnMoly) {
        summaryCounts.remote_active_unknown_on_moly += 1;
        actions.push({
          correlationId: corr,
          category: "remote_active_unknown_on_moly",
          actionTaken: "flagged_for_manual_review",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: re.local_course_id ?? null,
          externalUserId: re.external_user_id || null,
          externalCourseId: re.external_course_id || null,
          externalGrantId: grantId || null,
          details: {
            remote_source: re.source,
            remote_local_user_id: re.local_user_id ?? null,
            note: "Active grant on CSCA-Course has no corresponding Moly record; auto-revoke disabled for safety.",
          },
        });
      }
      if (!re.external_course_id) {
        summaryCounts.missing_course_mapping += 1;
        actions.push({
          correlationId: corr,
          category: "missing_course_mapping",
          actionTaken: "manual_mapping_required",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: re.local_course_id ?? null,
          externalUserId: re.external_user_id || null,
          externalGrantId: grantId || null,
          details: { source: "remote_active_entitlement" },
        });
      }
    }

    // 3) Detect stale pending outbox & dead-letter outbox events (+ remote inbox summary alerts).
    const cutoffMs = new Date(staleCutoffIso).getTime();
    for (const ob of localOutboxRows) {
      const createdMs = ob.created_at ? new Date(ob.created_at).getTime() : nowMs;
      const isStale = (
        ["pending", "processing", "failed"].includes(ob.status)
        || (ob.status === "sent" && ["queued", "pending", "processing"].includes(ob.remote_status))
      ) && createdMs <= cutoffMs;
      if (isStale) {
        summaryCounts.stale_pending_event += 1;
        actions.push({
          correlationId: corr,
          category: "stale_pending_event",
          actionTaken: "alert_stale_queue",
          sourceSystem: SOURCE_SYSTEM,
          userId: ob.user_id != null ? Number(ob.user_id) : null,
          externalCourseId: ob.external_course_id || null,
          externalGrantId: ob.external_grant_id || null,
          outboxId: Number(ob.id),
          details: {
            event_id: ob.event_id,
            event_type: ob.event_type,
            status: ob.status,
            remote_status: ob.remote_status || null,
            created_at: toIso(ob.created_at),
          },
        });
      }

      if (ob.status === "dead_letter" || (ob.status === "sent" && ob.remote_status === "dead_letter")) {
        summaryCounts.dead_letter_event += 1;
        actions.push({
          correlationId: corr,
          category: "dead_letter_event",
          actionTaken: "requires_manual_retry",
          sourceSystem: SOURCE_SYSTEM,
          userId: ob.user_id != null ? Number(ob.user_id) : null,
          externalCourseId: ob.external_course_id || null,
          externalGrantId: ob.external_grant_id || null,
          outboxId: Number(ob.id),
          details: {
            event_id: ob.event_id,
            event_type: ob.event_type,
            status: ob.status,
            remote_status: ob.remote_status || null,
            last_error_code: ob.last_error_code || null,
          },
        });
      }
    }

    for (const [statusName, stats] of Object.entries(remoteInboxSummary)) {
      if (Number(stats?.stale_count || 0) > 0) {
        summaryCounts.stale_pending_event += Number(stats.stale_count);
        actions.push({
          correlationId: corr,
          category: "stale_pending_event",
          actionTaken: "alert_remote_inbox_stale",
          sourceSystem: TARGET_SYSTEM,
          details: { remote_inbox_status: statusName, stale_count: Number(stats.stale_count) },
        });
      }
      if (statusName === "dead_letter" && Number(stats?.count || 0) > 0) {
        summaryCounts.dead_letter_event += Number(stats.count);
        actions.push({
          correlationId: corr,
          category: "dead_letter_event",
          actionTaken: "alert_remote_inbox_dead_letter",
          sourceSystem: TARGET_SYSTEM,
          details: { remote_inbox_dead_letter_count: Number(stats.count) },
        });
      }
    }

    summaryCounts.total_discrepancies = (
      summaryCounts.local_active_remote_missing
      + summaryCounts.local_revoked_remote_active
      + summaryCounts.remote_active_unknown_on_moly
      + summaryCounts.missing_course_mapping
      + summaryCounts.identity_missing_or_conflict
      + summaryCounts.stale_pending_event
      + summaryCounts.dead_letter_event
    );

    let dispatchBatch = null;
    if (!dryRun && dispatchRepairs && repairedOutboxIds.length > 0 && outbox && typeof outbox.processAvailableOutboxJobs === "function") {
      const batchLimit = Math.min(Math.max(repairedOutboxIds.length * 2 + 10, 20), 100);
      dispatchBatch = await outbox.processAvailableOutboxJobs({
        workerId: `recon:${triggeredBy ?? "system"}`,
        limit: batchLimit,
        reconcileBefore: false,
        reconcileAfter: true,
      });
      if (dispatchBatch?.reconciledAfter?.some((item) => ["processed", "stale", "ignored"].includes(item.remoteStatus))) {
        const followUp = await outbox.processAvailableOutboxJobs({
          workerId: `recon:${triggeredBy ?? "system"}`,
          limit: batchLimit,
          reconcileBefore: false,
          reconcileAfter: true,
        });
        dispatchBatch = {
          reconciledBefore: dispatchBatch.reconciledBefore,
          dispatched: [...(dispatchBatch.dispatched || []), ...(followUp.dispatched || [])],
          reconciledAfter: [...(dispatchBatch.reconciledAfter || []), ...(followUp.reconciledAfter || [])],
        };
      }
    }

    const durationMs = Date.now() - startMs;
    observeMetricLatency("moly.reconciliation.run_ms", durationMs);
    recordMetric("moly.reconciliation.runs");
    if (summaryCounts.repaired_grant + summaryCounts.repaired_revoke > 0) {
      recordMetric("moly.reconciliation.repairs_enqueued", summaryCounts.repaired_grant + summaryCounts.repaired_revoke);
    }

    const finalized = await finalizeRun(runRow?.id, {
      status: "completed",
      summaryCounts: {
        ...summaryCounts,
        durationMs,
        repairedOutboxCount: repairedOutboxIds.length,
      },
      actions,
    });

    integrationLog.info(
      "reconciliation_completed",
      {
        runId: finalized?.id ?? null,
        dryRun: Boolean(dryRun),
        triggerMode,
        summaryCounts,
        durationMs,
      },
      corr,
    );

    return {
      run: finalized,
      correlationId: corr,
      dryRun: Boolean(dryRun),
      summary: summaryCounts,
      repairedOutboxIds,
      dispatchBatch,
      actions,
    };
  }

  async function listReconciliationRuns({ limit = 25, includeActions = true } = {}) {
    const caps = await schemaCaps(db);
    if (!caps.has_recon_runs) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const runs = (await db.query(
      `SELECT * FROM integration_reconciliation_runs
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit],
    )).rows;
    if (!includeActions || !caps.has_recon_actions || runs.length === 0) {
      return runs;
    }
    const runIds = runs.map((r) => Number(r.id));
    const actions = (await db.query(
      `SELECT * FROM integration_reconciliation_actions
       WHERE run_id = ANY($1::bigint[])
       ORDER BY id ASC`,
      [runIds],
    )).rows;
    const byRun = new Map();
    for (const act of actions) {
      const rid = Number(act.run_id);
      if (!byRun.has(rid)) byRun.set(rid, []);
      byRun.get(rid).push(act);
    }
    return runs.map((r) => ({ ...r, actions: byRun.get(Number(r.id)) || [] }));
  }

  async function resolveIntegrationConflict({
    conflictId,
    action = "resolved",
    targetUserId = null,
    resolutionNote = null,
    actorId = null,
    correlationId = null,
  } = {}) {
    const id = Number(conflictId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Valid conflictId is required.");
    }
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!["resolved", "dismissed", "ignored", "dismiss", "ignore", "link_existing"].includes(normalizedAction)) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Unsupported conflict resolution action.");
    }
    const corr = resolveCorrelationId(correlationId);

    return withTx(async (txClient) => {
      const conflict = (await txClient.query(
        "SELECT * FROM integration_conflicts WHERE id = $1 FOR UPDATE",
        [id],
      )).rows[0];
      if (!conflict) {
        throw new CourseApiError(404, "NOT_FOUND", `Integration conflict ${id} not found.`);
      }
      let nextUserId = conflict.existing_user_id;
      if (normalizedAction === "link_existing") {
        const chosenUserId = Number(targetUserId ?? conflict.candidate_user_id);
        if (!Number.isSafeInteger(chosenUserId) || chosenUserId <= 0) {
          throw new CourseApiError(422, "VALIDATION_ERROR", "Valid targetUserId is required to link identity.");
        }
        nextUserId = chosenUserId;
        if (conflict.external_user_id) {
          await txClient.query(
            `INSERT INTO external_identities (
               source_system, external_user_id, user_id, status, link_method,
               source_updated_at, correlation_id, linked_by
             ) VALUES ($1, $2, $3, 'active', 'manual', $4, $5, $6)
             ON CONFLICT (source_system, external_user_id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               status = 'active',
               link_method = 'manual',
               source_updated_at = GREATEST(external_identities.source_updated_at + INTERVAL '1 millisecond', EXCLUDED.source_updated_at),
               correlation_id = EXCLUDED.correlation_id,
               linked_by = EXCLUDED.linked_by`,
            [
              conflict.source_system || "csca-course",
              conflict.external_user_id,
              chosenUserId,
              now().toISOString(),
              corr,
              actorId ?? null,
            ],
          );
        }
      }
      const nextStatus = normalizedAction === "dismiss" || normalizedAction === "dismissed"
        ? "dismissed"
        : (normalizedAction === "ignore" || normalizedAction === "ignored" ? "ignored" : "resolved");
      const updated = (await txClient.query(
        `UPDATE integration_conflicts
         SET status = $2,
             existing_user_id = COALESCE($3, existing_user_id),
             resolution_note = COALESCE($4, resolution_note),
             resolved_by = $5,
             resolved_at = $6
         WHERE id = $1
         RETURNING id, source_system, conflict_type, status, external_user_id, external_course_id,
                   external_grant_id, candidate_user_id, existing_user_id, local_course_id,
                   correlation_id, reason, resolution_note, resolved_by, resolved_at, created_at`,
        [
          id,
          nextStatus,
          nextUserId ?? null,
          resolutionNote ? String(resolutionNote).trim().slice(0, 2000) : null,
          actorId ?? null,
          now().toISOString(),
        ],
      )).rows[0];

      recordMetric("moly.conflicts.resolved");
      integrationLog.info("conflict_resolved", {
        conflictId: id,
        action: normalizedAction,
        nextStatus,
        actorId: actorId ?? null,
      }, corr);

      return updated;
    });
  }

  async function listAdminOperationsOverview({ limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const caps = await schemaCaps(db);

    const outboxItems = caps.has_outbox
      ? (await db.query(
        `SELECT id, event_id, idempotency_key, correlation_id, event_type, aggregate_id,
                status, remote_status, remote_inbox_id, attempt_count, max_attempts,
                next_retry_at, sent_at, remote_processed_at, last_status_checked_at,
                last_error_code, last_error_message, user_id, transaction_id, entitlement_id,
                external_grant_id, external_course_id, created_at, updated_at
         FROM integration_outbox
         ORDER BY id DESC
         LIMIT $1`,
        [safeLimit],
      )).rows
      : [];
    const outboxCountsRows = caps.has_outbox
      ? (await db.query(
        `SELECT status, COUNT(*)::int AS count FROM integration_outbox GROUP BY status`,
      )).rows
      : [];
    const outboxCounts = Object.fromEntries(outboxCountsRows.map((r) => [r.status, r.count]));
    const staleThreshold = new Date(now().getTime() - staleThresholdMinutes * 60000).toISOString();
    const stalePendingCount = caps.has_outbox
      ? Number((await db.query(
        `SELECT COUNT(*)::int AS count
         FROM integration_outbox
         WHERE created_at <= $1
           AND (status IN ('pending', 'processing', 'failed')
                OR (status = 'sent' AND remote_status IN ('queued', 'pending', 'processing')))`,
        [staleThreshold],
      )).rows[0]?.count || 0)
      : 0;

    const conflicts = caps.has_conflicts
      ? (await db.query(
        `SELECT id, source_system, conflict_type, status, external_user_id, external_course_id,
                external_grant_id, candidate_user_id, existing_user_id, local_course_id,
                email_hint, correlation_id, source_updated_at, reason, resolution_note,
                resolved_by, resolved_at, created_at
         FROM integration_conflicts
         ORDER BY (status = 'open') DESC, id DESC
         LIMIT $1`,
        [safeLimit],
      )).rows
      : [];
    const conflictCountsRows = caps.has_conflicts
      ? (await db.query(
        `SELECT status, COUNT(*)::int AS count FROM integration_conflicts GROUP BY status`,
      )).rows
      : [];
    const conflictCounts = Object.fromEntries(conflictCountsRows.map((r) => [r.status, r.count]));

    let unmappedCourses = [];
    if (caps.has_mappings && caps.has_video_pkg_courses && caps.has_video_packages) {
      unmappedCourses = (await db.query(
        `SELECT DISTINCT c.id AS local_course_id, c.title AS local_course_title, c.slug AS local_course_slug,
                vp.id AS video_package_id, vp.name AS video_package_name
         FROM video_package_courses vpc
         JOIN video_packages vp ON vp.id = vpc.video_package_id
         JOIN courses c ON c.id = vpc.course_id
         WHERE NOT EXISTS (
           SELECT 1 FROM external_course_mappings ecm
           WHERE ecm.local_course_id = c.id
             AND ecm.status = 'active'
         )
         ORDER BY c.id ASC
         LIMIT 100`,
      )).rows;
    }

    const reconciliationRuns = await listReconciliationRuns({ limit: 15, includeActions: true });

    return {
      killSwitchActive: isIntegrationKillSwitchActive(env),
      metrics: getIntegrationMetricsSnapshot(),
      outboxCounts,
      stalePendingCount,
      conflictCounts,
      outboxItems,
      conflicts,
      unmappedCourses,
      reconciliationRuns,
    };
  }

  return {
    runReconciliation,
    listReconciliationRuns,
    resolveIntegrationConflict,
    listAdminOperationsOverview,
  };
}

module.exports = {
  createCourseReconciliationService,
  buildExpectedGrantId,
  normalizeMolyOfferingId,
};
