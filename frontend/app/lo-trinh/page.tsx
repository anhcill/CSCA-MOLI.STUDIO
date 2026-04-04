'use client';

import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import { AIInsights } from '@/components/ai/AIInsights';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';

export default function LoTrinhPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-pink-50 to-rose-50">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-6 space-y-6">
            {/* Page Header */}
            <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-3xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">
                    Lộ Trình Học Cá Nhân
                  </h1>
                  <p className="text-pink-100 text-sm mt-1">
                    Phân tích bởi Gemini AI · Cập nhật mỗi 24 giờ
                  </p>
                </div>
              </div>
            </div>

            {/* AI Content */}
            {isAuthenticated ? (
              <AIInsights />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🔒</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Đăng nhập để xem Lộ Trình
                </h2>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  AI sẽ phân tích kết quả thi của bạn và tạo lộ trình học tập cá nhân hóa.
                </p>
                <Link
                  href="/login"
                  className="inline-block px-8 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold rounded-xl hover:from-pink-700 hover:to-rose-700 transition-all shadow-lg"
                >
                  Đăng nhập ngay
                </Link>
              </div>
            )}
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
