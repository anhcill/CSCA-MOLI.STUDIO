# Ngày 5: hồi quy và bàn giao

Ngày: 14/10/2026. Phạm vi: phần làm được cục bộ khi chưa có Bunny Library hoặc môi trường thanh toán thử. Chưa commit/push/deploy, chạy migration ngoài test hoặc bật bán.

## Diễn tập xuyên suốt

Mở rộng `backend/test/bunnyLearning.test.cjs` để chạy commerce và learning trên cùng PGlite, với schema course/media thật và prerequisite VIP/thanh toán tối thiểu. Diễn tập gọi service thật, không thay quyền học bằng mock:

1. Áp dụng migration commerce/payment/admin/Bunny, tạo gói video và combo qua service admin.
2. Admin tạo voucher video 100%; checkout tạo đơn 0 đồng, không gọi cổng, cấp video mà không cấp VIP.
3. Học viên vào đúng khóa và nhận phiên phát Bunny có chữ ký từ asset thuộc bài, đã ready qua provider giả lập.
4. Checkout combo dùng xu, nhận bằng chứng payOS giả lập rồi phát lại cùng callback; chỉ một quyền video và một bút toán xu. Profile có VIP và phiên học hoạt động.
5. Lưu tiến độ, cấp thêm video thủ công; thu hồi nguồn combo chỉ gỡ VIP của combo, nguồn video độc lập vẫn học được.
6. Thu hồi nguồn cuối chặn phiên phát, giữ nguyên vị trí học. Đối chiếu doanh thu combo và lượt dùng voucher; cấp tay không tăng doanh thu.

Đây là diễn tập tích hợp service/database giả lập, không phải giao dịch payOS hoặc phát video Bunny thật. Chưa chứng minh tranh chấp nhiều connection PostgreSQL.

## Kết quả backend

144 test riêng biệt đạt: 123 test Node trong lượt hồi quy tổng, 20 Jest và 1 diễn tập mới. Sau bổ sung diễn tập đã chạy lại file learning/Bunny, cả 15 test trong file đạt; không cộng 14 test chạy lại vào tổng.

| Nhóm | Số test | Kết quả |
| --- | ---: | --- |
| Nền commerce + adapter Bunny | 25 | Đạt |
| Payment + payOS gateway | 58 | Đạt |
| Learning/Bunny + diễn tập ngày 5 | 15 | Đạt |
| HLS/publisher/gateway/auth/device | 26 | Đạt |
| Jest dispatch/coupon/course | 20 | Đạt |

Các nhánh lỗi chữ ký, DB unavailable, callback lặp, timeout và từ chối quyền là tình huống chủ động trong test. Không đọc database production hoặc gửi email thật.

## Hồi quy và phát hành

Build production `next build --webpack` đạt với Next 16.2.9: biên dịch, TypeScript và tạo 156/156 trang tĩnh hoàn tất. Các route video/admin/checkout mới xuất hiện trong kết quả build. Có cảnh báo dữ liệu Browserslist cũ và Cache-Control hiện có, không có lỗi build. Kết quả này xác nhận Webpack; chưa chạy build production bằng Turbopack.

Cả ba runner trình duyệt đạt trên bản production local (`next start`, port 8130): commerce 9 nhóm kiểm tra; player 8 nhóm; upload 5 nhóm cùng assertion mobile không tràn. Kiểm thử bao gồm checkout mất mạng/reload giữ request, admin bản nháp/cấp/thu hồi/voucher/banner, phát lỗi rồi thử lại/lưu tiến độ/gia hạn khi pause hoặc play, và TUS ngắt mạng/resume cùng asset. API, iframe và provider TUS vẫn giả lập. Lượt chạy player đầu timeout lúc bấm Thử lại; chạy riêng lại đạt mà không sửa code sản phẩm, chưa xác định nguyên nhân timeout. Runner đã bổ sung thông tin lỗi và ảnh khi thất bại để điều tra nếu tái hiện.

`git diff --check` đạt. Ngày 5 chỉ bổ sung diễn tập, chẩn đoán runner và tài liệu; không thay UI/logic gói VIP hiện có. Các log chạy cục bộ (git-ignored) là `video-day5-node.log`, `video-day5-jest.log`, `video-day5-rehearsal.log`, `video-day5-build.log`, `video-day5-browser.log`, `video-day5-player.log`, `video-day5-upload.log`.

`check_video_commerce_baseline.js --day4` kiểm tra 18 file baseline gốc, 12 file không đổi và 6 thay đổi đúng allowlist. Năm trang VIP/checkout/success/admin VIP/admin coupon cũ giữ nguyên mã nguồn. Không cập nhật baseline để che thay đổi; đây là so sánh source, không phải nghiệm thu hình ảnh legacy với dữ liệu thật.

Đã bàn giao hướng dẫn tại `docs/VIDEO_COMMERCE_RELEASE_CHECKLIST.md`: cấu hình cần chuẩn bị, thứ tự migration, các bước admin, xử lý đơn/upload lỗi, ma trận nghiệm thu thật và cách dừng bán/khôi phục.

## Điều kiện còn thiếu trước mở bán

- Bunny Library và video mẫu thật; bật token/domain/direct-play, kiểm tra iframe/media URL và hành vi khi quyền hết hạn/thu hồi.
- Database staging và kênh payOS được phép thử; webhook, đối soát, số tiền khác đơn, cấp quyền sau DB lỗi và tranh chấp xu/voucher nhiều connection.
- Email thật và lịch chạy tác vụ đối soát/outbox, người xử lý đơn review.
- Giá/thời hạn/chính sách mua lại do admin chốt; nhập khóa đầu tiên và đối chiếu số bài/thời lượng.
- Thiết bị Android/iPhone/Safari thật, tệp upload lớn, ngắt mạng/resume và tiến độ reload.

Chưa coi toàn bộ kế hoạch đã nghiệm thu thực tế. SALES tiếp tục mặc định false. Các giới hạn ngày 2/4 vẫn áp dụng: chưa tự hoàn tiền, chưa xóa remote Bunny qua UI, email có thể gửi lặp sau crash, tiến độ client không phải chống gian lận/DRM.

## Chạy lại kiểm thử cục bộ

Từ `backend`:

```text
node --test test/videoCommerceFoundation.test.cjs test/bunnyStreamAdapter.test.cjs test/videoPayments.test.cjs test/videoPayosGateway.test.cjs test/bunnyLearning.test.cjs test/courseHls.test.cjs ../tools/video/test/publish.test.mjs ../workers/video-gateway/test/gateway.test.mjs test/deviceSessionIdentity.test.cjs test/authSessionStorage.test.cjs
node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/services/__tests__/videoCouponCompatibility.spec.js src/services/__tests__/videoPaymentDispatch.spec.js src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
```

Từ `frontend`, build với `NEXT_PUBLIC_BUNNY_STREAM_ENABLED=true` cho kiểm thử upload:

```text
node node_modules/next/dist/bin/next build --webpack
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 8130
```

Từ root, cấu hình module Playwright/Chrome bằng `VIDEO_UI_PLAYWRIGHT_MODULE` và `VIDEO_UI_BROWSER_PATH` nếu cần. Mọi request API/provider trong các runner đều giả lập:

```text
node tools/video/test/commerce-ui.mjs
node tools/video/test/bunny-player-ui.mjs
node tools/video/test/bunny-upload-ui.mjs
node backend/scripts/check_video_commerce_baseline.js --day4
git diff --check
```
