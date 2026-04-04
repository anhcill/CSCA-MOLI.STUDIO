'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import Link from 'next/link';
import {
  FiChevronDown, FiChevronUp, FiBook, FiTarget,
  FiMessageCircle, FiAward, FiCalendar, FiAlertCircle,
} from 'react-icons/fi';

// ── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_SECTIONS = [
  {
    title: '📋 Tổng quan về học bổng CSCA',
    color: 'from-blue-500 to-indigo-600',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    items: [
      {
        q: 'Học bổng CSCA là gì?',
        a: 'CSCA (China Scholarship Council Application) là học bổng Chính phủ Trung Quốc dành cho học sinh quốc tế muốn học đại học tại Trung Quốc. Học bổng bao gồm học phí, ký túc xá và trợ cấp sinh hoạt phí.',
      },
      {
        q: 'Kỳ thi đầu vào gồm những môn gì?',
        a: 'Kỳ thi gồm 4 môn: Toán học (数学), Vật Lý (物理), Hóa Học (化学) và Tiếng Trung (汉语). Mỗi môn 100 điểm, tổng 400 điểm. Điểm ngưỡng thường là 240–280 tùy trường.',
      },
      {
        q: 'Thời gian thi khoảng khi nào?',
        a: 'Thông thường kỳ thi diễn ra vào tháng 3–4 hàng năm. Đăng ký trước khoảng tháng 1–2. Bạn nên theo dõi website chính thức của Đại sứ quán Trung Quốc tại Việt Nam để cập nhật lịch thi chính xác.',
      },
      {
        q: 'Học bổng CSCA có bao gồm vé máy bay không?',
        a: 'Học bổng toàn phần thường bao gồm: học phí, ký túc xá đơn, sinh hoạt phí (khoảng 2,500 CNY/tháng), bảo hiểm y tế. Vé máy bay một chiều thường được hỗ trợ khi đến trường, không bao gồm vé về hàng năm.',
      },
    ],
  },
  {
    title: '📐 Toán học & Vật Lý',
    color: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200',
    items: [
      {
        q: 'Toán trong đề thi gồm những chủ đề gì?',
        a: 'Các chủ đề chính: Đại số (phương trình, bất phương trình, hàm số), Hình học (hình phẳng, hình không gian, tọa độ), Giải tích (đạo hàm, tích phân cơ bản), Xác suất thống kê, Số học tổ hợp. Mức độ tương đương lớp 12 Việt Nam.',
      },
      {
        q: 'Vật Lý có khó không? Cần ôn những phần nào?',
        a: 'Vật Lý mức độ trung bình. Ưu tiên ôn: Cơ học (động học, lực, năng lượng), Điện học (điện trường, mạch điện), Quang học (phản xạ, khúc xạ, thấu kính), Dao động sóng. Nhiều câu hỏi dạng tính toán và hình vẽ.',
      },
      {
        q: 'Có thể dùng máy tính trong thi không?',
        a: 'Không, đề thi trắc nghiệm và tự luận đều không được phép dùng máy tính. Cần thuộc các công thức và tính tay thành thạo. Một số phép tính có thể dùng số nguyên hoặc căn đơn giản.',
      },
    ],
  },
  {
    title: '🈶 Tiếng Trung',
    color: 'from-red-500 to-rose-600',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    items: [
      {
        q: 'Tiếng Trung thi ở cấp độ nào?',
        a: 'Đề thi Tiếng Trung thường tương đương HSK 4–5. Gồm các phần: nghe hiểu (听力), đọc hiểu (阅读), ngữ pháp (语法) và viết (写作). Riêng phần Tiếng Trung Tự Nhiên yêu cầu thêm từ vựng khoa học chuyên ngành.',
      },
      {
        q: 'Cần học bao nhiêu từ vựng?',
        a: 'Khoảng 2,500–3,000 từ vựng cơ bản + 500–800 từ chuyên ngành theo môn (Toán, Lý, Hóa). CSCA cung cấp danh sách từ vựng phân loại theo môn học tại mục Từ Vựng trên website này.',
      },
      {
        q: 'Tiếng Trung Tự Nhiên và Xã Hội khác nhau như thế nào?',
        a: 'Tiếng Trung Tự Nhiên (TN) dành cho ngành KHTN/Kỹ thuật – có thêm từ vựng khoa học kỹ thuật, phương trình hóa học bằng tiếng Trung. Tiếng Trung Xã Hội (XH) dành cho ngành KHXH/Kinh tế – tập trung từ vựng kinh doanh, văn hóa xã hội.',
      },
    ],
  },
  {
    title: '📅 Kế hoạch & Chiến lược ôn thi',
    color: 'from-green-500 to-teal-600',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
    items: [
      {
        q: 'Cần bao nhiêu thời gian để ôn thi?',
        a: 'Tối thiểu 3–6 tháng nếu có nền tảng Toán Lý Hóa. Nếu tiếng Trung từ đầu cần 6–12 tháng. Lý tưởng nhất: 12 tháng, tập trung tiếng Trung 4h/ngày + ôn Toán Lý Hóa 2h/ngày.',
      },
      {
        q: 'Chiến lược phân bổ thời gian thế nào?',
        a: 'Gợi ý: Tiếng Trung 40% (quan trọng nhất, khó), Toán 25%, Vật Lý 20%, Hóa Học 15%. Làm đề mô phỏng ít nhất 2 lần/tuần, đặc biệt 2 tháng cuối trước thi. Dùng tính năng AI Lộ Trình để nhận kế hoạch cá nhân hóa.',
      },
      {
        q: 'Điểm mạnh yếu cần chú ý?',
        a: 'Học sinh Việt Nam thường mạnh Toán, trung bình Lý Hóa, yếu Tiếng Trung. Đây là lý do nên đầu tư nhiều thời gian nhất vào Tiếng Trung. Đừng bỏ qua Hóa vì nhiều bạn bị thiếu điểm ở môn này.',
      },
      {
        q: 'Có cần ôn luyện essay/tự luận không?',
        a: 'Một số trường yêu cầu thêm bài viết tự luận (作文) trong phần Tiếng Trung. Nhìn chung đề thi chủ yếu là trắc nghiệm (多选题/单选题). Hãy tham khảo cấu trúc đề của trường mình nhắm tới.',
      },
    ],
  },
  {
    title: '🏫 Thủ tục hồ sơ & Lưu ý khác',
    color: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
    items: [
      {
        q: 'Hồ sơ cần chuẩn bị gồm những gì?',
        a: 'Thông thường: Hộ chiếu còn hạn, Học bạ THPT (có công chứng, dịch thuật), Bằng tốt nghiệp (hoặc giấy chứng nhận), Thư giới thiệu của trường, Bản sao thành tích học tập, Giấy khám sức khỏe quốc tế, Ảnh hộ chiếu. Yêu cầu có thể khác nhau tùy trường.',
      },
      {
        q: 'Nên chọn trường nào tại Trung Quốc?',
        a: 'Top trường nhận học bổng CSCA: Đại học Bắc Kinh, Thanh Hoa, Phúc Đán, Giao Thông (Thượng Hải), Vũ Hán, Trung Sơn, Hà Hải (Thủy lợi). Nên chọn theo ngành muốn học và mức điểm thực tế của bạn.',
      },
    ],
  },
];

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-start justify-between gap-3 py-4 text-left hover:text-indigo-700 transition-colors group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 leading-snug">{q}</span>
        {open
          ? <FiChevronUp className="shrink-0 text-indigo-500 mt-0.5" size={16} />
          : <FiChevronDown className="shrink-0 text-gray-400 mt-0.5" size={16} />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-600 leading-relaxed pl-1">{a}</p>
      )}
    </div>
  );
}

// ── Quick Links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { icon: '📝', label: 'Đề mô phỏng', href: '/de-mo-phong', desc: 'Luyện thi ngay' },
  { icon: '📖', label: 'Từ vựng', href: '/tu-vung', desc: 'Học từ vựng' },
  { icon: '📋', label: 'Cấu trúc đề', href: '/cau-truc-de', desc: 'Xem tài liệu' },
  { icon: '🤖', label: 'Lộ trình AI', href: '/lo-trinh', desc: 'Kế hoạch cá nhân' },
  { icon: '💬', label: 'Diễn đàn', href: '/forum', desc: 'Hỏi đáp cộng đồng' },
  { icon: '🏆', label: 'BXH', href: '/bang-xep-hang', desc: 'Top học viên' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TuVanPage() {
  const [activeSection, setActiveSection] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-indigo-50">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-6 space-y-6">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                  <span className="text-3xl">🔮</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">Tư Vấn Học Bổng CSCA</h1>
                  <p className="text-purple-100 text-sm mt-1">
                    Hỏi đáp · Chiến lược · Kinh nghiệm thi
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <FiTarget className="text-indigo-500" /> Tài nguyên nhanh
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all text-center group"
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <span className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700">{link.label}</span>
                    <span className="text-[10px] text-gray-400">{link.desc}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
              <FiAlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Lưu ý:</strong> Thông tin tư vấn mang tính tham khảo. Hãy luôn kiểm tra lại thông tin chính thức tại website Đại sứ quán Trung Quốc tại Việt Nam hoặc liên hệ trực tiếp trường đăng ký.
              </p>
            </div>

            {/* FAQ Sections */}
            {FAQ_SECTIONS.map((section, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className={`w-full flex items-center justify-between p-5 text-left transition-colors ${
                    activeSection === idx ? section.bgLight : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveSection(activeSection === idx ? null : idx)}
                >
                  <h2 className="text-base font-bold text-gray-900">{section.title}</h2>
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-r ${section.color} flex items-center justify-center shrink-0`}>
                    {activeSection === idx
                      ? <FiChevronUp className="text-white" size={14} />
                      : <FiChevronDown className="text-white" size={14} />}
                  </div>
                </button>

                {activeSection === idx && (
                  <div className="px-5 pb-2 divide-y divide-gray-50">
                    {section.items.map((item, i) => (
                      <FaqItem key={i} q={item.q} a={item.a} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Call to action */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-center text-white shadow-lg">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-lg font-bold mb-2">Câu hỏi khác?</h3>
              <p className="text-indigo-100 text-sm mb-4">
                Hỏi cộng đồng học viên CSCA trên diễn đàn — có hơn 10,000 học viên sẵn sàng hỗ trợ bạn!
              </p>
              <Link
                href="/forum"
                className="inline-block px-6 py-2.5 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow"
              >
                Vào Diễn Đàn →
              </Link>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3">
            <RightSidebar />
          </div>
        </div>
      </main>
    </div>
  );
}
