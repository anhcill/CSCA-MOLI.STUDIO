import Header from '@/components/layout/Header';
import SubjectNavigation from '@/components/layout/SubjectNavigation';
import ExamList from '@/components/toan/ExamList';

const SUBJECT_CONFIG: Record<string, {
    code: string;
    name: string;
    colorScheme: { from: string; via?: string; to: string };
}> = {
    'toan': {
        code: 'MATH',
        name: 'Toán',
        colorScheme: { from: 'from-purple-500', via: 'via-pink-500', to: 'to-blue-500' }
    },
    'vatly': {
        code: 'PHYSICS',
        name: 'Vật lý',
        colorScheme: { from: 'from-blue-500', via: 'via-cyan-500', to: 'to-sky-500' }
    },
    'hoa': {
        code: 'CHEMISTRY',
        name: 'Hóa học',
        colorScheme: { from: 'from-green-500', via: 'via-teal-500', to: 'to-cyan-500' }
    },
    'tiengtrung-xahoi': {
        code: 'CHINESE',
        name: 'Tiếng Trung Xã Hội',
        colorScheme: { from: 'from-orange-500', via: 'via-red-500', to: 'to-pink-500' }
    },
    'tiengtrung-tunhien': {
        code: 'CHINESE',
        name: 'Tiếng Trung Tự Nhiên',
        colorScheme: { from: 'from-red-500', via: 'via-rose-500', to: 'to-pink-500' }
    }
};

export default function DeMoPhongPage({ params }: { params: { subject: string } }) {
    const subjectSlug = params.subject;
    const subjectInfo = SUBJECT_CONFIG[subjectSlug];

    if (!subjectInfo) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Không tìm thấy môn học</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />

            <main className="container mx-auto px-6 py-8 max-w-[1400px]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                Đề Mô Phỏng — {subjectInfo.name}
                            </h1>
                            <p className="text-sm text-gray-400">Luyện tập với các đề thi thật</p>
                        </div>

                        <ExamList subjectCode={subjectInfo.code} />
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4">
                        <SubjectNavigation
                            subject={subjectInfo.name}
                            subjectCode={subjectInfo.code}
                            colorScheme={subjectInfo.colorScheme}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
