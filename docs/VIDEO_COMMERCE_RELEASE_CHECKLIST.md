# Bàn giao video/combo: chuẩn bị và nghiệm thu

Ngày: 14/10/2026. Dành cho admin và người vận hành. Code đang cục bộ, chưa phát hành. Không bật bán chỉ vì kiểm thử giả lập đã qua.

## Chuẩn bị cấu hình

| Mục | Cần chuẩn bị | Nơi dùng |
| --- | --- | --- |
| Database thử | Bản sao dữ liệu đại diện, có backup và quyền chạy migration | `VIDEO_COMMERCE_DATABASE_URL` cho script migration/đối soát |
| Bunny Library | Library ID, API key và token key, domain của website | Biến backend `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY` |
| payOS | Cấu hình kênh thử được phép dùng, callback đúng backend | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `FRONTEND_URL` |
| Nội dung | Video mẫu nhỏ và một tệp lớn được phép sử dụng | Admin khóa học |
| Chính sách gói | Giá, thời hạn, môn/khóa, cách mua lại, phạm vi voucher | Admin video/combo |

Không đưa key vào chat, mã nguồn hoặc ảnh chụp. Cấu hình key trên server. Biến frontend duy nhất của Bunny là cờ hiển thị lựa chọn upload.

## Thứ tự đưa lên môi trường thử

1. Kiểm kê prerequisite courses/media/VIP/coupon/xu; sao lưu trước migration. Đọc SQL 067-070, đặc biệt constraint số tiền giao dịch 0 đồng và nguồn enrollment mới.
2. Chạy migration tuần tự 067 → 068 → 069 → 070 với database đích rõ ràng, rồi chạy từng script `--check`. Các check chỉ xác nhận phần schema thiết yếu, không phải kiểm kê toàn bộ database.
3. Đưa backend/frontend tương thích lên môi trường thử. Giữ `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false` khi cấu hình nội dung.
4. Bật `CSCA_VIDEO_COMMERCE_ENABLED=true`, `CSCA_BUNNY_STREAM_ENABLED=true` và build frontend với `NEXT_PUBLIC_BUNNY_STREAM_ENABLED=true`. Cờ courses hiện có cũng phải bật. Bật SALES chỉ ở môi trường thử khi bắt đầu nghiệm thu thanh toán.
5. Trong Bunny, bật token authentication và cấu hình domain/direct-play để link công khai không bỏ qua quyền. Kiểm tra thực tế cả iframe lẫn URL media; chữ ký embed không tự chứng minh bảo vệ mọi URL.
6. Chạy ma trận bên dưới bằng tài khoản được phép thử. Kiểm chứng nhiều connection PostgreSQL thật cho tranh chấp xu/lượt voucher và callback đồng thời.
7. Chỉ mở production sau khi mọi mục bắt buộc đạt và có yêu cầu phát hành. Chưa cấu hình scheduler, gửi email thật hoặc nhập video thật trong đợt làm code này.

Từ `backend`, đã thiết lập `VIDEO_COMMERCE_DATABASE_URL` cho database thử:

```text
node scripts/apply_video_commerce_migration.js --apply
node scripts/apply_video_payment_migration.js --apply
node scripts/apply_video_admin_migration.js --apply
node scripts/apply_bunny_learning_migration.js --apply
node scripts/apply_video_commerce_migration.js --check
node scripts/apply_video_payment_migration.js --check
node scripts/apply_video_admin_migration.js --check
node scripts/apply_bunny_learning_migration.js --check
```

## Checklist admin

1. Tạo khóa/chương/bài video ở admin khóa học. Chọn Bunny, tải mẫu và kiểm tra đến khi ready. Mở lại bài, kiểm tra duration và phát thử; không lưu thời lượng ước tính như nguồn chuẩn.
2. Ở `/admin/video-commerce`, tạo gói video nháp, chọn đúng khóa/môn; nhập giá và thời hạn khi đã chốt. Xuất bản chỉ khi mọi thành phần hợp lệ.
3. Tạo combo tham chiếu gói VIP hiện có và gói video; kiểm tra môn và thời hạn hai phần. Thao tác này không đổi giá/cách bán của gói VIP cũ.
4. Tạo voucher riêng hoặc bật scope cho mã chung. Kiểm tra loại video/combo và danh sách gói; để trống danh sách nghĩa là áp dụng mọi gói của loại đó. Voucher video riêng không được đổi sentinel `video_only` qua admin coupon cũ.
5. Dùng tài khoản học viên kiểm tra `/goi-video`, checkout, `/tai-khoan/goi-video` và `/hoc`. Đối chiếu đúng tên, tiền, môn, hạn và khóa được mở.
6. Cấp tay thử với lý do, gửi lại cùng thao tác để kiểm tra chống cấp trùng. Cấp tay không cộng doanh thu. Thu hồi chọn đúng nguồn; thu hồi combo cũng thu hồi phần VIP được cấp bởi combo đó.

## Khi có lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Tạo đơn timeout | Thử lại từ checkout để dùng cùng request/key; tra mã đơn trước khi tạo đơn khác |
| Đã nhận tiền, chưa có quyền | Admin giao dịch → kiểm tra/đồng bộ. Đối chiếu provider; không cấp tay bù ngay khi chưa kiểm tra vì đơn có thể đang retry |
| Thiếu tiền / sai tiền / thanh toán muộn | Đối soát mã đơn, amount và reference với payOS; giữ trạng thái review. Chưa có tự động hoàn tiền hoặc xử lý tiền dư |
| Đã thành công nhưng email chưa gửi | Kiểm tra outbox/nhà cung cấp email, chạy tác vụ bảo trì đã cấu hình. Không tạo lại đơn để gửi email |
| Upload ngắt mạng | Mở lại bài, kiểm tra trạng thái rồi chọn đúng tệp để tiếp tục. Không xóa video chỉ vì response timeout |
| Chưa rõ tạo video remote thành công chưa | Tra tên `lesson-<lessonId>-<assetExternalKey>` trong Bunny Library và khôi phục bằng GUID đúng; không tạo thêm remote video trước khi đối soát |
| Processing / failed | Bấm kiểm tra trạng thái, đối chiếu Library. App chưa có worker tự đồng bộ Bunny khi admin đóng trang |
| Cần thay/xóa Bunny đã phát hành | Đối soát riêng trên Library và bài học; UI hiện chưa có xóa remote Bunny. Nút xóa R2 không xử lý asset Bunny |
| Học viên hết quyền | Kiểm tra nguồn, môn, khóa, thời hạn và enrollment bị thu hồi. Gia hạn quyền không tự khôi phục enrollment bị admin thu hồi |

Tác vụ đối soát đơn và retry email (cần migration 069 và cấu hình đúng database/provider/email):

```text
node scripts/reconcile_video_payments.js --run
```

Cần bố trí lịch chạy và theo dõi lỗi trước khi mở bán. Retry email có thể gửi lặp nếu crash sau khi nhà cung cấp đã nhận thư nhưng trước khi ghi sent.

## Nghiệm thu thật bắt buộc

| Ca | Kết quả cần thấy | Trạng thái |
| --- | --- | --- |
| Gói VIP hiện tại | Mua, voucher/xu, cấp tay và học legacy như trước | Chưa thử thật |
| Video có tiền | payOS xác minh, một quyền đúng môn/khóa, không cấp VIP | Chưa thử thật |
| Combo có tiền | Một khoản doanh thu, đủ hai quyền, không cấp nửa combo | Chưa thử thật |
| 0 đồng và callback lặp | Một quyền, một lượt mã/xu; 0 đồng không gọi provider | Giả lập đạt, chưa staging |
| Đồng thời VIP/video tranh lượt mã/xu | Không vượt lượt, không trừ xu hai lần | Chưa PostgreSQL nhiều connection |
| Thu hồi một trong nhiều nguồn | Chỉ nguồn đó mất hiệu lực, nguồn còn lại và tiến độ được giữ | Giả lập đạt, chưa staging |
| Bunny upload | Mẫu nhỏ/lớn, ngắt mạng, reload/resume, ready và duration đúng | TUS giả lập đạt, chưa Bunny thật |
| Bunny playback | Phát/resume, đổi bài, pause/gia hạn, hết hạn và thu hồi | Iframe giả lập đạt, chưa Bunny thật |
| Bảo vệ video | ID khác/asset khác bị chặn; link direct/iframe/domain theo cấu hình | API giả lập đạt; URL Bunny thật chưa kiểm tra |
| Desktop/Android/iPhone/Safari | Phát và lưu tiến độ đúng trên thiết bị mục tiêu | Chrome giả lập viewport; thiết bị thật chưa kiểm tra |
| Email, lịch đối soát | Gửi và retry hoạt động, có người theo dõi đơn review | Chưa thử thật |

## Dừng bán và khôi phục

- Dừng đơn mới bằng `CSCA_VIDEO_COMMERCE_SALES_ENABLED=false`. Giữ module commerce và provider hoạt động cho webhook, đối soát và quyền đã cấp.
- Không xóa bảng/migration để rollback khi đã có đơn. Bản backend khôi phục phải hiểu đơn và quyền video/combo; nếu không, giữ bản tương thích và sửa tiếp.
- Không tắt Bunny nếu còn học viên cần phát video Bunny; dừng bán không đồng nghĩa dừng phục vụ.
- Sau phát hành, theo dõi đơn đã trả tiền nhưng chưa cấp, amount/reference lệch, lỗi progress/playback, outbox chưa gửi và băng thông Bunny. Không ghi key/token phát vào log.
- Tiến độ dựa trên delta từ client; không phải cơ chế chống giả mạo hoặc DRM. Quy trình hoàn tiền là việc riêng, không thay bằng thu hồi quyền.
