import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Hướng dẫn xoá dữ liệu | Moli Studio',
  description: 'Hướng dẫn yêu cầu xoá dữ liệu cá nhân trên hệ thống Moli Studio.',
};

export default function DeleteDataPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          <h1 className="text-3xl font-black text-gray-900 mb-6">Yêu Cầu Xoá Dữ Liệu Cá Nhân</h1>
          
          <div className="prose prose-indigo max-w-none text-gray-600 space-y-6">
            <p>
              Tại Moli Studio, chúng tôi luôn tôn trọng quyền riêng tư và bảo mật dữ liệu cá nhân của bạn. Nếu bạn muốn xoá tài khoản và toàn bộ dữ liệu liên quan khỏi hệ thống của chúng tôi (bao gồm lịch sử làm bài, điểm số, và thông tin cá nhân), vui lòng thực hiện theo các bước dưới đây.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Cách 1: Xoá tài khoản trực tiếp trên ứng dụng/website</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Đăng nhập vào tài khoản của bạn trên website Moli Studio.</li>
              <li>Truy cập vào trang <strong>Hồ sơ cá nhân (Profile)</strong>.</li>
              <li>Di chuyển xuống phần <strong>Cài đặt tài khoản</strong>.</li>
              <li>Chọn <strong>Xoá tài khoản</strong> và xác nhận hành động. Hệ thống sẽ tự động xoá toàn bộ dữ liệu của bạn ngay lập tức.</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Cách 2: Gửi yêu cầu qua Email</h2>
            <p>
              Nếu bạn không thể đăng nhập hoặc muốn chúng tôi hỗ trợ xoá dữ liệu thủ công, vui lòng gửi email yêu cầu tới bộ phận hỗ trợ:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 my-4">
              <p className="mb-1"><strong>Email nhận:</strong> contact.molistudio@gmail.com</p>
              <p className="mb-1"><strong>Tiêu đề email:</strong> Yêu cầu xoá dữ liệu tài khoản - [Tên đăng nhập / Email của bạn]</p>
              <p><strong>Nội dung:</strong> Ghi rõ email bạn đã dùng để đăng ký tài khoản cần xoá.</p>
            </div>
            <p>
              <em>Lưu ý: Chúng tôi có thể yêu cầu bạn cung cấp một số thông tin cơ bản để xác minh bạn là chủ sở hữu của tài khoản trước khi tiến hành xoá dữ liệu. Thời gian xử lý thường diễn ra trong vòng 3-5 ngày làm việc.</em>
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Dữ liệu nào sẽ bị xoá?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Thông tin tài khoản (Tên đăng nhập, Email, Mật khẩu mã hoá).</li>
              <li>Toàn bộ lịch sử làm bài thi, điểm số, và thống kê tiến độ học tập.</li>
              <li>Dữ liệu liên kết với tài khoản Google (nếu bạn đăng nhập bằng Google).</li>
              <li>Các chứng chỉ và thành tích đã đạt được trên nền tảng.</li>
            </ul>
            
            <p className="mt-8 text-sm text-gray-500 italic">
              Nếu có bất kỳ thắc mắc nào khác về quyền riêng tư và dữ liệu cá nhân, vui lòng liên hệ với chúng tôi để được giải đáp.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
