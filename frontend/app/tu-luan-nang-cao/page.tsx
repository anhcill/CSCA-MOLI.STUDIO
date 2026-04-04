import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

export default function TuLuanNangCaoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50">
      <Header />
      
      <main className="container mx-auto px-6 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-6">
            <div className="text-center py-20">
              <div className="text-8xl mb-6">📈</div>
              <h1 className="text-5xl font-black bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 bg-clip-text text-transparent mb-4">
                Tự Luận Nâng Cao
              </h1>
              <p className="text-gray-500 text-xl mb-8">
                Chức năng đang được phát triển
              </p>
              <div className="inline-block px-8 py-4 bg-gradient-to-r from-red-100 to-orange-100 rounded-2xl">
                <p className="text-gray-700 font-semibold">🚀 Coming Soon...</p>
              </div>
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
