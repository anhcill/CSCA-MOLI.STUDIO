# Kế hoạch 5 ngày: gói video, combo và Bunny Stream

Ngày lập: 12/10/2026.
Trạng thái ngày 14/10/2026: đã triển khai code ngày 1-4 và thực hiện hồi quy/diễn tập/build cục bộ ngày 5; xem `docs/VIDEO_COMMERCE_DAY1.md` đến `docs/VIDEO_COMMERCE_DAY5.md`. Hướng dẫn admin và nghiệm thu tại `docs/VIDEO_COMMERCE_RELEASE_CHECKLIST.md`. Kiểm thử dùng database trong bộ nhớ, provider và API/iframe/TUS giả lập. Chưa có Bunny Library, chưa nghiệm thu thanh toán/upload/phát thật hoặc thiết bị thật, chưa áp dụng dữ liệu production hay mở bán. Phần staging/phát hành ngày 5 còn chờ đủ cấu hình và nghiệm thu thực tế.
Phạm vi: bổ sung thương mại khóa học video vào CSCA-MOLI.STUDIO.

## 1. Yêu cầu đã thống nhất

1. Giữ nguyên giao diện và logic nghiệp vụ của gói hiện tại.
2. Bổ sung gói video: mua gói nào thì học các video thuộc gói đó.
3. Bổ sung combo: gói hiện tại kết hợp gói video tương ứng.
4. Video và combo có đầy đủ chức năng tương ứng của gói hiện tại: quản lý gói, thanh toán, voucher, xu, cấp/thu hồi thủ công, lịch sử, thống kê và thông báo.
5. Quản trị ngay trong admin hiện có, theo phong cách giao diện đang sử dụng.
6. Dùng Bunny Stream cho video mới; quy mô ban đầu khoảng một khóa, 10 GB video nguồn.
7. Không tự đổi giá, thời hạn, tên, quyền hoặc cách bán của các gói hiện tại.

"Giữ nguyên" nghĩa là giữ hành vi, giao diện và khả năng tương thích. Có thể thêm nhánh xử lý vào webhook hoặc truy vấn dùng chung để nhận biết sản phẩm mới; những thay đổi này phải có kiểm thử chứng minh đơn cũ vẫn chạy như trước.

Kế hoạch tính theo 5 ngày làm việc, khoảng 40-48 giờ tập trung. Đây là ước lượng triển khai có điều kiện, không phải lịch tự động chạy. Tài khoản Bunny, môi trường kiểm thử và quyết định kinh doanh cần sẵn sàng đúng mốc để nghiệm thu trong ngày 5. Không bỏ kiểm thử thanh toán hoặc cấp quyền để kịp lịch.

## 2. Hiện trạng đã rà trong code

| Khu vực | Hiện trạng | Hệ quả khi mở rộng |
| --- | --- | --- |
| Trang gói | `frontend/app/vip/page.tsx` | Giữ nguyên; thêm điểm truy cập video từ khu khóa học/menu phù hợp |
| Checkout | `frontend/app/checkout/page.tsx` và trang success | Checkout hiện tại gắn với VIP; sản phẩm mới cần trang riêng |
| Thanh toán | `backend/src/routes/payments.js` | Cấp quyền VIP trực tiếp trong nhiều nhánh; phải phân loại đơn trước khi cấp quyền |
| Kênh thanh toán | Code có payOS/chuyển khoản, MoMo, VNPay | Ưu tiên kênh thật đang bật; không coi sự tồn tại trong code là bằng chứng kênh đang hoạt động |
| Quyền hiện tại | `user_vip_entitlements`, dữ liệu tổng hợp trong `users` | Không dùng cờ `is_vip` để cấp quyền mua video mới |
| Gắn khóa với gói | `course_package_access` trỏ tới `vip_packages` | Có khách cũ có thể đang hưởng quyền video; cần kiểm kê trước khi tách sản phẩm |
| Admin VIP | Người dùng, giao dịch, gói, bảng so sánh, cấp và thu hồi | Giữ nguyên các tab và thao tác cũ; thêm khu vực video/combo |
| Voucher | Theo gói/tier, phần trăm/số tiền, thời gian, hạn mức, lịch sử và banner khuyến mãi | Thêm phạm vi sản phẩm mới; mã cũ không được vô tình mở rộng phạm vi |
| Xu | Backend có giảm giá bằng xu và giữ chỗ xu cho đơn chờ | Phải dùng chung ví và tránh tiêu cùng số xu ở hai luồng thanh toán |
| Video | R2/HLS, upload, finalize, phiên phát, tiến độ | Thêm provider Bunny theo từng asset; không chuyển hàng loạt video cũ |

Nguồn rà chính: `backend/src/models/Transaction.js`, `backend/src/models/User.js`, `backend/src/controllers/adminVipController.js`, `backend/src/controllers/adminCouponController.js`, `backend/src/controllers/couponController.js`, `backend/src/repositories/courseRepository.js`, `backend/src/services/courseService.js` và báo cáo `docs/COURSE_VIDEO_REVIEW_2026-10-12.md`.

Lưu ý: lượt lập kế hoạch chỉ đọc mã nguồn. Chưa truy vấn dữ liệu production, chưa kiểm tra cấu hình tài khoản Bunny hoặc chạy giao dịch thật. Kết quả kiểm thử trong báo cáo cũ không phải kết quả kiểm thử của tính năng mới.

## 3. Ranh giới sản phẩm và quyền

### 3.1. Ba loại mua

| Loại | Cấp quyền gói hiện tại | Cấp quyền video mới | Cách bán |
| --- | --- | --- | --- |
| Gói hiện tại | Theo logic đang có | Giữ các quyền video cũ đã tồn tại nếu có | Trang/checkout hiện tại |
| Video | Không | Theo gói video và môn được chọn | Trang mua video mới |
| Combo | Gói hiện tại được cấu hình trong combo | Gói video được cấu hình trong combo | Trang mua combo mới |

Ví dụ minh họa, chưa phải danh mục bán chính thức: "Video Tự Nhiên" mở các khóa thuộc gói video Tự Nhiên; "Combo Tự Nhiên" gồm gói Tự Nhiên hiện có và Video Tự Nhiên. Không tự suy luận quyền từ tên sản phẩm hoặc mức giá.

### 3.2. Quy tắc cần giữ trong mọi API

- Video-only không sửa `is_vip`, tier, môn VIP hoặc ngày hết hạn VIP.
- Combo ghi nhận hai thành phần quyền; một khoản thanh toán, một đơn hàng, có thể truy nguyên từng quyền về đơn đó.
- Mua gói A không tự mở video gói B; phần giao nhau chỉ được mở khi admin chủ động cấu hình.
- Gói có chọn môn phải lưu môn đã chọn vào đơn và quyền, kiểm tra lại ở server.
- Backend quyết định quyền xem; ẩn nút trên frontend không thay thế kiểm tra quyền ở API.
- Quyền gói và enrollment là hai khái niệm: mua/cấp gói tạo quyền, enrollment lưu việc học và tiến độ.
- Hết hạn hoặc thu hồi quyền không xóa tiến độ; có quyền hợp lệ trở lại thì tiếp tục học.
- Có nhiều nguồn cấp quyền thì một nguồn bị thu hồi không làm mất quyền từ nguồn khác còn hợp lệ.
- Không tự chuyển dữ liệu quyền cũ thành video-only/combo. Khóa cũ tiếp tục đi qua đường kiểm tra tương thích.
- Các khóa bán theo cơ chế mới không tự kế thừa quyền VIP toàn cục. Phải đánh dấu chính sách truy cập mới rõ ràng.

### 3.3. Các quyết định kinh doanh và cấu hình

Cập nhật theo yêu cầu người dùng: mức giá và thời hạn để admin cấu hình sau, không chặn ngày 1. Bản nháp được để trống các trường này; chỉ kiểm tra đầy đủ trước khi mở bán. Người dùng chưa có tài khoản Bunny và yêu cầu chuẩn bị code trước; spike ngày 1 dùng tài liệu chính thức và mock, phần thử thật chuyển tới lúc có Library.

| Quyết định | Đề xuất để lập kế hoạch | Trạng thái |
| --- | --- | --- |
| Tên, giá và danh mục video | Admin tạo mới độc lập, có gói tương ứng với danh mục hiện tại | Chưa chốt số liệu |
| Thời hạn video | Cấu hình riêng; có thể đặt giống thời hạn gói tương ứng | Chưa chốt |
| Thời hạn hai phần combo | Hiển thị riêng; dùng cùng số ngày cho lần mua mới nếu không có yêu cầu khác | Chưa chốt |
| Mua lại/gia hạn video | Cần định nghĩa rõ cộng thời gian hay bắt đầu lại; không áp đặt lên gói cũ | Chưa chốt |
| Đã có gói hiện tại rồi mua combo | Hiển thị quyền trùng và thời hạn dự kiến; chưa tự tính bù tiền | Chưa chốt |
| Quyền cũ đang mở video | Giữ cơ chế cũ; áp dụng tách bán cho khóa/gói mới | Đề xuất phù hợp yêu cầu giữ logic |
| Thay đổi danh sách khóa trong gói | Cho phép bổ sung; việc bỏ khóa phải có chính sách bảo vệ người đã mua | Chưa chốt |
| Voucher cũ | Giữ phạm vi cũ; admin chủ động bật cho video/combo | Đề xuất mặc định |
| Xu cho sản phẩm mới | Có đầy đủ khả năng áp dụng, kế thừa chính sách hiện hành trừ khi chốt khác | Cần đối chiếu cấu hình |
| Thu hồi link video đã cấp | Chặn cấp/gia hạn phiên ngay khi mất quyền; link cũ hết hiệu lực theo TTL đã chốt | Cần chốt TTL |

Không cần chốt mọi mức giá để lập trình, nhưng cần chốt quy tắc thời hạn, quyền cũ và mua trùng trước khi nghiệm thu cấp quyền. Dữ liệu mẫu chỉ nằm ở môi trường thử nghiệm.

## 4. Giao diện: chỉ bổ sung

### 4.1. Người mua

1. Giữ nguyên `/vip`, checkout cũ và nội dung gói hiện tại. Không thay chúng bằng trang ba tab mới.
2. Từ `/khoa-hoc` và trang chi tiết khóa, thêm nút "Xem gói video"; người đủ quyền thấy "Vào học" hoặc "Tiếp tục học".
3. Thêm trang đề xuất `/goi-video`, có hai lựa chọn "Gói video" và "Combo"; dùng màu sắc, font, thẻ và nút theo giao diện hiện tại.
4. Mỗi thẻ hiển thị tên gói, môn/khóa được học, thời hạn, giá, giá trước giảm nếu có, trạng thái đang sở hữu và nút mua.
5. Combo hiển thị cụ thể phần gói hiện tại và phần video; không chỉ ghi chung "đầy đủ quyền lợi".
6. Gói chọn môn phải yêu cầu chọn trước khi báo giá cuối và tạo đơn; giữ lựa chọn khi quay lại.
7. Thêm checkout riêng, đề xuất `/thanh-toan-khoa-hoc`, hiển thị loại sản phẩm và chi tiết quyền ở đầu trang.
8. Checkout mới hỗ trợ voucher, xu, tổng tiền, QR/chuyển khoản, đếm giờ, chờ xác nhận, thử lại và mở lại đơn chờ.
9. Kết quả có các trạng thái: thành công, đang đối soát, hủy, hết hạn, thất bại. Quay về từ cổng thanh toán không tự coi là đã trả tiền.
10. Thành công dẫn tới "Vào học"; combo có thêm đường tới chức năng gói hiện tại. Email và trang thành công nêu đúng sản phẩm đã mua.
11. Bổ sung khu "Gói video của tôi"/lịch sử trong tài khoản; `/hoc` hiển thị khóa được học và tiến độ, kể cả quyền vừa mua hoặc admin vừa cấp.
12. Mọi màn hình mới có trạng thái đang tải, trống, lỗi mạng, hết quyền và không đủ quyền; dùng được trên điện thoại, bàn phím và desktop.

Luồng mục tiêu: Khóa học -> Gói video hoặc combo -> Chọn gói/môn -> Voucher/xu -> Thanh toán -> Nhận quyền -> Vào học.

### 4.2. Admin

Giữ nguyên `/admin/vip`. Thêm mục "Gói video & combo", đề xuất `/admin/video-packages`, gồm các khu tương ứng: tổng quan, gói, người dùng/quyền, đơn hàng. Trang voucher hiện có chỉ thêm lựa chọn phạm vi và danh sách gói mới; mặc định vẫn làm việc như cũ.

| Chức năng | Chi tiết bổ sung | Nghiệm thu |
| --- | --- | --- |
| Tạo/sửa gói | Loại video/combo, giá, giá gốc/ghi chú, thời hạn, mô tả, quyền lợi, thứ tự, trạng thái bán | Sửa gói mới không sửa gói VIP liên kết |
| Gắn khóa | Chọn khóa được học; chọn môn nếu cần | Xem trước được danh sách quyền sẽ cấp |
| Tạo combo | Chọn gói hiện tại và gói video; đặt giá combo độc lập | Không cấp nhầm tier hoặc môn |
| Bật/tắt/ngừng bán | Tắt khả năng tạo đơn mới; giữ lịch sử và quyền đã cấp | Học viên đã mua vẫn học theo quyền còn hạn |
| Xóa | Chỉ xóa bản nháp chưa dùng; gói đã bán dùng lưu trữ/ngừng bán | Không mất dữ liệu đơn/quyền |
| Quyền lợi/so sánh | Hỗ trợ nội dung so sánh cho sản phẩm mới khi danh mục cần | Không sửa bảng so sánh VIP/Premium cũ |
| Voucher | Phần trăm/số tiền, tối thiểu, thời hạn, tổng lượt, lượt/người, gói/loại áp dụng | Preview và checkout tính cùng kết quả |
| Khuyến mãi | Banner/CTA/coupon cho trang mua mới, theo phạm vi phù hợp | Banner cũ không tự chuyển sang sản phẩm mới |
| Cấp thủ công | Tìm người dùng, chọn gói/môn, ngày/thời hạn tùy chỉnh, lý do | Combo cấp đủ hai phần và có log |
| Thu hồi | Chọn đúng lượt cấp/đơn hoặc phạm vi quyền; xem tác động trước khi xác nhận | Không thu hồi nhầm quyền độc lập khác |
| Danh sách học viên | Tìm kiếm, phân trang, lọc gói, đang hiệu lực/hết hạn/thu hồi, nguồn cấp | Khớp quyền thực tế ở API phát video |
| Đơn hàng | Mã đơn, người mua, loại, giá gốc, giảm voucher/xu, tiền trả, kênh, trạng thái, thời gian | Tra được quyền sinh từ đơn |
| Thống kê | Doanh thu theo loại, số đơn/trạng thái, người có quyền, khoảng thời gian tương đương hiện tại | Combo tính tiền một lần; cấp thủ công không tạo doanh thu giả |
| Nhật ký/quyền admin | Theo phân quyền hiện có; ghi actor, đối tượng, lý do, thời gian và thay đổi | Không đủ quyền không được xem/thao tác API quản trị |

Kiểm kê ngày 1 sẽ bổ sung các khả năng hiện có chưa được liệt kê. Hoàn tiền, trả góp, chia doanh thu hoặc tự nâng cấp có bù tiền không mặc nhiên nằm trong phạm vi nếu hệ thống hiện tại chưa có.

## 5. Thiết kế kỹ thuật đề xuất

### 5.1. Mô hình dữ liệu thêm mới

Tên bảng dưới đây là dự kiến, chốt sau khi rà toàn bộ migration và ràng buộc trên database thử nghiệm.

| Thành phần | Nội dung |
| --- | --- |
| `video_packages` | Danh mục gói video, giá, thời hạn, môn, trạng thái, nội dung hiển thị |
| `video_package_courses` | Liên kết gói video và khóa học, có quy tắc cập nhật quyền đã bán |
| `combo_packages` | Liên kết gói VIP hiện tại với gói video, giá và cấu hình combo |
| `user_video_entitlements` | Quyền video theo người dùng, gói/môn, nguồn, thời hạn, trạng thái, đơn/lượt cấp |
| `transaction_items` | Snapshot sản phẩm, giá, tên, thời hạn, môn và các thành phần của đơn mới |
| `order_fulfillments` | Trạng thái xử lý cấp quyền, khóa chống cấp trùng, lỗi có thể thử lại |
| Phạm vi voucher | Bảng/cột bổ sung liên kết voucher với loại và ID gói mới; giữ định nghĩa cũ |
| Video asset | Provider, library ID, video ID Bunny, trạng thái xử lý, thời lượng chuẩn; asset cũ mặc định provider cũ |
| Audit/lượt cấp | Tái sử dụng nhật ký hiện có hoặc thêm dữ liệu liên kết cho từng quyền và từng lần thu hồi |

- Giữ bảng `transactions` làm sổ giao dịch chung để dùng chung cổng thanh toán, ví xu và lịch sử.
- Bổ sung loại sản phẩm có mặc định cho đơn cũ; `package_id` cũ không được gán ID video/combo giả vào khóa ngoại VIP.
- Kiểm tra nullability và mọi truy vấn join VIP trước khi cho đơn mới dùng `package_id = NULL`.
- Đơn mới có snapshot do server tạo; chỉnh giá/tên gói sau này không đổi số tiền hoặc quyền của đơn đã chốt.
- Giá tiền tính bằng số nguyên VND, kiểm tra server; không tin giá, loại, quyền hoặc số tiền giảm do client gửi.
- Thêm unique constraint cho một lần cấp theo đơn/thành phần, provider event và yêu cầu cấp thủ công khi cần.
- Migration chỉ thêm schema và backfill tương thích; không drop hoặc đổi ý nghĩa dữ liệu VIP hiện có.

### 5.2. Thanh toán và cấp quyền

1. Endpoint mua mới lấy sản phẩm từ server, kiểm tra đang bán, môn, giá, voucher và xu.
2. Tạo báo giá/đơn với thời gian hiệu lực và snapshot; người dùng mở lại đơn chờ nhận lại đúng nội dung đó.
3. Giữ cơ chế định danh giao dịch chung; idempotency key phân biệt yêu cầu nhưng không cho cùng key bị đổi sản phẩm lặng lẽ.
4. Gọi provider ngoài transaction database dài; lưu đủ trạng thái để đối soát nếu timeout.
5. Webhook xác minh chữ ký theo provider, mã đơn, số tiền, tiền tệ nếu có và trạng thái thanh toán từ nguồn tin cậy.
6. Dispatcher chọn luồng cũ cho đơn cũ; chọn luồng mới cho video/combo. Không để nhánh fallback cấp VIP cho video-only.
7. Với đơn mới, quyền, xu, lượt voucher và trạng thái hoàn tất được ghi một lần bằng khóa/transaction database phù hợp.
8. Combo cấp hai phần trong cùng transaction DB. Hàm VIP hiện đang tự mở transaction; cần adapter cho nhận DB client hoặc phần ghi tương đương đã kiểm thử, giữ nguyên hành vi caller cũ.
9. Nếu tiền đã nhận nhưng DB lỗi, ghi trạng thái chờ xử lý/đối soát theo mô hình đã chốt; retry không thu tiền hoặc cấp quyền lần hai.
10. Email gửi sau commit, lỗi email không làm rollback quyền; cơ chế thử lại có chống gửi trùng hợp lý.
11. Đơn giảm còn 0 đồng đi qua cùng dịch vụ cấp quyền, kiểm tra voucher/xu đầy đủ; không gọi cổng thanh toán.
12. Hủy/hết hạn/failed giải phóng phần giữ chỗ phù hợp; webhook thanh toán đến muộn phải đối soát, không bỏ qua tiền đã nhận và không tự nâng giá đơn.

Đối với webhook, lịch sử, báo cáo và ví dùng chung: bổ sung kiểm thử liên luồng cũ/mới; tránh refactor toàn bộ file thanh toán trong cùng đợt.

### 5.3. Quyền cũ và mua trùng

- Lập danh sách course/access mapping/entitlement cũ trước migration; so sánh trước/sau bằng dữ liệu thử nghiệm đại diện.
- Giữ đường cấp quyền từ gói VIP cho các khóa legacy đang dùng nó. Nếu muốn bỏ quyền này sau đó, cần kế hoạch sản phẩm riêng và quyết định rõ từ chủ hệ thống.
- Sản phẩm video/combo mới có định danh riêng; việc tham chiếu gói VIP cho combo không làm nó xuất hiện trong danh mục VIP cũ.
- Không suy luận thời hạn chỉ từ `users.vip_expires_at`; quyền video có thời hạn riêng.
- Rà cả hành vi thực tế của `grantVipEntitlement` và `updateVipStatus`, vì code có cách tính ngày khác nhau. Không tự coi "mua lại" hiện tại là cộng dồn khi chưa kiểm chứng caller.
- Thao tác thu hồi VIP hiện tại còn đăng xuất tất cả thiết bị. Giữ hành vi đó; bổ sung thao tác video/combo có phạm vi rõ và giải thích tác động trong màn hình mới.
- Với combo, thu hồi theo nguồn cấp không vô hiệu hóa quyền VIP/video được cấp độc lập trước đó. Cần tính lại tổng quyền còn hiệu lực.

### 5.4. Bunny Stream

- Chọn Bunny Stream cho upload, mã hóa và phát video; không chỉ dùng Bunny Storage để lưu file thô.
- Kiểm chứng API, cách ký upload/phát, cơ chế trạng thái và khả năng bảo vệ theo tài liệu Bunny tại thời điểm triển khai; chưa coi tên endpoint hoặc cách xác thực là đã chốt.
- Tách adapter provider: video cũ dùng R2/HLS như trước, video mới chọn Bunny theo asset.
- Secret/API key chỉ ở backend. Client chỉ nhận quyền upload/phát ngắn hạn đúng phạm vi; không dùng biến public cho secret.
- Upload trực tiếp có tiếp tục/resume nếu API hỗ trợ; backend giữ định danh upload/asset để rời trang rồi quay lại vẫn thấy trạng thái.
- Các trạng thái tối thiểu: chờ tải, đang tải, đang xử lý, sẵn sàng, lỗi có thể thử lại.
- Chỉ cho xuất bản bài khi asset đã sẵn sàng; kiểm chứng trạng thái phía server qua API Bunny, không tin trạng thái client tự gửi.
- Với callback xử lý: dùng xác thực đúng khả năng Bunny cung cấp; nếu callback không đủ tin cậy, xác minh lại asset bằng API server và có tác vụ đối soát.
- Lấy thời lượng từ video đã xử lý làm chuẩn. Form bài học không được ghi đè thời lượng chuẩn bằng state cũ.
- Phát video phải kiểm tra tài khoản, quyền gói, enrollment, khóa/bài được xuất bản và trạng thái asset ở backend.
- Ưu tiên tích hợp đầu phát HLS để giữ progress hiện tại nếu tương thích signed playback; xác minh manifest và segment đều được bảo vệ. Nếu dùng iframe, phải chứng minh sự kiện tiến độ/seek/retry trước khi chốt.
- Khi hết quyền, không cấp phiên mới. Link đã cấp có thể còn dùng đến hạn; TTL cụ thể là một quyết định sản phẩm, không hứa thu hồi tức thời hoặc chống quay màn hình tuyệt đối.
- Giữ vị trí, trạng thái đang phát và tiến độ khi retry/refresh phiên, đổi bài và reload.
- Cấu hình theo dõi lưu trữ/băng thông và giới hạn/cảnh báo chi phí nếu Bunny hỗ trợ; 10 GB nguồn không đồng nghĩa chỉ 10 GB tính phí sau mã hóa.
- Không tự chuyển/xóa toàn bộ nguồn R2 hoặc thay worker gateway cũ trong đợt này.

## 6. Lịch triển khai chi tiết trong 5 ngày

### Ngày 1 — Kiểm kê đầy đủ, chốt quy tắc và dựng nền dữ liệu (8 giờ)

**Đầu ngày, 2 giờ:**

- Rà tất cả entrypoint mua, webhook, đối soát, đơn 0 đồng, voucher/apply, ví xu, cấp/thu hồi, email và báo cáo.
- Đánh dấu chức năng nào hoạt động thực tế, chức năng nào chỉ có code hoặc đang tắt.
- Lập ma trận tương đương tính năng: hiện tại -> video -> combo -> test -> trạng thái.
- Chụp/ghi nhận UI baseline desktop/mobile cho `/vip`, checkout và admin VIP; lưu hành vi API gói cũ.
- Kiểm kê quyền khóa cũ trên bản dữ liệu được phép dùng; xác định khóa legacy và khóa bán mới.

**Giữa ngày, 2 giờ:**

- Chuẩn bị danh mục mẫu; cho phép hoãn mức giá/thời hạn đến lúc admin cấu hình. Ghi nhận quy tắc gia hạn/mua trùng cần quyết định trước khi mở bán.
- Vẽ wireframe trang mua video/combo, checkout mới, màn hình cấp thủ công và chi tiết quyền combo.
- Chốt API contract, DTO và lỗi nghiệp vụ trước khi frontend/backend triển khai.
- Kiểm chứng adapter Bunny bằng tài liệu/mock; chuẩn bị probe metadata. Thử asset, đường phát bảo vệ và sự kiện tiến độ thật khi có tài khoản/Library.

**Cuối ngày, 4 giờ:**

- Viết migration bổ sung bảng/cột/index, bộ dữ liệu thử đủ 3 loại sản phẩm.
- Dựng repository/service gói video, combo và quyền; tạo kiểm tra schema cơ bản.
- Viết test quyền: video-only, combo, môn, hết hạn, legacy, hai nguồn quyền trùng nhau.
- Chạy migration trên database thử và xác minh dữ liệu cũ giữ nguyên ý nghĩa.
- Tạo công tắc phát hành riêng cho mua video/combo, mặc định tắt; không dùng nó để vô hiệu hóa quyền đã bán.

**Bàn giao/nghiệm thu ngày 1:** tài liệu quy tắc, wireframe, ma trận tính năng, migration thử thành công, API contract và spike Bunny có kết quả. Nếu spike phát/progress không đạt, điều chỉnh hướng tích hợp trước khi làm player ngày 4.

### Ngày 2 — Thanh toán mới, voucher, xu và cấp quyền an toàn (8-10 giờ)

**Đầu ngày, 2-3 giờ:**

- Làm API danh mục và báo giá video/combo, validate gói/môn/trạng thái.
- Snapshot giá, thời hạn, thành phần combo và quyền tại thời điểm chốt đơn.
- Mở rộng voucher theo phạm vi mới; giữ mặc định mã cũ chỉ theo phạm vi cũ.
- Tích hợp ví xu dùng chung; tái sử dụng giới hạn và cách làm tròn của cơ chế hiện tại đã kiểm chứng.

**Giữa ngày, 3-4 giờ:**

- Làm tạo/mở lại đơn mới và tích hợp cổng đang chạy thực tế.
- Thêm dispatcher vào tất cả nhánh hoàn tất liên quan, kể cả webhook, đối soát và đơn 0 đồng.
- Tạo dịch vụ cấp video/combo chống trùng; combo cấp đủ hai phần bằng transaction DB.
- Khóa tranh chấp số dư xu, lượt voucher cuối và sự kiện thanh toán trùng.
- Làm phục hồi khi provider timeout, nhận tiền nhưng DB lỗi, callback đến muộn hoặc nhiều worker xử lý cùng đơn.

**Cuối ngày, 3 giờ:**

- Hoàn thiện API trạng thái, lịch sử mới và email đúng loại gói.
- Kiểm thử mua video không cấp VIP; combo không cấp một nửa; lặp webhook không tăng hạn/xu/lượt mã lần hai.
- Kiểm thử hai tab tạo đơn, hai đơn cũ/mới dùng chung số dư xu, voucher hết lượt trong lúc thanh toán.
- Chạy hồi quy thanh toán gói hiện tại bằng fixture; không tự thay đổi nghiệp vụ legacy khi phát hiện khác biệt.

**Bàn giao/nghiệm thu ngày 2:** API thanh toán end-to-end trên môi trường thử; đơn/tiền/quyền đối soát được; các test tài chính và phân quyền trọng yếu qua. Giao diện mua chưa cần hoàn thiện ở mốc này.

### Ngày 3 — UI mua hàng và admin đầy đủ (8-10 giờ)

**Đầu ngày, 3 giờ:**

- Làm trang gói video/combo và nút từ catalog/chi tiết khóa.
- Làm thẻ gói, chọn môn, chi tiết combo, trạng thái đang sở hữu và quyền trùng.
- Làm checkout mới: voucher, xu, báo giá, QR, chờ xác nhận, mở lại đơn, lỗi/hết hạn.
- Làm kết quả thanh toán và điều hướng vào khóa được học.

**Giữa ngày, 3-4 giờ:**

- Làm admin CRUD gói, gắn khóa, cấu hình combo, thứ tự và bật/tắt bán.
- Làm cấp thủ công, thời hạn tùy chỉnh, lý do, xác nhận và chống gửi trùng.
- Làm thu hồi theo nguồn quyền, danh sách học viên, tra cứu đơn và nhật ký.
- Mở rộng màn hình voucher/banner bằng trường thêm mới; giữ mặc định cũ.
- Bổ sung thống kê/phân loại đơn; phân biệt cấp thủ công với doanh thu thanh toán.

**Cuối ngày, 2-3 giờ:**

- Bổ sung khu gói video trong tài khoản, liên kết tới `/hoc` và thời hạn rõ ràng.
- Kiểm tra UI ở 360/390 px và desktop; không tràn thẻ, bảng hoặc QR.
- Kiểm tra form bằng bàn phím, thông báo lỗi, disable nút khi đang gửi và phản hồi thành công.
- So sánh baseline: trang gói, checkout và admin VIP cũ không thay bố cục hoặc mặc định.
- Đối chiếu ma trận: mọi chức năng hiện có đã được đánh dấu triển khai/test hoặc có lý do rõ ràng.

**Bàn giao/nghiệm thu ngày 3:** người mua thực hiện được toàn bộ luồng trên môi trường thử; admin tự tạo gói, tạo mã, cấp/thu hồi và xem giao dịch. UI cũ giữ nguyên.

### Ngày 4 — Bunny, upload, playback, quyền và tiến độ (8-10 giờ)

**Đầu ngày, 2-3 giờ:**

- Cấu hình library và adapter Bunny theo kết quả spike ngày 1; khóa bí mật qua cấu hình server.
- Thêm provider metadata và API tạo upload đúng quyền quản trị khóa học.
- Upload một video mẫu, theo dõi xử lý, cập nhật duration/thumbnail và trạng thái sẵn sàng.
- Khôi phục upload/trạng thái sau rời trang, refresh, lỗi mạng; không xóa asset chỉ vì complete timeout.

**Giữa ngày, 3-4 giờ:**

- Tích hợp phát video với xác thực quyền gói mới và cơ chế legacy theo asset/course.
- Chặn xem gói khác bằng cách sửa URL, lesson ID, asset ID hoặc token.
- Tích hợp player với lưu vị trí, thời gian xem và tiến độ theo server; không hoàn thành chỉ do kéo thanh tua.
- Sửa danh sách khóa được học theo quyền gói, lỗi retry không lưu tiến độ và refresh phiên làm dừng phát.
- Ngăn form ghi đè duration chuẩn, khôi phục trạng thái processing khi mở lại bài trong admin.

**Cuối ngày, 2-3 giờ:**

- Kiểm thử desktop, Android/iPhone hoặc thiết bị thật có sẵn, Safari/HLS nếu có môi trường.
- Kiểm thử mất mạng, retry, token hết hạn, thu hồi quyền, đổi bài, reload và quay lại sau đăng nhập.
- Upload thử tệp đủ lớn để kiểm chứng timeout/resume; sau đó nhập khóa đầu tiên theo khả năng đường truyền.
- Đối chiếu lesson count, duration, trạng thái ready, mapping gói và chi phí ban đầu.

**Bàn giao/nghiệm thu ngày 4:** mua hoặc cấp video/combo -> vào đúng khóa -> phát Bunny -> lưu và tiếp tục tiến độ. Video legacy vẫn dùng được. Nếu chưa có thiết bị Safari thật, ghi rõ kiểm thử chưa làm, không ghi đạt giả.

### Ngày 5 — Hồi quy, nghiệm thu và chuẩn bị phát hành (8-10 giờ)

**Đầu ngày, 3 giờ:**

- Chạy toàn bộ ma trận thanh toán/quyền/admin/video trọng yếu, sửa lỗi và chạy lại các ca bị tác động.
- Chạy bộ test gói khóa học, HLS và phiên đăng nhập hiện có để bảo vệ phần vừa sửa trước đó.
- Chạy kiểm tra kiểu frontend, build production phù hợp môi trường và kiểm tra schema migration.
- So sánh giao diện cũ với baseline; kiểm tra không xuất hiện gói mới trong danh sách VIP cũ.

**Giữa ngày, 2-3 giờ:**

- Diễn tập đầy đủ: admin tạo video/combo -> tạo mã -> mua thử -> nhận quyền -> học -> thu hồi đúng nguồn.
- Diễn tập đơn 0 đồng, lỗi mạng ở thanh toán, webhook trùng và retry cấp quyền.
- Đối soát doanh thu/xu/voucher/quyền giữa đơn, admin và tài khoản học viên.
- Hướng dẫn admin bằng checklist ngắn, ảnh màn hình và quy trình xử lý thanh toán chờ/asset lỗi.

**Cuối ngày, 3-4 giờ:**

- Hoàn thiện bản release có diff, migration, kết quả test, dữ liệu mẫu cần nhập và cách khôi phục.
- Triển khai staging theo quy trình dự án; kiểm tra cấu hình và kênh thanh toán thực tế với môi trường/test account được phép dùng.
- Mở bán production khi được yêu cầu triển khai và đạt điều kiện nghiệm thu; kế hoạch này tự nó chưa thực hiện giao dịch hay triển khai production.
- Nếu phát hành: theo dõi log mua -> thanh toán -> cấp quyền -> phát video và xác nhận đơn đầu tiên.
- Bàn giao danh sách lỗi còn lại, giới hạn đã biết, nơi tra đơn và cách dừng bán mới mà vẫn phục vụ người đã mua.

**Bàn giao/nghiệm thu ngày 5:** bản sẵn sàng phát hành hoặc bản đã phát hành theo phạm vi được giao, kèm bằng chứng kiểm thử. Nếu còn lỗi thu tiền/cấp quyền/đọc chéo dữ liệu thì không mở bán; nêu cụ thể hạng mục và thời gian bổ sung.

## 7. Ma trận kiểm thử bắt buộc

| ID | Tình huống | Kết quả cần đạt |
| --- | --- | --- |
| LEG-01 | Mở trang gói, chọn môn và mua gói cũ | UI, giá và quyền như baseline |
| LEG-02 | Voucher, xu, đơn 0 đồng của gói cũ | Kết quả và phạm vi cũ được giữ |
| LEG-03 | Cấp/thu hồi VIP từ admin cũ | Hành vi cũ giữ nguyên |
| LEG-04 | Khách cũ mở khóa legacy đang có quyền | Không bị mất quyền do thêm sản phẩm mới |
| ENT-01 | Chỉ mua video | Không đổi VIP/tier/môn/thời hạn VIP |
| ENT-02 | Mua combo | Đủ hai thành phần đúng gói/môn/thời hạn |
| ENT-03 | Video A truy cập khóa B hoặc sửa lesson ID | API từ chối nếu không có quyền |
| ENT-04 | Hết hạn hoặc thu hồi, còn một nguồn khác hợp lệ | Quyền tính theo nguồn còn lại; tiến độ giữ nguyên |
| ENT-05 | Mua gói chọn một môn | Không mở các môn còn lại |
| ENT-06 | Gói đang sở hữu, mua lại hoặc mua combo | Theo quy tắc mua trùng đã chốt, hiển thị hạn đúng |
| PAY-01 | Client sửa giá/giảm giá/type/subject | Server từ chối hoặc tính lại đúng |
| PAY-02 | Webhook lặp, webhook và polling cùng lúc | Một lần cấp, một lần trừ xu/ghi lượt mã |
| PAY-03 | Sai chữ ký, sai tiền, sai đơn, return URL giả | Không cấp quyền từ dữ liệu không hợp lệ |
| PAY-04 | Tiền thành công, DB lỗi trước/giữa cấp combo | Phục hồi đủ quyền; không có combo hoàn tất một nửa |
| PAY-05 | Đơn giảm 100% còn 0 đồng | Không gọi cổng; đủ kiểm tra và quyền |
| PAY-06 | Đơn hủy/hết hạn, callback thanh toán đến muộn | Đối soát rõ; không mất tiền hoặc cấp trùng |
| PAY-07 | Giá/tên gói thay đổi sau khi tạo đơn | Giữ snapshot đơn trong thời gian hiệu lực |
| PAY-08 | Cùng idempotency key đổi sản phẩm | Báo xung đột; không trả nhầm đơn |
| DIS-01 | Voucher hết hạn/chưa tới hạn/hết lượt/sai gói | Từ chối với thông báo rõ |
| DIS-02 | Hai giao dịch giành lượt voucher cuối | Không vượt chính sách sử dụng đã chốt |
| DIS-03 | Đơn VIP và video dùng cùng số dư xu | Không âm ví/tiêu trùng xu |
| DIS-04 | Mã cũ chưa được bật cho video | Không tự áp dụng sang video/combo |
| ADM-01 | Cấp thủ công video và combo, gửi lại request | Đúng quyền, không cấp trùng, có audit |
| ADM-02 | Thu hồi một đơn combo trong nhiều nguồn quyền | Không xóa quyền từ đơn/cấp khác |
| ADM-03 | Không đủ quyền admin hoặc sửa course ngoài phạm vi | API chặn, không chỉ ẩn nút |
| ADM-04 | Ngừng bán gói đã có khách mua | Chặn đơn mới, giữ quyền còn hiệu lực |
| ADM-05 | Thống kê có combo và cấp tay | Một combo tính doanh thu một lần; cấp tay không tăng tiền |
| VID-01 | Upload rồi refresh/rời admin/quay lại | Khôi phục asset và trạng thái, không tải lại vô ích |
| VID-02 | Upload chậm/mất mạng/xử lý lỗi | Có retry/resume phù hợp, không xóa asset hợp lệ tự động |
| VID-03 | Callback trạng thái trùng/giả hoặc đến sai thứ tự | Không biến video lỗi/chưa sẵn sàng thành ready |
| VID-04 | Lưu form cũ sau khi video xử lý xong | Không ghi đè thời lượng chuẩn |
| VID-05 | Phiên phát lỗi lần đầu rồi retry | Phát được và vẫn lưu tiến độ |
| VID-06 | Gia hạn phiên khi đang phát/tạm dừng | Giữ vị trí và trạng thái hợp lý |
| VID-07 | Link hết hạn/thu hồi quyền/chia sẻ link | Hành vi đúng phạm vi bảo vệ và TTL đã chốt |
| VID-08 | Manifest/segment/player trên các trình duyệt mục tiêu | Phát được, không có đường public vô tình bỏ qua bảo vệ |
| UX-01 | Mobile, desktop, bàn phím, mạng chậm | Không tràn, không kẹt trạng thái, biết bước tiếp theo |
| E2E-01 | Mua video -> thanh toán -> vào học -> reload | Đúng khóa, đúng quyền và tiến độ |
| E2E-02 | Cấp combo thủ công -> dùng cả hai phần -> thu hồi | Admin và người dùng thấy trạng thái khớp |

Không nhân mọi test với mọi tổ hợp một cách máy móc. Chạy đầy đủ các nhánh cấp quyền và mỗi kênh đang phát hành; kênh đang tắt giữ nguyên và ghi rõ chưa thử giao dịch thật.

## 8. Điểm sửa dự kiến và giới hạn thay đổi

| Nhóm file | Mục đích |
| --- | --- |
| `database/migrations/` | Migration bổ sung theo số tiếp theo còn trống |
| Backend routes/controllers/services/repositories mới | Danh mục video/combo, báo giá, quyền và quản trị |
| `backend/src/routes/payments.js` | Dispatcher theo loại đơn, chống nhầm nhánh và nối provider |
| `backend/src/models/Transaction.js` | Metadata/snapshot và lịch sử có phân loại |
| `backend/src/models/User.js` | Chỉ bổ sung khả năng cấp thành phần VIP trong transaction nếu cần, bảo toàn hành vi cũ |
| Coupon controllers và coin service | Phạm vi sản phẩm mới, giữ cơ chế cũ, kiểm soát tranh chấp liên luồng |
| Course repository/service và learning service | Quyền video mới, tương thích legacy, danh sách học và progress |
| Media/playback service và adapter Bunny mới | Upload, trạng thái, duration và phát video có kiểm tra quyền |
| Frontend trang video/combo/checkout mới | Luồng mua mới, theo design system hiện tại |
| Frontend admin mới, admin coupons, account | Quản lý và xem quyền/giao dịch mới, bổ sung trường cần thiết |
| `CourseAccessCard`, catalog/detail, `VideoUploadPanel`, `HlsPlayerShell` | Nối mua, upload và phát mới; sửa các lỗi liên quan trong báo cáo |

Không thay auth/device-slot đã sửa, không đổi cấu trúc `/vip`, không chuyển framework, không viết lại toàn bộ checkout/admin VIP. File cần chạm chung phải có thay đổi nhỏ, review được và có test hồi quy phù hợp.

## 9. Phát hành, khôi phục và vận hành

1. Thử migration trên dữ liệu đại diện trước; sao lưu theo quy trình hiện có khi áp dụng thật.
2. Đưa schema và backend tương thích lên trước, giữ mua mới tắt; sau đó đưa UI mới lên.
3. Xác minh đơn cũ, voucher, cấp tay, video cũ và người dùng đang có quyền.
4. Bật cho tài khoản kiểm thử, nghiệm thu đầy đủ rồi mới mở bán.
5. Khi lỗi, dừng tạo đơn mới; tiếp tục tiếp nhận/đối soát đơn đang chờ và phục vụ quyền đã bán.
6. Không rollback bằng cách xóa bảng có đơn/quyền mới. Bản backend khôi phục phải vẫn hiểu sản phẩm mới hoặc có đường xử lý tương thích.
7. Theo dõi lỗi tạo đơn, lệch tiền/quyền, tồn đơn chờ cấp, lỗi upload/transcode, lỗi phát và băng thông.
8. Log sử dụng mã đơn/asset/người dùng nội bộ cần thiết; không ghi secret Bunny, token phát hoặc thông tin thanh toán nhạy cảm.

## 10. Phụ thuộc và điều kiện hoàn thành

| Phụ thuộc | Cần sẵn sàng | Nếu chưa có |
| --- | --- | --- |
| Giá/thời hạn cấu hình admin; quy tắc mua trùng | Trước mở bán, không chặn ngày 1 | Dùng draft và dữ liệu thử; chưa nghiệm thu chính sách bán |
| Bunny library và quyền API | Khi thử thật, mục tiêu đầu ngày 4 | Ngày 1 đã thống nhất làm adapter/mock trước; chưa ghi Bunny end-to-end đã xong |
| Video mẫu và nội dung được phép upload | Ngày 1 mẫu nhỏ, ngày 4 khóa đầu | Chỉ nghiệm thu với mẫu có sẵn |
| Database và cổng thanh toán thử | Ngày 1-2 | Chưa xác minh webhook/đối soát thực tế |
| Thiết bị/trình duyệt mục tiêu | Ngày 4-5 | Ghi rõ phần chưa kiểm tra, không thay bằng suy đoán |
| Tốc độ upload/xử lý 10 GB | Ngày 4 | Có thể kéo dài nhập dữ liệu; không bỏ kiểm tra playback để kịp thời gian |

Điều kiện hoàn thành:

- [ ] Trang và hành vi gói hiện tại giữ nguyên theo baseline và kiểm thử hồi quy.
- [ ] Người dùng mua riêng video hoặc combo, hiểu rõ nhận gì và trong bao lâu.
- [ ] Mọi chức năng hiện có trong ma trận ngày 1 có chức năng tương ứng cho sản phẩm mới.
- [ ] Không cấp VIP từ đơn video-only; không có đơn combo hoàn tất mà thiếu một phần quyền.
- [ ] Voucher/xu/đơn 0 đồng/cấp thủ công/thu hồi/lịch sử/thống kê hoạt động và đối soát được.
- [ ] Khách cũ không mất quyền do migration; quyền mới không mở nhầm khóa.
- [ ] Admin quản lý gói, khóa, đơn và quyền từ hệ thống hiện có, không cần sửa database tay.
- [ ] Bunny upload, xử lý, phát bảo vệ và lưu tiến độ được kiểm thử thật trong môi trường đã nêu.
- [ ] Các lỗi video liên quan được sửa hoặc cô lập rõ ở đường legacy không thay đổi; không mang lỗi đã biết vào luồng mới.
- [ ] Có bằng chứng test, hướng dẫn admin và phương án dừng bán/khôi phục an toàn cho đơn đã thu tiền.
- [ ] Tất cả quyết định kinh doanh còn mở được ghi rõ; không tự thay chúng bằng mặc định không được thống nhất.

Phạm vi 5 ngày tập trung vào một đợt phát hành hoàn chỉnh cho gói video/combo và một khóa Bunny đầu tiên. Chuyển toàn bộ kho video cũ, DRM nâng cao, tải offline, thanh toán định kỳ hoặc nâng cấp tự bù tiền sẽ được lập kế hoạch riêng nếu cần.
