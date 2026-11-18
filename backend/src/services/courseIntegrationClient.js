const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");
const {
  createIntegrationLogger,
  isContentSyncKillSwitchActive,
  isDelegatedLearningKillSwitchActive,
  isIntegrationKillSwitchActive,
  isMutationsRepairKillSwitchActive,
  observeMetricLatency,
  recordMetric,
  resolveCorrelationId,
} = require("../utils/integrationLogger");

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60000;
const DEFAULT_STREAM_TIMEOUT_MS = 180000;
const MAX_STREAM_TIMEOUT_MS = 300000;
const DEFAULT_MAX_TRANSPORT_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 150;
const TRANSIENT_HTTP_STATUSES = new Set([429, 502, 503, 504]);

class CourseIntegrationClientError extends CourseApiError {
  constructor(
    status,
    code,
    message,
    { retryable = false, errorCode = code, details = undefined } = {},
  ) {
    super(status, code, message, details);
    this.name = "CourseIntegrationClientError";
    this.errorCode = errorCode || code;
    this.retryable = Boolean(retryable);
  }
}

/**
 * Computes the X-Signature HMAC-SHA256 header over exact UTF-8 raw body bytes
 * prefixed by `<timestamp>.`.
 */
function buildMolySignature({ timestamp, rawBody, secret }) {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    throw new Error("timestamp is required to compute Moly HMAC signature.");
  }
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("hmacSecret is required to compute Moly HMAC signature.");
  }
  const bodyBuf = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody ?? {}), "utf8");
  const prefixBuf = Buffer.from(`${timestamp}.`, "utf8");
  const digest = crypto
    .createHmac("sha256", secret)
    .update(Buffer.concat([prefixBuf, bodyBuf]))
    .digest("hex");
  return `sha256=${digest}`;
}

function buildMolyGetSignature({ timestamp, method = "GET", originalUrl = "/", secret }) {
  if (typeof timestamp !== "string" || !timestamp.trim()) {
    throw new Error("timestamp is required to compute Moly HMAC GET signature.");
  }
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("hmacSecret is required to compute Moly HMAC GET signature.");
  }
  const canonicalInput = `${String(method || "GET").toUpperCase()}\n${String(originalUrl || "/")}`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(`${timestamp}.${canonicalInput}`, "utf8"))
    .digest("hex");
  return `sha256=${digest}`;
}

function parsePositiveInt(raw, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const num = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(num) || num < min) return fallback;
  return Math.min(num, max);
}

function normalizeBaseUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return "";
  try {
    const parsed = new URL(rawUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${pathname}`;
  } catch {
    return "";
  }
}

function resolveClientConfig(config = {}, env = process.env) {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? env.COURSE_LMS_BASE_URL ?? "");
  const courseWebBaseUrl = normalizeBaseUrl(config.courseWebBaseUrl ?? env.COURSE_WEB_BASE_URL ?? "");
  const serviceToken = String(config.serviceToken ?? env.COURSE_LMS_SERVICE_TOKEN ?? "").trim();
  const integrationKey = String(config.integrationKey ?? env.COURSE_LMS_INTEGRATION_KEY ?? "").trim();
  const hmacSecret = String(config.hmacSecret ?? env.COURSE_LMS_HMAC_SECRET ?? "").trim();
  const timeoutMs = parsePositiveInt(
    config.timeoutMs ?? env.COURSE_LMS_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS },
  );
  const maxTransportAttempts = parsePositiveInt(
    config.maxTransportAttempts ?? env.COURSE_LMS_MAX_TRANSPORT_ATTEMPTS,
    DEFAULT_MAX_TRANSPORT_ATTEMPTS,
    { min: 1, max: 5 },
  );
  const retryBaseDelayMs = parsePositiveInt(
    config.retryBaseDelayMs ?? env.COURSE_LMS_RETRY_BASE_DELAY_MS,
    DEFAULT_RETRY_BASE_DELAY_MS,
    { min: 0, max: 10000 },
  );
  return {
    baseUrl,
    courseWebBaseUrl,
    serviceToken,
    integrationKey,
    hmacSecret,
    timeoutMs,
    maxTransportAttempts,
    retryBaseDelayMs,
  };
}

function defaultSleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function sanitizeSafeErrorMessage(status, remoteBody) {
  const candidate = typeof remoteBody?.message === "string" ? remoteBody.message.trim() : "";
  if (candidate) {
    // Strip accidental bearer/signature strings or overly long traces.
    return candidate.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 300);
  }
  return `CSCA-Course integration endpoint returned HTTP ${status}.`;
}

/**
 * Signed server-to-server HTTP client from Moly Studio to CSCA-Course `/api/integrations/v1`.
 * Never logs Authorization headers, HMAC secrets, or learner PII.
 */
function createCourseIntegrationClient({
  config = {},
  env = process.env,
  fetchImpl = global.fetch,
  now = () => Date.now(),
  sleep = defaultSleep,
  logger = console,
} = {}) {
  function getConfig() {
    return resolveClientConfig(config, env);
  }

  function isConfigured() {
    const cfg = getConfig();
    return Boolean(cfg.baseUrl && cfg.serviceToken && cfg.integrationKey && cfg.hmacSecret);
  }

  function assertConfigured() {
    const cfg = getConfig();
    if (!cfg.baseUrl || !cfg.serviceToken || !cfg.integrationKey || !cfg.hmacSecret) {
      throw new CourseIntegrationClientError(
        503,
        "COURSE_LMS_NOT_CONFIGURED",
        "CSCA-Course integration credentials are not configured.",
        { retryable: true },
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new CourseIntegrationClientError(
        503,
        "COURSE_LMS_FETCH_UNAVAILABLE",
        "HTTP fetch implementation is unavailable.",
        { retryable: true },
      );
    }
    return cfg;
  }

  function assertDomainKillSwitch(killSwitchDomain, integrationLog, routePath, reqCorr, method = "POST") {
    if (isIntegrationKillSwitchActive(env)) {
      recordMetric("moly.client.blocked_kill_switch");
      integrationLog.warn("client_blocked_kill_switch", { routePath, method, domain: "global" }, reqCorr);
      throw new CourseIntegrationClientError(
        503,
        "INTEGRATION_KILL_SWITCH_ACTIVE",
        "Course integration sync is disabled by emergency kill switch.",
        { retryable: true },
      );
    }
    if (killSwitchDomain === "content_sync" && isContentSyncKillSwitchActive(env)) {
      recordMetric("moly.client.blocked_kill_switch");
      integrationLog.warn("client_blocked_kill_switch", { routePath, method, domain: "content_sync" }, reqCorr);
      throw new CourseIntegrationClientError(
        503,
        "SYNC_KILL_SWITCH_ACTIVE",
        "Catalog sync pull is disabled by content sync kill switch.",
        { retryable: true },
      );
    }
    if (
      (killSwitchDomain === "delegated_learning" || killSwitchDomain === "delegated_mutation")
      && isDelegatedLearningKillSwitchActive(env)
    ) {
      recordMetric("moly.client.blocked_kill_switch");
      integrationLog.warn("client_blocked_kill_switch", { routePath, method, domain: "delegated_learning" }, reqCorr);
      throw new CourseIntegrationClientError(
        503,
        "DELEGATED_LEARNING_KILL_SWITCH_ACTIVE",
        "Delegated CSCA-Course learning is temporarily paused by kill switch.",
        { retryable: true },
      );
    }
    if (
      (killSwitchDomain === "mutations_repair" || killSwitchDomain === "delegated_mutation")
      && isMutationsRepairKillSwitchActive(env)
    ) {
      recordMetric("moly.client.blocked_kill_switch");
      integrationLog.warn("client_blocked_kill_switch", { routePath, method, domain: "mutations_repair" }, reqCorr);
      throw new CourseIntegrationClientError(
        503,
        "MUTATIONS_REPAIR_KILL_SWITCH_ACTIVE",
        "Integration write mutations and repairs are temporarily paused by kill switch.",
        { retryable: true },
      );
    }
  }

  async function postSigned(
    routePath,
    payload,
    {
      apiVersion = "v1",
      method = "POST",
      correlationId,
      idempotencyKey,
      requireIdempotencyKey = true,
      extraHeaders = {},
      maxTransportAttempts,
      timeoutMs,
      validateData,
      killSwitchDomain = null,
    } = {},
  ) {
    const normalizedMethod = String(method || "POST").toUpperCase();
    const effectivePayload =
      (normalizedMethod === "DELETE" || normalizedMethod === "PATCH")
      && (payload === undefined || payload === null)
        ? {}
        : payload;
    const integrationLog = logger && logger !== console && typeof logger.info === "function"
      ? logger
      : createIntegrationLogger({ component: "course-client", env });
    const reqCorr = resolveCorrelationId(correlationId ?? effectivePayload?.correlation_id);
    assertDomainKillSwitch(killSwitchDomain, integrationLog, routePath, reqCorr, normalizedMethod);
    const callStartMs = Date.now();
    const cfg = assertConfigured();
    if (!effectivePayload || typeof effectivePayload !== "object" || Array.isArray(effectivePayload)) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "Integration payload must be an object.");
    }
    const corr = String(correlationId ?? effectivePayload.correlation_id ?? "").trim();
    if (!corr || corr.length > 128) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "Valid correlation_id is required.");
    }
    const idem = idempotencyKey !== undefined ? idempotencyKey : effectivePayload.idempotency_key ?? null;
    const normalizedIdem = idem === null || idem === undefined || String(idem).trim() === ""
      ? null
      : String(idem).trim();
    if (requireIdempotencyKey && (!normalizedIdem || normalizedIdem.length > 180)) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "Valid idempotency_key is required.");
    }

    const attempts = parsePositiveInt(
      maxTransportAttempts ?? cfg.maxTransportAttempts,
      cfg.maxTransportAttempts,
      { min: 1, max: 5 },
    );
    const requestTimeoutMs = parsePositiveInt(timeoutMs ?? cfg.timeoutMs, cfg.timeoutMs, {
      min: MIN_TIMEOUT_MS,
      max: MAX_TIMEOUT_MS,
    });
    const resolvedVersion = String(apiVersion || "v1").replace(/^\/+|\/+$/g, "");
    const url = `${cfg.baseUrl}/api/integrations/${resolvedVersion}${routePath}`;
    // Serialize body once per logical command; compute fresh timestamp/signature per attempt.
    const rawBody = JSON.stringify(effectivePayload);

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = new Date(now()).toISOString();
      const signature = buildMolySignature({
        timestamp,
        rawBody,
        secret: cfg.hmacSecret,
      });

      const safeExtraHeaders = extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {};
      const headers = {
        ...safeExtraHeaders,
        Authorization: `Bearer ${cfg.serviceToken}`,
        "X-Integration-Key": cfg.integrationKey,
        "X-Event-Timestamp": timestamp,
        "X-Correlation-ID": corr,
        "X-Signature": signature,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (normalizedIdem) {
        headers["Idempotency-Key"] = normalizedIdem;
      }

      let response;
      try {
        response = await fetchImpl(url, {
          method: normalizedMethod,
          headers,
          body: rawBody,
          signal: AbortSignal.timeout(requestTimeoutMs),
          redirect: "error",
        });
      } catch (err) {
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || err?.code === "ETIMEDOUT";
        lastError = new CourseIntegrationClientError(
          isTimeout ? 504 : 503,
          isTimeout ? "COURSE_LMS_TIMEOUT" : "COURSE_LMS_NETWORK_ERROR",
          isTimeout
            ? "Timed out waiting for CSCA-Course integration response."
            : "Failed to reach CSCA-Course integration endpoint.",
          { retryable: true },
        );
        logger?.warn?.("[course-integration] Transport error", {
          routePath,
          correlationId: corr,
          attempt,
          attempts,
          code: lastError.code,
        });
        if (attempt < attempts) {
          await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
          continue;
        }
        throw lastError;
      }

      let parsedBody = null;
      try {
        parsedBody = await response.json();
      } catch {
        parsedBody = null;
      }

      if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        lastError = new CourseIntegrationClientError(
          502,
          "COURSE_LMS_INVALID_RESPONSE",
          `Invalid JSON response received from CSCA-Course (${response.status}).`,
          { retryable: response.status >= 500 || response.status === 429 },
        );
        if (lastError.retryable && attempt < attempts) {
          await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
          continue;
        }
        throw lastError;
      }

      if ((response.status === 200 || response.status === 201 || response.status === 202) && parsedBody.success === true) {
        if (typeof validateData === "function" && !validateData(parsedBody)) {
          throw new CourseIntegrationClientError(
            502,
            "COURSE_LMS_INVALID_RESPONSE",
            "CSCA-Course response payload failed structural validation.",
            { retryable: false },
          );
        }
        const durationMs = Date.now() - callStartMs;
        observeMetricLatency("moly.client.http_ms", durationMs);
        recordMetric("moly.client.http_ok");
        integrationLog.info("client_http_ok", {
          routePath,
          httpStatus: response.status,
          attempt,
          durationMs,
        }, reqCorr);
        return {
          httpStatus: response.status,
          payload: parsedBody,
          attemptCount: attempt,
          requestTimestamp: timestamp,
        };
      }

      const remoteCode = String(parsedBody.errorCode || parsedBody.code || `HTTP_${response.status}`);
      const safeMessage = sanitizeSafeErrorMessage(response.status, parsedBody);
      const retryable = TRANSIENT_HTTP_STATUSES.has(response.status) || response.status >= 500;
      lastError = new CourseIntegrationClientError(response.status, remoteCode, safeMessage, {
        retryable,
        errorCode: remoteCode,
        details: parsedBody.details && typeof parsedBody.details === "object"
          ? { errorCode: remoteCode, details: parsedBody.details }
          : { errorCode: remoteCode },
      });

      if (retryable && attempt < attempts) {
        integrationLog.warn("client_retryable_http_failure", {
          routePath,
          httpStatus: response.status,
          code: remoteCode,
          attempt,
        }, reqCorr);
        await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
        continue;
      }
      observeMetricLatency("moly.client.http_ms", Date.now() - callStartMs);
      recordMetric("moly.client.http_error");
      integrationLog.warn("client_http_error", {
        routePath,
        httpStatus: response.status,
        code: remoteCode,
        attempt,
        durationMs: Date.now() - callStartMs,
      }, reqCorr);
      throw lastError;
    }

    throw lastError || new CourseIntegrationClientError(502, "COURSE_LMS_REQUEST_FAILED", "Request failed.", { retryable: true });
  }

  async function getSigned(
    routePath,
    queryParams = {},
    {
      apiVersion = "v2",
      correlationId,
      maxTransportAttempts,
      timeoutMs,
      validateData,
      extraHeaders = {},
      killSwitchDomain = null,
    } = {},
  ) {
    const integrationLog = logger && logger !== console && typeof logger.info === "function"
      ? logger
      : createIntegrationLogger({ component: "course-client", env });
    const reqCorr = resolveCorrelationId(correlationId);
    assertDomainKillSwitch(killSwitchDomain, integrationLog, routePath, reqCorr, "GET");
    const callStartMs = Date.now();
    const cfg = assertConfigured();

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams || {})) {
      if (v !== undefined && v !== null && v !== "") {
        search.set(k, String(v));
      }
    }
    const qs = search.toString();
    const basePath = `/api/integrations/${apiVersion}${routePath}${qs ? `?${qs}` : ""}`;
    const parsedBase = new URL(cfg.baseUrl);
    const originalUrl = `${parsedBase.pathname.replace(/\/+$/, "")}${basePath}`;
    const url = `${parsedBase.origin}${originalUrl}`;

    const attempts = parsePositiveInt(
      maxTransportAttempts ?? cfg.maxTransportAttempts,
      cfg.maxTransportAttempts,
      { min: 1, max: 5 },
    );
    const requestTimeoutMs = parsePositiveInt(timeoutMs ?? cfg.timeoutMs, cfg.timeoutMs, {
      min: MIN_TIMEOUT_MS,
      max: MAX_TIMEOUT_MS,
    });

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = new Date(now()).toISOString();
      const signature = buildMolyGetSignature({
        timestamp,
        method: "GET",
        originalUrl,
        secret: cfg.hmacSecret,
      });

      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cfg.serviceToken}`,
            "X-Integration-Key": cfg.integrationKey,
            "X-Event-Timestamp": timestamp,
            "X-Correlation-ID": reqCorr,
            "X-Signature": signature,
            ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(requestTimeoutMs),
          redirect: "error",
        });
      } catch (err) {
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || err?.code === "ETIMEDOUT";
        lastError = new CourseIntegrationClientError(
          isTimeout ? 504 : 503,
          isTimeout ? "COURSE_LMS_TIMEOUT" : "COURSE_LMS_NETWORK_ERROR",
          isTimeout ? "Timed out fetching catalog from CSCA-Course." : "Failed to reach CSCA-Course catalog endpoint.",
          { retryable: true },
        );
        if (attempt < attempts) {
          await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
          continue;
        }
        throw lastError;
      }

      let parsedBody = null;
      try {
        parsedBody = await response.json();
      } catch {
        parsedBody = null;
      }

      if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        lastError = new CourseIntegrationClientError(
          502,
          "COURSE_LMS_INVALID_RESPONSE",
          `Invalid JSON response received from CSCA-Course (${response.status}).`,
          { retryable: response.status >= 500 || response.status === 429 },
        );
        if (lastError.retryable && attempt < attempts) {
          await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
          continue;
        }
        throw lastError;
      }

      if (response.status === 200 && parsedBody.success === true) {
        if (typeof validateData === "function" && !validateData(parsedBody)) {
          throw new CourseIntegrationClientError(
            502,
            "COURSE_LMS_INVALID_RESPONSE",
            "CSCA-Course catalog response payload failed structural validation.",
            { retryable: false },
          );
        }
        observeMetricLatency("moly.client.http_ms", Date.now() - callStartMs);
        recordMetric("moly.client.http_ok");
        return {
          httpStatus: response.status,
          payload: parsedBody,
          attemptCount: attempt,
          requestTimestamp: timestamp,
        };
      }

      const remoteCode = String(parsedBody.errorCode || parsedBody.code || `HTTP_${response.status}`);
      const retryable = TRANSIENT_HTTP_STATUSES.has(response.status) || response.status >= 500;
      lastError = new CourseIntegrationClientError(
        response.status,
        remoteCode,
        sanitizeSafeErrorMessage(response.status, parsedBody),
        {
          retryable,
          errorCode: remoteCode,
          details: parsedBody.details && typeof parsedBody.details === "object"
            ? { errorCode: remoteCode, details: parsedBody.details }
            : { errorCode: remoteCode },
        },
      );
      if (retryable && attempt < attempts) {
        await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
        continue;
      }
      throw lastError;
    }

    throw lastError || new CourseIntegrationClientError(502, "COURSE_LMS_REQUEST_FAILED", "Request failed.", { retryable: true });
  }

  function fetchCatalogCourses(
    {
      afterRevision = 0,
      afterId = 0,
      cursor = null,
      snapshotAnchorRevision = null,
      limit = 100,
      includeTombstoned = true,
      correlationId = null,
    } = {},
    opts = {},
  ) {
    return getSigned(
      "/catalog/courses",
      {
        afterRevision,
        afterId,
        cursor,
        snapshotAnchorRevision,
        limit,
        includeTombstoned,
      },
      {
        ...opts,
        apiVersion: "v2",
        killSwitchDomain: "content_sync",
        correlationId,
        validateData: (resBody) => Boolean(
          resBody.data
          && Array.isArray(resBody.data.courses)
          && resBody.data.pagination
          && typeof resBody.data.pagination === "object",
        ),
      },
    ).then((res) => res.payload.data);
  }

  function provisionUser(payload, opts = {}) {
    return postSigned("/users/provision", payload, {
      ...opts,
      killSwitchDomain: "mutations_repair",
      requireIdempotencyKey: true,
      validateData: (body) => Boolean(body.data && typeof body.data === "object" && !Array.isArray(body.data)),
    });
  }

  function grantEntitlement(payload, opts = {}) {
    return postSigned("/entitlements/grant", payload, {
      ...opts,
      killSwitchDomain: "mutations_repair",
      requireIdempotencyKey: true,
      validateData: (body) => Boolean(body.data && typeof body.data === "object" && !Array.isArray(body.data)),
    });
  }

  function revokeEntitlement(payload, opts = {}) {
    return postSigned("/entitlements/revoke", payload, {
      ...opts,
      killSwitchDomain: "mutations_repair",
      requireIdempotencyKey: true,
      validateData: (body) => Boolean(body.data && typeof body.data === "object" && !Array.isArray(body.data)),
    });
  }

  function queryOwnership({ correlationId, externalUserId, externalCourseIds = [] }, opts = {}) {
    const body = {
      correlation_id: correlationId,
      subject: {
        source_system: "moly",
        external_user_id: externalUserId,
      },
      external_course_ids: externalCourseIds,
    };
    return postSigned("/ownership/query", body, {
      ...opts,
      correlationId,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Boolean(resBody.data && Array.isArray(resBody.data.items)),
    });
  }

  function getEventStatuses({ correlationId, eventId = null, idempotencyKey = null }, opts = {}) {
    if (!eventId && !idempotencyKey) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "eventId or idempotencyKey is required.");
    }
    const body = {
      correlation_id: correlationId,
      ...(eventId ? { event_id: eventId } : {}),
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };
    return postSigned("/moly/events/status", body, {
      ...opts,
      correlationId,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Array.isArray(resBody.data),
    });
  }

  function exchangeSsoCode(
    {
      code,
      nonce,
      codeVerifier = null,
      consumerSystem = "moly",
      consumeIp = null,
      correlationId = null,
      deviceSlotProof = null,
    },
    opts = {},
  ) {
    if (!code || !nonce) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "code and nonce are required.");
    }
    const body = {
      code,
      nonce,
      code_verifier: codeVerifier,
      consumer_system: consumerSystem,
      consume_ip: consumeIp,
      correlation_id: correlationId,
    };
    const proofHeader = typeof deviceSlotProof === "string" && deviceSlotProof.trim()
      ? deviceSlotProof.trim()
      : deviceSlotProof && typeof deviceSlotProof === "object"
        ? Buffer.from(JSON.stringify(deviceSlotProof), "utf8").toString("base64url")
        : null;
    const extraHeaders = {
      ...(opts.extraHeaders && typeof opts.extraHeaders === "object" ? opts.extraHeaders : {}),
      ...(proofHeader ? { "X-Device-Slot-Proof": proofHeader } : {}),
    };
    return postSigned("/sso/exchange", body, {
      ...opts,
      extraHeaders,
      correlationId,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Boolean(resBody.data && typeof resBody.data === "object" && !Array.isArray(resBody.data)),
    }).then((res) => res.payload.data);
  }

  function bindSsoPeerIdentity({ externalUserId, targetUserId, email = null, learningPersona = false, nonce = null, correlationId = null }, opts = {}) {
    const body = {
      external_user_id: externalUserId,
      target_user_id: targetUserId,
      email,
      learning_persona: learningPersona === true,
      nonce,
      correlation_id: correlationId,
    };
    return postSigned("/sso/bind-identity", body, {
      ...opts,
      correlationId,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Boolean(resBody.data && typeof resBody.data === "object"),
    }).then((res) => res.payload.data);
  }

  function queryReconciliationSnapshot(
    {
      correlationId,
      externalUserId = null,
      externalCourseId = null,
      limit = 500,
    } = {},
    opts = {},
  ) {
    const startMs = Date.now();
    const corr = resolveCorrelationId(correlationId);
    const body = {
      correlation_id: corr,
      limit,
      ...(externalUserId ? { external_user_id: externalUserId } : {}),
      ...(externalCourseId ? { external_course_id: externalCourseId } : {}),
    };
    return postSigned("/moly/reconciliation/snapshot", body, {
      ...opts,
      correlationId: corr,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Boolean(resBody.data && Array.isArray(resBody.data.entitlements)),
    }).then((res) => {
      observeMetricLatency("moly.client.reconcile_snapshot_ms", Date.now() - startMs);
      recordMetric("moly.client.reconcile_snapshot_ok");
      return res;
    });
  }

  async function fetchCourseCurriculum({
    courseId,
    profileId = null,
    afterRevision,
    afterId,
    cursor = null,
    limit = 200,
    includeTombstoned = true,
    correlationId,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const cid = encodeURIComponent(String(courseId || "").trim());
    return getSigned(
      `/catalog/courses/${cid}/curriculum`,
      {
        profile_id: profileId ?? undefined,
        after_revision: afterRevision ?? undefined,
        after_id: afterId ?? undefined,
        cursor: cursor ?? undefined,
        limit,
        include_tombstoned: includeTombstoned ? "true" : "false",
      },
      {
        apiVersion: "v2",
        killSwitchDomain: "content_sync",
        correlationId,
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && Array.isArray(body.data.profiles)),
      },
    ).then((res) => res.payload.data);
  }

  async function mintDelegatedLearningSession({
    externalUserId,
    courseId = null,
    profileId,
    scopes = ["workspace:read", "video:play", "progress:write"],
    ttlSeconds = 300,
    actorRole = null,
    actorEmail = null,
    deviceSlotProof = null,
    clientIp = null,
    userAgent = "",
    metadata = {},
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const corr = resolveCorrelationId(correlationId);
    const effectiveIdemKey = idempotencyKey || `dls:${externalUserId}:${profileId}:${crypto.randomUUID()}`;
    const proofHeader = typeof deviceSlotProof === "string" && deviceSlotProof.trim()
      ? deviceSlotProof.trim()
      : deviceSlotProof && typeof deviceSlotProof === "object"
        ? Buffer.from(JSON.stringify(deviceSlotProof), "utf8").toString("base64url")
        : null;
    const extraHeaders = proofHeader ? { "X-Device-Slot-Proof": proofHeader } : {};
    return postSigned(
      "/learning/sessions",
      {
        externalUserId: String(externalUserId),
        courseId: courseId != null ? String(courseId) : null,
        profileId: String(profileId),
        scopes,
        ttlSeconds,
        ...(actorRole ? { actorRole: String(actorRole) } : {}),
        ...(actorEmail ? { actorEmail: String(actorEmail) } : {}),
        ...(clientIp ? { clientIp: String(clientIp) } : {}),
        ...(userAgent ? { userAgent: String(userAgent).slice(0, 1000) } : {}),
        metadata,
      },
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_learning",
        idempotencyKey: effectiveIdemKey,
        extraHeaders,
        correlationId: corr,
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && typeof body.data.sessionToken === "string"),
      },
    ).then((res) => res.payload.data);
  }

  async function fetchDelegatedWorkspace({
    sessionToken,
    profileId,
    unitId = null,
    correlationId,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    return getSigned(
      `/learning/offerings/${pid}/workspace`,
      { unitId: unitId ?? undefined },
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_learning",
        correlationId,
        maxTransportAttempts,
        timeoutMs,
        extraHeaders: { "X-Delegated-Session": String(sessionToken || "") },
        validateData: (body) => Boolean(body && body.success === true && body.data && Array.isArray(body.data.units)),
      },
    ).then((res) => res.payload.data);
  }

  async function fetchDelegatedUnit({
    sessionToken,
    profileId,
    unitId,
    correlationId,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return getSigned(
      `/learning/offerings/${pid}/units/${uid}`,
      {},
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_learning",
        correlationId,
        maxTransportAttempts,
        timeoutMs,
        extraHeaders: { "X-Delegated-Session": String(sessionToken || "") },
        validateData: (body) => Boolean(body && body.success === true && body.data && body.data.id),
      },
    ).then((res) => res.payload.data);
  }

  async function fetchPublicPreviewUnit({
    profileId,
    unitId = "default",
    correlationId,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "default").trim());
    return getSigned(
      `/learning/preview/offerings/${pid}/units/${uid}`,
      {},
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_learning",
        correlationId,
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && body.data.activeUnit),
      },
    ).then((res) => res.payload.data);
  }

  async function requestDelegatedPlaybackToken({
    sessionToken,
    videoId,
    unitId = null,
    profileId = null,
    ttlSeconds = 60,
    deviceSlotProof = null,
    clientIp = null,
    userAgent = "",
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const vid = encodeURIComponent(String(videoId || "").trim());
    const proofHeader = typeof deviceSlotProof === "string" && deviceSlotProof.trim()
      ? deviceSlotProof.trim()
      : deviceSlotProof && typeof deviceSlotProof === "object"
        ? Buffer.from(JSON.stringify(deviceSlotProof), "utf8").toString("base64url")
        : null;
    const extraHeaders = {
      "X-Delegated-Session": String(sessionToken || ""),
      ...(proofHeader ? { "X-Device-Slot-Proof": proofHeader } : {}),
    };
    // Playback minting is a POST on Course and therefore requires an
    // idempotency key. Generate it once per mint request so transport retries
    // reuse the same key while scheduled token refreshes receive a fresh key.
    const resolvedIdempotencyKey = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : `playback:${String(videoId || "video")}:${crypto.randomUUID()}`;
    return postSigned(
      `/learning/videos/${vid}/playback-token`,
      {
        ...(unitId != null ? { unitId: String(unitId) } : {}),
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        ttlSeconds,
        ...(clientIp ? { clientIp: String(clientIp) } : {}),
        ...(userAgent ? { userAgent: String(userAgent).slice(0, 1000) } : {}),
      },
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_learning",
        idempotencyKey: resolvedIdempotencyKey,
        requireIdempotencyKey: true,
        extraHeaders,
        correlationId: resolveCorrelationId(correlationId),
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && typeof body.data.embedUrl === "string"),
      },
    ).then((res) => res.payload.data);
  }

  async function sendDelegatedVideoProgress({
    sessionToken,
    videoId,
    unitId = null,
    profileId = null,
    currentTimeSeconds = 0,
    watchedDeltaSeconds = 0,
    durationSeconds = null,
    clientSequence = null,
    eventTimestamp = null,
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const vid = encodeURIComponent(String(videoId || "").trim());
    const resolvedIdempotencyKey = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : `progress:${String(videoId || "video")}:${crypto.randomUUID()}`;
    return postSigned(
      `/learning/videos/${vid}/progress`,
      {
        ...(unitId != null ? { unitId: String(unitId) } : {}),
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        currentTimeSeconds: Number(currentTimeSeconds || 0),
        watchedDeltaSeconds: Number(watchedDeltaSeconds || 0),
        ...(durationSeconds != null ? { durationSeconds: Number(durationSeconds) } : {}),
        ...(clientSequence != null ? { clientSequence: Number(clientSequence) } : {}),
        ...(eventTimestamp ? { eventTimestamp: String(eventTimestamp) } : {}),
      },
      {
        apiVersion: "v2",
        killSwitchDomain: "delegated_mutation",
        method: "PUT",
        idempotencyKey: resolvedIdempotencyKey,
        requireIdempotencyKey: true,
        extraHeaders: { "X-Delegated-Session": String(sessionToken || "") },
        correlationId: resolveCorrelationId(correlationId),
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && typeof body.data.completionPercent === "number"),
      },
    ).then((res) => res.payload.data);
  }

  function delegatedGet(routePath, {
    sessionToken,
    queryParams = {},
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
    validateData,
  } = {}) {
    return getSigned(routePath, queryParams, {
      apiVersion: "v2",
      killSwitchDomain: "delegated_learning",
      correlationId: resolveCorrelationId(correlationId),
      maxTransportAttempts,
      timeoutMs,
      extraHeaders: sessionToken ? { "X-Delegated-Session": String(sessionToken) } : {},
      validateData: validateData || ((body) => Boolean(body && body.success === true && body.data !== undefined)),
    }).then((res) => res.payload.data);
  }

  function delegatedMutate(routePath, payload, {
    sessionToken,
    method = "POST",
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
    validateData,
  } = {}) {
    const resolvedIdemKey = idempotencyKey && String(idempotencyKey).trim()
      ? String(idempotencyKey).trim()
      : crypto.randomUUID();
    return postSigned(routePath, payload, {
      apiVersion: "v2",
      killSwitchDomain: "delegated_mutation",
      method,
      idempotencyKey: resolvedIdemKey,
      requireIdempotencyKey: true,
      extraHeaders: { "X-Delegated-Session": String(sessionToken || "") },
      correlationId: resolveCorrelationId(correlationId),
      maxTransportAttempts,
      timeoutMs,
      validateData: validateData || ((body) => Boolean(body && body.success === true && body.data !== undefined)),
    }).then((res) => res.payload.data);
  }

  // Day 5: Signed delegated file streaming / metadata
  async function streamDelegatedFile({
    sessionToken = null,
    fileId,
    unitId = null,
    profileId = null,
    disposition = "inline",
    mode = "stream",
    rangeHeader = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const fid = encodeURIComponent(String(fileId || "").trim());
    const normalizedMode = String(mode || "stream").toLowerCase() === "metadata" ? "metadata" : "stream";
    const normalizedDisp = String(disposition || "inline").toLowerCase() === "attachment" ? "attachment" : "inline";
    const queryParams = {
      ...(unitId != null ? { unitId: String(unitId) } : {}),
      ...(profileId != null ? { profileId: String(profileId) } : {}),
      disposition: normalizedDisp,
      mode: normalizedMode,
    };

    if (normalizedMode === "metadata") {
      return delegatedGet(`/learning/files/${fid}/stream`, {
        sessionToken,
        queryParams,
        correlationId,
        maxTransportAttempts,
        timeoutMs,
      });
    }

    const integrationLog = logger && logger !== console && typeof logger.info === "function"
      ? logger
      : createIntegrationLogger({ component: "course-client", env });
    const reqCorr = resolveCorrelationId(correlationId);
    assertDomainKillSwitch("delegated_learning", integrationLog, `/learning/files/${fid}/stream`, reqCorr, "GET");
    const callStartMs = Date.now();
    const cfg = assertConfigured();

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
    }
    const qs = search.toString();
    const basePath = `/api/integrations/v2/learning/files/${fid}/stream${qs ? `?${qs}` : ""}`;
    const parsedBase = new URL(cfg.baseUrl);
    const originalUrl = `${parsedBase.pathname.replace(/\/+$/, "")}${basePath}`;
    const url = `${parsedBase.origin}${originalUrl}`;

    const attempts = parsePositiveInt(
      maxTransportAttempts ?? cfg.maxTransportAttempts,
      1,
      { min: 1, max: 5 },
    );
    const hasExplicitTimeout = timeoutMs !== undefined && timeoutMs !== null;
    const streamTimeoutMs = hasExplicitTimeout
      ? parsePositiveInt(timeoutMs, DEFAULT_STREAM_TIMEOUT_MS, {
          min: MIN_TIMEOUT_MS,
          max: MAX_STREAM_TIMEOUT_MS,
        })
      : Math.max(cfg.timeoutMs, DEFAULT_STREAM_TIMEOUT_MS);
    const headerTimeoutMs = hasExplicitTimeout
      ? streamTimeoutMs
      : Math.max(cfg.timeoutMs, 30000);

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = new Date(now()).toISOString();
      const signature = buildMolyGetSignature({
        timestamp,
        method: "GET",
        originalUrl,
        secret: cfg.hmacSecret,
      });

      const headers = {
        Authorization: `Bearer ${cfg.serviceToken}`,
        "X-Integration-Key": cfg.integrationKey,
        "X-Event-Timestamp": timestamp,
        "X-Correlation-ID": reqCorr,
        "X-Signature": signature,
        Accept: "*/*",
      };
      if (sessionToken) headers["X-Delegated-Session"] = String(sessionToken);
      if (rangeHeader) headers.Range = String(rangeHeader);

      const controller = new AbortController();
      let timerCleared = false;
      let timeoutHandle = setTimeout(() => controller.abort(), headerTimeoutMs);
      timeoutHandle.unref?.();
      const releaseTimer = () => {
        if (timerCleared) return;
        timerCleared = true;
        clearTimeout(timeoutHandle);
      };

      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers,
          signal: controller.signal,
          redirect: "error",
        });
      } catch (err) {
        releaseTimer();
        const isTimeout = controller.signal.aborted
          || err?.name === "TimeoutError"
          || err?.name === "AbortError"
          || err?.code === "ETIMEDOUT";
        lastError = new CourseIntegrationClientError(
          isTimeout ? 504 : 503,
          isTimeout ? "COURSE_LMS_TIMEOUT" : "COURSE_LMS_NETWORK_ERROR",
          isTimeout ? "Timed out streaming file from CSCA-Course." : "Failed to stream file from CSCA-Course.",
          { retryable: true },
        );
        if (attempt < attempts) {
          await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
          continue;
        }
        throw lastError;
      }

      if (response.status === 200 || response.status === 206) {
        const resHeaders = {};
        if (response.headers && typeof response.headers.forEach === "function") {
          response.headers.forEach((value, key) => {
            resHeaders[String(key).toLowerCase()] = value;
          });
        }
        const hasStreamBody = Boolean(
          response.body
          && (typeof response.body.getReader === "function" || typeof response.body.pipe === "function"),
        );
        if (hasStreamBody) {
          clearTimeout(timeoutHandle);
          timerCleared = false;
          timeoutHandle = setTimeout(() => controller.abort(), streamTimeoutMs);
          timeoutHandle.unref?.();
          observeMetricLatency("moly.client.http_ms", Date.now() - callStartMs);
          recordMetric("moly.client.http_ok");
          return {
            status: response.status,
            headers: resHeaders,
            bodyStream: response.body,
            bodyBufferOrStream: response.body,
            bodyBuffer: null,
            release: releaseTimer,
            abort: () => {
              releaseTimer();
              controller.abort();
            },
          };
        }

        clearTimeout(timeoutHandle);
        timerCleared = false;
        timeoutHandle = setTimeout(() => controller.abort(), streamTimeoutMs);
        timeoutHandle.unref?.();
        let bodyBuffer;
        try {
          const arrayBuf = await response.arrayBuffer();
          bodyBuffer = Buffer.from(arrayBuf);
        } catch (err) {
          releaseTimer();
          const isTimeout = controller.signal.aborted
            || err?.name === "TimeoutError"
            || err?.name === "AbortError"
            || err?.code === "ETIMEDOUT";
          throw new CourseIntegrationClientError(
            isTimeout ? 504 : 502,
            isTimeout ? "COURSE_LMS_TIMEOUT" : "COURSE_LMS_STREAM_FAILED",
            isTimeout ? "Timed out reading file stream from CSCA-Course." : "Failed reading file stream from CSCA-Course.",
            { retryable: true },
          );
        } finally {
          releaseTimer();
        }
        observeMetricLatency("moly.client.http_ms", Date.now() - callStartMs);
        recordMetric("moly.client.http_ok");
        return {
          status: response.status,
          headers: resHeaders,
          bodyStream: null,
          bodyBufferOrStream: bodyBuffer,
          bodyBuffer,
        };
      }

      releaseTimer();

      let parsedBody = null;
      try {
        parsedBody = await response.json();
      } catch {
        parsedBody = null;
      }
      if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        lastError = new CourseIntegrationClientError(
          502,
          "COURSE_LMS_INVALID_RESPONSE",
          `Invalid file stream error response from CSCA-Course (${response.status}).`,
          { retryable: response.status >= 500 || response.status === 429 },
        );
      } else {
        const remoteCode = String(parsedBody.errorCode || parsedBody.code || `HTTP_${response.status}`);
        const retryable = TRANSIENT_HTTP_STATUSES.has(response.status) || response.status >= 500;
        lastError = new CourseIntegrationClientError(
          response.status,
          remoteCode,
          sanitizeSafeErrorMessage(response.status, parsedBody),
          {
            retryable,
            errorCode: remoteCode,
            details: parsedBody.details && typeof parsedBody.details === "object"
              ? { errorCode: remoteCode, details: parsedBody.details }
              : { errorCode: remoteCode },
          },
        );
      }
      if (lastError.retryable && attempt < attempts) {
        await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
        continue;
      }
      throw lastError;
    }

    throw lastError || new CourseIntegrationClientError(502, "COURSE_LMS_REQUEST_FAILED", "File stream failed.", { retryable: true });
  }

  // Day 6: Quizzes & Assignments
  function fetchDelegatedQuiz({ sessionToken, profileId, unitId, quizId, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    const qid = encodeURIComponent(String(quizId || "").trim());
    return delegatedGet(`/learning/offerings/${pid}/units/${uid}/quizzes/${qid}`, {
      sessionToken,
      correlationId,
      maxTransportAttempts,
      timeoutMs,
    });
  }

  function startDelegatedQuizAttempt({ sessionToken, quizId, profileId = null, unitId = null, newAttempt = false, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const qid = encodeURIComponent(String(quizId || "").trim());
    return delegatedMutate(
      `/learning/quizzes/${qid}/attempts/start`,
      {
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        ...(unitId != null ? { unitId: String(unitId) } : {}),
        newAttempt: Boolean(newAttempt),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function saveDelegatedQuizAnswers({ sessionToken, attemptId, profileId = null, answers = undefined, questionId = undefined, answer = undefined, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const aid = encodeURIComponent(String(attemptId || "").trim());
    return delegatedMutate(
      `/learning/quizzes/attempts/${aid}/answers`,
      {
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        ...(answers !== undefined ? { answers } : {}),
        ...(questionId !== undefined ? { questionId } : {}),
        ...(answer !== undefined ? { answer } : {}),
      },
      { sessionToken, method: "PUT", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function submitDelegatedQuizAttempt({ sessionToken, attemptId, profileId = null, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const aid = encodeURIComponent(String(attemptId || "").trim());
    return delegatedMutate(
      `/learning/quizzes/attempts/${aid}/submit`,
      {
        ...(profileId != null ? { profileId: String(profileId) } : {}),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function fetchDelegatedAssignment({ sessionToken, profileId, unitId, assignmentId, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    const asid = encodeURIComponent(String(assignmentId || "").trim());
    return delegatedGet(`/learning/offerings/${pid}/units/${uid}/assignments/${asid}`, {
      sessionToken,
      correlationId,
      maxTransportAttempts,
      timeoutMs,
    });
  }

  function uploadDelegatedAssignmentAsset({
    sessionToken,
    assignmentId,
    profileId = null,
    unitId = null,
    assetKind = "file",
    originalFilename,
    mimeType,
    sizeBytes,
    contentBase64,
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const asid = encodeURIComponent(String(assignmentId || "").trim());
    return delegatedMutate(
      `/learning/assignments/${asid}/submission-assets`,
      {
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        ...(unitId != null ? { unitId: String(unitId) } : {}),
        assetKind: String(assetKind || "file"),
        originalFilename: String(originalFilename || "submission.bin"),
        mimeType: String(mimeType || "application/octet-stream"),
        sizeBytes: Math.max(0, Number(sizeBytes || 0)),
        contentBase64: String(contentBase64 || ""),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function submitDelegatedAssignment({
    sessionToken,
    assignmentId,
    profileId = null,
    unitId = null,
    contentText = undefined,
    fileAssetIds = undefined,
    audioAssetId = undefined,
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const asid = encodeURIComponent(String(assignmentId || "").trim());
    return delegatedMutate(
      `/learning/assignments/${asid}/submit`,
      {
        ...(profileId != null ? { profileId: String(profileId) } : {}),
        ...(unitId != null ? { unitId: String(unitId) } : {}),
        ...(contentText !== undefined ? { contentText } : {}),
        ...(fileAssetIds !== undefined ? { fileAssetIds } : {}),
        ...(audioAssetId !== undefined ? { audioAssetId } : {}),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  // Day 7: Notes, Bookmarks & Q&A
  function listDelegatedNotes({ sessionToken, profileId, unitId, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedGet(`/learning/offerings/${pid}/units/${uid}/notes`, {
      sessionToken,
      correlationId,
      maxTransportAttempts,
      timeoutMs,
    });
  }

  function createDelegatedNote({ sessionToken, profileId, unitId, timestampSeconds = 0, content, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/notes`,
      {
        timestampSeconds: Math.max(0, Math.round(Number(timestampSeconds || 0))),
        content: String(content || ""),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function updateDelegatedNote({ sessionToken, profileId, unitId, noteId, timestampSeconds = undefined, content = undefined, expectedRevision = undefined, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    const nid = encodeURIComponent(String(noteId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/notes/${nid}`,
      {
        ...(timestampSeconds !== undefined ? { timestampSeconds: Math.max(0, Math.round(Number(timestampSeconds || 0))) } : {}),
        ...(content !== undefined ? { content: String(content) } : {}),
        ...(expectedRevision !== undefined ? { expectedRevision: Number(expectedRevision) } : {}),
      },
      { sessionToken, method: "PUT", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function deleteDelegatedNote({ sessionToken, profileId, unitId, noteId, expectedRevision = undefined, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    const nid = encodeURIComponent(String(noteId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/notes/${nid}`,
      expectedRevision !== undefined ? { expectedRevision: Number(expectedRevision) } : {},
      { sessionToken, method: "DELETE", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function listDelegatedBookmarks({ sessionToken, profileId, unitId, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedGet(`/learning/offerings/${pid}/units/${uid}/bookmarks`, {
      sessionToken,
      correlationId,
      maxTransportAttempts,
      timeoutMs,
    });
  }

  function createDelegatedBookmark({ sessionToken, profileId, unitId, videoAssetId = null, timestampSeconds = 0, label = "", idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/bookmarks`,
      {
        ...(videoAssetId != null ? { videoAssetId: String(videoAssetId) } : {}),
        timestampSeconds: Math.max(0, Math.round(Number(timestampSeconds || 0))),
        label: String(label || ""),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function deleteDelegatedBookmark({ sessionToken, profileId, unitId, bookmarkId, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    const bid = encodeURIComponent(String(bookmarkId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/bookmarks/${bid}`,
      {},
      { sessionToken, method: "DELETE", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function listDelegatedQaThreads({ sessionToken, profileId, unitId, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedGet(`/learning/offerings/${pid}/units/${uid}/qa`, {
      sessionToken,
      correlationId,
      maxTransportAttempts,
      timeoutMs,
    });
  }

  function createDelegatedQaThread({ sessionToken, profileId, unitId, title, body, idempotencyKey = null, correlationId, maxTransportAttempts = 1, timeoutMs } = {}) {
    const pid = encodeURIComponent(String(profileId || "").trim());
    const uid = encodeURIComponent(String(unitId || "").trim());
    return delegatedMutate(
      `/learning/offerings/${pid}/units/${uid}/qa`,
      { title: String(title || ""), body: String(body || "") },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function replyDelegatedQaThread({
    sessionToken,
    profileId = null,
    unitId = null,
    threadId,
    body,
    expectedRevision = undefined,
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const tid = encodeURIComponent(String(threadId || "").trim());
    return delegatedMutate(
      `/learning/qa/threads/${tid}/replies`,
      {
        ...(profileId != null && String(profileId).trim() ? { profileId: String(profileId).trim() } : {}),
        ...(unitId != null && String(unitId).trim() ? { unitId: String(unitId).trim() } : {}),
        body: String(body || ""),
        ...(expectedRevision !== undefined && expectedRevision !== null ? { expectedRevision: Number(expectedRevision) } : {}),
      },
      { sessionToken, method: "POST", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  function updateDelegatedQaThreadStatus({
    sessionToken,
    profileId = null,
    unitId = null,
    threadId,
    status,
    isPinned = undefined,
    markRead = undefined,
    expectedRevision = undefined,
    idempotencyKey = null,
    correlationId,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    const tid = encodeURIComponent(String(threadId || "").trim());
    return delegatedMutate(
      `/learning/qa/threads/${tid}/status`,
      {
        ...(profileId != null && String(profileId).trim() ? { profileId: String(profileId).trim() } : {}),
        ...(unitId != null && String(unitId).trim() ? { unitId: String(unitId).trim() } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(isPinned !== undefined ? { isPinned: Boolean(isPinned) } : {}),
        ...(markRead !== undefined ? { markRead: Boolean(markRead) } : {}),
        ...(expectedRevision !== undefined && expectedRevision !== null ? { expectedRevision: Number(expectedRevision) } : {}),
      },
      { sessionToken, method: "PATCH", idempotencyKey, correlationId, maxTransportAttempts, timeoutMs },
    );
  }

  async function probeCourseContract({
    correlationId = null,
    maxTransportAttempts = 1,
    timeoutMs,
  } = {}) {
    return getSigned(
      "/health",
      {},
      {
        apiVersion: "v2",
        correlationId: resolveCorrelationId(correlationId),
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && typeof body === "object" && !Array.isArray(body)),
      },
    ).then((res) => ({
      httpStatus: res.httpStatus,
      ...(res.payload?.data && typeof res.payload.data === "object" ? res.payload.data : res.payload),
    }));
  }

  async function fetchContentReconciliationSnapshot({
    courseIds = [],
    profileIds = [],
    limit = 200,
    cursor = null,
    correlationId = null,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const cleanCourseIds = (courseIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    const cleanProfileIds = (profileIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    return getSigned(
      "/reconciliation/content-state",
      {
        courseIds: cleanCourseIds.length ? cleanCourseIds.join(",") : undefined,
        profileIds: cleanProfileIds.length ? cleanProfileIds.join(",") : undefined,
        limit,
        cursor: cursor ?? undefined,
      },
      {
        apiVersion: "v2",
        correlationId: resolveCorrelationId(correlationId),
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && typeof body.data === "object"),
      },
    ).then((res) => res.payload.data);
  }

  async function fetchLearningReconciliationSnapshot({
    userIds = [],
    externalUserIds = [],
    courseIds = [],
    profileIds = [],
    limit = 200,
    cursor = null,
    correlationId = null,
    maxTransportAttempts,
    timeoutMs,
  } = {}) {
    const cleanUserIds = (userIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    const cleanExtUserIds = (externalUserIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    const cleanCourseIds = (courseIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    const cleanProfileIds = (profileIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    return getSigned(
      "/reconciliation/learning-state",
      {
        userIds: cleanUserIds.length ? cleanUserIds.join(",") : undefined,
        externalUserIds: cleanExtUserIds.length ? cleanExtUserIds.join(",") : undefined,
        courseIds: cleanCourseIds.length ? cleanCourseIds.join(",") : undefined,
        profileIds: cleanProfileIds.length ? cleanProfileIds.join(",") : undefined,
        limit,
        cursor: cursor ?? undefined,
      },
      {
        apiVersion: "v2",
        correlationId: resolveCorrelationId(correlationId),
        maxTransportAttempts,
        timeoutMs,
        validateData: (body) => Boolean(body && body.success === true && body.data && typeof body.data === "object"),
      },
    ).then((res) => res.payload.data);
  }

  return {
    isConfigured,
    assertConfigured,
    getConfig,
    provisionUser,
    grantEntitlement,
    revokeEntitlement,
    queryOwnership,
    queryReconciliationSnapshot,
    probeCourseContract,
    fetchContentReconciliationSnapshot,
    fetchLearningReconciliationSnapshot,
    fetchCatalogCourses,
    fetchCourseCurriculum,
    mintDelegatedLearningSession,
    fetchDelegatedWorkspace,
    fetchDelegatedUnit,
    fetchPublicPreviewUnit,
    requestDelegatedPlaybackToken,
    sendDelegatedVideoProgress,
    streamDelegatedFile,
    fetchDelegatedQuiz,
    startDelegatedQuizAttempt,
    saveDelegatedQuizAnswers,
    submitDelegatedQuizAttempt,
    fetchDelegatedAssignment,
    uploadDelegatedAssignmentAsset,
    submitDelegatedAssignment,
    listDelegatedNotes,
    createDelegatedNote,
    updateDelegatedNote,
    deleteDelegatedNote,
    listDelegatedBookmarks,
    createDelegatedBookmark,
    deleteDelegatedBookmark,
    listDelegatedQaThreads,
    createDelegatedQaThread,
    replyDelegatedQaThread,
    updateDelegatedQaThreadStatus,
    getSigned,
    getEventStatuses,
    exchangeSsoCode,
    bindSsoPeerIdentity,
  };
}

module.exports = {
  CourseIntegrationClientError,
  buildMolySignature,
  buildMolyGetSignature,
  createCourseIntegrationClient,
};
