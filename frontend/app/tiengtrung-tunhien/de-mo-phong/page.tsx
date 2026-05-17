export const dynamic = 'force-dynamic';

import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import ExamList from '@/components/toan/ExamList';
import { FiBookOpen } from 'react-icons/fi';
import AdminExamButton from '@/components/common/AdminExamButton';

export default function TiengTrungTuNhienDeMoPhongPage() {
    const subjectCode = 'CHINESE';
    const colorScheme = { from: 'from-violet-500', to: 'to-fuchsia-600' };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            <div className={`absolute top-0 left-1/4 w-full h-[500px] bg-gradient-to-br from-violet-500 opacity-5 blur-[120px] pointer-events-none`} />
            
            <Header />

            <main className="w-full mx-auto px-4 md:px-6 xl:px-10 py-4 md:py-6 max-w-none relative z-10">
                <div className={`w-full rounded-2xl bg-gradient-to-r ${colorScheme.from} ${colorScheme.to} p-5 lg:p-6 shadow-lg shadow-fuchsia-900/10 relative overflow-hidden text-white flex items-center justify-between gap-4 mb-5`}>
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
                    <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/20 rounded-full blur-2xl mix-blend-overlay pointer-events-none" />
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/20 rounded-full blur-2xl mix-blend-overlay pointer-events-none" />
                    
                    <div className="relative z-10 w-full max-w-3xl">
                        <h1 className="text-xl lg:text-2xl font-black drop-shadow-md tracking-tight leading-tight">
                            Đề Mô Phỏng Tiếng Trung Tự Nhiên
                        </h1>
                        <p className="text-white/90 font-medium text-sm leading-relaxed max-w-2xl mt-1">
                            Luyện tập ngay hôm nay để được AI phân tích lộ trình cải thiện điểm số.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-9 flex flex-col gap-6">
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm px-6 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${colorScheme.from} ${colorScheme.to} shadow-sm`}>
                                    <FiBookOpen size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                                        Danh sách Đề thi
                                    </h2>
                                    <p className="text-sm text-gray-500 font-medium">Bạn có thể thi đi thi lại nhiều lần</p>
                                </div>
                            </div>

                            <AdminExamButton href="/admin/exams/create" gradientClass="from-violet-500 to-fuchsia-600" shadowClass="shadow-violet-500/20" hoverClass="hover:shadow-violet-500/40 hover:-translate-y-0.5" />
                        </div>

                        {/* Exam List */}
                        <ExamList subjectCode={subjectCode} subjectSlug="tiengtrung-tunhien" />
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-3">
                        <SubjectNavigation
                            subject="Tiếng Trung TN"
                            subjectCode="CHINESE_SCI"
                            subjectSlug="tiengtrung-tunhien"
                            colorScheme={{
                                from: 'from-violet-500',
                                to: 'to-fuchsia-600'
                            }}
                            emoji="🔬"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
