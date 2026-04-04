'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { examAdminApi } from '@/lib/api/examAdmin';
import { FiChevronLeft, FiSearch, FiBookOpen, FiChevronRight } from 'react-icons/fi';

interface Exam {
    id: number;
    title: string;
    subject_name: string;
    subject_code: string;
    duration: number;
    questions_count: number;
    status: 'draft' | 'published' | 'archived';
    created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    published: { label: 'Published', cls: 'bg-green-100 text-green-800' },
    draft: { label: 'Draft', cls: 'bg-yellow-100 text-yellow-800' },
    archived: { label: 'Archived', cls: 'bg-gray-100 text-gray-700' },
};

const LIMIT = 20;

export default function AdminQuestionsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalExams, setTotalExams] = useState(0);

    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') { router.push('/'); return; }
        loadExams();
    }, [isAuthenticated, user, page]);

    const loadExams = async () => {
        try {
            setLoading(true);
            const data = await examAdminApi.getAllExams(page, LIMIT);
            setExams(data.exams || []);
            setTotalPages(data.pagination?.totalPages ?? 1);
            setTotalExams(data.pagination?.totalExams ?? 0);
        } catch {
            console.error('Load exams error');
        } finally {
            setLoading(false);
        }
    };

    const filtered = exams.filter(e =>
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.subject_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link href="/admin" className="text-gray-500 hover:text-gray-800 transition-colors">
                        <FiChevronLeft size={22} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Quản lý Câu Hỏi</h1>
                        <p className="text-sm text-gray-500">Chọn đề thi để xem và chỉnh sửa câu hỏi · {totalExams} đề</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6">
                {/* Search */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-3">
                    <FiSearch className="text-gray-400 shrink-0" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên đề thi hoặc môn học..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 outline-none text-gray-800 placeholder-gray-400 text-sm"
                    />
                </div>

                {/* Exam cards */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FiBookOpen size={48} className="mx-auto mb-3 opacity-40" />
                        <p>Không tìm thấy đề thi nào</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map(exam => {
                            const st = STATUS_LABELS[exam.status] ?? STATUS_LABELS.draft;
                            return (
                                <Link
                                    key={exam.id}
                                    href={`/admin/exams/${exam.id}`}
                                    className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-400 hover:shadow-md transition-all group flex items-center gap-4"
                                >
                                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                                        <FiBookOpen size={22} className="text-purple-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{exam.title}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-xs text-gray-500">{exam.subject_name}</span>
                                            <span className="text-gray-300">·</span>
                                            <span className="text-xs text-gray-500">{exam.questions_count ?? 0} câu hỏi</span>
                                            <span className="text-gray-300">·</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                                        </div>
                                    </div>
                                    <FiChevronRight size={18} className="text-gray-400 shrink-0 group-hover:text-purple-500 transition-colors" />
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
                        <span>Trang {page}/{totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FiChevronLeft size={14} /> Trước
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Sau <FiChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
