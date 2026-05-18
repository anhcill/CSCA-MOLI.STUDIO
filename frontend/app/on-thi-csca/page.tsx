import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Ôn Thi CSCA Online - Đề Thi, Tài Liệu & AI Hỗ Trợ | MOLI.STUDIO',
  description: 'Luyện thi CSCA online với đề mô phỏng chuẩn format, tài liệu ôn tập, AI phân tích kết quả và lộ trình học thông minh. Đăng ký miễn phí ngay hôm nay.',
  keywords: ['ôn thi CSCA', 'ôn thi CSCA online', 'luyện thi CSCA', 'tài liệu ôn thi CSCA', 'đề thi CSCA', 'CSCA là gì', 'thi CSCA', 'học bổng Trung Quốc', 'du học Trung Quốc'],
  openGraph: {
    title: 'Ôn Thi CSCA Online - Đề Thi, Tài Liệu & AI Hỗ Trợ',
    description: 'Luyện thi CSCA online với đề mô phỏng chuẩn format, tài liệu ôn tập, AI phân tích kết quả và lộ trình học thông minh.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Ôn Thi CSCA Online' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ôn Thi CSCA Online - Đề Thi, Tài Liệu & AI Hỗ Trợ',
    description: 'Luyện thi CSCA online với đề mô phỏng, tài liệu ôn tập, AI phân tích kết quả và lộ trình học thông minh.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
  alternates: { canonical: '/on-thi-csca' },
};

export default function OnThiCSCA() {
  const siteUrl = getCanonicalSiteUrl();
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Ôn thi CSCA online',
    description: metadata.description,
    url: `${siteUrl}/on-thi-csca`,
    inLanguage: 'vi-VN',
    isAccessibleForFree: true,
    educationalLevel: 'Ôn thi đầu vào học bổng du học Trung Quốc',
    teaches: [
      'Toán CSCA',
      'Tiếng Trung CSCA',
      'Kiến thức tổng hợp CSCA',
      'Luyện đề mô phỏng CSCA',
    ],
    about: ['CSCA', 'học bổng CSC', 'du học Trung Quốc', 'luyện thi CSCA'],
    provider: {
      '@type': 'EducationalOrganization',
      name: 'CSCA MOLI.STUDIO',
      url: siteUrl,
      logo: `${siteUrl}/images/logo.svg`,
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
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Ôn thi CSCA',
        item: `${siteUrl}/on-thi-csca`,
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 pb-16 sm:pt-24 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
              Kỳ thi đầu vào học bổng Trung Quốc
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
              Ôn Thi CSCA Online<br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Đạt Điểm Cao Nhất
              </span>
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
              Nền tảng luyện thi CSCA hàng đầu Việt Nam với đề mô phỏng chuẩn format, tài liệu chi tiết, AI phân tích kết quả và lộ trình học cá nhân hóa. Hơn 5.000+ câu hỏi, cập nhật liên tục theo đề thi thật.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register"
                className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200 transition-all text-center">
                Bắt đầu học miễn phí
              </Link>
              <Link href="/de-thi-csca"
                className="px-8 py-4 bg-white text-indigo-700 font-bold rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center">
                Xem đề thi mẫu
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {[
              { value: '5.000+', label: 'Câu hỏi luyện tập' },
              { value: '1.200+', label: 'Học viên đã đăng ký' },
              { value: '95%', label: 'Hài lòng về khóa học' },
              { value: '70-85', label: 'Điểm trung bình đạt được' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-4 sm:p-5 text-center shadow-sm border border-gray-100">
                <div className="text-xl sm:text-2xl font-black text-indigo-600">{stat.value}</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CSCA là gì */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Tìm hiểu kỳ thi</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-5">
                CSCA Là Gì? Tại Sao Quan Trọng?
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-sm sm:text-base">
                <p>
                  <strong className="text-gray-900">CSCA</strong> (Chinese Scholarship Council Assessment) là kỳ thi đánh giá năng lực bắt buộc dành cho sinh viên quốc tế muốn nhận <strong className="text-gray-900">học bổng Chính phủ Trung Quốc (CSC)</strong>.
                </p>
                <p>
                  Kỳ thi gồm <strong className="text-gray-900">3 phần</strong>: <strong>Toán</strong>, <strong>Tổng hợp kiến thức</strong> và <strong>Tiếng Trung</strong>. Thang điểm 100, điểm đạt tối thiểu <strong className="text-gray-900">60/100</strong> — nhưng để nhận học bổng cao, bạn cần đạt <strong className="text-gray-900">70-85 điểm</strong>.
                </p>
                <p>
                  CSCA là <strong className="text-gray-900">bước ngoặt quyết định</strong> cơ hội nhận học bổng. Điểm CSCA cao giúp bạn được xét vào các trường top đầu như Đại học Bắc Kinh, Thanh Hoa, Fudan.
                </p>
              </div>
              <Link href="/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc"
                className="inline-flex items-center gap-2 mt-6 text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
                Đọc chi tiết về CSCA
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 sm:p-8">
              <h3 className="font-black text-gray-900 text-lg mb-5">Cấu trúc đề thi CSCA</h3>
              <div className="space-y-4">
                {[
                  { part: 'Phần 1', name: 'Toán Học', icon: '🔢', desc: '20 câu · 30 điểm · 35 phút', color: 'from-blue-500 to-blue-600' },
                  { part: 'Phần 2', name: 'Tổng Hợp Kiến Thức', icon: '📚', desc: '30 câu · 30 điểm · 45 phút', color: 'from-purple-500 to-purple-600' },
                  { part: 'Phần 3', name: 'Tiếng Trung', icon: '🗣️', desc: '40 câu · 40 điểm · 70 phút', color: 'from-amber-500 to-amber-600' },
                ].map((item) => (
                  <div key={item.part} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">{item.part}</span>
                      </div>
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lộ trình học */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Phương pháp học</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Lộ Trình Ôn Thi CSCA Hiệu Quả
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Chuẩn bị trong 3 tháng với lộ trình khoa học, từ nền tảng đến luyện đề chuyên sâu
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Nền Tảng (4-6 tuần)',
                color: 'from-blue-500 to-blue-600',
                items: ['Nắm vững kiến thức Toán THPT', 'Học HSK 4 (1.200 từ vựng)', 'Đọc sách lịch sử, văn hóa Trung Quốc', 'Làm quen với từ vựng toán tiếng Trung'],
              },
              {
                step: '02',
                title: 'Luyện Đề (4 tuần)',
                color: 'from-purple-500 to-purple-600',
                items: ['Làm 10-15 đề mô phỏng có thời gian', 'Phân tích lỗi sai sau mỗi đề', 'Tập trung cải thiện phần yếu', 'Luyện nghe tiếng Trung 30 phút/ngày'],
              },
              {
                step: '03',
                title: 'Tổng Ôn (2 tuần)',
                color: 'from-amber-500 to-amber-600',
                items: ['Ôn lại công thức toán quan trọng', 'Học thuộc sự kiện lịch sử chính', 'Tập viết tiếng Trung theo khuôn mẫu', 'Làm đề cuối cùng để đánh giá'],
              },
            ].map((phase) => (
              <div key={phase.step} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${phase.color} opacity-10 rounded-bl-full`} />
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${phase.color} text-white font-black text-lg mb-4 shadow-sm`}>
                  {phase.step}
                </div>
                <h3 className="font-black text-gray-900 text-lg mb-4">{phase.title}</h3>
                <ul className="space-y-2.5">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/lo-trinh"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
              Xem lộ trình chi tiết
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Tài nguyên */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Tài nguyên học tập</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Tài Nguyên Ôn Thi CSCA Miễn Phí
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: '📝',
                title: 'Đề Thi Mô Phỏng',
                desc: 'Bộ đề thi chuẩn format CSCA 2026, cập nhật liên tục theo đề thi thật',
                href: '/de-thi-csca',
                color: 'bg-indigo-50 border-indigo-200',
              },
              {
                icon: '📖',
                title: 'Tài Liệu Ôn Tập',
                desc: 'Tổng hợp kiến thức toán, lịch sử, văn hóa, địa lý Trung Quốc',
                href: '/tailieu',
                color: 'bg-purple-50 border-purple-200',
              },
              {
                icon: '💬',
                title: 'Từ Vựng CSCA',
                desc: 'Học từ vựng tiếng Trung theo chủ đề, flashcard thông minh',
                href: '/tu-vung-csca',
                color: 'bg-blue-50 border-blue-200',
              },
              {
                icon: '🗺️',
                title: 'Lộ Trình Học',
                desc: 'AI tạo lộ trình học cá nhân hóa dựa trên năng lực của bạn',
                href: '/lo-trinh',
                color: 'bg-amber-50 border-amber-200',
              },
            ].map((resource) => (
              <Link key={resource.href} href={resource.href}
                className={`block p-5 rounded-2xl border-2 ${resource.color} hover:-translate-y-1 hover:shadow-lg transition-all group`}>
                <div className="text-3xl mb-3">{resource.icon}</div>
                <h3 className="font-black text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{resource.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{resource.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Blog / Bài viết liên quan */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Kiến thức bổ sung</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Bài Viết Hữu Ích Về CSCA
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'CSCA Là Gì? Tất Tần Tật Về Chứng Chỉ Thi Đầu Vào Du Học Trung Quốc', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc', tag: 'Giới thiệu' },
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết: Phần Toán, Tổng Hợp & Tiếng Trung', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung', tag: 'Cấu trúc đề thi' },
              { title: 'Học Bổng CSC Trung Quốc 2026: Hướng Dẫn Đăng Ký Đầy Đủ Từ A-Z', href: '/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du', tag: 'Học bổng' },
            ].map((post) => (
              <Link key={post.href} href={post.href}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all border border-gray-100 group">
                <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg mb-3">{post.tag}</span>
                <h3 className="font-bold text-gray-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-3">{post.title}</h3>
                <div className="mt-3 text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  Đọc bài viết
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
              Xem tất cả bài viết
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-indigo-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Sẵn Sàng Ôn Thi CSCA?
          </h2>
          <p className="text-indigo-200 mb-8 text-sm sm:text-base">
            Đăng ký tài khoản miễn phí ngay hôm nay và bắt đầu luyện tập với bộ đề thi chuẩn CSCA 2026.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl hover:bg-indigo-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Đăng ký miễn phí
            </Link>
            <Link href="/login"
              className="px-8 py-4 bg-indigo-500 text-white font-bold rounded-2xl border-2 border-indigo-400 hover:bg-indigo-400 transition-all">
              Đăng nhập
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
              <p className="text-gray-400 text-sm">Nền tảng luyện thi CSCA hàng đầu Việt Nam, giúp hàng nghìn sinh viên chinh phục học bổng du học Trung Quốc.</p>
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
                <li><Link href="/terms" className="hover:text-white transition-colors">Điều khoản sử dụng</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Chính sách bảo mật</Link></li>
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
