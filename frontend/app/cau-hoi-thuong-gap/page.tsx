'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import { FiHelpCircle, FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';

interface FAQItem {
  q: string;
  a: string | string[];
}

interface FAQCategory {
  category: string;
  emoji: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    category: 'Tài khoản & Đăng ký',
    emoji: '👤',
    items: [
      {
        q: 'Làm sao để đăng ký tài khoản CSCA?',
        a: 'Bạn truy cập trang /register, điền họ tên, email, số điện thoại và mật khẩu. Sau khi đăng ký thành công, bạn sẽ nhận được email xác nhận và có thể đăng nhập ngay.',
      },
      {
        q: 'Tôi quên mật khẩu thì phải làm sao?',
        a: 'Tại trang đăng nhập, nhấn "Quên mật khẩu", nhập email đã đăng ký. Chúng tôi sẽ gửi link đặt lại mật khẩu qua email của bạn trong vòng 5 phút.',
      },
      {
        q: 'Một email có thể đăng ký nhiều tài khoản không?',
        a: 'Không. Mỗi email chỉ được liên kết với một tài khoản CSCA để đảm bảo quản lý tiến độ học tập chính xác.',
      },
      {
        q: 'Tôi có thể thay đổi thông tin tài khoản không?',
        a: 'Có. Bạn truy cập trang Hồ sơ (Profile) sau khi đăng nhập để chỉnh sửa họ tên, số điện thoại và avatar.',
      },
    ],
  },
  {
    category: 'Khóa học & Thi thử',
    emoji: '📚',
    items: [
      {
        q: 'CSCA có những môn thi nào?',
        a: [
          'CSCA cung cấp luyện thi cho 5 môn: Toán, Vật Lý, Hóa Học, Tiếng Trung Xã hội, và Tiếng Trung Tự nhiên — phù hợp với các kỳ thi học bổng vào các trường đại học Trung Quốc.',
        ],
      },
      {
        q: 'Kết quả thi thử có chính xác không?',
        a: 'Đề thi trên CSCA được biên soạn dựa trên cấu trúc và format của đề thi thực tế. Tuy nhiên, đây là bài thi mô phỏng, kết quả chỉ mang tính tham khảo và không đảm bảo trùng khớp 100% với đề thi thật.',
      },
      {
        q: 'Tôi có thể thi lại nhiều lần không?',
        a: 'Có. Bạn có thể thi thử không giới hạn số lần. Mỗi lần thi đều được ghi nhận trong lịch sử để bạn theo dõi tiến bộ.',
      },
      {
        q: 'Thi thử có giới hạn thời gian không?',
        a: 'Có. Mỗi bài thi thử đều có thời gian giới hạn tương ứng với đề thi thực tế. Bạn nên làm bài trong điều kiện giống như thi thật để đạt hiệu quả luyện tập tốt nhất.',
      },
    ],
  },
  {
    category: 'Tài liệu & Tải về',
    emoji: '📥',
    items: [
      {
        q: 'Tôi có thể tải tài liệu PDF về máy không?',
        a: 'Có. Tại trang Lý thuyết hoặc Cấu trúc đề, nhấn nút "Tải về" trên mỗi tài liệu. File PDF sẽ được tải trực tiếp vào thiết bị của bạn.',
      },
      {
        q: 'Tài liệu có miễn phí không?',
        a: 'Phần lớn tài liệu cơ bản trên CSCA là miễn phí cho tất cả học viên. Một số tài liệu nâng cao hoặc khóa học đặc biệt có thể yêu cầu đăng ký gói VIP.',
      },
    ],
  },
  {
    category: 'Thanh toán & Gói dịch vụ',
    emoji: '💳',
    items: [
      {
        q: 'CSCA có những gói dịch vụ nào?',
        a: 'CSCA cung cấp gói miễn phí (Free) với các tính năng cơ bản, và gói VIP với đầy đủ tính năng bao gồm: tất cả đề thi, tài liệu nâng cao, phân tích chi tiết kết quả, và hỗ trợ ưu tiên.',
      },
      {
        q: 'Tôi thanh toán bằng cách nào?',
        a: 'Hiện tại CSCA hỗ trợ thanh toán qua chuyển khoản ngân hàng và ZaloPay. Thông tin chuyển khoản sẽ được hiển thị sau khi bạn chọn gói dịch vụ.',
      },
      {
        q: 'Tôi có được hoàn tiền không?',
        a: 'Có. Nếu dịch vụ không đúng như mô tả hoặc bạn hủy trong vòng 7 ngày đầu tiên, vui lòng liên hệ support@csca.edu.vn để yêu cầu hoàn tiền.',
      },
    ],
  },
  {
    category: 'Kỹ thuật & Hỗ trợ',
    emoji: '🔧',
    items: [
      {
        q: 'Website không tải được hoặc bị lỗi, tôi phải làm gì?',
        a: 'Thử các bước sau: (1) Tải lại trang (F5 hoặc Ctrl+R), (2) Xóa cache trình duyệt, (3) Thử trình duyệt khác (Chrome, Firefox, Edge). Nếu vẫn lỗi, liên hệ support@csca.edu.vn kèm ảnh chụp màn hình lỗi.',
      },
      {
        q: 'Làm sao để liên hệ với CSCA?',
        a: [
          'Email: support@csca.edu.vn',
          'Điện thoại: 0812 352 005',
          'Zalo: 0812 352 005',
          'Facebook: fb.com/csca.edu.vn',
        ],
      },
      {
        q: 'Nền tảng CSCA có hỗ trợ trên điện thoại không?',
        a: 'Có. Website CSCA được thiết kế responsive, tương thích tốt trên cả máy tính, máy tính bảng và điện thoại di động.',
      },
    ],
  },
];

export default function FAQPage() {
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = FAQ_DATA
    .map(cat => ({
      ...cat,
      items: cat.items.filter(
        item =>
          !search ||
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          (Array.isArray(item.a) ? item.a.join(' ').toLowerCase() : item.a.toLowerCase()).includes(search.toLowerCase()),
      ),
    }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <FiHelpCircle className="text-amber-600" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Câu hỏi thường gặp</h1>
            <p className="text-sm text-gray-500 mt-1">Giải đáp nhanh các thắc mắc phổ biến về CSCA</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
          />
        </div>

        {/* FAQ Categories */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500">Không tìm thấy câu hỏi phù hợp.</p>
            <p className="text-sm text-gray-400 mt-1">Thử từ khóa khác hoặc liên hệ support@csca.edu.vn</p>
          </div>
        ) : (
          filtered.map(cat => (
            <div key={cat.category} className="mb-8">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-3">
                <span>{cat.emoji}</span> {cat.category}
              </h2>
              {cat.items.map((item, idx) => {
                const key = `${cat.category}-${idx}`;
                const isOpen = openItems.has(key);
                return (
                  <div key={key} className="border border-gray-200 rounded-xl overflow-hidden mb-2 bg-white">
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-800 text-sm leading-snug">{item.q}</span>
                      <span className={`shrink-0 mt-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <FiChevronDown className="text-gray-400" size={16} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                        {Array.isArray(item.a) ? (
                          <ul className="space-y-1.5">
                            {item.a.map((line, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>{item.a}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Still have questions */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-6 text-center">
          <p className="text-gray-700 font-medium mb-1">Không tìm thấy câu trả lời?</p>
          <p className="text-sm text-gray-500 mb-4">Liên hệ với đội ngũ CSCA, chúng tôi sẵn sàng hỗ trợ bạn.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:support@csca.edu.vn"
              className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors">
              Email: support@csca.edu.vn
            </a>
            <a href="tel:+840812352005"
              className="px-5 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50 transition-colors">
              📞 0812 352 005
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
