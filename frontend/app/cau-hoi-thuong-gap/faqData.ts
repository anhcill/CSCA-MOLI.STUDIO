export interface FAQItem {
  q: string;
  a: string | string[];
}

export interface FAQCategory {
  category: string;
  emoji: string;
  items: FAQItem[];
}

export const FAQ_DATA: FAQCategory[] = [
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
        a: 'Có. Nếu dịch vụ không đúng như mô tả hoặc bạn hủy trong vòng 7 ngày đầu tiên, vui lòng liên hệ support@moly-studio.io.vn để yêu cầu hoàn tiền.',
      },
    ],
  },
  {
    category: 'Kỹ thuật & Hỗ trợ',
    emoji: '🔧',
    items: [
      {
        q: 'Website không tải được hoặc bị lỗi, tôi phải làm gì?',
        a: 'Thử các bước sau: (1) Tải lại trang (F5 hoặc Ctrl+R), (2) Xóa cache trình duyệt, (3) Thử trình duyệt khác (Chrome, Firefox, Edge). Nếu vẫn lỗi, liên hệ support@moly-studio.io.vn kèm ảnh chụp màn hình lỗi.',
      },
      {
        q: 'Làm sao để liên hệ với CSCA?',
        a: [
          'Email: support@moly-studio.io.vn',
          'Điện thoại: 0812 352 005',
          'Zalo: 0812 352 005',
          'Facebook: fb.com/molistudio',
        ],
      },
      {
        q: 'Nền tảng CSCA có hỗ trợ trên điện thoại không?',
        a: 'Có. Website CSCA được thiết kế responsive, tương thích tốt trên cả máy tính, máy tính bảng và điện thoại di động.',
      },
    ],
  },
];
