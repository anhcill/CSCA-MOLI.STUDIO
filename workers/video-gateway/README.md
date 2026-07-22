# CSCA private HLS gateway

Cloudflare Worker này xác thực playback JWT do Railway phát hành rồi đọc HLS
trực tiếp từ private R2 binding. Playlist được viết lại để mọi URI con tiếp tục
mang token; R2 key và token không được trả về trong lỗi hay log.

## Cấu hình

1. Dùng `wrangler.jsonc` làm cấu hình production; file này không chứa secret.
2. Tạo R2 binding `VIDEO_BUCKET` trỏ đúng bucket video private.
3. Khai báo đúng issuer, audience và danh sách origin frontend, phân tách bằng dấu phẩy.
4. Chạy `wrangler secret put VIDEO_PLAYBACK_TOKEN_SECRET` và nhập cùng secret trên Railway.
5. Tắt public `r2.dev`; route production chỉ trỏ tới Worker.

Không deploy Worker trước khi hoàn thành checklist trong
`docs/VIDEO_GATEWAY_DAY2.md`. Không bật observability ghi URL/query string vì JWT
được truyền trong query của playlist/segment.
