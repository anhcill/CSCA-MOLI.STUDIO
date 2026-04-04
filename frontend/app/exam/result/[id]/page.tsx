'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import examApi from '@/lib/api/exams';
import { FiCheckCircle, FiXCircle, FiClock, FiArrowLeft, FiPrinter, FiMinus } from 'react-icons/fi';

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

export default function ExamResultPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [result, setResult] = useState<AttemptResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadResult();
    }, [params.id]);

    const loadResult = async () => {
        try {
            setLoading(true);
            const data = await examApi.getAttemptDetails(params.id);
            setResult(data);
        } catch (error) {
            console.error('Error loading result:', error);
        } finally {
            setLoading(false);
        }
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

    if (!result) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
                <Header />
                <main className="container mx-auto px-6 py-8">
                    <div className="text-center py-12">
                        <p className="text-gray-600">Không tìm thấy kết quả bài thi</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            Quay lại
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Derive stats from answers array
    const answers = result.answers ?? [];
    const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
    const totalIncorrect = answers.filter(a => a.selected_answer_key && !a.is_correct).length;
    const totalUnanswered = answers.filter(a => !a.selected_answer_key).length;
    const total = answers.length || result.total_questions || 1;
    const accuracy = Math.round((totalCorrect / total) * 100);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50">
            {/* Print CSS */}
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
            <Header />
            <main className="container mx-auto px-6 py-8 max-w-5xl">
                {/* Back Button + Print */}
                <div className="flex items-center justify-between mb-6 no-print">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center space-x-2 text-gray-600 hover:text-purple-600 transition-colors"
                    >
                        <FiArrowLeft size={20} />
                        <span className="font-medium">Quay lại</span>
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                    >
                        <FiPrinter size={16} />
                        Xuất PDF
                    </button>
                </div>

                {/* Result Summary */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">{result.exam_title}</h1>
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <FiClock size={14} />
                                <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-5xl font-bold text-purple-600">
                                {(Number(result.total_score) || 0).toFixed(1)}
                            </p>
                            <p className="text-gray-500 text-sm">/ 10 điểm</p>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Đúng</p>
                                    <p className="text-2xl font-bold text-green-600">{totalCorrect}</p>
                                </div>
                                <FiCheckCircle className="text-green-600" size={32} />
                            </div>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Sai</p>
                                    <p className="text-2xl font-bold text-red-600">{totalIncorrect}</p>
                                </div>
                                <FiXCircle className="text-red-600" size={32} />
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Bỏ qua</p>
                                    <p className="text-2xl font-bold text-gray-600">{totalUnanswered}</p>
                                </div>
                                <FiMinus className="text-gray-500" size={32} />
                            </div>
                        </div>
                    </div>

                    {/* Accuracy Bar */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Độ chính xác</span>
                            <span className="font-semibold">{accuracy}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                                style={{ width: `${accuracy}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Questions Detail */}
                {answers.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                        <p className="text-lg">Không có dữ liệu câu hỏi chi tiết</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Chi tiết từng câu ({answers.length} câu)</h2>

                        {answers.map((q, index) => {
                            const status = !q.selected_answer_key ? 'unanswered' : q.is_correct ? 'correct' : 'incorrect';
                            const borderCls =
                                status === 'correct' ? 'bg-green-50 border-green-200' :
                                    status === 'incorrect' ? 'bg-red-50 border-red-200' :
                                        'bg-gray-50 border-gray-200';

                            return (
                                <div key={index} className={`rounded-xl border-2 p-6 transition-all ${borderCls}`}>
                                    {/* Question Header */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {status === 'correct' && <FiCheckCircle className="text-green-600" size={22} />}
                                            {status === 'incorrect' && <FiXCircle className="text-red-600" size={22} />}
                                            {status === 'unanswered' && <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                                                Câu {q.question_number ?? index + 1} · {q.points} điểm
                                            </p>
                                            <p className="text-gray-900 font-medium leading-relaxed">{q.question_text}</p>
                                            {q.question_text_cn && q.question_text_cn !== q.question_text && (
                                                <p className="text-gray-500 text-sm mt-1">{q.question_text_cn}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="space-y-2 ml-8">
                                        {(q.options ?? []).map((opt) => {
                                            const isCorrect = opt.is_correct;
                                            const isUserPick = q.selected_answer_key === opt.key;

                                            let bg = 'bg-white';
                                            let border = 'border-gray-200';
                                            let text = 'text-gray-700';

                                            if (isCorrect) {
                                                bg = 'bg-green-100'; border = 'border-green-500'; text = 'text-green-900';
                                            } else if (isUserPick && !isCorrect) {
                                                bg = 'bg-red-100'; border = 'border-red-500'; text = 'text-red-900';
                                            }

                                            return (
                                                <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${bg} ${border}`}>
                                                    <span className={`font-bold text-sm shrink-0 ${text}`}>{opt.key}.</span>
                                                    <div className="flex-1">
                                                        <span className={`text-sm ${text}`}>{opt.text}</span>
                                                        {opt.text_cn && (
                                                            <p className="text-xs text-gray-500 mt-0.5">{opt.text_cn}</p>
                                                        )}
                                                    </div>
                                                    {isCorrect && (
                                                        <span className="ml-auto text-green-700 font-semibold text-xs shrink-0">✓ Đáp án đúng</span>
                                                    )}
                                                    {isUserPick && !isCorrect && (
                                                        <span className="ml-auto text-red-700 font-semibold text-xs shrink-0">✗ Bạn chọn</span>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Unanswered note */}
                                        {!q.selected_answer_key && (
                                            <p className="text-sm text-gray-400 italic mt-1">
                                                Bạn đã bỏ qua câu này · Đáp án đúng: <strong className="text-gray-600">{q.correct_answer_key}</strong>
                                            </p>
                                        )}
                                    </div>

                                    {/* Explanation */}
                                    {q.explanation && (
                                        <div className="mt-4 ml-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-sm font-semibold text-blue-900 mb-1">💡 Giải thích:</p>
                                            <p className="text-sm text-blue-800">{q.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
