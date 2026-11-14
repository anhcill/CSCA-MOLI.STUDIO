const crypto = require("crypto");
const { CourseApiError } = require("../utils/courseResponses");

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60000;
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

  async function postSigned(
    routePath,
    payload,
    {
      correlationId,
      idempotencyKey,
      requireIdempotencyKey = true,
      maxTransportAttempts,
      timeoutMs,
      validateData,
    } = {},
  ) {
    const cfg = assertConfigured();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "Integration payload must be an object.");
    }
    const corr = String(correlationId ?? payload.correlation_id ?? "").trim();
    if (!corr || corr.length > 128) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "Valid correlation_id is required.");
    }
    const idem = idempotencyKey !== undefined ? idempotencyKey : payload.idempotency_key ?? null;
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
    const url = `${cfg.baseUrl}/api/integrations/v1${routePath}`;
    // Serialize body once per logical command; compute fresh timestamp/signature per attempt.
    const rawBody = JSON.stringify(payload);

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = new Date(now()).toISOString();
      const signature = buildMolySignature({
        timestamp,
        rawBody,
        secret: cfg.hmacSecret,
      });

      const headers = {
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
          method: "POST",
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

      if ((response.status === 200 || response.status === 202) && parsedBody.success === true) {
        if (typeof validateData === "function" && !validateData(parsedBody)) {
          throw new CourseIntegrationClientError(
            502,
            "COURSE_LMS_INVALID_RESPONSE",
            "CSCA-Course response payload failed structural validation.",
            { retryable: false },
          );
        }
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
        logger?.warn?.("[course-integration] Retryable HTTP failure", {
          routePath,
          correlationId: corr,
          httpStatus: response.status,
          code: remoteCode,
          attempt,
        });
        await sleep(cfg.retryBaseDelayMs * (2 ** (attempt - 1)));
        continue;
      }
      throw lastError;
    }

    throw lastError || new CourseIntegrationClientError(502, "COURSE_LMS_REQUEST_FAILED", "Request failed.", { retryable: true });
  }

  function provisionUser(payload, opts = {}) {
    return postSigned("/users/provision", payload, {
      ...opts,
      requireIdempotencyKey: true,
      validateData: (body) => Boolean(body.data && typeof body.data === "object" && !Array.isArray(body.data)),
    });
  }

  function grantEntitlement(payload, opts = {}) {
    return postSigned("/entitlements/grant", payload, {
      ...opts,
      requireIdempotencyKey: true,
      validateData: (body) => Boolean(body.data && typeof body.data === "object" && !Array.isArray(body.data)),
    });
  }

  function revokeEntitlement(payload, opts = {}) {
    return postSigned("/entitlements/revoke", payload, {
      ...opts,
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

  function exchangeSsoCode({ code, nonce, consumerSystem = "moly", consumeIp = null, correlationId = null }, opts = {}) {
    if (!code || !nonce) {
      throw new CourseIntegrationClientError(422, "VALIDATION_ERROR", "code and nonce are required.");
    }
    const body = {
      code,
      nonce,
      consumer_system: consumerSystem,
      consume_ip: consumeIp,
      correlation_id: correlationId,
    };
    return postSigned("/sso/exchange", body, {
      ...opts,
      correlationId,
      idempotencyKey: null,
      requireIdempotencyKey: false,
      validateData: (resBody) => Boolean(resBody.data && typeof resBody.data === "object" && !Array.isArray(resBody.data)),
    }).then((res) => res.payload.data);
  }

  function bindSsoPeerIdentity({ externalUserId, targetUserId, email = null, nonce = null, correlationId = null }, opts = {}) {
    const body = {
      external_user_id: externalUserId,
      target_user_id: targetUserId,
      email,
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

  return {
    isConfigured,
    assertConfigured,
    getConfig,
    provisionUser,
    grantEntitlement,
    revokeEntitlement,
    queryOwnership,
    getEventStatuses,
    exchangeSsoCode,
    bindSsoPeerIdentity,
  };
}

module.exports = {
  CourseIntegrationClientError,
  buildMolySignature,
  createCourseIntegrationClient,
};
