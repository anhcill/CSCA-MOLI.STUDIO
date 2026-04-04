import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import ExamList from '@/components/toan/ExamList';

export default function HoaDeMoPhongPage() {
    const subjectCode = 'CHEMISTRY';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-cyan-50">
            <Header />

            <main className="container mx-auto px-6 py-8 max-w-[1600px]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Main Content - Exam List (Left/Center) */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Page Title */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                                Đề Mô Phỏng 📝
                            </h1>
                            <p className="text-gray-600">Luyện tập với các đề thi Hóa học</p>
                        </div>

                        {/* Exam List */}
                        <ExamList subjectCode={subjectCode} />
                    </div>

                    {/* Subject Navigation Sidebar (Right) */}
                    <div className="lg:col-span-4">
                        <SubjectNavigation
                            subject="Hóa Học"
                            subjectCode="CHEMISTRY"
                            colorScheme={{
                                from: 'from-green-500',
                                via: 'via-teal-500',
                                to: 'to-cyan-500'
                            }}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
