import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Luyện Thi CSCA Online - Bài Tập, Đề Thi & Phân Tích AI | MOLI.STUDIO',
  description: 'Luyện thi CSCA online với 5000+ câu hỏi, đề thi mô phỏng chuẩn format, AI phân tích kết quả chi tiết. Học mọi lúc mọi nơi, theo dõi tiến độ và cải thiện điểm số nhanh chóng.',
  keywords: ['luyện thi CSCA', 'luyện thi CSCA online', 'bài tập CSCA', 'thi thử CSCA', 'ôn thi CSCA', 'CSCA', 'luyện CSCA'],
  openGraph: {
    title: 'Luyện Thi CSCA Online - Bài Tập, Đề Thi & Phân Tích AI',
    description: 'Luyện thi CSCA online với 5000+ câu hỏi, đề thi mô phỏng chuẩn format, AI phân tích kết quả chi tiết.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Luyện Thi CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Luyện Thi CSCA Online - Bài Tập, Đề Thi & Phân Tích AI',
    description: 'Luyện thi CSCA online với bài tập, đề mô phỏng và AI phân tích kết quả chi tiết.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
  alternates: { canonical: '/luyen-thi-csca' },
};

export default function LuyenThiCSCA() {
  const siteUrl = getCanonicalSiteUrl();
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Luyện thi CSCA online',
    description: metadata.description,
    url: `${siteUrl}/luyen-thi-csca`,
    inLanguage: 'vi-VN',
    isAccessibleForFree: true,
    educationalLevel: 'Ôn thi đầu vào học bổng du học Trung Quốc',
    about: ['luyện thi CSCA', 'bài tập CSCA', 'thi thử CSCA'],
    provider: {
      '@type': 'EducationalOrganization',
      name: 'CSCA MOLI.STUDIO',
      url: siteUrl,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT40H',
      inLanguage: 'vi-VN',
    },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chu', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Luyen thi CSCA', item: `${siteUrl}/luyen-thi-csca` },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
            5.000+ câu hỏi luyện tập
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Luyện Thi CSCA Online<br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Hiệu Quả Với AI Phân Tích
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Luyện thi CSCA online mọi lúc mọi nơi với bộ đề thi chuẩn format, AI phân tích kết quả chi tiết và lộ trình học cá nhân hóa. Hơn 1.200 học viên đã luyện tập và đạt điểm cao.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200 transition-all text-center">
              Bắt đầu luyện thi ngay
            </Link>
            <Link href="/de-thi-csca"
              className="px-8 py-4 bg-white text-indigo-700 font-bold rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center">
              Xem đề thi mẫu
            </Link>
          </div>
        </div>
      </section>

      {/* Tại sao luyện thi CSCA online */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Tại sao chọn MOLI.STUDIO</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Luyện Thi CSCA Online — Tại Sao Hiệu Quả Hơn?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🤖', title: 'AI Phân Tích Kết Quả', desc: 'Sau mỗi bài thi, AI phân tích chi tiết điểm mạnh, điểm yếu và đề xuất cách cải thiện hiệu quả nhất.' },
              { icon: '⏰', title: 'Luyện Mọi Lúc Mọi Nơi', desc: 'Không cần đến trung tâm. Chỉ cần có internet, bạn có thể luyện thi CSCA 24/7 trên điện thoại hoặc máy tính.' },
              { icon: '📊', title: 'Theo Dõi Tiến Độ', desc: 'Biểu đồ điểm số theo thời gian, lịch sử làm bài chi tiết. Thấy rõ sự tiến bộ qua từng ngày.' },
              { icon: '🎯', title: 'Đề Thi Chuẩn Format', desc: 'Bộ đề thi mô phỏng CSCA 2026 bám sát cấu trúc đề thi thật. Cập nhật liên tục theo đề thi mới nhất.' },
              { icon: '🔄', title: 'Luyện Đi Luyện Lại', desc: 'Làm đề nhiều lần với các đề khác nhau. Hệ thống ghi nhớ đã làm đề nào, điểm bao nhiêu.' },
              { icon: '💰', title: 'Miễn Phí Hoàn Toàn', desc: 'Nhiều tính năng luyện thi CSCA hoàn toàn miễn phí. Không phí ẩn, không yêu cầu thẻ tín dụng.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Các loại bài tập */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Hình thức luyện tập</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Nhiều Hình Thức Luyện Thi CSCA
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Chọn hình thức luyện tập phù hợp với mục tiêu của bạn: thi thử, học theo chủ đề hoặc luyện từ vựng
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '📝',
                title: 'Thi Thử CSCA',
                desc: 'Làm đề thi đầy đủ 3 phần với thời gian thực. Xem điểm ngay sau khi nộp bài.',
                href: '/toan/de-mo-phong',
                color: 'from-indigo-500 to-purple-500',
                popular: true,
              },
              {
                icon: '🔢',
                title: 'Luyện Theo Phần Thi',
                desc: 'Chỉ luyện phần Toán, Tổng hợp hoặc Tiếng Trung riêng biệt.',
                href: '/de-thi-csca',
                color: 'from-blue-500 to-cyan-500',
                popular: false,
              },
              {
                icon: '💬',
                title: 'Học Từ Vựng',
                desc: 'Flashcard thông minh với spaced repetition. Học 2.000+ từ vựng CSCA theo chủ đề.',
                href: '/tu-vung-csca',
                color: 'from-green-500 to-emerald-500',
                popular: false,
              },
              {
                icon: '📖',
                title: 'Lý Thuyết Ôn Tập',
                desc: 'Tài liệu lý thuyết chi tiết cho từng phần thi. Công thức, kiến thức trọng tâm.',
                href: '/ly-thuyet',
                color: 'from-amber-500 to-orange-500',
                popular: false,
              },
              {
                icon: '🗂️',
                title: 'Cấu Trúc Đề Thi',
                desc: 'Tìm hiểu chi tiết cấu trúc đề thi CSCA: số câu, thời gian, nội dung từng phần.',
                href: '/cau-truc-de',
                color: 'from-pink-500 to-rose-500',
                popular: false,
              },
              {
                icon: '🗺️',
                title: 'Lộ Trình Cá Nhân',
                desc: 'AI tạo lộ trình học tập cá nhân hóa dựa trên năng lực và mục tiêu của bạn.',
                href: '/lo-trinh-on-thi-csca',
                color: 'from-violet-500 to-purple-500',
                popular: false,
              },
            ].map((item) => (
              <Link key={item.title} href={item.href}
                className="relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all group">
                {item.popular && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full">
                    Phổ biến
                  </div>
                )}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-3xl mb-4 shadow-sm`}>
                  {item.icon}
                </div>
                <h3 className="font-black text-gray-900 text-base mb-2 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Cách hoạt động */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
              Cách Luyện Thi CSCA Tại MOLI.STUDIO
            </h2>
          </div>

          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Đăng Ký', desc: 'Tạo tài khoản miễn phí trong 30 giây bằng email, Google hoặc Facebook.', icon: '📋' },
              { step: '2', title: 'Chọn Đề Thi', desc: 'Chọn đề thi phù hợp: cơ bản, nâng cao hoặc đề năm trước.', icon: '📄' },
              { step: '3', title: 'Làm Bài', desc: 'Làm bài thi với thời gian thực. Câu nào chưa biết, đánh dấu để ôn lại.', icon: '✏️' },
              { step: '4', title: 'Xem Kết Quả', desc: 'Nhận điểm ngay, xem AI phân tích điểm mạnh, điểm yếu và gợi ý cải thiện.', icon: '📊' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-2xl mb-4 shadow-lg shadow-indigo-200">
                  {item.step}
                </div>
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-black text-gray-900 mb-2">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* So sánh */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
              So Sánh: Tự Luyện vs MOLI.STUDIO
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border-2 border-gray-200">
              <h3 className="font-black text-gray-400 text-lg mb-4 text-center">Tự Luyện</h3>
              <ul className="space-y-3">
                {[
                  'Không biết đề thi ra sao',
                  'Không có đáp án giải thích',
                  'Tự đánh giá điểm yếu',
                  'Không theo dõi tiến độ',
                  'Dễ chán và bỏ cuộc',
                  'Không có AI hỗ trợ',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-500">
                    <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-3xl p-6 border-2 border-indigo-300 shadow-lg shadow-indigo-100">
              <h3 className="font-black text-indigo-600 text-lg mb-4 text-center">MOLI.STUDIO</h3>
              <ul className="space-y-3">
                {[
                  '20+ đề thi chuẩn format CSCA',
                  'Lời giải chi tiết từng câu',
                  'AI phân tích điểm mạnh/yếu',
                  'Biểu đồ tiến độ rõ ràng',
                  'Gamification giữ động lực',
                  'AI gợi ý lộ trình học cá nhân',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Internal links */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-10">
            Bài Viết Liên Quan
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'CSCA Là Gì? Tìm Hiểu Toàn Diện', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc' },
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung' },
              { title: 'Mẫu Đề Thi CSCA Có Lời Giải', href: '/blog/mau-de-thi-csca-giai-chi-tiet-2026' },
              { title: '10 Lỗi Sai Thường Gặp Khi Thi CSCA', href: '/blog/loi-it-sai-thuong-gap-khi-thi-csca' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-indigo-600 transition-colors">{link.title}</h3>
                <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  Đọc thêm
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-indigo-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Sẵn Sàng Luyện Thi CSCA?
          </h2>
          <p className="text-indigo-200 mb-8 text-sm sm:text-base">
            Đăng ký miễn phí ngay hôm nay và bắt đầu luyện thi CSCA với bộ đề thi chuẩn format và AI phân tích kết quả.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl hover:bg-indigo-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Đăng ký miễn phí
            </Link>
            <Link href="/de-thi-csca"
              className="px-8 py-4 bg-indigo-500 text-white font-bold rounded-2xl border-2 border-indigo-400 hover:bg-indigo-400 transition-all">
              Xem đề thi mẫu
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xl font-black text-white mb-3">MOLI.STUDIO</div>
          <p className="text-gray-400 text-sm mb-6">Nền tảng luyện thi CSCA hàng đầu Việt Nam với AI phân tích kết quả.</p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <Link href="/on-thi-csca" className="hover:text-white transition-colors">Ôn thi CSCA</Link>
            <Link href="/de-thi-csca" className="hover:text-white transition-colors">Đề thi CSCA</Link>
            <Link href="/tu-vung-csca" className="hover:text-white transition-colors">Từ vựng CSCA</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-gray-500">
            © {new Date().getFullYear()} MOLI.STUDIO. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>
    </main>
  );
}
