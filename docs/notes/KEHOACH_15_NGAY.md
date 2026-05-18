# KẾ HOẠCH 15 NGÀY XÂY DỰNG WEB LUYỆN THI CSCA

**Dự án:** Website luyện thi đầu vào học bổng Trung Quốc (CSCA)
**Thời gian:** 1/1/2026 - 15/1/2026
**Stack:** Next.js 14 + Node.js + PostgreSQL/MySQL + Docker

---

## 📋 TỔNG QUAN DỰ ÁN

### Chức năng chính:

1. Hệ thống Auth (Đăng ký/Đăng nhập)
2. Forum/Feed bài viết (Social Learning)
3. Hệ thống đề thi trắc nghiệm
4. Thống kê & phân tích kết quả
5. Lịch thi và đề theo ngày
6. Profile người dùng

---

## 🗓️ NGÀY 1 (1/1/2026) - SETUP DỰ ÁN & DATABASE

### Mục tiêu:

- Setup môi trường dev hoàn chỉnh
- Thiết kế database schema
- Kết nối database với backend

### Công việc:

#### 1. Setup Database

**File cần tạo:**

- `database/schema.sql` - Database schema
- `database/seed.sql` - Dữ liệu mẫu
- `database/migrations/001_init.sql` - Migration đầu tiên

**Schema bảng:**

```sql
- users (id, username, email, password, avatar, role, created_at)
- posts (id, user_id, title, content, category, likes_count, comments_count, created_at)
- comments (id, post_id, user_id, content, created_at)
- exams (id, title, subject, exam_date, duration, total_questions, created_at)
- questions (id, exam_id, question_text, question_type, options, correct_answer, explanation)
- user_exam_attempts (id, user_id, exam_id, score, answers, started_at, completed_at)
- user_stats (id, user_id, total_exams, avg_score, weak_topics)
```

#### 2. Setup Backend API

**File cần tạo:**

- `backend/package.json` - Dependencies (express, pg/mysql2, bcrypt, jsonwebtoken)
- `backend/src/index.js` - Server entry point
- `backend/src/config/database.js` - Database connection
- `backend/.env.example` - Environment variables template

#### 3. Docker Setup

**File cần update:**

- `docker-compose.yml` - Add database service (PostgreSQL/MySQL)

**Kết quả ngày 1:**
✅ Database schema hoàn chỉnh
✅ Backend server chạy được (port 5000)
✅ Database kết nối thành công
✅ Docker containers running

---

## 🗓️ NGÀY 2 (2/1/2026) - HỆ THỐNG AUTH (Backend)

### Mục tiêu:

- Xây dựng API đăng ký/đăng nhập
- JWT authentication
- Password hashing

### Công việc:

**File cần tạo:**

- `backend/src/models/User.js` - User model
- `backend/src/controllers/authController.js` - Auth logic
- `backend/src/routes/auth.js` - Auth routes
- `backend/src/middleware/authMiddleware.js` - JWT verification
- `backend/src/utils/validators.js` - Input validation

**API Endpoints:**

```
POST /api/auth/register - Đăng ký
POST /api/auth/login - Đăng nhập
GET /api/auth/me - Lấy thông tin user hiện tại
POST /api/auth/logout - Đăng xuất
```

**Test:**

- Test API bằng Postman/Thunder Client
- Tạo 5 user mẫu vào database

**Kết quả ngày 2:**
✅ Auth API hoàn chỉnh
✅ JWT token generation/validation
✅ Password được hash an toàn (bcrypt)

---

## 🗓️ NGÀY 3 (3/1/2026) - AUTH UI (Frontend)

### Mục tiêu:

- Tạo trang đăng ký/đăng nhập
- Kết nối với API backend
- State management cho auth

### Công việc:

**File cần tạo:**

- `frontend/app/(auth)/login/page.tsx` - Trang đăng nhập
- `frontend/app/(auth)/register/page.tsx` - Trang đăng ký
- `frontend/components/auth/LoginForm.tsx` - Form đăng nhập
- `frontend/components/auth/RegisterForm.tsx` - Form đăng ký
- `frontend/lib/api/auth.ts` - Auth API client
- `frontend/lib/store/authStore.ts` - Zustand auth store
- `frontend/lib/utils/axios.ts` - Axios instance với interceptors

**UI Components:**

- Form với validation
- Loading states
- Error handling
- Success messages

**Kết quả ngày 3:**
✅ User có thể đăng ký/đăng nhập
✅ Token được lưu vào localStorage
✅ Protected routes (redirect nếu chưa login)

---

## 🗓️ NGÀY 4 (4/1/2026) - USER PROFILE & HEADER

### Mục tiêu:

- Trang profile cá nhân
- Header với user menu
- Update profile

### Công việc:

**Backend:**

- `backend/src/controllers/userController.js` - User CRUD
- `backend/src/routes/user.js` - User routes

**Frontend:**

- `frontend/app/profile/page.tsx` - Trang profile
- `frontend/components/profile/ProfileCard.tsx` - Card hiển thị thông tin
- `frontend/components/profile/EditProfileForm.tsx` - Form sửa profile
- Update `frontend/components/layout/Header.tsx` - Add user dropdown menu

**API:**

```
GET /api/users/:id - Lấy thông tin user
PUT /api/users/:id - Update profile
POST /api/users/:id/avatar - Upload avatar
```

**Kết quả ngày 4:**
✅ Xem và edit profile
✅ Upload avatar
✅ Header hiển thị user info + menu dropdown

---

## 🗓️ NGÀY 5 (5/1/2026) - FORUM POSTS (Backend API)

### Mục tiêu:

- API quản lý bài viết
- CRUD operations
- Pagination & filtering

### Công việc:

**File cần tạo:**

- `backend/src/models/Post.js` - Post model
- `backend/src/controllers/postController.js` - Post logic
- `backend/src/routes/posts.js` - Post routes

**API Endpoints:**

```
GET /api/posts - Lấy danh sách posts (pagination, filter by category)
GET /api/posts/:id - Lấy chi tiết post
POST /api/posts - Tạo post mới (cần auth)
PUT /api/posts/:id - Sửa post (cần auth)
DELETE /api/posts/:id - Xóa post (cần auth)
POST /api/posts/:id/like - Like/unlike post
```

**Database:**

- Insert 20-30 bài post mẫu vào database
- Các category: "Toán", "Vật Lí", "Hóa Học", "Tiếng Trung", "Thắc mắc"

**Kết quả ngày 5:**
✅ Posts API hoàn chỉnh
✅ Pagination working
✅ Like/unlike functionality

---

## 🗓️ NGÀY 6 (6/1/2026) - FORUM UI (Frontend)

### Mục tiêu:

- Hiển thị feed bài viết
- Tạo bài viết mới
- Like, comment

### Công việc:

**File cần tạo:**

- `frontend/app/forum/page.tsx` - Trang forum
- `frontend/components/forum/PostCard.tsx` - Card hiển thị post
- `frontend/components/forum/CreatePostForm.tsx` - Form tạo post
- `frontend/components/forum/PostDetail.tsx` - Chi tiết bài viết
- `frontend/lib/api/posts.ts` - Posts API client
- Update `frontend/components/layout/ForumFeed.tsx`

**Features:**

- Infinite scroll hoặc pagination
- Filter theo category
- Search posts
- Like animation
- Rich text editor (TipTap/Quill) cho nội dung post

**Kết quả ngày 6:**
✅ Forum feed hiển thị posts
✅ User có thể tạo, sửa, xóa post
✅ Like/unlike posts
✅ Filter và search working

---

## 🗓️ NGÀY 7 (7/1/2026) - COMMENTS SYSTEM

### Mục tiêu:

- Hệ thống comment cho posts
- Real-time comment count

### Công việc:

**Backend:**

- `backend/src/models/Comment.js` - Comment model
- `backend/src/controllers/commentController.js` - Comment logic
- `backend/src/routes/comments.js` - Comment routes

**Frontend:**

- `frontend/components/forum/CommentSection.tsx` - Comment section
- `frontend/components/forum/CommentItem.tsx` - Single comment
- `frontend/components/forum/CommentForm.tsx` - Form thêm comment

**API:**

```
GET /api/posts/:id/comments - Lấy comments của post
POST /api/posts/:id/comments - Thêm comment
DELETE /api/comments/:id - Xóa comment
```

**Kết quả ngày 7:**
✅ Comment system hoàn chỉnh
✅ Comment count tự động update
✅ Delete comment (chỉ owner/admin)

---

## 🗓️ NGÀY 8 (8/1/2026) - EXAM SYSTEM (Backend)

### Mục tiêu:

- Database đề thi & câu hỏi
- API quản lý đề thi

### Công việc:

**Backend:**

- `backend/src/models/Exam.js` - Exam model
- `backend/src/models/Question.js` - Question model
- `backend/src/controllers/examController.js` - Exam logic
- `backend/src/routes/exams.js` - Exam routes

**API:**

```
GET /api/exams - Lấy danh sách đề thi
GET /api/exams/:id - Chi tiết đề thi
GET /api/exams/:id/questions - Lấy câu hỏi của đề
POST /api/exams/:id/start - Bắt đầu làm bài
POST /api/exams/:id/submit - Nộp bài
GET /api/exams/:id/results - Xem kết quả
```

**Database:**

- Tạo 10-15 đề thi mẫu
- Mỗi đề 20-30 câu hỏi trắc nghiệm
- Subjects: Toán, Vật Lí, Hóa, Tiếng Trung Xã Hội, Tiếng Trung Tự Nhiên

**Seed data example:**

```sql
INSERT INTO exams (title, subject, exam_date, duration, total_questions) VALUES
('Đề 015', 'Toán', '2025-12-05', 60, 25),
('Đề 014', 'Vật Lí', '2025-12-05', 60, 25);

INSERT INTO questions (exam_id, question_text, question_type, options, correct_answer) VALUES
(1, 'Tính đạo hàm của f(x) = x^2 + 3x', 'multiple_choice',
 '["A. 2x + 3", "B. x^2 + 3", "C. 2x", "D. 3x"]', 'A');
```

**Kết quả ngày 8:**
✅ Exam & Question models
✅ API đề thi hoàn chỉnh
✅ 10+ đề thi với câu hỏi thật

---

## 🗓️ NGÀY 9 (9/1/2026) - EXAM LIST & CALENDAR UI

### Mục tiêu:

- Trang danh sách đề thi
- Calendar view theo ngày
- Filter theo môn học

### Công việc:

**File cần tạo:**

- `frontend/app/exams/page.tsx` - Trang danh sách đề
- `frontend/components/exams/ExamCard.tsx` - Card đề thi
- `frontend/components/exams/ExamCalendar.tsx` - Lịch thi
- `frontend/components/exams/ExamFilter.tsx` - Filter môn học
- `frontend/lib/api/exams.ts` - Exams API client

**UI:**

- Grid/List view đề thi
- Calendar view (group by date)
- Filter buttons: Tất cả, Toán, Vật Lí, Hóa, Tiếng Trung...
- Search đề thi

**Kết quả ngày 9:**
✅ Hiển thị danh sách đề thi
✅ Calendar view với ngày thi
✅ Filter theo môn học
✅ Responsive design

---

## 🗓️ NGÀY 10 (10/1/2026) - EXAM TAKING UI

### Mục tiêu:

- Giao diện làm bài thi
- Timer countdown
- Submit answers

### Công việc:

**File cần tạo:**

- `frontend/app/exams/[id]/take/page.tsx` - Trang làm bài
- `frontend/components/exams/ExamQuestion.tsx` - Component câu hỏi
- `frontend/components/exams/ExamTimer.tsx` - Timer countdown
- `frontend/components/exams/ExamNavigation.tsx` - Navigation câu hỏi
- `frontend/components/exams/SubmitConfirmModal.tsx` - Modal confirm nộp bài

**Features:**

- Hiển thị từng câu hỏi
- Chọn đáp án (A/B/C/D)
- Timer đếm ngược
- Auto-submit khi hết giờ
- Đánh dấu câu đã làm
- Navigation between questions
- Confirm trước khi nộp bài

**Local State:**

- Lưu answers vào state
- Track current question
- Time remaining

**Kết quả ngày 10:**
✅ UI làm bài thi hoàn chỉnh
✅ Timer working
✅ Submit answers to backend
✅ Prevent accidental page close

---

## 🗓️ NGÀY 11 (11/1/2026) - EXAM RESULTS & SCORING

### Mục tiêu:

- Tính điểm tự động
- Hiển thị kết quả
- Phân tích đáp án

### Công việc:

**Backend:**

- `backend/src/models/UserExamAttempt.js` - Attempt model
- `backend/src/services/scoringService.js` - Logic chấm điểm
- Update `examController.js` - Add scoring logic

**Frontend:**

- `frontend/app/exams/[id]/results/page.tsx` - Trang kết quả
- `frontend/components/exams/ResultSummary.tsx` - Tổng kết điểm
- `frontend/components/exams/AnswerReview.tsx` - Review từng câu
- `frontend/components/exams/ScoreChart.tsx` - Biểu đồ điểm

**Features:**

- Tổng điểm, số câu đúng/sai
- Review từng câu: đáp án của user vs đáp án đúng
- Explanation cho câu sai
- Phân tích theo dạng câu hỏi
- So sánh với điểm trung bình

**Database:**

```sql
user_exam_attempts:
- score (tính tự động)
- total_correct
- total_wrong
- answers (JSON: [{question_id, user_answer, is_correct}])
- time_taken
```

**Kết quả ngày 11:**
✅ Chấm điểm tự động
✅ Hiển thị kết quả chi tiết
✅ Review đáp án
✅ Lưu lịch sử làm bài

---

## 🗓️ NGÀY 12 (12/1/2026) - USER STATISTICS & ANALYTICS

### Mục tiêu:

- Thống kê học tập cá nhân
- Biểu đồ phân tích

### Công việc:

**Backend:**

- `backend/src/services/statsService.js` - Tính toán stats
- `backend/src/controllers/statsController.js` - Stats API
- `backend/src/routes/stats.js` - Stats routes

**Frontend:**

- `frontend/app/stats/page.tsx` - Trang thống kê
- `frontend/components/stats/StatsOverview.tsx` - Tổng quan
- `frontend/components/stats/SubjectChart.tsx` - Biểu đồ theo môn
- `frontend/components/stats/ErrorAnalysisChart.tsx` - Phân tích lỗi (như ảnh)
- `frontend/components/stats/ProgressChart.tsx` - Biểu đồ tiến độ

**Charts Library:**

- Install: `npm install recharts` hoặc `chart.js`

**Stats bao gồm:**

- Tổng số đề đã làm
- Điểm trung bình
- Điểm cao nhất/thấp nhất
- Phân tích lỗi sai (% theo dạng bài):
  - Hình học không gian: 34%
  - Toán ứng dụng: 22%
  - Bài toán cực trị: 15%
  - ...
- Biểu đồ tiến độ theo thời gian
- Môn mạnh/yếu

**API:**

```
GET /api/stats/user/:id - User stats
GET /api/stats/user/:id/subject/:subject - Stats theo môn
GET /api/stats/error-analysis/:user_id - Phân tích lỗi
```

**Kết quả ngày 12:**
✅ Stats page với charts
✅ Phân tích lỗi sai chi tiết
✅ Biểu đồ đẹp, trực quan

---

## 🗓️ NGÀY 13 (13/1/2026) - STUDY MATERIALS & RESOURCES

### Mục tiêu:

- Trang tài liệu học tập
- Lộ trình học
- Cấu trúc đề thi

### Công việc:

**Backend:**

- `backend/src/models/Material.js` - Study material model
- `backend/src/controllers/materialController.js`
- `backend/src/routes/materials.js`

**Frontend:**

- `frontend/app/materials/page.tsx` - Trang tài liệu
- `frontend/components/materials/MaterialCard.tsx` - Card tài liệu
- `frontend/components/materials/MaterialCategory.tsx` - Category tabs
- `frontend/components/materials/VocabularyList.tsx` - Danh sách từ vựng

**Content Structure:**

```
- Cấu trúc đề thi
  - Thông tin chung
  - Thời gian làm bài
  - Số câu hỏi

- Lí thuyết
  - Lí Thuyết (Toán, Lí, Hóa)
  - Từ vựng Tiếng Trung

- Đề mô phỏng
  - Link đến đề thi thật

- Tự luận nâng cao
  - Hướng dẫn làm bài tự luận
```

**Database:**

```sql
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  content TEXT,
  category VARCHAR(100),
  subject VARCHAR(100),
  file_url VARCHAR(500),
  created_at TIMESTAMP
);
```

**Kết quả ngày 13:**
✅ Materials page
✅ Tài liệu theo category
✅ Từ vựng Tiếng Trung
✅ Cấu trúc đề thi

---

## 🗓️ NGÀY 14 (14/1/2026) - RESPONSIVE & UI POLISH

### Mục tiêu:

- Responsive design cho mobile
- UI/UX improvements
- Loading states, error handling

### Công việc:

**Frontend Polish:**

1. **Responsive Design:**

   - Mobile menu (hamburger)
   - Responsive grid/layout
   - Touch-friendly buttons
   - Mobile exam taking UI

2. **Loading States:**

   - Skeleton loaders
   - Spinner components
   - Progressive loading

3. **Error Handling:**

   - Error boundary
   - Toast notifications
   - Fallback UI
   - Network error handling

4. **Accessibility:**
   - Keyboard navigation
   - ARIA labels
   - Focus states
   - Alt texts

**File cần tạo/update:**

- `frontend/components/ui/Skeleton.tsx` - Skeleton loader
- `frontend/components/ui/Toast.tsx` - Toast notification
- `frontend/components/ui/ErrorBoundary.tsx` - Error boundary
- `frontend/components/ui/Loading.tsx` - Loading spinner
- `frontend/components/layout/MobileMenu.tsx` - Mobile navigation

**CSS Improvements:**

- Smooth transitions
- Hover effects
- Focus states
- Color consistency

**Kết quả ngày 14:**
✅ Fully responsive (mobile, tablet, desktop)
✅ Loading states everywhere
✅ Error handling robust
✅ UI polished và đẹp

---

## 🗓️ NGÀY 15 (15/1/2026) - TESTING, OPTIMIZATION & DEPLOYMENT

### Mục tiêu:

- Testing
- Performance optimization
- Deploy lên production

### Công việc:

#### 1. Testing

**File cần tạo:**

- `backend/tests/auth.test.js` - Auth tests
- `backend/tests/exams.test.js` - Exam tests
- `frontend/__tests__/LoginForm.test.tsx` - Component tests

**Testing tools:**

```bash
# Backend
npm install --save-dev jest supertest

# Frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**Test cases:**

- Auth flow (login, register, logout)
- Exam taking flow
- API endpoints
- Component rendering

#### 2. Performance Optimization

- Image optimization (Next.js Image component)
- Code splitting
- Lazy loading components
- Database indexing
- API response caching

**File updates:**

- Add indexes to database
- Implement React.lazy() for heavy components
- Add memoization where needed

#### 3. Documentation

**File cần update:**

- `README.md` - Project overview
- `backend/README.md` - API documentation
- `frontend/README.md` - Frontend docs
- `.env.example` - Environment variables

#### 4. Deployment

**Docker:**

- Build production images
- Test docker-compose

**Environment:**

- Setup production .env
- Configure CORS
- Setup SSL/HTTPS

**Deploy to:**

- Frontend: Vercel/Netlify
- Backend: Railway/Render/VPS
- Database: Railway/Supabase/AWS RDS

**File cần tạo:**

- `.dockerignore`
- `frontend/.env.production`
- `backend/.env.production`
- `nginx.conf` (nếu dùng nginx)

**Deployment checklist:**

```
□ Database migrated to production
□ Seed data inserted
□ Environment variables set
□ CORS configured
□ Frontend deployed
□ Backend deployed
□ SSL certificate installed
□ Domain name configured
□ Test all features on production
```

**Kết quả ngày 15:**
✅ Tests passed
✅ Performance optimized
✅ Documentation complete
✅ **Website LIVE trên production!**

---

## 📊 TỔNG KẾT

### Files đã tạo (60+ files):

**Backend (25+ files):**

- Models: User, Post, Comment, Exam, Question, UserExamAttempt, Material
- Controllers: Auth, User, Post, Comment, Exam, Stats, Material
- Routes: 7 route files
- Services: Scoring, Stats
- Middleware: Auth, Validation
- Config: Database, Environment

**Frontend (35+ files):**

- Pages: 12+ pages (login, register, forum, exams, profile, stats, materials...)
- Components: 30+ components
- API clients: 5+ files
- Store: Auth store, Exam store
- Utils: Axios, validators, helpers

**Database:**

- 8+ tables with relationships
- Migrations
- Seed data

**Config:**

- Docker compose
- Environment files
- Testing setup

### Công nghệ đã sử dụng:

- ✅ Next.js 14 (App Router)
- ✅ TypeScript
- ✅ Node.js + Express
- ✅ PostgreSQL/MySQL
- ✅ JWT Authentication
- ✅ TailwindCSS
- ✅ Zustand (State management)
- ✅ React Query (Data fetching)
- ✅ Recharts (Charts)
- ✅ Docker
- ✅ Jest (Testing)

### Features hoàn thành:

1. ✅ Authentication system
2. ✅ User profiles
3. ✅ Forum/Social feed
4. ✅ Comments system
5. ✅ Exam system with 10+ real exams
6. ✅ Exam taking interface with timer
7. ✅ Auto-grading & results
8. ✅ Statistics & analytics
9. ✅ Study materials
10. ✅ Responsive design
11. ✅ Production deployment

---

## 🎯 LỜI KHUYÊN

1. **Ngày 1-3:** Focus vào foundation (auth, database) - QUAN TRỌNG NHẤT
2. **Ngày 4-7:** Build core features (forum, posts)
3. **Ngày 8-11:** Exam system - TRỌNG TÂM của project
4. **Ngày 12-13:** Value-add features (stats, materials)
5. **Ngày 14-15:** Polish & deploy

**Tips:**

- Commit code mỗi ngày lên Git
- Test features ngay sau khi làm
- Đừng skip database seed data
- UI có thể đơn giản nhưng phải functional
- Ưu tiên backend logic trước, UI sau

**Nếu bị chậm tiến độ:**

- Giảm số lượng đề thi mẫu (5 đề thay vì 10)
- Skip study materials page
- Đơn giản hóa charts/stats
- Deploy ngày 14, dành ngày 15 fix bugs

---

**BẮT ĐẦU TỪ NGÀY MAI (2/1/2026)!** 🚀
