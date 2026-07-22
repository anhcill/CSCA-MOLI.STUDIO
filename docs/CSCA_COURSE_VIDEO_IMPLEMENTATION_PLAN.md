# Kế hoạch xây dựng hệ thống khóa học và video CSCA dùng chung

## 1. Mục tiêu

Xây dựng module khóa học/video bài giảng cho CSCA-MOLI.STUDIO theo trải nghiệm tham chiếu từ các ảnh mẫu:

1. Danh mục khóa học dạng card, tách nhóm miễn phí và nâng cao.
2. Trang giới thiệu khóa học công khai.
3. Chương trình học dạng chương/bài có accordion.
4. Phòng học riêng với video, nội dung bài học và sidebar.
5. Lưu tiến độ, vị trí xem gần nhất và trạng thái hoàn thành.
6. Ghi chú theo timestamp, tài liệu đính kèm và điều hướng bài trước/sau.
7. Admin tạo khóa học, chương, bài học, upload video và publish.

Hệ thống chỉ phục vụ nội dung CSCA:

- Toán: `MATH`
- Vật lý: `PHYSICS`
- Hóa học: `CHEMISTRY`
- Tiếng Trung ban Tự nhiên: `CHINESE_SCI`
- Tiếng Trung ban Xã hội: `CHINESE_SOC`

UI không sao chép nguyên bản website tham chiếu. Chỉ dùng bố cục và hành vi làm chuẩn UX; màu sắc, typography, icon, nội dung và logic quyền truy cập phải theo hệ thống CSCA hiện tại.

---

## 2. Quan hệ giữa CSCA-MOLI.STUDIO và CSCA Course

### 2.1. Quyết định kiến trúc

CSCA-MOLI.STUDIO là nguồn dữ liệu chuẩn cho:

- Tài khoản và phiên đăng nhập.
- Gói VIP/Pre và quyền theo môn.
- Khóa học, chương, bài học và metadata video.
- Enrollment và tiến độ học.
- Quyền phát video private.
- Admin CMS và audit log.

CSCA Course là website bổ trợ, dùng chung nội dung thông qua API. Không tạo một bản video hoặc curriculum độc lập rồi đồng bộ thủ công.

```text
Admin CMS
   -> CSCA Learning API
      -> PostgreSQL csca_db
      -> Cloudflare R2
         -> CSCA-MOLI.STUDIO frontend
         -> CSCA Course frontend
```

### 2.2. Nguyên tắc dùng chung

- Một course/section/lesson có một ID chuẩn duy nhất.
- Một video asset chỉ upload một lần.
- Hai website cùng dùng public catalog API.
- Playback private luôn được cấp bằng signed URL sau khi backend kiểm tra quyền.
- Không website nào lưu trực tiếp R2 secret.
- CSCA Course không ghi trực tiếp vào `csca_db`; mọi thay đổi đi qua admin API.
- Không đồng bộ bằng cách copy bảng giữa hai database.
- Có `external_key` ổn định để hai frontend deep-link và cache nội dung.

### 2.3. Auth giữa hai website

MVP:

- Catalog và landing được đọc công khai từ cùng API.
- Nút học trên CSCA Course deep-link sang phòng học của CSCA-MOLI.STUDIO.
- Tài khoản, thanh toán, enrollment và progress vẫn do CSCA-MOLI.STUDIO quản lý.

Phase sau:

- SSO giữa hai subdomain bằng token exchange ngắn hạn.
- CSCA Course có thể mở player tại chỗ sau khi nhận learning session từ backend.

Không chia sẻ cookie tùy tiện giữa các domain độc lập.

---

## 3. Hiện trạng CSCA-MOLI.STUDIO

### 3.1. Stack đang dùng

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Zustand, Axios.
- Backend: Express, PostgreSQL, JWT Bearer token, Socket.IO.
- Media hiện tại: Cloudinary cho ảnh/tệp thông thường.
- Quyền trả phí: `basic`, `vip`, `premium`.
- Quyền VIP đã hỗ trợ phạm vi môn qua `vip_allowed_subjects` và `user_vip_entitlements`.
- Admin đã có RBAC, permission và audit log.

### 3.2. Thành phần có thể tái sử dụng

- `authMiddleware`, `optionalAuth`.
- `authorizePermission` và `authorizeAnyPermission`.
- `canAccessVipContent`.
- Admin layout và hệ permission hiện có.
- Luồng thanh toán, VIP package và entitlement theo môn.
- `materials` làm tài nguyên đính kèm, nhưng không dùng làm bảng course/lesson.
- Các shell responsive và hệ navigation hiện tại.
- `sanitize-html`, `react-markdown`, `rehype-sanitize`.

### 3.3. Phần chưa có

- Course catalog chuẩn.
- Course section/chapter.
- Enrollment theo khóa học.
- Lesson progress và resume position.
- Video asset/variant/upload session.
- Playback URL có kiểm tra quyền.
- Course admin CMS.
- Landing course và learning room.

### 3.4. Quy tắc tích hợp

- Không thay đổi luồng thi hiện tại.
- Không gộp progress video vào `user_exam_attempts`.
- Không dùng bảng `comments` của forum cho thảo luận bài học.
- Không biến `materials` thành bảng lesson.
- Migration phải bổ sung an toàn, không drop bảng production.

---

## 4. Kiến trúc trải nghiệm

### 4.1. Luồng học viên

```text
Danh mục khóa học
  -> Landing khóa học công khai
     -> Xem video giới thiệu / bài preview
     -> Đăng nhập
     -> Đăng ký khóa miễn phí hoặc kiểm tra quyền VIP/Pre
     -> Tạo enrollment
     -> Vào phòng học
     -> Xem video / đọc bài / tải tài liệu
     -> Lưu tiến độ và vị trí xem
     -> Hoàn thành bài
     -> Tiếp tục bài kế tiếp
     -> Hoàn thành khóa học
```

### 4.2. Route frontend đề xuất

#### Public

- `/khoa-hoc`
- `/khoa-hoc/[slug]`
- `/khoa-hoc/[slug]/xem-thu/[lessonId]`

#### Học viên

- `/hoc`
- `/hoc/[courseSlug]`
- `/hoc/[courseSlug]/bai-hoc/[lessonId]`

#### Admin

- `/admin/courses`
- `/admin/courses/create`
- `/admin/courses/[courseId]`
- `/admin/courses/[courseId]/curriculum`
- `/admin/courses/[courseId]/students`
- `/admin/media/videos`

API dùng tên tiếng Anh ổn định; URL giao diện có thể dùng tiếng Việt.

### 4.3. Navigation

- Thêm mục `Khóa học` hoặc `Video bài giảng` vào navigation chính.
- Trang môn có section `Khóa học theo môn`.
- Trang kết quả thi có thể gợi ý lesson liên quan theo `subject_code` và topic.
- Trang VIP/Pre phải mô tả rõ khóa học/video nào được mở theo gói.

---

## 5. Thiết kế UI

### 5.1. Catalog

Các section:

- `Tiếp tục học`: chỉ hiện khi đã đăng nhập và có progress.
- `Khóa học nổi bật`: admin ghim.
- `Khóa học nâng cao`: cần VIP, Pre hoặc quyền theo môn.
- `Khóa học miễn phí`: đăng ký trực tiếp.
- `Mới cập nhật`: sắp xếp theo `published_at` hoặc `content_updated_at`.

Filter:

- Môn học.
- Miễn phí / VIP / Pre / Liên hệ.
- Cơ bản / Trung cấp / Nâng cao.
- Mới nhất / Phổ biến / Đánh giá cao.

Course card:

- Cover 16:9.
- Badge `MỚI`, `HOT`, `FREE`, `VIP`, `PRE`.
- Tên khóa.
- Mô tả ngắn.
- Giảng viên.
- Rating và số đánh giá.
- Tổng bài và tổng thời lượng.
- Số học viên.
- Giá hoặc trạng thái quyền.
- Progress của user nếu đã đăng ký.

API catalog phải trả aggregate sẵn, không gọi rating/progress riêng cho từng card.

### 5.2. Landing khóa học

Cột nội dung chính:

- Breadcrumb.
- Tên, mô tả ngắn.
- Rating, số học viên, thời điểm cập nhật.
- `Bạn sẽ học được gì?`.
- Đối tượng phù hợp.
- Yêu cầu đầu vào.
- Curriculum accordion.
- Mô tả dài.
- Giảng viên.
- Đánh giá.
- Khóa học liên quan.

Card sticky:

- Thumbnail/video giới thiệu.
- Trạng thái miễn phí/VIP/Pre/liên hệ.
- CTA theo quyền:
  - `Đăng ký học`
  - `Nâng cấp VIP`
  - `Nâng cấp Pre`
  - `Tiếp tục học`
  - `Liên hệ tư vấn`
- Cấp độ.
- Tổng chương.
- Tổng bài.
- Tổng thời lượng.
- Quyền truy cập.
- Chứng nhận nếu được bật.

Curriculum công khai chỉ trả metadata. Không trả R2 object key hoặc private playback URL.

### 5.3. Phòng học

Desktop:

- Header gọn: quay lại, logo, tên khóa, phần trăm tiến độ.
- Nội dung chính: video/article/document/quiz.
- Sidebar phải: chương và bài.
- Footer cố định: bài trước, bài tiếp theo.
- Tab dưới player: nội dung, tài liệu, hỏi đáp, ghi chú.

Mobile:

- Player full width.
- Curriculum trong drawer/bottom sheet.
- Footer điều hướng cố định.
- Các tab cuộn ngang.

Trạng thái lesson:

- Chưa học.
- Đang học.
- Hoàn thành.
- Bị khóa.
- Xem thử.

### 5.4. Quy tắc hoàn thành

- Video: xem ít nhất 85% hoặc hoàn thành theo ngưỡng backend xác nhận.
- Article: user chủ động đánh dấu hoàn thành sau khi mở nội dung.
- Document: user chủ động đánh dấu hoàn thành.
- Quiz: submit và đạt `passing_score` nếu lesson yêu cầu.
- Preview không tự tạo enrollment.

Frontend gửi progress mỗi 20–30 giây, khi pause, đổi bài và page hidden. Không ghi database mỗi giây.

---

## 6. Mô hình quyền truy cập

### 6.1. `access_type`

- `free`: đăng nhập và enroll miễn phí.
- `vip`: cần VIP còn hạn và đúng môn.
- `premium`: cần Pre/Premium còn hạn.
- `contact`: cần admin cấp quyền thủ công.
- `private`: chỉ user được admin enroll.

### 6.2. Kiểm tra entitlement

Backend tính quyền từ:

1. User/admin role.
2. Enrollment còn hiệu lực.
3. `subscription_tier`.
4. `vip_allowed_subjects`.
5. Course `subject_code`.
6. Course `access_type`.
7. Trạng thái publish của course/lesson.

Không nhận `isVip`, `tier`, `allowedSubjects`, `userId` hoặc `progressPct` làm nguồn quyền từ client.

### 6.3. Enrollment

Enrollment vẫn cần ngay cả khi user có VIP/Pre:

- Ghi khóa đang học.
- Lưu ngày bắt đầu.
- Tạo danh sách `Tiếp tục học`.
- Theo dõi completion.
- Cho phép admin revoke riêng một course.

VIP/Pre quyết định user có thể tạo hoặc duy trì enrollment; enrollment không thay thế entitlement.

---

## 7. Database mục tiêu

Migration đề xuất:

```text
052_csca_courses_core.sql
053_csca_course_progress.sql
054_csca_video_assets.sql
055_csca_course_interactions.sql
056_csca_course_rbac.sql
```

### 7.1. `courses`

```text
id
external_key unique
slug unique
title
short_description
description
subject_code
level
thumbnail_url
preview_video_asset_id
instructor_id
access_type
required_tier
price_vnd
compare_at_price_vnd
status                 draft | review | published | archived
is_featured
is_new
is_hot
certificate_enabled
total_sections
total_lessons
total_duration_seconds
rating_avg
rating_count
enrolled_count
published_at
content_updated_at
created_at
updated_at
```

`subject_code` dùng đúng bộ mã môn hiện có để tái sử dụng entitlement.

### 7.2. `course_sections`

```text
id
course_id
title
description
sort_order
is_published
created_at
updated_at
```

### 7.3. `course_lessons`

```text
id
external_key unique
course_id
section_id
slug
title
summary
lesson_type            video | article | document | quiz
content_html
sort_order
is_published
is_free_preview
is_required
video_asset_id
material_id nullable
estimated_duration_seconds
passing_score nullable
created_at
updated_at
```

Giữ `course_id` để query nhanh nhưng phải kiểm tra section cùng course.

### 7.4. Metadata course

- `course_outcomes`
- `course_requirements`
- `course_instructors` nếu một khóa có nhiều giảng viên.
- `course_related_items`
- `lesson_resources`

### 7.5. `course_enrollments`

```text
id
user_id
course_id
source                  free | vip | premium | admin | coupon
status                  active | expired | revoked | completed
starts_at
expires_at
completed_at
created_at
updated_at
UNIQUE(user_id, course_id)
```

### 7.6. `lesson_progress`

```text
id
user_id
course_id
lesson_id
status                  not_started | in_progress | completed
watched_seconds
max_position_seconds
last_position_seconds
completion_pct
attempt_count
started_at
completed_at
updated_at
UNIQUE(user_id, lesson_id)
```

Course progress được tính từ:

```text
số required lesson đã hoàn thành / tổng required lesson đã publish
```

Có thể thêm `course_progress_cache` sau; không dùng cache làm nguồn dữ liệu chính.

### 7.7. Video

#### `video_assets`

```text
id
external_key unique
course_id nullable
lesson_id nullable
purpose                 lesson | preview
status                  pending | uploading | processing | ready | failed | deleted
source_object_key
thumbnail_object_key
duration_seconds
width
height
source_size_bytes
mime_type
checksum
created_by
deleted_at
created_at
updated_at
```

#### `video_variants`

```text
id
video_asset_id
resolution              360p | 480p | 720p | 1080p
delivery_type           hls
object_key
manifest_object_key nullable
mime_type
codec
bitrate_kbps
width
height
duration_seconds
file_size_bytes
is_default
is_ready
created_at
updated_at
UNIQUE(video_asset_id, resolution, delivery_type)
```

#### `video_upload_sessions`

```text
id
video_asset_id
provider_upload_id
object_key
mode                    single | multipart
part_size_bytes
status
expires_at
created_by
created_at
completed_at
```

Không lưu presigned URL vào database.

### 7.8. Tương tác

- `lesson_notes`: private theo user, có `timestamp_seconds`.
- `lesson_discussions`: thread riêng cho lesson.
- `course_ratings`: một rating/user/course.
- `course_certificates`: phase sau.

Không dùng bảng comment forum cho lesson discussion.

---

## 8. Cloudflare R2

### 8.1. Bucket

1. Public bucket:
   - Cover.
   - Thumbnail.
   - Preview thực sự công khai.

2. Private bucket:
   - Video bài học.
   - Tài liệu chỉ dành cho học viên.
   - Không bật public `r2.dev`.

### 8.2. MVP video

- FFmpeg tạo HLS adaptive bitrate ngay từ MVP.
- Bộ rendition mục tiêu: `360p`, `480p`, `720p`, `1080p`.
- `720p` là mức khởi đầu ưu tiên trên desktop; HLS tự tăng/giảm theo băng thông.
- `360p` dành cho mạng yếu và màn hình nhỏ.
- `480p` dành cho chế độ tiết kiệm dữ liệu.
- `1080p` dành cho slide, công thức và chữ nhỏ; không tạo nếu source thấp hơn 1080p.
- Video dùng H.264, pixel format `yuv420p`; audio dùng AAC.
- GOP/keyframe phải đồng bộ giữa các rendition để chuyển chất lượng mượt.
- Segment dài khoảng 6 giây.
- FFmpeg tạo `master.m3u8`, playlist từng rendition và các segment `.ts`.
- Player có `Tự động`, `360p`, `480p`, `720p`, `1080p`; chế độ `Tự động` dùng ABR của `hls.js`.
- User vẫn có thể khóa thủ công một chất lượng; khi trở lại `Tự động`, ABR tiếp tục hoạt động.

### 8.3. Quy trình encode tiết kiệm

Phương án ưu tiên ban đầu:

```text
Admin chọn video nguồn
  -> Công cụ FFmpeg chạy trên máy admin hoặc máy encode riêng
  -> Tạo một bộ HLS gồm 360p / 480p / 720p / 1080p
  -> Tạo master.m3u8, rendition playlists và segment
  -> Kiểm tra duration, codec và playlist
  -> Upload nguyên thư mục HLS trực tiếp lên R2
  -> Backend ghi metadata rendition vào video_variants
  -> Chỉ publish lesson khi master playlist và 720p đã ready
```

Không encode video bên trong Express API vì sẽ tốn CPU/RAM và có thể làm nghẽn backend đang phục vụ thi.

Preset HLS tham khảo:

```bash
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]split=4[v360][v480][v720][v1080]; \
    [v360]scale=-2:360[v360out]; \
    [v480]scale=-2:480[v480out]; \
    [v720]scale=-2:720[v720out]; \
    [v1080]scale=-2:1080[v1080out]" \
  -map "[v360out]" -map 0:a:0 \
  -map "[v480out]" -map 0:a:0 \
  -map "[v720out]" -map 0:a:0 \
  -map "[v1080out]" -map 0:a:0 \
  -c:v libx264 -preset medium -pix_fmt yuv420p \
  -b:v:0 650k -maxrate:v:0 750k -bufsize:v:0 1000k \
  -b:v:1 1000k -maxrate:v:1 1150k -bufsize:v:1 1500k \
  -b:v:2 2200k -maxrate:v:2 2500k -bufsize:v:2 3300k \
  -b:v:3 4500k -maxrate:v:3 5000k -bufsize:v:3 6750k \
  -c:a aac -b:a 128k -ac 2 \
  -g 180 -keyint_min 180 -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_filename "hls/v%v/segment_%06d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p v:3,a:3,name:1080p" \
  "hls/v%v/index.m3u8"
```

Lệnh triển khai phải dò độ phân giải source trước và chỉ tạo rendition không vượt quá source. Không upscale video nguồn thấp lên 1080p vì chỉ làm tăng dung lượng, không tăng độ nét.

### 8.4. Object key

```text
public/courses/{courseId}/covers/{uuid}.webp
public/courses/{courseId}/previews/{assetId}/hls/master.m3u8
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/master.m3u8
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/v0/index.m3u8
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/v0/segment_000001.ts
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/v1/...
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/v2/...
private/courses/{courseId}/lessons/{lessonId}/{assetId}/hls/v3/...
private/courses/{courseId}/lessons/{lessonId}/resources/{uuid}.pdf
source-temp/{assetId}/source.mp4
```

Key do server sinh, không dùng nguyên tên file của user.

### 8.5. Upload

```text
Admin chọn file
  -> POST /api/admin/course-media/uploads
  -> Backend kiểm tra permission, MIME, size và ownership
  -> Backend tạo asset + upload session
  -> Browser upload trực tiếp lên R2
  -> Frontend gọi complete
  -> Backend HEAD object và xác nhận metadata
  -> Asset chuyển ready
  -> Admin gắn asset vào lesson
```

Express không nhận rồi proxy toàn bộ bytes video.

Một upload session quản lý một bộ HLS. Uploader duyệt manifest file, upload song song có giới hạn và retry riêng segment lỗi mà không phải upload lại toàn bộ video.

Lesson được phép publish khi:

- `master.m3u8` và playlist `720p` đã `ready`.
- Tất cả segment được playlist tham chiếu đều tồn tại.
- Duration giữa các rendition không lệch quá ngưỡng cho phép.
- Không có rendition ở trạng thái metadata không hợp lệ.

Nếu cần thêm rendition sau khi publish, phải tạo lại master playlist theo version mới và chuyển atomically sau khi toàn bộ segment mới đã upload xong.

### 8.6. Playback

```text
POST /api/learning/lessons/:lessonId/playback-session
  -> authenticate
  -> kiểm tra enrollment/tier/subject/preview
  -> tạo playback token ngắn hạn 2–4 giờ
  -> trả URL master playlist qua video gateway
  -> trả expiry + resume position
```

Không trả R2 object key. Không log playback URL/token đầy đủ.

Một presigned URL R2 chỉ bảo vệ được một object, trong khi HLS có nhiều playlist và segment. Vì vậy HLS private dùng:

```text
Player
  -> https://video.molystudio.online/hls/.../master.m3u8?token=...
  -> Cloudflare Worker xác minh token
  -> Worker đọc object từ private R2 binding
  -> Worker rewrite playlist để gắn token vào URL con
  -> Player tải rendition playlist và segment qua cùng Worker
```

Cloudflare Worker chỉ xác thực và stream object từ R2, không encode video. Token chứa tối thiểu `userId`, `lessonId`, `assetId`, `exp` và được Railway ký. Worker kiểm tra chữ ký cục bộ, không gọi Railway cho từng segment.

Thuật toán `Tự động` ở MVP do `hls.js` thực hiện dựa trên throughput và buffer. Cấu hình ban đầu:

- Nếu user đã chọn chất lượng trước đó, ưu tiên lựa chọn đã lưu.
- Mạng tiết kiệm dữ liệu hoặc màn hình nhỏ: bắt đầu `480p`.
- Desktop thông thường: bắt đầu `720p`.
- Không tự chọn `1080p` nếu user chưa yêu cầu, nhằm tiết kiệm băng thông.
- Nếu rendition đang chọn lỗi, fallback xuống chất lượng thấp hơn gần nhất.

### 8.7. CSP/CORS

Khi triển khai phải cập nhật:

- Backend CORS cho cả hai frontend chính thức.
- Helmet `connectSrc`, `mediaSrc`, `imgSrc` cho domain video gateway.
- R2 bucket CORS cho `GET`, `HEAD`, `PUT`.
- Expose `ETag`, `Content-Length`, `Content-Range`, `Accept-Ranges`.
- Origin production cụ thể; không dùng wildcard cho admin upload.
- Cloudflare Worker fail-closed: token sai/hết hạn phải trả 401/403, không bypass sang bucket public.

### 8.8. Chi phí và số request HLS

HLS tạo nhiều request hơn MP4 vì mỗi segment khoảng 6 giây là một request:

```text
1 giờ xem ≈ 600 segment requests
```

Với quy mô ban đầu, có thể thử Workers Free (100.000 request/ngày). Khi số lượt xem tiến gần giới hạn, chuyển Workers Paid với mức tối thiểu 5 USD/tháng và 10 triệu request/tháng được bao gồm. Phải theo dõi request thực tế trước khi tăng gói.

R2 vẫn chịu trách nhiệm lưu dữ liệu; Worker chỉ là gateway xác thực. Bật cache phù hợp cho segment bất biến, nhưng playlist/token private không được cache sai giữa user.

---

## 9. API contract

Response thành công:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Response lỗi:

```json
{
  "success": false,
  "code": "COURSE_ACCESS_DENIED",
  "message": "Bạn chưa có quyền truy cập khóa học này"
}
```

API dùng `camelCase`; PostgreSQL dùng `snake_case`.

### 9.1. Public

- `GET /api/courses`
- `GET /api/courses/:slug`
- `GET /api/courses/:slug/curriculum`
- `GET /api/courses/:slug/reviews`
- `GET /api/courses/:slug/related`

Filter catalog:

- `subject`
- `accessType`
- `level`
- `sort`
- `page`
- `limit`

### 9.2. Enrollment và learning

- `POST /api/courses/:courseId/enroll`
- `GET /api/me/course-enrollments`
- `GET /api/learning/courses/:courseId`
- `GET /api/learning/lessons/:lessonId`
- `POST /api/learning/lessons/:lessonId/playback-session`
- `PUT /api/learning/lessons/:lessonId/progress`
- `POST /api/learning/lessons/:lessonId/complete`
- `GET /api/learning/courses/:courseId/progress`

### 9.3. Notes và discussion

- `GET /api/learning/lessons/:lessonId/notes`
- `POST /api/learning/lessons/:lessonId/notes`
- `PATCH /api/learning/notes/:noteId`
- `DELETE /api/learning/notes/:noteId`
- `GET /api/lessons/:lessonId/discussions`
- `POST /api/lessons/:lessonId/discussions`

### 9.4. Admin

- CRUD course.
- CRUD section.
- CRUD lesson.
- Reorder section/lesson.
- Publish/unpublish.
- Quản lý enrollment.
- Upload/complete/abort media.
- Gắn video vào lesson.
- Xem preview trước publish.

### 9.5. Tích hợp CSCA Course

- Public read dùng các endpoint catalog hiện có.
- Admin write dùng cùng admin API và user permission, không mở API write công khai.
- Nếu cần server-to-server:
  - Service account có scope hẹp.
  - Token ngắn hạn.
  - Rate limit riêng.
  - Audit mọi thay đổi.
- Webhook `course.published`, `course.updated`, `lesson.updated` chỉ dùng để xóa cache hoặc revalidate frontend, không copy dữ liệu.

---

## 10. Backend module

```text
backend/src/
  routes/
    courses.js
    learning.js
    adminCourses.js
    courseMedia.js
  controllers/
    courseController.js
    learningController.js
    adminCourseController.js
    courseMediaController.js
  services/
    courseCatalogService.js
    courseAccessService.js
    courseProgressService.js
    courseMediaService.js
    r2Service.js
  repositories/
    courseRepository.js
    learningRepository.js
    courseMediaRepository.js
  middleware/
    requireCourseAccess.js
```

Luồng chuẩn:

```text
route -> middleware -> controller -> service -> repository -> PostgreSQL
```

Không viết SQL lớn trực tiếp trong controller.

---

## 11. Frontend module

```text
frontend/
  app/
    khoa-hoc/
    hoc/
    admin/courses/
    admin/media/videos/
  components/
    courses/
    learning/
    admin/courses/
  lib/
    api/courses.ts
    api/learning.ts
    api/adminCourses.ts
    types/courses.ts
```

Frontend thêm package `hls.js`. Safari ưu tiên HLS native khi trình duyệt hỗ trợ; Chrome, Edge và Firefox dùng `hls.js` qua Media Source Extensions.

Component chính:

- `CourseCard`
- `CourseGrid`
- `CourseFilters`
- `CourseHero`
- `CourseAccessCard`
- `CurriculumAccordion`
- `LessonRow`
- `LearningHeader`
- `LearningPlayer`
- `LearningSidebar`
- `LearningFooterNavigation`
- `TimestampNotes`
- `AdminCourseEditor`
- `AdminCurriculumBuilder`
- `VideoUploader`

Không gọi API riêng lẻ bên trong mỗi card.

---

## 12. Admin RBAC

Thêm role:

- `course_admin`

Thêm permission:

- `courses.view`
- `courses.manage`
- `courses.publish`
- `courses.enrollments.manage`
- `course_media.manage`

`content_admin` có thể được cấp `courses.view` và `courses.manage`; quyền publish/video nên tách để giảm rủi ro.

Mọi thao tác sau phải có audit log:

- Publish/unpublish course.
- Thay đổi access type/tier.
- Gắn hoặc thay video.
- Xóa/soft-delete asset.
- Cấp/revoke enrollment thủ công.

---

## 13. Bảo mật

- Private video chỉ phát qua signed URL.
- Kiểm tra quyền lại mỗi lần xin playback URL.
- Signed URL là bearer token; không ghi vào analytics hoặc log.
- Rate limit upload, playback refresh và progress.
- Validate MIME, extension, size và checksum.
- Sanitize rich text trước khi lưu/render.
- Không tin duration hoặc completion do client tự khai tuyệt đối.
- `max_position_seconds` chỉ tăng, trừ thao tác reset có quyền.
- Progress complete phải idempotent.
- Course draft không xuất hiện ở public API.
- Creator/course admin chỉ sửa course thuộc phạm vi được giao.
- Không xóa cứng video đang được lesson sử dụng.

---

## 14. Các phase triển khai

### Phase 0 — Chốt contract và migration

- Chốt route, DTO và error code.
- Chốt subject code và access type.
- Review migration trên bản sao database.
- Chốt R2 bucket/domain/CORS.
- Chốt quyền admin.

Nghiệm thu:

- ERD được review.
- API contract cố định.
- Migration chỉ thêm, không phá dữ liệu hiện tại.

### Phase 1 — Catalog và landing

- Course/section/lesson metadata.
- Public catalog API.
- Landing và curriculum API.
- Catalog UI Free/VIP/Pre.
- Landing responsive.
- Admin CRUD metadata tối thiểu.

Nghiệm thu:

- Guest xem catalog và landing.
- Không dùng mock ở production flow.
- Curriculum không lộ video key.

### Phase 2 — Enrollment và phòng học

- Enrollment.
- Course access middleware.
- My Learning.
- Learning room.
- Sidebar, prev/next.
- Progress và resume.

Nghiệm thu:

- User free enroll và học được.
- User thiếu quyền nhận 403.
- Refresh giữ đúng lesson và timestamp.

### Phase 3 — R2 video

- R2 config.
- Direct upload.
- Complete/abort.
- FFmpeg tạo HLS 360p/480p/720p/1080p.
- Upload master playlist, rendition playlist và segment.
- Cloudflare Worker làm private video gateway trước R2.
- Railway cấp playback token, không ký riêng từng segment.
- Player `hls.js` có ABR tự động và bộ chọn chất lượng thủ công.
- Fallback xuống rendition thấp hơn khi mạng yếu hoặc rendition lỗi.

Nghiệm thu:

- Video không đi qua Express.
- Private bucket không public.
- Seek/resume hoạt động.
- Menu chất lượng chỉ hiện rendition `ready`.
- 360p/480p/720p phát được; 1080p phát được khi source hỗ trợ.
- ABR chuyển rendition không làm phát lại từ đầu.
- Token sai/hết hạn không tải được playlist hoặc segment.
- Không lộ secret/object key.

### Phase 4 — Admin CMS và công cụ học

- Curriculum builder.
- Media uploader.
- Notes timestamp.
- Tài liệu.
- Discussion.
- Rating.
- Quiz lesson.

### Phase 5 — Chia sẻ đầy đủ với CSCA Course

- CSCA Course chuyển catalog sang API chuẩn.
- Deep-link và revalidation.
- Đồng nhất component contract.
- SSO/token exchange nếu thật sự cần player tại chỗ.
- Không duy trì hai bộ curriculum.

### Phase 6 — Nâng cấp sau dữ liệu thực tế

- Encode queue tự động trên Railway Worker nếu số video tăng mạnh.
- HLS fMP4/CMAF nếu cần tối ưu thêm khả năng cache và latency.
- Analytics buffering.
- Certificate.
- Gợi ý lesson từ lỗi làm đề.
- Liên kết lesson với question category/topic.

---

## 15. Thứ tự ưu tiên

### P0

- Database course/section/lesson.
- Catalog.
- Landing.
- Enrollment.
- Access control theo tier và môn.
- Learning room.
- R2 upload/playback private.
- FFmpeg HLS nhiều độ phân giải, ABR và quality selector.
- Cloudflare Worker video gateway.
- Progress/resume.
- Admin course/curriculum/video.

### P1

- Notes.
- Resources.
- Discussion.
- Rating.
- Quiz.
- Related course.
- Gợi ý video từ kết quả thi.

### P2

- SSO hai website.
- Auto encode trên cloud/queue; MVP vẫn encode bằng FFmpeg ngoài Express.
- HLS fMP4/CMAF.
- Certificate.
- Advanced analytics.
- Live class.

---

## 16. Kế hoạch thực thi theo workstream

### Workstream A — Database và backend core

- Migration.
- Catalog API.
- Curriculum API.
- Enrollment/access.
- Progress.
- Admin CRUD.
- RBAC và audit.

### Workstream B — Frontend learner và admin

- Catalog.
- Landing.
- Learning room.
- Responsive.
- Admin editor/curriculum.
- Loading/error/empty states.

### Workstream C — Video và integration QA

- R2.
- Upload.
- Playback.
- Player.
- CSP/CORS.
- Security test.
- End-to-end test và tài liệu vận hành.

File dùng chung phải có owner rõ ràng:

- `backend/src/index.js`
- `backend/.env.example`
- `backend/package.json`
- `frontend/package.json`
- navigation/layout admin
- migration numbering

---

## 17. Test plan

### Backend

- Guest catalog/landing.
- Draft/archived visibility.
- Free enrollment idempotent.
- VIP/Pre theo đúng môn.
- Enrollment revoked/expired.
- Lesson access.
- Preview access.
- Progress concurrent update.
- Complete idempotent.
- Upload MIME/size/checksum.
- Playback signed URL expiry.
- Creator/admin ownership.

### Frontend

- 375px, 768px, 1024px, 1440px.
- Catalog filter và pagination.
- Sticky card.
- Accordion keyboard.
- Learning sidebar/drawer.
- Resume.
- Quality switch giữ timestamp.
- Fallback khi một variant bị thiếu hoặc lỗi.
- Video unavailable.
- Empty curriculum.
- Expired entitlement.
- Course completed.

### Chia sẻ hai website

- Cùng course ID/slug.
- Publish một lần, hai website thấy metadata mới.
- Revalidate cache sau update.
- Không upload trùng video.
- Deep-link đúng lesson.
- CSCA Course không thể tự lấy private playback khi chưa có learning session hợp lệ.

---

## 18. Tiêu chí hoàn thành MVP

MVP đạt khi:

1. Admin tạo course, section và lesson.
2. Admin upload video private và gắn vào lesson.
3. Guest xem catalog và landing.
4. User đăng ký course free hoặc dùng entitlement hiện có.
5. User thiếu quyền không lấy được playback URL.
6. User phát, seek và resume video.
7. User chuyển được giữa 360p/480p/720p/1080p mà không mất timestamp.
8. Progress lưu theo lesson.
9. Learning room responsive.
10. CSCA Course đọc được cùng catalog/course metadata qua API.
11. Không có bản curriculum/video thứ hai cần đồng bộ thủ công.
12. Không có R2 secret ở frontend hoặc Git.
13. Luồng thi, thanh toán và VIP hiện tại không bị regression.

---

## 19. Ngoài phạm vi MVP

- Thanh toán riêng từng course.
- Livestream/video call tự xây.
- DRM.
- Auto encode nhiều bitrate.
- SSO phức tạp giữa domain độc lập.
- AI chấm bài trong video.
- Migration dữ liệu demo cũ từ CSCA Course nếu chưa có mapping được duyệt.

---

## 20. Kết luận

Kiến trúc mục tiêu không phải hai LMS độc lập giống giao diện nhưng khác dữ liệu. Đây phải là một hệ thống nội dung khóa học CSCA có:

- Một nguồn course/curriculum/video chuẩn.
- Một hệ entitlement và progress chuẩn.
- Hai frontend có thể trình bày nội dung theo vai trò riêng.
- Cùng cấu trúc catalog, landing và learning room.
- Không có nội dung ngoài phạm vi CSCA.

Thứ tự triển khai an toàn là:

```text
contract + migration
  -> catalog + landing
  -> enrollment + access
  -> learning room + progress
  -> R2 private video
  -> admin CMS
  -> CSCA Course chuyển sang dùng API chung
```
