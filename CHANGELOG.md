# Changelog

Ghi log cập nhật theo từng version để sau này dễ biết bản nào sửa gì.

## Version 3.1 - 2026-06-12

- Đổi PWA icon/favion sang icon mèo MOLI mới.
- Đổi URL icon sang tên `app-icon-v3-*` để Chrome không dùng lại icon cũ trong cache.
- Bump service worker version để người dùng nhận manifest/icon mới.

## Version 3.0 - 2026-06-12

- Hoàn thiện PWA: manifest, icon, offline page, service worker.
- Thêm banner/mục cài app cho PC, Android, iPhone.
- Thêm hướng dẫn cài app có thể bấm lại trong Hồ sơ > Cài đặt.
- Thêm popup báo có bản cập nhật mới, bấm cập nhật để tải bản mới.
- Thêm lưu bài thi offline, khôi phục draft, đồng bộ lại khi có mạng.
- Thêm lưu lệnh nộp bài offline và tự gửi lại khi online.
- Thêm chặn nhiều tab cùng một bài thi để tránh ghi đè draft.
- Thêm push notification: lưu thiết bị, gửi test, nhắc học, nhắc lịch thi.

## Cách tăng version

1. Sửa `APP_VERSION` trong `frontend/lib/appVersion.ts`.
2. Sửa cùng version trong `frontend/public/sw.js`.
3. Thêm mục mới ở đầu file `CHANGELOG.md`.
4. Deploy/push. Người dùng cũ sẽ thấy popup cập nhật khi service worker mới sẵn sàng.
