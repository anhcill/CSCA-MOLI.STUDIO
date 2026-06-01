'use client';

import { useState, useEffect } from 'react';
import {
    FiZap, FiRefreshCw, FiTrendingUp, FiTrendingDown,
    FiAlertCircle, FiCheckCircle, FiTarget, FiTrendingUp as FiArrowUp,
    FiClock, FiBookOpen, FiAward, FiAlertTriangle
} from 'react-icons/fi';
import { useTypewriter } from '@/hooks/useTypewriter';
import AIFormattedText from '@/components/ai/AIFormattedText';

function TypewriterPlain({ text, className = '' }: { text: string; className?: string }) {
    const { displayed, done } = useTypewriter(text, { speed: 4, startDelay: 20 });
    return (
        <div className={className}>
            <AIFormattedText value={displayed} />
            {!done && <span className="inline-block h-4 w-1.5 animate-pulse bg-purple-400 align-middle ml-0.5" />}
        </div>
    );
}

function PlainText({ text, className = '' }: { text: string; className?: string }) {
    return <AIFormattedText value={text} className={className} />;
}

interface AIExamAnalysisProps {
    attemptId: number;
    aiAnalysis: any;
    aiLoading: boolean;
    onRefresh: () => void;
    previousAttempt?: {
        examTitle: string;
        date: string;
        score: number;
        correct: number;
        total: number;
        delta: number;
    } | null;
    onAiLoaded?: () => void;
}

export default function AIExamAnalysis({ attemptId, aiAnalysis, aiLoading, onRefresh, previousAttempt, onAiLoaded }: AIExamAnalysisProps) {
    const [expanded, setExpanded] = useState(true);
    const [showLeaveWarning, setShowLeaveWarning] = useState(false);

    const analysis = aiAnalysis?.aiAnalysis;

    // Khi AI bắt đầu loading → hiện cảnh báo thoát
    useEffect(() => {
        if (aiLoading) {
            setShowLeaveWarning(true);
        } else if (analysis) {
            // AI đã xong → ẩn cảnh báo sau 3s
            setShowLeaveWarning(false);
            onAiLoaded?.();
        }
    }, [aiLoading, analysis, onAiLoaded]);

    // Cảnh báo khi AI đang load
    const renderLoadingState = () => (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-5 space-y-4">
            {/* Warning banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <FiAlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <p className="font-bold text-amber-800 text-sm">Đợi AI phân tích xong nhé!</p>
                    <p className="text-amber-700 text-xs mt-0.5">Đừng thoát trang — phân tích AI đang được chuẩn bị cho bạn. Thoát sẽ mất kết quả!</p>
                </div>
            </div>

            {/* Animated skeleton */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-200 border-t-purple-600" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-purple-200 rounded animate-pulse w-3/4" />
                        <div className="h-2 bg-purple-100 rounded animate-pulse w-1/2" />
                    </div>
                </div>
                <div className="h-24 bg-purple-100 rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 bg-purple-100 rounded-xl animate-pulse" />
                    <div className="h-16 bg-purple-100 rounded-xl animate-pulse" />
                    <div className="h-16 bg-purple-100 rounded-xl animate-pulse" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 bg-green-100 rounded animate-pulse" />
                    <div className="h-3 bg-green-100 rounded animate-pulse w-5/6" />
                    <div className="h-3 bg-green-100 rounded animate-pulse w-4/6" />
                </div>
            </div>

            {/* Progress hint */}
            <p className="text-center text-xs text-purple-500 font-medium">
                🤖 AI đang phân tích bài thi của bạn... vui lòng chờ
            </p>
        </div>
    );

    if (aiLoading) {
        return renderLoadingState();
    }

    if (aiAnalysis?.rateLimited) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                    <FiAlertCircle className="text-amber-600" size={18} />
                    <p className="font-semibold text-amber-800">AI đang tạm bận</p>
                </div>
                <p className="text-amber-700 text-sm mb-3">
                    Hệ thống AI đang có nhiều người dùng. Kết quả phân tích cơ bản được hiển thị bên dưới.
                </p>
                {analysis && (
                    <MiniAnalysis data={analysis} />
                )}
            </div>
        );
    }

    if (!analysis) return null;

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200 overflow-hidden shadow-sm">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-5 hover:bg-purple-100/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-md">
                        <FiZap className="text-white" size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-gray-900">🤖 Phân tích bài thi bằng AI</h3>
                        <p className="text-gray-500 text-xs">Phân tích chi tiết từ AI</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                        className="p-2 hover:bg-purple-200 rounded-lg transition-colors" title="Làm mới">
                        <FiRefreshCw size={16} className="text-purple-700" />
                    </button>
                    <FiAlertCircle size={18} className={`text-purple-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-5">

                    {/* So sánh với lần trước */}
                    {previousAttempt && (
                        <div className={`rounded-xl p-4 border flex items-center gap-4 ${
                            previousAttempt.delta > 0 ? 'bg-emerald-50 border-emerald-200' :
                            previousAttempt.delta < 0 ? 'bg-red-50 border-red-200' :
                            'bg-gray-50 border-gray-200'
                        }`}>
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                previousAttempt.delta > 0 ? 'bg-emerald-500' :
                                previousAttempt.delta < 0 ? 'bg-red-500' :
                                'bg-gray-400'
                            }`}>
                                {previousAttempt.delta > 0 ? (
                                    <FiArrowUp className="text-white" size={20} />
                                ) : previousAttempt.delta < 0 ? (
                                    <FiTrendingDown className="text-white" size={20} />
                                ) : (
                                    <span className="text-white text-lg">=</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">So với lần trước</p>
                                <p className="font-bold text-gray-900">
                                    {previousAttempt.examTitle}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Lần trước: <strong>{previousAttempt.score}%</strong>
                                    <span className="mx-2">→</span>
                                    Lần này: <strong>{previousAttempt.score + previousAttempt.delta}%</strong>
                                </p>
                            </div>
                            <div className={`text-2xl font-black shrink-0 ${
                                previousAttempt.delta > 0 ? 'text-emerald-600' :
                                previousAttempt.delta < 0 ? 'text-red-600' :
                                'text-gray-500'
                            }`}>
                                {previousAttempt.delta > 0 ? '+' : ''}{previousAttempt.delta}%
                            </div>
                        </div>
                    )}

                    {/* Grade + Summary */}
                    {analysis.grade && (
                        <div className={`rounded-xl p-5 border ${
                            analysis.gradeColor === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
                            analysis.gradeColor === 'blue'  ? 'bg-blue-50 border-blue-200' :
                            analysis.gradeColor === 'amber'  ? 'bg-amber-50 border-amber-200' :
                            'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-center gap-2 mb-3">
                                {analysis.gradeColor === 'emerald' && <FiCheckCircle className="text-emerald-600" size={20} />}
                                {analysis.gradeColor === 'red' && <FiAlertCircle className="text-red-600" size={20} />}
                                <span className={`font-bold text-xl ${
                                    analysis.gradeColor === 'emerald' ? 'text-emerald-800' :
                                    analysis.gradeColor === 'blue'  ? 'text-blue-800'  :
                                    analysis.gradeColor === 'amber'  ? 'text-amber-800'  :
                                    'text-red-800'
                                }`}>{analysis.grade}</span>
                            </div>
                            {analysis.summary && (
                                <TypewriterPlain text={analysis.summary} className="text-gray-700" />
                            )}
                        </div>
                    )}

                    {/* Difficulty Breakdown */}
                    {analysis.difficultyBreakdown && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiAward size={12} /> Phân tích theo độ khó
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                {(['easy', 'medium', 'hard'] as const).map(level => {
                                    const d = analysis.difficultyBreakdown[level];
                                    if (!d) return null;
                                    const color = level === 'easy' ? 'green' : level === 'hard' ? 'red' : 'amber';
                                    const label = level === 'easy' ? 'Dễ' : level === 'hard' ? 'Khó' : 'TB';
                                    return (
                                        <div key={level} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
                                            <p className={`text-xs text-${color}-600 font-semibold mb-1`}>{label}</p>
                                            <p className={`text-2xl font-black text-${color}-700`}>{d.rate}%</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{d.correct}/{d.total} câu</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Strengths */}
                    {analysis.strengths?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiCheckCircle className="text-green-500" size={12} /> Điểm mạnh của bạn
                            </h4>
                            <div className="space-y-2">
                                {analysis.strengths.map((s: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-white text-xs font-bold">{i + 1}</span>
                                        </div>
                                        <PlainText text={s} className="text-sm text-green-800 leading-relaxed" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weaknesses */}
                    {analysis.weaknesses?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiTrendingDown className="text-amber-500" size={12} /> Điểm cần cải thiện
                            </h4>
                            <div className="space-y-2">
                                {analysis.weaknesses.map((w: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-white text-xs font-bold">{i + 1}</span>
                                        </div>
                                        <PlainText text={w} className="text-sm text-amber-800 leading-relaxed" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Common Mistakes */}
                    {analysis.commonMistakes?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiAlertCircle className="text-red-400" size={12} /> Lỗi sai phổ biến cần tránh
                            </h4>
                            <div className="space-y-2">
                                {analysis.commonMistakes.map((m: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                        <span className="text-red-400 shrink-0 mt-0.5">⚠️</span>
                                        <PlainText text={m} className="text-sm text-red-800 leading-relaxed" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Exam Tips */}
                    {analysis.examTips?.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiTarget size={12} /> Mẹo làm bài thi
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {analysis.examTips.map((tip: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2">
                                        <span className="text-blue-500 shrink-0">▸</span>
                                        <PlainText text={tip} className="text-sm text-blue-800" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analysis Detail */}
                    {analysis.analysis && (
                        <div className="bg-white border border-purple-200 rounded-xl p-5">
                            <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiBookOpen size={12} /> Phân tích chi tiết
                            </h4>
                            <PlainText text={analysis.analysis} className="text-gray-700" />
                        </div>
                    )}

                    {/* Overall Advice */}
                    {analysis.overallAdvice && (
                        <div className="bg-purple-100 border border-purple-300 rounded-xl p-5">
                            <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                💡 Lời khuyên từ AI
                            </h4>
                            <PlainText text={analysis.overallAdvice} className="font-medium text-purple-900" />
                        </div>
                    )}

                    {/* Priority Topics */}
                    {analysis.priorityTopics?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                🎯 Ưu tiên học trước
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.priorityTopics.map((topic: string, i: number) => (
                                    <span key={i} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold border border-purple-200">
                                        {i + 1}. {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Exam Suggestion */}
                    {analysis.nextExamSuggestion && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <FiClock size={12} /> Gợi ý bài thi tiếp theo
                            </h4>
                            <PlainText text={analysis.nextExamSuggestion} className="text-indigo-800" />
                        </div>
                    )}

                    {/* Kế hoạch học */}
                    {analysis.studyPlan && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5">
                            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <FiTarget size={12} /> Kế hoạch học cho bạn
                            </h4>
                            <PlainText text={analysis.studyPlan} className="font-medium text-indigo-900" />
                        </div>
                    )}

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400 border-t border-gray-200 pt-3">
                        Phân tích bởi AI · Nhấn ⚡ để làm mới phân tích
                    </p>
                </div>
            )}
        </div>
    );
}

// Mini analysis khi AI bị rate limit
function MiniAnalysis({ data }: { data: any }) {
    const score = data.score || 0;
    const gradeColor = score >= 85 ? 'emerald' : score >= 60 ? 'blue' : 'red';

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className={`font-bold text-${gradeColor}-700`}>
                    {score >= 85 ? '🎉 Xuất sắc!' : score >= 60 ? '✅ Đạt' : '⚠️ Cần cố gắng'}
                </span>
                <span className="text-gray-500 text-sm">({score}%)</span>
            </div>
            {data.analysis && (
                <PlainText text={data.analysis} className="text-gray-700" />
            )}
            {data.overallAdvice && (
                <PlainText text={data.overallAdvice} className="font-medium text-purple-700" />
            )}
        </div>
    );
}
