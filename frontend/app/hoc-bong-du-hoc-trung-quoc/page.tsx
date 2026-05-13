import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Học Bổng Du Học Trung Quốc 2026 - Điều Kiện, Quy Trình & Hướng Dẫn | MOLI.STUDIO',
  description: 'Tổng hợp thông tin học bổng du học Trung Quốc 2026: học bổng CSC, điều kiện, quy trình đăng ký, kinh nghiệm nhận học bổng cao. Hướng dẫn chi tiết từ A đến Z.',
  keywords: ['học bổng du học Trung Quốc', 'học bổng CSC', 'học bổng Trung Quốc 2026', 'du học Trung Quốc', 'học bổng Chính phủ Trung Quốc', 'học bổng đại học Trung Quốc', 'du học Trung Quốc bằng tiếng Anh'],
  openGraph: {
    title: 'Học Bổng Du Học Trung Quốc 2026 - Điều Kiện & Hướng Dẫn',
    description: 'Tổng hợp thông tin học bổng du học Trung Quốc 2026: học bổng CSC, điều kiện, quy trình đăng ký chi tiết.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Học Bổng Du Học Trung Quốc 2026' }],
  },
  alternates: { canonical: '/hoc-bong-du-hoc-trung-quoc' },
};

export default function HocBongDuHocTrungQuoc() {
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
            Học Bổng Du Học Trung Quốc 2026<br />
            <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
              Cơ Hội Nhận Đến 100% Học Phí
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Thông tin chi tiết về các loại học bổng du học Trung Quốc: học bổng CSC, học bổng trường, điều kiện đăng ký, quy trình và kinh nghiệm nhận học bổng cao từ những người đã thành công.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du"
              className="px-8 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-200 transition-all text-center">
              Hướng dẫn đăng ký chi tiết
            </Link>
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-red-700 font-bold rounded-2xl border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition-all text-center">
              Ôn thi CSCA ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Các loại học bổng */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Các loại học bổng</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Học Bổng Du Học Trung Quốc Có Những Loại Nào?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: 'Học Bổng CSC',
                full: 'China Scholarship Council',
                icon: '🏛️',
                color: 'from-red-500 to-red-600',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                coverage: 'Miễn 100% học phí + sinh hoạt phí 1.500-3.500 CNY/tháng',
                requirement: 'CSCA ≥ 60%, HSK 4-6 tùy ngành',
                deadline: '31/03/2026',
                popular: true,
              },
              {
                name: 'Học Bổng Trường',
                full: 'University Scholarship',
                icon: '🎓',
                color: 'from-orange-500 to-orange-600',
                bgColor: 'bg-orange-50',
                borderColor: 'border-orange-200',
                coverage: 'Miễn 50-100% học phí + lưu trú',
                requirement: 'CSCA ≥ 55%, HSK 4+',
                deadline: 'Tùy trường (tháng 3-5)',
                popular: false,
              },
              {
                name: 'Học Bổng Tỉnh/Thành',
                full: 'Provincial Scholarship',
                icon: '🏙️',
                color: 'from-amber-500 to-amber-600',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                coverage: 'Miễn 30-70% học phí',
                requirement: 'CSCA ≥ 50%, thường có quốc tịch tỉnh đó',
                deadline: 'Tùy tỉnh',
                popular: false,
              },
            ].map((scholarship) => (
              <div key={scholarship.name}
                className={`${scholarship.bgColor} rounded-3xl p-6 border-2 ${scholarship.borderColor} relative overflow-hidden`}>
                {scholarship.popular && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                    Phổ biến nhất
                  </div>
                )}
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${scholarship.color} text-3xl shadow-sm mb-4`}>
                  {scholarship.icon}
                </div>
                <h3 className="font-black text-gray-900 text-lg mb-1">{scholarship.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{scholarship.full}</p>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">Phạm vi hỗ trợ</span>
                    <p className="text-sm text-gray-700 font-semibold mt-1">{scholarship.coverage}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">Yêu cầu</span>
                    <p className="text-sm text-gray-700 mt-1">{scholarship.requirement}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">Hạn đăng ký</span>
                    <p className="text-sm font-bold text-red-600 mt-1">{scholarship.deadline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Điều kiện */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Điều kiện quan trọng</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-5">
                Làm Sao Để Đủ Điều Kiện Nhận Học Bổng?
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-sm sm:text-base">
                <p>
                  Để nhận học bổng du học Trung Quốc, bạn cần đáp ứng một số điều kiện cơ bản. Điều kiện quan trọng nhất là <strong className="text-gray-900">điểm thi CSCA</strong> — đây là tiêu chí xét duyệt hàng đầu.
                </p>
                <p>
                  Ngoài điểm CSCA, bạn cũng cần có <strong className="text-gray-900">chứng chỉ HSK</strong> phù hợp với ngành đăng ký, hồ sơ đầy đủ và phỏng vấn thành công.
                </p>
              </div>
              <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-700 mb-2">⚠️ Lưu ý quan trọng</p>
                <p className="text-xs text-red-600 leading-relaxed">
                  Mỗi trường và ngành có mức điểm sàn khác nhau. Ngành Y, Dược thường yêu cầu điểm CSCA cao hơn (70-80%). Hãy kiểm tra kỹ yêu cầu của trường mình muốn đăng ký.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: '🎯', label: 'Điểm CSCA', value: '60-85%', detail: 'Tùy loại học bổng và ngành học', color: 'from-red-500 to-red-600' },
                { icon: '📝', label: 'Chứng chỉ HSK', value: 'HSK 4-6', detail: 'Tùy bậc học và ngành đăng ký', color: 'from-orange-500 to-orange-600' },
                { icon: '🎓', label: 'Bằng tốt nghiệp', value: 'Loại Khá trở lên', detail: 'Công chứng và dịch sang tiếng Trung/Anh', color: 'from-amber-500 to-amber-600' },
                { icon: '💪', label: 'Sức khỏe', value: 'Đạt yêu cầu', detail: 'Khám phúc tra theo mẫu của CIC', color: 'from-green-500 to-green-600' },
                { icon: '🌏', label: 'Độ tuổi', value: 'Dưới 35 (ThS), Dưới 40 (TS)', detail: 'Tính đến ngày nộp hồ sơ', color: 'from-blue-500 to-blue-600' },
                { icon: '📋', label: 'Kế hoạch học tập', value: '500-1.000 chữ', detail: 'Bằng tiếng Trung hoặc tiếng Anh', color: 'from-purple-500 to-purple-600' },
              ].map((req) => (
                <div key={req.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${req.color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                    {req.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-400">{req.label}</span>
                      <span className="text-sm font-black text-gray-900">{req.value}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{req.detail}</p>
                  </div>
                </div>
              ))}
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
              Top Trường Có Học Bổng Cao Nhất
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { rank: 1, name: 'Đại học Bắc Kinh', eng: 'Peking University (PKU)', qs: 'Top 15 QS', color: 'from-red-500 to-red-600', scholarship: '100% học phí + 3.500 CNY/tháng' },
              { rank: 2, name: 'Đại học Thanh Hoa', eng: 'Tsinghua University', qs: 'Top 20 QS', color: 'from-orange-500 to-orange-600', scholarship: '100% học phí + 3.500 CNY/tháng' },
              { rank: 3, name: 'Đại học Fudan', eng: 'Fudan University', qs: 'Top 50 QS', color: 'from-amber-500 to-amber-600', scholarship: '100% học phí + 3.000 CNY/tháng' },
              { rank: 4, name: 'Đại học Giao thông Thượng Hải', eng: 'Shanghai Jiao Tong', qs: 'Top 50 QS', color: 'from-yellow-500 to-yellow-600', scholarship: '100% học phí + 2.500 CNY/tháng' },
              { rank: 5, name: 'Đại học Chiết Giang', eng: 'Zhejiang University', qs: 'Top 100 QS', color: 'from-green-500 to-green-600', scholarship: '100% học phí + 2.500 CNY/tháng' },
              { rank: 6, name: 'Đại học Nam Kinh', eng: 'Nanjing University', qs: 'Top 130 QS', color: 'from-emerald-500 to-emerald-600', scholarship: '80% học phí + 2.000 CNY/tháng' },
              { rank: 7, name: 'Đại học Vũ Hán', eng: 'Wuhan University', qs: 'Top 200 QS', color: 'from-teal-500 to-teal-600', scholarship: '70% học phí + 1.800 CNY/tháng' },
              { rank: 8, name: 'Đại học Tôn Trung Sơn', eng: 'Sun Yat-sen University', qs: 'Top 150 QS', color: 'from-cyan-500 to-cyan-600', scholarship: '80% học phí + 2.000 CNY/tháng' },
              { rank: 9, name: 'Đại học Cáp Nhĩ Tân', eng: 'Harbin Institute of Technology', qs: 'Top 250 QS', color: 'from-blue-500 to-blue-600', scholarship: '70% học phí + 1.500 CNY/tháng' },
              { rank: 10, name: 'Đại học Nhân Dân', eng: 'Renmin University', qs: 'Top 200 QS', color: 'from-indigo-500 to-indigo-600', scholarship: '80% học phí + 2.000 CNY/tháng' },
            ].map((uni) => (
              <div key={uni.name} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br ${uni.color} text-white font-black text-sm mb-3`}>
                  {uni.rank}
                </div>
                <h3 className="font-black text-gray-900 text-sm mb-0.5">{uni.name}</h3>
                <p className="text-[11px] text-gray-400 mb-2">{uni.eng}</p>
                <div className="text-[11px] font-bold text-indigo-600 mb-1">{uni.qs}</div>
                <div className="text-[11px] text-gray-500 leading-tight">{uni.scholarship}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quy trình đăng ký */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Quy trình 6 bước</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Cách Đăng Ký Học Bổng Du Học Trung Quốc
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { step: '1', title: 'Nghiên Cứu & Chọn Trường', desc: 'Tìm hiểu top trường phù hợp với ngành học, xếp hạng và yêu cầu đầu vào.', icon: '🔍', color: 'from-red-500 to-red-600' },
              { step: '2', title: 'Chuẩn Bị Hồ Sơ', desc: 'Bằng tốt nghiệp, bảng điểm, HSK, CSCA, kế hoạch học tập, thư giới thiệu.', icon: '📁', color: 'from-orange-500 to-orange-600' },
              { step: '3', title: 'Nộp Hồ Sơ Online', desc: 'Đăng ký tài khoản trên website CSC (www.csc.edu.cn), điền thông tin và upload tài liệu.', icon: '💻', color: 'from-amber-500 to-amber-600' },
              { step: '4', title: 'Thi CSCA & Phỏng Vấn', desc: 'Đạt điểm CSCA ≥ 60%, tham gia phỏng vấn bằng tiếng Trung với đại diện CIC.', icon: '🎯', color: 'from-yellow-500 to-yellow-600' },
              { step: '5', title: 'Chờ Kết Quả', desc: 'CSC xét duyệt hồ sơ trong 2-3 tháng. Kết quả công bố vào tháng 6-7.', icon: '⏳', color: 'from-green-500 to-green-600' },
              { step: '6', title: 'Nhận Thư & Xin Visa', desc: 'Nhận thư xác nhận, xin visa Trung Quốc và chuẩn bị lên đường.', icon: '✈️', color: 'from-blue-500 to-blue-600' },
            ].map((step) => (
              <div key={step.step} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${step.color} opacity-10 rounded-bl-full`} />
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} text-white font-black text-base mb-3 shadow-sm`}>
                  {step.step}
                </div>
                <div className="text-2xl mb-2">{step.icon}</div>
                <h3 className="font-black text-gray-900 text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du"
              className="inline-flex items-center gap-2 px-8 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-200 transition-all">
              Hướng dẫn chi tiết từng bước
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
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
              { title: 'Học Bổng CSC 2026: Đăng Ký Từ A-Z', href: '/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du', desc: 'Hướng dẫn chi tiết đăng ký học bổng CSC từ điều kiện đến khi nhận thư.' },
              { title: 'CSCA Là Gì? Tìm Hiểu Toàn Diện', href: '/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc', desc: 'CSCA là gì, thi những gì và làm sao đạt điểm cao.' },
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung', desc: 'Phân tích cấu trúc đề thi CSCA từng phần.' },
              { title: 'Trung Tâm Thi CSCA Tại Việt Nam', href: '/blog/trung-tam-thi-csca-tai-viet-nam-dia-chi-lich-thi-2026', desc: 'Danh sách địa chỉ và lịch thi CSCA 2026.' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-red-600 transition-colors">{link.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-red-600 to-orange-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Muốn Nhận Học Bổng? Hãy Bắt Đầu Từ Điểm CSCA
          </h2>
          <p className="text-red-100 mb-8 text-sm sm:text-base">
            Điểm CSCA cao là chìa khóa để nhận học bổng du học Trung Quốc. Luyện thi ngay hôm nay để đạt điểm ấn tượng.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-red-700 font-black rounded-2xl hover:bg-red-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Ôn thi CSCA ngay
            </Link>
            <Link href="/register"
              className="px-8 py-4 bg-red-500 text-white font-bold rounded-2xl border-2 border-red-400 hover:bg-red-400 transition-all">
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
              <p className="text-gray-400 text-sm">Nền tảng luyện thi CSCA hàng đầu Việt Nam, giúp sinh viên chinh phục học bổng du học Trung Quốc.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Liên kết nhanh</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/on-thi-csca" className="hover:text-white transition-colors">Ôn thi CSCA</Link></li>
                <li><Link href="/de-thi-csca" className="hover:text-white transition-colors">Đề thi CSCA</Link></li>
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
