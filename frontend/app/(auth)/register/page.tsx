import RegisterForm from '@/components/auth/RegisterForm';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex items-center justify-between gap-12">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col flex-1 space-y-6">
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
            <h1 className="text-5xl font-bold text-gray-900 leading-tight">
              Bắt đầu hành trình<br />
              <span className="text-indigo-600">học tập ngay!</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Tham gia cùng hàng nghìn học viên đang luyện tập cho kỳ thi CSCA.
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Bạn sẽ nhận được:</h3>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-700">Truy cập <span className="font-semibold">miễn phí</span> tất cả đề thi</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-700">Chấm điểm <span className="font-semibold">tự động</span> và giải thích chi tiết</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-700">Theo dõi <span className="font-semibold">tiến độ</span> học tập cá nhân</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-700">Tham gia <span className="font-semibold">cộng đồng</span> học tập sôi động</p>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
            <p className="text-gray-700 italic mb-3">
              "Website rất hữu ích! Giúp mình luyện tập và cải thiện điểm số rất nhiều. Cảm ơn CSCA!"
            </p>
            <p className="text-sm font-semibold text-gray-900">- Khánh Ly, Học viên</p>
          </div>
        </div>

        {/* Right Side - Register Form */}
        <div className="flex-1 max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
