'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi } from '@/lib/api/examAdmin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiChevronLeft, FiEdit2, FiTrash2, FiPlus, FiCheckCircle, FiXCircle, FiImage } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface Answer {
    id: number;
    answer_key: string;
    answer_text: string;
    answer_text_cn: string;
    image_url?: string;
    is_correct: boolean;
}

interface Question {
    id: number;
    question_number: number;
    question_text: string;
    question_text_cn?: string;
    image_url?: string;
    points: number;
    explanation?: string;
    answers: Answer[];
}

interface Exam {
    id: number;
    title: string;
    subject_name?: string;
    duration: number;
    total_points: number;
    total_questions: number;
    status: string;
    description?: string;
    allow_download: boolean;
    is_premium?: boolean;
}

export default function AdminExamDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'exams.manage'))) {
            router.push('/');
            return;
        }
        loadExam();
    }, [id, isAuthenticated, user]);

    const loadExam = async () => {
        try {
            setLoading(true);
            const data = await examAdminApi.getExamForEdit(Number(id));
            setExam(data.exam);
            setQuestions(data.questions || []);
        } catch (error: any) {
            alert('Không thể tải đề thi: ' + (error.response?.data?.message || error.message));
            router.push('/admin/exams');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteQuestion = async (questionId: number) => {
        if (!confirm('Xóa câu hỏi này?')) return;
        try {
            setDeleting(questionId);
            await examAdminApi.deleteQuestion(questionId);
            setQuestions(prev => prev.filter(q => q.id !== questionId));
            if (exam) setExam({ ...exam, total_questions: exam.total_questions - 1 });
        } catch (error: any) {
            alert('Lỗi xóa câu hỏi: ' + (error.response?.data?.message || ''));
        } finally {
            setDeleting(null);
        }
    };

    const handleStatusChange = async (status: 'draft' | 'published' | 'archived') => {
        try {
            await examAdminApi.updateExamStatus(Number(id), status);
            if (exam) setExam({ ...exam, status });
        } catch (error: any) {
            alert('Lỗi đổi trạng thái');
        }
    };

    const handleDeleteExam = async () => {
        if (!confirm(`Xóa đề thi "${exam?.title}"? Hành động này không thể hoàn tác!`)) return;
        try {
            await examAdminApi.deleteExam(Number(id));
            router.push('/admin/exams');
        } catch (error: any) {
            alert('Lỗi xóa đề thi: ' + (error.response?.data?.message || ''));
        }
    };

    const handleToggleDownload = async () => {
        if (!exam) return;
        try {
            const newVal = !exam.allow_download;
            await examAdminApi.updateExam(Number(id), { allow_download: newVal });
            setExam({ ...exam, allow_download: newVal });
        } catch {
            alert('Lỗi cập nhật quyền tải');
        }
    };

    const handleTogglePremium = async () => {
        if (!exam) return;
        try {
            const newVal = !exam.is_premium;
            await examAdminApi.updateExam(Number(id), { is_premium: newVal });
            setExam({ ...exam, is_premium: newVal });
        } catch {
            alert('Lỗi cập nhật VIP');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
            </div>
        );
    }

    if (!exam) return null;

    const statusColor = exam.status === 'published'
        ? 'bg-green-100 text-green-800 border-green-200'
        : exam.status === 'draft'
            ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
            : 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/admin/exams')}
                                className="text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                <FiChevronLeft size={22} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
                                <p className="text-sm text-gray-500">
                                    {exam.subject_name} • {exam.duration} phút • {exam.total_questions} câu
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={exam.status}
                                onChange={e => handleStatusChange(e.target.value as any)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer outline-none ${statusColor}`}
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                            <button
                                onClick={handleDeleteExam}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                            >
                                <FiTrash2 size={16} /> Xóa đề
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Exam Info */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Môn học</p>
                            <p className="font-bold text-gray-900">{exam.subject_name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Thời gian</p>
                            <p className="font-bold text-gray-900">{exam.duration} phút</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Tổng điểm</p>
                            <p className="font-bold text-gray-900">{exam.total_points} điểm</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Số câu</p>
                            <p className="font-bold text-gray-900">{exam.total_questions} câu</p>
                        </div>
                    </div>
                    {exam.description && (
                        <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">{exam.description}</p>
                    )}
                    {/* Download toggle */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Cho phép tải PDF</p>
                            <p className="text-xs text-gray-400">Thí sinh có thể in / tải đề thi này về máy</p>
                        </div>
                        <button
                            onClick={handleToggleDownload}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                exam.allow_download ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                exam.allow_download ? 'translate-x-7' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {/* VIP / Premium toggle */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-700">Nội dung VIP</p>
                                <p className="text-xs text-gray-400">Chỉ thành viên PRO mới được làm bài thi này</p>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-md">
                                <FaCrown /> PRO
                            </span>
                        </div>
                        <button
                            onClick={handleTogglePremium}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                exam.is_premium ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                exam.is_premium ? 'translate-x-7' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>
                </div>

                {/* Questions */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Danh sách câu hỏi ({questions.length})</h2>
                    <button
                        onClick={() => router.push(`/admin/exams/create?examId=${id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                        <FiPlus size={16} /> Thêm câu hỏi
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                        <p className="text-lg mb-2">Chưa có câu hỏi nào</p>
                        <p className="text-sm">Click "Thêm câu hỏi" để bắt đầu</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-6">
                                {/* Question Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">
                                            {q.question_number}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-gray-900 font-medium">{q.question_text}</p>
                                            {q.question_text_cn && q.question_text_cn !== q.question_text && (
                                                <p className="text-gray-500 text-sm mt-1">{q.question_text_cn}</p>
                                            )}
                                            {q.image_url && (
                                                <img src={q.image_url} alt="question" className="mt-2 max-h-32 rounded-lg border border-gray-200" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <span className="text-xs text-gray-400">{q.points} điểm</span>
                                        <button
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            disabled={deleting === q.id}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="Xóa câu hỏi"
                                        >
                                            {deleting === q.id
                                                ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                                                : <FiTrash2 size={15} />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Answers */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {q.answers?.map(a => (
                                        <div
                                            key={a.id}
                                            className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${a.is_correct
                                                    ? 'border-green-300 bg-green-50'
                                                    : 'border-gray-200 bg-gray-50'
                                                }`}
                                        >
                                            <span className={`font-bold text-sm flex-shrink-0 ${a.is_correct ? 'text-green-700' : 'text-gray-500'}`}>
                                                {a.answer_key}.
                                            </span>
                                            <div className="flex-1 text-sm">
                                                <span className={a.is_correct ? 'text-green-800 font-medium' : 'text-gray-700'}>
                                                    {a.answer_text}
                                                </span>
                                                {a.answer_text_cn && a.answer_text_cn !== a.answer_text && (
                                                    <p className="text-gray-500 text-xs mt-0.5">{a.answer_text_cn}</p>
                                                )}
                                                {a.image_url && (
                                                    <img src={a.image_url} alt={a.answer_key} className="mt-1 max-h-16 rounded border border-gray-200" />
                                                )}
                                            </div>
                                            {a.is_correct && <FiCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={15} />}
                                        </div>
                                    ))}
                                </div>

                                {q.explanation && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Giải thích:</p>
                                        <p className="text-sm text-gray-600">{q.explanation}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
