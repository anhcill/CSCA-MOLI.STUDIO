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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
            <Header />
            <main className="container mx-auto px-6 py-8 max-w-4xl">
                {/* Page Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-4"
                    >
                        <FiArrowLeft size={18} />
                        <span className="text-sm font-medium">Quay lại trang chủ</span>
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Kết quả thi gần đây</h1>
                    <p className="text-gray-500 mt-2">Xem lại các bài thi đã làm</p>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                        <p className="text-3xl font-bold text-purple-600">{attempts.length}</p>
                        <p className="text-sm text-gray-500 mt-1">Bài thi đã làm</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                        <p className="text-3xl font-bold text-green-600">
                            {attempts.length > 0
                                ? (attempts.reduce((s, a) => s + Number(a.total_score), 0) / attempts.length).toFixed(1)
                                : '0'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Điểm TB</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                        <p className="text-3xl font-bold text-yellow-600">
                            {attempts.length > 0 ? Math.max(...attempts.map(a => Number(a.total_score))).toFixed(1) : '0'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Điểm cao nhất</p>
                    </div>
                </div>

                {/* Results List */}
                {attempts.length === 0 ? (
                    <div className="bg-white rounded-2xl border p-12 text-center">
                        <FiClock size={48} className="text-gray-300 mx-auto mb-4" />
                        <p className="text-lg text-gray-500 mb-2">Chưa có kết quả thi nào</p>
                        <p className="text-sm text-gray-400 mb-6">Hãy làm bài thi để xem kết quả tại đây</p>
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                        >
                            <FiHome size={18} />
                            Về trang chủ làm bài thi
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {attempts.map((attempt, index) => (
                            <div
                                key={attempt.id || index}
                                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow p-5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 text-lg">{attempt.exam_title}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {attempt.subject_name && `· ${attempt.subject_name}`} ·{' '}
                                            {formatDate(attempt.submit_time)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-sm text-gray-500">
                                                {attempt.total_correct || 0} / {attempt.total_questions || attempt.answers?.length || '?'} đúng
                                            </span>
                                            {attempt.answers && (
                                                <span className="text-xs text-gray-400">
                                                    · {attempt.answers.filter((a: QuestionResult) => a.is_correct).length} correct
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-3xl font-black ${getScoreColor(Number(attempt.total_score))}`}>
                                                {(Number(attempt.total_score) || 0).toFixed(1)}
                                            </p>
                                            <p className="text-xs text-gray-400">điểm</p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => router.push(`/exam/result/${attempt.id}`)}
                                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold transition-colors"
                                            >
                                                <FiPrinter size={14} />
                                                Xem chi tiết
                                            </button>
                                            <button
                                                onClick={() => router.push(`/exam/${attempt.exam_id}`)}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-semibold transition-colors"
                                            >
                                                <FiRefreshCw size={14} />
                                                Làm lại
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}