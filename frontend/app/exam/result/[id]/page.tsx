'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import examApi from '@/lib/api/exams';
import { FiCheckCircle, FiXCircle, FiClock, FiArrowLeft, FiPrinter, FiMinus, FiTrendingUp, FiTrendingDown, FiZap, FiChevronDown, FiMessageCircle, FiBarChart2, FiBookOpen, FiCpu } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { authFetch } from '@/lib/utils/authFetch';
import AIChatbot from '@/components/ai/AIChatbot';
import AIExamAnalysis from '@/components/ai/AIExamAnalysis';

interface AnswerOption {
    key: string;
    text: string;
    text_cn?: string | null;
    is_correct: boolean;
}

interface QuestionResult {
    question_number: number;
    sub_question_number?: number;
    question_text: string;
    question_text_cn?: string;
    question_type?: string;
    passage_text?: string;
    selected_answer_key: string | null;
    selected_answer_text: string;
    correct_answer_key: string;
    correct_answer_text: string;
    is_correct: boolean;
    points: number;
    explanation?: string;
    explanation_cn?: string;
    options: AnswerOption[];
    difficulty?: string;
}

interface AttemptResult {
    id: number;
    exam_id: number;
    exam_title: string;
    title_cn?: string;
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
    const [activeTab, setActiveTab] = useState<'result' | 'review' | 'chat'>('result');
    const [showExplanationModal, setShowExplanationModal] = useState<QuestionResult | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        loadResult();
    }, [params.id]);

    const loadResult = async () => {
        try {
            setLoading(true);
            const data = await examApi.getAttemptDetails(params.id);
            setResult(data);
            if (data.id) {
                loadAIAnalysis(data.id);
            }
        } catch (error) {
            console.error('Error loading result:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAIAnalysis = async (attemptId: number) => {
        try {
            setAiLoading(true);
            const res = await authFetch(`/api/ai/exam-result/${attemptId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setAiAnalysis(data);
            }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600" />
                        <p className="text-gray-500">Đang tải kết quả...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center py-12">
                        <p className="text-gray-600">Không tìm thấy kết quả bài thi</p>
                        <button onClick={() => router.back()}
                            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            Quay lại
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const answers = result.answers ?? [];
    const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
    const totalIncorrect = answers.filter(a => a.selected_answer_key && !a.is_correct).length;
    const totalUnanswered = answers.filter(a => !a.selected_answer_key).length;
    const total = answers.length || result.total_questions || 1;
    const accuracy = Math.round((totalCorrect / total) * 100);
    const score = Number(result.total_score) || 0;

    const gradeColor = accuracy >= 85 ? 'emerald' : accuracy >= 60 ? 'blue' : accuracy >= 40 ? 'amber' : 'red';
    const gradeLabel = accuracy >= 85 ? 'Xuất sắc!' : accuracy >= 60 ? 'Đạt yêu cầu' : accuracy >= 40 ? 'Cần cố gắng' : 'Chưa đạt';

    // Pie chart data
    const pieData = [
        { name: 'Đúng', value: totalCorrect, color: '#22c55e' },
        { name: 'Sai', value: totalIncorrect, color: '#ef4444' },
        { name: 'Bỏ qua', value: totalUnanswered, color: '#9ca3af' },
    ].filter(d => d.value > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
            <Header />
            <main className="container mx-auto px-4 py-6 max-w-5xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 no-print">
                    <button onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors font-medium">
                        <FiArrowLeft size={20} /> Quay lại
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm">
                            <FiPrinter size={16} /> Xuất PDF
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 no-print">
                    {[
                        { key: 'result', label: '📊 Kết quả', icon: FiBarChart2 },
                        { key: 'review', label: '📝 Xem lại bài', icon: FiPrinter },
                        { key: 'chat', label: '🤖 Hỏi AI', icon: FiMessageCircle },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                                activeTab === tab.key
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50 hover:text-purple-600'
                            }`}>
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: KẾT QUẢ + AI PHÂN TÍCH ── */}
                {activeTab === 'result' && (
                    <div className="space-y-5">

                        {/* Top Section: Score + Pie + Guidance */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                            {/* Left: Score Card */}
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                                <div className="text-center mb-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{result.exam_title}</p>
                                    <p className={`text-5xl font-black text-${gradeColor}-600`}>
                                        {score.toFixed(1)}
                                    </p>
                                    <p className="text-gray-400 text-sm">/ 10 điểm</p>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-3">
                                    <div className={`h-full bg-gradient-to-r from-${gradeColor}-400 to-${gradeColor}-600 rounded-full transition-all duration-700`}
                                        style={{ width: `${accuracy}%` }} />
                                </div>
                                <p className="text-center text-sm font-semibold text-gray-600">
                                    {accuracy}% {gradeLabel}
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                                    <FiClock size={12} />
                                    <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                                </div>
                            </div>

                            {/* Middle: Pie Chart */}
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col items-center justify-center">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Phân bố đáp án</p>
                                <div className="relative" style={{ width: '160px', height: '160px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any, name: any) => [`${value} câu`, name]}
                                                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <p className="text-2xl font-black text-gray-800">{total}</p>
                                        <p className="text-xs text-gray-400">câu</p>
                                    </div>
                                </div>
                                {/* Legend */}
                                <div className="mt-3 flex flex-wrap justify-center gap-3">
                                    {pieData.map((d) => (
                                        <div key={d.name} className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                            <span className="text-xs text-gray-600">{d.name}: {d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Guidance Cards */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Bạn muốn làm gì tiếp?</p>

                                <button
                                    onClick={() => setActiveTab('review')}
                                    className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:bg-blue-100 transition-colors group">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                            <FiBookOpen className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-800">Xem lại bài</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Kiểm tra đáp án, đọc giải thích từng câu</p>
                                        </div>
                                        <span className="text-blue-400 text-sm">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className="w-full bg-purple-50 border border-purple-200 rounded-xl p-4 text-left hover:bg-purple-100 transition-colors group">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                            <FiCpu className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900 text-sm group-hover:text-purple-800">Hỏi AI</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Nhờ AI giải thích, hỏi mẹo làm bài</p>
                                        </div>
                                        <span className="text-purple-400 text-sm">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full bg-green-50 border border-green-200 rounded-xl p-4 text-left hover:bg-green-100 transition-colors group">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
                                            <FiCheckCircle className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900 text-sm group-hover:text-green-800">Làm bài mới</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Tiếp tục luyện tập với đề khác</p>
                                        </div>
                                        <span className="text-green-400 text-sm">→</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* AI Analysis */}
                        <AIExamAnalysis
                            attemptId={result.id}
                            aiAnalysis={aiAnalysis}
                            aiLoading={aiLoading}
                            onRefresh={() => loadAIAnalysis(result.id)}
                        />
                    </div>
                )}

                {/* ── TAB: XEM LẠI BÀI ── */}
                {activeTab === 'review' && (
                    <div className="space-y-4">
                        {answers.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                                <p className="text-lg">Không có dữ liệu câu hỏi chi tiết</p>
                            </div>
                        ) : (
                            answers.map((q, index) => {
                                const status = !q.selected_answer_key ? 'unanswered'
                                    : q.is_correct ? 'correct' : 'incorrect';
                                const borderCls = status === 'correct' ? 'bg-green-50 border-green-200'
                                    : status === 'incorrect' ? 'bg-red-50 border-red-200'
                                        : 'bg-gray-50 border-gray-200';

                                return (
                                    <div key={index} className={`rounded-xl border-2 p-5 transition-all ${borderCls}`}>

                                        {/* Passage (cho câu trong nhóm đọc hiểu) */}
                                        {q.passage_text && index === 0 && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                                                <p className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide">Đoạn văn</p>
                                                <p className="text-gray-800 leading-relaxed">{q.passage_text}</p>
                                            </div>
                                        )}

                                        {/* Question Header */}
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {status === 'correct' && <FiCheckCircle className="text-green-600" size={22} />}
                                                {status === 'incorrect' && <FiXCircle className="text-red-600" size={22} />}
                                                {status === 'unanswered' && <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                                        Câu {q.sub_question_number || q.question_number || index + 1}
                                                        {q.difficulty && (
                                                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'hard' ? 'Khó' : 'TB'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {status === 'incorrect' && q.selected_answer_key && (
                                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                                            Bạn: {q.selected_answer_key}
                                                        </span>
                                                    )}
                                                    <span className="ml-auto text-xs text-gray-400">{q.points} điểm</span>
                                                </div>
                                                <p className="text-gray-900 font-medium leading-relaxed">{q.question_text || q.question_text_cn}</p>
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
                                                let bg = 'bg-white', border = 'border-gray-200', text = 'text-gray-700';
                                                if (isCorrect) { bg = 'bg-green-100'; border = 'border-green-500'; text = 'text-green-900 font-semibold'; }
                                                else if (isUserPick) { bg = 'bg-red-100'; border = 'border-red-500'; text = 'text-red-900 font-semibold'; }

                                                return (
                                                    <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${bg} ${border}`}>
                                                        <span className={`font-bold text-sm shrink-0 ${text}`}>{opt.key}.</span>
                                                        <div className="flex-1">
                                                            <span className={`text-sm ${text}`}>{opt.text}</span>
                                                            {opt.text_cn && (
                                                                <p className={`text-xs mt-0.5 ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{opt.text_cn}</p>
                                                            )}
                                                        </div>
                                                        {isCorrect && <span className="ml-auto text-green-700 font-bold text-xs shrink-0">✓ Đúng</span>}
                                                        {isUserPick && !isCorrect && <span className="ml-auto text-red-700 font-bold text-xs shrink-0">✗ Bạn chọn</span>}
                                                    </div>
                                                );
                                            })}

                                            {!q.selected_answer_key && (
                                                <p className="text-sm text-gray-400 italic">
                                                    Bạn đã bỏ qua · Đáp án đúng: <strong className="text-gray-600">{q.correct_answer_key}</strong>
                                                </p>
                                            )}
                                        </div>

                                        {/* Explanation + AI button */}
                                        {(q.explanation || q.explanation_cn) && (
                                            <div className="mt-4 ml-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-sm font-semibold text-blue-900 mb-1">💡 Giải thích:</p>
                                                <p className="text-sm text-blue-800">{q.explanation || q.explanation_cn}</p>
                                            </div>
                                        )}

                                        {/* AI giải thích thêm */}
                                        {status === 'incorrect' && (
                                            <button
                                                onClick={() => setShowExplanationModal(q)}
                                                className="mt-3 ml-8 text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1.5">
                                                <FiZap size={14} /> Hỏi AI giải thích thêm
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ── TAB: CHATBOT AI ── */}
                {activeTab === 'chat' && (
                    <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
                )}
            </main>

            {/* AI Explanation Modal */}
            {showExplanationModal && (
                <ExplanationModal
                    question={showExplanationModal}
                    attemptId={result.id}
                    onClose={() => setShowExplanationModal(null)}
                />
            )}
        </div>
    );
}

// ─── AI Explanation Modal ──────────────────────────────────────────────────────
function ExplanationModal({ question, attemptId, onClose }: { question: QuestionResult; attemptId: number; onClose: () => void }) {
    const [explanation, setExplanation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadExplanation();
    }, []);

    const loadExplanation = async () => {
        try {
            // Gọi AI hỏi giải thích tự động cho câu này
            const res = await authFetch('/api/ai/ask', {
                method: 'POST',
                body: JSON.stringify({
                    question: `Câu ${question.sub_question_number || question.question_number} sai. Giải thích tại sao đáp án "${question.selected_answer_key}. ${question.selected_answer_text}" sai và "${question.correct_answer_key}. ${question.correct_answer_text}" đúng? Hãy giải thích chi tiết kiến thức liên quan và mẹo ghi nhớ.`,
                    attemptId,
                }),
            });
            const data = await res.json();
            setExplanation(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900">
                        Phân tích câu {question.question_number || question.sub_question_number}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="text-gray-400 text-xl">×</span>
                    </button>
                </div>
                <div className="p-6">
                    {/* Câu hỏi */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                        <p className="text-xs font-bold text-purple-700 mb-1">Câu hỏi</p>
                        <p className="text-sm text-gray-800">{question.question_text || question.question_text_cn}</p>
                    </div>

                    {/* Đáp án */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-red-600 mb-1">✗ Đáp án của bạn</p>
                            <p className="text-red-800 font-semibold text-sm">
                                {question.selected_answer_key || '?'}. {question.selected_answer_text || ''}
                            </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-600 mb-1">✓ Đáp án đúng</p>
                            <p className="text-green-800 font-semibold text-sm">
                                {question.correct_answer_key || '?'}. {question.correct_answer_text || ''}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-200 border-t-purple-600" />
                            <p className="text-gray-500 text-sm">AI đang phân tích câu này...</p>
                        </div>
                    ) : explanation?.success ? (
                        <div className="space-y-3">
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                                    🤖 AI phân tích
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {explanation.answer}
                                </p>
                            </div>
                            {(question.explanation || question.explanation_cn) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-blue-700 mb-2">📖 Giải thích có sẵn</p>
                                    <p className="text-sm text-blue-800">{question.explanation || question.explanation_cn}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-500">
                            <p className="text-sm mb-2">
                                {explanation?.message || 'Không thể phân tích câu này'}
                            </p>
                            <p className="text-xs text-gray-400">
                                Thử vào tab "🤖 Hỏi AI" để hỏi chi tiết hơn
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
