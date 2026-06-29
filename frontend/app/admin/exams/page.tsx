'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi, type AdminExamAnalytics } from '@/lib/api/examAdmin';
import { hasPermission } from '@/lib/utils/permissions';
import { buildAdminExamListQuery, parseAdminExamAccessFilter, parseAdminExamFilter, withAdminExamListState, saveAdminExamListState, loadAdminExamListState, type AdminExamAccessFilter, type AdminExamFilter } from '@/lib/utils/adminExamListState';
import { FiFileText, FiPlus, FiTrash2, FiEye, FiChevronLeft, FiChevronRight, FiCalendar, FiShuffle, FiSearch, FiUsers, FiTrendingUp, FiTarget, FiAward, FiMonitor, FiCheck, FiX, FiRotateCcw, FiRefreshCw } from 'react-icons/fi';
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
    is_simulated?: boolean;
    vip_tier?: string;
    solution_video_url?: string;
    solution_description?: string;
    shuffle_mode?: boolean;
    start_time?: string | null;
    end_time?: string | null;
    deleted_at?: string | null;
    deleted_by?: number | null;
    delete_reason?: string | null;
    delete_requested_at?: string | null;
    delete_requested_by?: number | null;
    delete_request_reason?: string | null;
    deletion_status?: 'none' | 'requested' | 'soft_deleted';
    delete_requested_by_name?: string | null;
    deleted_by_name?: string | null;
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
    moPhong: number;
    deleteRequests: number;
    trash: number;
    bySubject?: SubjectCount[];
}

interface SubjectCount {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    count: number;
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

export default function ExamsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
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
    const [filterType, setFilterType] = useState<AdminExamFilter>(() => {
        const fromUrl = searchParams.get('type');
        if (fromUrl) return parseAdminExamFilter(fromUrl);
        return loadAdminExamListState().type;
    });
    const [subjectFilter, setSubjectFilter] = useState(() => {
        const fromUrl = searchParams.get('subject');
        if (fromUrl) return fromUrl;
        return loadAdminExamListState().subject;
    });
    const [accessFilter, setAccessFilter] = useState<AdminExamAccessFilter>(() => {
        const fromUrl = searchParams.get('access');
        if (fromUrl) return parseAdminExamAccessFilter(fromUrl);
        return loadAdminExamListState().access;
    });
    const [examCounts, setExamCounts] = useState<ExamCounts>({ all: 0, phongThi: 0, tuDo: 0, moPhong: 0, deleteRequests: 0, trash: 0 });
    const [stats, setStats] = useState<ExamStats | null>(null);
    const [topExams, setTopExams] = useState<TopExam[]>([]);
    const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
    const [activeView, setActiveView] = useState<'list' | 'analytics'>('list');
    const [analytics, setAnalytics] = useState<AdminExamAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [examAction, setExamAction] = useState<{ type: 'delete' | 'approve' | 'reject'; exam: Exam } | null>(null);
    const [examActionReason, setExamActionReason] = useState('');
    const [examActionError, setExamActionError] = useState('');
    const [examActionBusy, setExamActionBusy] = useState(false);
    const [restoreExam, setRestoreExam] = useState<Exam | null>(null);
    const [restoreError, setRestoreError] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [permanentDeleteExam, setPermanentDeleteExam] = useState<Exam | null>(null);
    const [permanentDeleteConfirmText, setPermanentDeleteConfirmText] = useState('');
    const [permanentDeleteReason, setPermanentDeleteReason] = useState('');
    const [permanentDeleteError, setPermanentDeleteError] = useState('');
    const [permanentDeleting, setPermanentDeleting] = useState(false);
    const [batchNormalizing, setBatchNormalizing] = useState(false);
    const [batchNormalizeMessage, setBatchNormalizeMessage] = useState('');
    const isSuperAdminUser = hasPermission(user, 'admin.super');
    const isTemporarilyDeletedExam = (exam: Exam) => Boolean(exam.deleted_at || exam.deletion_status === 'soft_deleted');
    const withCurrentExamListState = (path: string) => withAdminExamListState(path, filterType, subjectFilter, accessFilter);

    const replaceExamListState = (nextFilterType: AdminExamFilter, nextSubjectFilter: string, nextAccessFilter: AdminExamAccessFilter) => {
        const query = buildAdminExamListQuery(nextFilterType, nextSubjectFilter, nextAccessFilter);
        router.replace(`/admin/exams${query ? `?${query}` : ''}`, { scroll: false });
    };














        // Khi URL không có params nhưng sessionStorage có → sync URL lên
        useEffect(() => {
            const urlType = searchParams.get('type');
            const urlSubject = searchParams.get('subject');
            const urlAccess = searchParams.get('access');
            if (urlType === null && urlSubject === null && urlAccess === null) {
                const saved = loadAdminExamListState();
                if (saved.type !== 'all' || saved.subject || saved.access !== 'all') {
                    replaceExamListState(saved.type, saved.subject, saved.access);
                }
            }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

            // Khi URL không có params nhưng sessionStorage có → sync URL lên
    useEffect(() => {
        const urlType = searchParams.get('type');
        const urlSubject = searchParams.get('subject');
        const urlAccess = searchParams.get('access');
        if (urlType === null && urlSubject === null && urlAccess === null) {
            const saved = loadAdminExamListState();
            if (saved.type !== 'all' || saved.subject || saved.access !== 'all') {
                replaceExamListState(saved.type, saved.subject, saved.access);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const urlType = searchParams.get('type');
        const urlSubject = searchParams.get('subject');
        const urlAccess = searchParams.get('access');
        // URL có params → dùng từ URL; không có → giữ state hiện tại (đã load từ sessionStorage)
        if (urlType !== null || urlSubject !== null || urlAccess !== null) {
            const nextFilterType = parseAdminExamFilter(urlType);
            const nextSubjectFilter = urlSubject || '';
            const nextAccessFilter = parseAdminExamAccessFilter(urlAccess);
            setFilterType(prev => (prev === nextFilterType ? prev : nextFilterType));
            setSubjectFilter(prev => (prev === nextSubjectFilter ? prev : nextSubjectFilter));
            setAccessFilter(prev => (prev === nextAccessFilter ? prev : nextAccessFilter));
            setPagination(prev => (prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 }));
            saveAdminExamListState(nextFilterType, nextSubjectFilter, nextAccessFilter);
        }
    }, [searchParams]);

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

    const loadAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            const result = await examAdminApi.getAnalytics();
            if (result.success && result.data) {
                setAnalytics(result.data);
            }
        } catch (error) {
            console.error('Error loading exam analytics:', error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token) {
            router.push('/');
            return;
        }
        if (isAuthenticated && !hasPermission(user, 'exams.manage')) {
            router.push('/admin');
            return;
        }

        loadExamCounts();
        loadStats();
        loadAnalytics();
        loadExams();
    }, [isAuthenticated, user, router, pagination.currentPage, filterType, subjectFilter, accessFilter]);

    const loadExams = async () => {
        try {
            setLoading(true);
            const typeParam = filterType === 'all' ? undefined : filterType;
            const accessParam = accessFilter === 'all' ? undefined : accessFilter;
            const data = await examAdminApi.getAllExams(pagination.currentPage, pagination.limit, typeParam, subjectFilter || undefined, accessParam);
            setExams(data.exams);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error loading exams:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshExamData = () => {
        loadExamCounts();
        loadStats();
        loadAnalytics();
        loadExams();
    };

    const openExamAction = (type: 'delete' | 'approve' | 'reject', exam: Exam) => {
        setExamAction({ type, exam });
        setExamActionReason('');
        setExamActionError('');
    };

    const closeExamAction = () => {
        if (examActionBusy) return;
        setExamAction(null);
        setExamActionReason('');
        setExamActionError('');
    };

    const confirmExamAction = async () => {
        if (!examAction || examActionBusy) return;

        try {
            setExamActionBusy(true);
            setExamActionError('');
            if (examAction.type === 'delete') {
                await examAdminApi.deleteExam(examAction.exam.id, examActionReason.trim());
            } else if (examAction.type === 'approve') {
                await examAdminApi.approveDeleteRequest(examAction.exam.id, examActionReason.trim());
            } else {
                await examAdminApi.rejectDeleteRequest(examAction.exam.id, examActionReason.trim());
            }
            closeExamAction();
            refreshExamData();
        } catch (error: any) {
            setExamActionError(error.response?.data?.message || 'Thao tác thất bại.');
        } finally {
            setExamActionBusy(false);
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

    const openRestoreExam = (exam: Exam) => {
        setRestoreExam(exam);
        setRestoreError('');
    };

    const closeRestoreExam = () => {
        if (restoring) return;
        setRestoreExam(null);
        setRestoreError('');
    };

    const handleRestoreExam = async () => {
        if (!restoreExam || restoring) return;

        try {
            setRestoring(true);
            setRestoreError('');
            await examAdminApi.restoreExam(restoreExam.id);
            closeRestoreExam();
            refreshExamData();
        } catch (error: any) {
            setRestoreError(error.response?.data?.message || 'Khôi phục đề thi thất bại.');
        } finally {
            setRestoring(false);
        }
    };

    const openPermanentDeleteExam = (exam: Exam) => {
        setPermanentDeleteExam(exam);
        setPermanentDeleteConfirmText('');
        setPermanentDeleteReason('');
        setPermanentDeleteError('');
    };

    const closePermanentDeleteExam = () => {
        if (permanentDeleting) return;
        setPermanentDeleteExam(null);
        setPermanentDeleteConfirmText('');
        setPermanentDeleteReason('');
        setPermanentDeleteError('');
    };

    const confirmPermanentDeleteExam = async () => {
        if (!permanentDeleteExam || permanentDeleting) return;
        if (permanentDeleteConfirmText.trim() !== 'XOA VINH VIEN') {
            setPermanentDeleteError('Nhập XOA VINH VIEN để xác nhận.');
            return;
        }

        try {
            setPermanentDeleting(true);
            setPermanentDeleteError('');
            await examAdminApi.permanentDeleteExam(permanentDeleteExam.id, permanentDeleteReason.trim());
            closePermanentDeleteExam();
            refreshExamData();
        } catch (error: any) {
            setPermanentDeleteError(error.response?.data?.message || 'Xóa vĩnh viễn đề thi thất bại.');
        } finally {
            setPermanentDeleting(false);
        }
    };

        const handleFilterChange = (type: AdminExamFilter) => {
        setFilterType(type);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        replaceExamListState(type, subjectFilter, accessFilter);
        saveAdminExamListState(type, subjectFilter, accessFilter);
        loadExamCounts();
        loadStats();
    };

    const handleSubjectFilterChange = (subjectCode: string) => {
        setSubjectFilter(subjectCode);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        replaceExamListState(filterType, subjectCode, accessFilter);
        saveAdminExamListState(filterType, subjectCode, accessFilter);
    };

    const handleAccessFilterChange = (access: AdminExamAccessFilter) => {
        setAccessFilter(access);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        replaceExamListState(filterType, subjectFilter, access);
        saveAdminExamListState(filterType, subjectFilter, access);
    };

    const handleNormalizeManyExams = async () => {
        if (batchNormalizing) return;
        const subjectText = subjectFilter ? ` môn ${subjectFilter}` : '';
        if (!confirm(`Chuẩn hóa công thức tối đa 50 đề cũ${subjectText}? Hệ thống chỉ sửa chỗ chắc chắn, chỗ nghi lỗi sẽ báo lại.`)) {
            return;
        }

        try {
            setBatchNormalizing(true);
            setBatchNormalizeMessage('');
            const result = await examAdminApi.normalizeManyExamFormulas({
                subject: subjectFilter || undefined,
                limit: 50,
            });
            setBatchNormalizeMessage(`${result.message} Còn ${result.warningCount || 0} chỗ cần xem tay.`);
            refreshExamData();
        } catch (error: any) {
            setBatchNormalizeMessage(error.response?.data?.message || 'Chuẩn hóa nhiều đề thất bại.');
        } finally {
            setBatchNormalizing(false);
        }
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return '--';
        return new Date(value).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds?: number | null) => {
        const totalSeconds = Number(seconds || 0);
        if (!totalSeconds) return '--';
        const minutes = Math.floor(totalSeconds / 60);
        const restSeconds = totalSeconds % 60;
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m ${restSeconds}s`;
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

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                    {([
                        { id: 'list', label: 'Danh sách đề', icon: FiFileText },
                        { id: 'analytics', label: 'Thống kê làm đề', icon: FiTrendingUp },
                    ] as { id: 'list' | 'analytics'; label: string; icon: typeof FiFileText }[]).map(item => {
                        const Icon = item.icon;
                        const active = activeView === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveView(item.id)}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                                    active
                                        ? 'bg-violet-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Icon size={16} />
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                {activeView === 'analytics' && (
                    <div className="space-y-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white">Thống kê làm đề</h2>
                                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Ai làm đề nào, đề nào hot, ai đạt điểm cao nhất.</p>
                            </div>
                            <button
                                type="button"
                                onClick={loadAnalytics}
                                disabled={analyticsLoading}
                                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                            >
                                <FiRefreshCw size={15} className={analyticsLoading ? 'animate-spin' : ''} />
                                Làm mới
                            </button>
                        </div>

                        {analyticsLoading && !analytics ? (
                            <div className="rounded-xl border border-dashed border-violet-200 p-8 text-center text-sm font-semibold text-violet-700">
                                Đang tải thống kê...
                            </div>
                        ) : analytics ? (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl bg-violet-50 p-4 text-violet-900 dark:bg-violet-500/10 dark:text-violet-100">
                                        <p className="text-xs font-bold uppercase opacity-70">Người đã làm</p>
                                        <p className="mt-1 text-3xl font-black">{analytics.overview.uniqueUsers.toLocaleString()}</p>
                                        <p className="text-xs font-semibold opacity-70">{analytics.overview.totalAttempts.toLocaleString()} lượt làm</p>
                                    </div>
                                    <div className="rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
                                        <p className="text-xs font-bold uppercase opacity-70">Hoàn thành</p>
                                        <p className="mt-1 text-3xl font-black">{analytics.overview.completedAttempts.toLocaleString()}</p>
                                        <p className="text-xs font-semibold opacity-70">{analytics.overview.examsWithAttempts.toLocaleString()} đề có lượt làm</p>
                                    </div>
                                    <div className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                                        <p className="text-xs font-bold uppercase opacity-70">Điểm TB</p>
                                        <p className="mt-1 text-3xl font-black">{Math.round(analytics.overview.avgScorePercentage)}%</p>
                                        <p className="text-xs font-semibold opacity-70">Cao nhất {Math.round(analytics.overview.bestScorePercentage)}%</p>
                                    </div>
                                    <div className="rounded-xl bg-sky-50 p-4 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100">
                                        <p className="text-xs font-bold uppercase opacity-70">Gần nhất</p>
                                        <p className="mt-1 text-lg font-black">{formatDateTime(analytics.overview.lastSubmitAt)}</p>
                                        <p className="text-xs font-semibold opacity-70">lượt nộp mới nhất</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
                                        <div className="border-b bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800">
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white">Đề được làm nhiều nhất</h3>
                                        </div>
                                        <div className="max-h-[460px] overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Đề</th>
                                                        <th className="px-4 py-3 text-right">Lượt</th>
                                                        <th className="px-4 py-3 text-right">User</th>
                                                        <th className="px-4 py-3 text-left">Top điểm</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                                    {analytics.popularExams.map(exam => (
                                                        <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                                                            <td className="px-4 py-3">
                                                                <button onClick={() => router.push(withCurrentExamListState(`/admin/exams/${exam.id}`))} className="text-left font-bold text-gray-900 hover:text-violet-700 dark:text-white">
                                                                    {exam.title}
                                                                </button>
                                                                <div className="text-xs text-gray-500">{exam.subjectName} {exam.isPremium ? '• VIP' : ''}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-black text-violet-700">{exam.totalAttempts}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">{exam.uniqueUsers}</td>
                                                            <td className="px-4 py-3">
                                                                {exam.topUser ? (
                                                                    <div>
                                                                        <p className="font-bold text-gray-900 dark:text-white">{exam.topUser.name}</p>
                                                                        <p className="text-xs text-emerald-600">{Math.round(exam.topUser.scorePercentage)}% • {formatDuration(exam.topUser.durationSeconds)}</p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">Chưa có</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
                                        <div className="border-b bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800">
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white">User nổi bật</h3>
                                        </div>
                                        <div className="max-h-[460px] overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Người dùng</th>
                                                        <th className="px-4 py-3 text-right">Đề</th>
                                                        <th className="px-4 py-3 text-right">Lượt</th>
                                                        <th className="px-4 py-3 text-right">TB/Cao</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                                    {analytics.topUsers.map(user => (
                                                        <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                                                            <td className="px-4 py-3">
                                                                <p className="font-bold text-gray-900 dark:text-white">{user.userName}</p>
                                                                <p className="text-xs text-gray-500">{user.userEmail}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">{user.distinctExams}</td>
                                                            <td className="px-4 py-3 text-right font-black text-violet-700">{user.completedAttempts}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <p className="font-bold text-gray-900 dark:text-white">{Math.round(user.avgScorePercentage)}%</p>
                                                                <p className="text-xs text-emerald-600">{Math.round(user.bestScorePercentage)}%</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
                                    <div className="border-b bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800">
                                        <h3 className="text-sm font-black text-gray-900 dark:text-white">Lượt làm gần đây</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white text-xs uppercase text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Người làm</th>
                                                    <th className="px-4 py-3 text-left">Đề</th>
                                                    <th className="px-4 py-3 text-right">Điểm</th>
                                                    <th className="px-4 py-3 text-right">Thời gian</th>
                                                    <th className="px-4 py-3 text-left">Nộp lúc</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                                {analytics.recentAttempts.map(attempt => (
                                                    <tr key={attempt.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                                                        <td className="px-4 py-3">
                                                            <p className="font-bold text-gray-900 dark:text-white">{attempt.userName}</p>
                                                            <p className="text-xs text-gray-500">{attempt.userEmail}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => router.push(withCurrentExamListState(`/admin/exams/${attempt.examId}`))} className="text-left font-bold text-gray-900 hover:text-violet-700 dark:text-white">
                                                                {attempt.examTitle}
                                                            </button>
                                                            <div className="text-xs text-gray-500">{attempt.subjectName}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {attempt.status === 'completed' ? (
                                                                <>
                                                                    <p className="font-black text-gray-900 dark:text-white">{Math.round(attempt.scorePercentage)}%</p>
                                                                    <p className="text-xs text-gray-500">{attempt.totalScore} điểm</p>
                                                                </>
                                                            ) : (
                                                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Đang làm</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">{formatDuration(attempt.durationSeconds)}</td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{formatDateTime(attempt.submittedAt || attempt.startedAt)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm font-semibold text-gray-500">
                                Chưa có dữ liệu thống kê.
                            </div>
                        )}
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
                    <button
                        type="button"
                        onClick={handleNormalizeManyExams}
                        disabled={batchNormalizing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                    >
                        <FiRefreshCw size={16} className={batchNormalizing ? 'animate-spin' : ''} />
                        {batchNormalizing ? 'Đang chuẩn hóa...' : 'Chuẩn hóa nhiều đề cũ'}
                    </button>
                    <Link
                        href={withCurrentExamListState('/admin/exams/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all shrink-0"
                    >
                        <FiPlus size={16} /> Tạo đề mới
                    </Link>
                </div>

                {batchNormalizeMessage && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                        {batchNormalizeMessage}
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    {([
                        { value: 'all', label: 'Tất cả', emoji: '📋', count: examCounts.all },
                        { value: 'phong-thi', label: 'Phòng thi', emoji: '🏢', count: examCounts.phongThi },
                        { value: 'mo-phong', label: 'Đề mô phỏng', emoji: '🎯', count: examCounts.moPhong },
                        { value: 'tu-do', label: 'Đề tự do', emoji: '📝', count: examCounts.tuDo },
                        ...(isSuperAdminUser ? [
                                                        { value: 'delete-requests' as AdminExamFilter, label: 'Chờ duyệt xóa', emoji: '⚠', count: examCounts.deleteRequests },
                            { value: 'trash' as AdminExamFilter, label: 'Xóa tạm', emoji: '↩', count: examCounts.trash },
                        ] : []),
                    ] as { value: AdminExamFilter; label: string; emoji: string; count: number }[]).map(tab => (
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

                {/* Subject Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => handleSubjectFilterChange('')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            subjectFilter === ''
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                    >
                        Tất cả môn
                    </button>
                    {(examCounts.bySubject || []).map(subject => (
                        <button
                            key={subject.subjectCode}
                            onClick={() => handleSubjectFilterChange(subject.subjectCode)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                subjectFilter === subject.subjectCode
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                            }`}
                        >
                            {subject.subjectName}
                            <span className={`font-bold ${subjectFilter === subject.subjectCode ? 'opacity-80' : 'opacity-60'}`}>
                                ({subject.count})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Access Filters */}
                <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400">Nhóm đề</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {subjectFilter ? `Môn ${subjectFilter}` : 'Tất cả môn'} - tách đề VIP và đề thường
                            </p>
                        </div>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {pagination.totalExams.toLocaleString()} đề
                        </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {([
                            { value: 'all', label: 'Tất cả', description: 'Xem đủ nhóm', icon: FiFileText },
                            { value: 'normal', label: 'Đề thường', description: 'Không VIP', icon: FiFileText },
                            { value: 'vip', label: 'Đề VIP', description: 'Có gói trả phí', icon: FaCrown },
                        ] as { value: AdminExamAccessFilter; label: string; description: string; icon: typeof FiFileText }[]).map(option => {
                            const Icon = option.icon;
                            const active = accessFilter === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleAccessFilterChange(option.value)}
                                    className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                                        active
                                            ? option.value === 'vip'
                                                ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200'
                                                : 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-200'
                                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-violet-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-violet-500/50'
                                    }`}
                                >
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                        active ? 'bg-white/80 dark:bg-slate-950/80' : 'bg-white dark:bg-slate-900'
                                    }`}>
                                        <Icon size={18} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-black">{option.label}</span>
                                        <span className="block text-xs font-medium opacity-70">{option.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
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
                                        Phân loại
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
                                            <button
                                                onClick={() => router.push(withCurrentExamListState(`/admin/exams/${exam.id}`))}
                                                className="text-left hover:text-purple-600 transition-colors"
                                            >
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{exam.title}</div>
                                                <div className="text-xs text-gray-500 dark:text-slate-400">{exam.duration} phút • {exam.total_points} điểm</div>
                                                {exam.deletion_status === 'requested' && !exam.deleted_at && (
                                                    <div className="mt-1 text-xs font-bold text-amber-700">Chờ admin tổng duyệt xóa{exam.delete_requested_by_name ? ` - ${exam.delete_requested_by_name}` : ''}</div>
                                                )}
                                                {isTemporarilyDeletedExam(exam) && (
                                                    <div className="mt-1 text-xs font-bold text-red-700">Đã xóa tạm{exam.deleted_by_name ? ` - ${exam.deleted_by_name}` : ''}</div>
                                                )}
                                                {(exam.delete_request_reason || exam.delete_reason) && (
                                                    <div className="mt-1 max-w-md truncate text-xs text-gray-500">Lý do: {exam.delete_request_reason || exam.delete_reason}</div>
                                                )}
                                            </button>
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
                                                <option value="draft">🔒 Đang ẩn (Nháp)</option>
                                                <option value="published">👁️ Đang hiển thị</option>
                                                <option value="archived">📦 Lưu trữ</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {exam.shuffle_mode && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">
                                                        <FiShuffle size={10} /> Xáo trộn
                                                    </span>
                                                )}
                                                {(exam.is_premium || (exam.vip_tier && exam.vip_tier !== 'basic')) ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md shadow-sm bg-gradient-to-r from-amber-200 to-orange-300 text-orange-900">
                                                        <FaCrown size={10} /> VIP
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-medium">Miễn phí</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {exam.start_time ? (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg">
                                                        🏢 {new Date(exam.start_time).toLocaleDateString('vi-VN')}
                                                    </span>
                                                    {exam.is_simulated && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded-lg">
                                                            🎯 Mô phỏng
                                                        </span>
                                                    )}
                                                </div>
                                            ) : exam.is_simulated ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded-lg">
                                                    🎯 Mô phỏng
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                    📝 Tự do
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex gap-2 justify-end">
                                            <Link
                                                href={withCurrentExamListState(`/admin/exams/${exam.id}/schedule`)}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                                title="Quản lý lịch thi"
                                            >
                                                <FiCalendar size={17} />
                                            </Link>
                                            <Link
                                                href={withCurrentExamListState(`/admin/exams/${exam.id}/official`)}
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                title="Quan ly thi chinh thuc"
                                            >
                                                <FiMonitor size={17} />
                                            </Link>
                                            <button
                                                onClick={() => router.push(withCurrentExamListState(`/admin/exams/${exam.id}`))}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Xem chi tiết"
                                            >
                                                <FiEye size={18} />
                                            </button>
                                            {isSuperAdminUser && exam.deletion_status === 'requested' && !exam.deleted_at && (
                                                <>
                                                    <button
                                                        onClick={() => openExamAction('approve', exam)}
                                                        className="text-emerald-600 hover:text-emerald-800"
                                                        title="Đồng ý xóa tạm đề"
                                                    >
                                                        <FiCheck size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => openExamAction('reject', exam)}
                                                        className="text-amber-600 hover:text-amber-800"
                                                        title="Không đồng ý xóa đề"
                                                    >
                                                        <FiX size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {isSuperAdminUser && isTemporarilyDeletedExam(exam) && (
                                                <>
                                                    <button
                                                        onClick={() => openRestoreExam(exam)}
                                                        className="text-emerald-600 hover:text-emerald-800"
                                                        title="Khôi phục đề"
                                                    >
                                                        <FiRotateCcw size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => openPermanentDeleteExam(exam)}
                                                        className="text-red-700 hover:text-red-900"
                                                        title="Xóa vĩnh viễn đề thi"
                                                    >
                                                        <FiTrash2 size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {!isTemporarilyDeletedExam(exam) && exam.deletion_status !== 'requested' && (
                                                <button
                                                    onClick={() => openExamAction('delete', exam)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Xóa tạm hoặc gửi yêu cầu xóa"
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            )}
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

            {examAction && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeExamAction();
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">
                            {examAction.type === 'delete'
                                ? 'Xóa tạm đề thi?'
                                : examAction.type === 'approve'
                                    ? 'Duyệt yêu cầu xóa?'
                                    : 'Từ chối yêu cầu xóa?'}
                        </h3>
                        <p className="mb-4 text-sm leading-6 text-gray-600">
                            Đề <span className="font-semibold text-gray-900">#{examAction.exam.id} - {examAction.exam.title}</span>
                        </p>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            {examAction.type === 'reject' ? 'Lý do từ chối' : 'Lý do'}
                        </label>
                        <textarea
                            value={examActionReason}
                            onChange={(event) => setExamActionReason(event.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            placeholder="Có thể để trống"
                            disabled={examActionBusy}
                        />
                        {examActionError && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {examActionError}
                            </div>
                        )}
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeExamAction}
                                disabled={examActionBusy}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={confirmExamAction}
                                disabled={examActionBusy}
                                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    examAction.type === 'reject'
                                        ? 'bg-amber-600 hover:bg-amber-700'
                                        : examAction.type === 'approve'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {examActionBusy
                                    ? 'Đang xử lý...'
                                    : examAction.type === 'delete'
                                        ? 'Xóa tạm'
                                        : examAction.type === 'approve'
                                            ? 'Duyệt'
                                            : 'Từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {restoreExam && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeRestoreExam();
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Khôi phục đề thi?</h3>
                        <p className="mb-4 text-sm leading-6 text-gray-600">
                            Đề <span className="font-semibold text-gray-900">#{restoreExam.id} - {restoreExam.title}</span> sẽ được đưa ra khỏi danh sách xóa tạm.
                        </p>
                        {restoreError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {restoreError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeRestoreExam}
                                disabled={restoring}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleRestoreExam}
                                disabled={restoring}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {restoring ? 'Đang khôi phục...' : 'Khôi phục'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {permanentDeleteExam && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closePermanentDeleteExam();
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <h3 className="mb-2 text-lg font-bold text-gray-900">Xóa vĩnh viễn đề?</h3>
                        <p className="mb-4 text-sm leading-6 text-gray-600">
                            Đề <span className="font-semibold text-gray-900">#{permanentDeleteExam.id} - {permanentDeleteExam.title}</span> sẽ bị xóa vĩnh viễn khỏi hệ thống.
                        </p>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                            Nhập XOA VINH VIEN để xác nhận
                        </label>
                        <input
                            value={permanentDeleteConfirmText}
                            onChange={(event) => {
                                setPermanentDeleteConfirmText(event.target.value);
                                setPermanentDeleteError('');
                            }}
                            className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            placeholder="XOA VINH VIEN"
                            disabled={permanentDeleting}
                        />
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Lý do xóa vĩnh viễn</label>
                        <textarea
                            value={permanentDeleteReason}
                            onChange={(event) => setPermanentDeleteReason(event.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            placeholder="Có thể để trống"
                            disabled={permanentDeleting}
                        />
                        {permanentDeleteError && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {permanentDeleteError}
                            </div>
                        )}
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closePermanentDeleteExam}
                                disabled={permanentDeleting}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={confirmPermanentDeleteExam}
                                disabled={permanentDeleting}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {permanentDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
