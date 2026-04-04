'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi } from '@/lib/api/examAdmin';
import { FiFileText, FiPlus, FiTrash2, FiEye, FiChevronLeft, FiChevronRight, FiCheck, FiX } from 'react-icons/fi';

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

    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') {
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Quản lý Đề Thi
                            </h1>
                            <p className="text-gray-600 mt-1">Danh sách đề thi và tool import PDF</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/admin/exams/create')}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow flex items-center gap-2"
                            >
                                <FiPlus /> Tạo Đề Thi Mới
                            </button>
                            <button
                                onClick={() => router.push('/admin')}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                            >
                                ← Quay lại
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Exams Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Tiêu đề
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Môn học
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Câu hỏi
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Lượt thi
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Trạng thái
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {exams.map((exam) => (
                                    <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            #{exam.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                                            <div className="text-xs text-gray-500">{exam.duration} phút • {exam.total_points} điểm</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {exam.subject_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {exam.questions_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex gap-2 justify-end">
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
            </main>

        </div>
    );
}
