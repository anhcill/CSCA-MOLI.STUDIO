const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const {
  buildActiveOfferingMappingSqlPredicate,
  detectMappingSchemaColumns,
  resolveOfferingIdFromMapping,
} = require("../utils/courseMappingResolver");
const {
  upsertAssessmentProjectionTx,
  upsertBookmarkProjectionTx,
  upsertLearningProgressProjectionTx,
  upsertNoteProjectionTx,
  upsertQaThreadProjectionTx,
} = require("./molyCourseCatalogSyncService");
const {
  createIntegrationLogger,
  getIntegrationMetricsSnapshot,
  getKillSwitchesSnapshot,
  isContentSyncKillSwitchActive,
  isIntegrationKillSwitchActive,
  isMutationsRepairKillSwitchActive,
  observeMetricLatency,
  readRolloutPosture,
  recordMetric,
  resolveCorrelationId,
} = require("../utils/integrationLogger");

const SOURCE_SYSTEM = "moly";
const TARGET_SYSTEM = "csca-course";
const VALID_DOMAINS = ["entitlement", "content", "progress"];

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeMolyOfferingId(row) {
  return resolveOfferingIdFromMapping(row);
}

function normalizeDomains(domains) {
  if (!Array.isArray(domains) || domains.length === 0) {
    return [...VALID_DOMAINS];
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of domains) {
    const val = String(raw || "").trim().toLowerCase();
    if (VALID_DOMAINS.includes(val) && !seen.has(val)) {
      seen.add(val);
      normalized.push(val);
    }
  }
  if (normalized.length === 0) {
    throw new CourseApiError(
      422,
      "VALIDATION_ERROR",
      "domains must include at least one of: entitlement, content, progress.",
    );
  }
  return normalized;
}

function toStringList(...sources) {
  const out = [];
  const seen = new Set();
  for (const src of sources) {
    const arr = Array.isArray(src) ? src : (src != null ? [src] : []);
    for (const item of arr) {
      const s = String(item ?? "").trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

function toPositiveIntList(...sources) {
  const out = [];
  const seen = new Set();
  for (const src of sources) {
    const arr = Array.isArray(src) ? src : (src != null ? [src] : []);
    for (const item of arr) {
      const n = Number(item);
      if (Number.isSafeInteger(n) && n > 0 && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

function buildExpectedGrantId({ transactionId, entitlementId, localCourseId }) {
  const scope = transactionId != null ? `tx_${transactionId}` : `ent_${entitlementId}`;
  return `moly:grant:${scope}:course_${localCourseId}`;
}

/**
 * Reconciliation, operations overview, and safe conflict resolution service
 * for Moly Studio <-> CSCA-Course integration (Days 5-10: entitlement, content, and learning drift).
 */
function createCourseReconciliationService({
  db,
  client = null,
  outbox = null,
  catalogSync = null,
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
         to_regclass('courses') IS NOT NULL AS has_courses,
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
         to_regclass('integration_reconciliation_actions') IS NOT NULL AS has_recon_actions,
         to_regclass('course_profile_projections') IS NOT NULL AS has_profile_projections,
         to_regclass('course_unit_projections') IS NOT NULL AS has_unit_projections,
         to_regclass('course_file_projections') IS NOT NULL AS has_file_projections,
         to_regclass('course_progress_projections') IS NOT NULL AS has_progress_projections,
         to_regclass('course_assessment_projections') IS NOT NULL AS has_assessment_projections,
         to_regclass('course_note_projections') IS NOT NULL AS has_note_projections,
         to_regclass('course_bookmark_projections') IS NOT NULL AS has_bookmark_projections,
         to_regclass('course_qa_thread_projections') IS NOT NULL AS has_qa_thread_projections,
         to_regclass('moly_course_sync_inbox') IS NOT NULL AS has_v2_inbox,
         to_regclass('course_sync_checkpoints') IS NOT NULL AS has_checkpoints`,
    );
    const base = res.rows[0] || {};
    if (base.has_courses) {
      const colRes = await runner.query(
        `SELECT attname FROM pg_attribute
         WHERE attrelid = to_regclass('courses')
           AND NOT attisdropped
           AND attname IN ('content_origin', 'remote_course_id', 'sync_revision', 'tombstoned_at')`,
      );
      const cols = new Set(colRes.rows.map((r) => r.attname));
      base.has_course_v2_cols = cols.has("content_origin") && cols.has("remote_course_id") && cols.has("sync_revision");
    } else {
      base.has_course_v2_cols = false;
    }
    return base;
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
    observedOutbox = null,
    reason = "reconciliation_repair",
  }) {
    // Match payment refund/admin revocation lock order; hold through outbox insertion.
    const freshUser = (await txClient.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userRow.id])).rows[0];
    const fresh = (await txClient.query('SELECT * FROM user_video_entitlements WHERE id = $1 FOR UPDATE', [entitlementRow.id])).rows[0];
    const skip = (reason) => ({ enqueued: false, idempotentReuse: false, skippedReason: reason });
    if (!freshUser || !fresh || Number(fresh.user_id) !== Number(userRow.id)) return skip('local_state_changed');
    const activeNow = fresh.status === 'active' && freshUser.is_active !== false && freshUser.is_banned !== true
      && (!fresh.starts_at || new Date(fresh.starts_at) <= now())
      && (!fresh.expires_at || new Date(fresh.expires_at) > now());
    const revokedNow = fresh.status === 'revoked' || (fresh.expires_at && new Date(fresh.expires_at) <= now());
    if ((eventType === 'entitlement.granted' && !activeNow)
      || (eventType === 'entitlement.revoked' && !revokedNow)
      || buildExpectedGrantId({ transactionId: fresh.transaction_id, entitlementId: fresh.id, localCourseId }) !== externalGrantId) {
      return skip('local_state_changed');
    }
    const coursePair = (await txClient.query(
      'SELECT course_id FROM video_entitlement_courses WHERE entitlement_id = $1 AND course_id = $2 FOR SHARE',
      [fresh.id, localCourseId],
    )).rows[0];
    const mappings = (await txClient.query(
      "SELECT * FROM external_course_mappings WHERE local_course_id = $1 AND status = 'active' FOR SHARE", [localCourseId],
    )).rows;
    const validOfferings = mappings
      .filter((row) => !row.deleted_at)
      .map((row) => resolveOfferingIdFromMapping(row))
      .filter(Boolean);
    if (!coursePair || !validOfferings.includes(externalCourseId)) return skip('mapping_changed');
    const conflicts = (await txClient.query(
      `SELECT id FROM integration_conflicts WHERE status IN ('open', 'in_review')
       AND (candidate_user_id = $1 OR existing_user_id = $1 OR external_user_id = $2) LIMIT 1`,
      [userRow.id, `moly:${userRow.id}`],
    )).rows;
    if (conflicts.length) return skip('open_conflict');
    userRow = freshUser;
    entitlementRow = fresh;

    // A snapshot may only supersede the terminal event observed BEFORE fetching it.
    // A concurrent run or a pending/failed event must be reconciled/retried first.
    await txClient.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      ["moly:recon-repair", externalGrantId],
    );
    const existing = (await txClient.query(
      `SELECT id, status, remote_status, idempotency_key
       FROM integration_outbox
       WHERE external_grant_id = $1 AND event_type = $2
       ORDER BY id DESC
       LIMIT 1`,
      [externalGrantId, eventType],
    )).rows[0];
    const isComplete = row => row?.status === 'sent' && ['processed', 'stale', 'ignored'].includes(row.remote_status);
    if (existing && (String(existing.id) !== String(observedOutbox?.id)
      || !isComplete(existing) || !isComplete(observedOutbox))) {
      return { enqueued: false, outbox: existing, idempotentReuse: true };
    }
    const kind = eventType === 'entitlement.granted' ? 'grant' : 'revoke';
    const generation = `v2:after_${existing?.id || 0}`;
    const idempotencyKey = `moly:recon:${kind}:${externalGrantId}:${generation}`;
    const eventId = `moly:evt:recon:${kind}:${externalGrantId}:${generation}`;

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

  function createEmptySummaryCounts(mutationsRepairPaused) {
    return {
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
      content_course_drift: 0,
      content_profile_drift: 0,
      content_unit_drift: 0,
      content_file_drift: 0,
      repaired_content_courses: 0,
      repaired_content_curriculum: 0,
      progress_unit_drift: 0,
      progress_assessment_drift: 0,
      progress_note_drift: 0,
      progress_bookmark_drift: 0,
      progress_qa_drift: 0,
      repaired_progress: 0,
      repaired_assessments: 0,
      repaired_notes: 0,
      repaired_bookmarks: 0,
      repaired_qa_threads: 0,
      total_discrepancies: 0,
      mutations_repair_paused: Boolean(mutationsRepairPaused),
    };
  }

  function isRemoteNewerRevision(localRow, remoteRevision, remoteUpdatedAt) {
    if (!localRow) return true;
    const localRev = Number(localRow.sync_revision ?? localRow.last_revision ?? localRow.source_revision ?? 0);
    const remRev = Number(remoteRevision || 0);
    if (remRev > localRev) return true;
    if (remRev < localRev) return false;
    const localIso = toIso(localRow.source_updated_at);
    const remIso = toIso(remoteUpdatedAt);
    if (remIso && (!localIso || new Date(remIso).getTime() > new Date(localIso).getTime())) {
      return true;
    }
    return false;
  }

  async function resolveLocalUserIdMap(runner, externalUserIds = [], extraUserIds = []) {
    const map = new Map();
    for (const uid of extraUserIds) {
      map.set(`moly:${uid}`, uid);
    }
    for (const ext of externalUserIds) {
      if (typeof ext === "string" && ext.startsWith("moly:")) {
        const parsed = Number(ext.slice(5));
        if (Number.isSafeInteger(parsed) && parsed > 0) map.set(ext, parsed);
      }
    }
    const cleanExts = externalUserIds.filter(Boolean);
    if (cleanExts.length > 0 && (await runner.query("SELECT to_regclass('external_identities') IS NOT NULL AS ok")).rows[0]?.ok) {
      const idRes = await runner.query(
        `SELECT external_user_id, user_id
         FROM external_identities
         WHERE source_system IN ('moly', 'csca-course')
           AND status = 'active'
           AND external_user_id = ANY($1::text[])`,
        [cleanExts],
      );
      for (const r of idRes.rows) {
        if (r.external_user_id && r.user_id != null) {
          map.set(r.external_user_id, Number(r.user_id));
        }
      }
    }
    return map;
  }

  async function reconcileEntitlementDomain({
    caps,
    dryRun,
    limit,
    staleMinutes,
    corr,
    extUserFilter,
    extCourseFilter,
    parsedUserFilter,
    userIdsFilter,
    summaryCounts,
    actions,
    repairedOutboxIds,
  }) {
    if (!client || typeof client.queryReconciliationSnapshot !== "function" || !client.isConfigured()) {
      throw new CourseApiError(
        503,
        "COURSE_LMS_NOT_CONFIGURED",
        "CSCA-Course integration credentials are not configured.",
      );
    }

    const observedOutboxes = new Map();
    const observed = await db.query(
      `SELECT DISTINCT ON (external_grant_id, event_type) id, external_grant_id, event_type, status, remote_status
       FROM integration_outbox WHERE external_grant_id IS NOT NULL
       ORDER BY external_grant_id, event_type, id DESC`,
    );
    for (const row of observed.rows) observedOutboxes.set(`${row.external_grant_id}:${row.event_type}`, row);

    const snapshotRes = await client.queryReconciliationSnapshot({
      correlationId: corr,
      externalUserId: extUserFilter,
      externalCourseId: extCourseFilter,
      limit,
    });

    const remote = snapshotRes.payload.data || {};
    if (remote.complete !== true) {
      throw new CourseApiError(
        409,
        "RECONCILIATION_SNAPSHOT_INCOMPLETE",
        "A complete snapshot is required. Narrow the reconciliation scope.",
      );
    }

    const remoteIdentities = Array.isArray(remote.identities) ? remote.identities : [];
    const remoteConflicts = Array.isArray(remote.open_conflicts) ? remote.open_conflicts : [];
    const remoteEntitlements = Array.isArray(remote.entitlements) ? remote.entitlements : [];
    const remoteCourseMappings = [
      ...(Array.isArray(remote.course_mappings) ? remote.course_mappings : []),
      ...(Array.isArray(remote.profile_mappings) ? remote.profile_mappings : []),
    ];
    const remoteInboxSummary = remote.inbox_summary || {};

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

    const userFilterArray = userIdsFilter.length > 0 ? userIdsFilter : null;
    const singleUserFilter = Number.isSafeInteger(parsedUserFilter) ? parsedUserFilter : null;

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
           AND ($2::int[] IS NULL OR e.user_id = ANY($2::int[]))
           AND ($3::text IS NULL OR 'moly:' || e.user_id::text = $3)
         ORDER BY e.id DESC, ec.course_id ASC`,
        [singleUserFilter, userFilterArray, extUserFilter],
      )).rows
      : [];
    const localExtEntitlements = caps.has_ext_entitlements
      ? (await db.query(
        `SELECT id, source_system, external_user_id, user_id, local_course_id,
                external_course_id, external_grant_id, status, valid_from, valid_until,
                effective_owned, origin_system, source_updated_at
         FROM external_entitlements
         WHERE ($1::int IS NULL OR user_id = $1)
           AND ($2::int[] IS NULL OR user_id = ANY($2::int[]))
         ORDER BY id DESC`,
        [singleUserFilter, userFilterArray],
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
           AND ($2::int[] IS NULL OR user_id = ANY($2::int[]))
         ORDER BY id DESC`,
        [singleUserFilter, userFilterArray],
      )).rows
      : [];

    const activeMappingsByLocalCourse = new Map();
    for (const m of localMappings) {
      if (m.status !== "active" || m.deleted_at != null) continue;
      const offeringId = resolveOfferingIdFromMapping(m);
      if (!offeringId) continue;
      const cid = Number(m.local_course_id);
      if (!activeMappingsByLocalCourse.has(cid)) {
        activeMappingsByLocalCourse.set(cid, []);
      }
      activeMappingsByLocalCourse.get(cid).push({ ...m, offeringId });
    }

    const remoteActiveMappingOfferings = new Set();
    for (const rm of remoteCourseMappings) {
      if (rm.status !== "active" || rm.deleted_at != null) continue;
      const resolved = resolveOfferingIdFromMapping(rm);
      if (resolved) remoteActiveMappingOfferings.add(resolved);
      if (typeof rm.external_course_id === "string" && rm.external_course_id.trim()) {
        const ext = rm.external_course_id.trim();
        if (ext.startsWith("moly:") || ext.startsWith("profile:")) {
          remoteActiveMappingOfferings.add(ext);
        }
      }
      if (typeof rm.remote_profile_id === "string" && rm.remote_profile_id.trim()) {
        remoteActiveMappingOfferings.add(`profile:${rm.remote_profile_id.trim()}`);
      }
      if (typeof rm.profile_id === "string" && rm.profile_id.trim()) {
        remoteActiveMappingOfferings.add(`profile:${rm.profile_id.trim()}`);
      }
    }

    const remoteIdentityByExtUser = new Map();
    for (const ident of remoteIdentities) {
      if (ident.external_user_id) {
        remoteIdentityByExtUser.set(ident.external_user_id, ident);
      }
    }

    const conflictExtUsers = new Set();
    const conflictLocalUsers = new Set();

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

    const remoteByGrantId = new Map();
    for (const re of remoteEntitlements) {
      if (re.external_grant_id) {
        remoteByGrantId.set(re.external_grant_id, re);
      }
    }

    const knownLocalGrantIds = new Set();
    const knownLocalMirroredGrantIds = new Set(
      localExtEntitlements.map((row) => row.external_grant_id).filter(Boolean),
    );
    const seenMissingCourseIds = new Set();

    if (caps.has_video_pkg_courses && caps.has_video_packages) {
      const pkgCourseRows = (await db.query(
        `SELECT DISTINCT vpc.course_id
         FROM video_package_courses vpc
         JOIN video_packages vp ON vp.id = vpc.video_package_id
         WHERE vp.status = 'active'`,
      )).rows;
      for (const row of pkgCourseRows) {
        const lcid = Number(row.course_id);
        if (!activeMappingsByLocalCourse.has(lcid) && !seenMissingCourseIds.has(lcid)) {
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

    for (const ent of localVideoEntitlements) {
      const uid = Number(ent.user_id);
      const extUserId = `moly:${uid}`;
      const localCourseId = Number(ent.local_course_id);
      const candidates = activeMappingsByLocalCourse.get(localCourseId) || [];
      const expectedGrantId = buildExpectedGrantId({
        transactionId: ent.transaction_id,
        entitlementId: ent.entitlement_id,
        localCourseId,
      });
      knownLocalGrantIds.add(expectedGrantId);

      const remoteMatch = remoteByGrantId.get(expectedGrantId) || null;
      const mapping = (extCourseFilter && candidates.find((c) => c.offeringId === extCourseFilter))
        || (remoteMatch?.external_course_id && candidates.find((c) => c.offeringId === remoteMatch.external_course_id))
        || candidates.find((c) => remoteActiveMappingOfferings.has(c.offeringId))
        || candidates[0]
        || null;
      if (extCourseFilter && mapping?.offeringId !== extCourseFilter) continue;

      const startsOk = !ent.starts_at || new Date(ent.starts_at).getTime() <= nowMs;
      const notExpired = !ent.expires_at || new Date(ent.expires_at).getTime() > nowMs;
      const isLocalActive = ent.status === "active" && startsOk && notExpired && ent.user_is_active !== false;
      const isLocalRevokedOrExpired = ent.status === "revoked" || (ent.expires_at && new Date(ent.expires_at).getTime() <= nowMs);

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

      const hasRemoteMapping = remoteActiveMappingOfferings.has(mapping.offeringId);
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
            observedOutbox: observedOutboxes.get(`${expectedGrantId}:entitlement.granted`),
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
          actionTaken: repairRes.enqueued ? "enqueued_grant_repair" : (repairRes.skippedReason || "already_queued_idempotent"),
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
            observedOutbox: observedOutboxes.get(`${expectedGrantId}:entitlement.revoked`),
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
          actionTaken: repairRes.enqueued ? "enqueued_revoke_repair" : (repairRes.skippedReason || "already_queued_idempotent"),
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
  }

  async function reconcileContentDomain({
    caps,
    dryRun,
    limit,
    corr,
    courseIds,
    profileIds,
    explicitlyRequested,
    summaryCounts,
    actions,
  }) {
    if (!caps.has_profile_projections && !caps.has_unit_projections) {
      return { skipped: true, reason: "content_projection_schema_missing" };
    }
    if (!client || (typeof client.isConfigured === "function" && !client.isConfigured())) {
      if (explicitlyRequested) {
        throw new CourseApiError(
          503,
          "COURSE_LMS_NOT_CONFIGURED",
          "CSCA-Course integration credentials are not configured.",
        );
      }
      return { skipped: true, reason: "client_not_configured" };
    }
    if (typeof client.fetchContentReconciliationSnapshot !== "function") {
      return { skipped: true, reason: "content_snapshot_method_missing" };
    }

    let remoteContent;
    try {
      remoteContent = await client.fetchContentReconciliationSnapshot({
        courseIds,
        profileIds,
        limit,
        correlationId: corr,
        maxTransportAttempts: explicitlyRequested ? undefined : 1,
      }) || {};
    } catch (error) {
      const status = error?.status ?? error?.httpStatus ?? null;
      if (!explicitlyRequested && (status === 404 || status === 501)) {
        integrationLog.warn("reconcile_content_endpoint_unsupported", { status }, corr);
        return { skipped: true, reason: "remote_endpoint_not_found" };
      }
      throw error;
    }

    const remoteCourses = Array.isArray(remoteContent.courses) ? remoteContent.courses : [];
    const nestedProfiles = remoteCourses.flatMap((c) => (
      Array.isArray(c?.profiles) ? c.profiles.map((p) => ({ courseId: c.courseId ?? c.remoteCourseId ?? c.id, ...p })) : []
    ));
    const remoteProfiles = [
      ...(Array.isArray(remoteContent.profiles) ? remoteContent.profiles : []),
      ...(Array.isArray(remoteContent.courseProfiles) ? remoteContent.courseProfiles : []),
      ...(Array.isArray(remoteContent.course_profiles) ? remoteContent.course_profiles : []),
      ...nestedProfiles,
    ];
    const remoteUnits = [
      ...(Array.isArray(remoteContent.units) ? remoteContent.units : []),
      ...(Array.isArray(remoteContent.curriculumUnits) ? remoteContent.curriculumUnits : []),
      ...(Array.isArray(remoteContent.curriculum_units) ? remoteContent.curriculum_units : []),
    ];
    const remoteFiles = [
      ...(Array.isArray(remoteContent.files) ? remoteContent.files : []),
      ...(Array.isArray(remoteContent.unitFiles) ? remoteContent.unitFiles : []),
      ...(Array.isArray(remoteContent.unit_files) ? remoteContent.unit_files : []),
    ];

    const localCourses = caps.has_courses && caps.has_course_v2_cols
      ? (await db.query(
        `SELECT id, remote_course_id, title, status, sync_revision, source_updated_at, tombstoned_at
         FROM courses
         WHERE (content_origin = 'csca_course' OR remote_course_id IS NOT NULL)
           AND ($1::text[] IS NULL OR remote_course_id = ANY($1::text[]))`,
        [courseIds.length ? courseIds : null],
      )).rows
      : [];
    const localProfiles = caps.has_profile_projections
      ? (await db.query(
        `SELECT id, remote_course_id, remote_profile_id, external_offering_id, local_course_id,
                mode, status, last_revision, source_updated_at, deleted_at
         FROM course_profile_projections
         WHERE ($1::text[] IS NULL OR remote_course_id = ANY($1::text[]))
           AND ($2::text[] IS NULL OR remote_profile_id = ANY($2::text[]))`,
        [courseIds.length ? courseIds : null, profileIds.length ? profileIds : null],
      )).rows
      : [];
    const localUnits = caps.has_unit_projections && caps.has_profile_projections
      ? (await db.query(
        `SELECT u.id, u.profile_projection_id, u.local_course_id, u.unit_type, u.remote_unit_id,
                u.file_count, u.is_published, u.last_revision, u.source_updated_at, u.deleted_at,
                p.remote_profile_id, p.remote_course_id
         FROM course_unit_projections u
         JOIN course_profile_projections p ON p.id = u.profile_projection_id
         WHERE ($1::text[] IS NULL OR p.remote_course_id = ANY($1::text[]))
           AND ($2::text[] IS NULL OR p.remote_profile_id = ANY($2::text[]))`,
        [courseIds.length ? courseIds : null, profileIds.length ? profileIds : null],
      )).rows
      : [];
    const localFiles = caps.has_file_projections && caps.has_unit_projections && caps.has_profile_projections
      ? (await db.query(
        `SELECT f.id, f.profile_projection_id, f.unit_projection_id, f.remote_file_id,
                f.is_published, f.last_revision, f.source_updated_at, f.deleted_at,
                u.remote_unit_id, p.remote_profile_id, p.remote_course_id, p.local_course_id
         FROM course_file_projections f
         JOIN course_unit_projections u ON u.id = f.unit_projection_id
         JOIN course_profile_projections p ON p.id = f.profile_projection_id
         WHERE ($1::text[] IS NULL OR p.remote_course_id = ANY($1::text[]))
           AND ($2::text[] IS NULL OR p.remote_profile_id = ANY($2::text[]))`,
        [courseIds.length ? courseIds : null, profileIds.length ? profileIds : null],
      )).rows
      : [];

    const localCourseByRemote = new Map(localCourses.map((c) => [String(c.remote_course_id), c]));
    const localProfileByRemote = new Map(localProfiles.map((p) => [String(p.remote_profile_id), p]));
    const localUnitByKey = new Map(
      localUnits.map((u) => [`${u.remote_profile_id}:${u.unit_type || "lesson"}:${u.remote_unit_id}`, u]),
    );
    const localFileByKey = new Map(
      localFiles.map((f) => [`${f.remote_profile_id}:${f.remote_file_id}`, f]),
    );
    const localUnitCountByProfId = new Map();
    for (const u of localUnits) {
      if (!u.deleted_at) {
        const key = String(u.profile_projection_id);
        localUnitCountByProfId.set(key, (localUnitCountByProfId.get(key) || 0) + 1);
      }
    }
    const localFileCountByProfId = new Map();
    for (const f of localFiles) {
      if (!f.deleted_at) {
        const key = String(f.profile_projection_id);
        localFileCountByProfId.set(key, (localFileCountByProfId.get(key) || 0) + 1);
      }
    }

    const driftedRemoteCourseIds = new Set();
    const curriculumLocalCourseIds = new Set();
    const curriculumRemoteCourseIds = new Set();

    for (const rc of remoteCourses) {
      const rcid = String(rc.courseId ?? rc.remoteCourseId ?? rc.remote_course_id ?? rc.id ?? "").trim();
      if (!rcid) continue;
      const localCourse = localCourseByRemote.get(rcid) || null;
      const remRev = Number(rc.syncRevision ?? rc.revision ?? rc.lastRevision ?? rc.last_revision ?? rc.sourceRevision ?? 1);
      const remUpdated = rc.sourceUpdatedAt ?? rc.source_updated_at ?? rc.updatedAt ?? rc.updated_at;
      const remDeleted = Boolean(rc.deleted || rc.deletedAt || rc.deleted_at || rc.status === "tombstoned");
      const revBehind = isRemoteNewerRevision(localCourse, remRev, remUpdated);
      const tombMismatch = localCourse ? remDeleted !== Boolean(localCourse.tombstoned_at) : !remDeleted;
      const courseRemoteProfiles = remoteProfiles.filter(
        (rp) => String(rp.courseId ?? rp.remoteCourseId ?? rp.remote_course_id ?? "").trim() === rcid,
      );
      const allCourseProfilesDeleted = courseRemoteProfiles.length > 0 && courseRemoteProfiles.every(
        (rp) => Boolean(rp.deleted || rp.deletedAt || rp.deleted_at || ["tombstoned", "archived"].includes(String(rp.status || "").toLowerCase())),
      );
      const rawRemotePub = rc.isPublished != null
        ? Boolean(rc.isPublished)
        : (rc.status != null ? String(rc.status).toLowerCase() === "published" : null);
      const remotePub = allCourseProfilesDeleted ? false : rawRemotePub;
      const pubMismatch = Boolean(localCourse && remotePub != null && remotePub !== (localCourse.status === "published"));
      if (!localCourse || revBehind || tombMismatch || pubMismatch) {
        if (!localCourse && remDeleted) continue;
        summaryCounts.content_course_drift += 1;
        driftedRemoteCourseIds.add(rcid);
        curriculumRemoteCourseIds.add(rcid);
        if (localCourse?.id) curriculumLocalCourseIds.add(Number(localCourse.id));
        actions.push({
          correlationId: corr,
          category: "content_course_drift",
          actionTaken: dryRun ? "planned_catalog_backfill" : "pending_catalog_backfill",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: localCourse ? Number(localCourse.id) : null,
          externalCourseId: `course:${rcid}`,
          details: {
            remoteCourseId: rcid,
            localRevision: localCourse ? Number(localCourse.sync_revision || 0) : null,
            remoteRevision: remRev,
          },
        });
      }
    }

    for (const rp of remoteProfiles) {
      const rpid = String(rp.profileId ?? rp.remoteProfileId ?? rp.remote_profile_id ?? rp.id ?? "").trim();
      const rcid = String(rp.courseId ?? rp.remoteCourseId ?? rp.remote_course_id ?? "").trim();
      if (!rpid) continue;
      const localProf = localProfileByRemote.get(rpid) || null;
      const remRev = Number(rp.syncRevision ?? rp.revision ?? rp.lastRevision ?? rp.last_revision ?? 1);
      const remUpdated = rp.sourceUpdatedAt ?? rp.source_updated_at ?? rp.updatedAt;
      const remDeleted = Boolean(rp.deleted || rp.deletedAt || rp.deleted_at || rp.status === "tombstoned");
      const statusMismatch = Boolean(
        localProf
        && !remDeleted
        && rp.status
        && String(rp.status).toLowerCase() !== String(localProf.status || "").toLowerCase(),
      );
      const revBehind = isRemoteNewerRevision(localProf, remRev, remUpdated);
      const tombMismatch = localProf ? remDeleted !== Boolean(localProf.deleted_at) : !remDeleted;
      const resolvedRcId = rcid || (localProf?.remote_course_id ? String(localProf.remote_course_id) : "");

      if (!localProf || revBehind || tombMismatch || statusMismatch) {
        if (!localProf && remDeleted) continue;
        summaryCounts.content_profile_drift += 1;
        if (resolvedRcId) {
          driftedRemoteCourseIds.add(resolvedRcId);
          curriculumRemoteCourseIds.add(resolvedRcId);
        }
        if (localProf?.local_course_id) curriculumLocalCourseIds.add(Number(localProf.local_course_id));
        actions.push({
          correlationId: corr,
          category: "content_profile_drift",
          actionTaken: dryRun ? "planned_profile_sync" : "pending_profile_sync",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: localProf ? Number(localProf.local_course_id) : null,
          externalCourseId: `profile:${rpid}`,
          details: {
            remoteProfileId: rpid,
            remoteCourseId: resolvedRcId || null,
            localRevision: localProf ? Number(localProf.last_revision || 0) : null,
            remoteRevision: remRev,
          },
        });
      }

      if (localProf && !remDeleted && caps.has_unit_projections && remoteUnits.length === 0 && rp.activeUnitCount != null) {
        const localUnitCnt = localUnitCountByProfId.get(String(localProf.id)) || 0;
        if (Number(rp.activeUnitCount) !== localUnitCnt) {
          summaryCounts.content_unit_drift += 1;
          if (resolvedRcId) curriculumRemoteCourseIds.add(resolvedRcId);
          if (localProf.local_course_id) curriculumLocalCourseIds.add(Number(localProf.local_course_id));
          actions.push({
            correlationId: corr,
            category: "content_unit_drift",
            actionTaken: dryRun ? "planned_curriculum_backfill" : "pending_curriculum_backfill",
            sourceSystem: TARGET_SYSTEM,
            localCourseId: Number(localProf.local_course_id),
            externalCourseId: `profile:${rpid}`,
            details: {
              remoteProfileId: rpid,
              localUnitCount: localUnitCnt,
              remoteUnitCount: Number(rp.activeUnitCount),
            },
          });
        }
      }

      if (localProf && !remDeleted && caps.has_file_projections && remoteFiles.length === 0 && rp.activeFilePlacementCount != null) {
        const localFileCnt = localFileCountByProfId.get(String(localProf.id)) || 0;
        if (Number(rp.activeFilePlacementCount) !== localFileCnt) {
          summaryCounts.content_file_drift += 1;
          if (resolvedRcId) curriculumRemoteCourseIds.add(resolvedRcId);
          if (localProf.local_course_id) curriculumLocalCourseIds.add(Number(localProf.local_course_id));
          actions.push({
            correlationId: corr,
            category: "content_file_drift",
            actionTaken: dryRun ? "planned_file_backfill" : "pending_file_backfill",
            sourceSystem: TARGET_SYSTEM,
            localCourseId: Number(localProf.local_course_id),
            externalCourseId: `profile:${rpid}`,
            details: {
              remoteProfileId: rpid,
              localFileCount: localFileCnt,
              remoteFileCount: Number(rp.activeFilePlacementCount),
            },
          });
        }
      }
    }

    for (const ru of remoteUnits) {
      const rpid = String(ru.profileId ?? ru.remoteProfileId ?? ru.remote_profile_id ?? "").trim();
      const ruid = String(ru.unitId ?? ru.remoteUnitId ?? ru.remote_unit_id ?? ru.id ?? "").trim();
      const uType = String(ru.unitType ?? ru.unit_type ?? "lesson").toLowerCase() === "class_session" ? "class_session" : "lesson";
      if (!rpid || !ruid) continue;
      const localProf = localProfileByRemote.get(rpid) || null;
      const localUnit = localUnitByKey.get(`${rpid}:${uType}:${ruid}`) || null;
      const remRev = Number(ru.revision ?? ru.lastRevision ?? ru.last_revision ?? 1);
      const remUpdated = ru.sourceUpdatedAt ?? ru.source_updated_at ?? ru.updatedAt;
      const remDeleted = Boolean(ru.deleted || ru.deletedAt || ru.deleted_at);
      const remFileCount = ru.fileCount ?? ru.file_count ?? null;
      const revBehind = isRemoteNewerRevision(localUnit, remRev, remUpdated);
      const tombMismatch = localUnit ? remDeleted !== Boolean(localUnit.deleted_at) : !remDeleted;
      const fileCountMismatch = localUnit && remFileCount != null && Number(remFileCount) !== Number(localUnit.file_count || 0);
      if (!localUnit || revBehind || tombMismatch || fileCountMismatch) {
        if (!localUnit && remDeleted) continue;
        summaryCounts.content_unit_drift += 1;
        if (localProf?.local_course_id) curriculumLocalCourseIds.add(Number(localProf.local_course_id));
        if (localProf?.remote_course_id) {
          driftedRemoteCourseIds.add(String(localProf.remote_course_id));
          curriculumRemoteCourseIds.add(String(localProf.remote_course_id));
        }
        actions.push({
          correlationId: corr,
          category: "content_unit_drift",
          actionTaken: dryRun ? "planned_curriculum_backfill" : "pending_curriculum_backfill",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: localProf ? Number(localProf.local_course_id) : null,
          externalCourseId: `profile:${rpid}`,
          details: { remoteProfileId: rpid, remoteUnitId: ruid, unitType: uType, remoteRevision: remRev },
        });
      }
    }

    for (const rf of remoteFiles) {
      const rpid = String(rf.profileId ?? rf.remoteProfileId ?? rf.remote_profile_id ?? "").trim();
      const rfid = String(rf.fileId ?? rf.remoteFileId ?? rf.remote_file_id ?? rf.id ?? "").trim();
      if (!rpid || !rfid) continue;
      const localProf = localProfileByRemote.get(rpid) || null;
      const localFile = localFileByKey.get(`${rpid}:${rfid}`) || null;
      const remRev = Number(rf.revision ?? rf.lastRevision ?? rf.last_revision ?? 1);
      const remUpdated = rf.sourceUpdatedAt ?? rf.source_updated_at ?? rf.updatedAt;
      const remDeleted = Boolean(rf.deleted || rf.deletedAt || rf.deleted_at);
      const revBehind = isRemoteNewerRevision(localFile, remRev, remUpdated);
      const tombMismatch = localFile ? remDeleted !== Boolean(localFile.deleted_at) : !remDeleted;
      if (!localFile || revBehind || tombMismatch) {
        if (!localFile && remDeleted) continue;
        summaryCounts.content_file_drift += 1;
        if (localProf?.local_course_id) curriculumLocalCourseIds.add(Number(localProf.local_course_id));
        if (localProf?.remote_course_id) curriculumRemoteCourseIds.add(String(localProf.remote_course_id));
        actions.push({
          correlationId: corr,
          category: "content_file_drift",
          actionTaken: dryRun ? "planned_file_backfill" : "pending_file_backfill",
          sourceSystem: TARGET_SYSTEM,
          localCourseId: localProf ? Number(localProf.local_course_id) : null,
          externalCourseId: `profile:${rpid}`,
          details: { remoteProfileId: rpid, remoteFileId: rfid, remoteRevision: remRev },
        });
      }
    }

    const totalContentDrift = summaryCounts.content_course_drift
      + summaryCounts.content_profile_drift
      + summaryCounts.content_unit_drift
      + summaryCounts.content_file_drift;

    if (!dryRun && totalContentDrift > 0) {
      if (isContentSyncKillSwitchActive(env)) {
        actions.push({
          correlationId: corr,
          category: "content_repair",
          actionTaken: "skipped_due_to_content_sync_kill_switch",
          sourceSystem: TARGET_SYSTEM,
          details: { totalContentDrift },
        });
      } else if (catalogSync) {
        if (driftedRemoteCourseIds.size > 0 && typeof catalogSync.runCatalogBackfill === "function") {
          const backfillRes = await catalogSync.runCatalogBackfill({
            reset: courseIds.length > 0,
            correlationId: corr,
            maxPages: 50,
          });
          summaryCounts.repaired_content_courses += Number(backfillRes?.coursesApplied || 0);
          if (caps.has_profile_projections) {
            const resolvedCourses = await db.query(
              `SELECT DISTINCT local_course_id, remote_course_id FROM course_profile_projections
               WHERE remote_course_id = ANY($1::text[])`,
              [Array.from(driftedRemoteCourseIds)],
            );
            for (const r of resolvedCourses.rows) {
              if (r.local_course_id != null) curriculumLocalCourseIds.add(Number(r.local_course_id));
              if (r.remote_course_id != null) curriculumRemoteCourseIds.add(String(r.remote_course_id));
            }
          }
        }
        if (curriculumLocalCourseIds.size > 0 && caps.has_profile_projections) {
          const missingRc = await db.query(
            `SELECT DISTINCT remote_course_id FROM course_profile_projections WHERE local_course_id = ANY($1::bigint[])`,
            [Array.from(curriculumLocalCourseIds)],
          );
          for (const r of missingRc.rows) {
            if (r.remote_course_id) curriculumRemoteCourseIds.add(String(r.remote_course_id));
          }
        }
        if (curriculumRemoteCourseIds.size > 0 && typeof catalogSync.runCurriculumBackfill === "function") {
          for (const rcId of curriculumRemoteCourseIds) {
            const currRes = await catalogSync.runCurriculumBackfill({
              remoteCourseId: rcId,
              correlationId: corr,
            });
            summaryCounts.repaired_content_curriculum += Number(currRes?.unitsApplied || 0);
          }
        }
      }
    }

    return { skipped: false };
  }

  async function reconcileProgressDomain({
    caps,
    dryRun,
    limit,
    corr,
    userIds,
    externalUserIds,
    courseIds,
    profileIds,
    explicitlyRequested,
    summaryCounts,
    actions,
  }) {
    if (!caps.has_progress_projections) {
      return { skipped: true, reason: "learning_projection_schema_missing" };
    }
    if (!client || (typeof client.isConfigured === "function" && !client.isConfigured())) {
      if (explicitlyRequested) {
        throw new CourseApiError(
          503,
          "COURSE_LMS_NOT_CONFIGURED",
          "CSCA-Course integration credentials are not configured.",
        );
      }
      return { skipped: true, reason: "client_not_configured" };
    }
    if (typeof client.fetchLearningReconciliationSnapshot !== "function") {
      return { skipped: true, reason: "learning_snapshot_method_missing" };
    }

    let remoteLearning;
    try {
      remoteLearning = await client.fetchLearningReconciliationSnapshot({
        userIds,
        externalUserIds,
        courseIds,
        profileIds,
        limit,
        correlationId: corr,
        maxTransportAttempts: explicitlyRequested ? undefined : 1,
      }) || {};
    } catch (error) {
      const status = error?.status ?? error?.httpStatus ?? null;
      if (!explicitlyRequested && (status === 404 || status === 501)) {
        integrationLog.warn("reconcile_learning_endpoint_unsupported", { status }, corr);
        return { skipped: true, reason: "remote_endpoint_not_found" };
      }
      throw error;
    }

    const directProgress = Array.isArray(remoteLearning.progress)
      ? remoteLearning.progress
      : (Array.isArray(remoteLearning.progressEntries) ? remoteLearning.progressEntries : []);
    const directAssessments = Array.isArray(remoteLearning.assessments) ? remoteLearning.assessments : [];
    const remoteVwpList = Array.isArray(remoteLearning.videoWatchProgress) ? remoteLearning.videoWatchProgress : [];
    const remoteSeqList = Array.isArray(remoteLearning.sequentialUnitCompletions)
      ? remoteLearning.sequentialUnitCompletions
      : [];
    const remoteQuizAttempts = Array.isArray(remoteLearning.quizAttempts) ? remoteLearning.quizAttempts : [];
    const remoteAssignments = Array.isArray(remoteLearning.assignmentSubmissions)
      ? remoteLearning.assignmentSubmissions
      : [];

    const vwpByUnitKey = new Map();
    for (const v of remoteVwpList) {
      const uidPart = String(v.userId ?? v.user_id ?? "").trim();
      const unitPart = v.classSessionId != null
        ? `class_session:${v.classSessionId}`
        : v.lessonId != null
          ? `lesson:${v.lessonId}`
          : null;
      if (uidPart && unitPart) {
        vwpByUnitKey.set(`${uidPart}:${unitPart}`, v);
      }
    }

    const synthesizedProgress = [];
    for (const seq of remoteSeqList) {
      const unitsArr = Array.isArray(seq?.units) ? seq.units : [];
      for (const u of unitsArr) {
        const uType = String(u.unitType ?? u.unit_type ?? "lesson").toLowerCase() === "class_session" ? "class_session" : "lesson";
        const uId = String(u.unitId ?? u.id ?? "").trim();
        if (!uId) continue;
        const vwp = vwpByUnitKey.get(`${String(seq.userId ?? "")}:${uType}:${uId}`) || null;
        synthesizedProgress.push({
          userId: seq.userId,
          externalUserIds: seq.externalUserIds,
          courseId: seq.courseId,
          profileId: seq.profileId,
          unitType: uType,
          unitId: uId,
          watchedSeconds: vwp?.watchedSeconds ?? 0,
          lastPositionSeconds: vwp?.lastPositionSeconds ?? 0,
          completionPct: Number(u.progressPercent ?? vwp?.completionPercent ?? 0),
          isVideoCompleted: Boolean(u.isVideoCompleted ?? vwp?.isCompleted),
          isQuizCompleted: Boolean(u.isQuizCompleted),
          isUnitCompleted: Boolean(u.isCompleted),
          isUnlocked: !Boolean(u.isLocked),
          courseCompletionPct: seq.courseCompletionPct ?? null,
          revision: Number(vwp?.syncRevision ?? 1),
          updatedAt: vwp?.updatedAt ?? remoteLearning.checkedAt ?? null,
        });
      }
    }
    const remoteProgress = directProgress.length > 0 ? directProgress : synthesizedProgress;

    const synthesizedAssessments = [
      ...remoteQuizAttempts.map((q) => ({
        itemType: "quiz",
        itemId: q.quizId ?? q.quiz_id,
        remoteAttemptOrSubId: q.id,
        userId: q.userId ?? q.user_id,
        externalUserIds: q.externalUserIds,
        courseId: q.courseId ?? q.course_id,
        profileId: q.profileId ?? q.video_course_profile_id ?? null,
        unitType: q.classSessionId != null ? "class_session" : "lesson",
        unitId: q.classSessionId ?? q.lessonId ?? null,
        status: q.status || "in_progress",
        attemptCount: Number(q.attemptNumber ?? 1),
        score: q.score ?? null,
        maxScore: q.maxScore ?? null,
        revision: Number(q.syncRevision ?? 1),
        updatedAt: q.updatedAt ?? q.submittedAt ?? q.startedAt ?? null,
      })),
      ...remoteAssignments.map((s) => ({
        itemType: "assignment",
        itemId: s.assignmentId ?? s.assignment_id,
        remoteAttemptOrSubId: s.id,
        userId: s.userId ?? s.user_id,
        externalUserIds: s.externalUserIds,
        courseId: s.courseId ?? s.course_id,
        profileId: s.profileId ?? s.video_course_profile_id ?? null,
        unitType: s.classSessionId != null ? "class_session" : "lesson",
        unitId: s.classSessionId ?? s.lessonId ?? null,
        status: s.status || "submitted",
        score: s.latestScore ?? null,
        gradedAt: s.gradedAt ?? null,
        revision: Number(s.syncRevision ?? s.revision ?? 1),
        updatedAt: s.gradedAt ?? s.submittedAt ?? null,
      })),
    ];
    const remoteAssessments = directAssessments.length > 0 ? directAssessments : synthesizedAssessments;
    const remoteNotes = Array.isArray(remoteLearning.notes) ? remoteLearning.notes : [];
    const remoteBookmarks = Array.isArray(remoteLearning.bookmarks) ? remoteLearning.bookmarks : [];
    const remoteQaThreads = Array.isArray(remoteLearning.qaThreads)
      ? remoteLearning.qaThreads
      : (Array.isArray(remoteLearning.qa_threads) ? remoteLearning.qa_threads : []);

    const profiles = caps.has_profile_projections
      ? (await db.query(
        `SELECT id, remote_profile_id, remote_course_id, local_course_id, mode, deleted_at
         FROM course_profile_projections`,
      )).rows
      : [];
    const profileByRemoteId = new Map(profiles.map((p) => [String(p.remote_profile_id), p]));
    const profilesByRemoteCourseId = new Map();
    for (const p of profiles) {
      if (p.deleted_at) continue;
      const rcid = String(p.remote_course_id || "").trim();
      if (!rcid) continue;
      if (!profilesByRemoteCourseId.has(rcid)) profilesByRemoteCourseId.set(rcid, []);
      profilesByRemoteCourseId.get(rcid).push(p);
    }

    const allExtIds = new Set(externalUserIds);
    for (const list of [remoteProgress, remoteAssessments, remoteNotes, remoteBookmarks, remoteQaThreads]) {
      for (const item of list) {
        const extCandidates = [
          item.externalUserId,
          item.external_user_id,
          item.authorExternalUserId,
          item.author_external_user_id,
          ...(Array.isArray(item.externalUserIds) ? item.externalUserIds : []),
        ];
        for (const ext of extCandidates) {
          if (ext) allExtIds.add(String(ext).trim());
        }
      }
    }
    const extUserToLocalId = await resolveLocalUserIdMap(db, Array.from(allExtIds), userIds);

    function resolveItemUserAndProfile(item) {
      const uTypeHint = item.unitType
        ? String(item.unitType).toLowerCase()
        : (item.classSessionId != null ? "class_session" : "lesson");
      let rpid = String(item.profileId ?? item.remoteProfileId ?? item.remote_profile_id ?? "").trim();
      let prof = rpid ? profileByRemoteId.get(rpid) : null;
      if (!prof) {
        const rcidHint = String(item.courseId ?? item.remoteCourseId ?? item.remote_course_id ?? "").trim();
        const courseProfs = rcidHint ? (profilesByRemoteCourseId.get(rcidHint) || []) : [];
        if (courseProfs.length === 1) {
          prof = courseProfs[0];
        } else if (courseProfs.length > 1) {
          prof = courseProfs.find((p) => (
            uTypeHint === "class_session"
              ? String(p.mode || "").toUpperCase() === "MIRROR"
              : String(p.mode || "").toUpperCase() !== "MIRROR"
          )) || courseProfs[0];
        }
        if (prof) rpid = String(prof.remote_profile_id);
      }

      const extCandidates = [
        item.externalUserId,
        item.external_user_id,
        item.authorExternalUserId,
        item.author_external_user_id,
        ...(Array.isArray(item.externalUserIds) ? item.externalUserIds : []),
      ]
        .map((val) => (val != null ? String(val).trim() : ""))
        .filter(Boolean);

      let uid = null;
      let extUid = extCandidates[0] || null;
      for (const candidate of extCandidates) {
        const resolved = extUserToLocalId.get(candidate);
        if (resolved) {
          uid = resolved;
          extUid = candidate;
          break;
        }
      }
      if (!uid && extUid && extUid.startsWith("moly:")) {
        const parsedFromExt = Number(extUid.slice(5));
        if (Number.isSafeInteger(parsedFromExt) && parsedFromExt > 0 && (!userIds.length || userIds.includes(parsedFromExt))) {
          uid = parsedFromExt;
        }
      }
      if (!uid && !Array.isArray(item.externalUserIds) && extCandidates.length === 0) {
        const directUid = Number(item.userId ?? item.user_id ?? item.authorUserId ?? item.author_user_id);
        if (
          Number.isSafeInteger(directUid)
          && directUid > 0
          && (userIds.length === 0 || userIds.includes(directUid))
        ) {
          uid = directUid;
        }
      }
      return { rpid, prof, uid, extUid };
    }

    const localProgressMap = new Map(
      (await db.query("SELECT * FROM course_progress_projections")).rows.map((r) => [
        `${r.user_id}:${r.profile_projection_id}:${r.unit_type}:${r.remote_unit_id}`,
        r,
      ]),
    );
    const localAssessMap = caps.has_assessment_projections
      ? new Map(
        (await db.query("SELECT * FROM course_assessment_projections")).rows.map((r) => [
          `${r.user_id}:${r.profile_projection_id}:${r.item_type}:${r.remote_item_id}`,
          r,
        ]),
      )
      : new Map();
    const localNoteMap = caps.has_note_projections
      ? new Map(
        (await db.query("SELECT * FROM course_note_projections")).rows.map((r) => [
          `${r.profile_projection_id}:${r.remote_note_id}`,
          r,
        ]),
      )
      : new Map();
    const localBookmarkMap = caps.has_bookmark_projections
      ? new Map(
        (await db.query("SELECT * FROM course_bookmark_projections")).rows.map((r) => [
          `${r.profile_projection_id}:${r.remote_bookmark_id}`,
          r,
        ]),
      )
      : new Map();
    const localQaMap = caps.has_qa_thread_projections
      ? new Map(
        (await db.query("SELECT * FROM course_qa_thread_projections")).rows.map((r) => [
          `${r.profile_projection_id}:${r.remote_thread_id}`,
          r,
        ]),
      )
      : new Map();

    const toRepair = { progress: [], assessments: [], notes: [], bookmarks: [], qaThreads: [] };

    for (const item of remoteProgress) {
      const { rpid, prof, uid, extUid } = resolveItemUserAndProfile(item);
      const uType = String(item.unitType ?? item.unit_type ?? "lesson").toLowerCase() === "class_session" ? "class_session" : "lesson";
      const ruid = String(item.unitId ?? item.remoteUnitId ?? item.remote_unit_id ?? "").trim();
      if (!prof || !uid || !ruid) continue;

      const localRow = localProgressMap.get(`${uid}:${prof.id}:${uType}:${ruid}`) || null;
      const remRev = Number(item.revision ?? item.lastRevision ?? item.last_revision ?? 1);
      const remUpdated = item.sourceUpdatedAt ?? item.source_updated_at ?? item.updatedAt;
      const remPct = Number(item.completionPct ?? item.completion_pct ?? 0);
      const remWatched = Number(item.watchedSeconds ?? item.watched_seconds ?? 0);
      const remCompleted = Boolean(item.isUnitCompleted ?? item.is_unit_completed);
      const revBehind = isRemoteNewerRevision(localRow, remRev, remUpdated);
      const monotonicAhead = Boolean(
        localRow && (
          remPct > Number(localRow.completion_pct || 0)
          || remWatched > Number(localRow.watched_seconds || 0)
          || (remCompleted && !localRow.is_unit_completed)
        ),
      );
      if (!localRow || revBehind || monotonicAhead) {
        summaryCounts.progress_unit_drift += 1;
        toRepair.progress.push({
          userId: uid,
          profileProjectionId: Number(prof.id),
          localCourseId: Number(prof.local_course_id),
          unitType: uType,
          remoteUnitId: ruid,
          watchedSeconds: remWatched,
          lastPositionSeconds: Number(item.lastPositionSeconds ?? item.last_position_seconds ?? 0),
          completionPct: remPct,
          isVideoCompleted: Boolean(item.isVideoCompleted ?? item.is_video_completed),
          isQuizCompleted: Boolean(item.isQuizCompleted ?? item.is_quiz_completed),
          isUnitCompleted: remCompleted,
          isUnlocked: item.isUnlocked ?? item.is_unlocked ?? true,
          courseCompletionPct: item.courseCompletionPct ?? item.course_completion_pct ?? null,
          lastUnitId: item.lastUnitId ?? item.last_unit_id ?? null,
          syncRevision: remRev,
          sourceUpdatedAt: remUpdated || now().toISOString(),
        });
        actions.push({
          correlationId: corr,
          category: "progress_unit_drift",
          actionTaken: dryRun ? "planned_progress_upsert" : "pending_progress_upsert",
          sourceSystem: TARGET_SYSTEM,
          userId: uid,
          localCourseId: Number(prof.local_course_id),
          externalUserId: extUid || `moly:${uid}`,
          externalCourseId: `profile:${rpid}`,
          details: { remoteUnitId: ruid, remoteRevision: remRev },
        });
      }
    }

    for (const item of remoteAssessments) {
      const { rpid, prof, uid, extUid } = resolveItemUserAndProfile(item);
      const uType = String(item.unitType ?? item.unit_type ?? (item.classSessionId != null ? "class_session" : "lesson")).toLowerCase() === "class_session" ? "class_session" : "lesson";
      const ruid = String(item.unitId ?? item.remoteUnitId ?? item.remote_unit_id ?? item.classSessionId ?? item.lessonId ?? "").trim();
      const itemType = String(item.itemType ?? item.item_type ?? "quiz").toLowerCase() === "assignment" ? "assignment" : "quiz";
      const itemId = String(item.itemId ?? item.remoteItemId ?? item.remote_item_id ?? "").trim();
      if (!prof || !uid || !ruid || !itemId) continue;

      const localRow = localAssessMap.get(`${uid}:${prof.id}:${itemType}:${itemId}`) || null;
      const remRev = Number(item.revision ?? item.syncRevision ?? item.lastRevision ?? item.last_revision ?? 1);
      const remUpdated = item.sourceUpdatedAt ?? item.source_updated_at ?? item.updatedAt;
      const remDeleted = toIso(item.deletedAt ?? item.deleted_at);
      const remStatus = item.status || "in_progress";
      const revBehind = isRemoteNewerRevision(localRow, remRev, remUpdated);
      const tombMismatch = localRow ? Boolean(remDeleted) !== Boolean(localRow.deleted_at) : Boolean(remDeleted);
      const statusMismatch = Boolean(
        localRow && String(localRow.status || "").toLowerCase() !== String(remStatus).toLowerCase(),
      );
      const scoreMismatch = Boolean(
        localRow && item.score != null && (localRow.score == null || Number(localRow.score) !== Number(item.score)),
      );
      if (!localRow || revBehind || tombMismatch || statusMismatch || scoreMismatch) {
        if (!localRow && remDeleted) continue;
        summaryCounts.progress_assessment_drift += 1;
        const effectiveRev = localRow ? Math.max(remRev, Number(localRow.last_revision || 0) + 1) : remRev;
        toRepair.assessments.push({
          userId: uid,
          profileProjectionId: Number(prof.id),
          unitType: uType,
          remoteUnitId: ruid,
          itemType,
          remoteItemId: itemId,
          remoteAttemptOrSubId: item.remoteAttemptOrSubId ?? item.remote_attempt_or_sub_id ?? null,
          status: remStatus,
          attemptCount: Number(item.attemptCount ?? item.attempt_count ?? 0),
          maxAttempts: item.maxAttempts ?? item.max_attempts ?? null,
          score: item.score ?? null,
          maxScore: item.maxScore ?? item.max_score ?? null,
          canViewSolution: Boolean(item.canViewSolution ?? item.can_view_solution),
          gradedAt: item.gradedAt ?? item.graded_at ?? null,
          deletedAt: remDeleted,
          metadata: item.metadata || {},
          syncRevision: effectiveRev,
          sourceUpdatedAt: remUpdated || now().toISOString(),
        });
        actions.push({
          correlationId: corr,
          category: "progress_assessment_drift",
          actionTaken: dryRun ? "planned_assessment_upsert" : "pending_assessment_upsert",
          sourceSystem: TARGET_SYSTEM,
          userId: uid,
          localCourseId: Number(prof.local_course_id),
          externalUserId: extUid || `moly:${uid}`,
          externalCourseId: `profile:${rpid}`,
          details: { itemType, remoteItemId: itemId, remoteRevision: remRev },
        });
      }
    }

    for (const item of remoteNotes) {
      const { prof, uid } = resolveItemUserAndProfile(item);
      const uType = String(item.unitType ?? item.unit_type ?? (item.classSessionId != null ? "class_session" : "lesson")).toLowerCase() === "class_session" ? "class_session" : "lesson";
      const ruid = String(item.unitId ?? item.remoteUnitId ?? item.remote_unit_id ?? item.classSessionId ?? item.lessonId ?? "").trim();
      const noteId = String(item.noteId ?? item.remoteNoteId ?? item.remote_note_id ?? item.id ?? "").trim();
      if (!prof || !uid || !ruid || !noteId) continue;

      const localRow = localNoteMap.get(`${prof.id}:${noteId}`) || null;
      const remRev = Number(item.revision ?? item.syncRevision ?? item.lastRevision ?? item.last_revision ?? 1);
      const remUpdated = item.sourceUpdatedAt ?? item.source_updated_at ?? item.updatedAt;
      const remDeleted = toIso(item.deletedAt ?? item.deleted_at);
      if (!localRow || isRemoteNewerRevision(localRow, remRev, remUpdated) || (localRow && Boolean(remDeleted) !== Boolean(localRow.deleted_at))) {
        if (!localRow && remDeleted) continue;
        summaryCounts.progress_note_drift += 1;
        toRepair.notes.push({
          userId: uid,
          profileProjectionId: Number(prof.id),
          unitType: uType,
          remoteUnitId: ruid,
          remoteNoteId: noteId,
          timestampSeconds: Number(item.timestampSeconds ?? item.timestamp_seconds ?? 0),
          content: item.content !== undefined ? String(item.content) : String(localRow?.content ?? ""),
          deletedAt: remDeleted,
          syncRevision: remRev,
          sourceUpdatedAt: remUpdated || now().toISOString(),
        });
        actions.push({
          correlationId: corr,
          category: "progress_note_drift",
          actionTaken: dryRun ? "planned_note_upsert" : "pending_note_upsert",
          sourceSystem: TARGET_SYSTEM,
          userId: uid,
          localCourseId: Number(prof.local_course_id),
          details: { remoteNoteId: noteId, remoteRevision: remRev },
        });
      }
    }

    for (const item of remoteBookmarks) {
      const { prof, uid } = resolveItemUserAndProfile(item);
      const uType = String(item.unitType ?? item.unit_type ?? (item.classSessionId != null ? "class_session" : "lesson")).toLowerCase() === "class_session" ? "class_session" : "lesson";
      const ruid = String(item.unitId ?? item.remoteUnitId ?? item.remote_unit_id ?? item.classSessionId ?? item.lessonId ?? "").trim();
      const bmId = String(item.bookmarkId ?? item.remoteBookmarkId ?? item.remote_bookmark_id ?? item.id ?? "").trim();
      if (!prof || !uid || !ruid || !bmId) continue;

      const localRow = localBookmarkMap.get(`${prof.id}:${bmId}`) || null;
      const remRev = Number(item.revision ?? item.syncRevision ?? item.lastRevision ?? item.last_revision ?? 1);
      const remUpdated = item.sourceUpdatedAt ?? item.source_updated_at ?? item.updatedAt;
      const remDeleted = toIso(item.deletedAt ?? item.deleted_at);
      if (!localRow || isRemoteNewerRevision(localRow, remRev, remUpdated) || (localRow && Boolean(remDeleted) !== Boolean(localRow.deleted_at))) {
        if (!localRow && remDeleted) continue;
        summaryCounts.progress_bookmark_drift += 1;
        toRepair.bookmarks.push({
          userId: uid,
          profileProjectionId: Number(prof.id),
          unitType: uType,
          remoteUnitId: ruid,
          remoteBookmarkId: bmId,
          videoAssetId: item.videoAssetId ?? item.video_asset_id ?? null,
          timestampSeconds: Number(item.timestampSeconds ?? item.timestamp_seconds ?? 0),
          label: String(item.label || ""),
          deletedAt: remDeleted,
          syncRevision: remRev,
          sourceUpdatedAt: remUpdated || now().toISOString(),
        });
        actions.push({
          correlationId: corr,
          category: "progress_bookmark_drift",
          actionTaken: dryRun ? "planned_bookmark_upsert" : "pending_bookmark_upsert",
          sourceSystem: TARGET_SYSTEM,
          userId: uid,
          localCourseId: Number(prof.local_course_id),
          details: { remoteBookmarkId: bmId, remoteRevision: remRev },
        });
      }
    }

    for (const item of remoteQaThreads) {
      const { prof, uid, extUid } = resolveItemUserAndProfile(item);
      const uType = String(item.unitType ?? item.unit_type ?? (item.classSessionId != null ? "class_session" : "lesson")).toLowerCase() === "class_session" ? "class_session" : "lesson";
      const ruid = String(item.unitId ?? item.remoteUnitId ?? item.remote_unit_id ?? item.classSessionId ?? item.lessonId ?? "").trim();
      const threadId = String(item.threadId ?? item.remoteThreadId ?? item.remote_thread_id ?? item.id ?? "").trim();
      if (!prof || !ruid || !threadId) continue;

      const localRow = localQaMap.get(`${prof.id}:${threadId}`) || null;
      const remRev = Number(item.revision ?? item.syncRevision ?? item.lastRevision ?? item.last_revision ?? 1);
      const remUpdated = item.sourceUpdatedAt ?? item.source_updated_at ?? item.updatedAt;
      const remDeleted = toIso(item.deletedAt ?? item.deleted_at);
      if (!localRow || isRemoteNewerRevision(localRow, remRev, remUpdated) || (localRow && Boolean(remDeleted) !== Boolean(localRow.deleted_at))) {
        if (!localRow && remDeleted) continue;
        summaryCounts.progress_qa_drift += 1;
        toRepair.qaThreads.push({
          profileProjectionId: Number(prof.id),
          unitType: uType,
          remoteUnitId: ruid,
          remoteThreadId: threadId,
          authorExternalUserId: extUid,
          authorUserId: uid,
          authorName: item.authorName ?? item.author_name ?? localRow?.author_name ?? null,
          authorRole: item.authorRole ?? item.author_role ?? localRow?.author_role ?? null,
          title: item.title ? String(item.title) : String(localRow?.title || "Câu hỏi bài học"),
          status: item.status || "open",
          isPinned: Boolean(item.isPinned ?? item.is_pinned),
          messageCount: Number(item.messageCount ?? item.message_count ?? (Array.isArray(item.messages) ? item.messages.length : 0)),
          messages: Array.isArray(item.messages) ? item.messages : (Array.isArray(item.messagesJson) ? item.messagesJson : []),
          unread: Boolean(item.unread),
          lastMessageAt: item.lastMessageAt ?? item.last_message_at ?? null,
          deletedAt: remDeleted,
          syncRevision: remRev,
          sourceUpdatedAt: remUpdated || now().toISOString(),
        });
        actions.push({
          correlationId: corr,
          category: "progress_qa_drift",
          actionTaken: dryRun ? "planned_qa_upsert" : "pending_qa_upsert",
          sourceSystem: TARGET_SYSTEM,
          userId: uid ?? null,
          localCourseId: Number(prof.local_course_id),
          details: { remoteThreadId: threadId, remoteRevision: remRev },
        });
      }
    }

    const totalLearningRepairs = toRepair.progress.length
      + toRepair.assessments.length
      + toRepair.notes.length
      + toRepair.bookmarks.length
      + toRepair.qaThreads.length;

    if (!dryRun && totalLearningRepairs > 0) {
      await withTx(async (txClient) => {
        for (const p of toRepair.progress) {
          const r = await upsertLearningProgressProjectionTx(txClient, { ...p, now });
          if (r?.action === "updated") summaryCounts.repaired_progress += 1;
        }
        for (const a of toRepair.assessments) {
          const r = await upsertAssessmentProjectionTx(txClient, { ...a, now });
          if (["inserted", "updated", "tombstoned"].includes(r?.action)) summaryCounts.repaired_assessments += 1;
        }
        for (const n of toRepair.notes) {
          const r = await upsertNoteProjectionTx(txClient, { ...n, now });
          if (["inserted", "updated", "tombstoned"].includes(r?.action)) summaryCounts.repaired_notes += 1;
        }
        for (const b of toRepair.bookmarks) {
          const r = await upsertBookmarkProjectionTx(txClient, { ...b, now });
          if (["inserted", "updated", "tombstoned"].includes(r?.action)) summaryCounts.repaired_bookmarks += 1;
        }
        for (const q of toRepair.qaThreads) {
          const r = await upsertQaThreadProjectionTx(txClient, { ...q, now });
          if (["inserted", "updated", "tombstoned"].includes(r?.action)) summaryCounts.repaired_qa_threads += 1;
        }
      });
    }

    return { skipped: false };
  }

  /**
   * Executes 3-way reconciliation between Moly Studio and CSCA-Course across
   * entitlement, content, and progress domains. Allows `dryRun: true` diagnostics
   * when only `mutations_repair` kill switch is active; blocks `!dryRun` writes.
   */
  async function runReconciliation({
    dryRun = true,
    triggerMode = "manual",
    triggeredBy = null,
    scopeFilter = {},
    domains = null,
    userIds = null,
    courseIds = null,
    profileIds = null,
    correlationId = null,
    limit = 500,
    staleMinutes = staleThresholdMinutes,
    dispatchRepairs = true,
  } = {}) {
    const startMs = Date.now();
    const corr = resolveCorrelationId(correlationId);
    const explicitDomainsInput = domains ?? scopeFilter?.domains;
    const hasExplicitDomains = Array.isArray(explicitDomainsInput) && explicitDomainsInput.length > 0;
    const activeDomains = normalizeDomains(explicitDomainsInput);
    const parsedUserFilter = scopeFilter?.userId != null ? Number(scopeFilter.userId) : null;
    const normalizedUserIds = toPositiveIntList(userIds, scopeFilter?.userIds, Number.isSafeInteger(parsedUserFilter) ? parsedUserFilter : null);
    const extUserFilter = scopeFilter?.externalUserId
      || (Number.isSafeInteger(parsedUserFilter) && parsedUserFilter > 0 ? `moly:${parsedUserFilter}` : null);
    const normalizedExtUserIds = toStringList(scopeFilter?.externalUserIds, extUserFilter);
    const normalizedCourseIds = toStringList(courseIds, scopeFilter?.courseIds, scopeFilter?.remoteCourseId);
    const normalizedProfileIds = toStringList(profileIds, scopeFilter?.profileIds, scopeFilter?.profileId);
    const extCourseFilter = scopeFilter?.externalCourseId || null;
    const mutationsRepairPaused = isMutationsRepairKillSwitchActive(env);

    const runRow = await recordRunStart({
      corr,
      triggerMode,
      dryRun,
      triggeredBy,
      scopeFilter: {
        domains: activeDomains,
        ...(extUserFilter ? { externalUserId: extUserFilter } : {}),
        ...(normalizedUserIds.length ? { userIds: normalizedUserIds } : {}),
        ...(extCourseFilter ? { externalCourseId: extCourseFilter } : {}),
        ...(normalizedCourseIds.length ? { courseIds: normalizedCourseIds } : {}),
        ...(normalizedProfileIds.length ? { profileIds: normalizedProfileIds } : {}),
        staleMinutes,
      },
    });

    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.reconciliation.blocked_kill_switch");
      integrationLog.warn("reconciliation_blocked_kill_switch", { dryRun, triggerMode }, corr);
      await finalizeRun(runRow?.id, {
        status: "aborted_kill_switch",
        summaryCounts: { blocked_by_kill_switch: true, domains: activeDomains },
        errorCode: "INTEGRATION_KILL_SWITCH_ACTIVE",
        errorMessage: "Course integration sync is disabled by emergency kill switch.",
      });
      throw new CourseApiError(
        503,
        "INTEGRATION_KILL_SWITCH_ACTIVE",
        "Course integration sync is disabled by emergency kill switch.",
      );
    }

    if (!dryRun && mutationsRepairPaused) {
      recordMetric("moly.reconciliation.blocked_kill_switch");
      integrationLog.warn("reconciliation_blocked_mutations_repair_kill_switch", { dryRun, triggerMode }, corr);
      await finalizeRun(runRow?.id, {
        status: "aborted_kill_switch",
        summaryCounts: { blocked_by_kill_switch: true, mutations_repair_paused: true, domains: activeDomains },
        errorCode: "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE",
        errorMessage: "Reconciliation repair writes are paused by mutations/repair kill switch.",
      });
      throw new CourseApiError(
        503,
        "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE",
        "Reconciliation repair writes are paused by mutations/repair kill switch.",
      );
    }

    const caps = await schemaCaps(db);
    const actions = [];
    const repairedOutboxIds = [];
    const summaryCounts = createEmptySummaryCounts(mutationsRepairPaused);

    async function hasV2ReconciliationContext(domain) {
      if (catalogSync) return true;
      const posture = readRolloutPosture(env);
      if (domain === "content" && posture.catalogConsumerEnabled) return true;
      if (domain === "progress" && (posture.catalogConsumerEnabled || posture.delegatedLearningEnabled)) {
        return true;
      }
      const checks = [];
      if (caps.has_profile_projections) checks.push("EXISTS(SELECT 1 FROM course_profile_projections)");
      if (caps.has_progress_projections) checks.push("EXISTS(SELECT 1 FROM course_progress_projections)");
      if (caps.has_checkpoints) checks.push("EXISTS(SELECT 1 FROM course_sync_checkpoints)");
      if (caps.has_courses && caps.has_course_v2_cols) {
        checks.push("EXISTS(SELECT 1 FROM courses WHERE content_origin = 'csca_course' OR remote_course_id IS NOT NULL)");
      }
      if (checks.length === 0) return false;
      const activeRes = await db.query(`SELECT (${checks.join(" OR ")}) AS active`);
      return Boolean(activeRes.rows[0]?.active);
    }

    try {
      if (activeDomains.includes("entitlement")) {
        await reconcileEntitlementDomain({
          caps,
          dryRun,
          limit,
          staleMinutes,
          corr,
          extUserFilter,
          extCourseFilter,
          parsedUserFilter,
          userIdsFilter: normalizedUserIds,
          summaryCounts,
          actions,
          repairedOutboxIds,
        });
      }
      if (activeDomains.includes("content") && (hasExplicitDomains || await hasV2ReconciliationContext("content"))) {
        await reconcileContentDomain({
          caps,
          dryRun,
          limit,
          corr,
          courseIds: normalizedCourseIds,
          profileIds: normalizedProfileIds,
          explicitlyRequested: hasExplicitDomains,
          summaryCounts,
          actions,
        });
      }
      if (activeDomains.includes("progress") && (hasExplicitDomains || await hasV2ReconciliationContext("progress"))) {
        await reconcileProgressDomain({
          caps,
          dryRun,
          limit,
          corr,
          userIds: normalizedUserIds,
          externalUserIds: normalizedExtUserIds,
          courseIds: normalizedCourseIds,
          profileIds: normalizedProfileIds,
          explicitlyRequested: hasExplicitDomains,
          summaryCounts,
          actions,
        });
      }
    } catch (error) {
      await finalizeRun(runRow?.id, {
        status: "failed",
        errorCode: error?.errorCode || error?.code || "RECONCILIATION_SNAPSHOT_FAILED",
        errorMessage: error?.message || "Failed to execute course reconciliation.",
      });
      throw error;
    }

    summaryCounts.total_discrepancies = (
      summaryCounts.local_active_remote_missing
      + summaryCounts.local_revoked_remote_active
      + summaryCounts.remote_active_unknown_on_moly
      + summaryCounts.missing_course_mapping
      + summaryCounts.identity_missing_or_conflict
      + summaryCounts.stale_pending_event
      + summaryCounts.dead_letter_event
      + summaryCounts.content_course_drift
      + summaryCounts.content_profile_drift
      + summaryCounts.content_unit_drift
      + summaryCounts.content_file_drift
      + summaryCounts.progress_unit_drift
      + summaryCounts.progress_assessment_drift
      + summaryCounts.progress_note_drift
      + summaryCounts.progress_bookmark_drift
      + summaryCounts.progress_qa_drift
    );

    const byDomain = {
      entitlement: {
        discrepancies: summaryCounts.local_active_remote_missing
          + summaryCounts.local_revoked_remote_active
          + summaryCounts.remote_active_unknown_on_moly
          + summaryCounts.missing_course_mapping
          + summaryCounts.identity_missing_or_conflict
          + summaryCounts.stale_pending_event
          + summaryCounts.dead_letter_event,
        repaired_grant: summaryCounts.repaired_grant,
        repaired_revoke: summaryCounts.repaired_revoke,
      },
      content: {
        course_drift: summaryCounts.content_course_drift,
        profile_drift: summaryCounts.content_profile_drift,
        unit_drift: summaryCounts.content_unit_drift,
        file_drift: summaryCounts.content_file_drift,
        repaired_courses: summaryCounts.repaired_content_courses,
        repaired_curriculum: summaryCounts.repaired_content_curriculum,
      },
      progress: {
        unit_drift: summaryCounts.progress_unit_drift,
        assessment_drift: summaryCounts.progress_assessment_drift,
        note_drift: summaryCounts.progress_note_drift,
        bookmark_drift: summaryCounts.progress_bookmark_drift,
        qa_drift: summaryCounts.progress_qa_drift,
        repaired_progress: summaryCounts.repaired_progress,
        repaired_assessments: summaryCounts.repaired_assessments,
        repaired_notes: summaryCounts.repaired_notes,
        repaired_bookmarks: summaryCounts.repaired_bookmarks,
        repaired_qa_threads: summaryCounts.repaired_qa_threads,
      },
    };

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
    const totalRepaired = summaryCounts.repaired_grant
      + summaryCounts.repaired_revoke
      + summaryCounts.repaired_content_courses
      + summaryCounts.repaired_content_curriculum
      + summaryCounts.repaired_progress
      + summaryCounts.repaired_assessments
      + summaryCounts.repaired_notes
      + summaryCounts.repaired_bookmarks
      + summaryCounts.repaired_qa_threads;
    if (totalRepaired > 0) {
      recordMetric("moly.reconciliation.repairs_enqueued", totalRepaired);
    }

    const finalized = await finalizeRun(runRow?.id, {
      status: "completed",
      summaryCounts: {
        ...summaryCounts,
        domains: activeDomains,
        by_domain: byDomain,
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
        domains: activeDomains,
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
      domains: activeDomains,
      summary: { ...summaryCounts, by_domain: byDomain },
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
          const linked = await txClient.query(
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
               linked_by = EXCLUDED.linked_by
             WHERE external_identities.user_id = EXCLUDED.user_id
             RETURNING user_id`,
            [
              conflict.source_system || "csca-course",
              conflict.external_user_id,
              chosenUserId,
              now().toISOString(),
              corr,
              actorId ?? null,
            ],
          );
          if (!linked.rows.length) {
            throw new CourseApiError(409, "IDENTITY_ALREADY_LINKED",
              "This external identity already belongs to another user.");
          }
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
      const mappingCols = await detectMappingSchemaColumns(db);
      const activePred = buildActiveOfferingMappingSqlPredicate("ecm", mappingCols);
      unmappedCourses = (await db.query(
        `SELECT DISTINCT c.id AS local_course_id, c.title AS local_course_title, c.slug AS local_course_slug,
                vp.id AS video_package_id, vp.name AS video_package_name
         FROM video_package_courses vpc
         JOIN video_packages vp ON vp.id = vpc.video_package_id
         JOIN courses c ON c.id = vpc.course_id
         WHERE NOT EXISTS (
           SELECT 1 FROM external_course_mappings ecm
           WHERE ecm.local_course_id = c.id
             AND ${activePred}
         )
         ORDER BY c.id ASC
         LIMIT 100`,
      )).rows;
    }

    let v2InboxCounts = {};
    let v2InboxAttentionItems = [];
    let v2InboxStaleCount = 0;
    if (caps.has_v2_inbox) {
      const countRows = (await db.query(
        "SELECT status, COUNT(*)::int AS count FROM moly_course_sync_inbox GROUP BY status",
      )).rows;
      v2InboxCounts = Object.fromEntries(countRows.map((r) => [r.status, r.count]));
      v2InboxStaleCount = Number((await db.query(
        `SELECT COUNT(*)::int AS count
         FROM moly_course_sync_inbox
         WHERE status IN ('pending', 'processing', 'failed')
           AND created_at <= $1::timestamptz`,
        [staleThreshold],
      )).rows[0]?.count || 0);
      v2InboxAttentionItems = (await db.query(
        `SELECT id, event_id, correlation_id, event_type, aggregate_type, aggregate_id,
                aggregate_revision, status, attempt_count, max_attempts, next_retry_at,
                last_error_code, last_error_message, source_updated_at, created_at, updated_at
         FROM moly_course_sync_inbox
         WHERE status IN ('failed', 'dead_letter', 'ignored', 'pending')
         ORDER BY (status = 'dead_letter') DESC, (status = 'failed') DESC, id DESC
         LIMIT $1`,
        [safeLimit],
      )).rows;
    }

    const checkpoints = caps.has_checkpoints
      ? (await db.query(
        `SELECT stream_name, source_system, last_cursor, after_entity_id, high_water_revision,
                snapshot_anchor_revision, high_water_updated_at, sync_status,
                last_error_code, last_error_message, last_synced_at, updated_at
         FROM course_sync_checkpoints
         ORDER BY stream_name ASC`,
      )).rows
      : [];

    const reconciliationRuns = await listReconciliationRuns({ limit: 15, includeActions: true });
    const latestReconciliationRun = reconciliationRuns[0] || null;
    const killSwitches = getKillSwitchesSnapshot(env);
    const rolloutFlags = readRolloutPosture(env);

    const driftMetrics = {
      openConflicts: Number(conflictCounts.open || 0) + Number(conflictCounts.in_review || 0),
      outboxStalePending: stalePendingCount,
      outboxDeadLetter: Number(outboxCounts.dead_letter || 0),
      v2InboxFailed: Number(v2InboxCounts.failed || 0),
      v2InboxDeadLetter: Number(v2InboxCounts.dead_letter || 0),
      v2InboxIgnored: Number(v2InboxCounts.ignored || 0),
      v2InboxStalePending: v2InboxStaleCount,
      unmappedCourses: unmappedCourses.length,
      latestRunStatus: latestReconciliationRun?.status || null,
      latestRunDiscrepancies: Number(latestReconciliationRun?.summary_counts?.total_discrepancies || 0),
    };

    return {
      killSwitchActive: killSwitches.global,
      killSwitches,
      rolloutFlags,
      metrics: getIntegrationMetricsSnapshot(),
      outboxCounts,
      stalePendingCount,
      conflictCounts,
      outboxItems,
      conflicts,
      unmappedCourses,
      v2InboxCounts,
      v2InboxAttentionItems,
      checkpoints,
      reconciliationRuns,
      latestReconciliationRun,
      driftMetrics,
    };
  }

  /**
   * Per-subject targeted recovery combining entitlement outbox retry,
   * v2 inbox replay, and scoped 3-way reconciliation.
   */
  async function retrySubjectSync({
    userId = null,
    externalUserId = null,
    courseId = null,
    localCourseId = null,
    remoteCourseId = null,
    profileId = null,
    remoteProfileId = null,
    domains = null,
    dryRun = false,
    actorId = null,
    correlationId = null,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    if (isIntegrationKillSwitchActive(env)) {
      throw new CourseApiError(
        503,
        "INTEGRATION_KILL_SWITCH_ACTIVE",
        "Course integration sync is disabled by emergency kill switch.",
      );
    }
    if (!dryRun && isMutationsRepairKillSwitchActive(env)) {
      throw new CourseApiError(
        503,
        "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE",
        "Subject repair writes are paused by mutations/repair kill switch.",
      );
    }

    const parsedUserId = userId != null && Number.isSafeInteger(Number(userId)) && Number(userId) > 0
      ? Number(userId)
      : null;
    const rawExtUser = typeof externalUserId === "string" && externalUserId.trim()
      ? externalUserId.trim()
      : (parsedUserId ? `moly:${parsedUserId}` : null);
    const resolvedUidFromExt = !parsedUserId && rawExtUser?.startsWith("moly:")
      ? (Number.isSafeInteger(Number(rawExtUser.slice(5))) ? Number(rawExtUser.slice(5)) : null)
      : parsedUserId;

    const rawCourseId = courseId ?? localCourseId ?? null;
    const rawRemoteCourseId = typeof remoteCourseId === "string" && remoteCourseId.trim()
      ? remoteCourseId.trim()
      : (rawCourseId != null && !Number.isSafeInteger(Number(rawCourseId)) ? String(rawCourseId).trim() : null);
    const numericLocalCourse = rawCourseId != null && Number.isSafeInteger(Number(rawCourseId)) && Number(rawCourseId) > 0
      ? Number(rawCourseId)
      : null;
    const rawProfileId = String(profileId ?? remoteProfileId ?? "").trim() || null;

    if (!resolvedUidFromExt && !rawExtUser && !numericLocalCourse && !rawRemoteCourseId && !rawProfileId) {
      throw new CourseApiError(
        422,
        "VALIDATION_ERROR",
        "At least one subject identifier (userId, externalUserId, courseId, or profileId) is required.",
      );
    }

    const activeDomains = normalizeDomains(domains);
    const caps = await schemaCaps(db);

    const localCourseIds = new Set(numericLocalCourse ? [numericLocalCourse] : []);
    const remoteCourseIds = new Set(rawRemoteCourseId ? [rawRemoteCourseId] : []);
    const remoteProfileIds = new Set(rawProfileId ? [rawProfileId] : []);
    const externalOfferings = new Set(rawProfileId ? [`profile:${rawProfileId}`] : []);

    if (caps.has_profile_projections) {
      const profRes = await db.query(
        `SELECT local_course_id, remote_course_id, remote_profile_id, external_offering_id
         FROM course_profile_projections
         WHERE ($1::bigint IS NOT NULL AND local_course_id = $1)
            OR ($2::text IS NOT NULL AND remote_course_id = $2)
            OR ($3::text IS NOT NULL AND remote_profile_id = $3)`,
        [numericLocalCourse, rawRemoteCourseId, rawProfileId],
      );
      for (const r of profRes.rows) {
        if (r.local_course_id != null) localCourseIds.add(Number(r.local_course_id));
        if (r.remote_course_id) remoteCourseIds.add(String(r.remote_course_id));
        if (r.remote_profile_id) remoteProfileIds.add(String(r.remote_profile_id));
        if (r.external_offering_id) externalOfferings.add(String(r.external_offering_id));
      }
    }

    if (caps.has_courses && caps.has_course_v2_cols && (numericLocalCourse || rawRemoteCourseId)) {
      const cRes = await db.query(
        `SELECT id, remote_course_id FROM courses
         WHERE ($1::bigint IS NOT NULL AND id = $1)
            OR ($2::text IS NOT NULL AND remote_course_id = $2)`,
        [numericLocalCourse, rawRemoteCourseId],
      );
      for (const r of cRes.rows) {
        localCourseIds.add(Number(r.id));
        if (r.remote_course_id) remoteCourseIds.add(String(r.remote_course_id));
      }
    }

    if (numericLocalCourse) externalOfferings.add(`moly:${numericLocalCourse}`);
    const offeringList = Array.from(externalOfferings);

    const outboxRetry = { matched: 0, retriedIds: [], processed: [], errors: [] };
    if (activeDomains.includes("entitlement") && caps.has_outbox) {
      const outboxRows = (await db.query(
        `SELECT id, status, event_type, external_course_id
         FROM integration_outbox
         WHERE status IN ('pending', 'failed', 'dead_letter')
           AND ($1::int IS NULL OR user_id = $1)
           AND ($2::text[] IS NULL OR external_course_id = ANY($2::text[]))
         ORDER BY id ASC
         LIMIT 25`,
        [resolvedUidFromExt, offeringList.length ? offeringList : null],
      )).rows;
      outboxRetry.matched = outboxRows.length;
      if (!dryRun && outbox) {
        let hadPending = false;
        for (const row of outboxRows) {
          if (row.status === "pending") {
            hadPending = true;
            continue;
          }
          if (typeof outbox.retryOutboxItem === "function") {
            try {
              await outbox.retryOutboxItem({
                outboxId: row.id,
                actorId,
                correlationId: corr,
                dispatchNow: true,
              });
              outboxRetry.retriedIds.push(Number(row.id));
            } catch (err) {
              outboxRetry.errors.push({
                outboxId: Number(row.id),
                code: err?.errorCode || err?.code || "OUTBOX_RETRY_FAILED",
                message: err?.message || "Outbox retry failed.",
              });
            }
          }
        }
        if (hadPending && typeof outbox.processAvailableOutboxJobs === "function") {
          const proc = await outbox.processAvailableOutboxJobs({
            workerId: `subject-retry:${actorId ?? "admin"}`,
            limit: 25,
          });
          outboxRetry.processed = proc?.dispatched || [];
        }
      }
    }

    const inboxReplay = { matched: 0, retriedIds: [], skippedReason: null, errors: [] };
    if (caps.has_v2_inbox) {
      const subjectTokens = toStringList(
        resolvedUidFromExt != null ? String(resolvedUidFromExt) : null,
        rawExtUser,
        Array.from(remoteCourseIds),
        Array.from(remoteProfileIds),
      );
      const inboxRows = (await db.query(
        `SELECT id, status, event_type, aggregate_type, aggregate_id
         FROM moly_course_sync_inbox
         WHERE status IN ('pending', 'failed', 'dead_letter')
           AND (
             aggregate_id = ANY($1::text[])
             OR COALESCE(payload->>'userId', '') = ANY($1::text[])
             OR COALESCE(payload->>'externalUserId', '') = ANY($1::text[])
             OR COALESCE(payload->>'courseId', '') = ANY($1::text[])
             OR COALESCE(payload->>'profileId', '') = ANY($1::text[])
           )
         ORDER BY aggregate_revision ASC, id ASC
         LIMIT 25`,
        [subjectTokens],
      )).rows;
      inboxReplay.matched = inboxRows.length;
      if (!dryRun) {
        if (isContentSyncKillSwitchActive(env)) {
          inboxReplay.skippedReason = "SYNC_KILL_SWITCH_ACTIVE";
        } else if (catalogSync && typeof catalogSync.retryInboxItem === "function") {
          for (const row of inboxRows) {
            try {
              await catalogSync.retryInboxItem(row.id, {
                actorId,
                correlationId: corr,
                dispatchNow: true,
              });
              inboxReplay.retriedIds.push(Number(row.id));
            } catch (err) {
              inboxReplay.errors.push({
                inboxId: Number(row.id),
                code: err?.errorCode || err?.code || "INBOX_RETRY_FAILED",
                message: err?.message || "Inbox retry failed.",
              });
            }
          }
        }
      }
    }

    let reconciliation = null;
    if (client && typeof client.isConfigured === "function" && client.isConfigured()) {
      reconciliation = await runReconciliation({
        dryRun,
        triggerMode: "api",
        triggeredBy: actorId,
        correlationId: corr,
        domains: activeDomains,
        scopeFilter: {
          ...(resolvedUidFromExt ? { userId: resolvedUidFromExt } : {}),
          ...(rawExtUser ? { externalUserId: rawExtUser } : {}),
          ...(offeringList.length === 1 ? { externalCourseId: offeringList[0] } : {}),
          courseIds: Array.from(remoteCourseIds),
          profileIds: Array.from(remoteProfileIds),
        },
        dispatchRepairs: !dryRun,
      });
    } else {
      reconciliation = { skipped: true, reason: "COURSE_LMS_NOT_CONFIGURED" };
    }

    return {
      dryRun: Boolean(dryRun),
      correlationId: corr,
      domains: activeDomains,
      target: {
        userId: resolvedUidFromExt,
        externalUserId: rawExtUser,
        localCourseIds: Array.from(localCourseIds),
        remoteCourseIds: Array.from(remoteCourseIds),
        profileIds: Array.from(remoteProfileIds),
      },
      outboxRetry,
      inboxReplay,
      reconciliation,
    };
  }

  return {
    runReconciliation,
    listReconciliationRuns,
    resolveIntegrationConflict,
    listAdminOperationsOverview,
    retrySubjectSync,
  };
}

module.exports = {
  createCourseReconciliationService,
  buildExpectedGrantId,
  normalizeMolyOfferingId,
};
