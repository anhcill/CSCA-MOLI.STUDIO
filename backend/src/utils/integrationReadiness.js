const { TABLES } = require("../../scripts/apply_course_integration_migration");
const {
  getKillSwitchesSnapshot,
  readRolloutPosture,
  resolveCorrelationId,
} = require("./integrationLogger");
const { parseFeatureFlag } = require("./courseFeatureConfig");

const SENSITIVE_KEY_PATTERN = /(secret|password|token|signature|private_key|api_key|authorization)/i;

function sanitizeProbeData(value, depth = 0) {
  if (depth > 4 || value == null) return value ?? null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeProbeData(item, depth + 1));
  }
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) continue;
    clean[k] = sanitizeProbeData(v, depth + 1);
  }
  return clean;
}

function resolveSafeTargetOrigin(env = process.env) {
  const raw = String(env.COURSE_LMS_BASE_URL || env.COURSE_INTEGRATION_BASE_URL || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Checks local DB connectivity, presence of migrations 076-082 integration tables,
 * rollout posture flags, kill-switch states, and worker readiness without exposing secrets.
 */
async function collectIntegrationReadiness({
  db,
  client = null,
  env = process.env,
  workerStatus = null,
} = {}) {
  const killSwitches = getKillSwitchesSnapshot(env);
  const rolloutFlags = {
    coursesEnabled: parseFeatureFlag(env.CSCA_COURSES_ENABLED ?? "true", "CSCA_COURSES_ENABLED"),
    ...readRolloutPosture(env),
  };
  const clientConfigured = Boolean(client && typeof client.isConfigured === "function" && client.isConfigured());
  const targetOrigin = resolveSafeTargetOrigin(env);

  let dbConnected = false;
  let presentTables = [];
  let missingTables = [...TABLES];

  if (db && typeof db.query === "function") {
    try {
      await db.query("SELECT 1");
      dbConnected = true;
      const tblRes = await db.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = current_schema()
           AND table_name = ANY($1::text[])
         ORDER BY table_name ASC`,
        [TABLES],
      );
      presentTables = tblRes.rows.map((r) => r.table_name);
      const presentSet = new Set(presentTables);
      missingTables = TABLES.filter((t) => !presentSet.has(t));
    } catch {
      dbConnected = false;
    }
  }

  const ready = dbConnected && missingTables.length === 0;

  return {
    status: ready ? "ready" : "not_ready",
    ready,
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
    },
    migrations: {
      requiredTableCount: TABLES.length,
      presentTableCount: presentTables.length,
      missingTables,
    },
    clientConfigured,
    targetOrigin,
    killSwitches,
    rolloutFlags,
    worker: workerStatus || null,
  };
}

/**
 * Performs local readiness verification plus a live HMAC-signed handshake against
 * CSCA-Course GET /api/integrations/v2/health.
 */
async function runContractProbe({
  db,
  client = null,
  env = process.env,
  workerStatus = null,
  correlationId = null,
} = {}) {
  const corr = resolveCorrelationId(correlationId);
  const local = await collectIntegrationReadiness({ db, client, env, workerStatus });

  let remote;
  if (local.killSwitches.global) {
    remote = {
      probed: false,
      reachable: false,
      reason: "INTEGRATION_KILL_SWITCH_ACTIVE",
    };
  } else if (!client || typeof client.probeCourseContract !== "function" || (typeof client.isConfigured === "function" && !client.isConfigured())) {
    remote = {
      probed: false,
      reachable: false,
      reason: "COURSE_LMS_NOT_CONFIGURED",
    };
  } else {
    const startMs = Date.now();
    try {
      const payload = await client.probeCourseContract({
        correlationId: corr,
        maxTransportAttempts: 1,
      });
      remote = {
        probed: true,
        reachable: true,
        latencyMs: Date.now() - startMs,
        contract: sanitizeProbeData(payload),
      };
    } catch (error) {
      remote = {
        probed: true,
        reachable: false,
        latencyMs: Date.now() - startMs,
        httpStatus: error?.status || error?.httpStatus || null,
        errorCode: error?.errorCode || error?.code || "CONTRACT_PROBE_FAILED",
        message: String(error?.message || "Remote contract probe failed.").slice(0, 240),
      };
    }
  }

  return {
    correlationId: corr,
    healthy: Boolean(local.ready && (!remote.probed || remote.reachable)),
    local,
    remote,
  };
}

module.exports = {
  collectIntegrationReadiness,
  runContractProbe,
  resolveSafeTargetOrigin,
};
