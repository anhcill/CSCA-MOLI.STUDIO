'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { useSearchParams, useRouter } from 'next/navigation';
import examApi from '@/lib/api/exams';
import { FiCheckCircle, FiXCircle, FiClock, FiArrowLeft, FiPrinter, FiMinus, FiRefreshCw, FiHome } from 'react-icons/fi';
import InkResultBackground, {
    inkResultMuted,
    inkResultPanel,
    inkResultScore,
    inkResultSoftPanel,
    inkResultTitle,
} from '@/components/layout/InkResultBackground';

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
            console.warn('Error loading results:', error);
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
            <InkResultBackground>
                <Header />
                <main className="container mx-auto px-6 py-8">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d52a1e]" />
                    </div>
                </main>
            </InkResultBackground>
        );
    }

    return (
        <InkResultBackground>
            <Header />
            <main className="container mx-auto px-4 sm:px-6 py-8 max-w-[1360px]">
                {/* Page Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-4 font-semibold text-sm group dark:text-gray-400 dark:hover:text-purple-300"
                    >
                        <FiArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Quay lại</span>
                    </button>
                    <h1 className={`text-3xl sm:text-4xl font-black ${inkResultTitle}`}>Kết quả thi gần đây</h1>
                    <p className={`${inkResultMuted} mt-1.5 font-medium`}>Xem lại và học tập từ các bài thi đã thực hiện</p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    <div className={`relative rounded-3xl p-6 text-center transition-all hover:-translate-y-0.5 duration-350 ${inkResultSoftPanel}`}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-500 rounded-b-lg" />
                        <p className={`text-4xl font-black ${inkResultScore}`}>{attempts.length}</p>
                        <p className={`text-xs font-bold uppercase tracking-wider mt-2 ${inkResultMuted}`}>Bài thi đã làm</p>
                    </div>
                    <div className={`relative rounded-3xl p-6 text-center transition-all hover:-translate-y-0.5 duration-350 ${inkResultSoftPanel}`}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-b-lg" />
                        <p className="text-4xl font-black text-emerald-700">
                            {attempts.length > 0
                                ? (attempts.reduce((s, a) => s + Number(a.total_score), 0) / attempts.length).toFixed(1)
                                : '0'}
                        </p>
                        <p className={`text-xs font-bold uppercase tracking-wider mt-2 ${inkResultMuted}`}>Điểm trung bình</p>
                    </div>
                    <div className={`relative rounded-3xl p-6 text-center transition-all hover:-translate-y-0.5 duration-350 ${inkResultSoftPanel}`}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-500 rounded-b-lg" />
                        <p className="text-4xl font-black text-amber-700">
                            {attempts.length > 0 ? Math.max(...attempts.map(a => Number(a.total_score))).toFixed(1) : '0'}
                        </p>
                        <p className={`text-xs font-bold uppercase tracking-wider mt-2 ${inkResultMuted}`}>Điểm cao nhất</p>
                    </div>
                </div>

                {/* Results List */}
                {attempts.length === 0 ? (
                    <div className={`rounded-3xl p-16 text-center ${inkResultPanel}`}>
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-405 dark:text-indigo-400">
                            <FiClock size={36} />
                        </div>
                        <p className={`text-xl font-bold mb-2 ${inkResultTitle}`}>Chưa có kết quả thi nào</p>
                        <p className={`text-sm mb-8 max-w-md mx-auto ${inkResultMuted}`}>Hãy bắt đầu làm các đề thi để theo dõi quá trình tiến bộ của bạn tại đây.</p>
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
                                    className={`rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 group transition-all duration-300 hover:shadow-[0_20px_60px_rgba(129,77,33,0.14)] ${inkResultSoftPanel}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className={`font-extrabold text-lg transition-colors truncate group-hover:text-[#d52a1e] ${inkResultTitle}`}>{attempt.exam_title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
                                                {attempt.subject_name || 'Đề thi'}
                                            </span>
                                        </div>
                                        <p className={`text-xs mt-2 font-medium flex items-center gap-1.5 ${inkResultMuted}`}>
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
                                                <span className={`relative text-3xl font-black ${scoreVal >= 8.5 ? 'text-emerald-700' : isPass ? 'text-blue-700' : inkResultScore}`}>
                                                    {scoreVal.toFixed(1)}
                                                </span>
                                            </div>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${inkResultMuted}`}>Điểm số</p>
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
        </InkResultBackground>
    );
}
