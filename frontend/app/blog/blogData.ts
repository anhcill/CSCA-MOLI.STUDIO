export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  readTime: number;
  featured?: boolean;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'cach-luyen-thi-hsk-3-hieu-qua-trong-3-thang',
    title: 'Cách Luyện Thi HSK 3 Hiệu Quả Trong 3 Tháng: Lộ Trình Chi Tiết Từ A-Z',
    excerpt: 'Bạn đang muốn chinh phục bài thi HSK 3 nhưng không biết bắt đầu từ đâu? Cùng MOLI.STUDIO xây dựng lộ trình 3 tháng giúp bạn đạt target score 180+ một cách hiệu quả.',
    content: `
# Cách Luyện Thi HSK 3 Hiệu Quả Trong 3 Tháng

Bài thi HSK 3 là bài thi đánh giá năng lực tiếng Trung ở mức trung cấp sơ cấp, yêu cầu khoảng 600 từ vựng và các cấu trúc ngữ pháp cơ bản. Nếu bạn đặt mục tiêu đạt **180+/200 điểm** trong 3 tháng, đây là lộ trình chi tiết dành cho bạn.

## 📊 Cấu Trúc Bài Thi HSK 3

HSK 3 gồm **3 phần thi** với tổng cộng **80 câu hỏi**, thời gian làm bài **40 phút**:

| Phần | Nội dung | Số câu | Từ vựng cần biết |
|------|----------|--------|-------------------|
| Nghe | Hội thoại ngắn + dài | 40 câu | Khoảng 300 từ |
| Đọc | Câu độc lập + đoạn văn | 30 câu | Khoảng 300 từ |
| Viết | Ghép câu + viết câu | 10 câu | Ngữ pháp cơ bản |

## 📅 Lộ Trình 12 Tuần

### **Giai Đoạn 1: Nền Tảng (Tuần 1-4)**

**Tuần 1-2: Hệ thống hóa từ vựng**
- Học **10-15 từ mới mỗi ngày** (ưu tiên từ có tần suất cao)
- Sử dụng flashcard (Anki, Quizlet) để ôn tập
- Ghi chép từ mới kèm ví dụ thực tế
- Tập trung vào các chủ đề: gia đình, công việc, du lịch, sở thích

**Tuần 3-4: Ngữ pháp cốt lõi**
- Học các cấu trúc ngữ pháp đặc biệt của tiếng Trung
  - 把 (bǎ) - câu bị động
  - 被 (bèi) - câu bị động
  - 越...越... - càng...càng...
  - 虽然...但是... - mặc dù...nhưng...
  - 因为...所以... - vì...nên...
- Làm bài tập ngữ pháp mỗi ngày

### **Giai Đoạn 2: Luyện Tập Chuyên Sâu (Tuần 5-8)**

**Tuần 5-6: Luyện nghe**
- Nghe **đề thi mô phỏng HSK 3** mỗi ngày (ít nhất 1 bài)
- Lần 1: Nghe toàn bộ, làm bài
- Lần 2: Nghe từng phần, nghe đi nghe lại những chỗ chưa hiểu
- Chép lại những câu khó nghe
- Ghi chú từ mới gặp được

**Tuần 7-8: Luyện đọc & viết**
- Đọc các đoạn văn ngắn 100-200 chữ
- Tập ghép câu theo mẫu
- Luyện viết câu với từ vựng đã học
- Tập trung vào các mẫu câu thường gặp trong HSK 3

### **Giai Đoạn 3: Thi Thử & Ôn Luyện (Tuần 9-12)**

**Tuần 9-10: Thi thử có thời gian**
- Làm **2-3 đề thi mô phỏng mỗi tuần** trong điều kiện giống thi thật
- Bấm giờ chính xác
- Không tra từ điện khi làm bài
- Sau khi làm xong, đối chiếu đáp án và phân tích lỗi sai

**Tuần 11-12: Ôn tập toàn diện**
- Ôn lại từ vựng yếu qua flashcard
- Xem lại những lỗi sai thường gặp
- Làm thêm đề thi để tăng tốc độ
- Nghỉ ngơi, giữ sức khỏe trước ngày thi

## 💡 Mẹo Đạt Điểm Cao

1. **Quản lý thời gian:** Phân bổ khoảng 30 giây/câu nghe, 1 phút/câu đọc
2. **Đoán từ loại:** Nếu không biết từ, dựa vào vị trí/từ loại để đoán
3. **Chú ý từ hóa:** 一 (yī), 没 (méi), 不 (bù) thường làm thay đổi nghĩa
4. **Tập trung phần nghe:** Phần nghe chiếm 50% điểm số

## 📚 Tài Liệu Tham Khảo

- Sách HSK 3 chính thức của HSKK
- Đề thi mô phỏng trên MOLI.STUDIO
- Ứng dụng học từ vựng: Pleco, ChineseSkill
- Kênh YouTube: Chinese Zero to Hero

Chúc bạn ôn thi hiệu quả và đạt kết quả tốt! 🎯
    `,
    coverImage: '/images/blog/luyen-thi-hsk3.jpg',
    author: 'MOLI.STUDIO',
    publishedAt: '2026-05-01',
    updatedAt: '2026-05-01',
    category: 'Luyện thi HSK',
    tags: ['HSK 3', 'luyện thi HSK', 'tiếng Trung', 'học tiếng Trung', 'mẹo thi HSK'],
    readTime: 8,
    featured: true,
  },
  {
    slug: 'so-sanh-hsk-1-vs-hsk-2-nen-thi-bac-nao',
    title: 'So Sánh HSK 1 vs HSK 2: Nên Thi Bậc Nào? Hướng Dẫn Chọn Bậc Thi Phù Hợp',
    excerpt: 'Nên bắt đầu từ HSK 1 hay nhảy lên HSK 2? Bài viết so sánh chi tiết hai bậc thi về nội dung, độ khó, yêu cầu và đưa ra gợi ý giúp bạn chọn bậc thi phù hợp với trình độ hiện tại.',
    content: `
# So Sánh HSK 1 vs HSK 2: Nên Thi Bậc Nào?

Nếu bạn mới bắt đầu học tiếng Trung hoặc đang phân vân giữa HSK 1 và HSK 2, bài viết này sẽ giúp bạn so sánh chi tiết và đưa ra quyết định đúng đắn.

## 📊 Bảng So Sánh Tổng Quan

| Tiêu chí | HSK 1 | HSK 2 |
|----------|-------|-------|
| **Từ vựng** | 150 từ | 300 từ |
| **Ngữ pháp** | Cơ bản nhất | Cơ bản |
| **Độ khó** | Dễ | Trung bình |
| **Thời gian thi** | 35 phút | 40 phút |
| **Số câu** | 40 câu | 60 câu |
| **Mục tiêu điểm** | 120/200 | 120/200 |
| **Thời gian học** | 1-2 tháng | 2-3 tháng |

## 📝 Chi Tiết Từng Phần Thi

### **HSK 1 - Nghe**

| Loại | Nội dung |
|------|----------|
| Câu 1-10 | Nghe 1 câu, chọn 1 trong 4 đáp án |
| Câu 11-20 | Nghe 2 câu, chọn 1 trong 4 đáp án |

### **HSK 1 - Đọc**

| Loại | Nội dung |
|------|----------|
| Câu 21-30 | Chọn câu đúng với tranh |
| Câu 31-40 | Chọn đáp án đúng |

### **HSK 2 - Nghe**

| Loại | Nội dung |
|------|----------|
| Câu 1-20 | Nghe 1 câu, chọn đáp án |
| Câu 21-35 | Nghe đoạn hội thoại, chọn đáp án |

### **HSK 2 - Đọc**

| Loại | Nội dung |
|------|----------|
| Câu 36-50 | Chọn đáp án đúng |
| Câu 51-60 | Ghép câu |

## 🎯 Nên Chọn HSK 1 Khi Nào?

- **Mới bắt đầu** học tiếng Trung (dưới 3 tháng)
- Chưa nắm vững **150 từ vựng cơ bản**
- Chưa quen với **cấu trúc câu tiếng Trung**
- Mục đích: Lấy **chứng chỉ tham khảo** hoặc xác định trình độ
- Muốn **xây dựng nền tảng** vững trước khi lên cao hơn

## 🎯 Nên Chọn HSK 2 Khi Nào?

- Đã học tiếng Trung được **3-6 tháng**
- Nắm vững ít nhất **200-250 từ vựng**
- Đã quen với **ngữ pháp cơ bản**: chủ ngữ + vị ngữ, câu hỏi yes/no
- Mục tiêu: Lấy chứng chỉ để **du học, xin việc** hoặc **học bổng**
- Đã học HSK 1 và muốn **tiếp tục nâng cao**

## 💡 Lời Khuyên Từ Chuyên Gia

### **Đừng nhảy cóc quá nhanh**
Nhiều người muốn thi HSK 3, 4 ngay để "tiết kiệm thời gian", nhưng thực tế:
- HSK 2 là nền tảng rất quan trọng cho HSK 3
- Học chắc HSK 2 giúp HSK 3 dễ hơn nhiều
- Chứng chỉ HSK 2 vẫn có giá trị trong nhiều trường hợp

### **Đánh giá trình độ thực tế**
Hãy thử làm một đề HSK 2 trước khi quyết định:
- Đạt **60% trở lên** → Có thể thi HSK 2
- Đạt **dưới 60%** → Nên quay lại học kỹ hơn

## 📈 Lộ Trình Đề Xuất

\`\`\`
Tháng 1-2: HSK 1 → Thi → Đạt target
Tháng 3-5: HSK 2 → Thi → Đạt target
Tháng 6-9: HSK 3 → Thi → Đạt target
\`\`\`

## 🔗 Thi Thử Miễn Phí

Trên MOLI.STUDIO, bạn có thể thi thử HSK 1 và HSK 2 **hoàn toàn miễn phí** để:
- Làm quen với format đề thi
- Đánh giá trình độ hiện tại
- Xác định bậc thi phù hợp

Hãy bắt đầu ngay hôm nay!
    `,
    coverImage: '/images/blog/so-sanh-hsk.jpg',
    author: 'MOLI.STUDIO',
    publishedAt: '2026-05-03',
    updatedAt: '2026-05-03',
    category: 'Hướng dẫn thi HSK',
    tags: ['HSK 1', 'HSK 2', 'so sánh HSK', 'chứng chỉ HSK', 'thi tiếng Trung'],
    readTime: 7,
  },
  {
    slug: 'tu-vung-hsk-4-theo-chu-de-hoc-ngay',
    title: 'Từ Vựng HSK 4 Theo Chủ Đề: 500+ Từ Cần Nhớ Để Đạt Target',
    excerpt: 'Tổng hợp 500+ từ vựng HSK 4 được phân loại theo 15 chủ đề phổ biến nhất, kèm ví dụ và cách ghi nhớ hiệu quả. File PDF miễn phí tải về tại MOLI.STUDIO.',
    content: `
# Từ Vựng HSK 4 Theo Chủ Đề: 500+ Từ Cần Nhớ

HSK 4 yêu cầu **1.200 từ vựng** và là bài thi chuyển tiếp từ sơ cấp sang trung cấp. Bài viết này tổng hợp **500+ từ quan trọng nhất** được phân theo chủ đề, giúp bạn học có hệ thống và hiệu quả.

## 📚 Danh Sách Chủ Đề Từ Vựng HSK 4

### **1. Công Việc & Sự Nghiệp** (50 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | gōngzī | 工资 | Lương |
| 2 | gōngzuò | 工作 | Công việc |
| 3 | jiābān | 加班 | Tăng ca |
| 4 | qǐzi | 辞职 | Nghỉ việc |
| 5 | miǎnshì | 面试 | Phỏng vấn |
| 6 | zhíwèi | 职位 | Vị trí công việc |
| 7 | jìngzhēng | 竞争 | Cạnh tranh |
| 8 | chénggōng | 成功 | Thành công |
| 9 | shībài | 失败 | Thất bại |
| 10 | jìnzhǎn | 进展 | Tiến triển |

### **2. Giáo Dục & Học Tập** (50 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | xuéxiào | 学校 | Trường học |
| 2 | xuésheng | 学生 | Học sinh |
| 3 | lǎoshī | 老师 | Giáo viên |
| 4 | kǎoshì | 考试 | Thi cử |
| 5 | jìnlai | 进来 | Vào trong |
| 6 | chéngjì | 成绩 | Kết quả học tập |
| 7 | zhuānyè | 专业 | Chuyên ngành |
| 8 | dàxué | 大学 | Đại học |
| 9 | yánjiūshēng | 研究生 | Nghiên cứu sinh |
| 10 | bìyè | 毕业 | Tốt nghiệp |

### **3. Gia Đình & Cuộc Sống** (40 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | jiātíng | 家庭 | Gia đình |
| 2 | fùmǔ | 父母 | Bố mẹ |
| 3 | háizi | 孩子 | Con cái |
| 4 | jiérì | 节日 | Ngày lễ |
| 5 | shēngrì | 生日 | Sinh nhật |
| 6 | jiéhūn | 结婚 | Kết hôn |
| 7 | líhūn | 离婚 | Ly hôn |
| 8 | qīnài | 亲爱的 | Yêu quý |
| 9 | zhàogù | 照顾 | Chăm sóc |
| 10 | jiāotì | 交替 | Thay thế |

### **4. Du Lịch & Di Chuyển** (45 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | lǚxíng | 旅行 | Du lịch |
| 2 | lǚguǎn | 旅馆 | Khách sạn |
| 3 | fēijī | 飞机 | Máy bay |
| 4 | huǒchē | 火车 | Tàu hỏa |
| 5 | chēzhàn | 车站 | Nhà ga |
| 6 | jīpiào | 机票 | Vé máy bay |
| 7 | lǚxíngshè | 旅行社 | Công ty lữ hành |
| 8 | fēngjǐngqū | 风景区 | Khu du lịch |
| 9 | zhàopiàn | 照片 | Bức ảnh |
| 10 | jìniànpǐn | 纪念品 | Quà lưu niệm |

### **5. Sức Khỏe & Y Tế** (40 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | yīyuàn | 医院 | Bệnh viện |
| 2 | yīshēng | 医生 | Bác sĩ |
| 3 | bìng | 病 | Bệnh |
| 4 | yào | 药 | Thuốc |
| 5 | shǒushù | 手术 | Phẫu thuật |
| 6 | jiǎnchá | 检查 | Kiểm tra |
| 7 | zhùyuàn | 住院 | Nhập viện |
| 8 | chūyuàn | 出院 | Xuất viện |
| 9 | gǎn冒 | 感冒 | Cảm cúm |
| 10 | tóutòng | 头痛 | Đau đầu |

### **6. Ăn Uống & Nhà Hàng** (40 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | cānting | 餐厅 | Nhà hàng |
| 2 | cài | 菜 | Món ăn |
| 3 | fúwùyuán | 服务员 | Người phục vụ |
| 4 | diǎncài | 点菜 | Gọi món |
| 5 | zhǎngdān | 账单 | Hóa đơn |
| 6 | fùzhàng | 付账 | Trả tiền |
| 7 | xiǎofèi | 消费 | Tiêu dùng |
| 8 | wèidao | 味道 | Mùi vị |
| 9 | tián | 甜 | Ngọt |
| 10 | xiān | 鲜 | Tươi |

### **7. Mua Sắm & Thương Mại** (45 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | shāngchǎng | 商场 | Trung tâm thương mại |
| 2 | shāngdiàn | 商店 | Cửa hàng |
| 3 | jiàgé | 价格 | Giá cả |
| 4 | yōuhuì | 优惠 | Ưu đãi |
| 5 | dǎzhé | 打折 | Giảm giá |
| 6 | mǎi | 买 | Mua |
| 7 | mài | 卖 | Bán |
| 8 | tuánduì | 团队 | Nhóm |
| 9 | tuījiàn | 推荐 | Giới thiệu |
| 10 | jìnkuǎn | 进款 | Khoản thu |

### **8. Truyền Thông & Công Nghệ** (45 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | diànshì | 电视 | Tivi |
| 2 | diànyǐng | 电影 | Phim |
| 3 | bàodào | 报道 | Đưa tin |
| 4 | xīnwén | 新闻 | Tin tức |
| 5 | shíjiān | 时间 | Thời gian |
| 6 | gǎibiān | 改变 | Thay đổi |
| 7 | jìlù | 记录 | Ghi chép |
| 8 | guǎngbō | 广播 | Phát thanh |
| 9 | yǐnqíng | 引擎 | Động cơ |
| 10 | kējì | 科技 | Khoa học công nghệ |

### **9. Cảm Xúc & Tính Cách** (40 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | gāoxìng | 高兴 | Vui vẻ |
| 2 | nánguò | 难过 | Buồn |
| 3 | jǐnzhāng | 紧张 | Lo lắng |
| 4 | hàipà | 害怕 | Sợ hãi |
| 5 | shēngqì | 生气 | Tức giận |
| 6 | jīngyà | 惊讶 | Ngạc nhiên |
| 7 | wúliáo | 无聊 | Chán nản |
| 8 | píjuàn | 疲倦 | Mệt mỏi |
| 9 | juéde | 觉得 | Cảm thấy |
| 10 | xìngróng | 形容 | Hình dung |

### **10. Môi Trường & Xã Hội** (40 từ)

| STT | Pinyin | Hán Tự | Nghĩa |
|-----|--------|--------|-------|
| 1 | huánjìng | 环境 | Môi trường |
| 2 | wūrǎn | 污染 | Ô nhiễm |
| 3 | zìrán | 自然 | Tự nhiên |
| 4 | shìjiè | 世界 | Thế giới |
| 5 | guójiā | 国家 | Quốc gia |
| 6 | shèhuì | 社会 | Xã hội |
| 7 | rénkǒu | 入口 | Lối vào |
| 8 | jūmín | 居民 | Cư dân |
| 9 | fúwù | 服务 | Phục vụ |
| 10 | yǐngxiǎng | 影响 | Ảnh hưởng |

## 💡 Cách Học Từ Vựng Hiệu Quả

### **1. Sử dụng Flashcard**
- Tạo deck Anki riêng cho mỗi chủ đề
- Ôn tập **20-30 phút mỗi ngày**
- Áp dụng spacing repetition

### **2. Học theo câu**
- Không học từ đơn lẻ
- Mỗi từ cần ít nhất 2 ví dụ
- Ghi chú cụm từ thường đi cùng

### **3. Nghe chủ động**
- Nghe podcast tiếng Trung
- Xem phim có phụ đề
- Ghi lại từ mới khi gặp

### **4. Sử dụng ngay**
- Nói với bản thân bằng tiếng Trung
- Viết nhật ký ngắn
- Tìm bạn luyện nói

## 📥 Tải File PDF Từ Vựng

Trên MOLI.STUDIO, bạn có thể tải **file PDF từ vựng HSK 4 theo chủ đề** hoàn toàn miễn phí, bao gồm:
- 500+ từ vựng có pinyin & nghĩa
- Phân loại theo 15 chủ đề
- Ví dụ minh họa cho mỗi từ
- File audio phát âm

Bắt đầu học ngay hôm nay!
    `,
    coverImage: '/images/blog/tu-vung-hsk4.jpg',
    author: 'MOLI.STUDIO',
    publishedAt: '2026-05-05',
    updatedAt: '2026-05-05',
    category: 'Từ vựng HSK',
    tags: ['từ vựng HSK 4', 'HSK 4', 'học tiếng Trung', '500 từ HSK', 'từ vựng tiếng Trung'],
    readTime: 10,
    featured: true,
  },
  {
    slug: 'bi-quyet-dat-200-200-diem-hskk',
    title: 'Bí Quyết Đạt 200/200 Điểm HSKK: Kinh Nghiệm Từ Người Đạt Điểm Tuyệt Đối',
    excerpt: ' Chia sẻ chiến thuật làm bài thi HSKK từ người đạt điểm tuyệt đối 200/200: cách ôn luyện phần nghe - nói, mẹo đạt điểm cao từng phần thi.',
    content: `
# Bí Quyết Đạt 200/200 Điểm HSKK: Kinh Nghiệm Từ Người Đạt Điểm Tuyệt Đối

Bài thi HSKK (Hànyǔ Shuǐpíng Kǒuyǔ Kǎoshì) đánh giá kỹ năng nói và nghe của người học tiếng Trung. Đạt **200/200 điểm** là mục tiêu của nhiều thí sinh, và bài viết này sẽ chia sẻ bí quyết từ những người đã làm được.

## 📊 Cấu Trúc Bài Thi HSKK

### **HSKK Sơ cấp (Beginner)**
| Phần | Nội dung | Số câu | Thời gian |
|------|----------|--------|-----------|
| Nghe | Nghe và trả lời | 15 câu | 20 phút |
| Nói | Trả lời câu hỏi | 10 câu | 10 phút |

### **HSKK Trung cấp (Intermediate)**
| Phần | Nội dung | Số câu | Thời gian |
|------|----------|--------|-----------|
| Nghe | Nghe đoạn hội thoại | 15 câu | 25 phút |
| Nói | Trả lời + Tường thuật | 20 câu | 15 phút |

### **HSKK Cao cấp (Advanced)**
| Phần | Nội dung | Số câu | Thời gian |
|------|----------|--------|-----------|
| Nghe | Nghe đoạn dài | 15 câu | 25 phút |
| Nói | Tường thuật + Ngẫu nhiên | 10 câu | 25 phút |

## 🎯 Chiến Thuật Phần Nghe HSKK

### **Mẹo nghe hiệu quả**

1. **Đọc trước đáp án (nếu có đề)**
   - Trước khi nghe, đọc lướt các đáp án
   - Xác định từ khóa cần nghe
   - Dự đoán nội dung câu hỏi

2. **Ghi chú nhanh**
   - Ghi lại số liệu, ngày tháng, tên riêng
   - Đánh dấu từ phủ định: 没, 不, 别
   - Chú ý từ chỉ số lượng

3. **Phân biệt giọng nói**
   - Nam/nữ: 他/她, 这位先生/女士
   - Nhiều người: 他们, 大家, 我们
   - Chủ ngữ ẩn: 省略主语

### **Cấu trúc câu hỏi thường gặp**

| Loại câu hỏi | Từ khóa | Chiến thuật |
|--------------|---------|-------------|
| Hỏi thời gian | 什么时候, 几点, 几点钟 | Ghi số |
| Hỏi địa điểm | 在哪儿, 哪儿 | Ghi nơi chốn |
| Hỏi số lượng | 几个, 多少 | Ghi số |
| Hỏi người | 谁 | Ghi tên |
| Hỏi sự việc | 做什么, 怎么了 | Ghi hành động |

## 🎤 Chiến Thuật Phần Nói HSKK

### **HSKK Sơ cấp: Trả lời câu hỏi**

**Cấu trúc trả lời chuẩn:**
\`\`\`
肯定/否定 + 原因/说明 + 例子（如果有时间）
\`\`\`

**Ví dụ:**
> Hỏi: 你喜欢学习汉语吗？
> Đáp: 是的，我非常喜欢学习汉语。因为汉语很有意思，而且我觉得学汉语对未来工作很有帮助。

**Tiêu chí chấm điểm:**
- Phát âm chuẩn: 25 điểm
- Ngữ pháp đúng: 25 điểm
- Nội dung phù hợp: 25 điểm
- Thông tin đầy đủ: 25 điểm

### **HSKK Trung cấp: Trả lời + Tường thuật**

**Mẫu trả lời câu hỏi:**
> Hỏi: 你觉得学习外语重要吗？为什么？
> Đáp: 我觉得学习外语非常重要。首先，它可以帮我们了解不同的文化；其次，外语能力对找工作也很有帮助。

**Mẫu tường thuật:**
> Chủ đề: 我的学习计划
> Bắt đầu: 我想和大家分享我的学习计划。
> Nội dung: 首先，我想提高我的汉语水平；其次，我计划每天学习两个小时；最后，我希望能在一年内通过HSK5。
> Kết thúc: 以上就是我的学习计划。

### **HSKK Cao cấp: Tường thuật + Ngẫu nhiên**

**Cấu trúc tường thuật chuẩn:**
\`\`\`
1. 开场白：今天我要讲的话题是...
2. 背景介绍：这个话题的背景是...
3. 主体内容：主要有以下几点...
4. 举例说明：比如说...
5. 总结：总的来说，我认为...
6. 结束语：以上就是我的一些看法。
\`\`\`

**Chủ đề tường thuật thường gặp:**
- 我的朋友
- 我的家乡
- 我的学习计划
- 我的梦想
- 一件难忘的事

## ⏰ Quản Lý Thời Gian

| Giai đoạn | Thời gian | Việc cần làm |
|-----------|-----------|--------------|
| Chuẩn bị | 5 phút | Đọc đề, gạch ý chính |
| Phần 1 | 40% thời gian | Nghe - ghi chú - chọn đáp án |
| Phần 2 | 40% thời gian | Nói - tập trung phát âm |
| Kiểm tra | 20% thời gian | Xem lại đáp án |

## 📚 Tài Liệu Ôn Tập HSKK

1. **Sách chính thức HSKK**
   - HSKK Sơ cấp
   - HSKK Trung cấp  
   - HSKK Cao cấp

2. **Đề thi mô phỏng**
   - MOLI.STUDIO: Đề thi HSKK các cấp
   - ChineseTest.cn
   - YouTube channels

3. **Luyện nói**
   - HelloChinese app
   - iTalki (tìm gia sư)
   - Speechling (luyện phát âm)

## 💡 Mẹo Tâm Lý Khi Thi

1. **Đừng hoảng nếu không nghe rõ**
   - Bình tĩnh, có thể đoán từ ngữ cảnh
   - Đừng dừng lại ở 1 câu quá lâu

2. **Nói chậm nhưng chắc**
   - Không cần nói nhanh
   - Quan trọng là phát âm rõ ràng

3. **Sử dụng cấu trúc có sẵn**
   - Chuẩn bị sẵn các mẫu câu
   - Kết nối các ý bằng liên từ

4. **Luyện tập với áp lực thời gian**
   - Tập làm quen với nhịp thi thật
   - Không được quá thời gian

Chúc các bạn ôn thi hiệu quả và đạt kết quả cao! 🎉
    `,
    coverImage: '/images/blog/hskk-diem-cao.jpg',
    author: 'MOLI.STUDIO',
    publishedAt: '2026-05-07',
    updatedAt: '2026-05-07',
    category: 'Luyện thi HSKK',
    tags: ['HSKK', 'luyện thi HSKK', 'điểm cao HSKK', 'nói tiếng Trung', 'mẹo thi HSKK'],
    readTime: 9,
  },
  {
    slug: 'lich-thi-hsk-2026-dang-ky-ngay',
    title: 'Lịch Thi HSK/HSKK 2026: Đăng Ký Ngay Để Không Bỏ Lỡ Kỳ Thi Quan Trọng',
    excerpt: 'Cập nhật lịch thi HSK và HSKK năm 2026 chính thức từ Hanban/HSK. Hướng dẫn đăng ký, lệ phí thi và mẹo chuẩn bị cho kỳ thi đạt hiệu quả cao nhất.',
    content: `
# Lịch Thi HSK/HSKK 2026: Đăng Ký Ngay Để Không Bỏ Lỡ

Nắm rõ lịch thi HSK/HSKK 2026 giúp bạn lên kế hoạch ôn tập và đăng ký thi kịp thời. Bài viết cập nhật thông tin chính thức và hướng dẫn chi tiết từng bước.

## 📅 Lịch Thi HSK/HSKK 2026

### **Đợt thi năm 2026**

| Đợt | Ngày thi | Ngày đăng ký | Hạn chót đăng ký |
|-----|----------|--------------|-------------------|
| **Đợt 1** | 16/03/2026 | 01/01 - 28/02/2026 | 28/02/2026 |
| **Đợt 2** | 18/05/2026 | 01/03 - 30/04/2026 | 30/04/2026 |
| **Đợt 3** | 13/07/2026 | 01/05 - 15/06/2026 | 15/06/2026 |
| **Đợt 4** | 14/09/2026 | 01/07 - 15/08/2026 | 15/08/2026 |
| **Đợt 5** | 10/11/2026 | 01/09 - 15/10/2026 | 15/10/2026 |

> ⚠️ **Lưu ý:** Lịch thi có thể thay đổi tùy trung tâm. Hãy kiểm tra trang web chính thức của trung tâm thi bạn chọn.

## 📍 Địa Điểm Thi Tại Việt Nam

### **Hà Nội**
- Đại học Hà Nội (HANU) - Quán Thanh, Ba Đình
- Đại học Ngoại ngữ, ĐHQGHN - Cầu Giấy
- Trung tâm Khảo thí Đại học Quốc gia Hà Nội

### **TP. Hồ Chí Minh**
- Đại học Khoa học Xã hội & Nhân văn - Quận 5
- Trung tâm Nghiên cứu Hán Nôm - Quận 10
- Trung tâm Ngoại ngữ - ĐHQG TP.HCM

### **Đà Nẵng**
- Đại học Ngoại ngữ, ĐH Đà Nẵng

## 💰 Lệ Phí Thi 2026

| Bậc thi | Lệ phí (VND) | Lệ phí (CNY) |
|---------|--------------|--------------|
| HSK 1 | 300.000 | 150 |
| HSK 2 | 300.000 | 150 |
| HSK 3 | 400.000 | 200 |
| HSK 4 | 400.000 | 200 |
| HSK 5 | 500.000 | 250 |
| HSK 6 | 500.000 | 250 |
| HSKK Sơ cấp | 400.000 | 200 |
| HSKK Trung cấp | 500.000 | 250 |
| HSKK Cao cấp | 600.000 | 300 |

> 💡 **Mẹo:** Đăng ký sớm thường có ưu đãi giảm phí từ một số trung tâm.

## 📝 Hướng Dẫn Đăng Ký Thi

### **Bước 1: Tạo tài khoản**
1. Truy cập: https://www.chinesetest.cn
2. Chọn "考生登录" (Đăng nhập thí sinh)
3. Đăng ký tài khoản mới với email hợp lệ

### **Bước 2: Chọn kỳ thi**
1. Đăng nhập tài khoản
2. Chọn "报名考试" (Đăng ký thi)
3. Chọn đợt thi phù hợp
4. Chọn cấp bậc thi (HSK 1-6 hoặc HSKK)

### **Bước 3: Chọn trung tâm thi**
1. Chọn thành phố/khu vực
2. Chọn trung tâm thi cụ thể
3. Kiểm tra số chỗ trống

### **Bước 4: Điền thông tin**
- Họ và tên (theo hộ chiếu/CMND)
- Ngày tháng năm sinh
- Số CCCD/Hộ chiếu
- Số điện thoại
- Email liên hệ

### **Bước 5: Thanh toán lệ phí**
- Chuyển khoản ngân hàng
- Thanh toán online qua thẻ
- Giữ biên nhận thanh toán

### **Bước 6: Xác nhận & In phiếu**
- Kiểm tra lại thông tin
- In phiếu tham dự thi
- Lưu mã xác nhận

## 📋 Chuẩn Bị Trước Ngày Thi

### **1 tuần trước thi**
- [ ] In phiếu dự thi (2 bản)
- [ ] Kiểm tra địa điểm thi
- [ ] Chuẩn bị CMND/Hộ chiếu bản gốc
- [ ] Đặt phương tiện đi lại (nếu ở xa)

### **1 ngày trước thi**
- [ ] Ngủ đủ giấc (7-8 tiếng)
- [ ] Chuẩn bị túi đựng: CMND, phiếu thi, bút chì 2B, tẩy, đồ uống
- [ ] Không học quá khuya

### **Ngày thi**
- ⏰ Đến sớm 30 phút
- 📱 Tắt điện thoại
- 🎧 Không mang thiết bị điện tử vào phòng thi
- 📝 Làm bài theo thứ tự, không bỏ trống

## 🎯 Mốc Thời Gian Ôn Tập

| Thời gian còn lại | Việc cần làm |
|-------------------|--------------|
| **6 tháng** | Học từ vựng + ngữ pháp, xây nền tảng |
| **3 tháng** | Luyện đề thi, tăng tốc độ |
| **1 tháng** | Thi thử hàng tuần, ôn điểm yếu |
| **1 tuần** | Nghỉ ngơi, ôn nhẹ, giữ sức khỏe |

## 📊 Lịch Sử Điểm Thi Trung Bình

| Bậc | Điểm TB toàn cầu | Tỷ lệ đạt 180+ |
|-----|------------------|----------------|
| HSK 1 | 185 | 85% |
| HSK 2 | 178 | 78% |
| HSK 3 | 172 | 72% |
| HSK 4 | 168 | 65% |
| HSK 5 | 165 | 60% |
| HSK 6 | 170 | 58% |

## 🔗 Đăng Ký Thi Ngay

Truy cập trang chính thức của Hanban:
- Website: https://www.chinesetest.cn
- Hotline: Tùy trung tâm thi (thường: 1900-xxxx)

Hoặc liên hệ MOLI.STUDIO để được hỗ trợ đăng ký và luyện thi hiệu quả!

---
*Bài viết được cập nhật theo thông tin chính thức từ Hanban. Vui lòng kiểm tra trang web trung tâm thi để có thông tin mới nhất.*
    `,
    coverImage: '/images/blog/lich-thi-hsk.jpg',
    author: 'MOLI.STUDIO',
    publishedAt: '2026-05-08',
    updatedAt: '2026-05-08',
    category: 'Thông tin thi HSK',
    tags: ['lịch thi HSK', 'đăng ký thi HSK', 'HSKK 2026', 'thi tiếng Trung', 'Hanban'],
    readTime: 8,
    featured: true,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(post => post.slug === slug);
}

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter(post => post.featured);
}

export function getAllSlugs(): string[] {
  return BLOG_POSTS.map(post => post.slug);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
}
