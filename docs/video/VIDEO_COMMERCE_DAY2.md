# Ngày 2: thanh toán gói video và combo

Ngày triển khai: 13/10/2026. Phạm vi: code và kiểm thử local, tiếp nối ngày 1.

Đã dựng luồng báo giá -> tạo/mở lại đơn -> xác minh thanh toán -> cấp quyền -> lịch sử/email. Video chỉ tạo quyền video; combo ghi cả quyền video và VIP trong cùng transaction database. Giá, thời hạn và danh mục bán thực tế vẫn để admin cấu hình sau. Chưa commit/push, chạy migration production, nhận tiền thật hoặc kết nối Bunny thật trong lượt này.

## 1. Phần đã triển khai

| Khu vực | Hành vi |
| --- | --- |
| Báo giá | Server kiểm tra gói đang bán, khóa đã xuất bản, môn được chọn, giá và thời hạn. Client không quyết định số tiền hoặc quyền được cấp. |
| Đơn hàng | Dùng chung bảng `transactions`; thêm `video_commerce_orders` lưu snapshot giá, voucher, xu, môn, khóa và hai thành phần combo. `package_id` của giao dịch mới là NULL; nhận diện bằng `raw_response.commerceType`. |
| Chống tạo trùng | Bắt buộc `quoteHash` và `idempotencyKey`. Cùng key và cùng nội dung trả lại cùng đơn; đổi nội dung báo xung đột. Quote đã thay đổi phải được lấy và xác nhận lại. |
| Cổng thanh toán | Adapter payOS dùng credential backend. Tạo link ngoài transaction DB; timeout thử đối soát bằng cùng order code. GET của SDK thiếu QR/URL thì khôi phục hosted checkout URL từ ID hợp lệ. |
| Xác minh | Webhook payOS hiện có vẫn kiểm tra chữ ký trước dispatcher. Đơn mới kiểm tra provider, order code, tiền tệ và số tiền chính xác. Query trên return URL không phải bằng chứng thanh toán. |
| Cấp quyền | Ghi nhận tiền đã xác minh trước; sau đó ghi quyền, trừ xu, dùng voucher và hoàn tất đơn trong một transaction. Lỗi giữa hai phần combo rollback toàn bộ phần cấp quyền, giữ bằng chứng thanh toán để retry. |
| Voucher | Mã cũ mặc định không áp dụng video/combo. Admin bật phạm vi bằng API riêng. Cả hai luồng dùng chung hạn mức và reservation khi module mới được bật. Voucher đã ghi nhận usage không bị tính thêm một reservation. |
| Xu | Cùng ví với checkout cũ; 100 VND/xu, tối đa 20% số tiền sau voucher. Đơn video/combo chưa đối soát xong tiếp tục giữ chỗ ngay cả quá 24 giờ. |
| Đơn 0 đồng | Hoàn tất qua cùng dịch vụ cấp quyền, không tạo link payOS. Không coi return từ client là xác nhận đơn miễn phí. |
| Hủy và hết hạn | Thời hạn đơn hiện là 5 phút. Chỉ giải phóng reservation sau khi provider xác nhận chưa nhận tiền và đã hủy/hết hạn. Thanh toán đến muộn vẫn được xử lý theo snapshot; thiếu tài nguyên chuyển sang chờ xử lý. |
| Thanh toán một phần | Ghi `payment_review`, giữ reservation, không cấp quyền. Kết quả hủy cũ không được xóa dấu vết đã nhận tiền. |
| Email | Gửi sau commit, đúng loại sản phẩm và thời hạn từng thành phần; lỗi được lưu trong outbox để thử lại. Có lease chống worker gửi đồng thời. |
| Lịch sử và admin | API lịch sử chỉ trả đơn của tài khoản. API cấu hình voucher/gia hạn có `users.manage` và audit. Risk Center có thể đối soát đơn mới; thao tác cấp/thu hồi VIP cũ từ giao dịch không áp dụng cho video/combo. |
| Frontend | Thêm DTO và API client để ngày 3 nối UI, tái sử dụng axios/auth hiện có. Chưa đổi trang hoặc component. |

Các quyền video hiện được lưu ở nền entitlement. Việc nối chúng vào enrollment/playback và Bunny thuộc ngày 4; ngày 2 chưa biến gói mới thành sản phẩm có thể sử dụng toàn bộ trên website.

## 2. Quy tắc cấu hình còn để admin quyết định

- Giá và thời hạn: không seed danh mục bán thật, không chọn giá hoặc số ngày thay chủ hệ thống. Các giá trong test chỉ là fixture.
- `renewalMode=unconfigured`: chặn mua khi quyền video trùng; combo cũng chặn khi đã có VIP còn hạn, chờ admin chọn chính sách.
- `new_period`: quyền mới tính từ lúc hoàn tất cấp quyền; nguồn quyền cũ vẫn tồn tại.
- `extend`: cộng từ hạn xa nhất còn hiệu lực của cùng package bao phủ các môn mua. Nếu quyền hữu hạn định gia hạn đã có bản vĩnh viễn, quote từ chối trước khi thu tiền. Hai thành phần combo được tính riêng.
- Snapshot khóa học giữ danh sách đã mua khi admin thay đổi danh mục. Migration 068 bỏ FK composite ràng buộc entitlement vào cấu phần combo đang bán, giữ các FK đơn lẻ. Kiểm tra sự khớp của combo thực hiện lúc báo giá; snapshot được dùng lúc cấp quyền.
- Voucher video/combo dùng phạm vi riêng; `productIds: []` nghĩa là mọi gói của loại đó, không có scope nghĩa là không áp dụng. API này không thay `applicable_packages`/`applicable_tiers` của voucher cũ. UI ngày 3 phải xử lý rõ mã chỉ dành cho video và phạm vi legacy, tránh tạo một voucher legacy không giới hạn rồi gọi đó là mã video-only.

Không tự tính bù tiền khi đã có VIP rồi mua combo. Việc bảo toàn VIP profile cũ được kiểm tra tại lúc cấp combo; cần thử thêm dữ liệu legacy thật ở staging trước phát hành.

## 3. API bàn giao cho ngày 3

Base: `/api/video-commerce/payments`. Tất cả yêu cầu đăng nhập, response có `Cache-Control: no-store`.

| Method | Path | Chức năng |
| --- | --- | --- |
| POST | `/quote` | Báo giá hiện hành, snapshot, `quoteHash`, `salesEnabled` |
| POST | `/orders` | Tạo/mở lại đơn bằng selection + quoteHash + idempotencyKey |
| GET | `/orders?page=1&limit=20` | Lịch sử của người dùng; limit tối đa 100 |
| GET | `/orders/:orderId` | Trạng thái; đối soát với provider, thử lại cấp quyền/email |
| POST | `/orders/:orderId/cancel` | Hủy khi chưa nhận tiền và provider xác nhận |
| GET/PUT | `/admin/coupons/:id/scopes` | Đọc/thay phạm vi video/combo; yêu cầu `users.manage` |
| PATCH | `/admin/products/:type/:id/config` | Cấu hình renewalMode/subjectPrices; yêu cầu `users.manage` |

Ví dụ payload quote:

```json
{
  "type": "video",
  "productId": 1,
  "selectedSubjectCode": "MATH",
  "couponCode": "EXAMPLE",
  "useCoins": true,
  "paymentMethod": "bank_transfer"
}
```

Chỉ gửi `selectedSubjectCode` khi gói bắt buộc chọn môn. Tạo đơn gửi lại cùng selection, thêm `quoteHash` từ báo giá và key ổn định dài 8-120 ký tự gồm chữ/số/`_`/`-`. Khi timeout, giữ nguyên key và quote để mở lại; chỉ tạo key mới cho một ý định mua mới. Nếu báo `QUOTE_CHANGED`, hiển thị báo giá mới để người mua xem lại.

Response thành công theo `{ "success": true, "data": ... }`. Lỗi nghiệp vụ có `code`, `message` và HTTP status. DTO tại `frontend/lib/types/videoPayments.ts`; client tại `frontend/lib/api/videoPayments.ts`.

Trạng thái mới cần UI riêng:

| Status | Hiển thị/ứng xử |
| --- | --- |
| `pending` / `processing` | Chờ thanh toán/xử lý; mở lại đúng đơn |
| `completed` | Đã cấp quyền; hiển thị từng thành phần và hạn |
| `awaiting_fulfillment` | Đã xác minh tiền, chưa cấp đủ quyền; không yêu cầu trả tiền lần nữa |
| `payment_review` | Đã ghi nhận một phần tiền; cần đối soát |
| `cancelled` / `expired` | Đã có xác nhận đóng đơn; vẫn tiếp nhận sự kiện thanh toán muộn |

`reconciliationPending: true` cho biết provider đang không xác minh được. Không đổi thành thất bại chỉ vì mạng lỗi. QR có thể NULL khi khôi phục link; dùng `checkoutUrl` nếu có. Đích return/cancel dự kiến `/thanh-toan-khoa-hoc?orderId=...`, trang này sẽ làm ngày 3.

## 4. Migration và vận hành

Migration mới: `database/migrations/068_video_commerce_payments.sql`, chạy sau 067 và các prerequisite VIP, coupon, coin ledger. Thêm bảng order/scope/outbox/audit và cột cấu hình. Thay đúng constraint cũ `transactions.amount > 0` bằng nonnegative check để hỗ trợ đơn miễn phí; không rewrite giao dịch cũ.

Script yêu cầu chỉ định database rõ ràng bằng `VIDEO_COMMERCE_DATABASE_URL`, không tự lấy môi trường production. Từ thư mục `backend`:

```text
node scripts/apply_video_commerce_migration.js --check
node scripts/apply_video_payment_migration.js --apply
node scripts/apply_video_payment_migration.js --check
```

Phải áp dụng 067 trước nếu chưa có. Kiểm tra `--check` của 068 hiện xác nhận sự hiện diện bốn bảng mới; không thay thế kiểm kê toàn bộ schema staging/production.

Switch mặc định trong `.env.example`:

```text
CSCA_VIDEO_COMMERCE_ENABLED=false
CSCA_VIDEO_COMMERCE_SALES_ENABLED=false
```

Module được mount trong cờ courses hiện có. Giữ SALES=false trong giai đoạn chuẩn bị; catalog foundation vẫn trả `canPurchase:false` và API ngày 1 chỉ quản lý draft. Chỉ mở bán sau UI, publish/configuration, playback và thử nghiệm thật. Khi đã có đơn mới, tạm ngừng bán bằng SALES=false và giữ module hoạt động để đối soát/reservation giữa các luồng tiếp tục nhất quán.

Tác vụ bảo trì thủ công, chỉ với database và credential đã cấu hình rõ:

```text
node scripts/reconcile_video_payments.js --run
```

Mỗi lượt tối đa 25 đơn mặc định, có `last_checked_at` để đơn lỗi lâu không chặn đơn phía sau. Script không tạo đơn mới. Chưa gắn scheduler hoặc chạy script trên hệ thống thật; cần hoàn tất trước mở bán.

## 5. Hồi quy gói hiện tại

Giữ file baseline ngày 1 tại commit `20a04a5a144565a9accda038e0a7345a5118b67e`, không cập nhật hash để che thay đổi. `check_video_commerce_baseline.js --day2` báo:

- 14/18 file trong baseline không đổi; toàn bộ 6 trang frontend trong baseline không đổi.
- 4 file backend mở rộng có chủ đích: payments dispatcher/reservation, Transaction thêm loại sản phẩm trong history, coinService giữ chỗ đơn mới và Risk Center phân luồng.
- Không có thay đổi ngoài danh sách cho phép trong 18 file này. Script chỉ so sánh mã nguồn, không chứng minh toàn bộ hành vi hoặc UI render.
- Ngoài baseline, index mount module, email thêm phương thức mới, package/scripts/env cập nhật phục vụ tính năng.

Test router thật với dependency giả lập kiểm tra chữ ký lỗi, dispatch video, lỗi DB để provider retry, giữ đường legacy claim và hoàn tất VIP/xu cũ, polling/return theo chủ đơn, chặn MoMo/VNPay cho đơn mới và chặn grant/revoke legacy trên video.

## 6. Kiểm thử

Từ `backend`:

```text
npm run test:video-commerce
npm run test:video-payments
node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/services/__tests__/videoPaymentDispatch.spec.js src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
node --test test/courseHls.test.cjs ../tools/video/test/publish.test.mjs ../workers/video-gateway/test/gateway.test.mjs test/deviceSessionIdentity.test.cjs test/authSessionStorage.test.cjs
node scripts/check_video_commerce_baseline.js --day2
```

Từ `frontend`: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

Kết quả: 25 test nền ngày 1, 44 test payment/gateway, 18 test Jest (8 dispatch + 10 course cũ), 26 test HLS/auth đều qua; TypeScript và kiểm tra cú pháp/diff qua. Tổng 113 test. Các log signature bị từ chối/DB unavailable trong Jest là tình huống lỗi được chủ động giả lập.

Test DB dùng PGlite trong bộ nhớ với schema prerequisite tối thiểu. Các lời gọi đồng thời và replay đã được kiểm tra, nhưng PGlite tuần tự hóa transaction: chưa chứng minh tranh chấp trên PostgreSQL nhiều connection/worker thật. Cần chạy lại trên staging trước phát hành.

## 7. Giới hạn và công việc tiếp theo

1. Chưa gọi payOS thật hoặc xác nhận kênh production đang bật. MoMo/VNPay chưa được hỗ trợ cho sản phẩm mới. Cần thử thanh toán, webhook, timeout và hủy thật ở staging.
2. Nếu provider lỗi sau lúc tạo link, hệ thống giữ reservation và retry cùng order code. Trường hợp không xác minh được link và đã quá hạn vẫn yêu cầu đối soát; chưa tự coi lỗi GET là bằng chứng chưa nhận tiền.
3. Thanh toán thiếu giữ ở review. Số tiền vượt giá đơn bị từ chối do không khớp; chưa có luồng tự xử lý tiền dư/hoàn tiền. Cần quy trình đối soát thủ công trước mở bán.
4. Email có retry/lease, không bảo đảm gửi đúng một lần tuyệt đối: crash sau khi dịch vụ email nhận thư nhưng trước lúc ghi `sent` có thể gửi lại.
5. Ngày 3 còn UI mua/admin, publish gói, cấp/thu hồi theo nguồn, voucher video-only, phân loại báo cáo và hiển thị lỗi thân thiện. Các API cấu hình ngày 2 là nền cho UI đó.
6. Ngày 4 còn nối quyền vào khóa/bài, upload/phát Bunny và tiến độ. Người dùng chưa có Bunny Library; không cần gửi secret vào chat.
7. Ngày 5 cần staging đầy đủ, kiểm thử nhiều connection, dữ liệu legacy đại diện và kiểm thử luồng bằng trình duyệt trước khi bật bán.
