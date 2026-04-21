'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi } from '@/lib/api/examAdmin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiFileText, FiPlus, FiTrash2, FiEye, FiChevronLeft, FiChevronRight, FiCalendar, FiShuffle, FiSearch, FiUsers, FiTrendingUp, FiTarget, FiAward } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface Exam {
    id: number;
    title: string;
    subject_name: string;
    subject_code: string;
    duration: number;
    total_points: number;
    status: 'draft' | 'published' | 'archived';
    questions_count: number;
    attempts_count: number;
    created_at: string;
    is_premium?: boolean;
    solution_video_url?: string;
    solution_description?: string;
    shuffle_mode?: boolean;
    start_time?: string | null;
    end_time?: string | null;
}

interface Pagination {
    currentPage: number;
    totalPages: number;
    totalExams: number;
    limit: number;
}

interface ExamCounts {
    all: number;
    phongThi: number;
    tuDo: number;
}

interface ExamStats {
    totalExams: number;
    publishedExams: number;
    phongThiCount: number;
    tuDoCount: number;
    totalAttempts: number;
    completedAttempts: number;
    completionRate: number;
    avgScorePercentage: number;
    avgScorePoints: number;
}

interface TopExam {
    id: number;
    title: string;
    subjectName: string;
    difficultyLevel: string;
    attempts: number;
    passRate: number;
    avgPercentage: number;
    avgScorePoints: number;
}

interface SubjectStat {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    examCount: number;
    totalAttempts: number;
    passRate: number;
    avgPercentage: number;
}

type ExamFilter = 'all' | 'phong-thi' | 'tu-do';

export default function ExamsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [exams, setExams] = useState<Exam[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        currentPage: 1,
        totalPages: 1,
        totalExams: 0,
        limit: 20
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<ExamFilter>('all');
    const [examCounts, setExamCounts] = useState<ExamCounts>({ all: 0, phongThi: 0, tuDo: 0 });
    const [stats, setStats] = useState<ExamStats | null>(null);
    const [topExams, setTopExams] = useState<TopExam[]>([]);
    const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);

    const loadExamCounts = async () => {
        try {
            const counts = await examAdminApi.getCounts();
            setExamCounts(counts);
        } catch (error) {
            console.error('Error loading exam counts:', error);
        }
    };

    const loadStats = async () => {
        try {
            const result = await examAdminApi.getStats();
            if (result.success && result.data) {
                setStats(result.data.overview);
                setTopExams(result.data.topExams);
                setSubjectStats(result.data.subjectStats);
            }
        } catch (error) {
            console.error('Error loading exam stats:', error);
        }
    };

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'exams.manage'))) {
            router.push('/');
            return;
        }

        loadExamCounts();
        loadStats();
        loadExams();
    }, [isAuthenticated, user, router, pagination.currentPage, filterType]);

    const loadExams = async () => {
        try {
            setLoading(true);
            const typeParam = filterType === 'all' ? undefined : filterType;
            const data = await examAdminApi.getAllExams(pagination.currentPage, pagination.limit, typeParam);
            setExams(data.exams);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error loading exams:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteExam = async (examId: number) => {
        if (!confirm('Bạn có chắc muốn xóa đề thi này?')) return;

        try {
            await examAdminApi.deleteExam(examId);
            loadExams();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Xóa đề thi thất bại');
        }
    };

    const handleStatusChange = async (examId: number, newStatus: 'draft' | 'published' | 'archived') => {
        try {
            await examAdminApi.updateExamStatus(examId, newStatus);
            loadExams();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Đổi trạng thái thất bại');
        }
    };

    const handleFilterChange = (type: ExamFilter) => {
        setFilterType(type);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        loadExamCounts();
        loadStats();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout title="Quản lý Đề Thi" description="Danh sách đề thi">

            <div className="space-y-4">

                {/* ── Stats Row ──────────────────────────────────────── */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <FiUsers size={22} className="opacity-80" />
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">Tổng lượt thi</span>
                            </div>
                            <p className="text-3xl font-black">{stats.totalAttempts.toLocaleString()}</p>
                            <p className="text-xs text-indigo-100 mt-1">{stats.completedAttempts.toLocaleString()} hoàn thành</p>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <FiTarget size={22} className="opacity-80" />
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">Điểm TB</span>
                            </div>
                            <p className="text-3xl font-black">{stats.avgScorePercentage > 0 ? `${Math.round(stats.avgScorePercentage)}%` : '--'}</p>
                            <p className="text-xs text-emerald-100 mt-1">{stats.avgScorePoints > 0 ? `${stats.avgScorePoints.toFixed(1)} điểm` : 'Chưa có dữ liệu'}</p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <FiAward size={22} className="opacity-80" />
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">Tỷ lệ hoàn thành</span>
                            </div>
                            <p className="text-3xl font-black">{stats.completionRate > 0 ? `${Math.round(stats.completionRate)}%` : '--'}</p>
                            <p className="text-xs text-amber-100 mt-1">{stats.completedAttempts.toLocaleString()} / {stats.totalAttempts.toLocaleString()} lượt</p>
                        </div>

                        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <FiTrendingUp size={22} className="opacity-80" />
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">Top đề hot</span>
                            </div>
                            <p className="text-3xl font-black">{topExams.length > 0 ? `#${topExams[0].id}` : '--'}</p>
                            <p className="text-xs text-rose-100 mt-1">{topExams.length > 0 ? `${topExams[0].attempts} lượt thi` : 'Chưa có dữ liệu'}</p>
                        </div>
                    </div>
                )}

                {/* ── Top Exams Highlight ───────────────────────────────── */}
                {topExams.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FiTrendingUp size={16} className="text-rose-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top đề thi hot nhất</h3>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {topExams.map((exam, idx) => (
                                <div key={exam.id} className={`flex-shrink-0 rounded-xl border p-3 min-w-[200px] ${idx === 0 ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-gray-50 border-gray-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300'}`}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[140px]">{exam.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                                        <span>{exam.attempts} lượt</span>
                                        <span className={`font-bold ${exam.passRate >= 60 ? 'text-emerald-600' : exam.passRate > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                            {exam.passRate > 0 ? `${Math.round(exam.passRate)}% đỗ` : 'Chưa có'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Header with Create Button + Search */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="relative flex-1 w-full sm:max-w-md">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm đề thi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <Link
                        href="/admin/exams/create"
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all shrink-0"
                    >
                        <FiPlus size={16} /> Tạo đề mới
                    </Link>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2">
                    {([
                        { value: 'all', label: 'Tất cả', emoji: '📋', count: examCounts.all },
                        { value: 'phong-thi', label: 'Phòng thi', emoji: '🏢', count: examCounts.phongThi },
                        { value: 'tu-do', label: 'Đề tự do', emoji: '📝', count: examCounts.tuDo },
                    ] as { value: ExamFilter; label: string; emoji: string; count: number }[]).map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => handleFilterChange(tab.value)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                                filterType === tab.value
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                            }`}
                        >
                            <span>{tab.emoji}</span> {tab.label}
                            <span className={`text-xs font-bold ${filterType === tab.value ? 'opacity-80' : 'opacity-60'}`}>
                                ({tab.count})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Exams Table */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden dark:border-slate-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 border-b dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Tiêu đề
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Môn học
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Câu hỏi
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Lượt thi
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Trạng thái
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        VIP
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Phòng thi
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                                {exams.filter(e => !searchTerm.trim() || e.title.toLowerCase().includes(searchTerm.toLowerCase())).map((exam) => (
                                    <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-200">
                                            #{exam.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{exam.title}</div>
                                            <div className="text-xs text-gray-500 dark:text-slate-400">{exam.duration} phút • {exam.total_points} điểm</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                                            {exam.subject_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                                            {exam.questions_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                                            {exam.attempts_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                value={exam.status}
                                                onChange={(e) => handleStatusChange(exam.id, e.target.value as any)}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${exam.status === 'published'
                                                    ? 'bg-green-100 text-green-800'
                                                    : exam.status === 'draft'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                <option value="draft">Draft</option>
                                                <option value="published">Published</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                {exam.shuffle_mode && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">
                                                        <FiShuffle size={10} /> Shuffle
                                                    </span>
                                                )}
                                                {exam.is_premium ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-200 to-orange-400 text-orange-900 text-xs font-bold rounded-md shadow-sm">
                                                        <FaCrown /> PRO
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-medium">Free</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {exam.start_time ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg">
                                                    🏢 {new Date(exam.start_time).toLocaleDateString('vi-VN')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                    📝 Tự do
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex gap-2 justify-end">
                                            <Link
                                                href={`/admin/exams/${exam.id}/schedule`}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                                title="Quản lý lịch thi"
                                            >
                                                <FiCalendar size={17} />
                                            </Link>
                                            <button
                                                onClick={() => router.push(`/admin/exams/${exam.id}`)}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Xem chi tiết"
                                            >
                                                <FiEye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExam(exam.id)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Xóa"
                                            >
                                                <FiTrash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Hiển thị {((pagination.currentPage - 1) * pagination.limit) + 1} - {Math.min(pagination.currentPage * pagination.limit, pagination.totalExams)} trong tổng {pagination.totalExams} đề thi
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                                disabled={pagination.currentPage === 1}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronLeft />
                            </button>
                            <div className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold">
                                {pagination.currentPage}
                            </div>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                                disabled={pagination.currentPage >= pagination.totalPages}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronRight />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}