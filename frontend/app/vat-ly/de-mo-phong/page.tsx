import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import ExamList from '@/components/toan/ExamList';
import { FiBookOpen } from 'react-icons/fi';

export default function VatLyDeMoPhongPage() {
    const subjectCode = 'PHYSICS';
    const colorScheme = { from: 'from-amber-500', via: 'via-orange-500', to: 'to-red-600' };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            <div className={`absolute top-0 left-1/4 w-full h-[500px] bg-gradient-to-br from-orange-500 opacity-5 blur-[120px] pointer-events-none`} />
            
            <Header />

            <main className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-[1400px] relative z-10">
                <div className={`w-full rounded-[2rem] bg-gradient-to-r ${colorScheme.from} ${colorScheme.via} ${colorScheme.to} p-8 lg:p-12 shadow-xl shadow-orange-900/10 relative overflow-hidden text-white flex flex-col md:flex-row items-center justify-between gap-8 mb-8`}>
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
                    <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/20 rounded-full blur-3xl mix-blend-overlay pointer-events-none" />
                    <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/20 rounded-full blur-3xl mix-blend-overlay pointer-events-none" />
                    
                    <div className="relative z-10 w-full max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full shadow-sm text-xs font-bold uppercase tracking-widest backdrop-blur-md mb-5 border border-white/30">
                            ⚡ Phân hệ đề thi
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black mb-4 drop-shadow-md tracking-tight leading-tight">
                            Đề Mô Phỏng Vật Lý
                        </h1>
                        <p className="text-white/90 font-medium text-lg leading-relaxed max-w-2xl">
                            Cập nhật liên tục các đề thi chuẩn cấu trúc từ CSCA. Luyện tập ngay hôm nay để được AI phân tích lộ trình cải thiện điểm số.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
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
                        </div>

                        {/* Exam List */}
                        <ExamList subjectCode={subjectCode} />
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4">
                        <SubjectNavigation
                            subject="Vật Lý"
                            subjectCode="PHYSICS"
                            subjectSlug="vat-ly"
                            colorScheme={{
                                from: 'from-amber-500',
                                to: 'to-red-600'
                            }}
                            emoji="⚡"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
