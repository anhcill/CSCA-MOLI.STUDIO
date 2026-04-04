# Performance Optimization Guidelines

## ✅ ĐÃ TỐI ƯU (Feb 2026)

### 🚀 **Frontend Optimizations**

#### 1. **Next.js Configuration** ([next.config.js](next.config.js))

- ✅ Image optimization với Next/Image
- ✅ Cloudinary remote patterns
- ✅ WebP & AVIF formats
- ✅ Response sizes: 640, 750, 828, 1080, 1200, 1920px
- ✅ Cache TTL: 7 days
- ✅ Gzip compression enabled
- ✅ SWC minification
- ✅ CSS optimization (experimental)

#### 2. **Image Optimization**

- ✅ [LazyImage Component](components/common/LazyImage.tsx) - Tự động lazy load
- ✅ [imageOptimizer.ts](lib/utils/imageOptimizer.ts) - Cloudinary transformations
- ✅ Presets: thumbnail, avatar, postImage, questionImage
- ✅ Responsive srcSet generation
- ✅ Auto format (WebP/AVIF)
- ✅ Quality: auto

#### 3. **Loading States**

- ✅ [Skeletons.tsx](components/common/Skeletons.tsx) - Reusable loading skeletons
- ✅ PostSkeleton, MaterialCardSkeleton, ExamCardSkeleton, ProfileStatSkeleton
- ✅ Smooth loading transitions

---

### ⚡ **Backend Optimizations**

#### 1. **Response Compression**

- ✅ Gzip enabled ([index.js](../backend/src/index.js))
- ✅ Auto compress JSON responses

#### 2. **Caching Headers**

- ✅ Materials API: `Cache-Control: public, max-age=300` (5 minutes)
- ✅ Static assets caching

#### 3. **Database Pagination**

- ✅ Posts API: `?limit=20&offset=0`
- ✅ Materials API: `?limit=50&offset=0`
- ✅ Efficient offset-based pagination

#### 4. **Database Indexes** ([migrations.js](../backend/src/config/migrations.js))

- ✅ `idx_exam_attempts_exam_user` (exam_id, user_id, status)
- ✅ `idx_exam_attempts_score` (exam_id, user_id, total_score)
- ✅ `idx_questions_exam_id` (exam_id)
- ✅ `idx_subjects_code` (code)
- ✅ `idx_exams_subject_status` (subject_id, status, publish_date)
- ✅ `idx_answers_question_id` (question_id, answer_key)
- ✅ `idx_posts_user_id` (user_id)
- ✅ `idx_posts_created_at` (created_at DESC)
- ✅ `idx_post_likes_post_id` (post_id)
- ✅ `idx_post_comments_post_id` (post_id)
- ✅ `idx_materials_category` (category)
- ✅ `idx_materials_subject` (subject)

---

## 📦 **Usage Examples**

### Use LazyImage for Cloudinary Images

```tsx
import LazyImage from "@/components/common/LazyImage";

// Auto-optimized
<LazyImage
  src={cloudinaryUrl}
  alt="Description"
  width={800}
  height={600}
  quality={80}
/>;
```

### Use Cloudinary Presets

```tsx
import { imagePresets } from "@/lib/utils/imageOptimizer";

const optimizedUrl = imagePresets.avatar(userAvatarUrl);
const postImageUrl = imagePresets.postImage(imageUrl);
```

### Use Loading Skeletons

```tsx
import { PostSkeleton } from "@/components/common/Skeletons";

{
  loading ? <PostSkeleton /> : <PostComponent />;
}
```

### Pagination in API Calls

```tsx
// Frontend
const { data } = await axios.get("/api/posts?limit=20&offset=0");

// Backend - automatically cached
exports.getPosts = async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  // ... query with LIMIT and OFFSET
  res.set("Cache-Control", "public, max-age=300");
};
```

---

## 🎯 **Performance Metrics Target**

- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.5s
- Cumulative Layout Shift (CLS): < 0.1
- Total Blocking Time (TBT): < 200ms

---

## 🔧 **Next Steps (Optional)**

### Advanced Optimizations

- [ ] React.lazy() for heavy components (Admin pages)
- [ ] Service Worker for offline caching
- [ ] Redis caching for API responses
- [ ] CDN for static assets
- [ ] Database query result caching
- [ ] Infinite scroll pagination
- [ ] Virtual scrolling for long lists

### Monitoring

- [ ] Add performance monitoring (Web Vitals)
- [ ] Lighthouse CI integration
- [ ] Bundle analyzer
- [ ] API response time tracking
