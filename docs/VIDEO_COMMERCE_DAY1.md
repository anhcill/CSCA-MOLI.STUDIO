# Ngày 1: nền gói video/combo và chuẩn bị Bunny

Ngày thực hiện: 12/10/2026. Baseline: `20a04a5a144565a9accda038e0a7345a5118b67e`.

## 1. Điều chỉnh đã được người dùng xác nhận

- Giá và thời hạn để admin thiết lập sau, không chặn tiến độ ngày 1.
- Chưa có tài khoản/Library Bunny: chuẩn bị code, không tạo tài khoản hoặc thử video thật trong lượt này.
- Giữ nguyên logic và UI gói hiện tại. Chỉ bổ sung nền cho video/combo.

Phạm vi hoàn thành của ngày 1: migration, repository/service, API quản trị bản nháp, kiểu dữ liệu frontend, chính sách kiểm tra quyền video độc lập, adapter Bunny, kiểm thử và wireframe tương tác. Chưa mở bán, chưa nối quyền mới vào player hoặc webhook thanh toán thật.

## 2. Quyết định kỹ thuật đã thực hiện

### Giá và thời hạn chưa cấu hình

- `price_vnd = NULL` có nghĩa chưa cấu hình; `0` là giá 0 đồng được đặt rõ ràng.
- `duration_mode = unconfigured` có nghĩa chưa chọn thời hạn; không đồng nghĩa học vĩnh viễn.
- `duration_mode = days` yêu cầu `duration_days > 0`.
- `duration_mode = lifetime` là lựa chọn không giới hạn được đặt rõ ràng, `duration_days = NULL`.
- Bản nháp chỉ cần tên, các thông tin khác có thể bổ sung dần.
- API ngày 1 chỉ tạo/sửa bản nháp; không có thao tác mở bán hoặc cấp quyền.
- `canPurchase` và `checkoutAvailable` luôn là `false` trong API nền này, kể cả đã nhập đủ giá/thời hạn.
- Khi triển khai giao diện admin ngày 3, dùng cùng API và bổ sung bước kiểm tra mở bán; không phải sửa mã nguồn mỗi lần đổi giá.

### Dữ liệu tách biệt

Migration `067_video_commerce_foundation.sql` chỉ tạo 6 bảng và index mới:

| Bảng | Vai trò |
| --- | --- |
| `video_packages` | Gói video độc lập, hỗ trợ bản nháp chưa có giá/thời hạn |
| `video_package_courses` | Danh sách khóa thuộc gói video |
| `combo_packages` | Combo tham chiếu gói VIP hiện tại và gói video; giá riêng |
| `user_video_entitlements` | Quyền video theo người, thời gian, môn, đơn/nguồn cấp |
| `video_entitlement_courses` | Danh sách khóa chụp lại theo lần cấp quyền |
| `video_commerce_audit` | Ghi người tạo/sửa và trước/sau của bản nháp |

Không thay bảng `users`, `vip_packages`, `transactions`, course/enrollment, mapping quyền gói cũ hoặc video asset cũ. Schema đơn hàng/snapshot thanh toán, voucher và trạng thái cấp combo được bổ sung ngày 2 khi tích hợp luồng thanh toán; provider metadata được nối vào asset ngày 4. Cách chia này giảm phạm vi thay đổi khi chưa bật chức năng.

Danh sách khóa trong quyền dùng snapshot để sửa danh mục không làm mất khóa đã mua. Việc tự bổ sung khóa mới cho khách đang có gói sẽ được quyết định riêng; ngày 1 chưa tự áp quy tắc cấp thêm.

### Quyền video

- Bộ kiểm tra yêu cầu đúng user, course, subject, thời điểm bắt đầu, thời điểm hết hạn và trạng thái.
- Quyền dạng ngày bị thiếu ngày hết hạn bị từ chối; lifetime phải được đánh dấu rõ.
- Mua/cấp video không sửa hồ sơ VIP. Cấu trúc combo tham chiếu đúng hai thành phần, không nhân bản hoặc sửa gói cũ.
- Một nguồn bị thu hồi không hủy nguồn khác còn hiệu lực.
- Khóa phải published trong service kiểm tra quyền mới; khóa draft bị từ chối.
- Có khóa duy nhất theo `grant_key`; có khóa ngoại ngăn entitlement combo trỏ sang gói video khác.
- Service mới chưa được dùng trong luồng học hiện hành. Bộ quyền legacy giữ nguyên cho đến bước tích hợp có kiểm thử ngày 4.
- Ngày 1 chưa cấp combo, chưa thực hiện gia hạn/mua lại; các quy tắc này không bị quyết định ngầm bởi dữ liệu mẫu.

## 3. API contract đã có

Base path: `/api/video-commerce`.

Chỉ mount khi `CSCA_COURSES_ENABLED` đang bật và `CSCA_VIDEO_COMMERCE_ENABLED=true`. Cờ mới mặc định false. Khi tắt, server không khởi tạo repository mới hoặc truy vấn bảng mới. Không tự chạy migration khi khởi động server.

| Method | Path | Quyền | Hành vi ngày 1 |
| --- | --- | --- | --- |
| GET | `/catalog/:type` | Public | Danh sách active; không lộ draft; chưa thể mua |
| GET | `/admin/:type` | Đăng nhập + `users.manage` | Liệt kê các gói theo trạng thái |
| POST | `/admin/:type` | Đăng nhập + `users.manage` | Tạo bản nháp; lưu audit cùng transaction |
| PATCH | `/admin/:type/:id` | Đăng nhập + `users.manage` | Sửa các trường gửi lên; giữ trường không gửi; khóa dòng khi cập nhật |

`:type` nhận `video` hoặc `combo`. Danh sách hỗ trợ `page` từ 1, `limit` mặc định 20 và tối đa 100. Admin có thể lọc `status=draft|active|archived`. Public luôn lọc active bất kể status do client gửi. Phân trang trả `hasMore`.

Tạo video draft:

```json
{
  "name": "Video Tự Nhiên",
  "allowedSubjects": ["MATH", "PHYSICS", "CHEMISTRY"],
  "courseIds": [1],
  "priceVnd": null,
  "durationMode": "unconfigured",
  "durationDays": null
}
```

ID trên chỉ minh họa, phải thay bằng khóa thực tế trong môi trường dùng thử. Môn của khóa đã gắn phải thuộc `allowedSubjects` khi danh sách môn đã được cấu hình.

Tạo combo draft:

```json
{
  "name": "Combo Tự Nhiên",
  "vipPackageId": 1,
  "videoPackageId": 1,
  "priceVnd": null,
  "vipDurationDays": null
}
```

Body cập nhật có thể chỉ chứa trường cần đổi. Ví dụ kỹ thuật dưới đây dùng số liệu thử, không phải giá bán đã chốt:

```json
{ "priceVnd": 100000, "durationMode": "days", "durationDays": 90 }
```

Response theo envelope hiện có: `{ "success": true, "data": ... }`. DTO dùng camelCase, có `type`, `status`, `configurationIssues` và `canPurchase`. `configurationIssues` phản ánh thông tin thiếu của chính bản ghi; chưa thay thế bước kiểm tra toàn bộ gói liên kết khi mở bán ở ngày 2-3.

Lỗi chính:

| Code | HTTP | Ý nghĩa |
| --- | --- | --- |
| `VIDEO_COMMERCE_INVALID_ID/TYPE/FIELD` | 422 | Tham số sai |
| `VIDEO_COMMERCE_INVALID_DURATION/SUBJECT` | 422 | Thời hạn hoặc môn không hợp lệ |
| `VIDEO_COMMERCE_COURSE_NOT_FOUND` | 422 | Khóa được chọn không tồn tại |
| `VIDEO_COMMERCE_COURSE_SUBJECT_MISMATCH` | 422 | Khóa không thuộc nhóm môn đã khai báo |
| `VIDEO_COMMERCE_VIP_PACKAGE_NOT_FOUND/VIDEO_PACKAGE_NOT_FOUND` | 422 | Gói thành phần không tồn tại |
| `VIDEO_COMMERCE_NOT_FOUND` | 404 | Không tìm thấy bản nháp cần sửa |
| `VIDEO_COMMERCE_DRAFT_ONLY` | 422/409 | Gửi trạng thái publish hoặc cố sửa sản phẩm đã active/archived |

Thanh toán, báo giá có voucher/xu, cấp/thu hồi quyền, webhook, lịch sử và thống kê mới chưa có endpoint trong ngày 1. Không gọi API thanh toán VIP để mua một ID gói video.

## 4. Kiểm kê tương đương chức năng và phần việc còn lại

Đây là kiểm kê từ mã nguồn, không xác nhận các cổng/khuyến mãi đang bật ở production.

| Chức năng hiện có | Nguồn chính | Video/combo | Mốc |
| --- | --- | --- | --- |
| Danh mục, giá gốc, ghi chú, thứ tự, bật/tắt gói | `vipPackageController`, admin VIP | Nền draft đã có; UI/đầy đủ trường hiển thị và publish làm tiếp | Ngày 3 |
| Chọn môn, giá theo môn | `vipEntitlements`, payments, checkout | Nền môn đã có; báo giá/mapping combo phải kiểm tra lại từng môn | Ngày 2 |
| Bảng so sánh quyền lợi | `/vip/comparison`, admin VIP | Bổ sung nội dung tương đương cho danh mục mới; bảng cũ giữ nguyên | Ngày 3 |
| Chuyển khoản/QR payOS | payments, checkout | Cổng đang được UI cũ hiển thị; thêm phân loại và dispatcher mới | Ngày 2 |
| MoMo/VNPay | payments | Có nhánh backend; chưa chứng minh đang bật thật; phải giữ an toàn khi nhận đơn mới | Ngày 2 |
| Tạo/mở lại đơn chờ, idempotency, polling, verify return | payments, Transaction | Mở rộng theo loại đơn, không nhập nhằng package ID | Ngày 2 |
| Voucher phần trăm/số tiền, giới hạn, thời hạn, gói/tier | coupon controllers | Phạm vi video/combo riêng; mã cũ không tự mở rộng | Ngày 2-3 |
| API validate và apply voucher | couponRoutes | Rà cả hai; không bỏ sót đường tiêu thụ lượt mã ngoài create payment | Ngày 2 |
| Banner khuyến mãi/CTA/lịch sử dùng mã/thống kê mã | adminCouponController, admin coupons | Thêm phạm vi mới và vị trí trang mới | Ngày 3 |
| Xu, số dư, giữ chỗ đơn chờ, ledger | coinService, payments | Dùng chung ví; chống tiêu trùng giữa checkout cũ và mới | Ngày 2 |
| Đơn giảm còn 0 đồng | completeZeroAmountTransaction | Dùng chung dịch vụ cấp quyền mới, không tự cấp VIP | Ngày 2 |
| Xác minh webhook và đối soát | payments | Phân loại toàn bộ đường hoàn tất, kể cả fallback | Ngày 2 |
| Cấp thủ công theo gói hoặc số ngày/tier | adminVipController | Cấp video/combo, hạn tùy chỉnh, audit và chống lặp | Ngày 3 |
| Thu hồi và đăng xuất phiên | adminVipController | Giữ hành vi VIP cũ; thao tác mới theo nguồn quyền rõ ràng | Ngày 3 |
| Lịch sử người mua/đơn admin/tìm kiếm/phân trang | Transaction, admin VIP | Thêm loại sản phẩm; tránh inner join VIP làm mất đơn video | Ngày 2-3 |
| Thống kê doanh thu/học viên/trạng thái | adminVipController | Một combo tính doanh thu một lần; cấp tay không tạo doanh thu giả | Ngày 3 |
| Email xác nhận thanh toán/kích hoạt | emailService, payments/admin VIP | Nội dung video/combo; gửi sau commit | Ngày 2-3 |
| Risk center: đối soát, cấp VIP/xu và thu hồi xu thủ công | paymentRiskActionsController, adminRiskCenterRoutes | Bắt buộc nhận biết loại đơn; không dùng nút cấp VIP cho đơn video-only | Ngày 2-3 |
| Quản trị theo role/permission và nhật ký | authMiddleware, UserActivity | API draft đã dùng users.manage và audit transaction; mở rộng thao tác sau | Ngày 1-3 |
| Khóa của tôi/enrollment/tiến độ/quyền theo môn | courseService, courseRepository | Bộ policy mới đã có test; tích hợp thực tế và sửa lỗi cũ liên quan sau | Ngày 4 |

Phát hiện cần chú ý ngày 2: `grantVipEntitlement` và `updateVipStatus` không có cùng cách tính hạn; đường cấp thủ công còn cập nhật trực tiếp hồ sơ rồi cấp entitlement. Giữ luồng cũ, không suy luận quy tắc combo/gia hạn từ tên hàm hoặc comment.

## 5. Bunny: code chuẩn bị và bằng chứng tài liệu

Adapter mới: `backend/src/services/bunnyStreamAdapter.js`. Không import vào luồng upload/phát hiện tại, không gọi Bunny khi khởi động ứng dụng.

Đã có:

- Tạo video metadata qua API server, đọc metadata một video đã có; cố định API origin và chặn redirect để không chuyển API key tới host khác.
- Kiểm tra video GUID/library từ response; lỗi provider không trả response body hoặc secret ra ngoài.
- Tạo chữ ký TUS theo library + API key + thời hạn + video GUID; client chỉ nhận chữ ký có hạn.
- Tạo signed embed URL bằng token security key riêng, không dùng nhầm library upload API key.
- Kiểm tra webhook v1 HMAC-SHA256 trên raw body bằng signing key/read-only API key, so sánh constant-time.
- Tool kiểm tra cấu hình chỉ in có/không; tool probe đọc metadata không upload, không xóa, không mua gì.

Tài liệu Bunny chính thức đã đọc ngày 12/10/2026:

- [TUS resumable uploads](https://bunny.net/docs/stream/tus-resumable-uploads)
- [Stream security](https://bunny.net/docs/stream/security)
- [Embed token authentication](https://bunny.net/docs/stream/token-authentication)
- [Player và sự kiện điều khiển](https://bunny.net/docs/stream/player)
- [Signed webhooks](https://bunny.net/docs/stream/webhooks)
- [CDN token authentication](https://bunny.net/docs/cdn/security/token-authentication)

Kết luận spike ở mức code/tài liệu:

1. Có TUS upload hỗ trợ resume, phù hợp video lớn/mạng chậm.
2. Player hỗ trợ play/pause/seek/timeupdate/ended; có thể nối tiến độ, nhưng chưa thử callback trên video thật.
3. Embed token và CDN token là hai lớp khác nhau. Hàm signed embed chưa chứng minh direct HLS/segment đã được bảo vệ.
4. Giữ phương án ưu tiên HLS player hiện tại khi đã kiểm chứng CDN directory-token propagation. Signed iframe là phương án thử nghiệm, chưa thay player đang chạy.
5. Webhook cần raw bytes trước JSON parser. Endpoint sẽ được nối ngày 4 tại vị trí phù hợp trong Express; ngày 1 không đăng ký webhook mới.
6. Signature không chứa timestamp nên không đủ để chống replay theo thời gian. Khi nối callback phải kiểm tra library/asset, chống xử lý lặp và đối soát trạng thái bằng API server.
7. Không coi status "một độ phân giải đã xong" là toàn bộ video đã mã hóa xong; trạng thái publish cần kiểm tra rõ khi tích hợp.

Giới hạn đã thống nhất: chưa có tài khoản/Library, không thực hiện upload/playback thật, chưa đo chi phí/băng thông. Không có secret thật trong source hoặc fixture.

## 6. Wireframe và bảo vệ UI cũ

Mở `docs/video-commerce-day1-wireframe.html` để xem 3 màn hình tương tác: chọn gói video/combo, checkout và admin tạo draft. Chuyển tab/loại gói, chọn gói, chuyển cấu hình thời hạn và lưu bản nháp đều là mô phỏng trên trang, không gửi dữ liệu tới server.

Các mẫu tên/danh mục trong wireframe không phải cấu hình bán chính thức. Trong trang bán thật, draft chưa cấu hình sẽ không hiện cho người mua; trạng thái chưa cấu hình trong wireframe dùng để minh họa yêu cầu của đợt này.

`docs/video-commerce-day1-baseline.json` ghi SHA-256 chuẩn hóa LF của 18 file legacy tại commit baseline. Đã so sánh và chưa file nào trong danh sách bị thay đổi. Đây là baseline mã nguồn, không phải ảnh chụp UI production hoặc dữ liệu khách hàng thật.

Điểm thay ở server hiện tại chỉ là đăng ký module draft bên trong cờ mặc định tắt. Frontend chỉ thêm file type, không đổi trang hoặc component cũ.

## 7. Kiểm thử và cách chạy

Từ `backend`:

```text
npm run test:video-commerce
node scripts/check_video_commerce_baseline.js --check
node scripts/probe_bunny_stream.js --check-config
node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
node --test test/courseHls.test.cjs ../tools/video/test/publish.test.mjs ../workers/video-gateway/test/gateway.test.mjs test/deviceSessionIdentity.test.cjs test/authSessionStorage.test.cjs
```

Từ `frontend`: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

Test migration dùng PGlite (PostgreSQL WebAssembly) trong bộ nhớ, với schema prerequisite tối thiểu và các migration course thực tế 052/053/054/055. Sau đó chạy migration 067 nhiều lần, so sánh record legacy và kiểm tra constraint. Không kết nối database production; đây không phải kiểm tra đầy đủ mọi lịch sử migration đang có trên production.

Các kiểm thử quyền admin ở API dùng middleware giả lập để kiểm tra route có áp authentication/permission đúng thứ tự; middleware xác thực thực tế được tái sử dụng nguyên trạng từ ứng dụng.

| Nhóm | Kết quả |
| --- | --- |
| Nền schema/repository/service/API và adapter Bunny | 25/25 qua |
| Quyền khóa học, admin package mapping và assignments hiện có | 10/10 qua |
| HLS/gateway/upload publisher và đăng nhập/slot/refresh token hiện có | 26/26 qua |
| Baseline source | 18/18 file giữ nguyên |
| TypeScript frontend | `tsc --noEmit --incremental false` qua |
| Wireframe trên browser | Đã thử chọn combo -> checkout đủ hai phần; admin lưu draft khi giá/hạn còn trống |
| Wireframe responsive | Kiểm tra 1280 px và 390 px; catalog/checkout/admin không tràn ngang tại các trạng thái đã thử |
| Bunny live | Chưa chạy, theo yêu cầu chuẩn bị code trước |
| Production DB / giao dịch thật | Không thực hiện trong ngày 1 |

Giới hạn UI: đây là wireframe HTML riêng, không phải kiểm thử toàn bộ ứng dụng trên thiết bị thật. Browser automation chưa hoàn tất thao tác đổi select thời hạn sang số ngày; backend đã kiểm thử cấu hình thời hạn qua API. Chưa có ảnh chụp baseline UI production.

### Áp migration ở môi trường được chọn sau này

Script không tự đọc production `.env`; yêu cầu biến riêng `VIDEO_COMMERCE_DATABASE_URL` trỏ tới database chủ động chọn. Trước tiên thử trên staging/bản dữ liệu đại diện và theo quy trình sao lưu của dự án.

```text
node scripts/apply_video_commerce_migration.js --check
node scripts/apply_video_commerce_migration.js --apply
```

Chỉ bật `CSCA_VIDEO_COMMERCE_ENABLED=true` sau khi schema đã có. Cờ này chỉ mở API draft/catalog trong phiên bản ngày 1; không mở thanh toán, không cấp quyền và không đổi khóa học hiện tại.

### Khi có tài khoản Bunny

Đặt các biến server-only trong `.env` backend/môi trường triển khai: `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_WEBHOOK_SIGNING_KEY`. Không dùng `NEXT_PUBLIC_*`, không gửi secret trong chat hoặc commit.

```text
node scripts/probe_bunny_stream.js --check-config
node scripts/probe_bunny_stream.js --video-id <GUID-video-da-co>
```

Probe thứ hai chỉ đọc metadata; vẫn cần thử upload/resume/playback/progress và cấu hình bảo vệ thật ở bước tích hợp Bunny.

## 8. Bàn giao cho ngày 2

Nền ngày 1 đã chuẩn bị để tiếp tục mà không cần chốt mức giá/thời hạn. Các việc cần làm ngày 2:

1. Thêm snapshot đơn và phân loại video/combo trong sổ giao dịch chung, giữ package ID VIP tương thích.
2. Tạo API báo giá/đơn có voucher/xu theo server; rà cả coupon apply và risk-center repair actions.
3. Tạo fulfillment transaction cho combo: một đơn cấp đủ hai phần và chống trùng callback/retry.
4. Chốt cách xử lý mua trùng/gia hạn ở cấp nghiệp vụ hoặc để cấu hình rõ; không ngầm đổi cách tính hạn gói cũ.
5. Kết nối kênh thanh toán đang dùng và các nhánh đối soát/đơn 0 đồng/email/lịch sử.

Không coi hoàn thành nền ngày 1 là đã có checkout, admin UI hoạt động hoặc video Bunny phát thật. Wireframe là thiết kế; API draft và schema mới là phần đã triển khai.
