'use client';

import { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiBookOpen, FiZap, FiAlertCircle } from 'react-icons/fi';

interface QuestionResult {
    question_number: number;
    sub_question_number?: number;
    question_text: string;
    question_text_cn?: string;
    selected_answer_key: string | null;
    correct_answer_key: string;
    correct_answer_text?: string;
    selected_answer_text?: string;
    is_correct: boolean;
    options?: { key: string; text: string; text_cn?: string; is_correct: boolean }[];
}

interface Explanation {
    questionNumber: number;
    yourAnswer: string;
    correctAnswer: string;
    whyWrong: string;
    knowledgeNote: string;
    tip: string;
    vocabulary?: { word: string; pinyin: string; meaning: string }[];
}

interface AIExplanationsProps {
    attemptId: number;
    questions: QuestionResult[];
}

export default function AIExplanations({ attemptId, questions }: AIExplanationsProps) {
    const [explanations, setExplanations] = useState<Explanation[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryAfter, setRetryAfter] = useState<number>(0);

    const wrongQuestions = questions.filter(q => !q.is_correct && q.selected_answer_key);

    useEffect(() => {
        if (wrongQuestions.length === 0) { setLoading(false); return; }
        loadExplanations();
    }, [attemptId]);

    useEffect(() => {
        if (retryAfter <= 0) return;
        const t = setInterval(() => {
            setRetryAfter(prev => {
                if (prev <= 1) { loadExplanations(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [retryAfter]);

import { authFetch } from '@/lib/utils/authFetch';

    const loadExplanations = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await authFetch(`/api/ai/exam/${attemptId}/explanations`);
            const data = await res.json();

            if (data.rateLimited) {
                setRetryAfter(data.retryAfter || 60);
                setError('AI đang bận, vui lòng đợi...');
                // Dùng fallback
                setExplanations(wrongQuestions.map((q, i) => ({
                    questionNumber: q.sub_question_number || q.question_number || i + 1,
                    yourAnswer: `${q.selected_answer_key || '?'}. ${q.selected_answer_text || ''}`,
                    correctAnswer: `${q.correct_answer_key || '?'}. ${q.correct_answer_text || ''}`,
                    whyWrong: 'Hãy ôn lại phần này và làm lại bài.',
                    knowledgeNote: '',
                    tip: 'Đọc kỹ đề bài và học thuộc từ vựng liên quan.',
                    vocabulary: [],
                })));
                return;
            }

            if (data.success) {
                setExplanations(data.explanations?.explanations || []);
            }
        } catch (err) {
            setError('Không thể tải phân tích AI');
        } finally {
            setLoading(false);
        }
    };

    const loadSingleExplanation = async (question: QuestionResult, index: number) => {
        setLoadingIndex(index);
        try {
            // Gọi chatbot với câu hỏi cụ thể
            const res = await authFetch('/api/ai/ask', {
                method: 'POST',
                body: JSON.stringify({
                    question: `Câu ${question.sub_question_number || question.question_number} sai. Giải thích tại sao đáp án "${question.selected_answer_key}. ${question.selected_answer_text}" sai và "${question.correct_answer_key}. ${question.correct_answer_text}" đúng?`,
                    attemptId,
                }),
            });
            const data = await res.json();
            if (data.success) {
                const newExp = [...explanations];
                newExp[index] = {
                    ...(newExp[index] || {}),
                    questionNumber: question.sub_question_number || question.question_number || index + 1,
                    yourAnswer: `${question.selected_answer_key || '?'}. ${question.selected_answer_text || ''}`,
                    correctAnswer: `${question.correct_answer_key || '?'}. ${question.correct_answer_text || ''}`,
                    whyWrong: data.answer,
                    knowledgeNote: '',
                    tip: 'Hãy ghi nhớ và ôn lại phần này.',
                    vocabulary: [],
                };
                setExplanations(newExp);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingIndex(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-200 border-t-purple-600" />
                    <span className="text-gray-600 text-sm">AI đang phân tích các câu sai...</span>
                </div>
            </div>
        );
    }

    if (wrongQuestions.length === 0) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiCheckCircle className="text-green-600" size={24} />
                </div>
                <h3 className="font-bold text-green-800 mb-1">Tuyệt vời! Bạn không có câu sai!</h3>
                <p className="text-green-700 text-sm">Tất cả các câu trả lời đều chính xác. Hãy thử thách bản thân với đề khó hơn nhé!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
                        <FiBookOpen className="text-white" size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">📚 Phân tích câu sai bằng AI</h3>
                        <p className="text-gray-500 text-xs">DeepSeek R1 giải thích chi tiết từng câu bạn sai</p>
                    </div>
                </div>
                {error && (
                    <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 rounded-lg px-3 py-2">
                        <FiAlertCircle size={14} />
                        {error} {retryAfter > 0 && `(${retryAfter}s)`}
                    </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                    <span className="flex items-center gap-1"><FiXCircle className="text-red-500" size={12} /> {wrongQuestions.length} câu sai</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><FiCheckCircle className="text-green-500" size={12} /> {explanations.length} đã phân tích</span>
                </div>
            </div>

            {wrongQuestions.map((q, i) => {
                const exp = explanations[i];
                const isLoadingThis = loadingIndex === i;

                return (
                    <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                        {/* Câu hỏi */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-red-600 font-bold text-sm">
                                    {q.sub_question_number || q.question_number || i + 1}
                                </span>
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900">{q.question_text || q.question_text_cn}</p>
                                {q.question_text_cn && q.question_text && (
                                    <p className="text-gray-500 text-sm mt-1">{q.question_text_cn}</p>
                                )}
                            </div>
                        </div>

                        {/* Đáp án */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-red-600 mb-1">✗ Đáp án của bạn</p>
                                <p className="text-red-800 font-semibold text-sm">
                                    {q.selected_answer_key || '?'}. {q.selected_answer_text || ''}
                                </p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-green-600 mb-1">✓ Đáp án đúng</p>
                                <p className="text-green-800 font-semibold text-sm">
                                    {q.correct_answer_key || '?'}. {q.correct_answer_text || ''}
                                </p>
                            </div>
                        </div>

                        {/* AI Explanation */}
                        {exp ? (
                            <div className="space-y-3">
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                                        <FiZap size={12} /> Tại sao sai?
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{exp.whyWrong}</p>
                                </div>

                                {exp.knowledgeNote && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                        <p className="text-xs font-bold text-blue-700 mb-2">📖 Kiến thức liên quan</p>
                                        <p className="text-sm text-blue-800 leading-relaxed">{exp.knowledgeNote}</p>
                                    </div>
                                )}

                                {exp.tip && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <p className="text-xs font-bold text-amber-700 mb-2">💡 Mẹo ghi nhớ</p>
                                        <p className="text-sm text-amber-800">{exp.tip}</p>
                                    </div>
                                )}

                                {exp.vocabulary && exp.vocabulary.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">生词 (Từ mới)</p>
                                        <div className="flex flex-wrap gap-2">
                                            {exp.vocabulary.map((v, vi) => (
                                                <div key={vi} className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                                                    <span className="text-orange-600 font-bold text-sm">{v.word}</span>
                                                    <span className="text-gray-400 text-xs ml-1">{v.pinyin}</span>
                                                    <span className="text-gray-600 text-xs ml-2">{v.meaning}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                                <p className="text-gray-500 text-sm mb-3">
                                    {isLoadingThis ? 'AI đang phân tích...' : 'Chưa có phân tích cho câu này'}
                                </p>
                                {!isLoadingThis && (
                                    <button
                                        onClick={() => loadSingleExplanation(q, i)}
                                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition-colors">
                                        <FiZap size={14} className="inline mr-1" />
                                        Phân tích câu này
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
