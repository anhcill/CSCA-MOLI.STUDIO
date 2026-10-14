# Ngày 3: giao diện mua và quản trị video/combo

Ngày cập nhật: 13/10/2026. Đã triển khai và kiểm thử cục bộ; chưa commit, push, áp dụng database thật hoặc mở bán. Giá và thời hạn do admin cấu hình sau; số liệu trong kiểm thử chỉ là fixture.

## 1. Luồng người dùng

| Trang | Chức năng |
| --- | --- |
| `/goi-video` | Danh mục riêng video/combo, nội dung khóa, môn, giá/thời hạn, banner và tình trạng mua |
| `/thanh-toan-khoa-hoc` | Chọn môn, voucher, xu, báo giá từ server, tạo đơn, QR/payOS, kiểm tra/hủy đơn và trạng thái xử lý |
| `/tai-khoan/goi-video` | Quyền đã nhận và lịch sử đơn của chính người dùng |

Checkout lưu payload và khóa idempotency vào sessionStorage trước khi gửi. Nếu mất mạng hoặc reload sau khi tạo đơn, lần thử lại dùng đúng yêu cầu ban đầu. Polling dừng ở trạng thái kết thúc. Giá và quyền do backend xác nhận; return URL không phải bằng chứng thanh toán.

Cảnh báo sở hữu trên checkout dựa trên tối đa 100 quyền tải về và có liên kết tới trang quyền. Đây là trợ giúp hiển thị; quyết định mua/gia hạn vẫn do báo giá backend kiểm tra.

## 2. Admin

Trang `/admin/video-commerce` dùng AdminLayout hiện có, gồm danh mục gói, học viên/quyền, giao dịch, voucher, banner và nhật ký. API quản trị yêu cầu đăng nhập và quyền `users.manage`.

- Tạo/sửa bản nháp chưa cần giá hoặc thời hạn; xuất bản phải đủ cấu hình hợp lệ. Có ngừng bán bằng archive. Chỉnh gói không sửa snapshot quyền đã mua.
- Cấp thủ công video/combo với lý do, hạn cụ thể hoặc vĩnh viễn, có khóa chống cấp trùng và audit. Combo cấp hai phần trong một transaction; cấp tay không tạo doanh thu.
- Thu hồi theo nguồn cấp, liên kết đúng phần VIP của combo; giữ quyền từ nguồn khác và tiến độ. Thao tác này không hoàn tiền.
- Bảo toàn VIP legacy chỉ có trong profile trước khi cấp combo khi chưa có entitlement đang hoạt động. Giữ hạn vĩnh viễn khi tổng hợp quyền.
- Xem đơn, đồng bộ trạng thái payOS, thống kê tách video/combo; cấp tay không cộng doanh thu.
- Tạo voucher riêng, giới hạn theo loại và gói, xem lượt dùng; bật phạm vi video cho mã chung qua API scope. Mã chung không được sửa nội dung qua form voucher riêng.
- Banner riêng từng loại; ẩn mã hết hiệu lực hoặc sai phạm vi. Email cấp/thu hồi qua outbox có retry; email không đưa lý do nội bộ cho học viên.

Voucher riêng dùng `applicable_tiers=['video_only']` để validator VIP/Premium cũ từ chối. Phạm vi video/combo nằm trong bảng scope; danh sách sản phẩm rỗng nghĩa là toàn bộ sản phẩm của loại đó. Admin cũ vẫn có thể chỉnh coupon trực tiếp, nên cần giữ sentinel khi quản trị mã riêng.

## 3. API và dữ liệu

Router mới dưới `/api/video-commerce`: `/shop/catalog/:type`, `/shop/products/:type/:id`, `/shop/promotion/:type`, `/me/rights` và `/manage/*`. Router nền ngày 1 vẫn phục vụ bản nháp; shop là luồng danh mục bán mới. QR `/orders/:orderId/qr` xác minh chủ đơn và tạo ảnh tại server.

Migration 069 thêm liên kết VIP/snapshot trên `user_video_entitlements`, bảng `video_admin_requests`, `video_admin_events`, `video_promotions` và `video_rights_outbox`. Có backfill liên kết từ kết quả combo đã lưu.

Thứ tự áp dụng: prerequisite hiện có, 067, 068, rồi 069. Các lệnh sau chạy từ `backend`, chỉ khi đã chỉ định database đích bằng `VIDEO_COMMERCE_DATABASE_URL`:

```text
node scripts/apply_video_commerce_migration.js --apply
node scripts/apply_video_payment_migration.js --apply
node scripts/apply_video_admin_migration.js --apply
node scripts/apply_video_admin_migration.js --check
```

`--check` của 069 kiểm tra bốn bảng và hai cột mới, không thay thế kiểm kê schema thực tế. Script `node scripts/reconcile_video_payments.js --run` nay xử lý thêm email quyền và cần migration 069; chưa gắn lịch chạy thật.

Giữ mặc định `CSCA_VIDEO_COMMERCE_ENABLED=false` và `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false`. Module nằm trong cờ courses hiện có. Chưa bật bán trước khi hoàn thành nối quyền học/phát video và nghiệm thu staging. Sau khi đã nhận đơn, tạm dừng bán bằng SALES=false, vẫn giữ module hoạt động để xử lý đơn đang chờ.

## 4. Bảo toàn gói hiện tại

Baseline gốc không đổi tại commit `20a04a5a144565a9accda038e0a7345a5118b67e`. Lệnh `node backend/scripts/check_video_commerce_baseline.js --day3` xác nhận 13/18 file giữ nguyên, không có thay đổi ngoài allowlist. Năm trang VIP, checkout, checkout success, admin VIP và admin coupons giữ nguyên mã nguồn.

Năm thay đổi có chủ đích trong baseline: bốn mở rộng backend ngày 2 và liên kết video trong trang danh mục khóa. Ngoài baseline, thêm liên kết tại chi tiết khóa, trang học và menu admin. ClientShell chỉ ẩn tiện ích nổi/footer trên ba trang commerce người dùng mới để tránh che nội dung mobile. So sánh baseline là kiểm tra mã nguồn, không chứng minh toàn bộ hành vi render.

## 5. Kiểm thử

Kết quả backend đã chạy: 129 test đạt, gồm 25 nền/Bunny, 58 payment/gateway, 20 Jest (dispatch, tương thích voucher và course hiện có), 26 HLS/publisher/gateway/auth/device. Test ngày 3 bao gồm migration lặp/backfill, bản nháp/xuất bản, snapshot, cấp/thu hồi theo nguồn, rollback combo, VIP vĩnh viễn, quyền HTTP, voucher/banner, retry email và QR theo chủ đơn.

```text
# Từ backend
npm run test:video-commerce
npm run test:video-payments
node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/services/__tests__/videoCouponCompatibility.spec.js src/services/__tests__/videoPaymentDispatch.spec.js src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
node --test test/courseHls.test.cjs ../tools/video/test/publish.test.mjs ../workers/video-gateway/test/gateway.test.mjs test/deviceSessionIdentity.test.cjs test/authSessionStorage.test.cjs

# Từ frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false

# Từ repository root, khi Next dev đang chạy tại 127.0.0.1:8130
node tools/video/test/commerce-ui.mjs
```

Browser runner cần Playwright và Chrome; dùng `VIDEO_UI_PLAYWRIGHT_MODULE` và `VIDEO_UI_BROWSER_PATH` khi module/browser không ở vị trí mặc định. Toàn bộ API được mock, chỉ cho URL cục bộ. Đã kiểm tra catalog hai loại, tạo đơn mất mạng rồi reload/thử lại cùng payload/key, lịch sử, bản nháp trống, cấp/thu hồi, voucher, banner và không tràn ngang ở 1440/390/360 px. Kiểm tra ảnh mobile cho danh mục, checkout và admin; không có pageerror. Biểu tượng Next dev trong ảnh chỉ thuộc môi trường phát triển.

TypeScript, cú pháp 34 file JavaScript và `git diff --check` đạt. Chưa chạy production build.

## 6. Giới hạn và ngày 4

- PGlite dùng schema prerequisite tối thiểu và tuần tự hóa transaction; chưa chứng minh tranh chấp nhiều connection/worker PostgreSQL thật.
- Chưa gọi payOS/Bunny thật, gửi email thật hoặc chạy migration trên staging/production. Các kiểm thử trình duyệt không chứng minh tích hợp backend với database thật.
- Email outbox không bảo đảm đúng một lần tuyệt đối nếu crash sau khi dịch vụ nhận thư nhưng trước khi ghi trạng thái sent.
- Cần thử dữ liệu VIP legacy đại diện, callback thật và đối soát trước mở bán; vẫn giữ các giới hạn thanh toán ngày 2.
- Ngày 4 nối entitlement vào danh sách khóa, quyền bài học và playback, hoàn thiện upload/trạng thái/phát Bunny cùng tiến độ. Chưa có Bunny Library nên có thể chuẩn bị code/mock; nghiệm thu video thật cần tài khoản và cấu hình sau.
