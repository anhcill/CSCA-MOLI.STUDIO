import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import ExamList from '@/components/toan/ExamList';

export default function DeMoPhongPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
      <Header />
      
      <main className="container mx-auto px-6 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-6">
            <div className="mb-8 text-center">
              <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-3">
                Toán ✨
              </h1>
              <p className="text-gray-600 text-lg">
                Luyện tập và kiểm tra kiến thức Toán học
              </p>
            </div>
            
            <ExamList subjectCode="MATH" />
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
