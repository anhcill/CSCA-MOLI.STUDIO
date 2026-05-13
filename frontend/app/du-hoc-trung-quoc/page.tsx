import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Du Học Trung Quốc 2026 - Điều Kiện, Chi Phí & Hướng Dẫn Chi Tiết | MOLI.STUDIO',
  description: 'Du học Trung Quốc 2026: điều kiện, chi phí, top trường, học bổng và hướng dẫn đăng ký chi tiết. Tất cả thông tin bạn cần để bắt đầu hành trình du học Trung Quốc.',
  keywords: ['du học Trung Quốc', 'du hoc Trung Quoc', 'du học Trung Quốc 2026', 'chi phí du học Trung Quốc', 'trường đại học Trung Quốc', 'du học Trung Quốc tự túc', 'du hoc Trung Quoc 2026'],
  openGraph: {
    title: 'Du Học Trung Quốc 2026 - Điều Kiện, Chi Phí & Hướng Dẫn',
    description: 'Du học Trung Quốc 2026: điều kiện, chi phí, top trường, học bổng và hướng dẫn đăng ký chi tiết.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Du Học Trung Quốc 2026' }],
  },
  alternates: { canonical: '/du-hoc-trung-quoc' },
};

export default function DuHocTrungQuoc() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-20" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-semibold mb-6">
            Cập nhật 2026
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Du Học Trung Quốc 2026<br />
            <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
              Cơ Hội & Hướng Dẫn Chi Tiết
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Thông tin toàn diện về du học Trung Quốc: điều kiện, chi phí, top trường đại học, học bổng, Visa và cuộc sống tại Trung Quốc. Tất cả những gì bạn cần biết trong một bài viết.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/hoc-bong-du-hoc-trung-quoc"
              className="px-8 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-200 transition-all text-center">
              Khám phá học bổng
            </Link>
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-red-700 font-bold rounded-2xl border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition-all text-center">
              Bắt đầu ôn thi CSCA
            </Link>
          </div>
        </div>
      </section>

      {/* Tại sao du học Trung Quốc */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Vì sao Chọn Trung Quốc</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Tại Sao Nên Du Học Trung Quốc?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '💰', title: 'Chi Phí Thấp', desc: 'Học phí chỉ 10.000-30.000 CNY/năm. Với học bổng CSC, có thể miễn 100% học phí và nhận sinh hoạt phí hàng tháng.' },
              { icon: '🏆', title: 'Trường Top Thế Giới', desc: 'Nhiều trường Trung Quốc lọt top 100 QS: Peking, Tsinghua, Fudan, Shanghai Jiao Tong. Bằng cấp được quốc tế công nhận.' },
              { icon: '🌏', title: 'Thị Trường Lớn', desc: '1.4 tỷ dân, nền kinh tế lớn thứ 2 thế giới. Cơ hội việc làm rộng mở tại Trung Quốc và quốc tế.' },
              { icon: '🗣️', title: 'Học Tiếng Trung', desc: 'Trung Quốc là nơi học tiếng Trung tốt nhất.immersed trong môi trường ngôn ngữ suốt thời gian học.' },
            ].map((item) => (
              <div key={item.title} className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-5 border border-red-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-black text-gray-900 text-base mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chi phí du học */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Chi phí thực tế</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Chi Phí Du Học Trung Quốc 2026
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            {/* Tự túc */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold mb-4">
                Du học tự túc
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-4">Chi Phí Tự Chi Trả</h3>
              <div className="space-y-3">
                {[
                  { label: 'Học phí (năm)', value: '10.000 - 30.000 CNY', usd: '~1.400 - 4.200 USD' },
                  { label: 'Lưu trú (tháng)', value: '500 - 1.500 CNY', usd: '~70 - 210 USD' },
                  { label: 'Ăn uống (tháng)', value: '1.000 - 2.000 CNY', usd: '~140 - 280 USD' },
                  { label: 'Di chuyển (tháng)', value: '200 - 500 CNY', usd: '~28 - 70 USD' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">{item.value}</div>
                      <div className="text-xs text-gray-400">{item.usd}</div>
                    </div>
                  </div>
                ))}
                <div className="pt-3 bg-orange-50 rounded-xl p-3">
                  <div className="text-xs font-bold text-orange-600 mb-1">Tổng ước tính / năm</div>
                  <div className="text-xl font-black text-gray-900">50 - 100 triệu VNĐ</div>
                </div>
              </div>
            </div>

            {/* Học bổng CSC */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-red-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-bl from-red-600 to-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                Được khuyến nghị
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-bold mb-4">
                Học bổng CSC
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-4">Chi Phí Với Học Bổng CSC</h3>
              <div className="space-y-3">
                {[
                  { label: 'Học phí', value: 'Miễn 100%', icon: '✅' },
                  { label: 'Lưu trú', value: 'Miễn phí (ký túc xá)', icon: '✅' },
                  { label: 'Sinh hoạt phí', value: '1.500 - 3.500 CNY/tháng', icon: '💰' },
                  { label: 'Bảo hiểm y tế', value: 'Miễn phí', icon: '✅' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-green-600">{item.value}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 bg-green-50 rounded-xl p-3">
                  <div className="text-xs font-bold text-green-600 mb-1">Bạn chỉ cần chi</div>
                  <div className="text-xl font-black text-gray-900">Tiền vé máy bay + sinh hoạt</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top trường */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Đích đến của bạn</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Top Trường Đại Học Trung Quốc Cho Du Học Sinh
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { rank: 1, name: 'Đại học Bắc Kinh', eng: 'Peking University', qs: 'Top 15 QS', country: 'Bắc Kinh', color: 'from-red-500 to-red-600' },
              { rank: 2, name: 'Đại học Thanh Hoa', eng: 'Tsinghua University', qs: 'Top 20 QS', country: 'Bắc Kinh', color: 'from-orange-500 to-orange-600' },
              { rank: 3, name: 'Đại học Fudan', eng: 'Fudan University', qs: 'Top 50 QS', country: 'Thượng Hải', color: 'from-amber-500 to-amber-600' },
              { rank: 4, name: 'ĐH Giao thông Thượng Hải', eng: 'Shanghai Jiao Tong', qs: 'Top 50 QS', country: 'Thượng Hải', color: 'from-yellow-500 to-yellow-600' },
              { rank: 5, name: 'Đại học Chiết Giang', eng: 'Zhejiang University', qs: 'Top 100 QS', country: 'Hàng Châu', color: 'from-green-500 to-green-600' },
              { rank: 6, name: 'Đại học Nam Kinh', eng: 'Nanjing University', qs: 'Top 130 QS', country: 'Nam Kinh', color: 'from-emerald-500 to-emerald-600' },
              { rank: 7, name: 'Đại học Vũ Hán', eng: 'Wuhan University', qs: 'Top 200 QS', country: 'Vũ Hán', color: 'from-teal-500 to-teal-600' },
              { rank: 8, name: 'ĐH Tôn Trung Sơn', eng: 'Sun Yat-sen University', qs: 'Top 150 QS', country: 'Quảng Châu', color: 'from-cyan-500 to-cyan-600' },
              { rank: 9, name: 'ĐH Cáp Nhĩ Tân', eng: 'Harbin Institute of Technology', qs: 'Top 250 QS', country: 'Cáp Nhĩ Tân', color: 'from-blue-500 to-blue-600' },
            ].map((uni) => (
              <div key={uni.name} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all flex gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${uni.color} flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm`}>
                  {uni.rank}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-gray-900 text-sm mb-0.5">{uni.name}</h3>
                  <p className="text-xs text-gray-400 mb-1">{uni.eng}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg">{uni.qs}</span>
                    <span className="text-xs text-gray-400">📍 {uni.country}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Điều kiện & quy trình */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Điều kiện xét duyệt</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-5">
                Điều Kiện Du Học Trung Quốc
              </h2>
              <div className="space-y-4">
                {[
                  { icon: '🎓', label: 'Bằng tốt nghiệp', value: 'Tốt nghiệp đại học hoặc đang học năm cuối' },
                  { icon: '📝', label: 'Điểm CSCA', value: '≥ 60% (học bổng CSC), 55-65% (học bổng trường)' },
                  { icon: '🗣️', label: 'Chứng chỉ HSK', value: 'HSK 4-6 tùy ngành và bậc học' },
                  { icon: '🌍', label: 'Độ tuổi', value: 'Dưới 35 tuổi (Thạc sĩ), dưới 40 tuổi (Tiến sĩ)' },
                  { icon: '💪', label: 'Sức khỏe', value: 'Đủ điều kiện sức khỏe theo quy định' },
                  { icon: '📄', label: 'Hộ chiếu', value: 'Còn hạn ít nhất 6 tháng' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3">
                    <div className="text-2xl shrink-0">{item.icon}</div>
                    <div>
                      <div className="text-xs font-bold text-gray-400 mb-0.5">{item.label}</div>
                      <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-900 text-lg mb-5">Quy Trình 5 Bước</h3>
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Chọn Trường & Ngành', desc: 'Nghiên cứu và chọn trường phù hợp với ngành và mục tiêu của bạn.' },
                  { step: '2', title: 'Thi CSCA & HSK', desc: 'Đạt điểm CSCA ≥ 60% và có chứng chỉ HSK phù hợp.' },
                  { step: '3', title: 'Chuẩn Bị Hồ Sơ', desc: 'Chuẩn bị đầy đủ giấy tờ: bằng, bảng điểm, kế hoạch học tập, thư giới thiệu.' },
                  { step: '4', title: 'Nộp Hồ Sơ', desc: 'Nộp hồ sơ online trên website CSC và gửi bản cứng về CIC.' },
                  { step: '5', title: 'Nhận Kết Quả & Visa', desc: 'Chờ kết quả (2-3 tháng), nhận thư xác nhận và xin Visa Trung Quốc.' },
                ].map((step) => (
                  <div key={step.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                      {step.step}
                    </div>
                    <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="font-bold text-gray-900 text-sm mb-0.5">{step.title}</div>
                      <div className="text-xs text-gray-500">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
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
              { title: 'Học Bổng Du Học Trung Quốc 2026', href: '/hoc-bong-du-hoc-trung-quoc' },
              { title: 'CSCA Là Gì? Tìm Hiểu Toàn Diện', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc' },
              { title: 'Cách Chuẩn Bị Hồ Sơ Du Học', href: '/blog/cach-chuan-bi-ho-so-du-hoc-trung-quoc' },
              { title: 'Kinh Nghiệm Du Học Trung Quốc', href: '/blog/kinh-nghiem-du-hoc-trung-quoc-tu-hoc-sinh-viet-nam' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-red-600 transition-colors">{link.title}</h3>
                <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
                  Đọc thêm
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-red-600 to-orange-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Bắt Đầu Hành Trình Du Học Trung Quốc
          </h2>
          <p className="text-red-100 mb-8 text-sm sm:text-base">
            Đăng ký miễn phí ngay hôm nay để bắt đầu ôn thi CSCA và chuẩn bị hồ sơ du học Trung Quốc.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-red-700 font-black rounded-2xl hover:bg-red-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Ôn thi CSCA ngay
            </Link>
            <Link href="/hoc-bong-du-hoc-trung-quoc"
              className="px-8 py-4 bg-red-500 text-white font-bold rounded-2xl border-2 border-red-400 hover:bg-red-400 transition-all">
              Khám phá học bổng
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xl font-black text-white mb-3">MOLI.STUDIO</div>
          <p className="text-gray-400 text-sm mb-6">Nền tảng luyện thi CSCA hàng đầu Việt Nam, hỗ trợ hành trình du học Trung Quốc.</p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <Link href="/on-thi-csca" className="hover:text-white transition-colors">Ôn thi CSCA</Link>
            <Link href="/hoc-bong-du-hoc-trung-quoc" className="hover:text-white transition-colors">Học bổng</Link>
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
