# Moly Studio <-> CSCA-Course Integration Runbook, Railway Env Guide & Rollout Order (Day 5)

> **Security notice**: This document intentionally lists **environment variable names only**. Never commit real tokens, HMAC secrets, passwords, JWT keys, `linkToken`, PKCE `codeVerifier`, or payment payloads to git or logs.
>
> **Day 8–10 Full Sync v2 Supplement**: For v2 catalog/curriculum sync (`081`–`082` Moly / `083`–`084` Course), split kill switches (`Global`, `Content Sync`, `Delegated Learning`, `Mutations / Repair`), Admin Ops v2 Inbox & Per-Subject Recovery, frontend `NEXT_PUBLIC_*` rollout defaults, SLA probe & Playwright two-origin E2E instructions, and the production **Go/No-Go Checklist**, see [MOLY_COURSE_DAY8_10_RUNBOOK_AND_GO_NO_GO.md](./MOLY_COURSE_DAY8_10_RUNBOOK_AND_GO_NO_GO.md).

---

## 1. Operational Runbook

### 1.1 Emergency Kill Switch (Dừng khẩn cấp ngay lập tức)
Use immediately when detecting sync storms, corrupted course mappings, wrong entitlement propagation, or CSCA-Course outage:

- **On Moly Studio (Railway Backend Service)**:
  - Set `COURSE_INTEGRATION_SYNC_DISABLED=true` (or `COURSE_INTEGRATION_KILL_SWITCH=true`)
  - Optionally set `COURSE_INTEGRATION_WORKER_ENABLED=false`
  - Effect (immediate once process restarts/reloads):
    - `startOutboxWorker` refuses to start and `tick()` aborts immediately.
    - `dispatchNextOutboxJob`, `reconcileSentOutboxEvents`, `processAvailableOutboxJobs`, `kickSync`, and `retryOutboxItem` halt / return `503 INTEGRATION_KILL_SWITCH_ACTIVE`.
    - Outbound S2S `courseIntegrationClient` (`postSigned`) blocks HTTP calls before network I/O and returns retryable `503`.
    - `courseOwnershipProjectionService.syncUserOwnershipFromCourse` and `courseReconciliationService.runReconciliation` abort immediately (`aborted_kill_switch`, HTTP `503`).
- **On CSCA-Course (Railway Backend + Worker Services)**:
  - Set `MOLY_INTEGRATION_SYNC_DISABLED=true` (or `MOLY_INTEGRATION_KILL_SWITCH=true`)
  - Effect:
    - `processNextMolyInboxJob` & `processAvailableMolyInboxJobs` stop claiming jobs (`return null` / `[]`).
    - Inbound signed S2S mutations (`/users/provision`, `/entitlements/grant`, `/entitlements/revoke`), `/ownership/query`, `/moly/reconciliation/snapshot`, and manual inbox retry return retryable `503 INTEGRATION_KILL_SWITCH_ACTIVE`.
    - Moly purchases and Course core learning continue operating locally without dropping local transactions (`integration_outbox` preserves pending jobs safely).

### 1.2 Retry Failed / Dead-Letter Events
1. **Check correlation & error code** first:
   - On Moly UI: `/admin/course-integration` -> tab **Hàng đợi Outbox** (or `GET /api/admin/course-integrations/ops/overview`)
   - On CSCA-Course UI: `/admin/sync` -> panel **Moly Studio Integration Inbox & Conflicts** (or `GET /api/v1/admin/integrations/inbox-ops`)
2. **Fix root cause before retrying**:
   - `COURSE_MAPPING_MISSING` -> add explicit manual course mapping first (Section 1.3).
   - `IDENTITY_*` conflict -> resolve identity conflict first (Section 1.4); Moly refuses `POST /outbox/:id/retry` while an `IDENTITY_%` conflict stays `open`.
   - Transient `5xx` / timeout -> retry directly once downstream health recovers.
3. **Trigger retry**:
   - Moly: `POST /api/admin/course-integrations/outbox/:id/retry` (body `{ "dispatchNow": true }`) or button **"Thử lại"**.
   - CSCA-Course: `POST /api/v1/admin/integrations/inbox-ops/:id/retry` or button **"Thử lại"**.

### 1.3 Map Khóa Học Thủ Công (Không tự match theo tên/slug)
Auto-matching by title/slug is blocked by design (`AUTO_MAPPING_FORBIDDEN`).
1. Obtain exact IDs:
   - Moly `courses.id` (`localCourseId`)
   - CSCA-Course `courses.id` and canonical offering string (`moly:course:<localCourseId>` or agreed explicit `external_course_id`)
2. **On Moly Studio** (`/admin/course-integration` -> tab **Course Mapping** or `POST /api/admin/course-integrations/course-mappings`):
   - `sourceSystem`: `"moly"`
   - `externalCourseId`: exact shared offering key (e.g. `"moly:course:123"`)
   - `localCourseId`: numeric Moly course ID
   - `status`: `"active"`
3. **On CSCA-Course** (`POST /api/v1/admin/integrations/course-mappings`):
   - `sourceSystem`: `"moly"`
   - `externalCourseId`: identical shared offering key (`"moly:course:123"`)
   - `localCourseId`: numeric CSCA-Course ID
   - `status`: `"active"`
4. Run Reconciliation **Dry-Run** then **Auto-Repair** to push any active entitlements that were waiting on the missing mapping.

### 1.4 Xử lý Xung Đột Danh Tính (`integration_conflicts`)
Reconciliation **never** auto-merges or auto-links conflicting accounts.
1. Inspect conflict row (`IDENTITY_EMAIL_COLLISION`, `PRIVILEGED_ROLE_COLLISION`, `IDENTITY_ALREADY_LINKED`, `UNRESOLVED_IDENTITY`):
   - Verify learner ownership out-of-band (never merge privileged `admin`/`teacher`/`creator` accounts with external student identities).
2. Resolution options:
   - **Verified same learner** -> `link_existing` with verified `targetUserId` (via `/admin/course-integration` or CSCA-Course `/admin/sync`, `POST .../conflicts/:id/resolve` with `{ "action": "link_existing", "targetUserId": <id>, "resolutionNote": "..." }`).
   - **False / obsolete event** -> `dismissed` or `ignored` with `resolutionNote`.
3. Replay quarantined inbox/outbox event if applicable, then run reconciliation dry-run to confirm zero conflicts remain blocking.

### 1.5 Revoke Quyền Thủ Công
1. **If revoking a Moly purchase / manual video grant**:
   - Revoke the grant or refund the order in Moly Admin (`/admin/video-commerce`).
   - Moly atomically writes `entitlement.revoked` to `integration_outbox` with a strictly monotonic `source_updated_at`.
   - Click **"Đẩy Outbox ngay"** (or wait for worker tick) and verify `remote_status = processed` on `/admin/course-integration`.
2. **If drift exists (local revoked, remote still active)**:
   - Run `POST /api/admin/course-integrations/reconcile` with `{ "dryRun": true }` to verify detection of `local_revoked_remote_active`.
   - Run `{ "dryRun": false }` to enqueue and dispatch idempotent revoke repair.

### 1.6 Reconciliation Manual & Scheduled
- **Dry-Run Check**: `POST /api/admin/course-integrations/reconcile` `{ "dryRun": true }`
- **Auto-Repair Unambiguous Drift**: `POST /api/admin/course-integrations/reconcile` `{ "dryRun": false, "dispatchRepairs": true }`
- Check `integration_reconciliation_runs` & `integration_reconciliation_actions` audit trail via UI tab **Lịch sử Đối soát** or `GET /api/admin/course-integrations/reconcile/runs`.
- Note on safety:
  - Auto-repairs **only** `local_active_remote_missing` (grant) and `local_revoked_remote_active` (revoke) when mapping + identity are active & unambiguous and **zero open conflicts** exist.
  - Flags `remote_active_unknown_on_moly`, `missing_course_mapping`, `identity_missing_or_conflict`, `stale_pending_event`, and `dead_letter_event` without destructive changes.

### 1.7 Rollback An Toàn
1. **Immediate Traffic/Sync Freeze**:
   - Enable Kill Switch on both services (`COURSE_INTEGRATION_SYNC_DISABLED=true`, `MOLY_INTEGRATION_SYNC_DISABLED=true`) and set `COURSE_INTEGRATION_WORKER_ENABLED=false`.
2. **Code Rollback**:
   - Roll back Railway deployments to previous known-good release SHA. Keep `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false` during incident verification if needed.
3. **Database Policy (Forward-Fix Only in Production)**:
   - Migrations (`076`, `077`, `078`, `079`, `080` on Moly; `079`–`082` on Course) are strictly additive. **Do NOT run destructive `DROP TABLE` / `DROP COLUMN` against live production databases**, as `integration_outbox`, `integration_inbox`, `external_entitlements`, and `integration_reconciliation_runs` hold live financial & audit state.
   - Only in an empty/staging reset, drop newly added Day 5 audit tables in reverse order (`DROP TABLE IF EXISTS integration_reconciliation_actions, integration_reconciliation_runs;`).

---

## 2. Railway Environment Variables Required

### 2.1 Moly Studio Backend Service (`CSCA-MOLI.STUDIO`)
| Variable Name | Required | Purpose & Safe Default |
|---|---|---|
| `CSCA_VIDEO_COMMERCE_ENABLED` | Yes | Enables `/api/video-commerce` commerce module (`true` on active rollout) |
| `CSCA_VIDEO_COMMERCE_SALES_ENABLED` | Gated | Gates new purchases; keep `false` until staging smoke & mappings verified |
| `COURSE_LMS_BASE_URL` | Yes | CSCA-Course backend base URL (HTTPS in staging/prod) |
| `COURSE_LMS_SERVICE_TOKEN` | Yes (Secret) | Distinct bearer token from `JWT_SECRET`, sent to Course `/api/integrations/v1` |
| `COURSE_LMS_INTEGRATION_KEY` | Yes | Partner key identifier matching CSCA-Course `MOLY_INTEGRATION_KEY` |
| `COURSE_LMS_HMAC_SECRET` | Yes (Secret) | High-entropy HMAC-SHA256 signing secret matching Course `MOLY_INTEGRATION_HMAC_SECRET` |
| `COURSE_LMS_REQUEST_TIMEOUT_MS` | Optional | HTTP timeout ms (default `10000`) |
| `COURSE_WEB_BASE_URL` | Yes | CSCA-Course frontend URL for `/hoc` SSO launch redirects |
| `COURSE_SSO_TTL_SECONDS` | Optional | Short-lived SSO ticket TTL (`90`) |
| `COURSE_INBOUND_SERVICE_TOKEN` | Yes (Secret) | Distinct bearer token verifying inbound Course -> Moly S2S SSO exchange |
| `COURSE_INBOUND_INTEGRATION_KEY` | Yes | Key matching CSCA-Course `MOLY_OUTBOUND_INTEGRATION_KEY` |
| `COURSE_INBOUND_HMAC_SECRET` | Yes (Secret) | HMAC secret matching CSCA-Course `MOLY_OUTBOUND_HMAC_SECRET` |
| `COURSE_INBOUND_MAX_AGE_SECONDS` | Optional | Timestamp freshness window (`300`) |
| `COURSE_INTEGRATION_WORKER_ENABLED` | Gated | Background outbox + reconciliation loop toggle (`false` until post-deploy verification) |
| `COURSE_INTEGRATION_WORKER_INTERVAL_MS` | Optional | Outbox poll interval (`5000`) |
| `COURSE_INTEGRATION_RECONCILE_INTERVAL_MS` | Optional | Scheduled reconciliation interval (default `300000`) |
| `COURSE_INTEGRATION_RECONCILE_AUTO_REPAIR` | Optional | Keep `false` initially so scheduled ticks run dry-run until verified |
| `COURSE_INTEGRATION_SYNC_DISABLED` | Emergency | Set `false` normally; `true` activates immediate Kill Switch |
| `COURSE_CATALOG_SYNC_DISABLED` | Emergency | Set `false` normally; `true` freezes Day 8–10 catalog/content sync |
| `COURSE_CATALOG_PULL_DISABLED` | Gated | Set `true` / `COURSE_CATALOG_PULL_INTERVAL_MS=0` until v2 contract probe passes |
| `CSCA_BUNNY_STREAM_ENABLED` | Gated | Server-only Bunny Stream toggle (`false` default until credentials ready) |

### 2.2 CSCA-Course Backend & Worker Services (`WebsiteReactVCK-master`)
| Variable Name | Required | Purpose & Safe Default |
|---|---|---|
| `MOLY_INTEGRATION_SERVICE_TOKEN` | Yes (Secret) | Verifies inbound Moly -> Course `/api/integrations/v1` bearer auth |
| `MOLY_INTEGRATION_KEY` | Yes | Key matching Moly `COURSE_LMS_INTEGRATION_KEY` |
| `MOLY_INTEGRATION_HMAC_SECRET` | Yes (Secret) | HMAC-SHA256 secret matching Moly `COURSE_LMS_HMAC_SECRET` |
| `MOLY_INTEGRATION_MAX_AGE_SECONDS` | Optional | Replay protection timestamp window (`300`) |
| `MOLY_API_BASE_URL` | Yes | Moly Studio backend URL (for SSO code exchange & peer identity bind) |
| `MOLY_WEB_BASE_URL` | Yes | Moly Studio frontend base URL for SSO redirects |
| `MOLY_OUTBOUND_SERVICE_TOKEN` | Yes (Secret) | Matches Moly `COURSE_INBOUND_SERVICE_TOKEN` |
| `MOLY_OUTBOUND_INTEGRATION_KEY` | Yes | Matches Moly `COURSE_INBOUND_INTEGRATION_KEY` |
| `MOLY_OUTBOUND_HMAC_SECRET` | Yes (Secret) | Matches Moly `COURSE_INBOUND_HMAC_SECRET` |
| `MOLY_OUTBOUND_REQUEST_TIMEOUT_MS` | Optional | HTTP timeout ms (`10000`) |
| `MOLY_OUTBOUND_MAX_TRANSPORT_ATTEMPTS` | Optional | Transport retries (`2`) |
| `MOLY_SSO_TTL_SECONDS` | Optional | Short-lived SSO ticket TTL (`90`) |
| `MOLY_INTEGRATION_SYNC_DISABLED` | Emergency | Set `false` normally; `true` activates immediate Kill Switch on API + Worker |
| `COURSE_CATALOG_SYNC_DISABLED` | Emergency | Set `false` normally; `true` freezes Day 8–10 catalog sync on Course |
| `COURSE_CATALOG_SYNC_WORKER_ENABLED` | Gated | Keep `false` until migrations `083`–`084` & contract probe pass |

---

## 3. Staging -> Production Deployment Sequence

### Phase A: Database & Env Prep
1. Rotate / provision distinct staging secrets (`COURSE_LMS_*` <-> `MOLY_INTEGRATION_*`, and `COURSE_INBOUND_*` <-> `MOLY_OUTBOUND_*`). Confirm none equal `JWT_SECRET`.
2. Keep `COURSE_INTEGRATION_WORKER_ENABLED=false`, `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false`, `COURSE_INTEGRATION_SYNC_DISABLED=false`, `MOLY_INTEGRATION_SYNC_DISABLED=false`.

### Phase B: Apply Additive Migrations (Staging First)
1. **CSCA-Course**: apply integration & SSO migrations (`079`–`082`) and verify tables (`external_identities`, `external_course_mappings`, `external_entitlements`, `integration_inbox`, `integration_conflicts`, `sso_tickets`, `sso_browser_sessions`).
2. **Moly Studio**: apply migrations `076`–`080` (`node backend/scripts/apply_course_integration_migration.js`) and verify all tables including `integration_reconciliation_runs` and `integration_reconciliation_actions`.

### Phase C: Deploy Code & Smoke Checks (Staging)
1. Deploy **CSCA-Course** web + worker services.
2. Deploy **Moly Studio** backend + frontend services.
3. Verify health endpoints and signed S2S connectivity by triggering one **Reconciliation Dry-Run** (`POST /api/admin/course-integrations/reconcile { "dryRun": true }`) from Moly `/admin/course-integration`: must return HTTP `200` and save a `completed` run record.
4. Create **explicit manual course mappings** on BOTH Moly & CSCA-Course for test courses.
5. Enable `COURSE_INTEGRATION_WORKER_ENABLED=true` on Moly staging.
6. Run staging E2E acceptance test:
   - Video commerce purchase -> outbox -> Course inbox -> `/hoc` launch -> destination-initiated PKCE SSO -> Course playback.
   - Safe-Linking conflict test (confirm non-auto-merge & Safe Linking confirmation works).
   - Refund/revoke test -> Course access immediately blocked.
   - Kill switch drill (`COURSE_INTEGRATION_SYNC_DISABLED=true` -> confirm immediate block -> restore `false`).
   - Audit logs: inspect Railway JSON logs to ensure zero leaked secrets, tokens, `codeVerifier`, `linkToken`, HMAC signatures, or payment webhook payloads.

### Phase D: Production Cutover
1. Repeat Phase A & B on Production databases (zero downtime, additive only).
2. Deploy Production CSCA-Course web + worker -> deploy Production Moly Studio backend + frontend (worker still `false`, sales `false`).
3. Create verified Production 1-1 manual course mappings on both apps.
4. Run Production Reconciliation **Dry-Run** (`dryRun: true`) and confirm expected baseline.
5. Enable `COURSE_INTEGRATION_WORKER_ENABLED=true` on Production Moly, then enable `CSCA_VIDEO_COMMERCE_SALES_ENABLED=true`.
6. Monitor `/admin/course-integration` and Railway logs (`correlation_id`, latency metrics, DLQ = 0, conflicts reviewed) closely for the first 24 hours; schedule periodic reconciliation (`dryRun` first, then supervised auto-repair).
