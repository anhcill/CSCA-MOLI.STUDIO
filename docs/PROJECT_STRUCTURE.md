# Cấu Trúc Dự Án

Root của repo chỉ nên giữ các file vận hành chung và các thư mục chính.

```text
.
├── backend/                 # Express API, socket, service, script backend
│   ├── src/                 # Source chính của backend
│   └── scripts/             # Migration/helper script backend
│       └── one-off/         # Script chạy một lần, không thuộc luồng chính
├── frontend/                # Next.js app
│   ├── app/                 # App Router pages/routes
│   ├── components/          # UI components
│   ├── lib/                 # API client, store, utils
│   └── public/              # Static assets
├── database/                # Schema, seed, migrations
├── docs/                    # Tài liệu dự án
│   ├── course/              # Tích hợp và vận hành khóa học
│   ├── video/               # Video commerce, HLS, Bunny
│   ├── archive/             # Kế hoạch/nhận xét lịch sử
│   ├── assets/              # PDF/tài liệu nặng
│   └── notes/               # Ghi chú khác
├── tools/                   # Script hỗ trợ, debug, script tạm
├── *.cmd                    # Launcher video Windows và công cụ đăng ký URL protocol
├── Dockerfile               # Build backend container
├── docker-compose.yml       # Local Postgres/pgAdmin
├── railway.toml             # Railway deploy config
├── build.sh                 # Build command helper
├── start.sh                 # Start command helper
├── CHANGELOG.md
└── README.md
```

## Quy Ước

- Không commit `node_modules`, `.next`, log, cache, file `.env` hoặc file trạng thái runtime.
- Script chạy một lần để ở `backend/scripts/one-off/` hoặc `tools/`, không để tràn ra root.
- Migration database chính thức để ở `database/migrations/`.
- Tài liệu phụ, PDF, ghi chú kế hoạch để ở `docs/`, không để ở root.
- Root giữ file cần cho deploy, Docker, README, CHANGELOG, cấu hình chung và hai launcher video Windows.
