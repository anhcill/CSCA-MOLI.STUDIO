import Link from 'next/link';
import { FiFacebook, FiYoutube, FiInstagram, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';

const SUBJECTS = [
  { name: 'Toán', href: '/mon/toan' },
  { name: 'Vật Lý', href: '/mon/vat-ly' },
  { name: 'Hóa Học', href: '/mon/hoa' },
  { name: 'Tiếng Trung XH', href: '/tiengtrung-xahoi' },
  { name: 'Tiếng Trung TN', href: '/tiengtrung-tunhien' },
];

const RESOURCES = [
  { name: 'Cấu Trúc Đề', href: '/cau-truc-de' },
  { name: 'Lý Thuyết', href: '/ly-thuyet' },
  { name: 'Từ Vựng', href: '/tu-vung' },
  { name: 'Đề Mô Phỏng', href: '/de-mo-phong' },
  { name: 'Tài Liệu', href: '/tailieu' },
  { name: 'Diễn Đàn', href: '/forum' },
];

const POLICIES = [
  { name: 'Chính sách bảo mật', href: '/chinh-sach-bao-mat' },
  { name: 'Điều khoản sử dụng', href: '/dieu-khoan-su-dung' },
  { name: 'Chính sách cookie', href: '/chinh-sach-cookie' },
  { name: 'Liên hệ', href: '/lien-he' },
];

const SOCIALS = [
  {
    icon: FiFacebook,
    label: 'Facebook',
    href: 'https://facebook.com',
    color: 'hover:text-blue-400',
  },
  {
    icon: FiYoutube,
    label: 'YouTube',
    href: 'https://youtube.com',
    color: 'hover:text-red-400',
  },
  {
    icon: FiInstagram,
    label: 'Instagram',
    href: 'https://instagram.com',
    color: 'hover:text-pink-400',
  },
  // Zalo — no official react-icons, using text shorthand
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-gray-400">
      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="text-2xl font-black text-white flex items-center gap-2 mb-3">
              CSCA <span className="text-purple-400">🎯</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Nền tảng luyện thi CSCA toàn diện — giúp học viên Việt Nam chinh phục học bổng tại các trường đại học hàng đầu Trung Quốc.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {SOCIALS.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                  aria-label={s.label}
                  className={`w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-colors ${s.color}`}>
                  <s.icon size={16} />
                </a>
              ))}
              {/* Zalo text icon */}
              <a href="https://zalo.me" target="_blank" rel="noreferrer" aria-label="Zalo"
                className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-colors hover:text-blue-300 text-[11px] font-black">
                ZL
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok"
                className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-colors hover:text-white text-[11px] font-black">
                TT
              </a>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Môn Học</h4>
            <ul className="space-y-2.5">
              {SUBJECTS.map(s => (
                <li key={s.name}>
                  <Link href={s.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Tài Nguyên</h4>
            <ul className="space-y-2.5">
              {RESOURCES.map(r => (
                <li key={r.name}>
                  <Link href={r.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Liên Hệ</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:support@csca.edu.vn" className="flex items-start gap-2.5 text-sm text-gray-500 hover:text-white transition-colors group">
                  <FiMail size={15} className="text-purple-500 shrink-0 mt-0.5" />
                  support@csca.edu.vn
                </a>
              </li>
              <li>
                <a href="tel:+84000000000" className="flex items-start gap-2.5 text-sm text-gray-500 hover:text-white transition-colors">
                  <FiPhone size={15} className="text-purple-500 shrink-0 mt-0.5" />
                  0900 000 000
                </a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-500">
                <FiMapPin size={15} className="text-purple-500 shrink-0 mt-0.5" />
                Hà Nội, Việt Nam
              </li>
            </ul>

            <div className="mt-5">
              <h4 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">Chính Sách</h4>
              <ul className="space-y-2">
                {POLICIES.map(p => (
                  <li key={p.name}>
                    <Link href={p.href} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            © {year} CSCA. Bảo lưu mọi quyền.
          </p>
          <div className="flex items-center gap-4">
            {POLICIES.slice(0, 2).map(p => (
              <Link key={p.name} href={p.href} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                {p.name}
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-700">
            Made with ❤️ in Vietnam 🇻🇳
          </p>
        </div>
      </div>
    </footer>
  );
}
