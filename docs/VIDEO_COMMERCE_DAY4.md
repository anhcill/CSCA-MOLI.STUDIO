# Ngày 4: quyền học và Bunny Stream

Ngày: 13/10/2026. Triển khai cục bộ, chưa push/deploy hoặc bật bán. Bunny Library chưa có; phần video thật và thiết bị thật chưa nghiệm thu.

## Phần đã triển khai

- Quyền video/combo kiểm tra snapshot khóa, môn, người dùng, thời điểm bắt đầu, hết hạn và thu hồi. Quyền legacy vẫn là nguồn hợp lệ độc lập.
- Danh sách học tự tạo enrollment cho khóa có quyền video; khôi phục enrollment hết hạn mà giữ tiến độ. Enrollment bị admin thu hồi không được tự khôi phục. Mỗi API bài học, progress và phiên phát kiểm tra lại quyền.
- Sửa danh sách học bỏ sót quyền theo gói VIP hiện có. Gói video không làm thay đổi tier/VIP người dùng.
- Migration 070 thêm nguồn enrollment `video` và metadata provider trên asset, mặc định asset cũ là R2. Không chuyển kho video cũ.
- API Bunny có xác thực và scope khóa cho người quản trị/giáo viên. Tạo allocation local trước gọi provider, gắn vào bài để refresh khôi phục được. Tạo lại cùng bài dùng asset đã có. Nếu kết quả tạo remote không xác định, giữ allocation và cho khôi phục bằng GUID/tên khớp; không tự tạo thêm video remote.
- Upload trực tiếp Bunny bằng TUS, chunk 8 MiB, retry và resume. UI chọn lại cùng tệp, SHA-256 làm fingerprint, hỗ trợ tối đa 20 GiB. Server chỉ trả chữ ký upload ngắn hạn, không trả API key.
- Đồng bộ chủ động từ API Bunny trong transaction: trạng thái ready chỉ khi encoding hoàn tất và có duration hợp lệ. Callback không được dùng làm nguồn tin cậy. Lưu thumbnail filename, không xuất link thumbnail công khai. Polling admin khi processing; có nút kiểm tra sau reload hoặc timeout.
- Phiên phát kiểm tra asset thực sự thuộc bài/khóa, provider/library đúng và ready, rồi ký embed URL 5 phút. Iframe Player.js theo dõi tiến độ, khôi phục vị trí, gia hạn và thử lại. Message phải đúng origin và đúng iframe; tua xa không cộng thời gian xem. Backend vẫn quyết định hoàn thành ở ngưỡng 85% thời gian xem.
- Chặn form admin ghi đè duration đã xác minh bằng số cũ; kiểm tra xuất bản chấp nhận Bunny ready hoặc HLS cũ hợp lệ.
- R2 không tự xóa asset sau timeout upload/complete. Giữ metadata session để kiểm tra lại; mở lại bài khôi phục trạng thái processing. Chặn endpoint R2 xóa/finalize asset Bunny.
- Sửa HLS gắn listener progress sau retry đầu tiên; giữ vị trí và trạng thái đang phát khi thay phiên. Thêm nguồn Bunny vào component CSP sẵn có.

## Cấu hình và vận hành

Áp dụng prerequisite courses/media và migration 067-069 trước 070. Từ `backend`, với `VIDEO_COMMERCE_DATABASE_URL` chỉ định database thử rõ ràng:

```text
node scripts/apply_bunny_learning_migration.js --apply
node scripts/apply_bunny_learning_migration.js --check
```

`--check` xác nhận các cột mới và constraint nguồn enrollment, không thay thế kiểm kê schema thật. Chưa chạy lệnh apply trên database ngoài bộ kiểm thử.

Backend cần `CSCA_VIDEO_COMMERCE_ENABLED=true` để đọc quyền mới; `CSCA_BUNNY_STREAM_ENABLED=true` để mount quản trị Bunny và phát asset Bunny. Cần `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY` trên server. Frontend bật `NEXT_PUBLIC_BUNNY_STREAM_ENABLED=true` để hiện lựa chọn upload Bunny. Mặc định các cờ mới tắt; SALES tiếp tục false.

Trong admin khóa: tạo bài video trước, chọn Bunny Stream rồi tải tệp. Sau gián đoạn, mở lại bài, kiểm tra trạng thái và chọn lại cùng tệp để tải tiếp. Nếu mất phản hồi tạo video, lấy GUID từ video có tên `lesson-<lessonId>-<assetExternalKey>` trong Library và dùng form khôi phục. Không xóa allocation để thử tạo lại khi chưa đối soát remote.

Luồng này không cung cấp xóa video remote Bunny. Muốn thay video đã phát hành cần quy trình quản lý/đối soát riêng; không dùng nút xóa R2 cho asset Bunny. Không có background polling Bunny khi admin đóng trang; mở lại và bấm kiểm tra sẽ lấy trạng thái hiện tại.

## Kiểm thử và giới hạn

Các lệnh từ `backend`:

```text
node --test test/bunnyLearning.test.cjs
node --test test/courseHls.test.cjs test/bunnyStreamAdapter.test.cjs test/videoCommerceFoundation.test.cjs
node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
```

Frontend: `node node_modules/typescript/bin/tsc --noEmit --incremental false`. Baseline: `node backend/scripts/check_video_commerce_baseline.js --day4`. Hai runner `tools/video/test/bunny-player-ui.mjs` và `tools/video/test/bunny-upload-ui.mjs` chạy với Next local và API/iframe/TUS giả lập; cấu hình Playwright/Chrome giống runner ngày 3. Runner upload cần bật cờ frontend Bunny ở dev server.

Bộ tích hợp mới dùng PGlite với migration courses/media thật và prerequisite tối thiểu; kiểm tra migration lặp, quyền/ngày hết hạn/thu hồi, giữ tiến độ, scope, replay upload, readiness, duration, signed URL, seek và allocation mơ hồ. Không phải thử tranh chấp nhiều connection PostgreSQL. Baseline giữ nguyên 5 trang gói/checkout/admin VIP; mở rộng courseService có chủ đích, không đổi hash baseline.

Kết quả: 14 test tích hợp mới, 30 test nền/Bunny/HLS và 10 test Jest course đều đạt (54 test backend chạy trong ngày 4). TypeScript, kiểm tra cú pháp 47 file backend và diff check đạt. Browser player đạt 8 kiểm tra: lỗi lần đầu/thử lại, resume, lưu thời gian xem, tua không cộng thời gian, mobile không tràn, gia hạn lúc pause giữ vị trí/trạng thái, gia hạn lúc play tiếp tục phát và gia hạn bị từ chối thì dừng phát.

Browser upload dùng TUS client thật với HTTP provider giả lập: giữ chunk 8 MiB khi mất mạng, reload tìm lại provider, resume đúng offset bằng cùng tệp, chỉ tạo một allocation và hiện ready/duration. Kiểm tra mobile không tràn và xem ảnh player/upload. Không có pageerror trong hai runner. Đây không phải bằng chứng phát hoặc upload Bunny thật. Dev server đã được khởi động lại sau khi cài `tus-js-client` theo package-lock; không cập nhật phiên bản Next trong manifest/lock.

Embed token bảo vệ khởi tạo iframe; cần bật token authentication và hạn chế domain/direct play phù hợp trong Bunny Library thật. Chưa chứng minh việc chặn link media trực tiếp hoặc dừng stream đã tải sau khi token hết hạn. App kiểm tra lại khi gia hạn, dừng UI khi gia hạn bị từ chối; đây không phải DRM hay chống quay màn hình.

Watch progress vẫn dựa trên báo cáo client với delta giới hạn, không phải bằng chứng chống giả mạo. Seek thông thường không cộng thời gian xem; request do người dùng tự dựng hoặc gửi lại có thể tác động counter như cơ chế cũ.

Chưa thử TUS với tệp thật lớn, Safari/iPhone/Android thật, Player.js thật của Bunny, email/payment thật hoặc production build. Trước mở bán cần thử upload ngắt mạng/resume, chuyển bài, pause/gia hạn, thu hồi quyền, domain/token/direct-play, tiến độ reload trên staging và nhập khóa đầu tiên. Giá/thời hạn vẫn do admin quyết định sau.
