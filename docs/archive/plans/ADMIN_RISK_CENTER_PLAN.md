# Kế hoạch Admin Risk Center

## Mục tiêu

Tạo một trang admin tổng để quản lý tập trung các rủi ro quan trọng:

- Người dùng gian lận khi làm đề.
- Log chụp màn hình, chuyển tab, blur cửa sổ, copy, print.
- Đề thi hoặc câu hỏi bị report/lỗi bất thường.
- Thanh toán lỗi, pending lâu, trùng giao dịch, nghi gian lận.
- Thông báo realtime cho admin tổng.
- Lịch sử xử lý và audit log đầy đủ.

## Route

- Trang chính: `/admin/risk-center`
- Chỉ admin có quyền `risk_center.view` mới xem được.
- Chỉ admin có quyền `risk_center.manage` mới dùng action xử lý mạnh.

## Phân quyền

- `super_admin`: xem tất cả, dùng mọi action mạnh, xem raw payment/provider response.
- `admin`: xem và xử lý case theo quyền được cấp.
- `support`: chỉ xem, ghi note, đánh dấu đang xem/đã xử lý nếu được cấp quyền.

## Tabs

- Gian lận thi
- Thanh toán
- Báo lỗi đề
- Thông báo hệ thống
- Audit log

## Data Model

### `admin_notifications`

Dùng để lưu thông báo cho admin.

- `id`
- `type`
- `severity`
- `title`
- `message`
- `entity_type`
- `entity_id`
- `user_id`
- `read_at`
- `resolved_at`
- `resolved_by`
- `metadata`
- `created_at`

### `admin_audit_logs`

Dùng để ghi lại mọi action nhạy cảm.

- `id`
- `admin_id`
- `action`
- `entity_type`
- `entity_id`
- `before_data`
- `after_data`
- `reason`
- `ip_address`
- `user_agent`
- `created_at`

### `exam_risk_cases`

Dùng để gom violation thành case cho admin xử lý.

- `id`
- `attempt_id`
- `user_id`
- `exam_id`
- `severity`
- `status`
- `risk_score`
- `violation_count`
- `violation_types`
- `last_violation_at`
- `summary`
- `admin_note`
- `resolved_by`
- `resolved_at`
- `created_at`
- `updated_at`

## Status Chuẩn

- `open`: case mới, chưa xử lý.
- `reviewing`: admin đang xem.
- `resolved`: đã xử lý.
- `ignored`: bỏ qua hợp lệ.
- `escalated`: đẩy lên admin tổng.
- `reverted`: đã rollback action trước đó.

## Severity Chuẩn

- `low`
- `medium`
- `high`
- `critical`

## Phase A: Nền Bắt Buộc

### UI

Trang `/admin/risk-center` gồm:

- Summary cards:
  - Critical open
  - Payment pending
  - Exam reports
  - Question reports
  - Today violations
  - Unread notifications
- Tabs theo nhóm rủi ro.
- Bảng dữ liệu có filter.
- Drawer chi tiết khi click vào một dòng.

### Filter

- Theo ngày.
- Theo user.
- Theo đề thi.
- Theo severity.
- Theo status.
- Theo loại event.

### Drawer Chi Tiết

Drawer hiển thị:

- Timeline sự kiện.
- Raw event metadata.
- User liên quan.
- Attempt/payment/question liên quan.
- Admin notes.
- Action buttons.
- Audit history riêng của case.

## Phase B: Gian Lận Thi

### Nguồn Dữ Liệu

Gom từ bảng/log violation hiện có.

Loại vi phạm:

- `tab_switch`
- `window_blur`
- `copy`
- `print`
- `screenshot_suspected`
- `fullscreen_exit`
- `multi_tab_conflict`
- `devtools`

### Hiển Thị

- User.
- Bài thi.
- Attempt.
- Loại vi phạm.
- Số lần vi phạm.
- Risk score.
- Mức độ.
- Thời gian gần nhất.
- Trạng thái xử lý.

### Rule Risk

- `tab_switch >= 3`: `high`.
- `window_blur >= 5`: `critical`.
- `copy`: `critical` ngay.
- `print`: `critical` ngay.
- `screenshot_suspected`: `critical` ngay.
- `devtools`: `critical` ngay.
- Nhiều loại vi phạm trong cùng attempt: tăng `risk_score`.

### Action Nhẹ

- Xem chi tiết bài làm.
- Xem user profile.
- Ghi note nội bộ.
- Đánh dấu đã xem.
- Đánh dấu đã xử lý.
- Gửi cảnh báo user.
- Escalate lên admin tổng.

### Action Mạnh

Chỉ `super_admin` hoặc role được cấp quyền riêng mới được dùng.

- `lock_attempt`: khóa attempt, user không sửa/nộp tiếp.
- `force_submit_attempt`: ép nộp bài hiện tại.
- `invalidate_attempt`: hủy kết quả, không tính điểm.
- `restore_attempt`: khôi phục bài đã hủy.
- `ban_exam_access`: cấm user làm lại đề đó.
- `temporary_suspend_user`: khóa học/làm đề trong X giờ/ngày.
- `permanent_ban_user`: khóa tài khoản.
- `mark_clean`: xác nhận không gian lận, đóng case.
- `export_evidence`: xuất log bằng chứng.

### Điều Kiện Action Mạnh

Mỗi action mạnh bắt buộc:

- Modal confirm.
- Nhập lý do.
- Hiện cảnh báo tác động.
- Ghi `admin_audit_logs`.
- Lưu `before_data`.
- Lưu `after_data`.
- Có rollback nếu hợp lý.

## Phase C: Thanh Toán Risk

### Cases Cần Bắt

- Payment pending quá lâu.
- Payment fail.
- Callback lỗi.
- User nạp nhưng chưa cộng xu/VIP.
- Transaction ID trùng.
- Amount lệch.
- Provider response bất thường.
- User có nhiều giao dịch fail liên tục.

### Hiển Thị

- User.
- Gói thanh toán.
- Số tiền.
- Trạng thái.
- Mã giao dịch.
- Provider.
- Thời gian tạo.
- Thời gian callback.
- Lý do lỗi.
- Risk flag.

### Action Nhẹ

- Xem chi tiết giao dịch.
- Sync lại giao dịch.
- Đánh dấu đã xử lý.
- Mark suspicious.
- Ghi note nội bộ.

### Action Mạnh

- `manual_credit_coins`: cộng xu thủ công.
- `manual_grant_vip`: cấp VIP thủ công.
- `revoke_coins`: thu hồi xu.
- `revoke_vip`: thu hồi VIP.
- `lock_payment_method`: khóa phương thức thanh toán.
- `flag_user_payment_risk`: gắn cờ user rủi ro thanh toán.
- `resolve_duplicate_payment`: xử lý giao dịch trùng.

### Điều Kiện Action Mạnh Thanh Toán

- Chỉ admin tổng.
- Nhập lý do.
- Bắt buộc audit log.
- Hiện before/after balance.
- Nếu cộng/thu hồi xu/VIP thì lưu ledger rõ ràng.

## Phase D: Báo Lỗi Đề

### Nguồn

User hoặc admin report câu hỏi lỗi.

Loại lỗi:

- Sai đáp án.
- Lỗi công thức.
- Lỗi dịch.
- Thiếu ảnh.
- Thiếu dữ liệu.
- Câu hỏi trùng.
- Đáp án không khớp.

### Hiển Thị

- Đề thi.
- Câu số.
- Nội dung report.
- Loại lỗi.
- Người báo.
- Số lần report.
- Trạng thái.
- Thời gian.

### Action Nhẹ

- Mở editor đúng câu.
- Chạy AI soát riêng câu đó.
- Đánh dấu fixed.
- Đánh dấu ignored.
- Gửi phản hồi user.
- Ghi note nội bộ.

### Action Mạnh

- `hide_question`: tạm ẩn câu khỏi đề.
- `hide_exam`: tạm ẩn cả đề.
- `apply_ai_fix`: apply sửa bằng AI có preview.
- `rollback_question_fix`: rollback bản sửa.
- `regrade_affected_attempts`: chấm lại attempts bị ảnh hưởng nếu đổi đáp án.
- `notify_affected_users`: thông báo user bị ảnh hưởng.

### Điều Kiện Regrade

Nếu sửa đáp án đúng:

- Tính danh sách attempts bị ảnh hưởng.
- Preview thay đổi điểm.
- Admin confirm.
- Ghi audit log.
- Cập nhật điểm.
- Gửi thông báo nếu cần.

## Phase E: Realtime Notification

### Khi Nào Tạo Notification

- Vi phạm thi đạt ngưỡng `high` hoặc `critical`.
- Payment pending quá ngưỡng.
- Payment fail bất thường.
- User report câu hỏi critical.
- Action mạnh được thực hiện.

### UI Realtime

- Badge đỏ trên admin header.
- Notification drawer.
- Toast nếu admin đang online.
- Âm báo nhẹ nếu setting bật.

### Cách Làm

- Nếu app đã có socket: dùng socket để push realtime.
- Nếu chưa có socket: polling 15-30 giây trước, sau đó nâng lên socket.

## Admin Header Notification

Header admin cần có:

- Icon chuông.
- Badge số notification chưa đọc.
- Dropdown notification mới.
- Link tới `/admin/risk-center`.

Notification item hiển thị:

- Severity badge.
- Title.
- Message ngắn.
- Time.
- Button mark read.
- Button open case.

## Audit Log

Mọi action nhạy cảm phải ghi:

- Admin nào làm.
- Làm gì.
- Entity nào.
- Before data.
- After data.
- Lý do.
- IP.
- User agent.
- Thời gian.

Action cần audit:

- Khóa attempt.
- Ép nộp bài.
- Hủy kết quả.
- Khôi phục kết quả.
- Khóa user.
- Mở khóa user.
- Cộng xu.
- Thu hồi xu.
- Cấp VIP.
- Thu hồi VIP.
- Ẩn câu hỏi.
- Ẩn đề.
- Chấm lại bài.
- Apply AI fix.
- Rollback fix.

## API Đề Xuất

### Risk Center

- `GET /api/admin/risk-center/summary`
- `GET /api/admin/risk-center/exam-risks`
- `GET /api/admin/risk-center/payment-risks`
- `GET /api/admin/risk-center/question-reports`
- `GET /api/admin/risk-center/notifications`
- `GET /api/admin/risk-center/audit-logs`

### Exam Risk Actions

- `POST /api/admin/risk-center/exam-risks/:id/note`
- `POST /api/admin/risk-center/exam-risks/:id/resolve`
- `POST /api/admin/risk-center/exam-risks/:id/ignore`
- `POST /api/admin/risk-center/exam-risks/:id/escalate`
- `POST /api/admin/risk-center/exam-risks/:id/warn-user`
- `POST /api/admin/risk-center/exam-risks/:id/lock-attempt`
- `POST /api/admin/risk-center/exam-risks/:id/force-submit`
- `POST /api/admin/risk-center/exam-risks/:id/invalidate-attempt`
- `POST /api/admin/risk-center/exam-risks/:id/restore-attempt`
- `POST /api/admin/risk-center/exam-risks/:id/ban-exam-access`
- `POST /api/admin/risk-center/exam-risks/:id/suspend-user`
- `POST /api/admin/risk-center/exam-risks/:id/ban-user`
- `POST /api/admin/risk-center/exam-risks/:id/mark-clean`

### Payment Risk Actions

- `POST /api/admin/risk-center/payment-risks/:id/sync`
- `POST /api/admin/risk-center/payment-risks/:id/resolve`
- `POST /api/admin/risk-center/payment-risks/:id/mark-suspicious`
- `POST /api/admin/risk-center/payment-risks/:id/manual-credit-coins`
- `POST /api/admin/risk-center/payment-risks/:id/manual-grant-vip`
- `POST /api/admin/risk-center/payment-risks/:id/revoke-coins`
- `POST /api/admin/risk-center/payment-risks/:id/revoke-vip`

### Question Report Actions

- `POST /api/admin/risk-center/question-reports/:id/resolve`
- `POST /api/admin/risk-center/question-reports/:id/ignore`
- `POST /api/admin/risk-center/question-reports/:id/run-ai-review`
- `POST /api/admin/risk-center/question-reports/:id/apply-ai-fix`
- `POST /api/admin/risk-center/question-reports/:id/hide-question`
- `POST /api/admin/risk-center/question-reports/:id/hide-exam`
- `POST /api/admin/risk-center/question-reports/:id/regrade-affected-attempts`

## Ngưỡng Cảnh Báo

Config trong admin settings:

- Chuyển tab >= 3 lần: tạo high risk.
- Blur cửa sổ >= 5 lần: tạo critical risk.
- Copy: critical ngay.
- Print: critical ngay.
- Screenshot suspected: critical ngay.
- Payment pending > 10 phút: tạo notification.
- Payment fail >= 3 lần/30 phút/user: tạo payment risk.
- Một câu hỏi bị report >= 3 lần: tạo high question risk.

Không auto-ban mặc định. Hệ thống chỉ auto tạo case và notify. Action mạnh do admin tổng bấm.

## UX Action Mạnh

Khi bấm action mạnh:

1. Mở modal confirm.
2. Hiện tác động rõ ràng.
3. Bắt nhập lý do.
4. Nếu action không rollback được, hiện cảnh báo riêng.
5. Submit.
6. Backend check role.
7. Backend ghi audit log.
8. Backend thực hiện action.
9. Tạo notification nội bộ.
10. Cập nhật drawer/table.

## Thứ Tự Triển Khai

### Phase A: Nền bắt buộc

1. Migration `admin_notifications`.
2. Migration `admin_audit_logs`.
3. Migration `exam_risk_cases`.
4. API summary.
5. UI `/admin/risk-center`.
6. Admin header notification badge.

### Phase B: Gian lận thi

1. Gom violation log thành risk case.
2. Bảng gian lận thi.
3. Drawer chi tiết.
4. Action nhẹ.
5. Action mạnh: lock, force submit, invalidate, restore.
6. Audit log.

### Phase C: Thanh toán

1. Detect pending/fail/duplicate.
2. Bảng payment risk.
3. Sync payment.
4. Manual credit/grant/revoke.
5. Audit + ledger.

### Phase D: Báo lỗi đề

1. Report question API/UI nếu chưa có.
2. Bảng report đề.
3. Chạy AI soát câu.
4. Apply fix có preview.
5. Hide question/exam.
6. Regrade attempts bị ảnh hưởng.

### Phase E: Realtime

1. Polling notification.
2. Toast admin.
3. Socket realtime nếu cần.
4. Âm báo theo setting.

## Nguyên Tắc An Toàn

- Không auto-ban mặc định.
- Không action mạnh nếu không có lý do.
- Không action mạnh nếu không có audit log.
- Action mạnh chỉ cho admin tổng hoặc quyền riêng.
- Payment manual phải có ledger.
- Sửa đáp án phải preview regrade.
- Hủy kết quả phải có restore nếu có thể.
- Raw provider/payment response chỉ admin tổng xem.

## Kết Quả Mong Muốn

Admin tổng có một nơi để xem, lọc, xử lý, rollback và audit toàn bộ rủi ro quan trọng:

- Gian lận thi.
- Thanh toán lỗi/nghi vấn.
- Đề thi bị report.
- Notification realtime.
- Lịch sử action minh bạch.
