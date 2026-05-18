import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Thi CSCA 2026 - Đăng Ký, Lịch Thi, Địa Điểm & Kết Quả | MOLI.STUDIO',
  description: 'Thông tin thi CSCA 2026: lịch thi, địa điểm, cách đăng ký, kết quả thi CSCA. Hướng dẫn chi tiết từ đăng ký đến nhận kết quả. Cập nhật lịch thi CSCA mới nhất.',
  keywords: ['thi CSCA', 'thi CSCA 2026', 'đăng ký thi CSCA', 'lịch thi CSCA', 'địa điểm thi CSCA', 'kết quả thi CSCA', 'điểm thi CSCA', 'phòng thi CSCA'],
  openGraph: {
    title: 'Thi CSCA 2026 - Đăng Ký, Lịch Thi, Địa Điểm & Kết Quả',
    description: 'Thông tin thi CSCA 2026: lịch thi, địa điểm, cách đăng ký, kết quả thi CSCA. Cập nhật chi tiết nhất.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Thi CSCA 2026' }],
  },
  alternates: { canonical: '/thi-csca' },
};

export default function ThiCSCA() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-20" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold mb-6">
            Cập nhật 2026
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-6">
            Thi CSCA 2026<br />
            <span className="bg-gradient-to-r from-amber-600 to-red-500 bg-clip-text text-transparent">
              Lịch Thi, Địa Điểm & Kết Quả
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Thông tin chi tiết về kỳ thi CSCA 2026: lịch thi 3 đợt, địa điểm thi tại Việt Nam, cách đăng ký, lệ phí và cách tra cứu kết quả thi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-200 transition-all text-center">
              Bắt đầu ôn thi ngay
            </Link>
            <Link href="/blog/trung-tam-thi-csca-tai-viet-nam-dia-chi-lich-thi-2026"
              className="px-8 py-4 bg-white text-amber-700 font-bold rounded-2xl border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-center">
              Xem địa điểm thi
            </Link>
          </div>
        </div>
      </section>

      {/* Lịch thi 2026 */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Lịch thi chính thức</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Lịch Thi CSCA 2026
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                dot: 'Đợt 1',
                date: '15/03/2026',
                label: 'Chủ Nhật',
                register: '01/01 - 28/02/2026',
                color: 'from-green-400 to-green-500',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-200',
                note: 'Cho học bổng mùa thu 2026',
                status: 'Đã mở đăng ký',
              },
              {
                dot: 'Đợt 2',
                date: '17/05/2026',
                label: 'Chủ Nhật',
                register: '01/03 - 30/04/2026',
                color: 'from-amber-400 to-amber-500',
                bgColor: 'bg-amber-50',
                borderColor: 'border-amber-200',
                note: 'Đợt bổ sung',
                status: 'Sắp mở đăng ký',
              },
              {
                dot: 'Đợt 3',
                date: '12/07/2026',
                label: 'Chủ Nhật',
                register: '01/05 - 15/06/2026',
                color: 'from-red-400 to-red-500',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                note: 'Đợt cuối năm',
                status: 'Sắp mở đăng ký',
              },
            ].map((exam) => (
              <div key={exam.dot} className={`${exam.bgColor} rounded-3xl p-6 border-2 ${exam.borderColor}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${exam.color}`}>
                    {exam.dot}
                  </div>
                  <span className="text-xs font-bold text-gray-400">{exam.label}</span>
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{exam.date}</div>
                <div className="text-sm text-gray-500 mb-4">{exam.note}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-bold text-gray-400 w-24">Hạn đăng ký:</span>
                    <span className="font-semibold text-gray-700">{exam.register}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-bold text-gray-400 w-24">Trạng thái:</span>
                    <span className="font-bold">{exam.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Địa điểm thi */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Địa điểm thi</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Thi CSCA Tại Việt Nam — Địa Chỉ Chi Tiết
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                region: 'Miền Bắc',
                icon: '🏛️',
                color: 'from-blue-500 to-blue-600',
                centers: [
                  { name: 'Đại học Hà Nội (HANU)', address: 'Số 36 Phố Hàm Long, Quận Hoàn Kiếm, Hà Nội', phone: '024-3734 6791' },
                  { name: 'ĐH Ngoại ngữ, ĐHQGHN', address: 'Khu phố Dịch Vọng, Quận Cầu Giấy, Hà Nội', phone: '024-3754 6321' },
                ],
              },
              {
                region: 'Miền Nam',
                icon: '🏙️',
                color: 'from-red-500 to-red-600',
                centers: [
                  { name: 'ĐH Khoa học Xã hội & Nhân văn', address: '10-12 Đinh Tiên Hoàng, Quận 1, TP.HCM', phone: '028-3829 1651' },
                  { name: 'Trung tâm Nghiên cứu Hán Nôm', address: '24 Lý Thường Kiệt, Quận 10, TP.HCM', phone: '028-3864 2507' },
                ],
              },
              {
                region: 'Miền Trung',
                icon: '🌊',
                color: 'from-amber-500 to-amber-600',
                centers: [
                  { name: 'ĐH Ngoại ngữ, ĐH Đà Nẵng', address: 'Khuê Trung, Quận Cẩm Lệ, Đà Nẵng', phone: '0236-3842 384' },
                ],
              },
            ].map((region) => (
              <div key={region.region} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${region.color} flex items-center justify-center text-2xl shadow-sm`}>
                    {region.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400">Khu vực</span>
                    <h3 className="font-black text-gray-900 text-base">{region.region}</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  {region.centers.map((center) => (
                    <div key={center.name} className="p-4 bg-gray-50 rounded-2xl">
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{center.name}</h4>
                      <p className="text-xs text-gray-500 mb-1">{center.address}</p>
                      <p className="text-xs font-semibold text-indigo-600">{center.phone}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cách đăng ký */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Hướng dẫn</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 mb-4">
              Cách Đăng Ký Thi CSCA
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { step: '1', title: 'Truy Cập Trang Đăng Ký', desc: 'Vào website của trung tâm thi hoặc CIC để đăng ký online. Liên kết sẽ được công bố khi đợt thi mở đăng ký.', icon: '🌐' },
                { step: '2', title: 'Điền Thông Tin Cá Nhân', desc: 'Nhập họ tên, ngày sinh, số CMND/CCCD, địa chỉ email và số điện thoại liên hệ.', icon: '📝' },
                { step: '3', title: 'Chọn Đợt Thi & Địa Điểm', desc: 'Chọn đợt thi phù hợp và trung tâm thi gần nhất với bạn. Lưu ý: số lượng slot có hạn.', icon: '📍' },
                { step: '4', title: 'Upload Ảnh Chân Dung', desc: 'Ảnh nền trắng, kích thước 4x6cm hoặc theo yêu cầu của trung tâm thi.', icon: '📷' },
              ].map((step) => (
                <div key={step.step} className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">{step.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {[
                { step: '5', title: 'Nộp Lệ Phí Thi', desc: 'Chuyển khoản hoặc nộp tiền mặt tại trung tâm thi. Lệ phí: 500.000 - 600.000 VNĐ/đợt.', icon: '💳' },
                { step: '6', title: 'Nhận Phiếu Báo Thi', desc: 'Sau khi hoàn tất, bạn sẽ nhận được phiếu báo thi qua email với thông tin phòng thi và số báo danh.', icon: '📧' },
                { step: '7', title: 'Đến Phòng Thi Đúng Giờ', desc: 'Đến sớm 30-45 phút. Mang theo CMND/CCCD gốc và phiếu báo thi. Điện thoại phải tắt.', icon: '⏰' },
                { step: '8', title: 'Tra Cứu Kết Quả', desc: 'Kết quả thi CSCA được công bố trong 2-4 tuần sau ngày thi, qua email và website trung tâm.', icon: '📊' },
              ].map((step) => (
                <div key={step.step} className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">{step.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Thông tin quan trọng */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
              Thông Tin Quan Trọng Khi Thi CSCA
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '📋', title: 'Giấy Tờ Mang Theo', items: ['CMND/CCCD bản gốc', 'Phiếu báo thi (in sẵn)', 'Bút chì 2B (2-3 cây)', 'Tẩy, gọt bút chì'] },
              { icon: '⛔', title: 'Không Được Mang', items: ['Điện thoại (bắt buộc tắt)', 'Máy tính bỏ túi', 'Tài liệu, sách vở', 'Đồ ăn, nước uống có nhãn'] },
              { icon: '⏱️', title: 'Giờ Giấc Thi', items: ['07:30 - Vào phòng thi', '08:00 - Phát đề', '08:15 - Đọc hướng dẫn', '08:30 - Bắt đầu làm bài'] },
              { icon: '📏', title: 'Cấu Trúc Đề Thi', items: ['Phần 1: Toán (35 phút)', 'Phần 2: Tổng hợp (45 phút)', 'Nghỉ giải lao 15 phút', 'Phần 3: Tiếng Trung (70 phút)'] },
              { icon: '💯', title: 'Thang Điểm', items: ['Tổng điểm: 100', 'Điểm đạt: 60/100', 'Học bổng CSC: 60-70+', 'Trường top: 75-90+'] },
              { icon: '✅', title: 'Kết Quả Thi', items: ['Công bố: 2-4 tuần sau thi', 'Tra cứu: qua email', 'Giấy chứng nhận: gửi về', 'Thời hạn: 2 năm'] },
            ].map((info) => (
              <div key={info.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="text-2xl mb-3">{info.icon}</div>
                <h3 className="font-bold text-gray-900 text-sm mb-3">{info.title}</h3>
                <ul className="space-y-1.5">
                  {info.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
              { title: 'Trung Tâm Thi CSCA Tại Việt Nam', href: '/blog/trung-tam-thi-csca-tai-viet-nam-dia-chi-lich-thi-2026' },
              { title: 'Cấu Trúc Đề Thi CSCA Chi Tiết', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung' },
              { title: 'Hướng Dẫn Học Từ Vựng Thi CSCA', href: '/blog/huong-dan-hoc-tu-vung-tieng-trung-thi-csca' },
              { title: '10 Lỗi Sai Thường Gặp Khi Thi CSCA', href: '/blog/loi-it-sai-thuong-gap-khi-thi-csca' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="block p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-amber-600 transition-colors">{link.title}</h3>
                <div className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  Đọc thêm
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-amber-600 to-orange-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            Sẵn Sàng Cho Kỳ Thi CSCA?
          </h2>
          <p className="text-amber-100 mb-8 text-sm sm:text-base">
            Đăng ký thi CSCA và bắt đầu ôn luyện ngay hôm nay để đạt điểm cao nhất.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/on-thi-csca"
              className="px-8 py-4 bg-white text-amber-700 font-black rounded-2xl hover:bg-amber-50 hover:-translate-y-1 hover:shadow-xl transition-all">
              Ôn thi CSCA ngay
            </Link>
            <Link href="/register"
              className="px-8 py-4 bg-amber-500 text-white font-bold rounded-2xl border-2 border-amber-400 hover:bg-amber-400 transition-all">
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xl font-black text-white mb-3">MOLI.STUDIO</div>
          <p className="text-gray-400 text-sm mb-6">Nền tảng luyện thi CSCA hàng đầu Việt Nam.</p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <Link href="/on-thi-csca" className="hover:text-white transition-colors">Ôn thi CSCA</Link>
            <Link href="/de-thi-csca" className="hover:text-white transition-colors">Đề thi CSCA</Link>
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
