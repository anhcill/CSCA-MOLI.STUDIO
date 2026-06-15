'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { useSearchParams, useRouter } from 'next/navigation';
import examApi from '@/lib/api/exams';
import { FiCheckCircle, FiXCircle, FiClock, FiArrowLeft, FiPrinter, FiMinus, FiRefreshCw, FiHome } from 'react-icons/fi';

interface AnswerOption {
    key: string;
    text: string;
    text_cn?: string | null;
    is_correct: boolean;
}

interface QuestionResult {
    question_number: number;
    question_text: string;
    question_text_cn?: string;
    selected_answer_key: string | null;
    selected_answer_text: string;
    correct_answer_key: string;
    correct_answer_text: string;
    is_correct: boolean;
    points: number;
    explanation?: string;
    options: AnswerOption[];
}

interface AttemptResult {
    id: number;
    exam_id: number;
    exam_title: string;
    subject_name: string;
    total_score: number;
    total_correct: number;
    submit_time: string;
    total_questions: number;
    answers: QuestionResult[];
}

function getAttemptResultHref(attempt: Pick<AttemptResult, 'id' | 'exam_id'>) {
    const examId = Number(attempt.exam_id);
    return Number.isFinite(examId) && examId > 0
        ? `/exam/${examId}/result?attemptId=${attempt.id}`
        : `/exam/result/${attempt.id}`;
}

export default function ExamResultListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [attempts, setAttempts] = useState<AttemptResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRecentResults();
    }, []);

    const loadRecentResults = async () => {
        try {
            setLoading(true);
            const data = await examApi.getHistory(undefined, 10);
            // data should be an array of attempts, or { attempts: [...] }
            const attemptList = Array.isArray(data) ? data : (data.attempts || []);
            setAttempts(attemptList.slice(0, 10)); // chỉ lấy 10 kết quả gần nhất
        } catch (error) {
            console.error('Error loading results:', error);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-600';
        if (score >= 6) return 'text-yellow-600';
        return 'text-red-600';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
                <Header />
                <main className="container mx-auto px-6 py-8">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <Header />
            <main className="container mx-auto px-4 sm:px-6 py-8 max-w-[1360px]">
                {/* Page Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-4 font-semibold text-sm group"
                    >
                        <FiArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Quay lại trang chủ</span>
                    </button>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Kết quả thi gần đây</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1.5 font-medium">Xem lại và học tập từ các bài thi đã thực hiện</p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100/80 dark:border-gray-800/80 p-6 text-center transition-all hover:shadow-2xl hover:-translate-y-0.5 duration-350">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-500 rounded-b-lg" />
                        <p className="text-4xl font-black bg-gradient-to-br from-purple-500 to-indigo-650 bg-clip-text text-transparent">{attempts.length}</p>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-2">Bài thi đã làm</p>
                    </div>
                    <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100/80 dark:border-gray-800/80 p-6 text-center transition-all hover:shadow-2xl hover:-translate-y-0.5 duration-350">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-b-lg" />
                        <p className="text-4xl font-black bg-gradient-to-br from-emerald-500 to-teal-650 bg-clip-text text-transparent">
                            {attempts.length > 0
                                ? (attempts.reduce((s, a) => s + Number(a.total_score), 0) / attempts.length).toFixed(1)
                                : '0'}
                        </p>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-2">Điểm trung bình</p>
                    </div>
                    <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100/80 dark:border-gray-800/80 p-6 text-center transition-all hover:shadow-2xl hover:-translate-y-0.5 duration-350">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-500 rounded-b-lg" />
                        <p className="text-4xl font-black bg-gradient-to-br from-amber-500 to-orange-650 bg-clip-text text-transparent">
                            {attempts.length > 0 ? Math.max(...attempts.map(a => Number(a.total_score))).toFixed(1) : '0'}
                        </p>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-2">Điểm cao nhất</p>
                    </div>
                </div>

                {/* Results List */}
                {attempts.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-16 text-center shadow-lg">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-405 dark:text-indigo-400">
                            <FiClock size={36} />
                        </div>
                        <p className="text-xl font-bold text-gray-805 dark:text-white mb-2">Chưa có kết quả thi nào</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 max-w-md mx-auto">Hãy bắt đầu làm các đề thi để theo dõi quá trình tiến bộ của bạn tại đây.</p>
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-lg shadow-purple-650/20 active:scale-[0.98]"
                        >
                            <FiHome size={18} />
                            Về trang chủ làm đề thi
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {attempts.map((attempt, index) => {
                            const scoreVal = Number(attempt.total_score) || 0;
                            const isExcellent = scoreVal >= 8.5;
                            const isPass = scoreVal >= 6.0;
                            const badgeColor = isExcellent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' : isPass ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30';
                            const scoreGradient = isExcellent ? 'from-emerald-400 to-emerald-600' : isPass ? 'from-blue-400 to-blue-600' : 'from-rose-400 to-rose-600';

                            return (
                                <div
                                    key={attempt.id || index}
                                    className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100/80 dark:border-gray-800/80 hover:shadow-xl transition-all duration-300 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="font-extrabold text-gray-900 dark:text-white text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">{attempt.exam_title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
                                                {attempt.subject_name || 'Đề thi'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium flex items-center gap-1.5">
                                            <FiClock size={12} />
                                            {formatDate(attempt.submit_time)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-3">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-450 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-lg">
                                                ✅ {attempt.total_correct || 0} / {attempt.total_questions || attempt.answers?.length || '?'} đúng
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-gray-55/60 dark:border-gray-800/60">
                                        <div className="text-center md:text-right shrink-0">
                                            <div className="relative inline-flex items-center justify-center">
                                                <div className={`absolute inset-0 rounded-full blur-md opacity-20 bg-gradient-to-br ${scoreGradient}`} />
                                                <span className={`relative text-3xl font-black bg-gradient-to-br ${scoreGradient} bg-clip-text text-transparent`}>
                                                    {scoreVal.toFixed(1)}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Điểm số</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(getAttemptResultHref(attempt))}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-purple-650/10 active:scale-[0.97]"
                                            >
                                                <span>Xem chi tiết</span>
                                            </button>
                                            <button
                                                onClick={() => router.push(`/exam/${attempt.exam_id}`)}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-650 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
                                            >
                                                <FiRefreshCw size={12} />
                                                <span>Làm lại</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
