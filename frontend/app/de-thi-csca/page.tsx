import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Đề Thi CSCA 2026 - Bộ Đề Mô Phỏng Có Lời Giải Chi Tiết | MOLI.STUDIO',
  description: 'Tải ngay bộ đề thi CSCA 2026 gồm 20+ đề mô phỏng có lời giải chi tiết. Luyện thi CSCA online với đề chuẩn format, theo dõi tiến độ và phân tích kết quả bằng AI.',
  keywords: ['đề thi CSCA', 'đề thi CSCA 2026', 'mẫu đề CSCA', 'luyện thi CSCA', 'thi thử CSCA', 'đề thi có lời giải', 'CSCA mô phỏng', 'ôn thi CSCA'],
  openGraph: {
    title: 'Đề Thi CSCA 2026 - Bộ Đề Mô Phỏng Có Lời Giải Chi Tiết',
    description: 'Tải ngay bộ đề thi CSCA 2026 gồm 20+ đề mô phỏng có lời giải chi tiết. Luyện thi CSCA online với đề chuẩn format.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Đề Thi CSCA 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Đề Thi CSCA 2026 - Bộ Đề Mô Phỏng Có Lời Giải',
    description: 'Bộ đề thi CSCA mô phỏng có lời giải chi tiết, luyện theo format và theo dõi tiến độ bằng AI.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
  alternates: { canonical: '/de-thi-csca' },
};

export default function DeThiCSCA() {
  const siteUrl = getCanonicalSiteUrl();
  const learningResourceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: 'Đề thi CSCA mô phỏng có lời giải',
    description: metadata.description,
    url: `${siteUrl}/de-thi-csca`,
    inLanguage: 'vi-VN',
    isAccessibleForFree: true,
    learningResourceType: 'Practice exam',
    educationalLevel: 'Ôn thi đầu vào học bổng du học Trung Quốc',
    about: ['đề thi CSCA', 'luyện đề CSCA', 'thi thử CSCA'],
    provider: {
      '@type': 'EducationalOrganization',
      name: 'CSCA MOLI.STUDIO',
      url: siteUrl,
    },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chu', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'De thi CSCA', item: `${siteUrl}/de-thi-csca` },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(learningResourceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
            Cập nhật theo đề thi CSCA 2026
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Đề Thi CSCA 2026<br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Mô Phỏng Có Lời Giải Chi Tiết
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Bộ đề thi CSCA gồm 20+ đề mô phỏng chuẩn format, bám sát cấu trúc đề thi thật. Mỗi đề có lời giải chi tiết, giúp bạn hiểu bản chất và tự tin chinh phục kỳ thi CSCA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200 transition-all text-center">
              Luyện đề thi ngay
            </Link>
            <Link href="/blog/mau-de-thi-csca-giai-chi-tiet-2026"
              className="px-8 py-4 bg-white text-indigo-700 font-bold rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center">
              Xem đề mẫu miễn phí
            </Link>
          </div>
        </div>
      </section>

      {/* Đề thi theo môn */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Luyện tập theo môn</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Đề Thi CSCA Theo Từng Phần
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Mỗi phần thi đều có bộ đề riêng, sát với cấu trúc đề thật. Làm bài với thời gian thực và xem lời giải ngay.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                part: 'Phần 1',
                name: 'Toán Học',
                icon: '🔢',
                color: 'from-blue-500 to-blue-600',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200',
                desc: 'Đại số, hình học, tổ hợp và xác suất — toàn bộ bằng tiếng Trung.',
                questions: '20 câu / 30 điểm',
                exams: '8 đề mô phỏng',
                href: '/toan/de-mo-phong',
                tags: ['Số học & Đại số', 'Hình học', 'Tổ hợp & Xác suất'],
              },
              {
                part: 'Phần 2',
                name: 'Tổng Hợp Kiến Thức',
                icon: '📚',
                color: 'from-purple-500 to-purple-600',
                bgColor: 'bg-purple-50',
                borderColor: 'border-purple-200',
                desc: 'Văn hóa, lịch sử, địa lý Trung Quốc và kiến thức thời sự.',
                questions: '30 câu / 30 điểm',
                exams: '6 đề mô phỏng',
                href: '/toan/de-mo-phong',
                tags: ['Văn hóa Trung Quốc', 'Lịch sử Trung Quốc', 'Địa lý Trung Quốc'],
              },
              {
                part: 'Phần 3',
                name: 'Tiếng Trung',
                icon: '🗣️',
                color: 'from-amber-500 to-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                desc: 'Nghe, đọc hiểu và viết — kiểm tra toàn diện năng lực tiếng Trung.',
                questions: '40 câu / 40 điểm',
                exams: '8 đề mô phỏng',
                href: '/tu-vung',
                tags: ['Nghe hiểu (20 câu)', 'Đọc hiểu (20 câu)', 'Viết (2 bài)'],
              },
            ].map((item) => (
              <div key={item.part} className={`${item.bgColor} rounded-3xl p-6 border-2 ${item.borderColor}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shadow-sm`}>
                    {item.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400">{item.part}</span>
                    <h3 className="font-black text-gray-900 text-lg">{item.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-white rounded-lg text-xs font-semibold text-gray-600 border border-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-3 border-t border-gray-200">
                  <span>{item.questions}</span>
                  <span className="font-bold text-indigo-600">{item.exams}</span>
                </div>
                <Link href={item.href}
                  className={`w-full block text-center py-3 rounded-xl font-bold text-sm bg-gradient-to-r ${item.color} text-white hover:shadow-lg transition-all hover:-translate-y-0.5`}>
                  Luyện tập ngay
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Đề thi full */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Thi thử CSCA</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Đề Thi CSCA Tổng Hợp
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Thi thử với đề đầy đủ 3 phần, mô phỏng điều kiện thi thật: thời gian, áp lực và format. Xem điểm ngay sau khi nộp bài.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { level: 'Cơ bản', name: 'Đề Khởi Động', desc: 'Phù hợp người mới bắt đầu, tập trung vào kiến thức nền tảng', color: 'from-green-400 to-green-500', count: '5 đề' },
              { level: 'Trung bình', name: 'Đề Nâng Cao', desc: 'Mức độ khó tương đương đề thi thật, có phân tích chi tiết', color: 'from-blue-400 to-blue-500', count: '8 đề' },
              { level: 'Khó', name: 'Đề Thử Thách', desc: 'Độ khó cao hơn đề thật, giúp bạn vượt mọi giới hạn', color: 'from-purple-400 to-purple-500', count: '5 đề' },
              { level: 'Đề thật', name: 'Đề Năm Trước', desc: 'Tổng hợp đề thi thật các năm 2024-2025, luyện sát thực tế', color: 'from-amber-400 to-amber-500', count: '3 đề' },
            ].map((exam) => (
              <div key={exam.name} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${exam.color} mb-3`}>
                  {exam.level}
                </div>
                <h3 className="font-black text-gray-900 text-base mb-2">{exam.name}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">{exam.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600">{exam.count}</span>
                  <Link href="/toan/de-mo-phong"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                    Thi ngay
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200 transition-all">
              Luyện tất cả đề thi
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Tại sao nên luyện đề */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
              Tại Sao Phải Luyện Đề Thi CSCA?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎯', title: 'Làm Quen Format Đề Thi', desc: 'Đề thi CSCA hoàn toàn bằng tiếng Trung. Luyện đề giúp bạn làm quen cách đọc đề, từ vựng toán và phân bổ thời gian hiệu quả.' },
              { icon: '⏰', title: 'Rèn Kỹ Năng Quản Lý Thời Gian', desc: 'Với 150 phút cho 90 câu, bạn cần chiến thuật làm bài. Luyện đề giúp tăng tốc độ và giảm áp lực khi thi thật.' },
              { icon: '📊', title: 'Đánh Giá Năng Lực Chính Xác', desc: 'Sau mỗi đề, hệ thống phân tích điểm mạnh, điểm yếu theo từng phần thi. Biết chính xác mình cần cải thiện ở đâu.' },
              { icon: '🤖', title: 'AI Phân Tích Kết Quả', desc: 'Công nghệ AI của MOLI.STUDIO phân tích chi tiết từng câu sai, gợi ý cách cải thiện và lộ trình học tối ưu cho bạn.' },
              { icon: '📈', title: 'Theo Dõi Tiến Độ Rõ Ràng', desc: 'Lịch sử làm bài, biểu đồ điểm số, so sánh với người khác. Thấy rõ sự tiến bộ qua từng ngày.' },
              { icon: '✅', title: 'Cải Thiện Điểm Số Nhanh Chóng', desc: 'Học sinh luyện đề thường xuyên có điểm CSCA cao hơn 15-20 điểm so với không luyện. Thực hành là chìa khóa.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all">
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

      {/* Internal links */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-10">
            Tài Nguyên Hỗ Trợ Ôn Thi CSCA
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'CSCA Là Gì? Tìm Hiểu Toàn Diện', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc', desc: 'Tìm hiểu chi tiết về kỳ thi CSCA, cấu trúc đề thi và cách chuẩn bị hiệu quả.' },
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung', desc: 'Phân tích từng phần thi: Toán, Tổng hợp và Tiếng Trung.' },
              { title: 'Mẫu Đề Thi CSCA Có Lời Giải', href: '/blog/mau-de-thi-csca-giai-chi-tiet-2026', desc: 'Bộ 5 đề mô phỏng CSCA 2026 kèm lời giải chi tiết từng câu.' },
              { title: 'Học Bổng CSC 2026: Đăng Ký Từ A-Z', href: '/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du', desc: 'Hướng dẫn chi tiết cách đăng ký học bổng CSC sau khi có điểm CSCA.' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-indigo-600 transition-colors">{link.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-indigo-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Sẵn Sàng Luyện Đề CSCA?
          </h2>
          <p className="text-indigo-200 mb-8 text-sm sm:text-base">
            Đăng ký miễn phí ngay hôm nay để truy cập toàn bộ bộ đề thi CSCA 2026 và nhận lời giải chi tiết.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl hover:bg-indigo-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Đăng ký miễn phí
            </Link>
            <Link href="/login"
              className="px-8 py-4 bg-indigo-500 text-white font-bold rounded-2xl border-2 border-indigo-400 hover:bg-indigo-400 transition-all">
              Đã có tài khoản
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-8 text-center sm:text-left">
            <div>
              <div className="text-xl font-black text-white mb-2">MOLI.STUDIO</div>
              <p className="text-gray-400 text-sm">Nền tảng luyện thi CSCA hàng đầu Việt Nam với bộ đề thi mô phỏng chuẩn format.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Liên kết nhanh</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/on-thi-csca" className="hover:text-white transition-colors">Ôn thi CSCA</Link></li>
                <li><Link href="/de-thi-csca" className="hover:text-white transition-colors">Đề thi CSCA</Link></li>
                <li><Link href="/tu-vung-csca" className="hover:text-white transition-colors">Từ vựng CSCA</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Hỗ trợ</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/cau-hoi-thuong-gap" className="hover:text-white transition-colors">Câu hỏi thường gặp</Link></li>
                <li><Link href="/lien-he" className="hover:text-white transition-colors">Liên hệ</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} MOLI.STUDIO. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>
    </main>
  );
}
