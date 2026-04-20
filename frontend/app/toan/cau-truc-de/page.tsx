import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import CauTrucDe from '@/components/toan/CauTrucDe';

export default function ToanCauTrucDePage() {
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
                            subjectSlug="toan"
                            colorScheme={{
                                from: 'from-purple-500',
                                to: 'to-blue-500'
                            }}
                        />
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-9 space-y-8">
                        {/* Page Title */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                                Cấu Trúc Đề 📚
                            </h1>
                            <p className="text-gray-600">Tìm hiểu cấu trúc và format đề thi</p>
                        </div>

                        {/* Content */}
                        <CauTrucDe />
                    </div>
                </div>
            </main>
        </div>
    );
}
