import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Từ Vựng CSCA - Học 2.000+ Từ Theo Chủ Đề | MOLI.STUDIO',
  description: 'Học từ vựng CSCA theo chủ đề: toán, văn hóa, lịch sử, địa lý Trung Quốc. Flashcard thông minh, ôn tập spaced repetition giúp ghi nhớ lâu. Miễn phí hoàn toàn.',
  keywords: ['từ vựng CSCA', 'từ vựng tiếng Trung', 'từ vựng CSCA theo chủ đề', 'flashcard tiếng Trung', 'HSK 4', 'học tiếng Trung online', 'ôn thi CSCA từ vựng'],
  openGraph: {
    title: 'Từ Vựng CSCA - Học 2.000+ Từ Theo Chủ Đề',
    description: 'Học từ vựng CSCA theo chủ đề: toán, văn hóa, lịch sử, địa lý Trung Quốc. Flashcard thông minh, ôn tập spaced repetition.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Từ Vựng CSCA' }],
  },
  alternates: { canonical: '/tu-vung-csca' },
};

export default function TuVungCSCA() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
            2.000+ từ vựng theo chủ đề
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Từ Vựng CSCA<br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Theo Chủ Đề Chuyên Sâu
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Học từ vựng tiếng Trung theo chủ đề CSCA: toán học, văn hóa, lịch sử, địa lý Trung Quốc. Flashcard thông minh với spaced repetition giúp ghi nhớ từ vựng nhanh và lâu nhất.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/tu-vung"
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200 transition-all text-center">
              Học từ vựng ngay
            </Link>
            <Link href="/register"
              className="px-8 py-4 bg-white text-blue-700 font-bold rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center">
              Đăng ký miễn phí
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto px-4">
          {[
            { value: '2.000+', label: 'Từ vựng' },
            { value: '15', label: 'Chủ đề' },
            { value: 'HSK 4-6', label: 'Phù hợp' },
            { value: '98%', label: 'Ghi nhớ sau 30 ngày' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-xl font-black text-blue-600">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Chủ đề từ vựng */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Học theo chủ đề</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Từ Vựng CSCA Theo Từng Chủ Đề
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Mỗi chủ đề được thiết kế phù hợp với nội dung thi CSCA. Học theo chủ đề giúp bạn ghi nhớ nhanh và áp dụng hiệu quả khi làm bài thi.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: '🔢',
                title: 'Từ Vựng Toán Học',
                desc: 'Các thuật ngữ toán bằng tiếng Trung: phương trình, hình học, số học.',
                count: '350+ từ',
                color: 'from-blue-500 to-blue-600',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200',
                href: '/tu-vung',
                tags: ['Đại số', 'Hình học', 'Hàm số', 'Số học'],
              },
              {
                icon: '🏯',
                title: 'Từ Vựng Văn Hóa',
                desc: 'Từ vựng liên quan đến văn hóa, phong tục và di sản Trung Quốc.',
                count: '280+ từ',
                color: 'from-purple-500 to-purple-600',
                bgColor: 'bg-purple-50',
                borderColor: 'border-purple-200',
                href: '/tu-vung',
                tags: ['Lễ hội', 'Ẩm thực', 'Nghệ thuật', 'Di sản'],
              },
              {
                icon: '📜',
                title: 'Từ Vựng Lịch Sử',
                desc: 'Các sự kiện, nhân vật và thời kỳ lịch sử Trung Quốc.',
                count: '250+ từ',
                color: 'from-red-500 to-red-600',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                href: '/tu-vung',
                tags: ['Nhân vật', 'Sự kiện', 'Triều đại', 'Chiến tranh'],
              },
              {
                icon: '🌏',
                title: 'Từ Vựng Địa Lý',
                desc: 'Từ vựng về địa lý Trung Quốc: tỉnh thành, sông ngòi, núi non.',
                count: '220+ từ',
                color: 'from-green-500 to-green-600',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-200',
                href: '/tu-vung',
                tags: ['Tỉnh thành', 'Sông ngòi', 'Núi non', 'Khí hậu'],
              },
              {
                icon: '💼',
                title: 'Từ Vựng Giao Tiếp',
                desc: 'Từ vựng giao tiếp hàng ngày, học tập và công việc.',
                count: '400+ từ',
                color: 'from-amber-500 to-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                href: '/tu-vung',
                tags: ['Đời thường', 'Học tập', 'Công việc', 'Du lịch'],
              },
              {
                icon: '🏥',
                title: 'Từ Vựng Chuyên Ngành',
                desc: 'Từ vựng chuyên ngành Y, Kỹ thuật, Kinh tế cho ngành học cụ thể.',
                count: '500+ từ',
                color: 'from-teal-500 to-teal-600',
                bgColor: 'bg-teal-50',
                borderColor: 'border-teal-200',
                href: '/tu-vung',
                tags: ['Y khoa', 'Kỹ thuật', 'Kinh tế', 'Khoa học'],
              },
            ].map((topic) => (
              <div key={topic.title}
                className={`${topic.bgColor} rounded-2xl p-6 border-2 ${topic.borderColor} hover:shadow-lg hover:-translate-y-1 transition-all`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${topic.color} flex items-center justify-center text-2xl shadow-sm`}>
                    {topic.icon}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-base">{topic.title}</h3>
                    <span className="text-xs font-bold text-indigo-600">{topic.count}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">{topic.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {topic.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-white rounded-lg text-xs font-semibold text-gray-600 border border-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link href={topic.href}
                  className={`w-full block text-center py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r ${topic.color} text-white hover:shadow-lg transition-all hover:-translate-y-0.5`}>
                  Học ngay
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phương pháp học */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Phương pháp khoa học</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Tại Sao Nên Học Từ Vựng CSCA Tại MOLI.STUDIO?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🧠', title: 'Spaced Repetition', desc: 'Thuật toán spaced repetition giúp bạn ôn tập đúng lúc, ghi nhớ từ vựng lâu hơn gấp 3 lần so với học truyền thống.' },
              { icon: '📱', title: 'Flashcard Thông Minh', desc: 'Mỗi flashcard có phiên âm pinyin, nghĩa tiếng Việt, ví dụ câu và hình ảnh minh họa. Học mọi lúc mọi nơi trên điện thoại.' },
              { icon: '📊', title: 'Theo Dõi Tiến Độ', desc: 'Biểu đồ học tập rõ ràng, biết chính xác số từ đã học, số từ cần ôn và thời điểm ôn tiếp theo.' },
              { icon: '🎯', title: 'Bám Sát Đề Thi', desc: 'Từ vựng được biên soạn dựa trên phân tích đề thi CSCA thực tế. Học đúng từ vựng xuất hiện trong đề thi.' },
              { icon: '🔄', title: 'Lặp Lại Ngắn Quãng', desc: 'Hệ thống tự động gửi nhắc nhở ôn tập. Bạn không cần lo lắng về việc quên từ vựng đã học.' },
              { icon: '🏆', title: 'Kiểm Tra Định Kỳ', desc: 'Bài kiểm tra từ vựng định kỳ giúp đánh giá mức độ ghi nhớ và xác định từ cần ôn thêm.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-black text-gray-900 text-base mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mẫu từ vựng */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Xem trước</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Một Số Từ Vựng CSCA Phổ Biến
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { zh: '数学', pinyin: 'shùxué', vi: 'Toán học', topic: 'Toán' },
              { zh: '方程', pinyin: 'fāngchéng', vi: 'Phương trình', topic: 'Toán' },
              { zh: '长城', pinyin: 'Chángchéng', vi: 'Vạn Lý Trường Thành', topic: 'Văn hóa' },
              { zh: '孔子', pinyin: 'Kǒngzǐ', vi: 'Khổng Tử', topic: 'Lịch sử' },
              { zh: '北京', pinyin: 'Běijīng', vi: 'Bắc Kinh', topic: 'Địa lý' },
              { zh: '长江', pinyin: 'Chángjiāng', vi: 'Trường Giang', topic: 'Địa lý' },
              { zh: '考试', pinyin: 'kǎoshì', vi: 'Kỳ thi', topic: 'Giao tiếp' },
              { zh: '学习', pinyin: 'xuéxí', vi: 'Học tập', topic: 'Giao tiếp' },
            ].map((word) => (
              <div key={word.zh} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-xs font-bold text-blue-500 mb-2">{word.topic}</div>
                <div className="text-2xl font-black text-gray-900 mb-1">{word.zh}</div>
                <div className="text-sm text-gray-500 mb-1">{word.pinyin}</div>
                <div className="text-sm font-semibold text-gray-700">{word.vi}</div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/tu-vung"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200 transition-all">
              Học đầy đủ từ vựng
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Internal links */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-10">
            Bài Viết Liên Quan
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung', desc: 'Phân tích chi tiết cấu trúc đề thi CSCA từng phần.' },
              { title: 'Từ Vựng HSK 4 Theo Chủ Đề', href: '/blog/tu-vung-hsk-4-theo-chu-de-hoc-ngay', desc: 'Học từ vựng HSK 4 theo chủ đề mỗi ngày.' },
              { title: 'CSCA Là Gì? Tìm Hiểu Toàn Diện', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc', desc: 'Tìm hiểu tổng quan về kỳ thi CSCA.' },
              { title: 'Học Bổng CSC 2026: Đăng Ký Từ A-Z', href: '/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du', desc: 'Hướng dẫn đăng ký học bổng CSC.' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-blue-600 transition-colors">{link.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Học Từ Vựng CSCA Ngay Hôm Nay
          </h2>
          <p className="text-blue-200 mb-8 text-sm sm:text-base">
            Đăng ký miễn phí để truy cập đầy đủ 2.000+ từ vựng CSCA, flashcard thông minh và bài kiểm tra định kỳ.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/tu-vung"
              className="px-8 py-4 bg-white text-blue-700 font-black rounded-2xl hover:bg-blue-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Học từ vựng ngay
            </Link>
            <Link href="/register"
              className="px-8 py-4 bg-blue-500 text-white font-bold rounded-2xl border-2 border-blue-400 hover:bg-blue-400 transition-all">
              Đăng ký miễn phí
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
              <p className="text-gray-400 text-sm">Nền tảng học từ vựng CSCA hàng đầu Việt Nam với phương pháp spaced repetition hiệu quả.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Liên kết nhanh</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/tu-vung-csca" className="hover:text-white transition-colors">Từ vựng CSCA</Link></li>
                <li><Link href="/tu-vung" className="hover:text-white transition-colors">Học flashcard</Link></li>
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
