import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left Side - Branding - Hidden on mobile */}
        <div className="hidden xl:flex flex-col flex-1 space-y-6 max-w-lg">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-[0_10px_22px_rgba(14,116,244,0.35)] group-hover:scale-110 transition-transform">
              <span className="text-white font-black text-2xl lowercase">m</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-100 border border-white"></span>
            </div>
            <span className="text-3xl font-black lowercase bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 bg-clip-text text-transparent">moly.study</span>
          </Link>

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-bold text-gray-900 leading-tight">
              Chinh phục<br />
              <span className="text-indigo-600">Kỳ thi CSCA</span>
            </h1>
            <p className="text-lg xl:text-xl text-gray-600 leading-relaxed">
              Nền tảng luyện thi đầu vào học bổng Trung Quốc với đầy đủ tài liệu, đề thi và thống kê chi tiết.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">10+ Đề thi thử</h3>
                <p className="text-gray-600">Cập nhật liên tục theo cấu trúc đề thi thật</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Thống kê chi tiết</h3>
                <p className="text-gray-600">Phân tích điểm mạnh, điểm yếu theo từng môn</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cộng đồng học tập</h3>
                <p className="text-gray-600">Chia sẻ kinh nghiệm, giải đáp thắc mắc</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 pt-6">
            <div>
              <div className="text-3xl font-bold text-indigo-600">1000+</div>
              <div className="text-sm text-gray-600">Học viên</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-indigo-600">5000+</div>
              <div className="text-sm text-gray-600">Câu hỏi</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-indigo-600">95%</div>
              <div className="text-sm text-gray-600">Hài lòng</div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
