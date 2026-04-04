import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import ExamList from '@/components/toan/ExamList';

export default function ToanDeMoPhongPage() {
    const subjectCode = 'MATH';

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />

            <main className="container mx-auto px-6 py-8 max-w-[1400px]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-5">
                        {/* Page Title */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                Đề Mô Phỏng
                            </h1>
                            <p className="text-sm text-gray-400">Luyện tập với các đề thi thật</p>
                        </div>

                        {/* Exam List */}
                        <ExamList subjectCode={subjectCode} />
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4">
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
                </div>
            </main>
        </div>
    );
}

