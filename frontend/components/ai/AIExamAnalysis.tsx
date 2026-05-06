'use client';

import { useState } from 'react';
import { FiZap, FiRefreshCw, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

interface AIExamAnalysisProps {
    attemptId: number;
    aiAnalysis: any;
    aiLoading: boolean;
    onRefresh: () => void;
}

export default function AIExamAnalysis({ attemptId, aiAnalysis, aiLoading, onRefresh }: AIExamAnalysisProps) {
    const [expanded, setExpanded] = useState(true);

    const analysis = aiAnalysis?.aiAnalysis;

    if (aiLoading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-200 border-t-purple-600" />
                    <span className="text-gray-600 text-sm font-medium">AI đang phân tích bài thi của bạn...</span>
                </div>
            </div>
        );
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
                        <p className="text-gray-500 text-xs">DeepSeek R1 — phân tích thông minh</p>
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
                <div className="px-5 pb-5 space-y-4">

                    {/* Grade + Summary */}
                    {analysis.grade && (
                        <div className={`rounded-xl p-4 border ${
                            analysis.gradeColor === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
                            analysis.gradeColor === 'blue'  ? 'bg-blue-50 border-blue-200' :
                            analysis.gradeColor === 'amber'  ? 'bg-amber-50 border-amber-200' :
                            'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {analysis.gradeColor === 'emerald' && <FiCheckCircle className="text-emerald-600" size={18} />}
                                {analysis.gradeColor === 'red' && <FiAlertCircle className="text-red-600" size={18} />}
                                <span className={`font-bold text-lg ${
                                    analysis.gradeColor === 'emerald' ? 'text-emerald-800' :
                                    analysis.gradeColor === 'blue'  ? 'text-blue-800'  :
                                    analysis.gradeColor === 'amber'  ? 'text-amber-800'  :
                                    'text-red-800'
                                }`}>{analysis.grade}</span>
                            </div>
                            {analysis.summary && (
                                <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
                            )}
                        </div>
                    )}

                    {/* Difficulty Breakdown */}
                    {analysis.difficultyBreakdown && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Phân tích theo độ khó</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {(['easy', 'medium', 'hard'] as const).map(level => {
                                    const d = analysis.difficultyBreakdown[level];
                                    if (!d) return null;
                                    const color = level === 'easy' ? 'green' : level === 'hard' ? 'red' : 'amber';
                                    const label = level === 'easy' ? 'Dễ' : level === 'hard' ? 'Khó' : 'TB';
                                    return (
                                        <div key={level} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
                                            <p className={`text-xs text-${color}-600 font-semibold mb-1`}>{label}</p>
                                            <p className={`text-xl font-black text-${color}-700`}>{d.rate}%</p>
                                            <p className="text-xs text-gray-500">{d.correct}/{d.total} câu</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Strengths */}
                    {analysis.strengths?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💪 Điểm mạnh</h4>
                            <div className="space-y-2">
                                {analysis.strengths.map((s: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        <FiCheckCircle className="text-green-600 shrink-0 mt-0.5" size={14} />
                                        <span className="text-sm text-green-800">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weaknesses */}
                    {analysis.weaknesses?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📌 Điểm cần cải thiện</h4>
                            <div className="space-y-2">
                                {analysis.weaknesses.map((w: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        <FiTrendingDown className="text-amber-600 shrink-0 mt-0.5" size={14} />
                                        <span className="text-sm text-amber-800">{w}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analysis Detail */}
                    {analysis.analysis && (
                        <div className="bg-white border border-purple-200 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">🔍 Phân tích chi tiết</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">{analysis.analysis}</p>
                        </div>
                    )}

                    {/* Overall Advice */}
                    {analysis.overallAdvice && (
                        <div className="bg-purple-100 border border-purple-200 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wide mb-2">💡 Lời khuyên</h4>
                            <p className="text-sm text-purple-900 font-medium leading-relaxed">{analysis.overallAdvice}</p>
                        </div>
                    )}

                    {/* Priority Topics */}
                    {analysis.priorityTopics?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🎯 Ưu tiên học</h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.priorityTopics.map((topic: string, i: number) => (
                                    <span key={i} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold border border-purple-200">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400">
                        Phân tích bởi AI · DeepSeek R1 · Nhấn ⚡ để xem chi tiết từng câu
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
                <p className="text-sm text-gray-700">{data.analysis}</p>
            )}
            {data.overallAdvice && (
                <p className="text-sm text-purple-700 font-medium">{data.overallAdvice}</p>
            )}
        </div>
    );
}
