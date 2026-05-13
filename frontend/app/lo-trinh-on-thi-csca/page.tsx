import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Lộ Trình Ôn Thi CSCA - Cách Ôn CSCA Hiệu Quả Trong 3 Tháng | MOLI.STUDIO',
  description: 'Lộ trình ôn thi CSCA chi tiết từ cơ bản đến nâng cao trong 3 tháng. Phương pháp học khoa học, tài liệu chuẩn, và cách phân bổ thời gian hiệu quả để đạt điểm CSCA cao.',
  keywords: ['lộ trình ôn thi CSCA', 'cách ôn thi CSCA', 'ôn thi CSCA hiệu quả', 'luyện thi CSCA 3 tháng', 'phương pháp ôn thi CSCA', 'thời gian ôn thi CSCA', 'học CSCA'],
  openGraph: {
    title: 'Lộ Trình Ôn Thi CSCA - Hiệu Quả Trong 3 Tháng',
    description: 'Lộ trình ôn thi CSCA chi tiết từ cơ bản đến nâng cao trong 3 tháng. Phương pháp học khoa học, tài liệu chuẩn.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Lộ Trình Ôn Thi CSCA' }],
  },
  alternates: { canonical: '/lo-trinh-on-thi-csca' },
};

export default function LoTrinhOnThiCSCA() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-violet-100 text-violet-700 rounded-full text-sm font-semibold mb-6">
            Phương pháp khoa học
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Lộ Trình Ôn Thi CSCA<br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Hiệu Quả Trong 3 Tháng
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Lộ trình ôn thi CSCA chi tiết theo từng giai đoạn: nền tảng, luyện đề và tổng ôn. Phương pháp học khoa học giúp bạn đạt điểm CSCA cao một cách hiệu quả nhất.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/lo-trinh"
              className="px-8 py-4 bg-violet-600 text-white font-bold rounded-2xl hover:bg-violet-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-200 transition-all text-center">
              Tạo lộ trình cá nhân với AI
            </Link>
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-violet-700 font-bold rounded-2xl border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-center">
              Xem tài liệu ôn thi
            </Link>
          </div>
        </div>
      </section>

      {/* Overview timeline */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Tổng quan</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Lộ Trình 3 Tháng Ôn Thi CSCA
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              12 tuần ôn thi CSCA từ cơ bản đến chuyên sâu. Mỗi giai đoạn có mục tiêu rõ ràng và tài liệu hỗ trợ phù hợp.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-400 via-purple-400 to-indigo-400 transform -translate-x-1/2" />

            {/* Phase 1 */}
            <div className="relative mb-12 lg:mb-16">
              <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <div className="lg:text-right lg:pr-12">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-bold mb-3">
                    Tuần 1-6
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">Giai Đoạn 1: Nền Tảng</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Xây dựng nền tảng vững chắc: kiến thức toán THPT, từ vựng HSK 4, và tìm hiểu văn hóa, lịch sử Trung Quốc. Giai đoạn này chiếm 50% thời gian ôn luyện.
                  </p>
                </div>
                <div className="hidden lg:flex justify-start lg:pl-12">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">1</div>
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="relative mb-12 lg:mb-16">
              <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <div className="hidden lg:flex justify-end lg:pr-12">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-purple-200">2</div>
                </div>
                <div className="lg:pl-12">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-bold mb-3">
                    Tuần 7-10
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">Giai Đoạn 2: Luyện Đề</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Luyện tập với 15-20 đề mô phỏng CSCA có thời gian. Phân tích lỗi sai sau mỗi đề, xác định điểm yếu và tập trung cải thiện. Giai đoạn này chiếm 35% thời gian.
                  </p>
                </div>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="relative">
              <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <div className="lg:text-right lg:pr-12">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-bold mb-3">
                    Tuần 11-12
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">Giai Đoạn 3: Tổng Ôn</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Ôn lại công thức, kiến thức trọng tâm. Làm 3-5 đề cuối cùng để đánh giá mức độ sẵn sàng. Nghỉ ngơi và giữ tinh thần thoải mái trước ngày thi.
                  </p>
                </div>
                <div className="hidden lg:flex justify-start lg:pl-12">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black shadow-lg shadow-amber-200">3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chi tiết từng giai đoạn */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Giai đoạn 1 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  1
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-500">TUẦN 1-6</span>
                  <h3 className="font-black text-gray-900">Nền Tảng</h3>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { week: 'Tuần 1-2', title: 'Toán Cơ Bản', tasks: ['Ôn lại kiến thức toán THPT lớp 10-12', 'Học từ vựng toán tiếng Trung (50 từ)', 'Làm bài tập toán cơ bản bằng tiếng Trung'] },
                  { week: 'Tuần 3-4', title: 'HSK 4 & Tiếng Trung', tasks: ['Học 50 từ vựng HSK 4 mỗi ngày', 'Luyện nghe 30 phút/ngày', 'Tập đọc hiểu cơ bản'] },
                  { week: 'Tuần 5-6', title: 'Lịch Sử & Văn Hóa', tasks: ['Đọc sách lịch sử Trung Quốc', 'Học thuộc các sự kiện quan trọng theo timeline', 'Nắm kiến thức địa lý cơ bản'] },
                ].map((week) => (
                  <div key={week.week} className="p-4 bg-blue-50 rounded-2xl">
                    <div className="text-xs font-bold text-blue-500 mb-2">{week.week}</div>
                    <h4 className="font-bold text-gray-900 text-sm mb-2">{week.title}</h4>
                    <ul className="space-y-1.5">
                      {week.tasks.map((task) => (
                        <li key={task} className="flex items-start gap-2 text-xs text-gray-600">
                          <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Giai đoạn 2 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  2
                </div>
                <div>
                  <span className="text-xs font-bold text-purple-500">TUẦN 7-10</span>
                  <h3 className="font-black text-gray-900">Luyện Đề</h3>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { week: 'Tuần 7-8', title: 'Luyện Đề Phần 1 & 2', tasks: ['Làm 5 đề thi phần Toán', 'Làm 5 đề thi phần Tổng hợp', 'Phân tích và ghi chép lỗi sai'] },
                  { week: 'Tuần 9', title: 'Luyện Đề Phần 3', tasks: ['Luyện 5 đề phần Tiếng Trung', 'Tập viết 2 bài/tuần', 'Luyện nghe với tốc độ bình thường'] },
                  { week: 'Tuần 10', title: 'Đề Tổng Hợp', tasks: ['Làm 3 đề tổng hợp đầy đủ', 'Tập quản lý thời gian 150 phút', 'Đánh giá điểm và xác định mục tiêu'] },
                ].map((week) => (
                  <div key={week.week} className="p-4 bg-purple-50 rounded-2xl">
                    <div className="text-xs font-bold text-purple-500 mb-2">{week.week}</div>
                    <h4 className="font-bold text-gray-900 text-sm mb-2">{week.title}</h4>
                    <ul className="space-y-1.5">
                      {week.tasks.map((task) => (
                        <li key={task} className="flex items-start gap-2 text-xs text-gray-600">
                          <svg className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Giai đoạn 3 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  3
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-500">TUẦN 11-12</span>
                  <h3 className="font-black text-gray-900">Tổng Ôn</h3>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { week: 'Tuần 11', title: 'Ôn Trọng Tâm', tasks: ['Ôn lại công thức toán quan trọng', 'Học thuộc sự kiện lịch sử hay hỏi nhất', 'Ôn từ vựng HSK 4 đã học'] },
                  { week: 'Tuần 12', title: 'Đề Cuối Cùng', tasks: ['Làm 2-3 đề mô phỏng cuối', 'Đánh giá tổng thể điểm mạnh/yếu', 'Nghỉ ngơi, giữ sức khỏe'] },
                  { week: 'Trước 1 tuần', title: 'Chuẩn Bị Thi', tasks: ['Đọc lại tất cả lỗi sai đã ghi', 'Đi ngủ sớm, không thức khuya', 'Chuẩn bị giấy tờ và địa điểm thi'] },
                ].map((week) => (
                  <div key={week.week} className="p-4 bg-amber-50 rounded-2xl">
                    <div className="text-xs font-bold text-amber-500 mb-2">{week.week}</div>
                    <h4 className="font-bold text-gray-900 text-sm mb-2">{week.title}</h4>
                    <ul className="space-y-1.5">
                      {week.tasks.map((task) => (
                        <li key={task} className="flex items-start gap-2 text-xs text-gray-600">
                          <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phương pháp học */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Phương pháp học</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Mẹo Ôn Thi CSCA Hiệu Quả
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎯', title: 'Làm Đề Đúng Thời Gian', desc: 'Khi luyện đề, hãy bấm giờ đúng 150 phút. Đừng dùng tài liệu. Điều này giúp bạn làm quen với áp lực thời gian khi thi thật.' },
              { icon: '📝', title: 'Ghi Chép Lỗi Sai', desc: 'Sau mỗi đề, ghi lại tất cả câu sai, lý do sai và cách khắc phục. Ôn lại danh sách này trước mỗi đề tiếp theo.' },
              { icon: '🗣️', title: 'Học Tiếng Trung Mỗi Ngày', desc: 'Dành ít nhất 1-2 giờ học tiếng Trung mỗi ngày. Đặc biệt là nghe và đọc — hai kỹ năng chiếm 40% điểm thi CSCA.' },
              { icon: '📅', title: 'Học Đều Đặn', desc: 'Mỗi ngày học 2-3 giờ tốt hơn 10 giờ cuối tuần. Kiến thức cần thời gian để ghi nhớ. Học đều đặn giúp nhớ lâu hơn.' },
              { icon: '🏃', title: 'Chăm Sóc Sức Khỏe', desc: 'Ngủ đủ 7-8 giờ, ăn uống lành mạnh và tập thể dục nhẹ. Thi CSCA cần sự tỉnh táo — sức khỏe ảnh hưởng trực tiếp đến kết quả.' },
              { icon: '🤖', title: 'Dùng AI Hỗ Trợ', desc: 'Trí tuệ nhân tạo có thể phân tích điểm mạnh, điểm yếu và đề xuất lộ trình học cá nhân hóa. Tận dụng công nghệ để học hiệu quả hơn.' },
            ].map((tip) => (
              <div key={tip.title} className="flex gap-4 p-5 bg-violet-50 rounded-2xl border border-violet-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl shrink-0">{tip.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">{tip.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tài nguyên */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
              Tài Nguyên Hỗ Trợ Ôn Thi CSCA
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '📝', title: 'Đề Thi Mô Phỏng', desc: '20+ đề thi CSCA chuẩn format, có lời giải chi tiết.', href: '/de-thi-csca', color: 'from-blue-500 to-blue-600' },
              { icon: '💬', title: 'Từ Vựng CSCA', desc: '2.000+ từ vựng theo chủ đề, flashcard thông minh.', href: '/tu-vung-csca', color: 'from-purple-500 to-purple-600' },
              { icon: '🗺️', title: 'Lộ Trình AI', desc: 'AI tạo lộ trình học cá nhân hóa dựa trên năng lực.', href: '/lo-trinh', color: 'from-violet-500 to-violet-600' },
              { icon: '📚', title: 'Blog Kiến Thức', desc: 'Bài viết chi tiết về CSCA, học bổng và phương pháp học.', href: '/blog', color: 'from-amber-500 to-amber-600' },
            ].map((resource) => (
              <Link key={resource.href} href={resource.href}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all group">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${resource.color} flex items-center justify-center text-2xl mb-3 shadow-sm`}>
                  {resource.icon}
                </div>
                <h3 className="font-black text-gray-900 text-sm mb-1.5 group-hover:text-violet-600 transition-colors">{resource.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{resource.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-violet-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Bắt Đầu Lộ Trình Ôn Thi CSCA Ngay
          </h2>
          <p className="text-violet-200 mb-8 text-sm sm:text-base">
            Đăng ký miễn phí để nhận lộ trình cá nhân hóa từ AI và truy cập đầy đủ tài liệu ôn thi CSCA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/lo-trinh"
              className="px-8 py-4 bg-white text-violet-700 font-black rounded-2xl hover:bg-violet-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Tạo lộ trình với AI
            </Link>
            <Link href="/register"
              className="px-8 py-4 bg-violet-500 text-white font-bold rounded-2xl border-2 border-violet-400 hover:bg-violet-400 transition-all">
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
              <p className="text-gray-400 text-sm">Nền tảng luyện thi CSCA hàng đầu Việt Nam, lộ trình học cá nhân hóa.</p>
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
