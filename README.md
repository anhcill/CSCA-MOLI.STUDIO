# CSCA MOLI.STUDIO

Nền tảng luyện thi CSCA cho học sinh Việt Nam: luyện đề mô phỏng, học từ vựng, theo dõi tiến độ, phân tích kết quả bằng AI, quản trị đề thi và nội dung học tập.

## Tổng Quan

- `frontend/`: ứng dụng Next.js, App Router, giao diện học sinh/admin.
- `backend/`: Express API, Socket.IO, PostgreSQL, xác thực, AI, thanh toán và quản trị.
- `database/`: schema, seed và migration SQL.
- `docs/`: tài liệu, ghi chú, tài sản phụ.
- `tools/`: script debug, script hỗ trợ, bản vá tạm đã lưu lại.

Chi tiết cấu trúc repo xem tại [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md).

## Tính Năng Chính

- Đăng ký, đăng nhập email, Google, Facebook.
- Luyện đề CSCA theo môn: Toán, Vật Lý, Hóa, Tiếng Trung tự nhiên, Tiếng Trung xã hội.
- Trang SEO cho các cụm từ khóa ôn thi CSCA, đề thi CSCA, từ vựng CSCA và từng môn.
- Làm bài thi, lưu lịch sử, xem điểm, phân tích kết quả.
- Hỏi đáp, diễn đàn, tài liệu học tập, game học tập.
- Admin quản lý người dùng, đề thi, câu hỏi, bài viết, VIP, báo cáo và nội dung.
- Backend hỗ trợ JWT, rate limit, upload Cloudinary, email OTP/reset password, Socket.IO.

## Công Nghệ

Frontend:

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Axios

Backend:

- Node.js
- Express
- PostgreSQL
- Socket.IO
- JWT
- Cloudinary
- Nodemailer/Brevo

## Cài Đặt Local

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Database local bằng Docker:

```bash
docker-compose up -d
```

## Biến Môi Trường

Không commit file `.env`, `.env.local`, `.env.production` hoặc key thật lên Git.

Backend dùng `backend/.env.example` làm mẫu. Các nhóm biến chính:

```env
DATABASE_URL=your_database_connection_string
JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_a_long_random_secret
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BREVO_API_KEY=your_brevo_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Frontend dùng `frontend/.env.example` làm mẫu. Chỉ biến có tiền tố `NEXT_PUBLIC_` mới được lộ ra trình duyệt.

## Script Hay Dùng

Frontend:

```bash
cd frontend
npm run build
npm run dev
npm run start
```

Backend:

```bash
cd backend
npm run dev
npm run start
npm test
```

Một số script hỗ trợ:

- `backend/scripts/`: script backend có thể dùng lại.
- `backend/scripts/one-off/`: script chạy một lần, dùng cẩn thận.
- `tools/db/`: script kiểm tra hoặc cập nhật dữ liệu thủ công.
- `tools/debug/`: script debug local/production.

## Deploy

- Backend có thể deploy qua Railway bằng `railway.toml`, `Dockerfile`, `build.sh`, `start.sh`.
- Frontend có thể deploy qua Vercel hoặc hệ thống Next.js tương đương.
- `docker-compose.yml` chỉ dùng cho database local/pgAdmin.

## Bảo Mật

- Repo đã ignore `node_modules`, `.next`, log, cache, file `.env` và file runtime.
- Không hard-code connection string, API key, access token hoặc secret trong source.
- Nếu key thật từng bị push lên GitHub, cần rotate key ở dịch vụ gốc. Commit mới chỉ làm sạch phiên bản hiện tại, không tự xóa lịch sử Git cũ.
- Khi thêm biến môi trường mới, cập nhật file `.env.example` bằng placeholder, không đưa giá trị thật.

## Ghi Chú Cho Phát Triển

- Thay đổi database chính thức nên đi qua `database/migrations/`.
- Script tạm không để ở root; chuyển vào `tools/` hoặc `backend/scripts/one-off/`.
- Tài liệu phụ, PDF, kế hoạch cũ để trong `docs/`.
- Root chỉ giữ file cấu hình/deploy chung và README.
