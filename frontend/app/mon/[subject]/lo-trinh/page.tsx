import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';

const SUBJECT_CONFIG: Record<string, {
    code: string;
    name: string;
    colorScheme: { from: string; via?: string; to: string };
}> = {
    'toan': { code: 'MATH', name: 'Toán', colorScheme: { from: 'from-purple-500', via: 'via-pink-500', to: 'to-blue-500' } },
    'vatly': { code: 'PHYSICS', name: 'Vật lý', colorScheme: { from: 'from-blue-500', via: 'via-cyan-500', to: 'to-sky-500' } },
    'hoa': { code: 'CHEMISTRY', name: 'Hóa học', colorScheme: { from: 'from-green-500', via: 'via-teal-500', to: 'to-cyan-500' } },
    'tiengtrung-xahoi': { code: 'CHINESE', name: 'Tiếng Trung Xã Hội', colorScheme: { from: 'from-orange-500', via: 'via-red-500', to: 'to-pink-500' } },
    'tiengtrung-tunhien': { code: 'CHINESE', name: 'Tiếng Trung Tự Nhiên', colorScheme: { from: 'from-red-500', via: 'via-rose-500', to: 'to-pink-500' } }
};

export default function LoTrinhPage({ params }: { params: { subject: string } }) {
    const subjectInfo = SUBJECT_CONFIG[params.subject];
    if (!subjectInfo) return <div>Không tìm thấy môn học</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
            <Header />
            <main className="container mx-auto px-6 py-8 max-w-[1600px]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-3">
                        <SubjectNavigation subject={subjectInfo.name} subjectCode={subjectInfo.code} colorScheme={subjectInfo.colorScheme} />
                    </div>
                    <div className="lg:col-span-9 space-y-8">
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <h1 className={`text-4xl font-black bg-gradient-to-r ${subjectInfo.colorScheme.from} ${subjectInfo.colorScheme.via || ''} ${subjectInfo.colorScheme.to} bg-clip-text text-transparent mb-2`}>
                                Lộ Trình Học Cá Nhân 👤
                            </h1>
                            <p className="text-gray-600">Theo dõi tiến độ học tập của bạn</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                            <div className="text-center py-20">
                                <div className="text-6xl mb-4">🎯</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Nội dung đang được cập nhật</h3>
                                <p className="text-gray-600">Lộ trình học tập cá nhân hóa sẽ sớm được bổ sung</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
