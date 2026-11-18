const db = require("../config/database");
const { createCourseIntegrationClient } = require("./courseIntegrationClient");
const { createCourseOutboxSyncService } = require("./courseOutboxSyncService");
const { createCourseOwnershipProjectionService } = require("./courseOwnershipProjectionService");
const { createCourseReconciliationService } = require("./courseReconciliationService");
const { createMolyCourseCatalogSyncService } = require("./molyCourseCatalogSyncService");
const { createMolyCourseWorkspaceService } = require("./molyCourseWorkspaceService");
const {
  createIntegrationLogger,
  getKillSwitchesSnapshot,
  isContentSyncKillSwitchActive,
  isIntegrationKillSwitchActive,
  isMutationsRepairKillSwitchActive,
  readRolloutPosture,
} = require("../utils/integrationLogger");

const client = createCourseIntegrationClient();
const outbox = createCourseOutboxSyncService({ db, client });
const ownership = createCourseOwnershipProjectionService({ db, client, outbox });
const catalogSync = createMolyCourseCatalogSyncService({ db, client });
const reconciliation = createCourseReconciliationService({ db, client, outbox, catalogSync });
const workspace = createMolyCourseWorkspaceService({ db, client, ownership });
const workerLog = createIntegrationLogger({ component: "course-worker" });

let workerTimer = null;
let workerRunning = false;
let lastReconcileAtMs = 0;
let lastCatalogPullAtMs = 0;
let lastPaymentMaintenanceAtMs = 0;

function startOutboxWorker({
  intervalMs = Number.parseInt(String(process.env.COURSE_INTEGRATION_WORKER_INTERVAL_MS || "5000"), 10) || 5000,
  reconcileIntervalMs = Number.parseInt(String(process.env.COURSE_INTEGRATION_RECONCILE_INTERVAL_MS || "300000"), 10) || 300000,
  paymentMaintenanceIntervalMs = Number.parseInt(String(process.env.VIDEO_PAYMENT_MAINTENANCE_INTERVAL_MS || "60000"), 10) || 60000,
} = {}) {
  if (workerTimer || !client.isConfigured()) return null;
  if (isIntegrationKillSwitchActive()) {
    workerLog.warn("outbox_worker_not_started_kill_switch", {});
    return null;
  }
  const safeInterval = Math.max(1000, intervalMs);

  const tick = async () => {
    if (workerRunning || isIntegrationKillSwitchActive()) return;
    workerRunning = true;
    try {
      if (!isMutationsRepairKillSwitchActive()) {
        await outbox.processAvailableOutboxJobs({
          workerId: `moly-worker-${process.pid}`,
          limit: 25,
          reconcileBefore: true,
          reconcileAfter: true,
        });
      }
      if (!isContentSyncKillSwitchActive()) {
        await catalogSync.processAvailableInboxJobs({
          workerId: `moly-catalog-${process.pid}`,
          limit: 50,
        }).catch((err) => {
          workerLog.warn("catalog_inbox_worker_deferred", {
            code: err?.code || "CATALOG_INBOX_ERROR",
            message: err?.message || "Catalog inbox processing deferred.",
          });
        });
        const catalogPullIntervalMs = Number.parseInt(
          String(process.env.COURSE_CATALOG_PULL_INTERVAL_MS || "0"),
          10,
        ) || 0;
        if (catalogPullIntervalMs > 0 && Date.now() - lastCatalogPullAtMs >= catalogPullIntervalMs) {
          lastCatalogPullAtMs = Date.now();
          await catalogSync.runCatalogBackfill({ limit: 100 }).catch((err) => {
            workerLog.warn("scheduled_catalog_pull_deferred", {
              code: err?.code || "CATALOG_PULL_ERROR",
              message: err?.message || "Scheduled catalog backfill deferred.",
            });
          });
        }
      }
      if (reconcileIntervalMs > 0 && Date.now() - lastReconcileAtMs >= reconcileIntervalMs) {
        lastReconcileAtMs = Date.now();
        const autoRepairRequested = String(process.env.COURSE_INTEGRATION_RECONCILE_AUTO_REPAIR || "false").toLowerCase() === "true";
        await reconciliation.runReconciliation({
          dryRun: !autoRepairRequested || isMutationsRepairKillSwitchActive(),
          triggerMode: "scheduled",
          dispatchRepairs: true,
        }).catch((err) => {
          workerLog.warn("scheduled_reconciliation_deferred", {
            code: err?.code || "RECON_ERROR",
            message: err?.message || "Scheduled reconciliation deferred.",
          });
        });
      }
      if (paymentMaintenanceIntervalMs > 0 && Date.now() - lastPaymentMaintenanceAtMs >= paymentMaintenanceIntervalMs) {
        lastPaymentMaintenanceAtMs = Date.now();
        await require("./videoPaymentRuntime").maintenance(25).catch((err) => {
          workerLog.warn("video_payment_maintenance_deferred", {
            code: err?.code || "PAYMENT_MAINTENANCE_ERROR",
            message: err?.message || "Video payment maintenance deferred.",
          });
        });
      }
    } catch (error) {
      workerLog.error("outbox_worker_tick_failed", {
        code: error?.code || "WORKER_ERROR",
        message: error?.message || "Unknown error",
      });
    } finally {
      workerRunning = false;
    }
  };

  workerTimer = setInterval(tick, safeInterval);
  if (typeof workerTimer.unref === "function") {
    workerTimer.unref();
  }
  return workerTimer;
}

function stopOutboxWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

function getWorkerStatus() {
  return {
    active: Boolean(workerTimer),
    running: Boolean(workerRunning),
    lastReconcileAt: lastReconcileAtMs ? new Date(lastReconcileAtMs).toISOString() : null,
    lastCatalogPullAt: lastCatalogPullAtMs ? new Date(lastCatalogPullAtMs).toISOString() : null,
  };
}

module.exports = {
  client,
  outbox,
  ownership,
  reconciliation,
  catalogSync,
  workspace,
  readRolloutPosture,
  getKillSwitchesSnapshot,
  getWorkerStatus,
  startOutboxWorker,
  stopOutboxWorker,
};
