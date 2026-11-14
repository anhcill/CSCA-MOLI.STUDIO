const { CourseApiError } = require("../utils/courseResponses");

function isWithinValidityWindow(row, currentNow) {
  const nowMs = currentNow.getTime();
  const validFromMs = row.valid_from ? new Date(row.valid_from).getTime() : 0;
  const validUntilMs = row.valid_until ? new Date(row.valid_until).getTime() : null;
  if (validFromMs > nowMs) return false;
  if (validUntilMs !== null && validUntilMs <= nowMs) return false;
  return true;
}

function classifyOriginSystem(externalGrantId) {
  if (typeof externalGrantId !== "string") return "csca-course";
  if (externalGrantId.startsWith("internal-management:")) return "internal-management";
  if (externalGrantId.startsWith("moly:")) return "moly";
  return "csca-course";
}

function normalizeOfferingId(mappingRow) {
  if (!mappingRow) return null;
  const raw = mappingRow.source_system === "moly"
    ? mappingRow.external_course_id
    : mappingRow.metadata?.moly_external_course_id;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.startsWith("moly:") && trimmed.length > 5 ? trimmed : null;
}

/**
 * Syncs CSCA-Course ownership projections into `external_entitlements` (non-authoritative
 * read mirror; never triggers outbound echo events) and computes combined ownership/purchase state.
 */
function createCourseOwnershipProjectionService({
  db,
  client = null,
  outbox = null,
  now = () => new Date(),
  logger = console,
} = {}) {
  async function withTx(work) {
    if (typeof db.transaction === "function") return db.transaction(work);
    if (db.pool && typeof db.pool.connect === "function") {
      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");
        const res = await work(conn);
        await conn.query("COMMIT");
        return res;
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
         to_regclass('external_entitlements') IS NOT NULL AS has_ext_entitlements,
         to_regclass('external_course_mappings') IS NOT NULL AS has_mappings,
         to_regclass('external_identities') IS NOT NULL AS has_identities,
         to_regclass('integration_outbox') IS NOT NULL AS has_outbox`,
    );
    return res.rows[0] || {};
  }

  async function loadMappedOfferings(runner, localCourseIds = null) {
    const hasFilter = Array.isArray(localCourseIds) && localCourseIds.length > 0;
    const rows = (await runner.query(
      `SELECT id, source_system, external_course_id, local_course_id, local_video_package_id, status, metadata
       FROM external_course_mappings
       WHERE status = 'active'
         AND (source_system = 'moly' OR (source_system = 'csca-course' AND (metadata ? 'moly_external_course_id')))
         AND ($1::boolean = FALSE OR local_course_id = ANY($2::bigint[]))
       ORDER BY id ASC`,
      [hasFilter, hasFilter ? localCourseIds.map(Number) : []],
    )).rows;

    return rows
      .map((row) => ({ ...row, offering_id: normalizeOfferingId(row) }))
      .filter((row) => Boolean(row.offering_id));
  }

  /**
   * Queries `/api/integrations/v1/ownership/query` on CSCA-Course and projects
   * external ownership / blocked grants into Moly's `external_entitlements` without guessing.
   */
  async function syncUserOwnershipFromCourse(
    userIdValue,
    { localCourseIds = null, correlationId = null, throwOnError = false } = {},
  ) {
    const userId = Number(userIdValue);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new CourseApiError(422, "VALIDATION_ERROR", "Valid userId is required.");
    }
    if (!client || !client.isConfigured()) {
      return { synced: false, reason: "CLIENT_NOT_CONFIGURED", items: [] };
    }

    const caps = await schemaCaps(db);
    if (!caps.has_mappings || !caps.has_ext_entitlements) {
      return { synced: false, reason: "INTEGRATION_SCHEMA_MISSING", items: [] };
    }

    const mappings = await loadMappedOfferings(db, localCourseIds);
    const externalCourseIds = [...new Set(mappings.map((m) => m.offering_id))];
    if (!externalCourseIds.length) {
      return { synced: false, reason: "NO_ACTIVE_MAPPINGS", items: [] };
    }

    const corr = correlationId || `corr_own_${userId}_${now().getTime()}`;
    let response;
    try {
      response = await client.queryOwnership({
        correlationId: corr,
        externalUserId: `moly:${userId}`,
        externalCourseIds,
      });
    } catch (error) {
      if (throwOnError) throw error;
      logger?.warn?.("[course-ownership] Ownership query failed; using local cache", {
        userId,
        code: error?.code || "OWNERSHIP_QUERY_FAILED",
      });
      return { synced: false, reason: error?.code || "OWNERSHIP_QUERY_FAILED", items: [] };
    }

    const remoteData = response.payload.data || {};
    const remoteItems = Array.isArray(remoteData.items) ? remoteData.items : [];
    const mappingByOffering = new Map(mappings.map((m) => [m.offering_id, m]));
    let projectedCount = 0;
    let unmappedIgnored = 0;

    await withTx(async (txClient) => {
      // Optionally keep local record of verified CSCA-Course user link if Course linked it.
      let externalIdentityId = null;
      if (caps.has_identities && remoteData.identity?.local_user_id) {
        const extCourseUserId = `csca-course:${remoteData.identity.local_user_id}`;
        const existingId = (await txClient.query(
          "SELECT id, user_id, status FROM external_identities WHERE source_system = 'csca-course' AND external_user_id = $1",
          [extCourseUserId],
        )).rows[0];
        if (!existingId) {
          const insertedId = (await txClient.query(
            `INSERT INTO external_identities (source_system, external_user_id, user_id, status, source_updated_at)
             VALUES ('csca-course', $1, $2, $3, $4)
             ON CONFLICT (source_system, external_user_id) DO NOTHING
             RETURNING id`,
            [
              extCourseUserId,
              userId,
              ["active", "revoked", "expired", "suspended"].includes(remoteData.identity.status)
                ? remoteData.identity.status
                : "active",
              remoteData.checked_at || now().toISOString(),
            ],
          )).rows[0];
          externalIdentityId = insertedId?.id ? Number(insertedId.id) : null;
        } else if (Number(existingId.user_id) === userId) {
          externalIdentityId = Number(existingId.id);
        }
      }

      for (const item of remoteItems) {
        const offeringId = typeof item.external_course_id === "string" ? item.external_course_id.trim() : "";
        const mapping = mappingByOffering.get(offeringId);
        // Never trust unmapped course IDs or titles returned by remote APIs.
        if (!mapping) {
          unmappedIgnored += 1;
          continue;
        }

        if (!item.external_grant_id || !item.status) {
          // Clear previously cached non-Moly active projections for this offering when Course reports none.
          await txClient.query(
            `UPDATE external_entitlements
             SET effective_owned = FALSE,
                 status = 'expired',
                 valid_until = LEAST(COALESCE(valid_until, NOW()), NOW()),
                 source_updated_at = GREATEST(source_updated_at + INTERVAL '1 millisecond', $3::timestamptz),
                 correlation_id = $4
             WHERE user_id = $1
               AND external_course_id = $2
               AND source_system IN ('csca-course', 'internal-management')
               AND (effective_owned = TRUE OR status IN ('active', 'suspended'))`,
            [userId, offeringId, remoteData.checked_at || now().toISOString(), corr],
          );
          continue;
        }

        const originSystem = classifyOriginSystem(item.external_grant_id);
        const isRetainedBlocked = item.owned === false && ["active", "suspended"].includes(item.status);
        // Moly already owns the authoritative lifecycle for active `moly:grant:...` rows
        // via user_video_entitlements + integration_outbox; only project external grants
        // (csca-course / internal-management) OR retained blocked grants (owned=false with active/suspended)
        // so blocked access still prevents duplicate charging (Codex Day 2 #7).
        if (originSystem === "moly" && !isRetainedBlocked) {
          continue;
        }

        const status = ["active", "revoked", "expired", "suspended"].includes(item.status)
          ? item.status
          : "suspended";
        const validFrom = item.valid_from || item.source_updated_at || now().toISOString();
        const validUntil = item.valid_until || null;
        const rawSourceUpdatedAt = item.source_updated_at || remoteData.checked_at || now().toISOString();
        const extUserId = remoteData.identity?.local_user_id
          ? `csca-course:${remoteData.identity.local_user_id}`
          : `moly:${userId}`;

        const existingGrant = (await txClient.query(
          `SELECT id, user_id, local_course_id, status, valid_from, valid_until, source_updated_at
           FROM external_entitlements
           WHERE source_system = $1 AND external_grant_id = $2
           FOR UPDATE`,
          [originSystem, item.external_grant_id],
        )).rows[0];

        if (existingGrant) {
          if (Number(existingGrant.user_id) !== userId || Number(existingGrant.local_course_id) !== Number(mapping.local_course_id)) {
            continue;
          }
          const incomingMs = new Date(rawSourceUpdatedAt).getTime();
          const storedMs = new Date(existingGrant.source_updated_at).getTime();
          const rightsChanged = (
            existingGrant.status !== status
            || (existingGrant.valid_until ? new Date(existingGrant.valid_until).toISOString() : null)
              !== (validUntil ? new Date(validUntil).toISOString() : null)
          );
          const safeTs = rightsChanged && incomingMs <= storedMs
            ? new Date(storedMs + 1).toISOString()
            : rawSourceUpdatedAt;

          if (!rightsChanged) {
            await txClient.query(
              `UPDATE external_entitlements
               SET effective_owned = $2,
                   correlation_id = $3,
                   metadata = external_entitlements.metadata || $4::jsonb
               WHERE id = $1`,
              [
                existingGrant.id,
                Boolean(item.owned),
                corr,
                JSON.stringify({ remote_local_course_id: item.local_course_id ?? null, last_synced_at: now().toISOString() }),
              ],
            );
          } else {
            await txClient.query(
              `UPDATE external_entitlements
               SET status = $2::varchar(20),
                   valid_from = $3,
                   valid_until = $4,
                   revoked_at = CASE WHEN $2::varchar(20) = 'revoked' THEN COALESCE(revoked_at, $5::timestamptz) ELSE NULL END,
                   effective_owned = $6,
                   source_updated_at = $5::timestamptz,
                   correlation_id = $7,
                   metadata = external_entitlements.metadata || $8::jsonb
               WHERE id = $1`,
              [
                existingGrant.id,
                status,
                validFrom,
                validUntil,
                safeTs,
                Boolean(item.owned),
                corr,
                JSON.stringify({ remote_local_course_id: item.local_course_id ?? null, last_synced_at: now().toISOString() }),
              ],
            );
          }
          projectedCount += 1;
          continue;
        }

        await txClient.query(
          `INSERT INTO external_entitlements (
             source_system, origin_system, external_grant_id, external_user_id, external_course_id,
             user_id, local_course_id, course_mapping_id, external_identity_id,
             status, effective_owned, valid_from, valid_until, revoked_at,
             source_updated_at, correlation_id, metadata
           )
           VALUES (
             $1::varchar(50), $1::varchar(32), $2, $3, $4,
             $5, $6, $7, $8,
             $9::varchar(20), $10, $11, $12, CASE WHEN $9::varchar(20) = 'revoked' THEN $13::timestamptz ELSE NULL END,
             $13::timestamptz, $14, $15::jsonb
           )`,
          [
            originSystem,
            item.external_grant_id,
            extUserId,
            offeringId,
            userId,
            Number(mapping.local_course_id),
            Number(mapping.id),
            originSystem === "csca-course" ? externalIdentityId : null,
            status,
            Boolean(item.owned),
            validFrom,
            validUntil,
            rawSourceUpdatedAt,
            corr,
            JSON.stringify({
              projected_from: "ownership_query",
              remote_local_course_id: item.local_course_id ?? null,
              last_synced_at: now().toISOString(),
            }),
          ],
        );
        projectedCount += 1;
      }
    });

    return {
      synced: true,
      projectedCount,
      unmappedIgnored,
      checkedAt: remoteData.checked_at || now().toISOString(),
      items: remoteItems,
    };
  }

  /**
   * Evaluates combined local + external ownership and purchase eligibility for a set of local courses.
   * Safe against offline/missing integration tables.
   */
  async function evaluatePackageOwnership(
    userIdValue,
    {
      courseIds = [],
      videoPackageId = null,
      refreshFromCourse = false,
      client: runner = db,
      currentNow = null,
    } = {},
  ) {
    const evalNow = currentNow || now();
    const userId = userIdValue == null ? null : Number(userIdValue);
    const uniqueCourseIds = [...new Set((courseIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];

    if (!userId || !uniqueCourseIds.length) {
      return {
        owned: false,
        status: "not_owned",
        label: null,
        canPurchase: true,
        blockCode: null,
        localOwnedCourseIds: [],
        externalOwnedCourseIds: [],
        blockedCourseIds: [],
        pendingSyncCourseIds: [],
      };
    }

    if (refreshFromCourse && client?.isConfigured?.()) {
      // Only perform network IO when caller passes default db (never inside an open SQL transaction).
      await syncUserOwnershipFromCourse(userId, { localCourseIds: uniqueCourseIds, throwOnError: false });
    }

    const caps = await schemaCaps(runner);

    // 1) Local video entitlements covering these courses.
    const localCourseSet = new Set();
    const hasVideoEntitlements = (await runner.query("SELECT to_regclass('user_video_entitlements') AS rel")).rows[0]?.rel;
    if (hasVideoEntitlements) {
      const localRows = (await runner.query(
        `SELECT DISTINCT ec.course_id
         FROM user_video_entitlements e
         JOIN video_entitlement_courses ec ON ec.entitlement_id = e.id
         WHERE e.user_id = $1
           AND e.status = 'active'
           AND e.starts_at <= $3
           AND (e.expires_at IS NULL OR e.expires_at > $3)
           AND ec.course_id = ANY($2::bigint[])`,
        [userId, uniqueCourseIds, evalNow.toISOString()],
      )).rows;
      for (const r of localRows) localCourseSet.add(Number(r.course_id));
    }

    // 2) Projected external entitlements (csca-course / internal-management / external mirrors).
    const externalOwnedSet = new Set();
    const blockedCourseSet = new Set();
    const externalRows = [];
    if (caps.has_ext_entitlements) {
      const rows = (await runner.query(
        `SELECT ee.*, COALESCE(ee.effective_owned, TRUE) AS is_effective_owned
         FROM external_entitlements ee
         WHERE ee.user_id = $1
           AND ee.local_course_id = ANY($2::bigint[])
         ORDER BY ee.source_updated_at DESC, ee.id DESC`,
        [userId, uniqueCourseIds],
      )).rows;

      for (const row of rows) {
        externalRows.push(row);
        const courseId = Number(row.local_course_id);
        const notExpired = !row.valid_until || new Date(row.valid_until).getTime() > evalNow.getTime();
        const withinWindow = isWithinValidityWindow(row, evalNow);

        if (row.status === "active" && withinWindow && row.is_effective_owned !== false) {
          externalOwnedSet.add(courseId);
        } else if (
          ["active", "suspended"].includes(row.status)
          && notExpired
          && (row.status === "suspended" || row.is_effective_owned === false)
        ) {
          // Codex Day 2 rule #7: retained non-expired active/suspended grant with owned=false
          // indicates blocked/revoked profile access; block duplicate charging!
          blockedCourseSet.add(courseId);
        }
      }
    }

    // 3) In-flight sync state from integration_outbox + paid-unfulfilled orders.
    const pendingSyncCourseSet = new Set();
    let userProvisionInFlight = false;
    if (caps.has_outbox) {
      const inflight = (await runner.query(
        `SELECT id, event_type, status, remote_status, external_course_id, metadata, payload
         FROM integration_outbox
         WHERE user_id = $1
           AND event_type IN ('user.provisioned', 'entitlement.granted')
           AND (
             status IN ('pending', 'processing', 'failed')
             OR (status = 'sent' AND COALESCE(remote_status, 'queued') IN ('queued', 'pending', 'processing'))
           )`,
        [userId],
      )).rows;

      for (const row of inflight) {
        if (row.event_type === "user.provisioned") {
          userProvisionInFlight = true;
          continue;
        }
        const metaCourseId = Number(row.metadata?.local_course_id ?? row.payload?.metadata?.local_course_id);
        if (uniqueCourseIds.includes(metaCourseId)) {
          pendingSyncCourseSet.add(metaCourseId);
        }
      }

      // If provision itself is still syncing and this user has pending grants in that tx,
      // ensure affected courses show pending sync.
      if (userProvisionInFlight && videoPackageId != null && outbox && pendingSyncCourseSet.size === 0) {
        const hasPendingPkgOrders = hasVideoEntitlements && (await runner.query(
          `SELECT 1 FROM user_video_entitlements e
           JOIN video_entitlement_courses ec ON ec.entitlement_id = e.id
           WHERE e.user_id = $1 AND e.video_package_id = $2 AND e.status = 'active'
             AND ec.course_id = ANY($3::bigint[])
           LIMIT 1`,
          [userId, Number(videoPackageId), uniqueCourseIds],
        )).rows.length > 0;
        if (hasPendingPkgOrders) {
          for (const cid of uniqueCourseIds) pendingSyncCourseSet.add(cid);
        }
      }
    }

    const ownedCourseIds = uniqueCourseIds.filter(
      (cid) => localCourseSet.has(cid) || externalOwnedSet.has(cid),
    );
    const syncedOwnedCourseIds = ownedCourseIds.filter((cid) => !pendingSyncCourseSet.has(cid));

    let status = "not_owned";
    let label = null;
    let canPurchase = true;
    let blockCode = null;
    let owned = false;

    if (blockedCourseSet.size > 0 && syncedOwnedCourseIds.length < uniqueCourseIds.length) {
      status = "grant_blocked";
      label = "Đang tạm khóa quyền";
      canPurchase = false;
      blockCode = "EXTERNAL_GRANT_BLOCKED";
    } else if (pendingSyncCourseSet.size > 0) {
      status = "pending_sync";
      label = "Đang đồng bộ quyền";
      canPurchase = false;
      blockCode = "PENDING_SYNC";
    } else if (syncedOwnedCourseIds.length === uniqueCourseIds.length) {
      owned = true;
      status = "owned";
      label = "Đã sở hữu";
      canPurchase = false;
      blockCode = "ALREADY_OWNED";
    } else if (externalOwnedSet.size > 0) {
      status = "partially_owned";
      label = "Đã sở hữu";
      canPurchase = false;
      blockCode = "ALREADY_OWNED";
    }

    return {
      owned,
      status,
      label,
      canPurchase,
      blockCode,
      localOwnedCourseIds: [...localCourseSet],
      externalOwnedCourseIds: [...externalOwnedSet],
      blockedCourseIds: [...blockedCourseSet],
      pendingSyncCourseIds: [...pendingSyncCourseSet],
      externalGrantsCount: externalRows.length,
    };
  }

  return {
    syncUserOwnershipFromCourse,
    evaluatePackageOwnership,
  };
}

module.exports = { createCourseOwnershipProjectionService };
