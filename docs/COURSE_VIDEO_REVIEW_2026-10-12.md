# Báo cáo kiểm tra video khóa học

Ngày: 12/10/2026. Phạm vi: mã nguồn hiện tại trong workspace, gồm quản trị video, upload nguồn, xử lý HLS, quyền học, player và tiến độ. Đây là báo cáo kiểm tra; chưa sửa mã nguồn video và chưa triển khai thay đổi.

## Kết quả cần xử lý

Có 6 vấn đề: 2 mức P1 (ưu tiên cao) và 4 mức P2 (cần sửa). Các kết luận về cấu hình thời hạn dùng giá trị mặc định trong repository, chưa xác nhận cấu hình production.

### 1. [P1] Khóa học theo gói bị ẩn khỏi “Khóa học của tôi” dù học viên đủ quyền

**Tác động:** Học viên mua gói và đã đăng ký khóa học có thể thấy danh sách học trống, dù mở đường dẫn bài học trực tiếp vẫn được phép.

**Nguyên nhân:** `listMyEnrollments()` gọi `hasEntitlement(user, row, row)` nhưng không truyền quyền gói ở tham số thứ tư. Với khóa `access_type = 'package'`, hàm kiểm tra trả về `Boolean(packageEntitlement)`, luôn là false khi thiếu tham số này. Nhánh vào học trực tiếp có truy vấn quyền gói nên vẫn thành công. Tài khoản admin đi qua nhánh miễn kiểm tra nên có thể không thấy lỗi khi kiểm tra bằng admin.

**Vị trí:** `backend/src/services/learningService.js:93`; `backend/src/services/courseService.js:32`.

**Kiểm chứng:** Chạy service thật với repository giả lập một enrollment và entitlement còn hạn. `requireLearningAccess()` cho phép khóa #12, nhưng `listMyEnrollments()` trả về 0 khóa.

**Đề xuất:** Truy vấn quyền gói cho các khóa trong danh sách, ưu tiên truy vấn theo lô, rồi dùng cùng quy tắc với endpoint vào học. Thêm kiểm thử cho học viên có gói còn hạn và gói hết hạn.

### 2. [P1] Mất bước xử lý/hoàn tất video khi đóng trình chỉnh sửa hoặc tải lại trang

**Tác động:** Video nguồn đã lên kho nhưng vẫn ở trạng thái `processing`; quản trị viên không còn mã xử lý và nút “Kiểm tra và hoàn tất video” để tiếp tục qua giao diện. Giao diện lại yêu cầu xóa video hiện tại trước khi tải khác, dễ dẫn đến tải lại không cần thiết.

**Nguyên nhân:** `stage`, `videoAssetId` và `assetExternalKey` chỉ nằm trong state của `VideoUploadPanel`. Khi component được mở lại, chúng trở về `idle`, null và chuỗi rỗng. Prop `currentVideoAssetId` chỉ giúp hiển thị asset hiện tại và thao tác xóa, không khôi phục trạng thái xử lý. Đóng trình chỉnh sửa thực sự unmount panel.

**Vị trí:** `frontend/components/courses/VideoUploadPanel.tsx:28`; `frontend/components/courses/VideoUploadPanel.tsx:139`; `frontend/app/admin/courses/[courseId]/curriculum/page.tsx:106`.

**Tái hiện:** Upload nguồn thành công, đóng rồi mở lại trình chỉnh sửa bài học, hoặc tải lại trang trước khi finalize HLS.

**Kiểm chứng:** Mô phỏng vòng đời hook trên component thật: mã xử lý tồn tại sau upload; remount với cùng asset #44 làm mất mã và trạng thái finalize. Đây là mô phỏng component, chưa phải kiểm thử trình duyệt thực.

**Đề xuất:** API quản trị trả về trạng thái asset, external key và thông tin đủ để tiếp tục. Panel khôi phục từ dữ liệu máy chủ khi mở lại; cho phép finalize một asset đang processing mà không phải upload lại nguồn.

### 3. [P2] Lưu bài học sau khi finalize có thể ghi đè thời lượng thật về 0

**Tác động:** Video vẫn phát nhưng phần trăm học đứng ở 0%, không đạt điều kiện hoàn thành 85%. Nếu giá trị cũ khác 0, tiến độ vẫn có thể bị tính sai.

**Nguyên nhân:** Finalize HLS ghi thời lượng thực vào `course_lessons.estimated_duration_seconds`. Panel chỉ chuyển sang `ready`, không đồng bộ thời lượng về biểu mẫu cha. `LessonEditor` giữ thời lượng trong state khởi tạo một lần, và “Lưu toàn bộ bài học” gửi lại giá trị cũ. Backend chấp nhận ghi đè, còn tiến độ sử dụng chính trường này làm mẫu số.

**Vị trí:** `frontend/app/admin/courses/[courseId]/curriculum/page.tsx:66`; `frontend/app/admin/courses/[courseId]/curriculum/page.tsx:82`; `frontend/components/courses/VideoUploadPanel.tsx:144`; `backend/src/services/learningService.js:210`.

**Tái hiện:** Bài video mới có thời lượng 0 → upload và finalize → bấm “Lưu toàn bộ bài học” trong biểu mẫu đang mở.

**Kiểm chứng:** Service quản trị chấp nhận đổi thời lượng video từ 1.200 giây về 0. Gửi 60 giây đã xem sau đó vẫn tạo kết quả 0% tiến độ, trong thử nghiệm dùng repository giả lập.

**Đề xuất:** Với video HLS đã sẵn sàng, lấy thời lượng chuẩn từ asset và ngăn biểu mẫu ghi đè tùy ý. Sau finalize cần tải lại và đồng bộ biểu mẫu; chỉ tải lại prop chưa đủ nếu state vẫn giữ giá trị cũ.

### 4. [P2] Video phát được sau “Thử lại” nhưng không lưu tiến độ

**Tác động:** Nếu tạo phiên phát thất bại lúc mở bài, rồi người học bấm “Thử lại” thành công, video có thể phát nhưng không lưu vị trí xem hoặc thời gian đã xem.

**Nguyên nhân:** Effect gắn sự kiện tiến độ và timer 15 giây chạy khi chưa có thẻ video, gặp `if (!video) return`. Effect chỉ phụ thuộc `flushProgress`. Khi retry tạo được phiên và thẻ video xuất hiện, callback này không đổi nên effect không chạy lại. Các effect dựng player và giao diện lại phụ thuộc phiên phát nên vẫn hoạt động.

**Vị trí:** `frontend/components/learning/HlsPlayerShell.tsx:281`; `frontend/components/learning/HlsPlayerShell.tsx:316`.

**Kiểm chứng:** Mô phỏng hook trên component thật: mở player có sẵn phiên tạo 1 timer tiến độ; mở khi chưa có phiên rồi retry thành công có thẻ video nhưng 0 timer tiến độ.

**Đề xuất:** Gắn vòng đời theo phần tử video/phiên hiện tại và bài học. Thêm kiểm thử trường hợp lỗi tạo phiên ban đầu, retry thành công, rồi xem và tải lại bài.

### 5. [P2] Upload nguồn quá thời hạn phiên bị từ chối và có thể bị xóa

**Tác động:** Với mặc định 15 phút, tệp lớn hoặc mạng chậm có thể tải xong nhưng bước hoàn tất bị lỗi. Frontend xử lý lỗi bằng cách gọi xóa toàn bộ asset vừa tạo. Ví dụ 4 GiB ở tốc độ upload 20 Mbps cần khoảng 29 phút, chưa tính overhead.

**Nguyên nhân:** Backend dùng cùng thời hạn upload để quyết định có cho phép gọi complete hay không, và từ chối trước khi kiểm tra object đã được tải lên. Không có bước gia hạn/khôi phục phiên cho tình huống này. Nếu PUT thành công sau thời hạn hoặc người dùng gọi complete muộn, dữ liệu cũng không được chấp nhận.

**Vị trí:** `backend/src/config/videoStorage.js:1`; `backend/src/services/courseMediaService.js:158`; `frontend/components/courses/VideoUploadPanel.tsx:93`.

**Kiểm chứng:** Service thật nhận complete ở phút 16 với phiên hết hạn ở phút 15 trả `VIDEO_UPLOAD_NOT_COMPLETABLE`, không gọi HEAD kiểm tra nguồn. Chưa thử upload tệp lớn lên R2 thật.

**Đề xuất:** Tách thời hạn bắt đầu PUT khỏi thời gian được phép xác minh hoàn tất, hoặc có cơ chế gia hạn và tiếp tục upload. Giữ asset ở trạng thái có thể khôi phục khi chỉ lỗi complete do mạng/thời hạn; không tự xóa ngay tệp đã upload thành công.

### 6. [P2] Làm mới phiên phát khiến video đang xem bị dừng

**Tác động:** Khi tự gia hạn trước lúc hết hạn hoặc phục hồi sau lỗi 401, người học đang xem phải bấm phát lại. Thời hạn mặc định hiện là 4 giờ; cấu hình có thể giảm xuống 15 phút.

**Nguyên nhân:** Làm mới phiên thay `activeSession`, chạy cleanup hủy HLS và gọi `video.load()`, sau đó dựng lại player. Code khôi phục vị trí xem nhưng không lưu và khôi phục trạng thái đang phát bằng `play()` sau khi media mới sẵn sàng.

**Vị trí:** `frontend/components/learning/HlsPlayerShell.tsx:133`; `frontend/components/learning/HlsPlayerShell.tsx:175`; `frontend/components/learning/HlsPlayerShell.tsx:232`.

**Bằng chứng:** Rà luồng effect và API media trong mã nguồn. Chưa tái hiện trên trình duyệt thật hoặc chờ phiên production hết hạn.

**Đề xuất:** Giữ trạng thái đang phát/tạm dừng và vị trí trước refresh; chỉ tự phát lại nếu trước đó video đang phát, đồng thời xử lý trường hợp trình duyệt từ chối autoplay.

## Rủi ro thiết kế liên quan giới hạn thiết bị

Playback JWT hoạt động độc lập với phiên đăng nhập. Gateway kiểm tra chữ ký, thời hạn và phạm vi asset, nhưng không kiểm tra phiên đăng nhập còn hoạt động, enrollment vừa bị thu hồi hay tài khoản vừa bị khóa. Vì vậy link đã cấp có thể tiếp tục dùng đến hết hạn, mặc định tối đa khoảng 4 giờ kể từ lúc cấp. `sub` và `jti` trong token chưa tạo ra cơ chế thu hồi hoặc ràng buộc với slot thiết bị.

Đây là giới hạn của cơ chế signed URL hiện tại, được tách khỏi 6 lỗi chức năng nêu trên. Nếu yêu cầu sản phẩm là thu hồi quyền xem ngay khi đăng xuất hoặc thay thiết bị, cần bổ sung kiểm tra trạng thái phiên/thu hồi, hoặc giảm TTL và gia hạn có kiểm tra quyền. CORS không thay thế việc kiểm tra này.

Nguồn: `backend/src/services/videoPlaybackSessionService.js:33`; `backend/src/config/videoStorage.js:2`; `workers/video-gateway/src/security.mjs:29`.

## Kiểm thử và giới hạn của báo cáo

| Hạng mục | Kết quả |
| --- | --- |
| HLS: parser, upload publisher, checksum resume, gateway | 16/16 kiểm thử qua |
| Quyền gói, cấu hình gói quản trị, bài tập khóa học | 10/10 kiểm thử qua |
| Tái hiện bổ sung bằng service với dependency giả lập | Xác nhận khóa theo gói bị ẩn, complete quá hạn bị từ chối, thời lượng 0 làm tiến độ 0% |
| Mô phỏng vòng đời component thật | Xác nhận mất tiến độ sau retry và mất trạng thái xử lý sau remount |
| Production, dữ liệu học viên, upload R2 thật, Safari/iPhone, hiệu năng mạng | Chưa kiểm tra trong lượt này |

Lệnh kiểm thử đã chạy:

```text
cd backend
npm run test:hls
npx jest --runInBand --watchAll=false src/services/__tests__/coursePackageAccess.spec.js src/services/__tests__/adminCoursePackages.spec.js src/services/__tests__/courseAssignmentService.spec.js
```

26 kiểm thử có sẵn đều qua nhưng chưa bao phủ các trường hợp vừa phát hiện. Việc các kiểm thử này qua không chứng minh luồng xem/upload hoàn chỉnh đã ổn trên production.

## Thứ tự đề xuất

1. Sửa danh sách khóa theo gói và khôi phục trạng thái xử lý video.
2. Bảo vệ thời lượng chuẩn, sửa lưu tiến độ sau retry.
3. Sửa hoàn tất upload kéo dài và tiếp tục phát sau refresh.
4. Quyết định thời gian cho phép tiếp tục xem sau khi thu hồi phiên, rồi kiểm tra end-to-end trên desktop và iPhone.
