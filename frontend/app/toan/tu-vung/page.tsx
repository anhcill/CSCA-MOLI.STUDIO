import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';

export default function ToanTuVungPage() {
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
                        {/* Page Title */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                                Từ Vựng 🔮
                            </h1>
                            <p className="text-gray-600">Học từ vựng chuyên ngành quan trọng</p>
                        </div>

                        {/* Content */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <div className="text-center py-20">
                                <div className="text-6xl mb-4">📝</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Nội dung đang được cập nhật</h3>
                                <p className="text-gray-600">Danh sách từ vựng sẽ sớm được bổ sung</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
