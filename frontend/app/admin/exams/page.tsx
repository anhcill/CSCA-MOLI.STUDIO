'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi } from '@/lib/api/examAdmin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiFileText, FiPlus, FiTrash2, FiEye, FiChevronLeft, FiChevronRight, FiCalendar, FiShuffle, FiSearch } from 'react-icons/fi';
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
}

interface Pagination {
    currentPage: number;
    totalPages: number;
    totalExams: number;
    limit: number;
}

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

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'exams.manage'))) {
            router.push('/');
            return;
        }

        loadExams();
    }, [isAuthenticated, user, router, pagination.currentPage]);

    const loadExams = async () => {
        try {
            setLoading(true);
            const data = await examAdminApi.getAllExams(pagination.currentPage, pagination.limit);
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