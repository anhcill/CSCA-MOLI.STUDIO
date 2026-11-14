const express = require("express");
const rateLimit = require("express-rate-limit");
const { authenticate, optionalAuthenticate } = require("../middleware/authMiddleware");
const {
  completeLoginForUser,
  createDeviceLimitLockedPayload,
  createDeviceLimitPayload,
  isDeviceLimitError,
} = require("../controllers/authController");
const { createCourseInboundAuth } = require("../middleware/courseInboundAuth");
const courseIntegrationRuntime = require("../services/courseIntegrationRuntime");
const { createCourseSsoService } = require("../services/courseSsoService");
const { SsoPolicyError } = require("../utils/ssoPathPolicy");

function setNoLeakHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function sendSsoError(res, error) {
  setNoLeakHeaders(res);
  if (error?.code === "DEVICE_LIMIT_LOCKED") {
    return res.status(403).json(createDeviceLimitLockedPayload(Number(error.attempts || 4)));
  }
  if (isDeviceLimitError(error)) {
    return res.status(409).json(createDeviceLimitPayload(error));
  }
  if (error instanceof SsoPolicyError || (error?.status && error?.code)) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      errorCode: error.errorCode || error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error("[moly-sso] Unexpected error:", error?.message || error);
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Không thể xử lý đăng nhập SSO.",
  });
}

function createDefaultMolySessionIssuer() {
  return async ({ req, user }) => {
    const safeReq = req || {
      get: () => "",
      ip: "127.0.0.1",
      headers: {},
    };
    return completeLoginForUser(safeReq, user, "SSO CSCA-Course", "sso_login", null);
  };
}

function createMolySsoRouters({
  ssoService = null,
  verifyInbound = createCourseInboundAuth(),
  authenticateUser = authenticate,
  optionalAuth = optionalAuthenticate,
} = {}) {
  const service = ssoService || createCourseSsoService({
    courseClient: courseIntegrationRuntime.client,
    ownership: courseIntegrationRuntime.ownership,
    issueMolySession: createDefaultMolySessionIssuer(),
  });

  const publicSsoLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 40 : 400,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Quá nhiều yêu cầu SSO. Vui lòng thử lại sau.",
      });
    },
  });

  const userRouter = express.Router();
  userRouter.use((_req, res, next) => {
    setNoLeakHeaders(res);
    next();
  });

  // Launch authenticated learner from Moly Studio -> CSCA-Course
  userRouter.post("/course/launch", publicSsoLimiter, authenticateUser, async (req, res) => {
    try {
      const result = await service.issueCourseLaunch({
        userId: req.user.id,
        courseId: req.body?.courseId ?? req.body?.course_id ?? null,
        targetPath: req.body?.targetPath ?? req.body?.target_path ?? null,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });
      return res.json({
        success: true,
        data: {
          launchUrl: result.launchUrl,
          targetPath: result.targetPath,
          offeringId: result.offeringId,
          expiresAt: result.expiresAt,
          expiresInSeconds: result.expiresInSeconds,
        },
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  // Consume CSCA-Course -> Moly one-time SSO code
  userRouter.post("/consume", publicSsoLimiter, async (req, res) => {
    try {
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      const state = typeof req.body?.state === "string" ? req.body.state.trim() : "";
      const ipAddress = req.ip || null;
      const result = await service.consumeCourseSso({
        code,
        state,
        req,
        ipAddress,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });

      if (result.status === "LINK_REQUIRED") {
        return res.json({
          success: true,
          data: {
            status: "LINK_REQUIRED",
            linkToken: result.linkToken,
            email: result.email,
            hasPassword: result.hasPassword,
            targetPath: result.targetPath,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          status: "AUTHENTICATED",
          redirectPath: result.redirectPath,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  // Confirm Safe Linking on Moly via password or active matching session
  userRouter.post("/link/confirm", publicSsoLimiter, optionalAuth, async (req, res) => {
    try {
      const linkToken = typeof req.body?.linkToken === "string" ? req.body.linkToken.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : null;
      const result = await service.confirmMolySafeLink({
        linkToken,
        password,
        authenticatedUser: req.user || null,
        req,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });

      return res.json({
        success: true,
        data: {
          status: "AUTHENTICATED",
          redirectPath: result.redirectPath,
          user: result.user,
          token: result.token,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  const inboundRouter = express.Router();
  inboundRouter.use((_req, res, next) => {
    setNoLeakHeaders(res);
    next();
  });
  inboundRouter.use(verifyInbound);

  inboundRouter.post("/exchange", async (req, res) => {
    try {
      const data = await service.exchangeMolySsoCode({
        code: typeof req.body?.code === "string" ? req.body.code.trim() : "",
        nonce: typeof req.body?.nonce === "string" ? req.body.nonce.trim() : "",
        consumerSystem: typeof req.body?.consumer_system === "string" ? req.body.consumer_system.trim() : "csca-course",
        consumeIp: typeof req.body?.consume_ip === "string" ? req.body.consume_ip.trim() : null,
        correlationId: req.courseInbound?.correlationId || req.get("X-Correlation-ID") || null,
      });
      return res.json({
        success: true,
        correlation_id: data.correlation_id,
        data,
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  inboundRouter.post("/bind-identity", async (req, res) => {
    try {
      const data = await service.bindPeerIdentityFromCourse({
        externalUserId: req.body?.external_user_id,
        targetUserId: req.body?.target_user_id,
        correlationId: req.courseInbound?.correlationId || req.get("X-Correlation-ID") || null,
      });
      return res.json({
        success: true,
        correlation_id: req.courseInbound?.correlationId || null,
        data,
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  return {
    userRouter,
    inboundRouter,
  };
}

module.exports = {
  createMolySsoRouters,
};
