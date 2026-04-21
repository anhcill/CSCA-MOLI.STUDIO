'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import { FiFileText, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';

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
      <FiCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
            <FiFileText className="text-blue-600" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Điều khoản sử dụng</h1>
            <p className="text-sm text-gray-500 mt-1">Cập nhật lần cuối: Tháng 4 năm 2026</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 mb-8">
          <p className="text-sm text-gray-700">
            Chào mừng bạn đến với nền tảng luyện thi CSCA. Khi sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các Điều khoản sử dụng dưới đây. Vui lòng đọc kỹ trước khi đăng ký và sử dụng.
          </p>
        </div>

        <Section title="1. Chấp nhận điều khoản">
          <p>Bằng việc đăng ký tài khoản và sử dụng nền tảng CSCA, bạn xác nhận rằng:</p>
          <Bullet text="Bạn đã đủ 16 tuổi hoặc được sự đồng ý của cha mẹ/người giám hộ" />
          <Bullet text="Bạn có năng lực pháp lý để tham gia các giao dịch ràng buộc" />
          <Bullet text="Mọi thông tin đăng ký là trung thực, chính xác và cập nhật" />
          <Bullet text="Bạn đồng ý với toàn bộ nội dung Điều khoản sử dụng này" />
        </Section>

        <Section title="2. Mô tả dịch vụ">
          <p>CSCA cung cấp nền tảng luyện thi trực tuyến bao gồm:</p>
          <Bullet text="Hệ thống thi thử và đề thi mô phỏng các kỳ thi học bổng" />
          <Bullet text="Tài liệu học tập, lý thuyết, và cấu trúc đề thi" />
          <Bullet text="Theo dõi tiến độ và phân tích kết quả học tập cá nhân" />
          <Bullet text="Diễn đàn thảo luận và cộng đồng học viên" />
          <p className="pt-1">Chúng tôi bảo lưu quyền thay đổi, tạm ngưng hoặc ngừng cung cấp bất kỳ phần nào của dịch vụ mà không cần thông báo trước.</p>
        </Section>

        <Section title="3. Tài khoản người dùng">
          <p>Khi tạo tài khoản, bạn cam kết:</p>
          <Bullet text="Không sử dụng tên đăng nhập vi phạm quyền sở hữu trí tuệ hoặc gây nhầm lẫn" />
          <Bullet text="Bảo mật thông tin đăng nhập và chịu trách nhiệm về mọi hoạt động dưới tài khoản của mình" />
          <Bullet text="Thông báo ngay cho chúng tôi qua support@csca.edu.vn nếu phát hiện truy cập trái phép" />
          <Bullet text="Không chia sẻ, chuyển nhượng hoặc cho người khác sử dụng tài khoản của bạn" />
          <p className="pt-1">Chúng tôi có quyền tạm khóa hoặc xóa tài khoản vi phạm điều khoản mà không cần bồi thường.</p>
        </Section>

        <Section title="4. Quyền sở hữu trí tuệ">
          <p>
            Toàn bộ nội dung trên nền tảng CSCA, bao gồm nhưng không giới hạn ở: văn bản, đề thi, đáp án, hình ảnh, video, thiết kế, và phần mềm, đều thuộc quyền sở hữu của CSCA hoặc các bên cấp phép.
          </p>
          <p className="pt-2">Bạn được quyền sử dụng tài liệu học tập trên nền tảng cho mục đích cá nhân, phi thương mại. Nghiêm cấm:</p>
          <Bullet text="Sao chép, phân phối, hoặc bán nội dung CSCA cho mục đích thương mại" />
          <Bullet text="Đăng tải đề thi hoặc đáp án lên các trang web bên ngoài" />
          <Bullet text="Sử dụng công cụ tự động (bot, scraper) để khai thác dữ liệu" />
          <Bullet text="Can thiệp, thay đổi hoặc hack bất kỳ phần nào của nền tảng" />
        </Section>

        <Section title="5. Hành vi người dùng">
          <p>Bạn đồng ý không thực hiện các hành vi sau:</p>
          <Bullet text="Đăng tải nội dung vi phạm pháp luật, đạo đức, hoặc thuần phong mỹ tục Việt Nam" />
          <Bullet text="Quấy rối, lăng mạ, hoặc xâm phạm quyền riêng tư của người khác" />
          <Bullet text="Tạo tài khoản giả mạo hoặc mạo danh cá nhân, tổ chức khác" />
          <Bullet text="Gửi thư rác, phần mềm độc hại, hoặc nội dung chứa virus" />
          <Bullet text="Sử dụng nền tảng cho mục đích phi pháp hoặc lừa đảo" />
        </Section>

        <Section title="6. Thanh toán và hoàn tiền">
          <p>
            Các gói dịch vụ trả phí (nếu có) sẽ được thông báo rõ ràng về giá cả và nội dung trước khi thanh toán. Chính sách hoàn tiền áp dụng trong vòng 7 ngày kể từ ngày thanh toán nếu dịch vụ không đúng như mô tả. Liên hệ support@csca.edu.vn để yêu cầu hoàn tiền.
          </p>
        </Section>

        <Section title="7. Giới hạn trách nhiệm">
          <p>
            CSCA cố gắng đảm bảo nội dung thi và tài liệu chính xác, tuy nhiên chúng tôi không tuyên bố đề thi trên nền tảng sẽ trùng khớp 100% với đề thi thực tế. Kết quả thi thử chỉ mang tính chất tham khảo.
          </p>
          <p className="pt-2">
            CSCA không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ, bao gồm nhưng không giới hạn ở thiệt hại gián tiếp, đặc biệt là việc không đạt học bổng dù đã luyện tập trên nền tảng.
          </p>
        </Section>

        <Section title="8. Thay đổi điều khoản">
          <p>
            Chúng tôi bảo lưu quyền thay đổi Điều khoản sử dụng này bất cứ lúc nào. Các thay đổi sẽ có hiệu lực ngay khi được đăng tải trên trang này. Nếu thay đổi quan trọng, chúng tôi sẽ thông báo qua email hoặc thông báo trên nền tảng. Việc tiếp tục sử dụng sau khi thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
          </p>
        </Section>

        <Section title="9. Luật áp dụng và giải quyết tranh chấp">
          <p>
            Điều khoản sử dụng này được giải thích và điều chỉnh theo pháp luật nước CHXHCN Việt Nam. Mọi tranh chấp phát sinh từ việc sử dụng dịch vụ CSCA sẽ được giải quyết thông qua thương lượng trước. Nếu không thể giải quyết bằng thương lượng, tranh chấp sẽ được đưa ra Tòa án nhân dân có thẩm quyền tại Hà Nội.
          </p>
        </Section>

        <Section title="10. Liên hệ">
          <p>Mọi thắc mắc về Điều khoản sử dụng, vui lòng liên hệ:</p>
          <Bullet text="Email: support@csca.edu.vn" />
          <Bullet text="Điện thoại: 0812 352 005" />
          <Bullet text="Địa chỉ: Hà Nội, Việt Nam" />
        </Section>
      </main>
    </div>
  );
}
