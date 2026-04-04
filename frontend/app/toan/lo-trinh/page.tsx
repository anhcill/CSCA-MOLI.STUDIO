'use client';

import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import { AIInsights } from '@/components/ai/AIInsights';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';

export default function ToanLoTrinhPage() {
    const { isAuthenticated } = useAuthStore();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
            <Header />

            <main className="container mx-auto px-6 py-8 max-w-[1600px]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Subject Navigation Sidebar */}
                    <div className="lg:col-span-3">
                        <SubjectNavigation
                            subject="Toán"
                            subjectCode="MATH"
                            colorScheme={{
                                from: 'from-purple-500',
                                via: 'via-pink-500',
                                to: 'to-blue-500'
                            }}
                        />
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-9 space-y-8">
                        {/* Page Header */}
                        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <span className="text-3xl">🤖</span>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight">
                                        Lộ Trình Toán Cá Nhân
                                    </h1>
                                    <p className="text-purple-100 text-sm mt-1">
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
                                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="text-4xl">🔒</span>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-3">
                                    Đăng nhập để xem Lộ Trình
                                </h2>
                                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                    AI sẽ phân tích kết quả thi Toán của bạn và tạo lộ trình học tập cá nhân hóa.
                                </p>
                                <Link
                                    href="/login"
                                    className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
                                >
                                    Đăng nhập ngay
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
