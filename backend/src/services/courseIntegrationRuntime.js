const db = require("../config/database");
const { createCourseIntegrationClient } = require("./courseIntegrationClient");
const { createCourseOutboxSyncService } = require("./courseOutboxSyncService");
const { createCourseOwnershipProjectionService } = require("./courseOwnershipProjectionService");

const client = createCourseIntegrationClient();
const outbox = createCourseOutboxSyncService({ db, client });
const ownership = createCourseOwnershipProjectionService({ db, client, outbox });

let workerTimer = null;
let workerRunning = false;

function startOutboxWorker({
  intervalMs = Number.parseInt(String(process.env.COURSE_INTEGRATION_WORKER_INTERVAL_MS || "5000"), 10) || 5000,
} = {}) {
  if (workerTimer || !client.isConfigured()) return null;
  const safeInterval = Math.max(1000, intervalMs);

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      await outbox.processAvailableOutboxJobs({
        workerId: `moly-worker-${process.pid}`,
        limit: 25,
        reconcileBefore: true,
        reconcileAfter: true,
      });
    } catch (error) {
      console.error("[course-outbox-worker] Tick failed:", error?.message || "Unknown error");
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

module.exports = {
  client,
  outbox,
  ownership,
  startOutboxWorker,
  stopOutboxWorker,
};
