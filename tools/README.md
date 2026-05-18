# Tools

Các file trong thư mục này là script hỗ trợ, debug hoặc bản vá một lần. Chúng không nằm trên luồng chạy chính của frontend/backend.

- `debug/ai-stream/`: script kiểm tra streaming AI local/production.
- `db/`: script kiểm tra hoặc cập nhật dữ liệu thủ công.
- `archive/patches/`: script vá tạm đã dùng trước đây, giữ lại để tham khảo.

Ưu tiên dùng migration trong `database/migrations/` và script chính trong `backend/scripts/` cho thay đổi thật sự cần chạy lại.
