# Đề Xuất Tính Năng Bổ Sung

Ngày rà soát: 2026-06-01
Giả định: hệ thống hiện tại vận hành ổn, cần chọn tính năng giúp tăng học viên, giữ chân người học và tăng doanh thu.

## Kết Luận Nhanh

Nên bổ sung tính năng, nhưng không nên thêm dàn trải. Dự án đã có nhiều mảng: đề thi, từ vựng, AI, VIP, forum, tài liệu, admin. Giai đoạn tiếp theo nên tập trung vào 5 nhóm có tác động lớn:

1. Lộ trình học cá nhân hóa.
2. Ôn lỗi sai thông minh.
3. Mô phỏng thi thật đầy đủ.
4. Dashboard phụ huynh/giáo viên.
5. Hệ thống nhiệm vụ, streak, huy hiệu để giữ chân học viên.

## Tính Năng Nên Làm Ưu Tiên Cao

### 1. Lộ trình học cá nhân hóa theo mục tiêu

Hiện đã có AI phân tích và lịch sử làm bài, nên bước tiếp theo hợp lý là biến phân tích thành kế hoạch học cụ thể.

Nên có:

- Người học chọn mục tiêu: thi sau bao nhiêu ngày, mục tiêu điểm, môn yếu.
- Hệ thống tạo lịch học 7/15/30 ngày.
- Mỗi ngày có checklist: học từ vựng, làm đề, ôn câu sai, xem tài liệu.
- Tự điều chỉnh lộ trình sau mỗi lần làm bài.

Lý do nên làm:

- Tạo cảm giác web không chỉ là nơi làm đề, mà là "gia sư học CSCA".
- Tăng tỉ lệ quay lại mỗi ngày.
- Dễ gắn với VIP/Premium.

### 2. Sổ tay lỗi sai cá nhân

Sau mỗi đề, hệ thống tự gom câu sai vào một khu riêng.

Nên có:

- Danh sách câu sai theo môn/chủ đề/dạng câu.
- Nút "Làm lại câu sai".
- Ghi chú cá nhân cho từng câu.
- AI giải thích vì sao sai và cách tránh lỗi tương tự.
- Tự nhắc ôn lại câu sai sau 1 ngày, 3 ngày, 7 ngày.

Lý do nên làm:

- Đây là tính năng học thật, giá trị cao hơn chỉ xem điểm.
- Dùng lại dữ liệu đã có từ `exam_attempts`, `user_answers`, AI explanation.

### 3. Chế độ thi thử như thi thật

Hiện có làm đề và phòng thi, nhưng nên đóng gói thành trải nghiệm thi thật rõ hơn.

Nên có:

- Fullscreen exam mode.
- Countdown nghiêm túc.
- Tự nộp khi hết giờ.
- Cảnh báo rời tab/chụp màn hình/copy paste.
- Bảng kết quả giống phiếu điểm.
- Certificate hoặc badge sau khi đạt mốc.

Lý do nên làm:

- Phù hợp định vị luyện thi CSCA.
- Dễ bán gói Premium: "thi mô phỏng chuẩn".

### 4. Dashboard học tập cho phụ huynh/giáo viên

Nếu muốn mở rộng B2C/B2B, nên có chế độ theo dõi học viên.

Nên có:

- Phụ huynh/giáo viên xem tiến độ học viên.
- Số đề đã làm, điểm trung bình, môn yếu.
- Cảnh báo học viên bỏ học nhiều ngày.
- Xuất báo cáo PDF hằng tuần.
- Gán bài tập/deadline cho học viên.

Lý do nên làm:

- Tạo hướng doanh thu mới: lớp học, trung tâm, nhóm học.
- Khác biệt hơn so với web luyện đề đơn thuần.

### 5. Gamification học tập

Đã có ví xu/rank/game, nên nên gom lại thành hệ nhiệm vụ học tập rõ ràng.

Nên có:

- Streak học mỗi ngày.
- Daily quests: học 20 từ, làm 10 câu, sửa 5 lỗi sai.
- Huy hiệu theo mốc: 7 ngày liên tục, 100 từ vựng, 10 đề hoàn thành.
- Leaderboard theo tuần/tháng.
- Xu thưởng dùng để mở phân tích AI hoặc tài liệu.

Lý do nên làm:

- Tăng retention.
- Tận dụng sẵn coin/rank/game.

## Tính Năng Nên Làm Sau

### 6. Ngân hàng đề theo chuyên đề

Nên tách rõ đề tổng hợp và bộ câu hỏi theo chuyên đề.

Ví dụ:

- Toán: hàm số, hình học, xác suất.
- Vật lý: cơ học, điện, quang.
- Hóa: vô cơ, hữu cơ, phản ứng.
- Tiếng Trung: đọc hiểu, từ vựng, ngữ pháp.

Giá trị:

- Học viên yếu phần nào luyện đúng phần đó.
- Admin dễ tạo bộ đề nhỏ.

### 7. AI gia sư trong từng câu hỏi

Không chỉ AI phân tích sau bài, mà có AI ngay trong quá trình ôn.

Nên có:

- "Giải thích câu này".
- "Cho ví dụ tương tự".
- "Tạo 5 câu luyện thêm dạng này".
- "Dịch đề sang tiếng Việt dễ hiểu".

Giá trị:

- Rất hợp với Premium.
- Tăng thời gian học trong app.

### 8. Import đề từ Word/Excel

Đang có PDF import, nhưng admin thường nhập đề từ Word/Excel dễ hơn.

Nên có:

- Import `.docx`.
- Import `.xlsx` theo template.
- Preview trước khi lưu giống PDF import.
- Báo lỗi dòng/câu thiếu đáp án.

Giá trị:

- Giảm công nhập liệu cho admin.
- Dễ scale ngân hàng đề.

### 9. Mobile/PWA

Nếu học sinh dùng điện thoại nhiều, nên thêm PWA.

Nên có:

- Install web như app.
- Offline từ vựng/flashcard cơ bản.
- Push notification nhắc học.
- UI làm đề tối ưu mobile hơn.

Giá trị:

- Tăng quay lại mỗi ngày.
- Hợp flashcard và từ vựng.

### 10. Cộng đồng hỏi đáp theo câu hỏi

Forum đang có, nhưng nên nối trực tiếp với từng câu hỏi.

Nên có:

- Dưới mỗi câu có tab thảo luận.
- Học viên hỏi vì sao đáp án đúng.
- Admin/giáo viên ghim lời giải chuẩn.
- Vote câu trả lời hay.

Giá trị:

- Nội dung cộng đồng tự tăng.
- Câu khó có lời giải phong phú hơn.

## Tính Năng Kiếm Tiền Nên Thêm

### Gói Premium rõ quyền lợi hơn

Nên chia quyền lợi dễ hiểu:

- Free: làm đề cơ bản, xem điểm.
- VIP: phân tích AI, sổ lỗi sai, flashcard nâng cao.
- Premium: thi mô phỏng, video giải đề, AI gia sư, lộ trình cá nhân hóa.

### Trial Premium 3 ngày

Cho dùng thử giới hạn:

- 1 lần AI phân tích.
- 1 đề mô phỏng.
- 1 báo cáo lộ trình.

Mục tiêu: tăng chuyển đổi trả phí.

### Combo lớp học/trung tâm

Tạo mã lớp:

- Giáo viên tạo lớp.
- Học viên nhập mã lớp.
- Giáo viên xem dashboard chung.

Mục tiêu: bán theo nhóm, không chỉ bán từng học viên.

## Thứ Không Nên Làm Vội

- Thêm quá nhiều game mới nếu chưa chứng minh game giúp học tốt hơn.
- Làm mạng xã hội lớn kiểu Facebook.
- Làm app native iOS/Android ngay; PWA trước đủ.
- Thêm nhiều AI feature rời rạc khi chưa có lộ trình học chính.
- Làm marketplace tài liệu khi ngân hàng đề/lộ trình chưa mạnh.

## Roadmap Đề Xuất

### Giai đoạn 1: 2-3 tuần

- Sổ tay lỗi sai.
- Làm lại câu sai.
- Daily streak + nhiệm vụ học.
- Update trang kết quả để dẫn người học sang ôn lỗi.

### Giai đoạn 2: 3-5 tuần

- Lộ trình học cá nhân hóa 7/15/30 ngày.
- AI gợi ý bài học tiếp theo.
- Dashboard tiến độ đẹp hơn.
- Premium gate cho lộ trình nâng cao.

### Giai đoạn 3: 1-2 tháng

- Thi mô phỏng full mode.
- Certificate/badge.
- Dashboard phụ huynh/giáo viên.
- Import Word/Excel cho admin.

## Ưu Tiên Nếu Chỉ Chọn 3 Tính Năng

1. Sổ tay lỗi sai cá nhân.
2. Lộ trình học cá nhân hóa.
3. Chế độ thi thử như thi thật.

Ba tính năng này bám sát mục tiêu luyện thi, dùng lại dữ liệu hiện có, dễ tạo khác biệt và dễ đưa vào gói trả phí.
