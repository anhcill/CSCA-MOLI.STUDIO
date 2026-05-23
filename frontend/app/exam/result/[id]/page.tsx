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
import { useAuthStore } from '@/lib/store/authStore';
import { canUseAI } from '@/lib/utils/permissions';
import RichMathText from '@/components/common/RichMathText';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

/* ─── AI Text Formatter ──────────────────────────────────────────── */
function parseAIExplanation(text: string): React.ReactNode[] {
    if (!text) return [];
    const lines = text.split('\n').filter(l => l.trim());
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Section heading
        if (/^#{1,3}\s/.test(line)) {
            blocks.push(
                <h4 key={`h-${i}`} className="mt-3 first:mt-0 font-bold text-purple-800 text-sm flex items-center gap-1.5">
                    <FiCpu size={12} className="shrink-0" />
                    {line.replace(/^#{1,3}\s/, '')}
                </h4>
            );
            i++; continue;
        }

        // Bold label + content
        const labelMatch = line.match(/^([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸĐ][^\s:：]*[:：.]?\s?)(.+)/);
        if (labelMatch) {
            const label = labelMatch[1].replace(/[:：.]\s?$/, '').trim();
            const content = labelMatch[2].trim();
            blocks.push(
                <div key={`lb-${i}`} className="mt-2 first:mt-0">
                    <span className="font-semibold text-purple-800 text-sm">{label} </span>
                    <span className="text-gray-700 text-sm">{content}</span>
                </div>
            );
            i++; continue;
        }

        // Bullet points
        if (/^[—•\-\*]\s/.test(line)) {
            const bulletText = line.replace(/^[—•\-\*]\s/, '');
            if (bulletText) {
                blocks.push(
                    <div key={`b-${i}`} className="flex items-start gap-2 mt-1 first:mt-0 pl-2">
                        <span className="text-purple-400 shrink-0 mt-0.5">•</span>
                        <span className="text-gray-700 text-sm flex-1">{bulletText}</span>
                    </div>
                );
            }
            i++; continue;
        }

        // Numbered list
        const numMatch = line.match(/^(\d+[.)]\s)(.+)/);
        if (numMatch) {
            blocks.push(
                <div key={`n-${i}`} className="flex items-start gap-2 mt-1 first:mt-0 pl-2">
                    <span className="text-purple-600 font-bold text-sm shrink-0 w-5">{numMatch[1].trim()}</span>
                    <span className="text-gray-700 text-sm flex-1">{numMatch[2]}</span>
                </div>
            );
            i++; continue;
        }

        // Math formula
        if (/[=<>≤≥√∑∏π→⇒∈∉⊂⊃∀∃]/.test(line) && !/^[A-ZÀÁ][a-zàáạảã]/.test(line)) {
            blocks.push(
                <div key={`m-${i}`} className="mt-1 font-mono text-sm bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg text-purple-900 overflow-x-auto">
                    {line}
                </div>
            );
            i++; continue;
        }

        if (!line) { i++; continue; }

        // Regular paragraph — clean **bold** markers
        const clean = line
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1');

        if (clean.length > 0) {
            blocks.push(
                <p key={`p-${i}`} className="mt-1 first:mt-0 text-sm text-gray-700 leading-relaxed">{clean}</p>
            );
        }
        i++;
    }

    return blocks;
}

interface AnswerOption {
    key: string;
    text: string;
    text_cn?: string | null;
    text_en?: string | null;
    is_correct: boolean;
}

interface QuestionResult {
    question_number: number;
    sub_question_number?: number;
    question_text: string;
    question_text_cn?: string;
    question_text_en?: string;
    question_type?: string;
    passage_text?: string;
    selected_answer_key: string | null;
    selected_answer_text: string;
    correct_answer_key: string;
    correct_answer_text: string;
    is_correct: boolean;
    points: number;
    score_awarded?: number | string | null;
    max_score?: number | string | null;
    grading_status?: string | null;
    grading_feedback?: string | null;
    grading_result?: any;
    explanation?: string;
    explanation_cn?: string;
    options: AnswerOption[];
    difficulty?: string;
}

function getReviewAIButtonLabel(status: string) {
    if (status === 'correct') return 'Hỏi AI củng cố câu đúng';
    if (status === 'unanswered') return 'Hỏi AI hướng dẫn câu bỏ qua';
    return 'Hỏi AI giải thích thêm';
}

function getQuestionReviewStatus(question: QuestionResult) {
    if (!question.selected_answer_key) return 'unanswered';
    return question.is_correct ? 'correct' : 'incorrect';
}

function formatReviewAnswer(key?: string | null, text?: string | null, fallback = 'Bỏ qua') {
    if (!key) return fallback;
    const cleanText = (text || '').trim();
    return cleanText.startsWith(`${key}.`) ? cleanText : `${key}. ${cleanText}`.trim();
}

function buildQuestionExplanationPrompt(question: QuestionResult, questionText: string) {
    const questionNo = question.sub_question_number || question.question_number;
    const selectedAnswer = formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bỏ qua');
    const correctAnswer = formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng');
    const base = [
        `Câu ${questionNo}`,
        questionText ? `Nội dung câu hỏi: ${questionText}` : '',
        `Đáp án đúng: ${correctAnswer}`,
    ].filter(Boolean).join('\n');

    const status = getQuestionReviewStatus(question);
    if (status === 'correct') {
        return `${base}\nHọc sinh đã chọn đúng: ${selectedAnswer}.\nHãy giải thích vì sao đáp án này đúng, chỉ ra kiến thức cần nhớ, dấu hiệu nhận biết và bẫy dễ nhầm. Trả lời bằng tiếng Việt có dấu, ngắn gọn nhưng đủ ý.`;
    }
    if (status === 'unanswered') {
        return `${base}\nHọc sinh đã bỏ qua câu này.\nHãy hướng dẫn cách suy luận từ đầu, vì sao đáp án đúng là phù hợp, mẹo nhận biết lần sau và kiến thức cần ôn lại. Trả lời bằng tiếng Việt có dấu, dễ hiểu.`;
    }
    return `${base}\nHọc sinh đã chọn sai: ${selectedAnswer}.\nHãy giải thích vì sao lựa chọn này sai, vì sao đáp án đúng là phù hợp, kiến thức liên quan và mẹo ghi nhớ. Trả lời bằng tiếng Việt có dấu, dễ hiểu.`;
}

interface AttemptResult {
    id: number;
    exam_id: number;
    exam_title: string;
    title_cn?: string;
    subject_name: string;
    total_score: number;
    total_correct: number;
    total_incorrect?: number;
    total_unanswered?: number;
    submit_time: string;
    total_questions: number;
    answers: QuestionResult[];
}

export default function ExamResultPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { pick } = useLanguage();
    const user = useAuthStore((s) => s.user);
    const hasAIAccess = canUseAI(user);
    const [result, setResult] = useState<AttemptResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'result' | 'review' | 'chat'>('result');
    const [showExplanationModal, setShowExplanationModal] = useState<QuestionResult | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [reviewStarted, setReviewStarted] = useState(false);
    const [aiLoaded, setAiLoaded] = useState(false);

    useEffect(() => {
        loadResult();
    }, [params.id]);

    useEffect(() => {
        if (result?.id && hasAIAccess && !aiAnalysis && !aiLoading) {
            loadAIAnalysis(result.id);
        }
    }, [result?.id, hasAIAccess]);

    // Cảnh báo thoát khi AI đang phân tích
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!aiLoaded && aiLoading) {
                e.preventDefault();
                e.returnValue = 'AI đang phân tích bài thi. Nếu thoát, bạn sẽ mất kết quả phân tích!';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [aiLoaded, aiLoading]);

    const loadResult = async () => {
        try {
            setLoading(true);
            const data = await examApi.getAttemptDetails(params.id);
            setResult(data);
            if (data.id && hasAIAccess) {
                loadAIAnalysis(data.id);
            }
        } catch (error) {
            console.error('Error loading result:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAIAnalysis = async (attemptId: number) => {
        // Không load lại nếu đã có analysis rồi
        if (aiAnalysis && aiAnalysis.attempt?.id === attemptId) return;
        try {
            setAiLoading(true);
            const res = await authFetch(`/api/ai/exam-result/${attemptId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setAiAnalysis(data);
                if (!data.cached) setAiLoaded(true);
                else setAiLoaded(true); // cached vẫn là đã load xong
            }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600" />
                    <p className="text-gray-500">Đang tải kết quả...</p>
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Không tìm thấy kết quả bài thi</p>
                    <button onClick={() => router.back()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    const answers = result.answers ?? [];
    const total = result.total_questions || answers.length || 1;
    const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
    const totalIncorrect = result.total_incorrect ?? answers.filter(a => a.selected_answer_key && !a.is_correct).length;
    const totalUnanswered = result.total_unanswered ?? Math.max(0, total - totalCorrect - totalIncorrect);
    const accuracy = Math.round((totalCorrect / total) * 100);
    const displayScore = Math.round((totalCorrect / total) * 100) / 10;

    const gradeColor = accuracy >= 85 ? 'emerald' : accuracy >= 60 ? 'blue' : accuracy >= 40 ? 'amber' : 'red';
    const gradeLabel = accuracy >= 85 ? 'Xuất sắc!' : accuracy >= 60 ? 'Đạt yêu cầu' : accuracy >= 40 ? 'Cần cố gắng' : 'Chưa đạt';

    const getGradeColors = (color: string) => {
        if (color === 'emerald') return { text: 'text-emerald-600 dark:text-emerald-400', progress: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800' };
        if (color === 'blue') return { text: 'text-blue-600 dark:text-blue-400', progress: 'from-blue-400 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800' };
        if (color === 'amber') return { text: 'text-amber-600 dark:text-amber-400', progress: 'from-amber-400 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800' };
        return { text: 'text-rose-600 dark:text-rose-400', progress: 'from-rose-400 to-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800' };
    };

    const gradeColors = getGradeColors(gradeColor);

    // Pie chart data
    const pieData = [
        { name: 'Đúng', value: totalCorrect, color: '#22c55e' },
        { name: 'Sai', value: totalIncorrect, color: '#ef4444' },
        { name: 'Bỏ qua', value: totalUnanswered, color: '#9ca3af' },
    ].filter(d => d.value > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
            {/* Minimal Header - chỉ nút quay lại */}
            <div className="sticky top-0 z-[60] bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3 no-print dark:bg-gray-900/95 dark:border-gray-800">
                <button onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-purple-650 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium text-sm">
                    <FiArrowLeft size={18} /> Quay lại
                </button>
                <div className="flex-1" />
                <LanguageSwitcher compact />
                <button onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-655 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-medium shadow-sm no-print">
                    <FiPrinter size={14} /> Xuất PDF
                </button>
            </div>
            <main className="container mx-auto px-4 py-6 max-w-[1360px]">

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 no-print">
                    {[
                        { key: 'result', label: '📊 Kết quả', icon: FiBarChart2 },
                        { key: 'review', label: '📝 Xem lại bài', icon: FiPrinter },
                        { key: 'chat', label: '🤖 Hỏi AI', icon: FiMessageCircle },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => {
                                setActiveTab(tab.key as any);
                                if (tab.key === 'review') setReviewStarted(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                                activeTab === tab.key
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50 hover:text-purple-650 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-purple-400'
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
                            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 transition-all hover:shadow-2xl">
                                <div className="text-center mb-4">
                                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{result.exam_title}</p>
                                    <div className="relative inline-flex items-center justify-center my-2">
                                        {/* Outer soft glowing circle */}
                                        <div className={`absolute inset-0 rounded-full blur-xl opacity-20 bg-gradient-to-br ${gradeColors.progress}`} />
                                        <span className={`relative text-6xl font-black bg-gradient-to-br ${gradeColors.progress} bg-clip-text text-transparent leading-none py-2 px-1`}>
                                            {displayScore.toFixed(1)}
                                        </span>
                                    </div>
                                    <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold">/ 10 điểm</p>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-850 rounded-full h-3 overflow-hidden mb-3">
                                    <div className={`h-full bg-gradient-to-r ${gradeColors.progress} rounded-full transition-all duration-700`}
                                        style={{ width: `${accuracy}%` }} />
                                </div>
                                <p className={`text-center text-sm font-bold ${gradeColors.text}`}>
                                    {accuracy}% {gradeLabel}
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                    <FiClock size={12} />
                                    <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                                </div>
                            </div>

                            {/* Middle: Pie Chart */}
                            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center transition-all hover:shadow-2xl">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Phân bố đáp án</p>
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
                                                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <p className="text-2xl font-black text-gray-800 dark:text-white">{total}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">câu</p>
                                    </div>
                                </div>
                                {/* Legend */}
                                <div className="mt-3 flex flex-wrap justify-center gap-3">
                                    {pieData.map((d) => (
                                        <div key={d.name} className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                            <span className="text-xs text-gray-600 dark:text-gray-400">{d.name}: {d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Guidance Cards */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Bạn muốn làm gì tiếp?</p>

                                <button
                                    onClick={() => setActiveTab('review')}
                                    className="w-full bg-gradient-to-r from-blue-50/50 to-sky-50/30 dark:from-blue-950/10 dark:to-sky-950/5 border border-blue-105 dark:border-blue-900/30 rounded-2xl p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 group">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-sky-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-205">
                                            <FiBookOpen className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-950 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Xem lại bài</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Kiểm tra đáp án, đọc giải thích từng câu</p>
                                        </div>
                                        <span className="text-blue-400 dark:text-blue-500 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className="w-full bg-gradient-to-r from-purple-50/50 to-pink-50/30 dark:from-purple-950/10 dark:to-pink-950/5 border border-purple-105 dark:border-purple-900/30 rounded-2xl p-4 text-left hover:border-purple-300 dark:hover:border-purple-805 hover:shadow-md transition-all duration-200 group">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform duration-205">
                                            <FiCpu className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Hỏi AI</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Nhờ AI giải thích, hỏi mẹo làm bài</p>
                                        </div>
                                        <span className="text-purple-400 dark:text-purple-550 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full bg-gradient-to-r from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/10 dark:to-teal-950/5 border border-emerald-105 dark:border-emerald-900/30 rounded-2xl p-4 text-left hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200 group">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-205">
                                            <FiCheckCircle className="text-white" size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Làm bài mới</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-550 mt-0.5 truncate">Tiếp tục luyện tập với đề khác</p>
                                        </div>
                                        <span className="text-emerald-400 dark:text-emerald-500 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
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
                            onAiLoaded={() => setAiLoaded(true)}
                        />
                    </div>
                )}

                {/* ── TAB: XEM LẠI BÀI ── */}
                {activeTab === 'review' && (
                    <div className="space-y-4">
                        {!reviewStarted ? (
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-purple-200 rounded-2xl p-6 mb-4 text-center">
                                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FiBookOpen className="text-purple-600" size={24} />
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">Xem lại từng câu</h3>
                                <p className="text-gray-500 text-sm mb-5 max-w-md mx-auto">
                                    Hãy xem lại đáp án từng câu bên dưới. Sau khi xem hết, AI phân tích sẽ hiện ra giúp bạn tổng hợp kiến thức.
                                </p>
                                <button
                                    onClick={() => setReviewStarted(true)}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
                                    Bắt đầu xem lại
                                </button>
                            </div>
                        ) : (
                            <>
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
                                                <p className="text-gray-900 font-medium leading-relaxed">
                                                    {pick({ vi: q.question_text, en: q.question_text_en, zh: q.question_text_cn })}
                                                </p>
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
                                                            <span className={`text-sm ${text}`}>
                                                                {pick({ vi: opt.text, en: opt.text_en, zh: opt.text_cn })}
                                                            </span>
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
                                                <RichMathText value={q.explanation || q.explanation_cn || ''} className="text-blue-800" />
                                            </div>
                                        )}

                                        {/* AI giải thích thêm */}
                                        {q.question_type !== 'essay' && q.question_type !== 'translation' && (
                                            <button
                                                onClick={() => setShowExplanationModal(q)}
                                                className="mt-3 ml-8 text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1.5">
                                                <FiZap size={14} /> {getReviewAIButtonLabel(status)}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        </>
                        )}

                        {/* AI Analysis — chỉ hiện khi đã bắt đầu xem lại */}
                        {reviewStarted && (
                            <AIExamAnalysis
                                attemptId={result.id}
                                aiAnalysis={aiAnalysis}
                                aiLoading={aiLoading}
                                onRefresh={() => loadAIAnalysis(result.id)}
                            />
                        )}
                    </div>
                )}

                {/* ── TAB: CHATBOT AI ── */}
                {activeTab === 'chat' && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                        <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
                    </div>
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
    const { pick } = useLanguage();
    const [explanation, setExplanation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const answerStatus = getQuestionReviewStatus(question);
    const questionText = pick({ vi: question.question_text, en: question.question_text_en, zh: question.question_text_cn }) || question.question_text || '';
    const answerBoxClass = answerStatus === 'correct'
        ? 'bg-green-50 border border-green-200 rounded-lg p-3'
        : answerStatus === 'unanswered'
            ? 'bg-amber-50 border border-amber-200 rounded-lg p-3'
            : 'bg-red-50 border border-red-200 rounded-lg p-3';
    const answerTextClass = answerStatus === 'correct'
        ? 'text-green-800 font-semibold text-sm'
        : answerStatus === 'unanswered'
            ? 'text-amber-800 font-semibold text-sm'
            : 'text-red-800 font-semibold text-sm';
    const answerLabelClass = answerStatus === 'correct'
        ? 'text-xs font-bold text-green-600 mb-1'
        : answerStatus === 'unanswered'
            ? 'text-xs font-bold text-amber-600 mb-1'
            : 'text-xs font-bold text-red-600 mb-1';

    useEffect(() => {
        loadExplanation();
    }, []);

    const loadExplanation = async () => {
        try {
            // Gọi AI hỏi giải thích tự động cho câu này
            const res = await authFetch('/api/ai/ask', {
                method: 'POST',
                body: JSON.stringify({
                    question: buildQuestionExplanationPrompt(question, questionText),
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print" onClick={loading ? undefined : onClose}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900">
                        Phân tích câu {question.question_number || question.sub_question_number}
                    </h3>
                    {!loading && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <span className="text-gray-400 text-xl">×</span>
                        </button>
                    )}
                </div>
                <div className="p-6">
                    {/* Câu hỏi */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                        <p className="text-xs font-bold text-purple-700 mb-1">Câu hỏi</p>
                        <p className="text-sm text-gray-800">{questionText}</p>
                    </div>

                    {/* Đáp án */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className={answerBoxClass}>
                            <p className={answerLabelClass}>{answerStatus === 'unanswered' ? 'Chưa trả lời' : 'Đáp án của bạn'}</p>
                            <p className={answerTextClass}>
                                {formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bạn đã bỏ qua')}
                            </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-600 mb-1">Đáp án đúng</p>
                            <p className="text-green-800 font-semibold text-sm">
                                {formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng')}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-200 border-t-purple-600" />
                            <p className="text-gray-500 text-sm text-center">AI đang đọc câu hỏi, đối chiếu đáp án và soạn giải thích...</p>
                        </div>
                    ) : explanation?.success ? (
                        <div className="space-y-3">
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-purple-700 mb-3 flex items-center gap-1.5">
                                    <FiCpu size={12} /> 🤖 AI phân tích
                                </p>
                                <div className="space-y-1">
                                    {parseAIExplanation(explanation.answer)}
                                </div>
                            </div>
                            {(question.explanation || question.explanation_cn) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-blue-700 mb-2">📖 Giải thích có sẵn</p>
                                    <RichMathText value={question.explanation || question.explanation_cn || ''} className="text-blue-800" />
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
                    {!loading && (
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors">
                            Đóng
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
