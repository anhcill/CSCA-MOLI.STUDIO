# Day 9 Two-Origin E2E, Fault & SLA Verification Tools

Thư mục này chứa các script kiểm thử hai origin (`CSCA-Course` ↔ `CSCA-MOLI.STUDIO`) nằm ngoài `frontend/` để không ảnh hưởng dependencies và `tsc --noEmit` của `frontend/package.json`.

## 1. Zero-Dependency Sync & SLA Probe (`two_origin_sync_probe.mjs`)

Kiểm tra:
1. Thứ tự startup hợp lệ:
   - `GET ${COURSE_BASE_URL}/api/integrations/v2/health`
   - `GET ${MOLY_BASE_URL}/health/integration`
   - `GET ${MOLY_BASE_URL}/api/admin/course-integrations/ops/contract-probe` (khi cung cấp `MOLY_ADMIN_BEARER`)
2. Security checks: fail-closed CORS với untrusted origin, admin endpoint chưa xác thực phải trả `401/403`, không rò rỉ secret/private-key trên public health endpoints.
3. Đo SLA p95 thực tế trên server đang chạy (`catalog_read_projection` mục tiêu `<= 60s`, `workspace/health` mục tiêu `<= 10s`).

### Chạy khi Docker PG + 2 server local/staging đã bật:

```powershell
$env:COURSE_BASE_URL="http://localhost:8000"
$env:MOLY_BASE_URL="http://localhost:5000"
$env:MOLY_FRONTEND_URL="http://localhost:3000"
# Tuy chon neu muon probe admin contract + delegated workspace:
# $env:MOLY_ADMIN_BEARER="<staff-jwt>"
# $env:MOLY_LEARNER_BEARER="<learner-jwt>"
# $env:PROBE_COURSE_SLUG="<slug-khoa-hoc>"
node tools/e2e/two_origin_sync_probe.mjs
```

Exit codes:
- `0`: Toàn bộ health checks, security checks và SLA p95 đều đạt.
- `1`: Ít nhất một assertion hoặc ngưỡng SLA bị vi phạm.
- `2`: Server chưa chạy / không kết nối được tới một trong hai origin.

## 2. Two-Origin Playwright E2E Suite (`playwright_two_origin.spec.mjs`)

Bao phủ toàn bộ ma trận Day 9:
- `learner`: SSO `#code` + PKCE launch, playback token TTL `<= 60s`, PDF viewer, quiz/assignment, note/bookmark/QA & reload persistence.
- `paid` vs `unowned`: khóa chưa cấu hình giá (`PRICE_NOT_CONFIGURED`) bị khóa checkout; khóa đã sở hữu (`ALREADY_OWNED`) chặn mua trùng.
- `revoked`: học viên bị thu hồi quyền bị chặn tại workspace và playback token (`401/403/404`).
- `expired`: delegated token hết hạn kích hoạt flow retry/refresh an toàn.
- `conflict`: trạng thái xung đột `409` / Safe Linking hiển thị cảnh báo xác minh, không tự động gộp tài khoản.
- `staff`: Admin Ops Dashboard (`/admin/course-integration`), split kill switches, Contract Probe, v2 Sync Inbox & Checkpoints, Per-Subject Recovery.
- `2-device`: giới hạn tối đa 2 trình duyệt / thiết bị.
- `copied SSO callback`: replay URL `#code=...&state=...` sang browser context khác bị từ chối fail-closed.
- `mobile`: viewport `390x844` không tràn ngang (`scrollWidth <= innerWidth + 2`).
- Secret-leak & console/pageerror monitor gắn trên mọi browser context.

### Chạy với `@playwright/test` khi 2 app staging/local + PostgreSQL đã sẵn sàng:

```powershell
# Cai Playwright ben ngoai repo frontend hoac trong runner CI rieng:
# npm i -D @playwright/test && npx playwright install chromium
$env:E2E_MOLY_WEB_URL="http://localhost:3000"
$env:E2E_MOLY_API_URL="http://localhost:5000"
$env:E2E_COURSE_WEB_URL="http://localhost:5173"
$env:E2E_OWNED_COURSE_SLUG="<slug>"
$env:E2E_LEARNER_EMAIL="<test-learner-email>"
$env:E2E_LEARNER_PASSWORD="<test-learner-password>"
$env:E2E_STAFF_EMAIL="<test-staff-email>"
$env:E2E_STAFF_PASSWORD="<test-staff-password>"
npx playwright test tools/e2e/playwright_two_origin.spec.mjs
```
