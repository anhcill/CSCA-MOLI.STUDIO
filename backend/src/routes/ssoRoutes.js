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
const { createIntegrationLogger } = require("../utils/integrationLogger");
const ssoLog = createIntegrationLogger({ component: "moly-sso-route" });
const {
  SsoPolicyError,
  clearSsoBrowserCookie,
  setSsoBrowserCookie,
  shouldUseSecureSsoCookie,
} = require("../utils/ssoPathPolicy");

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
  ssoLog.error("sso_unexpected_error", { message: error?.message || "Unexpected error", code: error?.code });
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

  const txCookieName = service.MOLY_SSO_TX_COOKIE || "moly_sso_tx";
  const linkCookieName = service.MOLY_SSO_LINK_COOKIE || "moly_sso_link";

  function handleIncomingStart(req, res, { redirectBrowser = false } = {}) {
    return (async () => {
      try {
        const result = await service.startIncomingCourseSsoTransaction({
          targetPath: req.query?.target_path ?? req.body?.targetPath ?? req.body?.target_path ?? null,
          correlationId: req.get("X-Correlation-ID") || undefined,
        });
        const secure = shouldUseSecureSsoCookie(req);
        setSsoBrowserCookie(res, {
          name: result.cookieName || txCookieName,
          value: result.browserTxToken,
          maxAgeSeconds: result.ttlSeconds,
          path: "/api/sso",
          secure,
        });
        if (redirectBrowser && result.authorizeUrl) {
          return res.redirect(302, result.authorizeUrl);
        }
        return res.json({
          success: true,
          data: {
            authorizeUrl: result.authorizeUrl,
            targetPath: result.targetPath,
            expiresAt: result.expiresAt,
          },
        });
      } catch (error) {
        return sendSsoError(res, error);
      }
    })();
  }

  // Destination-initiated start (CSCA-Course -> Moly Studio)
  userRouter.get("/csca-course/start", publicSsoLimiter, (req, res) =>
    handleIncomingStart(req, res, { redirectBrowser: true }),
  );
  userRouter.post("/csca-course/start", publicSsoLimiter, (req, res) =>
    handleIncomingStart(req, res, { redirectBrowser: false }),
  );

  // Check source launch eligibility and return destination /sso/start URL (without minting a code)
  userRouter.post("/course/intent", publicSsoLimiter, authenticateUser, async (req, res) => {
    try {
      const result = await service.checkCourseLaunchIntent({
        userId: req.user.id,
        courseId: req.body?.courseId ?? req.body?.course_id ?? null,
        offeringId: req.body?.offeringId ?? req.body?.offering_id ?? null,
        targetPath: req.body?.targetPath ?? req.body?.target_path ?? null,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });
      return res.json({
        success: true,
        data: {
          destinationStartUrl: result.destinationStartUrl,
          targetPath: result.targetPath,
          offeringId: result.offeringId,
          courseId: result.courseId,
          scopeType: result.scopeType,
        },
      });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  // Authorize authenticated learner from Moly Studio -> CSCA-Course with PKCE challenge + state
  userRouter.post("/course/authorize", publicSsoLimiter, authenticateUser, async (req, res) => {
    try {
      const result = await service.authorizeCourseSsoRequest({
        userId: req.user.id,
        state: req.body?.state ?? "",
        codeChallenge: req.body?.codeChallenge ?? req.body?.code_challenge ?? "",
        codeChallengeMethod: req.body?.codeChallengeMethod ?? req.body?.code_challenge_method ?? "S256",
        courseId: req.body?.courseId ?? req.body?.course_id ?? null,
        offeringId: req.body?.offeringId ?? req.body?.offering_id ?? null,
        targetPath: req.body?.targetPath ?? req.body?.target_path ?? null,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });
      return res.json({
        success: true,
        data: {
          redirectUrl: result.redirectUrl,
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

  // Disabled legacy non-PKCE launch endpoint (fails closed)
  userRouter.post("/course/launch", publicSsoLimiter, authenticateUser, async (req, res) => {
    try {
      await service.issueCourseLaunch({
        userId: req.user.id,
        courseId: req.body?.courseId ?? req.body?.course_id ?? null,
        targetPath: req.body?.targetPath ?? req.body?.target_path ?? null,
        correlationId: req.get("X-Correlation-ID") || undefined,
      });
      return res.status(400).json({ success: false, code: "SSO_PKCE_REQUIRED", message: "PKCE required." });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  // Consume CSCA-Course -> Moly one-time SSO code (requires browser-bound tx cookie)
  userRouter.post("/consume", publicSsoLimiter, async (req, res) => {
    const secure = shouldUseSecureSsoCookie(req);
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

      clearSsoBrowserCookie(res, { name: txCookieName, path: "/api/sso", secure });

      if (result.status === "LINK_REQUIRED") {
        setSsoBrowserCookie(res, {
          name: result.linkCookieName || linkCookieName,
          value: result.linkBrowserTxToken,
          maxAgeSeconds: result.linkCookieTtlSeconds || 600,
          path: "/api/sso",
          secure,
        });
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

      clearSsoBrowserCookie(res, { name: linkCookieName, path: "/api/sso", secure });
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
      if ([
        "SSO_BROWSER_TX_ALREADY_USED",
        "SSO_BROWSER_TX_EXPIRED",
        "SSO_CODE_INVALID",
        "SSO_CODE_ALREADY_USED",
        "SSO_CODE_EXPIRED",
        "SSO_PKCE_MISMATCH",
      ].includes(error?.code)) {
        clearSsoBrowserCookie(res, { name: txCookieName, path: "/api/sso", secure });
      }
      return sendSsoError(res, error);
    }
  });

  // Check whether current browser holds an active pending Safe-Link session (for clean refresh)
  userRouter.get("/link/status", publicSsoLimiter, async (req, res) => {
    try {
      const data = await service.getMolySafeLinkStatus({ req });
      return res.json({ success: true, data });
    } catch (error) {
      return sendSsoError(res, error);
    }
  });

  // Confirm Safe Linking on Moly via password or active matching session (requires browser-bound link cookie)
  userRouter.post("/link/confirm", publicSsoLimiter, optionalAuth, async (req, res) => {
    const secure = shouldUseSecureSsoCookie(req);
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

      clearSsoBrowserCookie(res, { name: linkCookieName, path: "/api/sso", secure });
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
        codeVerifier: typeof req.body?.code_verifier === "string" ? req.body.code_verifier.trim() : "",
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
