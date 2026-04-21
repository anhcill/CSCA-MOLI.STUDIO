'use client';

import { useState } from 'react';
import { FiX, FiFileText, FiShield, FiCheck } from 'react-icons/fi';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'terms' | 'privacy';
}

export default function TermsModal({ isOpen, onClose, type = 'terms' }: TermsModalProps) {
  if (!isOpen) return null;

  const isTerms = type === 'terms';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTerms ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isTerms ? <FiFileText size={20} /> : <FiShield size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isTerms ? 'Điều khoản sử dụng' : 'Chính sách bảo mật'}
              </h2>
              <p className="text-xs text-gray-500">Cập nhật lần cuối: Tháng 4/2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <FiCheck size={16} />
            Tôi đã đọc và đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">1. Chấp nhận điều khoản</h3>
        <p>
          Bằng việc truy cập và sử dụng website moly.study (sau đây gọi là &ldquo;Website&rdquo;), bạn đồng ý tuân thủ và bị ràng buộc bởi các Điều khoản sử dụng này. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng không sử dụng Website.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">2. Mô tả dịch vụ</h3>
        <p>
          Website cung cấp nền tảng luyện thi đầu vào học bổng Trung Quốc (CSCA), bao gồm:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Tài liệu học tập các môn Toán, Lý, Hóa, Tiếng Trung</li>
          <li>Đề thi thử và đề thi mô phỏng</li>
          <li>Công cụ thống kê và theo dõi tiến độ học tập</li>
          <li>Cộng đồng học tập và diễn đàn</li>
          <li>Các khóa học VIP có phí</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">3. Tài khoản người dùng</h3>
        <p className="mb-2">Khi đăng ký tài khoản, bạn cam kết:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cung cấp thông tin chính xác, đầy đủ và cập nhật</li>
          <li>Bảo mật thông tin đăng nhập (email và mật khẩu)</li>
          <li>Chịu trách nhiệm hoàn toàn về mọi hoạt động diễn ra dưới tài khoản của mình</li>
          <li>Thông báo ngay cho chúng tôi khi phát hiện truy cập trái phép</li>
          <li>Không chia sẻ tài khoản với người khác</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">4. Quy định sử dụng</h3>
        <p className="mb-2">Bạn đồng ý KHÔNG thực hiện các hành vi sau:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sử dụng Website cho mục đích bất hợp pháp hoặc vi phạm pháp luật</li>
          <li>Cố gắng truy cập trái phép vào hệ thống, tài khoản người khác</li>
          <li>Can thiệp, phá hoại hoặc làm gián đoạn hoạt động của Website</li>
          <li>Copy, sao chép, phân phối nội dung khi chưa được phép</li>
          <li>Sử dụng bot, script tự động để truy cập hoặc khai thác dữ liệu</li>
          <li>Đăng tải nội dung vi phạm thuần phong mỹ tục, phản động, khiêu dâm</li>
          <li>Xâm phạm quyền sở hữu trí tuệ của người khác</li>
          <li>Spam, quấy rối hoặc có hành vi gây khó chịu cho người dùng khác</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">5. Sở hữu trí tuệ</h3>
        <p>
          Tất cả nội dung trên Website (bài giảng, đề thi, tài liệu, hình ảnh, logo, phần mềm) thuộc quyền sở hữu của moly.study hoặc được cấp phép hợp lệ. Bạn không được phép sao chép, sửa đổi, phân phối hoặc sử dụng cho mục đích thương mại khi chưa có sự đồng ý bằng văn bản.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">6. Thanh toán và hoàn tiền</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Các gói VIP có phí sẽ được thanh toán trước khi kích hoạt</li>
          <li>Hoàn tiền được xử lý trong vòng 7 ngày nếu dịch vụ không đúng như mô tả</li>
          <li>Chúng tôi không hoàn tiền cho các gói đã sử dụng trên 50% thời gian</li>
          <li>Thanh toán được xử lý qua cổng thanh toán bên thứ ba (VNPay, MoMo, ZaloPay)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">7. Miễn trừ trách nhiệm</h3>
        <p>
          Website được cung cấp &ldquo;nguyên trạng&rdquo; và &ldquo;theo hiện có&rdquo;. Chúng tôi không đảm bảo Website sẽ luôn hoạt động không gián đoạn, không lỗi hoặc an toàn tuyệt đối. Chúng tôi không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc sử dụng hoặc không thể sử dụng Website.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">8. Chấm dứt dịch vụ</h3>
        <p>
          Chúng tôi có quyền chấm dứt hoặc tạm ngưng tài khoản của bạn ngay lập tức nếu vi phạm Điều khoản sử dụng hoặc phát hiện hành vi gian lận, lạm dụng hệ thống. Quyết định của chúng tôi là cuối cùng trong các trường hợp này.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">9. Sửa đổi điều khoản</h3>
        <p>
          Chúng tôi có quyền thay đổi Điều khoản sử dụng bất cứ lúc nào. Thay đổi sẽ có hiệu lực ngay khi được đăng tải trên Website. Việc tiếp tục sử dụng Website sau khi thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">10. Luật áp dụng</h3>
        <p>
          Điều khoản sử dụng này được điều chỉnh bởi luật pháp Việt Nam. Mọi tranh chấp phát sinh sẽ được giải quyết tại tòa án có thẩm quyền tại Việt Nam.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-2">11. Liên hệ</h3>
        <p>
          Nếu có câu hỏi về Điều khoản sử dụng, vui lòng liên hệ qua email: <span className="text-indigo-600">support@moly.study</span>
        </p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">1. Thu thập thông tin</h3>
        <p className="mb-2">Chúng tôi thu thập các thông tin sau:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Thông tin đăng ký:</strong> Tên đăng nhập, email, họ và tên, mật khẩu (được mã hóa)</li>
          <li><strong>Thông tin thanh toán:</strong> Qua cổng thanh toán bên thứ ba, chúng tôi không lưu trữ số thẻ</li>
          <li><strong>Dữ liệu sử dụng:</strong> Lịch sử thi, điểm số, tiến độ học tập, hoạt động trên Website</li>
          <li><strong>Thông tin thiết bị:</strong> Địa chỉ IP, loại trình duyệt, hệ điều hành</li>
          <li><strong>Cookie:</strong> Để duy trì phiên đăng nhập và cải thiện trải nghiệm</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">2. Mục đích sử dụng</h3>
        <p className="mb-2">Thông tin được thu thập nhằm các mục đích:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tạo và quản lý tài khoản người dùng</li>
          <li>Cung cấp dịch vụ luyện thi và theo dõi tiến độ</li>
          <li>Cải thiện chất lượng Website và trải nghiệm người dùng</li>
          <li>Gửi thông báo về tài khoản, đơn hàng, cập nhật dịch vụ</li>
          <li>Hỗ trợ khách hàng và giải đáp thắc mắc</li>
          <li>Phát hiện và ngăn chặn truy cập trái phép, gian lận</li>
          <li>Tuân thủ nghĩa vụ pháp lý</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">3. Chia sẻ thông tin</h3>
        <p className="mb-2">Chúng tôi KHÔNG bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Cổng thanh toán:</strong> Khi thanh toán VIP, thông tin được chia sẻ với VNPay/MoMo/ZaloPay để xử lý giao dịch</li>
          <li><strong>Google OAuth:</strong> Khi đăng nhập bằng Google, email và tên được lấy từ Google</li>
          <li><strong>Yêu cầu pháp lý:</strong> Khi được yêu cầu bởi cơ quan có thẩm quyền</li>
          <li><strong>Dịch vụ hỗ trợ:</strong> Với các nhà cung cấp hỗ trợ vận hành Website (theo hợp đồng bảo mật)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">4. Bảo mật dữ liệu</h3>
        <p className="mb-2">Chúng tôi áp dụng các biện pháp bảo mật:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Mật khẩu được băm (hash) bằng thuật toán bcrypt</li>
          <li>Sử dụng HTTPS (SSL/TLS) cho mọi kết nối</li>
          <li>Lưu trữ dữ liệu trên máy chủ có biện pháp vật lý và logic bảo mật</li>
          <li>Giới hạn quyền truy cập dữ liệu trong nội bộ</li>
          <li>Token xác thực (JWT) với thời hạn ngắn, có cơ chế refresh</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">5. Quyền của người dùng</h3>
        <p className="mb-2">Bạn có các quyền sau đối với dữ liệu cá nhân:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Truy cập:</strong> Xem thông tin cá nhân đã đăng ký</li>
          <li><strong>Chỉnh sửa:</strong> Cập nhật thông tin tài khoản bất kỳ lúc nào</li>
          <li><strong>Xóa:</strong> Yêu cầu xóa tài khoản và dữ liệu liên quan</li>
          <li><strong>Phản đối:</strong> Phản đối việc xử lý dữ liệu cho mục đích marketing</li>
          <li><strong>Di chuyển:</strong> Yêu cầu xuất dữ liệu dưới định dạng phổ biến</li>
        </ul>
        <p className="mt-2">
          Để thực hiện các quyền trên, vui lòng gửi email đến <span className="text-indigo-600">support@moly.study</span> hoặc sử dụng tính năng trong trang &ldquo;Cài đặt tài khoản&rdquo;.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">6. Lưu trữ dữ liệu</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Thông tin tài khoản được lưu trữ cho đến khi bạn yêu cầu xóa</li>
          <li>Dữ liệu thi và lịch sử học tập được lưu trữ tối thiểu 2 năm</li>
          <li>Log truy cập (IP, thời gian) được lưu trữ tối đa 12 tháng</li>
          <li>Khi xóa tài khoản, dữ liệu sẽ bị xóa trong vòng 30 ngày</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">7. Cookie</h3>
        <p className="mb-2">Website sử dụng cookie để:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Cần thiết:</strong> Duy trì phiên đăng nhập, bảo mật</li>
          <li><strong>Phân tích:</strong> Hiểu cách người dùng sử dụng Website (Google Analytics)</li>
          <li><strong>Chức năng:</strong> Ghi nhớ tùy chọn người dùng (ngôn ngữ, giao diện)</li>
        </ul>
        <p className="mt-2">
          Bạn có thể tắt cookie trong cài đặt trình duyệt, tuy nhiên một số chức năng có thể bị hạn chế.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">8. Trẻ em</h3>
        <p>
          Website không dành cho trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập thông tin cá nhân của trẻ em. Nếu phát hiện dữ liệu trẻ em bị thu thập, chúng tôi sẽ xóa ngay lập tức.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">9. Thay đổi chính sách</h3>
        <p>
          Chính sách bảo mật có thể được cập nhật theo thời gian. Thay đổi sẽ được thông báo qua email hoặc đăng tải rõ ràng trên Website. Việc tiếp tục sử dụng sau thay đổi đồng nghĩa với việc chấp nhận chính sách mới.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-2">10. Liên hệ</h3>
        <p>
          Nếu có câu hỏi về Chính sách bảo mật, vui lòng liên hệ: <span className="text-indigo-600">support@moly.study</span>
        </p>
      </section>
    </div>
  );
}
