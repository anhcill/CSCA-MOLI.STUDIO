# Nhận Xét Dự Án CSCA MOLI.STUDIO

Ngày rà soát: 2026-06-01
Nhánh: `main`
Đã pull đến commit: `f3bf211b`

## Tóm Tắt

Dự án đã có nền tảng khá đầy đủ: frontend Next.js App Router, backend Express/PostgreSQL, RBAC admin, quản lý đề thi, import PDF, AI phân tích, thanh toán VIP/Premium, ví xu, từ vựng/flashcard, forum, tài liệu, Socket.IO. Code mới sau pull tập trung nhiều vào import PDF đề thi, thanh toán/coin, AI config và flashcard.

Việc cần làm tiếp không phải là thêm tính năng lớn ngay, mà là khóa lại các điểm vận hành rủi ro: payment idempotency/webhook, deploy Railway, test/lint, cấu hình env, đồng bộ UI tạo đề sau refresh, và chuyển DDL runtime về migration.

## Điểm Đã Ổn

- `frontend` typecheck pass bằng `npx.cmd tsc --noEmit --pretty false`.
- Backend các file trọng điểm pass syntax check: `src/index.js`, `adminExamController.js`, `payments.js`, `aiService.js`.
- CodeGraph index khỏe: 389 file, 3761 symbol, 5583 edge.
- DB coverage script báo remote/local table khớp: `remoteTableCount=68`, `localCreateTableCount=68`, không thiếu bảng local.
- Admin exam import PDF đã có 2 lớp: parse rule-based trước, AI Beeknoee fallback sau; có giới hạn `PDF_IMPORT_TEXT_LIMIT=60000`, `PDF_IMPORT_MAX_QUESTIONS=120`.
- Bank transfer đã dùng `Transaction.claimPending()` để tránh xử lý trùng webhook.
- Coin ledger có `idempotency_key` unique index, tốt cho debit/credit không trùng.
- Không thấy secret thật trong tracked files qua `git grep`; chỉ thấy placeholder và false positive nội dung HSK.

## Cần Sửa Ưu Tiên Cao

1. Deploy Railway có nguy cơ không chạy đúng.
   - `railway.toml:5` đang là `startCommand = "npm start"` ở root repo, nhưng root không có `package.json`.
   - Nên đổi thành `bash start.sh` hoặc `cd backend && npm start`.

2. Payment idempotency chưa hoạt động.
   - `backend/src/routes/payments.js:635-642` tìm transaction theo `IDEM_${userId}_...`, nhưng transaction tạo thật ở `payments.js:680,785,792` lại dùng `CSCA${userId}T${Date.now()}`.
   - Retry cùng `idempotency_key` vẫn có thể tạo đơn mới.
   - Nên thêm cột `idempotency_key` unique riêng, hoặc lưu provider order id tách khỏi business transaction id.

3. MoMo/VNPay webhook chưa claim pending atomically.
   - Bank transfer có `Transaction.claimPending()` ở `payments.js:577,1327`.
   - MoMo/VNPay chỉ kiểm tra `transaction.status !== 'completed'` ở `payments.js:961,1064`.
   - Callback đồng thời có thể chạy double VIP extension/email/coupon update. Nên dùng `claimPending()` giống bank transfer trước khi cấp quyền.

4. VNPay signature verify có khả năng sai.
   - `payments.js:1034` destructure nhiều `vnp_*`, sau đó `payments.js:1042` ký từ `Object.keys(rest)`, làm mất các field quan trọng như `vnp_TxnRef`, `vnp_Amount`, `vnp_ResponseCode`.
   - Nên verify trên toàn bộ params trừ `vnp_SecureHash` và `vnp_SecureHashType`, đúng format provider.
   - Nên tách rõ route return GET và IPN webhook thay vì route tên `vnpay-webhook` nhưng cuối cùng redirect.

5. Coupon `user_limit` mâu thuẫn DB constraint.
   - `coupons.user_limit` cho phép cấu hình số lần dùng mỗi user, nhưng `database/migrations/010_create_coupon_usages.sql:13` đặt `UNIQUE(coupon_id, user_id)`.
   - Nếu `user_limit > 1`, DB vẫn chặn lần dùng thứ 2. Nên bỏ unique này hoặc đổi thành unique theo transaction, rồi enforce `user_limit` bằng query/transaction lock.

6. Trang tạo đề có lỗi state sau refresh.
   - `frontend/app/admin/exams/create/page.tsx:236-247` restore `currentExamId` từ URL/sessionStorage nhưng không gọi `getExamForEdit`.
   - Sau refresh, local questions rỗng nên publish bị chặn dù DB đã có câu; nếu admin bấm lưu/publish sau khi state rỗng còn có nguy cơ ghi metadata mặc định.
   - Nên load exam + questions khi có `currentExamId`.

7. Auth token đang lưu ở browser storage.
   - `frontend/lib/store/authStore.ts:54,66-75,130-131` persist cả token/refreshToken và sync qua `sessionStorage`.
   - XSS có thể lấy refresh token. Nên chuyển refresh token sang httpOnly secure cookie, access token ngắn hạn giữ memory/session.
   - `backend/src/middleware/authMiddleware.js:17-19` nhận token qua query param; chỉ nên dùng cho signed one-time download URL hoặc bỏ.

## Cần Hoàn Thiện Tiếp

1. Thiếu cấu hình env mới cho bank transfer/SePay.
   - Code dùng `SEPAY_API_KEY`, `SEPAY_API_TOKEN`, `BANK_CODE`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME` ở `payments.js:82,135-137,499`, nhưng `backend/.env.example` chưa có.
   - Cần bổ sung placeholder và hướng dẫn webhook.

2. Runtime DDL đang nằm trong app code.
   - `backend/src/routes/vocabulary.js:17-64`, `backend/src/routes/materials.js`, `backend/src/models/Ticket.js`, `backend/src/controllers/settingsController.js` có tạo/alter table lúc runtime.
   - Nên chuyển hết về `database/migrations/`, app startup chỉ chạy check nhẹ. Việc này giảm lỗi deploy, lock schema và quyền DB quá rộng.

3. Vocabulary premium gate còn hở.
   - `backend/src/services/vocabularyReviewService.js:265-269` lấy distractor từ toàn bộ active vocab, không lọc premium.
   - `submitMiniTest` ở `vocabularyReviewService.js:294-304` trả đáp án theo ID active, không lọc quyền VIP.
   - Free user có thể thấy nghĩa từ premium nếu biết ID hoặc qua distractor. Nên truyền `isVip` vào submit/option query và áp cùng filter như queue.

4. Import PDF chưa xử lý scan/OCR và ảnh thật.
   - `previewPdfImport` yêu cầu selectable text, lỗi nếu text dưới 120 ký tự.
   - UI review chỉ cho nhập URL ảnh; chưa tích hợp upload ảnh trực tiếp cho câu bị `needsImage`.
   - Nên thêm OCR hoặc hướng dẫn rõ "PDF scan cần OCR trước"; thêm upload ảnh ngay trong `PdfImportReview`.

5. Import PDF có thể lệch thứ tự hiển thị local sau khi lưu.
   - `create/page.tsx:681-767` tách localQuestions, localReadingGroups, localFillBlankGroups theo loại rồi append từng mảng.
   - Nếu PDF preview có thứ tự xen kẽ, backend insert đúng theo `importItems`, nhưng UI sau save có thể gom theo loại.
   - Nên build local state theo một pass từ `importItems`/`insertedItems` và giữ `_order` đúng thứ tự gốc.

6. ESLint chưa cấu hình.
   - `npm.cmd run lint` mở prompt "How would you like to configure ESLint?" và exit 1.
   - Cần thêm `.eslintrc` hoặc `eslint.config.*`, cài dependency nếu thiếu, rồi chạy lint non-interactive trong CI.

7. Backend chưa có test thật.
   - `npm.cmd test -- --watchAll=false` báo `No tests found`.
   - Cần ít nhất test cho payment webhook/idempotency, coupon, PDF import normalization, auth/RBAC, vocabulary premium gate.

8. Frontend build cần kiểm tra lại.
   - `npm.cmd run build` chưa hoàn tất sau 5 phút và bị timeout trong lần rà soát.
   - Typecheck đã pass, nhưng vẫn cần build hoàn chỉnh để bắt lỗi SSR/static generation và đo thời gian build.

9. Dependency type nên đồng bộ.
   - `frontend/package.json` dùng React 18 runtime nhưng `@types/react`/`@types/react-dom` 19 ở dòng 25-26.
   - Typecheck hiện pass, nhưng nên pin types về React 18 hoặc nâng runtime đồng bộ sau khi test.

10. `Transaction.updateField()` nên có allowlist.
    - `backend/src/models/Transaction.js:114-117` nối trực tiếp tên cột vào SQL.
    - Hiện caller nội bộ, nhưng nên giới hạn field hợp lệ để tránh lỗi bảo mật khi tái sử dụng sau này.

11. AI rate limit đang global file-based.
    - `backend/src/services/aiService.js:14,27-29,124` ghi `.ai_ratelimit`.
    - Chạy nhiều instance sẽ không đồng bộ; serverless/container restart cũng mất trạng thái. Nên dùng Redis/Postgres hoặc per-key backoff thay vì khóa toàn bộ service.

12. Tài liệu README/env cần cập nhật theo code mới.
    - README vẫn mô tả chung, chưa có hướng dẫn import PDF, SePay/bank transfer, coin discount, AI coin cost, script test/lint, quy trình migration.

## Gợi Ý Lộ Trình Làm Tiếp

1. Sửa payment trước: idempotency, VNPay signature, claim pending cho MoMo/VNPay, coupon constraint.
2. Sửa deploy/env: `railway.toml`, `.env.example`, checklist production.
3. Sửa admin create exam reload và PDF import order.
4. Chuyển runtime DDL về migrations.
5. Bổ sung ESLint + test tối thiểu cho payment/PDF/vocabulary.
6. Chạy build frontend full và tối ưu nếu build quá lâu.

## Lệnh Đã Chạy

```bash
git pull --ff-only
npx.cmd tsc --noEmit --pretty false
npm.cmd run lint
npm.cmd test -- --watchAll=false
node --check src/index.js
node --check src/controllers/adminExamController.js
node --check src/routes/payments.js
node --check src/services/aiService.js
node scripts/check_schema_coverage.js
```

Kết quả chính:

- Pull thành công từ `d8703434` lên `f3bf211b`.
- TypeScript frontend pass.
- Backend syntax check các file trọng điểm pass.
- Lint frontend chưa chạy được vì thiếu cấu hình ESLint.
- Backend test không có test file.
- Frontend build bị timeout sau 5 phút, cần chạy lại riêng.
- Schema coverage khớp remote/local table.
