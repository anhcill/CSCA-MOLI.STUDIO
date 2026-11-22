# Moly Studio ↔ CSCA-Course Full Sync v2 — Day 8–10 Runbook, Rollout & Go/No-Go Checklist

> **Security notice**: This document intentionally contains **environment variable names and safe default values only**. Never commit `.env` files, real tokens, HMAC secrets, passwords, JWT keys, `linkToken`, PKCE `codeVerifier`, or payment webhook payloads to git or logs.

Cross-reference: See [MOLY_COURSE_DAY5_RUNBOOK_AND_ROLLOUT.md](./MOLY_COURSE_DAY5_RUNBOOK_AND_ROLLOUT.md) for the Day 1–5 foundation runbook and [MOLY_COURSE_FULL_SYNC_GEMINI_CODEX_PLAN.md](./MOLY_COURSE_FULL_SYNC_GEMINI_CODEX_PLAN.md) for the architecture specification.

---

## 1. Migration Order, Verification & Rollback Policy

### 1.1 Exact Cross-Repo Migration & Startup Order

Run database migrations and health checks strictly in this order so schema & v2 contracts are ready before consumers start pulling or issuing delegated learning tokens:

1. **Pre-migration Backup Snapshots** (both databases):
   - Snapshot `CSCA-Course` PostgreSQL (`pg_dump --format=custom --no-owner --file=course_pre_cutover.dump "$DATABASE_URL"`).
   - Snapshot `CSCA-MOLI.STUDIO` PostgreSQL (`pg_dump --format=custom --no-owner --file=moly_pre_cutover.dump "$COURSE_INTEGRATION_DATABASE_URL"`).
2. **CSCA-Course Additive Migrations (`079` → `084`)**:
   - Directory: `CSCA-Course/WebsiteReactVCK-master/database/migrations/`
   - Sequence:
     - `079_moly_course_integration_foundation.sql`
     - `080_moly_external_access_bridge.sql`
     - `081_moly_course_sso.sql`
     - `082_moly_sso_browser_transactions.sql`
     - `083_course_moly_full_sync_foundation.sql`
     - `084_course_moly_sync_day5_7.sql`
   - Runner (`WebsiteReactVCK-master`): `npm run migrate` (`node ./run_sql.js`).
3. **CSCA-Course Health & v2 Contract Verification**:
   - Start `CSCA-Course` web & worker with rollout toggles `false`.
   - Verify `GET ${COURSE_BASE_URL}/api/integrations/v2/health` returns HTTP `200` (`ok: true` / `ready: true`) with zero secret leaks and fail-closed CORS.
4. **CSCA-MOLI.STUDIO Additive Migrations (`076` → `082`)**:
   - Directory: `CSCA-MOLI.STUDIO/database/migrations/`
   - Sequence:
     - `076_moly_course_integration_foundation.sql`
     - `077_moly_payment_outbox_sync.sql`
     - `078_moly_course_sso.sql`
     - `079_moly_sso_browser_transactions.sql`
     - `080_moly_integration_day5_ops.sql`
     - `081_moly_course_full_sync_foundation.sql`
     - `082_moly_course_sync_day5_7.sql`
   - Preflight check: `node backend/scripts/apply_course_integration_migration.js --check`
   - Apply: `node backend/scripts/apply_course_integration_migration.js --apply`
5. **Moly Integration Health & Admin Contract Handshake Probe**:
   - Verify `GET ${MOLY_BASE_URL}/health/integration` returns HTTP `200`.
   - From Moly Admin (`/admin/course-integration`) click **Contract Handshake Probe** (or call `GET /api/admin/course-integrations/ops/contract-probe`) and confirm Course ↔ Moly handshake readiness before enabling workers or commerce sales.

### 1.2 Rerun & Idempotency Verification

- All SQL migrations (`079`–`084` on CSCA-Course, `076`–`082` on Moly) are designed to be additive (`IF NOT EXISTS` / idempotent schema updates).
- Re-running `node backend/scripts/apply_course_integration_migration.js --check` must report zero unapplied pending files before starting production traffic.

### 1.3 Safe Rollback, Snapshot Restore & DLQ Replay

- **Production Policy — Forward-Fix Only**:
  - **Do NOT** run destructive `DROP TABLE` / `DROP COLUMN` in live production once traffic starts (`integration_outbox`, `integration_inbox`, `course_catalog_sync_inbox`, `course_sync_checkpoints`, `integration_reconciliation_runs`, and `video_orders` hold live financial and learning state).
- **Immediate Traffic Freeze (Fail-Closed Rollback)**:
  1. Engage split or global kill switches immediately (Section 2).
  2. Reset frontend/backend rollout feature flags to `false` (`CSCA_VIDEO_COMMERCE_SALES_ENABLED=false`, `COURSE_INTEGRATION_WORKER_ENABLED=false`, `COURSE_CATALOG_SYNC_WORKER_ENABLED=false`, `NEXT_PUBLIC_DELEGATED_LEARNING_ENABLED=false`, `NEXT_PUBLIC_COURSE_SYNC_ENABLED=false`).
  3. Roll back application deployment to the previous known-good release SHA.
- **Database Snapshot Restore (Pre-Traffic Cutover Abort / Isolated Staging Reset Only)**:
  - If an error occurs during an off-traffic maintenance window before serving live orders, restore from the pre-cutover `pg_dump` archives (`pg_restore --clean --if-exists --no-owner -d "$TARGET_DB" pre_cutover.dump`). Never restore a stale snapshot over live production payments.
- **DLQ & Failed Inbox Replay After Fix**:
  1. Inspect root cause in `/admin/course-integration`:
     - Outbox errors (`outboxCounts`, `dead_letter`) -> tab **Hàng đợi Outbox** -> fix missing mapping (`COURSE_MAPPING_MISSING`) or identity conflict (`IDENTITY_*`) -> click **Thử lại** (`POST /api/admin/course-integrations/outbox/:id/retry`).
     - Catalog/content v2 inbox errors (`v2InboxCounts`, `v2InboxAttentionItems`) -> tab **v2 Sync Inbox & Checkpoints** -> click **Retry** (`POST /api/admin/course-integrations/catalog/inbox/:id/retry`) or run **Catalog Backfill** / **Curriculum Backfill**.
     - Specific learner/course drift -> tab **Đối soát & Khôi phục** -> **Per-Subject Recovery** (`POST /api/admin/course-integrations/ops/retry-subject`) with **Dry-Run Subject** first, then **Retry / Repair Subject**.

---

## 2. Split Kill Switches Operational Matrix

Moly Admin Ops (`GET /api/admin/course-integrations/ops/overview`) exposes `killSwitches` + `rolloutFlags` (`fail-closed` posture):

| Switch Domain | Overview Flag | Scope Blocked When Engaged | Local Core Impact When Engaged | Recovery Step After Clear |
|---|---|---|---|---|
| **Global** | `globalKillSwitchActive` | Halts ALL Course ↔ Moly sync: workers, S2S outbox/inbox dispatch, catalog pull, delegated learning proxy calls, and write repairs (`503`). | Local Moly orders/auth and local CSCA-Course sessions stay isolated (`integration_outbox` retains queued jobs). | Verify both health endpoints -> set switch `false` -> flush outbox + run Reconciliation `dryRun: true`. |
| **Content Sync** | `contentSyncKillSwitchActive` | Pauses catalog/curriculum incremental pull, `catalog/backfill`, curriculum backfill, and v2 sync inbox processing/retries. | Already-synced catalog & course metadata remain readable in Moly DB. | Run `POST /catalog/inbox/:id/retry` or `POST /catalog/backfill` (`full: false` or `true`) after CSCA-Course stabilizes. |
| **Delegated Learning** | `delegatedLearningKillSwitchActive` | Blocks delegated playback token issuance, file stream proxy, delegated quiz/assignment submit, and delegated notes/QA writes (`503`). | Learner SSO launch to CSCA-Course direct origin remains independently controllable via SSO switches; no stale playback token lingers (`<= 60s` TTL). | Verify CSCA-Course `/api/integrations/v2/health` & contract probe -> set switch `false` -> test 1 pilot learner unit. |
| **Mutations / Repair** | `mutationsRepairKillSwitchActive` | Blocks mutating reconciliation repairs (`reconcile` with `dryRun: false`), `syncOutbox`, and mutating `retry-subject` repairs (`dryRun: true` diagnostics remain safe). | Read-only diagnostics (`ops/overview`, `reconcile` `dryRun: true`, `ops/contract-probe`) stay available for incident triage. | Inspect drift summary -> run `dryRun: true` -> re-enable repair -> repair single test subject before bulk run. |

---

## 3. Environment Variable Reference (Aligned Across `.env.example` Files)

> **Rule**: Never put backend S2S secrets, HMAC secrets, or service tokens into `NEXT_PUBLIC_*` or `VITE_*` variables.

### 3.1 `CSCA-MOLI.STUDIO/backend/.env.example`

| Variable | Safe Default | Purpose |
|---|---|---|
| `CSCA_VIDEO_COMMERCE_ENABLED` | `false` | Enables `/api/video-commerce` commerce module |
| `CSCA_VIDEO_COMMERCE_SALES_ENABLED` | `false` | Gates new checkout/order creation independently |
| `CSCA_BUNNY_STREAM_ENABLED` | `false` | Gates Bunny Stream playback/webhook features |
| `BUNNY_STREAM_LIBRARY_ID` | *(empty)* | Server-only Bunny library ID |
| `BUNNY_STREAM_API_KEY` | *(secret, empty)* | Server-only Bunny library API key |
| `BUNNY_STREAM_TOKEN_KEY` | *(secret, empty)* | Server-only Bunny URL signing token key |
| `BUNNY_STREAM_WEBHOOK_SIGNING_KEY` | *(secret, empty)* | Server-only Bunny webhook verification key |
| `COURSE_LMS_BASE_URL` | *(empty)* | CSCA-Course backend base URL (HTTPS in staging/prod) |
| `COURSE_LMS_SERVICE_TOKEN` | *(secret, empty)* | Outbound S2S service bearer token (distinct from `JWT_SECRET`) |
| `COURSE_LMS_INTEGRATION_KEY` | *(empty)* | Integration partner key (`MOLY_INTEGRATION_KEY` on Course) |
| `COURSE_LMS_HMAC_SECRET` | *(secret, empty)* | Outbound HMAC-SHA256 secret (`MOLY_INTEGRATION_HMAC_SECRET` on Course) |
| `COURSE_LMS_REQUEST_TIMEOUT_MS` | `10000` | HTTP client timeout ms |
| `COURSE_INTEGRATION_WORKER_ENABLED` | `false` | Background outbox & reconciliation worker gate |
| `COURSE_INTEGRATION_WORKER_INTERVAL_MS` | `5000` | Outbox poll interval ms |
| `COURSE_INTEGRATION_SYNC_DISABLED` | `false` | Global S2S integration kill switch (`true` = locked) |
| `COURSE_CATALOG_SYNC_DISABLED` | `false` | Content sync kill switch (`true` = locked) |
| `COURSE_CATALOG_PULL_DISABLED` | `false` | Scheduled catalog pull toggle (`true` = disabled) |
| `COURSE_CATALOG_PULL_INTERVAL_MS` | `0` | Scheduled catalog pull interval ms (`0` = disabled) |
| `COURSE_WEB_BASE_URL` | *(empty)* | CSCA-Course web origin for PKCE SSO launch redirects |
| `COURSE_SSO_TTL_SECONDS` | `90` | One-time SSO ticket TTL seconds |
| `COURSE_INBOUND_SERVICE_TOKEN` | *(secret, empty)* | Inbound S2S bearer verification token |
| `COURSE_INBOUND_INTEGRATION_KEY` | *(empty)* | Inbound integration key (`MOLY_OUTBOUND_INTEGRATION_KEY` on Course) |
| `COURSE_INBOUND_HMAC_SECRET` | *(secret, empty)* | Inbound HMAC-SHA256 verification secret |
| `COURSE_INBOUND_MAX_AGE_SECONDS` | `300` | Replay timestamp skew window seconds |

### 3.2 `CSCA-MOLI.STUDIO/frontend/.env.example`

| Variable | Safe Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://moly-studio.io.vn` | Canonical site origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Moly backend API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:5000` | Moly Socket.io base URL |
| `NEXT_PUBLIC_BUNNY_STREAM_ENABLED` | `false` | Gates Bunny upload UI toggle (`VideoUploadPanel`) |
| `NEXT_PUBLIC_DELEGATED_LEARNING_ENABLED` | `false` | Day 10 fail-closed frontend rollout posture flag |
| `NEXT_PUBLIC_COURSE_SYNC_ENABLED` | `false` | Day 10 fail-closed frontend rollout posture flag |

### 3.3 `CSCA-Course/WebsiteReactVCK-master/backend/.env.example`

| Variable | Safe Default | Purpose |
|---|---|---|
| `MOLY_API_BASE_URL` | *(empty)* | Moly Studio backend URL for SSO exchange & identity checks |
| `MOLY_WEB_BASE_URL` | *(empty)* | Moly Studio frontend URL for SSO redirect validation |
| `MOLY_OUTBOUND_SERVICE_TOKEN` | *(secret, empty)* | Outbound bearer matching Moly `COURSE_INBOUND_SERVICE_TOKEN` |
| `MOLY_OUTBOUND_INTEGRATION_KEY` | *(empty)* | Key matching Moly `COURSE_INBOUND_INTEGRATION_KEY` |
| `MOLY_OUTBOUND_HMAC_SECRET` | *(secret, empty)* | HMAC secret matching Moly `COURSE_INBOUND_HMAC_SECRET` |
| `MOLY_OUTBOUND_REQUEST_TIMEOUT_MS` | `10000` | Outbound S2S timeout ms |
| `MOLY_OUTBOUND_MAX_TRANSPORT_ATTEMPTS` | `2` | Bounded transport retry attempts |
| `MOLY_SSO_TTL_SECONDS` | `90` | One-time SSO ticket TTL seconds |
| `MOLY_INTEGRATION_SYNC_DISABLED` | `false` | Emergency kill switch on CSCA-Course API + worker |
| `COURSE_CATALOG_SYNC_DISABLED` | `false` | Catalog/content sync kill switch on CSCA-Course |
| `COURSE_CATALOG_SYNC_WORKER_ENABLED` | `false` | Catalog outbox/sync worker toggle |
| `MOLY_INTEGRATION_SERVICE_TOKEN` | *(secret, empty)* | Inbound token verifying Moly S2S requests |
| `MOLY_INTEGRATION_KEY` | *(empty)* | Inbound key matching Moly `COURSE_LMS_INTEGRATION_KEY` |
| `MOLY_INTEGRATION_HMAC_SECRET` | *(secret, empty)* | Inbound HMAC secret matching Moly `COURSE_LMS_HMAC_SECRET` |

---

## 4. Pilot Cohort Rollout Sequence & SLA Targets

### 4.1 Rollout Sequence

1. **Stage 0 — Pre-Flight Automated & Staging Verification**:
   - Apply migrations in strict order (`Course 079–084` -> health -> `Moly 076–082`).
   - Run `node tools/e2e/two_origin_sync_probe.mjs` and `npx playwright test tools/e2e/playwright_two_origin.spec.mjs` against staging.
2. **Stage 1 — Internal Staff Pilot (Commerce Sales Still `false`)**:
   - Enable `COURSE_INTEGRATION_WORKER_ENABLED=true` and `COURSE_CATALOG_SYNC_WORKER_ENABLED=true` on staging/prod with `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false`.
   - Create explicit 1-1 `external_course_mappings` and run **Catalog Backfill** + **Contract Handshake Probe**.
   - Test with 2–5 internal staff accounts: SSO launch, delegated playback/PDF/quiz/notes/QA, manual Safe-Linking conflict drill, kill-switch toggle drill.
3. **Stage 2 — Controlled Learner Cohort (5–20 Existing/Test Learners, 24h Soak)**:
   - Monitor `/admin/course-integration`: verify `dead_letter = 0`, `v2InboxAttentionItems = 0`, `stalePendingCount = 0`, checkpoints advancing monotonically, zero unreviewed conflicts.
   - Verify SLA probe targets hold cleanly for 24 hours.
4. **Stage 3 — Priced Course Checkout Pilot**:
   - Confirm every pilot course product has price configured (no `PRICE_NOT_CONFIGURED`) and existing owners show `ALREADY_OWNED`.
   - Enable `CSCA_VIDEO_COMMERCE_SALES_ENABLED=true` for initial paid cohort; observe first paid orders end-to-end (`PayOS` -> `video_orders.completed` -> outbox `processed` -> delegated learning workspace unlocked).
5. **Stage 4 — General Availability**:
   - Open full mapped catalog, keep scheduled dry-run reconciliation + alerting active, and review `integration_reconciliation_runs` drift metrics (`entitlementDrift`, `contentDrift`, `progressDrift`) daily.

### 4.2 SLA Measurement Targets

| Metric | Target | Measured By |
|---|---|---|
| Catalog & curriculum metadata sync latency | **p95 `<= 60s`** (`60,000 ms`) | `tools/e2e/two_origin_sync_probe.mjs` (`SLA_CATALOG_P95_MS=60000`) + checkpoint `last_synced_at` delta |
| Delegated workspace, progress & notes latency | **p95 `<= 10s`** (`10,000 ms`) | `tools/e2e/two_origin_sync_probe.mjs` (`SLA_WORKSPACE_P95_MS=10000`) |
| Delegated video playback token TTL | **`<= 60s`** | Network intercept assertion in `tools/e2e/playwright_two_origin.spec.mjs` |
| One-time SSO ticket TTL | **`<= 90s`** | `COURSE_SSO_TTL_SECONDS=90` + single-use PKCE `S256` + `#code=` fragment |
| Active browser device limit | **Max `2` devices** | Test case 7 in `tools/e2e/playwright_two_origin.spec.mjs` |

---

## 5. Known Limitations

1. **Strict Manual 1-1 Course Mapping**: Auto-matching courses by title or slug is disabled by policy (`AUTO_MAPPING_FORBIDDEN`); unmapped courses intentionally stay non-syncable until mapped by admin.
2. **Non-Destructive Identity Conflicts**: Conflicting accounts (`409` / Safe Linking) never auto-merge; affected learners see verification prompts until an operator resolves the conflict in `/admin/course-integration` or CSCA-Course `/admin/sync`.
3. **Unpriced Courses Fail Closed**: Synced CSCA-Course courses without an active configured price intentionally block checkout (`PRICE_NOT_CONFIGURED`) and display `"Đang cập nhật học phí"` / `"Chưa mở bán"`.
4. **Client Tab Focus for Video Progress Heartbeats**: Video watch-time accumulation relies on player postMessage / interval heartbeats while active; offline periods sync on reconnection via monotonic revisions and reconciliation.
5. **Local Static Verification Boundary**: Frontend TypeScript checks (`tsc --noEmit`) and syntax checks (`node --check`) validate static correctness, NOT live Docker PostgreSQL 2-connection concurrency or real two-origin browser sessions.

---

## 6. Go / No-Go Release Checklist

### A. Local Code & Static Verification (Completed in Repo Before Staging Run)

- [x] **Moly Admin Course Integration Ops API & UI (`courseIntegration.ts`, `AdminCourseIntegrationOps.tsx`)**: Split kill switches (`Global`, `Content Sync`, `Delegated Learning`, `Mutations / Repair`), rollout flags posture, Contract Handshake Probe, v2 Sync Inbox & Checkpoints tab (+ retry, catalog backfill, curriculum backfill), Reconciliation domain filter & Per-Subject Recovery (`POST /ops/retry-subject`) implemented and type-checked.
- [x] **Checkout & Pricing Guard Alignment (`VideoCheckout.tsx`, `VideoCatalog.tsx`, `shared.tsx`, `videoShop.ts`)**: `PRICE_NOT_CONFIGURED`, `ALREADY_OWNED`, `PENDING_SYNC`, `IDENTITY_VERIFICATION_REQUIRED`, `EXTERNAL_GRANT_BLOCKED` rendered clearly in Vietnamese with launch/refresh CTAs and disabled pay controls when blocked.
- [x] **Frontend `.env.example` Fail-Closed Defaults**: Added `NEXT_PUBLIC_DELEGATED_LEARNING_ENABLED=false` and `NEXT_PUBLIC_COURSE_SYNC_ENABLED=false` alongside `NEXT_PUBLIC_BUNNY_STREAM_ENABLED=false`.
- [x] **Day 9 Verification Tooling (`tools/e2e/`)**: `two_origin_sync_probe.mjs`, `playwright_two_origin.spec.mjs`, and `README.md` created outside `frontend/` and syntax-checked (`node --check`).

### B. Live Infrastructure Gates Required Before Staging Sign-Off / Production Deploy (NO-GO Until All Checked)

- [ ] **Backend Day 8–10 Integration Tests + Docker PG 2-Connection Concurrency Suite**: Run live PostgreSQL multi-connection concurrency, idempotency, high-water revision ordering, and reconciliation tests in both `CSCA-Course` and `CSCA-MOLI.STUDIO/backend`.
- [ ] **Pre-Migration Backup Snapshots & Clean Migration Execution**: Apply `CSCA-Course` `079`–`084` -> health -> `CSCA-MOLI.STUDIO` `076`–`082` on staging with zero errors.
- [ ] **Live Two-Origin Sync & SLA Probe Pass**: Execute `node tools/e2e/two_origin_sync_probe.mjs` against running two-origin staging servers with `MOLY_ADMIN_BEARER` + `MOLY_LEARNER_BEARER` + `PROBE_COURSE_SLUG` -> confirm `verdict === "PASS"` and catalog p95 `<= 60s`, workspace p95 `<= 10s`.
- [ ] **Live Two-Origin Playwright E2E Pass (All 9 Matrix Cases)**: Run `npx playwright test tools/e2e/playwright_two_origin.spec.mjs` with seeded test accounts (`learner`, `paid` vs `unowned`, `revoked`, `expired`, `conflict`, `staff`, `2-device`, `copied SSO callback`, `mobile`) -> zero failures, zero skips on mandatory staging fixtures, zero console/page errors, zero secret leaks.
- [ ] **Operational Kill-Switch & DLQ Replay Drill**: Toggle kill switches in staging, verify immediate fail-closed `503` behavior, clear switches, replay a sample DLQ / v2 inbox item, and confirm dry-run reconciliation returns zero unexpected drift.
