Kế hoạch cụ thể (14 ngày, 1 dev full-time)
Mục tiêu: xử lý toàn bộ lỗi admin hiện tại, mở quyền admin theo chức năng, và liên kết đúng forum + lộ trình + phòng thi.

Ngày 1: Dọn lỗi P0 đang vỡ chức năng
Sửa sai middleware quyền ảnh tại imageRoutes.js:47.
Đồng bộ API upload/xóa ảnh giữa FE-BE tại imageApi.ts:11, imageApi.ts:27, imageRoutes.js:51, imageRoutes.js:109.
Đồng bộ field số câu hỏi đề thi FE-BE tại page.tsx:169, page.tsx:121, adminExamController.js:436.
Hiển thị recent activity ở dashboard admin từ dữ liệu thật tại page.tsx:287, adminController.js:50.
Chặn page/limit bất thường ở user admin API tại adminController.js:65.
Kết quả mong đợi: admin dùng được đầy đủ cụm quản trị hiện tại, không lỗi contract.
Ngày 2-3: Gỡ chặn admin khỏi luồng student và thay guard đúng
Bỏ redirect cưỡng bức admin trong StudentOnly.tsx:30.
Chuyển guard theo route group thay vì bọc toàn app ở Providers.tsx:10.
Giữ admin truy cập được forum/lộ trình/phòng thi khi có quyền module.
Kết quả mong đợi: admin không còn bị đẩy về dashboard khi vào page.tsx, page.tsx, page.tsx.
Ngày 4-6: Nền RBAC (admin tổng + admin chức năng)
Tạo migration mới: roles, permissions, role_permissions, user_roles, audit logs.
Seed role chuẩn: super_admin, user_admin, forum_admin, roadmap_admin, exam_admin, content_admin.
Thêm middleware authorizePermission dựa trên user_roles + cache ngắn.
Giữ tương thích role cũ admin/student để không gãy hệ thống.
Kết quả mong đợi: phân quyền theo chức năng chạy song song an toàn với hệ cũ.
Ngày 7-8: Forum theo quyền module
Tách quyền đăng thông báo chính thức và quyền moderation.
Thêm trường post_type, moderation_status, moderated_by, moderated_at.
Endpoint moderation riêng trong cụm admin forum.
Áp dụng vào posts.js, postController.js, Post.js.
Kết quả mong đợi: admin thường không thể làm việc ngoài quyền forum.
Ngày 9-10: Lộ trình theo quyền module
Tách roadmap template quản trị và roadmap progress người dùng.
Thêm admin API CRUD roadmap template.
API người dùng roadmap đọc theo template mới.
Áp dụng vào userController.js:204, page.tsx:21.
Kết quả mong đợi: roadmap có thể quản trị tập trung, không hardcode milestone.
Ngày 11-12: Phòng thi theo quyền module
Thêm admin API quản lý lịch live/upcoming, publish window, ràng buộc thời gian.
Log thay đổi lịch thi để truy vết.
Áp dụng vào exams.js:7, examController.js:6, Exam.js:5, page.tsx:29.
Kết quả mong đợi: exam admin quản được phòng thi mà không cần full admin.
Ngày 13: QA và test ma trận quyền
Viết test quyền theo role-permission cho toàn bộ route admin.
Smoke test 3 luồng quan trọng: forum moderation, roadmap admin, exam-room schedule.
Test regression cụm lỗi P0.
Kết quả mong đợi: không còn bypass quyền hoặc false deny.
Ngày 14: Rollout an toàn
Chạy migration production theo từng bước có backup.
Bật feature flag cho RBAC mới.
Theo dõi log deny/allow và error rate 24h.
Kết quả mong đợi: phát hành an toàn, rollback được nếu cần.
Backlog ưu tiên để làm ngay hôm nay

P0-001: Fix cụm ảnh admin FE-BE.
P0-002: Fix field đề thi và dashboard recent activity.
P0-003: Sửa StudentOnly để admin vào được forum/lộ trình/phòng thi.
P1-001: Migration RBAC + middleware authorizePermission.
P1-002: Tách quyền forum admin.
P1-003: Tách quyền roadmap admin.
P1-004: Tách quyền exam-room admin.
Nếu bạn muốn, mình có thể bắt đầu ngay từ P0 và triển khai trực tiếp theo đúng thứ tự 1 → 3, xong mỗi mục mình gửi diff + checklist test luôn.

