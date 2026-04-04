import Header from '@/components/layout/Header';

const SUBJECT_CONFIG: Record<string, { code: string; name: string }> = {
    'toan': { code: 'MATH', name: 'Toán' },
    'vatly': { code: 'PHYSICS', name: 'Vật lý' },
    'hoa': { code: 'CHEMISTRY', name: 'Hóa học' },
    'tiengtrung-xahoi': { code: 'CHINESE', name: 'Tiếng Trung Xã Hội' },
    'tiengtrung-tunhien': { code: 'CHINESE', name: 'Tiếng Trung Tự Nhiên' }
};

export default function LichSuPage({ params }: { params: { subject: string } }) {
    const subjectInfo = SUBJECT_CONFIG[params.subject];
    if (!subjectInfo) return <div>Không tìm thấy môn học</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
            <Header />
            <main className="container mx-auto px-6 py-8 max-w-[1400px]">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                        Lịch Sử Làm Bài 📊
                    </h1>
                    <p className="text-xl text-gray-600">Theo dõi tiến độ học tập của bạn</p>
                </div>

                {/* Simple Stats Display */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-8">
                    <p className="text-gray-600 text-center">
                        Tính năng thống kê chi tiết đang được phát triển...
                    </p>
                </div>
            </main>
        </div>
    );
}
