'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import examApi from '@/lib/api/exams';
import { FiCheckCircle, FiXCircle, FiClock, FiArrowLeft, FiPrinter, FiMessageCircle, FiBarChart2, FiBookOpen, FiCpu } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { authFetch } from '@/lib/utils/authFetch';
import AIChatbot from '@/components/ai/AIChatbot';
import AIExamAnalysis from '@/components/ai/AIExamAnalysis';
import AICoinUnlock from '@/components/ai/AICoinUnlock';
import { useAuthStore } from '@/lib/store/authStore';
import { canUseAI } from '@/lib/utils/permissions';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import AiAnalyzingOverlay from '@/components/common/AiAnalyzingOverlay';
import BilingualMathText from '@/components/exam/result/BilingualMathText';
import QuestionExplanationBlock from '@/components/exam/result/QuestionExplanationBlock';
import ReviewAIButtons from '@/components/exam/result/ReviewAIButtons';
import ReviewAIHost, { type ReviewAIHostHandle } from '@/components/exam/result/ReviewAIHost';
import type { ReviewAIMode } from '@/components/exam/result/types';
import { getOptionToneClass, getQuestionReviewStatus, getReviewCardClass } from '@/components/exam/result/utils';

const AI_ANALYSIS_COST = 50;

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
    selected_answer_text_cn?: string | null;
    selected_answer_text_en?: string | null;
    correct_answer_key: string;
    correct_answer_text: string;
    correct_answer_text_cn?: string | null;
    correct_answer_text_en?: string | null;
    is_correct: boolean | null;
    points: number;
    score_awarded?: number | string | null;
    max_score?: number | string | null;
    grading_status?: string | null;
    grading_feedback?: string | null;
    grading_result?: any;
    explanation?: string;
    explanation_cn?: string;
    explanation_en?: string;
    explanation_image_url?: string;
    options: AnswerOption[];
    difficulty?: string;
}

interface AttemptResult {
    id: number;
    exam_id: number;
    exam_title: string;
    language_mode?: string;
    title_cn?: string;
    subject_name: string;
    total_score: number;
    total_possible_score?: number | string;
    score_scale_10?: number;
    score_scale_100?: number;
    score_percentage?: number | string;
    total_pending_grading?: number;
    total_correct: number;
    total_incorrect?: number;
    total_unanswered?: number;
    submit_time: string;
    total_questions: number;
    answers: QuestionResult[];
}

export default function ExamResultPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const updateUser = useAuthStore((s) => s.updateUser);
    const hasAIAccess = canUseAI(user);
    const currentCoins = Math.max(0, Number(user?.coins ?? 0));
    const [result, setResult] = useState<AttemptResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'result' | 'review' | 'chat'>('result');
    const reviewAIHostRef = useRef<ReviewAIHostHandle>(null);
    const chatAnchorRef = useRef<HTMLDivElement>(null);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [reviewStarted, setReviewStarted] = useState(false);
    const [aiLoaded, setAiLoaded] = useState(false);

    const openChatTab = useCallback(() => {
        setActiveTab('chat');
        window.setTimeout(() => {
            chatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    }, []);

    useEffect(() => {
        loadResult();
    }, [params.id]);

    useEffect(() => {
        if (result?.id && !aiAnalysis && !aiLoading) {
            loadAIAnalysis(result.id);
        }
    }, [result?.id]);

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
            if (data.id) {
                loadAIAnalysis(data.id);
            }
        } catch (error) {
            console.error('Error loading result:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAIAnalysis = async (attemptId: number, useCoins = false) => {
        // Không load lại nếu đã có analysis rồi
        if (!useCoins && aiAnalysis && aiAnalysis.attempt?.id === attemptId) return;
        if (useCoins && currentCoins < AI_ANALYSIS_COST) return;
        try {
            setAiLoading(true);
            const url = useCoins ? `/api/ai/exam-result/${attemptId}?useCoins=true` : `/api/ai/exam-result/${attemptId}`;
            const res = await authFetch(url, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setAiAnalysis(data);
                if (data.coin_charged) {
                    const nextCoins = Number.isFinite(Number(data.coin_balance))
                        ? Math.max(0, Number(data.coin_balance))
                        : Math.max(0, currentCoins - AI_ANALYSIS_COST);
                    updateUser({ coins: nextCoins });
                }
                if (!data.cached) setAiLoaded(true);
                else setAiLoaded(true); // cached vẫn là đã load xong
            }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const openReviewAI = useCallback((question: QuestionResult, mode: ReviewAIMode) => {
        reviewAIHostRef.current?.open(question, mode);
    }, []);

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
    const languageMode = result.language_mode || 'zh';
    const total = result.total_questions || answers.length || 1;
    const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
    const totalIncorrect = result.total_incorrect ?? answers.filter(a => a.selected_answer_key && !a.is_correct).length;
    const totalUnanswered = result.total_unanswered ?? Math.max(0, total - totalCorrect - totalIncorrect);
    const rawScore = Number(result.total_score) || 0;
    const fallbackPossibleScore = answers.reduce((sum, answer) => sum + (Number(answer.points) || 0), 0) || total;
    const possibleScore = Number(result.total_possible_score) || fallbackPossibleScore;
    const storedPercentage = Number(result.score_percentage);
    const score100 = Number.isFinite(storedPercentage)
        ? Math.max(0, Math.min(100, storedPercentage))
        : Number.isFinite(Number(result.score_scale_100))
            ? Number(result.score_scale_100)
            : possibleScore > 0
                ? Math.max(0, Math.min(100, (rawScore / possibleScore) * 100))
                : (totalCorrect / total) * 100;
    const accuracy = Math.round(
        score100,
    );
    const displayScore = Number.isFinite(Number(result.score_scale_10))
        ? Number(result.score_scale_10)
        : score100 / 10;

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
            <AiAnalyzingOverlay open={aiLoading && !aiAnalysis} mode="exam" compactAfterMs={2600} />

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
            <main className="container mx-auto max-w-[1360px] px-3 py-4 sm:px-4 sm:py-6">

                {/* Tab Navigation */}
                <div className="no-print mb-4 flex gap-2 overflow-x-auto pb-1 sm:mb-6">
                    {[
                        { key: 'result', label: '📊 Kết quả', icon: FiBarChart2 },
                        { key: 'review', label: '📝 Xem lại bài', icon: FiPrinter },
                        { key: 'chat', label: '🤖 Hỏi AI', icon: FiMessageCircle },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => {
                                if (tab.key === 'chat') openChatTab();
                                else setActiveTab(tab.key as any);
                                if (tab.key === 'review') setReviewStarted(false);
                            }}
                            className={`flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
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
                                    <div className="relative inline-flex items-center justify-center my-3">
                                        {/* Outer soft glowing circle */}
                                        <div className={`absolute inset-0 rounded-full blur-xl opacity-20 bg-gradient-to-br ${gradeColors.progress}`} />
                                        <span className={`relative text-7xl font-black bg-gradient-to-br ${gradeColors.progress} bg-clip-text text-transparent leading-none py-3 px-1 sm:text-8xl`}>
                                            {score100.toFixed(1)}
                                        </span>
                                    </div>
                                    <p className={`text-base font-black ${gradeColors.text}`}>/100 điểm</p>
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                        <span>Thang 10</span>
                                        <span className={gradeColors.text}>{displayScore.toFixed(2)}/10</span>
                                    </div>
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
                                <div className="mt-5 grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Đúng', value: totalCorrect, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                        { label: 'Sai', value: totalIncorrect, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
                                        { label: 'Bỏ qua', value: totalUnanswered, tone: 'bg-slate-50 text-slate-700 border-slate-100' },
                                    ].map((item) => (
                                        <div key={item.label} className={`rounded-2xl border px-3 py-2 text-center ${item.tone}`}>
                                            <p className="text-lg font-black leading-none">{item.value}</p>
                                            <p className="mt-1 text-[11px] font-bold">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-4 rounded-2xl border px-4 py-3 ${gradeColors.bg} ${gradeColors.border}`}>
                                    <p className={`text-xs font-black uppercase tracking-wide ${gradeColors.text}`}>Gợi ý nhanh</p>
                                    <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                        {totalIncorrect > 0
                                            ? `Ưu tiên xem lại ${totalIncorrect} câu sai trước, rồi hỏi AI giải thích từng lỗi.`
                                            : totalUnanswered > 0
                                                ? `Bạn còn ${totalUnanswered} câu bỏ qua, nên luyện cách suy luận nhanh.`
                                                : 'Bài này khá ổn, hãy củng cố dấu hiệu nhận biết để giữ phong độ.'}
                                    </p>
                                </div>
                            </div>

                            {/* Middle: Pie Chart */}
                            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-start transition-all hover:shadow-2xl">
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
                                <div className="mt-5 w-full space-y-3">
                                    {[
                                        { label: 'Đúng', value: totalCorrect, color: 'bg-emerald-500' },
                                        { label: 'Sai', value: totalIncorrect, color: 'bg-rose-500' },
                                        { label: 'Bỏ qua', value: totalUnanswered, color: 'bg-slate-400' },
                                    ].map((item) => {
                                        const percent = Math.round((item.value / total) * 100);
                                        return (
                                            <div key={item.label}>
                                                <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                                                    <span>{item.label}</span>
                                                    <span>{percent}%</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                    onClick={openChatTab}
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
                        {hasAIAccess || aiAnalysis || aiLoading ? (
                            <AIExamAnalysis
                                attemptId={result.id}
                                aiAnalysis={aiAnalysis}
                                aiLoading={aiLoading}
                                onRefresh={() => loadAIAnalysis(result.id, !hasAIAccess)}
                                onAiLoaded={() => setAiLoaded(true)}
                            />
                        ) : (
                            <AICoinUnlock
                                coins={currentCoins}
                                loading={aiLoading}
                                onUseCoins={() => loadAIAnalysis(result.id, true)}
                                title="Phân tích bài thi bằng AI"
                            />
                        )}
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
                                const borderCls = getReviewCardClass(status);

                                return (
                                    <div key={index} className={`rounded-xl border-2 p-5 transition-all ${borderCls}`}>

                                        {/* Passage (cho câu trong nhóm đọc hiểu) */}
                                        {q.passage_text && index === 0 && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 dark:bg-purple-950/25 dark:border-purple-900/60">
                                                <p className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide dark:text-purple-200">Đoạn văn</p>
                                                <p className="text-gray-800 leading-relaxed dark:text-gray-100">{q.passage_text}</p>
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
                                                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' :
                                                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                                                                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                            }`}>
                                                                {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'hard' ? 'Khó' : 'TB'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {status === 'incorrect' && q.selected_answer_key && (
                                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded dark:bg-red-950/40 dark:text-red-300">
                                                            Bạn: {q.selected_answer_key}
                                                        </span>
                                                    )}
                                                    <span className="ml-auto text-xs text-gray-400">{q.points} điểm</span>
                                                </div>
                                                <BilingualMathText
                                                    primary={q.question_text || q.question_text_en}
                                                    secondary={q.question_text_cn}
                                                    tertiary={q.question_text_en}
                                                    languageMode={languageMode}
                                                    className="text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100"
                                                />
                                            </div>
                                        </div>

                                        {/* Options */}
                                        <div className="space-y-2 ml-8">
                                            {(q.options ?? []).map((opt) => {
                                                const isCorrect = opt.is_correct;
                                                const isUserPick = q.selected_answer_key === opt.key;
                                                const tone = getOptionToneClass(isCorrect, isUserPick);

                                                return (
                                                    <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${tone.bg} ${tone.border}`}>
                                                        <span className={`font-bold text-sm shrink-0 ${tone.text}`}>{opt.key}.</span>
                                                        <div className="min-w-0 flex-1">
                                                            <BilingualMathText
                                                                primary={opt.text || opt.text_en}
                                                                secondary={opt.text_cn}
                                                                tertiary={opt.text_en}
                                                                languageMode={languageMode}
                                                                className={`text-sm ${tone.text}`}
                                                                secondaryClassName={`mt-1 text-xs ${tone.secondary}`}
                                                            />
                                                        </div>
                                                        {isCorrect && <span className="ml-auto text-green-700 font-bold text-xs shrink-0 dark:text-green-300">✓ Đúng</span>}
                                                        {isUserPick && !isCorrect && <span className="ml-auto text-red-700 font-bold text-xs shrink-0 dark:text-red-300">✗ Bạn chọn</span>}
                                                    </div>
                                                );
                                            })}

                                            {!q.selected_answer_key && (
                                                <p className="text-sm text-gray-400 italic dark:text-gray-500">
                                                    Bạn đã bỏ qua · Đáp án đúng: <strong className="text-gray-600 dark:text-gray-300">{q.correct_answer_key}</strong>
                                                </p>
                                            )}
                                        </div>

                                        <QuestionExplanationBlock question={q} languageMode={languageMode} className="mt-4 sm:ml-8" />

                                        {/* AI giải thích thêm */}
                                        {q.question_type !== 'essay' && q.question_type !== 'translation' && (
                                            <div className="mt-3 flex flex-wrap items-center gap-3 sm:ml-8">
                                                <ReviewAIButtons
                                                    status={status}
                                                    onOpen={(mode) => openReviewAI(q, mode)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        </>
                        )}

                        {/* AI Analysis — chỉ hiện khi đã bắt đầu xem lại */}
                        {reviewStarted && (
                            hasAIAccess || aiAnalysis || aiLoading ? (
                                <AIExamAnalysis
                                    attemptId={result.id}
                                    aiAnalysis={aiAnalysis}
                                    aiLoading={aiLoading}
                                    onRefresh={() => loadAIAnalysis(result.id, !hasAIAccess)}
                                />
                            ) : (
                                <AICoinUnlock
                                    coins={currentCoins}
                                    loading={aiLoading}
                                    onUseCoins={() => loadAIAnalysis(result.id, true)}
                                    title="Phân tích bài thi bằng AI"
                                />
                            )
                        )}
                    </div>
                )}

                {/* ── TAB: CHATBOT AI ── */}
                {activeTab === 'chat' && (
                    <div ref={chatAnchorRef} className="scroll-mt-24 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:rounded-2xl">
                        <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
                    </div>
                )}
            </main>

            <ReviewAIHost
                ref={reviewAIHostRef}
                attemptId={result.id}
                languageMode={languageMode}
                onOpenChat={openChatTab}
            />
        </div>
    );
}
