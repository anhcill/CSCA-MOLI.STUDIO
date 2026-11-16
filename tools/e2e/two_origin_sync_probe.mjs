#!/usr/bin/env node
/**
 * Day 9 Two-Origin Sync, Security & SLA Probe (CSCA-Course <-> CSCA-MOLI.STUDIO)
 *
 * Zero-dependency Node ESM script.
 * Safe by design: never reads `.env` files automatically and never prints secrets.
 * Configure targets strictly via runtime environment variables.
 */

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const COURSE_BASE_URL = (process.env.COURSE_BASE_URL || process.env.COURSE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const MOLY_BASE_URL = (process.env.MOLY_BASE_URL || process.env.MOLY_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MOLY_FRONTEND_URL = (process.env.MOLY_FRONTEND_URL || '').replace(/\/+$/, '');
const MOLY_ADMIN_BEARER = (process.env.MOLY_ADMIN_BEARER || '').trim();
const MOLY_LEARNER_BEARER = (process.env.MOLY_LEARNER_BEARER || '').trim();
const PROBE_COURSE_SLUG = (process.env.PROBE_COURSE_SLUG || '').trim();
const UNTRUSTED_ORIGIN = (process.env.UNTRUSTED_ORIGIN || 'https://untrusted-origin.example.invalid').trim();

const SLA_SAMPLES = Math.min(30, Math.max(1, Number.parseInt(process.env.SLA_SAMPLES || '5', 10) || 5));
const SLA_CATALOG_P95_MS = Number.parseInt(process.env.SLA_CATALOG_P95_MS || '60000', 10) || 60000;
const SLA_WORKSPACE_P95_MS = Number.parseInt(process.env.SLA_WORKSPACE_P95_MS || '10000', 10) || 10000;
const TIMEOUT_MS = Number.parseInt(process.env.PROBE_TIMEOUT_MS || '12000', 10) || 12000;
const JSON_OUT = (process.env.JSON_OUT || '').trim();

const SECRET_PATTERNS = [
  /x-moly-signature/i,
  /course_s2s_secret/i,
  /jwt_secret/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\"(?:secret|signingSecret|hmacSecret|privateKey|webhookSecret|clientSecret|apiSecret)\"\s*:\s*\"[^\"]{6,}\"/i,
  /bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i,
];

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

function detectSecretLeak(text) {
  if (!text) return [];
  const findings = [];
  for (const re of SECRET_PATTERNS) {
    if (re.test(text)) findings.push(re.source);
  }
  return findings;
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      durationMs,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json,
      error: null,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      ok: false,
      status: 0,
      durationMs,
      headers: {},
      text: '',
      json: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function measureLatencySamples(name, fn, samples) {
  const durations = [];
  const statuses = [];
  let failures = 0;

  for (let i = 0; i < samples; i += 1) {
    const res = await fn();
    durations.push(res.durationMs);
    statuses.push(res.status);
    if (!res.ok) failures += 1;
  }

  return {
    name,
    samples,
    failures,
    statuses,
    minMs: durations.length ? Math.min(...durations) : null,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    maxMs: durations.length ? Math.max(...durations) : null,
  };
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    targets: {
      courseBaseUrl: COURSE_BASE_URL,
      molyBaseUrl: MOLY_BASE_URL,
      molyFrontendUrl: MOLY_FRONTEND_URL || null,
      probeCourseSlug: PROBE_COURSE_SLUG || null,
    },
    slaTargetsMs: {
      catalogP95MaxMs: SLA_CATALOG_P95_MS,
      workspaceP95MaxMs: SLA_WORKSPACE_P95_MS,
    },
    startupOrder: [],
    securityChecks: [],
    slaMeasurements: [],
    verdict: 'PASS',
  };

  let hardFailure = false;
  let connectivityFailure = false;

  // ── 1. Startup Order Check 1: CSCA-Course integration readiness & fail-closed S2S ─
  const courseHealthUrl = `${COURSE_BASE_URL}/api/health/integration`;
  const courseHealth = await timedFetch(courseHealthUrl, {
    headers: { Origin: UNTRUSTED_ORIGIN },
  });
  const courseLeaks = detectSecretLeak(courseHealth.text);
  const courseAcao = courseHealth.headers['access-control-allow-origin'] || null;
  const courseCorsSafe = courseAcao !== '*' && courseAcao !== UNTRUSTED_ORIGIN;

  if (courseHealth.status === 0) connectivityFailure = true;
  if (!courseHealth.ok || courseLeaks.length > 0) hardFailure = true;

  const courseS2sUnauthUrl = `${COURSE_BASE_URL}/api/integrations/v2/health`;
  const courseS2sUnauth = await timedFetch(courseS2sUnauthUrl);
  const courseS2sFailClosed = courseS2sUnauth.status === 401 || courseS2sUnauth.status === 403;
  if (courseS2sUnauth.status !== 0 && !courseS2sFailClosed) hardFailure = true;

  const courseHealthData = courseHealth.json?.data && typeof courseHealth.json.data === 'object'
    ? courseHealth.json.data
    : courseHealth.json;

  report.startupOrder.push({
    step: 1,
    name: 'CSCA-Course Integration Health',
    url: courseHealthUrl,
    status: courseHealth.status,
    ok: courseHealth.ok,
    durationMs: courseHealth.durationMs,
    error: courseHealth.error,
    payloadSummary: courseHealthData
      ? {
          ok: courseHealthData.ready ?? courseHealthData.ok ?? null,
          contractVersion: courseHealthData.contractVersion ?? courseHealthData.version ?? null,
          schemaVersion: courseHealthData.schemaVersion ?? null,
        }
      : null,
  });

  report.securityChecks.push({
    target: courseHealthUrl,
    zeroSecretLeak: courseLeaks.length === 0,
    leakMatchesCount: courseLeaks.length,
    corsFailClosedForUntrustedOrigin: courseCorsSafe,
    observedAllowOrigin: courseAcao,
    s2sV2HealthUnauthenticatedFailClosed: courseS2sFailClosed,
    s2sV2HealthStatus: courseS2sUnauth.status,
    xContentTypeOptions: courseHealth.headers['x-content-type-options'] || null,
  });

  // ── 2. Startup Order Check 2: Moly Integration Health ───────────────────────
  const molyHealthUrl = `${MOLY_BASE_URL}/health/integration`;
  const molyHealth = await timedFetch(molyHealthUrl, {
    headers: { Origin: UNTRUSTED_ORIGIN },
  });
  const molyLeaks = detectSecretLeak(molyHealth.text);
  const molyAcao = molyHealth.headers['access-control-allow-origin'] || null;
  const molyCorsSafe = molyAcao !== '*' && molyAcao !== UNTRUSTED_ORIGIN;

  if (molyHealth.status === 0) connectivityFailure = true;
  if (!molyHealth.ok || molyLeaks.length > 0) hardFailure = true;

  report.startupOrder.push({
    step: 2,
    name: 'Moly Integration Health',
    url: molyHealthUrl,
    status: molyHealth.status,
    ok: molyHealth.ok,
    durationMs: molyHealth.durationMs,
    error: molyHealth.error,
    payloadSummary: molyHealth.json
      ? {
          ok: molyHealth.json.ok ?? molyHealth.json.ready ?? null,
          status: molyHealth.json.status ?? null,
          killSwitchActive: molyHealth.json.killSwitchActive ?? null,
        }
      : null,
  });

  report.securityChecks.push({
    target: molyHealthUrl,
    zeroSecretLeak: molyLeaks.length === 0,
    leakMatchesCount: molyLeaks.length,
    corsFailClosedForUntrustedOrigin: molyCorsSafe,
    observedAllowOrigin: molyAcao,
    xContentTypeOptions: molyHealth.headers['x-content-type-options'] || null,
  });

  // ── 3. Unauthenticated Admin Endpoint Must Fail Closed (401/403) ────────────
  const unauthProbeUrl = `${MOLY_BASE_URL}/api/admin/course-integrations/ops/overview`;
  const unauthProbe = await timedFetch(unauthProbeUrl);
  const adminFailClosed = unauthProbe.status === 401 || unauthProbe.status === 403;
  if (unauthProbe.status !== 0 && !adminFailClosed) hardFailure = true;

  report.securityChecks.push({
    target: unauthProbeUrl,
    unauthenticatedFailClosed: adminFailClosed,
    status: unauthProbe.status,
  });

  // ── 4. Startup Order Check 3: Admin Contract Probe (if bearer supplied) ─────
  if (MOLY_ADMIN_BEARER) {
    const contractUrl = `${MOLY_BASE_URL}/api/admin/course-integrations/ops/contract-probe`;
    const contractRes = await timedFetch(contractUrl, {
      headers: { Authorization: `Bearer ${MOLY_ADMIN_BEARER}` },
    });
    const contractLeaks = detectSecretLeak(contractRes.text);
    if (!contractRes.ok || contractLeaks.length > 0) hardFailure = true;

    report.startupOrder.push({
      step: 3,
      name: 'Moly Admin Contract Handshake Probe',
      url: contractUrl,
      status: contractRes.status,
      ok: contractRes.ok,
      durationMs: contractRes.durationMs,
      zeroSecretLeak: contractLeaks.length === 0,
      error: contractRes.error,
    });
  } else {
    report.startupOrder.push({
      step: 3,
      name: 'Moly Admin Contract Handshake Probe',
      url: `${MOLY_BASE_URL}/api/admin/course-integrations/ops/contract-probe`,
      skipped: true,
      reason: 'Set MOLY_ADMIN_BEARER to verify authenticated S2S contract handshake & ops overview.',
    });
  }

  // ── 5. Live SLA Sampling (only meaningful when endpoints respond) ───────────
  if (!connectivityFailure) {
    const catalogProbe = await measureLatencySamples(
      'catalog_read_projection',
      () => timedFetch(`${MOLY_BASE_URL}/api/courses?limit=10`),
      SLA_SAMPLES,
    );
    catalogProbe.withinSla = catalogProbe.failures === 0 && (catalogProbe.p95Ms ?? Infinity) <= SLA_CATALOG_P95_MS;
    if (!catalogProbe.withinSla) hardFailure = true;
    report.slaMeasurements.push(catalogProbe);

    const workspaceEndpoint = PROBE_COURSE_SLUG && MOLY_LEARNER_BEARER
      ? {
          name: 'delegated_workspace_authenticated',
          url: `${MOLY_BASE_URL}/api/learning/external-courses/${encodeURIComponent(PROBE_COURSE_SLUG)}/workspace`,
          headers: { Authorization: `Bearer ${MOLY_LEARNER_BEARER}` },
        }
      : PROBE_COURSE_SLUG
        ? {
            name: 'course_detail_public_projection',
            url: `${MOLY_BASE_URL}/api/courses/${encodeURIComponent(PROBE_COURSE_SLUG)}`,
            headers: {},
          }
        : {
            name: 'health_roundtrip_baseline',
            url: courseHealthUrl,
            headers: {},
          };

    const workspaceProbe = await measureLatencySamples(
      workspaceEndpoint.name,
      () => timedFetch(workspaceEndpoint.url, { headers: workspaceEndpoint.headers }),
      SLA_SAMPLES,
    );
    workspaceProbe.withinSla = workspaceProbe.failures === 0 && (workspaceProbe.p95Ms ?? Infinity) <= SLA_WORKSPACE_P95_MS;
    if (!workspaceProbe.withinSla) hardFailure = true;
    report.slaMeasurements.push(workspaceProbe);

    if (MOLY_FRONTEND_URL) {
      const feProbe = await timedFetch(`${MOLY_FRONTEND_URL}/khoa-hoc`);
      report.slaMeasurements.push({
        name: 'moly_frontend_catalog_ssr',
        samples: 1,
        failures: feProbe.ok ? 0 : 1,
        statuses: [feProbe.status],
        p95Ms: feProbe.durationMs,
        withinSla: feProbe.ok && feProbe.durationMs <= SLA_WORKSPACE_P95_MS,
      });
    }
  }

  report.completedAt = new Date().toISOString();
  if (connectivityFailure) {
    report.verdict = 'UNREACHABLE';
  } else if (hardFailure) {
    report.verdict = 'FAIL';
  } else {
    report.verdict = 'PASS';
  }

  const output = JSON.stringify(report, null, 2);
  console.log(output);

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, output, 'utf8');
  }

  if (connectivityFailure) process.exit(2);
  if (hardFailure) process.exit(1);
}

main().catch((err) => {
  console.error('Probe crashed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
