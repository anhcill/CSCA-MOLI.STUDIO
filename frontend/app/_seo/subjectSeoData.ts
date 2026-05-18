import type { Metadata } from 'next';

export type SubjectSeoKey = 'math' | 'physics' | 'chemistry' | 'chinese' | 'general';

type Theme = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';

export type SubjectSeoConfig = {
  route: string;
  theme: Theme;
  title: string;
  description: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  highlight: string;
  intro: string;
  primaryHref: string;
  secondaryHref: string;
  primaryCta: string;
  secondaryCta: string;
  stats: Array<{ value: string; label: string }>;
  sections: Array<{ title: string; body: string; points: string[] }>;
  plan: Array<{ title: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export const subjectSeoPages: Record<SubjectSeoKey, SubjectSeoConfig> = {
  math: {
    route: '/on-thi-toan-csca',
    theme: 'blue',
    title: 'Ôn Thi Toán CSCA - Đề Mô Phỏng, Công Thức & Lộ Trình | MOLI.STUDIO',
    description:
      'Ôn thi Toán CSCA với đề mô phỏng, công thức trọng tâm, từ vựng Toán tiếng Trung và lộ trình luyện điểm theo từng chủ đề.',
    keywords: [
      'ôn thi Toán CSCA',
      'luyện thi Toán CSCA',
      'đề thi Toán CSCA',
      'Toán CSCA',
      'công thức Toán CSCA',
      'từ vựng Toán tiếng Trung',
    ],
    eyebrow: 'Luyện môn Toán cho kỳ thi CSCA',
    h1: 'Ôn Thi Toán CSCA',
    highlight: 'Theo Đúng Trọng Tâm Đề',
    intro:
      'Trang ôn thi Toán CSCA tập trung vào đại số, hàm số, hình học, xác suất và kỹ năng đọc đề Toán bằng tiếng Trung. Học theo chủ đề, luyện đề mô phỏng và xem lại lỗi sai để tăng điểm ổn định.',
    primaryHref: '/toan/de-mo-phong',
    secondaryHref: '/toan/ly-thuyet',
    primaryCta: 'Luyện đề Toán CSCA',
    secondaryCta: 'Xem lý thuyết Toán',
    stats: [
      { value: '20+', label: 'dạng bài trọng tâm' },
      { value: '35 phút', label: 'mô phỏng áp lực thi' },
      { value: '30 điểm', label: 'mục tiêu phần Toán' },
      { value: 'AI', label: 'phân tích lỗi sai' },
    ],
    sections: [
      {
        title: 'Kiến thức Toán cần nắm',
        body: 'Ưu tiên các phần thường xuất hiện trong đề CSCA và dễ mất điểm khi đọc đề bằng tiếng Trung.',
        points: ['Hàm số, phương trình, bất phương trình', 'Hình học phẳng và hình học không gian', 'Tổ hợp, xác suất, thống kê cơ bản'],
      },
      {
        title: 'Kỹ năng đọc đề Toán tiếng Trung',
        body: 'Nhiều bạn biết cách giải nhưng mất thời gian vì không quen thuật ngữ Toán trong tiếng Trung.',
        points: ['Từ vựng phép tính và ký hiệu', 'Cụm từ chỉ điều kiện đề bài', 'Cách nhận diện dạng bài nhanh'],
      },
      {
        title: 'Luyện đề và chữa lỗi',
        body: 'Sau mỗi đề, cần biết mình sai do công thức, đọc nhầm đề hay thiếu chiến thuật phân bổ thời gian.',
        points: ['Làm đề mô phỏng có bấm giờ', 'Xem lại câu sai theo chủ đề', 'Ghi chú công thức hay nhầm'],
      },
    ],
    plan: [
      { title: 'Tuần 1-2: củng cố nền', body: 'Ôn lại công thức Toán THPT, học thuật ngữ Toán tiếng Trung và làm bài ngắn theo từng chủ đề.' },
      { title: 'Tuần 3-4: tăng tốc', body: 'Làm đề mô phỏng theo thời gian thật, ưu tiên các câu dễ lấy điểm trước.' },
      { title: 'Tuần 5+: tối ưu điểm', body: 'Phân tích lỗi sai, luyện lại dạng yếu và xây chiến thuật làm bài ổn định.' },
    ],
    faqs: [
      {
        question: 'Ôn thi Toán CSCA nên bắt đầu từ đâu?',
        answer: 'Nên bắt đầu từ công thức nền, sau đó học từ vựng Toán tiếng Trung và luyện đề mô phỏng để quen format.',
      },
      {
        question: 'Toán CSCA có khó không?',
        answer: 'Độ khó không chỉ nằm ở kiến thức Toán mà còn ở việc đọc hiểu đề bằng tiếng Trung và làm bài trong thời gian giới hạn.',
      },
    ],
  },
  physics: {
    route: '/on-thi-vat-ly-csca',
    theme: 'amber',
    title: 'Ôn Thi Vật Lý CSCA - Công Thức, Bài Tập & Đề Mô Phỏng | MOLI.STUDIO',
    description:
      'Luyện thi Vật Lý CSCA theo chủ đề cơ học, điện học, quang học, công thức trọng tâm và đề mô phỏng có phân tích kết quả.',
    keywords: ['ôn thi Vật Lý CSCA', 'luyện thi Vật Lý CSCA', 'đề thi Vật Lý CSCA', 'Vật Lý CSCA', 'công thức Vật Lý CSCA'],
    eyebrow: 'Luyện môn Vật Lý CSCA',
    h1: 'Ôn Thi Vật Lý CSCA',
    highlight: 'Nắm Công Thức, Làm Chắc Dạng Bài',
    intro:
      'Trang ôn thi Vật Lý CSCA giúp hệ thống công thức, dạng bài và phương pháp giải nhanh. Nội dung phù hợp cho học sinh cần luyện đề, rà soát lỗ hổng và tăng tốc trước kỳ thi.',
    primaryHref: '/vat-ly/de-mo-phong',
    secondaryHref: '/de-thi-csca',
    primaryCta: 'Luyện đề Vật Lý',
    secondaryCta: 'Xem đề CSCA',
    stats: [
      { value: '4 nhóm', label: 'chủ đề chính' },
      { value: 'Công thức', label: 'tóm tắt dễ ôn' },
      { value: 'Đề thử', label: 'luyện theo thời gian' },
      { value: 'AI', label: 'gợi ý phần yếu' },
    ],
    sections: [
      {
        title: 'Chủ đề Vật Lý trọng tâm',
        body: 'Tập trung vào các mảng kiến thức dễ gặp trong đề tổng hợp và đề môn tự nhiên.',
        points: ['Cơ học và chuyển động', 'Điện học, mạch điện, từ trường', 'Dao động, sóng và quang học'],
      },
      {
        title: 'Cách học công thức',
        body: 'Không học công thức rời rạc, cần gắn với dấu hiệu nhận biết dạng bài và đơn vị đo.',
        points: ['Nhóm công thức theo hiện tượng', 'Ghi điều kiện áp dụng', 'Luyện đổi đơn vị nhanh'],
      },
      {
        title: 'Luyện bài tính điểm',
        body: 'Mục tiêu là làm chắc câu cơ bản, sau đó mới xử lý câu cần biến đổi nhiều bước.',
        points: ['Phân loại câu dễ, trung bình, khó', 'Giải lại câu sai sau 24 giờ', 'Theo dõi tốc độ làm bài'],
      },
    ],
    plan: [
      { title: 'Giai đoạn 1: gom công thức', body: 'Lập bảng công thức theo cơ học, điện học, sóng và quang học.' },
      { title: 'Giai đoạn 2: luyện dạng', body: 'Làm bài theo từng dạng để nhận ra cách chọn công thức nhanh.' },
      { title: 'Giai đoạn 3: luyện đề', body: 'Làm đề mô phỏng, so sánh điểm và sửa các lỗi lặp lại.' },
    ],
    faqs: [
      {
        question: 'Ôn Vật Lý CSCA cần học những phần nào?',
        answer: 'Nên ưu tiên cơ học, điện học, dao động sóng, quang học và các bài tính công thức cơ bản.',
      },
      {
        question: 'Có nên học thuộc toàn bộ công thức Vật Lý không?',
        answer: 'Nên học theo nhóm dạng bài và điều kiện áp dụng, không nên chỉ học thuộc công thức rời rạc.',
      },
    ],
  },
  chemistry: {
    route: '/on-thi-hoa-csca',
    theme: 'emerald',
    title: 'Ôn Thi Hóa CSCA - Lý Thuyết, Bài Tập & Đề Thi Hóa Học | MOLI.STUDIO',
    description:
      'Ôn thi Hóa CSCA với hệ thống lý thuyết, phương trình phản ứng, bài tập tính toán và đề mô phỏng Hóa học có phân tích lỗi sai.',
    keywords: ['ôn thi Hóa CSCA', 'luyện thi Hóa CSCA', 'đề thi Hóa CSCA', 'Hóa học CSCA', 'phương trình Hóa CSCA'],
    eyebrow: 'Luyện môn Hóa học CSCA',
    h1: 'Ôn Thi Hóa CSCA',
    highlight: 'Từ Lý Thuyết Đến Đề Mô Phỏng',
    intro:
      'Trang ôn thi Hóa CSCA giúp bạn hệ thống hóa lý thuyết, phương trình phản ứng, dạng bài tính toán và cách xử lý câu hỏi nhanh. Nội dung được thiết kế cho việc ôn tập theo chủ đề và luyện đề.',
    primaryHref: '/hoa/de-mo-phong',
    secondaryHref: '/de-thi-csca',
    primaryCta: 'Luyện đề Hóa CSCA',
    secondaryCta: 'Xem cấu trúc đề',
    stats: [
      { value: 'Lý thuyết', label: 'học theo chủ đề' },
      { value: 'Phản ứng', label: 'ôn phương trình' },
      { value: 'Bài tính', label: 'rèn tốc độ' },
      { value: 'Đề thử', label: 'mô phỏng CSCA' },
    ],
    sections: [
      {
        title: 'Lý thuyết Hóa cần ôn',
        body: 'Nắm chắc lý thuyết giúp xử lý nhanh câu hỏi nhận biết và tránh mất điểm ở phần dễ.',
        points: ['Cấu tạo nguyên tử và bảng tuần hoàn', 'Liên kết hóa học, phản ứng oxi hóa khử', 'Hóa vô cơ và hóa hữu cơ cơ bản'],
      },
      {
        title: 'Bài tập tính toán',
        body: 'Các bài tính cần luyện theo quy trình để giảm lỗi đổi đơn vị và nhầm dữ kiện.',
        points: ['Mol, nồng độ, khối lượng', 'Bảo toàn khối lượng và electron', 'Tính theo phương trình phản ứng'],
      },
      {
        title: 'Luyện đề Hóa CSCA',
        body: 'Làm đề mô phỏng giúp kiểm tra khả năng phối hợp lý thuyết và bài tập tính trong thời gian giới hạn.',
        points: ['Làm đề theo chủ đề', 'Chữa từng câu sai', 'Tạo danh sách phản ứng cần nhớ'],
      },
    ],
    plan: [
      { title: 'Tuần 1: lý thuyết nền', body: 'Ôn bảng tuần hoàn, liên kết hóa học, phản ứng và các khái niệm nền.' },
      { title: 'Tuần 2-3: bài tập', body: 'Luyện mol, dung dịch, bảo toàn và bài tính theo phương trình.' },
      { title: 'Tuần 4+: đề mô phỏng', body: 'Làm đề, sửa lỗi và học lại đúng phần đang kéo điểm xuống.' },
    ],
    faqs: [
      {
        question: 'Ôn Hóa CSCA nên học lý thuyết hay làm bài tập trước?',
        answer: 'Nên học lý thuyết nền trước, sau đó làm bài tập theo chủ đề để biến kiến thức thành kỹ năng làm đề.',
      },
      {
        question: 'Hóa CSCA có cần nhớ nhiều phương trình không?',
        answer: 'Cần nhớ các phản ứng cơ bản và hiểu bản chất, đặc biệt là phản ứng vô cơ, oxi hóa khử và bài tính theo phương trình.',
      },
    ],
  },
  chinese: {
    route: '/on-thi-tieng-trung-csca',
    theme: 'violet',
    title: 'Ôn Thi Tiếng Trung CSCA - Từ Vựng, Nghe Đọc & Đề Mô Phỏng | MOLI.STUDIO',
    description:
      'Ôn thi Tiếng Trung CSCA với từ vựng theo chủ đề, luyện nghe, đọc hiểu, đề mô phỏng Tiếng Trung tự nhiên và Tiếng Trung xã hội.',
    keywords: [
      'ôn thi Tiếng Trung CSCA',
      'luyện thi Tiếng Trung CSCA',
      'từ vựng CSCA',
      'đề thi Tiếng Trung CSCA',
      'Tiếng Trung tự nhiên CSCA',
      'Tiếng Trung xã hội CSCA',
    ],
    eyebrow: 'Luyện phần Tiếng Trung CSCA',
    h1: 'Ôn Thi Tiếng Trung CSCA',
    highlight: 'Tăng Từ Vựng, Chắc Nghe Đọc',
    intro:
      'Trang ôn thi Tiếng Trung CSCA tập trung vào từ vựng học thuật, nghe hiểu, đọc hiểu và khả năng xử lý câu hỏi theo ngữ cảnh. Phù hợp cho cả hướng Tiếng Trung tự nhiên và Tiếng Trung xã hội.',
    primaryHref: '/tiengtrung-tunhien/de-mo-phong',
    secondaryHref: '/tu-vung-csca',
    primaryCta: 'Luyện Tiếng Trung tự nhiên',
    secondaryCta: 'Học từ vựng CSCA',
    stats: [
      { value: 'Từ vựng', label: 'theo chủ đề CSCA' },
      { value: 'Nghe', label: 'luyện phản xạ' },
      { value: 'Đọc hiểu', label: 'xử lý ngữ cảnh' },
      { value: '2 hướng', label: 'tự nhiên và xã hội' },
    ],
    sections: [
      {
        title: 'Từ vựng CSCA cần học',
        body: 'Từ vựng không chỉ là HSK thông thường mà còn gồm thuật ngữ học thuật theo môn và theo bối cảnh đề thi.',
        points: ['Từ vựng Toán, Lý, Hóa bằng tiếng Trung', 'Từ vựng văn hóa, lịch sử, xã hội', 'Cụm từ thường gặp trong đề thi'],
      },
      {
        title: 'Luyện nghe và đọc hiểu',
        body: 'Hai kỹ năng này quyết định tốc độ xử lý đề và khả năng chọn đáp án chính xác.',
        points: ['Nghe ý chính và từ khóa', 'Đọc câu hỏi trước khi đọc đoạn văn', 'Gạch ý chính theo từng đoạn'],
      },
      {
        title: 'Chọn hướng tự nhiên hoặc xã hội',
        body: 'Mỗi hướng có nhóm từ vựng và nội dung khác nhau, nên cần luyện đúng hướng dự thi.',
        points: ['Tiếng Trung tự nhiên: thuật ngữ khoa học', 'Tiếng Trung xã hội: văn hóa, lịch sử, xã hội', 'Luyện đề riêng theo từng hướng'],
      },
    ],
    plan: [
      { title: 'Giai đoạn 1: gom từ vựng', body: 'Học từ vựng CSCA theo chủ đề, ưu tiên từ xuất hiện trong câu hỏi và đáp án.' },
      { title: 'Giai đoạn 2: luyện kỹ năng', body: 'Luyện nghe ngắn, đọc hiểu đoạn vừa và ghi lại mẫu câu hay gặp.' },
      { title: 'Giai đoạn 3: luyện đề', body: 'Làm đề Tiếng Trung tự nhiên hoặc xã hội theo đúng hướng dự thi.' },
    ],
    faqs: [
      {
        question: 'Ôn Tiếng Trung CSCA khác gì ôn HSK?',
        answer: 'HSK thiên về năng lực tiếng phổ thông, còn CSCA cần thêm từ vựng học thuật và khả năng đọc đề theo môn.',
      },
      {
        question: 'Nên luyện Tiếng Trung tự nhiên hay xã hội?',
        answer: 'Nên chọn theo nhóm ngành và yêu cầu thi của bạn. Nếu chưa chắc, hãy luyện nền từ vựng chung trước rồi tách hướng sau.',
      },
    ],
  },
  general: {
    route: '/on-thi-tong-hop-csca',
    theme: 'rose',
    title: 'Ôn Thi Tổng Hợp CSCA - Văn Hóa, Lịch Sử, Địa Lý & Kiến Thức Chung | MOLI.STUDIO',
    description:
      'Ôn thi Tổng hợp CSCA với văn hóa Trung Quốc, lịch sử, địa lý, kiến thức xã hội và lộ trình luyện đề theo chủ đề.',
    keywords: [
      'ôn thi tổng hợp CSCA',
      'kiến thức tổng hợp CSCA',
      'văn hóa Trung Quốc CSCA',
      'lịch sử Trung Quốc CSCA',
      'địa lý Trung Quốc CSCA',
    ],
    eyebrow: 'Luyện phần kiến thức tổng hợp CSCA',
    h1: 'Ôn Thi Tổng Hợp CSCA',
    highlight: 'Văn Hóa, Lịch Sử, Địa Lý',
    intro:
      'Trang ôn thi Tổng hợp CSCA giúp bạn hệ thống kiến thức về văn hóa, lịch sử, địa lý Trung Quốc và các chủ đề xã hội thường gặp. Nội dung phù hợp để học theo cụm chủ đề và luyện câu hỏi nhanh.',
    primaryHref: '/de-thi-csca',
    secondaryHref: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung',
    primaryCta: 'Luyện đề tổng hợp',
    secondaryCta: 'Xem cấu trúc đề',
    stats: [
      { value: 'Văn hóa', label: 'Trung Quốc' },
      { value: 'Lịch sử', label: 'mốc quan trọng' },
      { value: 'Địa lý', label: 'vùng miền chính' },
      { value: 'Câu hỏi', label: 'luyện theo chủ đề' },
    ],
    sections: [
      {
        title: 'Văn hóa Trung Quốc',
        body: 'Phần văn hóa thường hỏi về biểu tượng, lễ hội, tư tưởng và các yếu tố quen thuộc trong đời sống Trung Quốc.',
        points: ['Lễ hội truyền thống', 'Văn học, nghệ thuật, tư tưởng', 'Phong tục và biểu tượng văn hóa'],
      },
      {
        title: 'Lịch sử và địa lý',
        body: 'Cần nắm các mốc lớn, triều đại, nhân vật tiêu biểu và đặc điểm địa lý quan trọng.',
        points: ['Các triều đại lớn', 'Nhân vật và sự kiện nổi bật', 'Vùng miền, sông núi, thành phố lớn'],
      },
      {
        title: 'Cách ghi nhớ hiệu quả',
        body: 'Kiến thức tổng hợp dễ quên nếu học rời rạc, nên học theo sơ đồ và câu hỏi kiểm tra nhanh.',
        points: ['Tạo timeline lịch sử', 'Nhóm kiến thức theo chủ đề', 'Luyện câu hỏi trắc nghiệm ngắn'],
      },
    ],
    plan: [
      { title: 'Tuần 1: chia chủ đề', body: 'Tách văn hóa, lịch sử, địa lý và tạo danh sách kiến thức cần nhớ.' },
      { title: 'Tuần 2-3: học bằng câu hỏi', body: 'Học mỗi chủ đề bằng câu hỏi trắc nghiệm để tăng khả năng nhận diện đáp án.' },
      { title: 'Tuần 4+: luyện đề tổng hợp', body: 'Làm đề mô phỏng, ghi lại mảng kiến thức còn yếu và ôn lặp lại.' },
    ],
    faqs: [
      {
        question: 'Phần Tổng hợp CSCA gồm những gì?',
        answer: 'Thường gồm văn hóa, lịch sử, địa lý Trung Quốc và một số kiến thức xã hội hoặc học thuật cơ bản.',
      },
      {
        question: 'Học kiến thức tổng hợp CSCA thế nào để không bị loạn?',
        answer: 'Nên học theo chủ đề, dùng timeline cho lịch sử và luyện câu hỏi ngắn thường xuyên để nhớ lâu.',
      },
    ],
  },
};

export function buildSubjectSeoMetadata(pageKey: SubjectSeoKey): Metadata {
  const page = subjectSeoPages[pageKey];

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: { canonical: page.route },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.route,
      type: 'website',
      locale: 'vi_VN',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: page.h1 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: ['/og-image.png'],
    },
  };
}
