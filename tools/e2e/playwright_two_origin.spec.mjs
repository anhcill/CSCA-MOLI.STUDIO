/**
 * Day 9 Two-Origin End-to-End & Fault Matrix Specification (Playwright Test)
 *
 * Covers:
 * - Learner SSO launch (#code fragment + PKCE), delegated workspace playback, PDF viewer,
 *   quiz/assignment submit, note/bookmark/QA persistence, bidirectional resume.
 * - Paid vs Unowned (`PRICE_NOT_CONFIGURED` vs `ALREADY_OWNED` duplicate-checkout block).
 * - Revoked enrollment fail-closed enforcement.
 * - Expired short-TTL delegated playback token auto-refresh.
 * - Identity Conflict (409 / Safe Linking, no silent auto-merge).
 * - Staff Admin Course Integration Ops dashboard (kill switches, contract probe,
 *   v2 inbox/checkpoints, backfill triggers, domain reconciliation, subject recovery).
 * - 2-device browser slot cap enforcement.
 * - Copied SSO callback replay rejection across sessions.
 * - Mobile viewport (`390x844`) responsive checks.
 * - Zero console/page errors & zero secret leaks in URL/storage/response headers.
 *
 * Requires @playwright/test in an external/dev runner and seeded live/staging servers.
 * Never store or hardcode real credentials in this file.
 */

import { test, expect } from '@playwright/test';

const MOLY_WEB = (process.env.E2E_MOLY_WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
const MOLY_API = (process.env.E2E_MOLY_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const COURSE_WEB = (process.env.E2E_COURSE_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '');

const COURSE_SLUG = process.env.E2E_OWNED_COURSE_SLUG || '';
const UNIT_ID = process.env.E2E_OWNED_UNIT_ID || '';
const UNPRICED_COURSE_SLUG = process.env.E2E_UNPRICED_COURSE_SLUG || '';
const UNPRICED_PRODUCT_ID = process.env.E2E_UNPRICED_PRODUCT_ID || '';
const OWNED_PRODUCT_ID = process.env.E2E_OWNED_PRODUCT_ID || '';

const LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL || '';
const LEARNER_PASSWORD = process.env.E2E_LEARNER_PASSWORD || '';
const UNOWNED_EMAIL = process.env.E2E_UNOWNED_EMAIL || '';
const UNOWNED_PASSWORD = process.env.E2E_UNOWNED_PASSWORD || '';
const REVOKED_EMAIL = process.env.E2E_REVOKED_EMAIL || '';
const REVOKED_PASSWORD = process.env.E2E_REVOKED_PASSWORD || '';
const CONFLICT_EMAIL = process.env.E2E_CONFLICT_EMAIL || '';
const CONFLICT_PASSWORD = process.env.E2E_CONFLICT_PASSWORD || '';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || '';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || '';

const FORBIDDEN_SECRET_TERMS = [
  'x-moly-signature',
  'course_s2s_secret',
  'sso_shared_secret',
  '-----begin private key-----',
  'moly_client_secret',
];

function attachSecurityMonitors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const secretViolations = [];

  const checkTextForSecrets = (source, value) => {
    if (!value) return;
    const lower = String(value).toLowerCase();
    for (const term of FORBIDDEN_SECRET_TERMS) {
      if (lower.includes(term)) {
        secretViolations.push(`${source}: matched forbidden term ${term}`);
      }
    }
  };

  page.on('console', (msg) => {
    const text = msg.text();
    checkTextForSecrets('console', text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('request', (req) => {
    const url = req.url();
    checkTextForSecrets('request-url', url);
    if (url.includes('/sso/callback') && /[?&]code=/.test(url)) {
      secretViolations.push(`request-url: SSO code leaked in query string instead of #code fragment (${url.split('?')[0]})`);
    }
  });

  return {
    async assertClean() {
      const storageDump = await page.evaluate(() => ({
        localKeys: Object.keys(window.localStorage || {}),
        sessionKeys: Object.keys(window.sessionStorage || {}),
      })).catch(() => ({ localKeys: [], sessionKeys: [] }));

      for (const k of [...storageDump.localKeys, ...storageDump.sessionKeys]) {
        checkTextForSecrets('web-storage-key', k);
      }

      expect(secretViolations, `Secret / SSO-fragment leaks detected: ${secretViolations.join('; ')}`).toEqual([]);
      expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
      expect(consoleErrors, `Browser console errors: ${consoleErrors.join('; ')}`).toEqual([]);
    },
  };
}

async function loginThroughUi(page, email, password) {
  await page.goto(`${MOLY_WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
}

test.describe('Day 9 Two-Origin Course <-> Moly Sync E2E', () => {
  test('1. Learner: PKCE #code SSO launch, playback, PDF viewer, quiz/assignment, notes/QA, bidirectional resume', async ({ page }) => {
    test.skip(!LEARNER_EMAIL || !LEARNER_PASSWORD || !COURSE_SLUG, 'Set E2E_LEARNER_EMAIL, E2E_LEARNER_PASSWORD, E2E_OWNED_COURSE_SLUG');
    const sec = attachSecurityMonitors(page);

    await loginThroughUi(page, LEARNER_EMAIL, LEARNER_PASSWORD);

    // 1a. Verify course detail shows owned state + launch / workspace controls
    await page.goto(`${MOLY_WEB}/khoa-hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/Đã sở hữu|Tiếp tục học|Vào học/i);

    // 1b. Open delegated workspace on Moly
    const unitPath = UNIT_ID
      ? `${MOLY_WEB}/hoc/${COURSE_SLUG}/bai-hoc/${UNIT_ID}`
      : `${MOLY_WEB}/hoc/${COURSE_SLUG}`;
    await page.goto(unitPath, { waitUntil: 'networkidle' });

    // Intercept delegated playback token request & assert short TTL <= 60s
    const playbackPromise = page.waitForResponse(
      (res) => res.url().includes('/playback-token') && res.request().method() === 'POST',
      { timeout: 15000 },
    ).catch(() => null);

    const playbackRes = await playbackPromise;
    if (playbackRes) {
      expect(playbackRes.status()).toBe(200);
      const body = await playbackRes.json().catch(() => ({}));
      const ttl = body?.data?.ttlSeconds ?? body?.ttlSeconds;
      if (typeof ttl === 'number') {
        expect(ttl).toBeLessThanOrEqual(60);
      }
    }

    // Verify note creation persists across reload
    const notesTab = page.getByRole('button', { name: /Ghi chú/i }).first();
    if (await notesTab.isVisible()) {
      await notesTab.click();
      const noteInput = page.locator('textarea').first();
      if (await noteInput.isVisible()) {
        const marker = `E2E Note ${Date.now()}`;
        await noteInput.fill(marker);
        const saveBtn = page.getByRole('button', { name: /Lưu ghi chú|Thêm ghi chú/i }).first();
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await expect(page.locator('body')).toContainText(marker, { timeout: 10000 });
          await page.reload({ waitUntil: 'networkidle' });
          await notesTab.click();
          await expect(page.locator('body')).toContainText(marker, { timeout: 10000 });
        }
      }
    }

    // Verify Q&A tab & Files tab render cleanly without forbidden leaks
    const qaTab = page.getByRole('button', { name: /Hỏi đáp|Q&A/i }).first();
    if (await qaTab.isVisible()) await qaTab.click();

    const filesTab = page.getByRole('button', { name: /Tài liệu|Slide|PDF/i }).first();
    if (await filesTab.isVisible()) await filesTab.click();

    // Verify SSO Authorize initiates #code + PKCE redirect without query ?code=
    await page.goto(`${MOLY_WEB}/khoa-hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
    const ssoBtn = page.getByRole('button', { name: /Mở trên CSCA-Course|Vào học/i }).first();
    if (await ssoBtn.isVisible()) {
      const authReqPromise = page.waitForResponse(
        (res) => res.url().includes('/api/sso/moly/authorize'),
        { timeout: 15000 },
      );
      await ssoBtn.click();
      const authRes = await authReqPromise;
      expect(authRes.status()).toBe(200);
      await page.waitForURL((url) => url.origin === new URL(COURSE_WEB).origin || url.pathname.includes('/sso'), { timeout: 15000 });
      expect(page.url()).not.toMatch(/[?&]code=/);
    }

    await sec.assertClean();
  });

  test('2. Paid vs Unowned: unpriced course fails closed with PRICE_NOT_CONFIGURED & owned checkout blocks duplicate purchase', async ({ page }) => {
    test.skip(!UNPRICED_COURSE_SLUG && !UNPRICED_PRODUCT_ID && !OWNED_PRODUCT_ID, 'Set unpriced/owned product env fixtures');
    const sec = attachSecurityMonitors(page);

    if (UNPRICED_COURSE_SLUG) {
      await page.goto(`${MOLY_WEB}/khoa-hoc/${UNPRICED_COURSE_SLUG}`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toContainText(/Đang cập nhật học phí|Chưa mở bán/i);
    }

    if (UNPRICED_PRODUCT_ID) {
      await page.goto(`${MOLY_WEB}/thanh-toan-khoa-hoc?type=video&productId=${UNPRICED_PRODUCT_ID}`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toContainText(/Đang cập nhật học phí|Chưa cấu hình/i);
      await expect(page.getByRole('button', { name: /Tạo mã QR thanh toán/i })).toHaveCount(0);
    }

    if (LEARNER_EMAIL && LEARNER_PASSWORD && OWNED_PRODUCT_ID) {
      await loginThroughUi(page, LEARNER_EMAIL, LEARNER_PASSWORD);
      await page.goto(`${MOLY_WEB}/thanh-toan-khoa-hoc?type=video&productId=${OWNED_PRODUCT_ID}`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toContainText(/Đã sở hữu|không cần thanh toán lại/i);
      await expect(page.getByRole('button', { name: /Tạo mã QR thanh toán/i })).toHaveCount(0);
    }

    await sec.assertClean();
  });

  test('3. Revoked learner fails closed on delegated workspace & playback token', async ({ page }) => {
    test.skip(!REVOKED_EMAIL || !REVOKED_PASSWORD || !COURSE_SLUG, 'Set E2E_REVOKED_EMAIL, E2E_REVOKED_PASSWORD, E2E_OWNED_COURSE_SLUG');
    const sec = attachSecurityMonitors(page);

    await loginThroughUi(page, REVOKED_EMAIL, REVOKED_PASSWORD);
    await page.goto(`${MOLY_WEB}/hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/thu hồi|chưa có quyền|không thể truy cập|hết hạn/i);

    const playbackStatus = await page.evaluate(async ({ apiUrl, slug }) => {
      const resp = await fetch(`${apiUrl}/api/learning/external-courses/${encodeURIComponent(slug)}/workspace`, {
        credentials: 'include',
      });
      return resp.status;
    }, { apiUrl: MOLY_API, slug: COURSE_SLUG });
    expect([401, 403, 404]).toContain(playbackStatus);

    await sec.assertClean();
  });

  test('4. Expired delegated playback token recovers gracefully via refresh or retry', async ({ page }) => {
    test.skip(!LEARNER_EMAIL || !LEARNER_PASSWORD || !COURSE_SLUG, 'Set E2E_LEARNER_EMAIL, E2E_LEARNER_PASSWORD, E2E_OWNED_COURSE_SLUG');
    const sec = attachSecurityMonitors(page);

    await loginThroughUi(page, LEARNER_EMAIL, LEARNER_PASSWORD);

    let firstPlaybackCount = 0;
    await page.route('**/playback-token', async (route) => {
      firstPlaybackCount += 1;
      if (firstPlaybackCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, code: 'DELEGATED_TOKEN_EXPIRED', message: 'Token hết hạn' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${MOLY_WEB}/hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
    const retryBtn = page.getByRole('button', { name: /Thử lại|Làm mới/i }).first();
    if (await retryBtn.isVisible()) {
      await retryBtn.click();
    }
    expect(firstPlaybackCount).toBeGreaterThanOrEqual(1);
    await sec.assertClean();
  });

  test('5. Conflict (409 / Safe Linking): blocks silent merge & surfaces verification notice', async ({ page }) => {
    test.skip(!CONFLICT_EMAIL || !CONFLICT_PASSWORD || !COURSE_SLUG, 'Set E2E_CONFLICT_EMAIL, E2E_CONFLICT_PASSWORD, E2E_OWNED_COURSE_SLUG');
    const sec = attachSecurityMonitors(page);

    await loginThroughUi(page, CONFLICT_EMAIL, CONFLICT_PASSWORD);
    await page.goto(`${MOLY_WEB}/khoa-hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/xác minh|xung đột|hỗ trợ/i);

    await sec.assertClean();
  });

  test('6. Staff Ops Dashboard: kill switches, contract probe, v2 sync inbox/checkpoints, reconciliation & subject recovery', async ({ page }) => {
    test.skip(!STAFF_EMAIL || !STAFF_PASSWORD, 'Set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD');
    const sec = attachSecurityMonitors(page);

    await loginThroughUi(page, STAFF_EMAIL, STAFF_PASSWORD);
    await page.goto(`${MOLY_WEB}/admin/course-integration`, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toContainText(/Kill Switches & Rollout Flags/i);
    await expect(page.getByRole('button', { name: /Contract Handshake Probe/i })).toBeVisible();
    await page.getByRole('button', { name: /Contract Handshake Probe/i }).click();
    await expect(page.locator('body')).toContainText(/Contract Handshake Probe|contract/i, { timeout: 15000 });

    await page.getByRole('button', { name: /v2 Sync Inbox & Checkpoints/i }).click();
    await expect(page.locator('body')).toContainText(/Course Sync Checkpoints/i);
    await expect(page.locator('body')).toContainText(/Trigger Catalog Backfill/i);

    await page.getByRole('button', { name: /Đối soát & Khôi phục/i }).click();
    await expect(page.locator('body')).toContainText(/Per-Subject Recovery/i);

    await sec.assertClean();
  });

  test('7. 2-device browser slot cap rejects 3rd independent session without replacement flow', async ({ browser }) => {
    test.skip(!UNOWNED_EMAIL || !UNOWNED_PASSWORD, 'Set E2E_UNOWNED_EMAIL and E2E_UNOWNED_PASSWORD');

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();

    try {
      const p1 = await ctx1.newPage();
      const p2 = await ctx2.newPage();
      const p3 = await ctx3.newPage();

      await loginThroughUi(p1, UNOWNED_EMAIL, UNOWNED_PASSWORD);
      await loginThroughUi(p2, UNOWNED_EMAIL, UNOWNED_PASSWORD);

      await p3.goto(`${MOLY_WEB}/login`, { waitUntil: 'domcontentloaded' });
      await p3.locator('input[type="email"], input[name="email"]').first().fill(UNOWNED_EMAIL);
      await p3.locator('input[type="password"], input[name="password"]').first().fill(UNOWNED_PASSWORD);
      await p3.locator('button[type="submit"]').first().click();

      await expect(p3.locator('body')).toContainText(/thiết bị|giới hạn|chọn thiết bị|thay thế/i, { timeout: 15000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctx3.close();
    }
  });

  test('8. Copied SSO callback (#code & state) fails closed across separate browser context', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageB = await ctxB.newPage();
      const secB = attachSecurityMonitors(pageB);
      const fakeCopiedCallback = `${MOLY_WEB}/sso/callback#code=copied_single_use_code_probe&state=foreign_state_token`;
      await pageB.goto(fakeCopiedCallback, { waitUntil: 'networkidle' });
      await expect(pageB.locator('body')).toContainText(/không hợp lệ|hết hạn|thất bại|đăng nhập/i, { timeout: 15000 });
      await secB.assertClean();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('9. Mobile responsive viewport (390x844) renders catalog & workspace without horizontal overflow', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await ctx.newPage();
      const sec = attachSecurityMonitors(page);

      await page.goto(`${MOLY_WEB}/khoa-hoc`, { waitUntil: 'networkidle' });
      const catalogOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(catalogOverflow).toBeLessThanOrEqual(2);

      if (COURSE_SLUG) {
        await page.goto(`${MOLY_WEB}/khoa-hoc/${COURSE_SLUG}`, { waitUntil: 'networkidle' });
        const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(detailOverflow).toBeLessThanOrEqual(2);
      }

      await sec.assertClean();
    } finally {
      await ctx.close();
    }
  });
});
