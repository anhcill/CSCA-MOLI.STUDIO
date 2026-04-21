'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import { FiShield, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900">{title}</span>
        {open ? <FiChevronUp className="text-gray-400 shrink-0" size={16} /> : <FiChevronDown className="text-gray-400 shrink-0" size={16} />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 bg-white text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>}
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <FiCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
            <FiShield className="text-indigo-600" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Chính sách bảo mật</h1>
            <p className="text-sm text-gray-500 mt-1">Cập nhật lần cuối: Tháng 4 năm 2026</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 mb-8">
          <p className="text-sm text-gray-700">
            CSCA cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin khi bạn sử dụng nền tảng luyện thi CSCA.
          </p>
        </div>

        <Section title="1. Thông tin chúng tôi thu thập">
          <p>Chúng tôi thu thập các thông tin sau để vận hành và cải thiện dịch vụ:</p>
          <Bullet text="Họ và tên, địa chỉ email, số điện thoại khi đăng ký tài khoản" />
          <Bullet text="Kết quả học tập, lịch sử thi, và tiến độ luyện tập" />
          <Bullet text="Địa chỉ IP, loại thiết bị, và trình duyệt để phân tích trải nghiệm người dùng" />
          <Bullet text="Cookie và dữ liệu phiên để xác thực và ghi nhớ preferences" />
        </Section>

        <Section title="2. Mục đích sử dụng dữ liệu">
          <p>Dữ liệu của bạn được sử dụng cho các mục đích sau:</p>
          <Bullet text="Cung cấp và duy trì tài khoản người dùng" />
          <Bullet text="Theo dõi tiến độ học tập và cung cấp gợi ý cá nhân hóa" />
          <Bullet text="Gửi thông báo về khóa học, kết quả thi, và cập nhật tài liệu mới" />
          <Bullet text="Hỗ trợ kỹ thuật và giải đáp thắc mắc của học viên" />
          <Bullet text="Phân tích dữ liệu ẩn danh để cải thiện chất lượng nền tảng" />
        </Section>

        <Section title="3. Bảo vệ dữ liệu">
          <p>Chúng tôi áp dụng các biện pháp bảo mật sau:</p>
          <Bullet text="Mã hóa dữ liệu trong quá trình truyền tải (HTTPS/TLS)" />
          <Bullet text="Lưu trữ mật khẩu dưới dạng băm (hash) với thuật toán bcrypt" />
          <Bullet text="Hạn chế quyền truy cập dữ liệu chỉ cho nhân viên được ủy quyền" />
          <Bullet text="Sao lưu dữ liệu định kỳ và lưu trữ tại các trung tâm dữ liệu an toàn" />
        </Section>

        <Section title="4. Chia sẻ dữ liệu với bên thứ ba">
          <p>Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân của bạn với bên thứ ba cho mục đích tiếp thị. Dữ liệu có thể được chia sẻ trong các trường hợp:</p>
          <Bullet text="Khi được pháp luật yêu cầu hoặc theo lệnh của cơ quan có thẩm quyền" />
          <Bullet text="Với các đối tác cung cấp dịch vụ kỹ thuật (hosting, email) theo hợp đồng bảo mật" />
          <Bullet text="Để bảo vệ quyền và sự an toàn của CSCA hoặc người dùng" />
        </Section>

        <Section title="5. Quyền của người dùng">
          <p>Bạn có quyền thực hiện các thao tác sau với dữ liệu của mình:</p>
          <Bullet text="Truy cập và xem toàn bộ dữ liệu cá nhân đã đăng ký" />
          <Bullet text="Yêu cầu chỉnh sửa thông tin không chính xác" />
          <Bullet text="Yêu cầu xóa tài khoản và toàn bộ dữ liệu liên quan" />
          <Bullet text="Từ chối nhận email tiếp thị qua liên kết hủy đăng ký trong mỗi email" />
          <Bullet text="Xuất dữ liệu cá nhân dưới dạng file có thể đọc được" />
        </Section>

        <Section title="6. Cookie và công nghệ theo dõi">
          <p>
            CSCA sử dụng cookie để nâng cao trải nghiệm người dùng. Cookie giúp ghi nhớ đăng nhập, preferences, và phân tích lưu lượng truy cập. Bạn có thể từ chối cookie qua cài đặt trình duyệt, tuy nhiên một số chức năng có thể bị hạn chế.
          </p>
        </Section>

        <Section title="7. Thay đổi chính sách">
          <p>
            Chúng tôi có thể cập nhật Chính sách bảo mật này theo thời gian. Mọi thay đổi quan trọng sẽ được thông báo qua email hoặc thông báo trên nền tảng trước khi có hiệu lực. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
          </p>
        </Section>

        <Section title="8. Liên hệ">
          <p>
            Nếu bạn có bất kỳ câu hỏi nào về Chính sách bảo mật, vui lòng liên hệ:
          </p>
          <Bullet text="Email: support@csca.edu.vn" />
          <Bullet text="Điện thoại: 0812 352 005" />
          <Bullet text="Địa chỉ: Hà Nội, Việt Nam" />
        </Section>
      </main>
    </div>
  );
}
