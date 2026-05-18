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
│   ├── archive/             # Nội dung cũ cần giữ lại để tra cứu
│   ├── assets/              # PDF/tài liệu nặng
│   └── notes/               # Ghi chú kế hoạch/vận hành
├── tools/                   # Script hỗ trợ, debug, script tạm
├── Dockerfile               # Build backend container
├── docker-compose.yml       # Local Postgres/pgAdmin
├── railway.toml             # Railway deploy config
├── build.sh                 # Build command helper
├── start.sh                 # Start command helper
└── README.md
```

## Quy Ước

- Không commit `node_modules`, `.next`, log, cache, file `.env` hoặc file trạng thái runtime.
- Script chạy một lần để ở `backend/scripts/one-off/` hoặc `tools/`, không để tràn ra root.
- Migration database chính thức để ở `database/migrations/`.
- Tài liệu phụ, PDF, ghi chú kế hoạch để ở `docs/`, không để ở root.
- Root chỉ giữ file cần cho deploy, Docker, README và cấu hình chung.
