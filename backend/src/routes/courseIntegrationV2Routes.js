const express = require("express");
const { createCourseInboundAuth } = require("../middleware/courseInboundAuth");
const { isContentSyncKillSwitchActive, isIntegrationKillSwitchActive } = require("../utils/integrationLogger");

/**
 * Signed inbound v2 integration endpoints mounted under `/api/integrations/v2`
 * for real-time catalog & profile synchronization from CSCA-Course.
 */
function createCourseIntegrationV2Routes({
  catalogSync,
  inboundConfig = {},
  env = process.env,
} = {}) {
  const router = express.Router();
  const verifyInbound = createCourseInboundAuth({ config: inboundConfig, env });

  router.post("/events/ingest", verifyInbound, async (req, res) => {
    const corr = req.courseInbound?.correlationId || null;
    if (isContentSyncKillSwitchActive(env)) {
      const globalBlocked = isIntegrationKillSwitchActive(env);
      const code = globalBlocked ? "INTEGRATION_KILL_SWITCH_ACTIVE" : "SYNC_KILL_SWITCH_ACTIVE";
      return res.status(503).json({
        success: false,
        code,
        errorCode: code,
        message: "Course catalog sync ingestion is temporarily paused by kill switch.",
        ...(corr ? { correlation_id: corr } : {}),
      });
    }

    try {
      const processImmediately = req.body?.async !== true;
      const result = await catalogSync.ingestCatalogEvents(req.body, {
        processImmediately,
        correlationId: corr,
      });
      return res.status(202).json({
        success: true,
        ...(corr ? { correlation_id: corr } : {}),
        data: result,
      });
    } catch (error) {
      const status = Number(error?.status || error?.statusCode || 500);
      const code = String(error?.code || error?.errorCode || "CATALOG_INGEST_FAILED");
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        success: false,
        code,
        errorCode: code,
        message: error?.message || "Failed to ingest catalog event.",
        ...(error?.details ? { details: error.details } : {}),
        ...(corr ? { correlation_id: corr } : {}),
      });
    }
  });

  return router;
}

module.exports = { createCourseIntegrationV2Routes };
