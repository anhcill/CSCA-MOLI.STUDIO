'use client';

import { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiBarChart2, FiClock } from 'react-icons/fi';
import { authFetch } from '@/lib/utils/authFetch';

interface HistoryItem {
    examTitle: string;
    date: string;
    score: number;
    correct?: number;
    total?: number;
}

interface ProgressData {
    hasEnoughData: boolean;
    message?: string;
    totalAttempts: number;
    history: HistoryItem[];
    delta: number;
    trend: 'improving' | 'declining' | 'stable';
    summary: string;
    improvementNotes: string[];
    warningNotes: string[];
}

export default function AIProgressAnalysis({ userId }: { userId?: number }) {
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        try {
            setLoading(true);
            const res = await authFetch('/api/ai/progress');
            const result = await res.json();
            if (result.success) setData(result);
            else setError(result.message || 'Lỗi tải dữ liệu');
        } catch {
            setError('Không thể tải dữ liệu tiến bộ');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-200 border-t-purple-600" />
                    <span className="text-gray-600 text-sm">Đang phân tích tiến bộ...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="text-red-700 text-sm">{error || 'Không có dữ liệu'}</p>
            </div>
        );
    }

    if (!data.hasEnoughData) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                    <FiBarChart2 className="text-amber-600" size={18} />
                    <p className="font-semibold text-amber-800">Chưa đủ dữ liệu</p>
                </div>
                <p className="text-amber-700 text-sm">{data.message}</p>
                {/* Mini chart */}
                {data.history?.length > 0 && (
                    <MiniChart history={data.history} />
                )}
            </div>
        );
    }

    const trendIcon = data.trend === 'improving' ? <FiTrendingUp className="text-emerald-600" size={20} />
        : data.trend === 'declining' ? <FiTrendingDown className="text-red-600" size={20} />
            : <FiMinus className="text-amber-600" size={20} />;

    const trendColor = data.trend === 'improving' ? 'emerald'
        : data.trend === 'declining' ? 'red' : 'amber';

    const deltaColor = data.delta > 0 ? 'text-emerald-600' : data.delta < 0 ? 'text-red-600' : 'text-amber-600';
    const deltaLabel = data.delta > 0 ? `+${data.delta}%` : `${data.delta}%`;

    return (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-gray-200 overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-blue-600">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                            <FiBarChart2 className="text-white" size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">📈 Phân tích tiến bộ</h3>
                            <p className="text-white/70 text-xs">{data.totalAttempts} bài thi đã làm</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`bg-${trendColor}-100 rounded-xl px-3 py-1.5 flex items-center gap-1.5`}>
                            {trendIcon}
                            <span className={`font-bold text-${trendColor}-700 text-sm`}>{data.trend === 'improving' ? 'Tăng' : data.trend === 'declining' ? 'Giảm' : 'Ổn định'}</span>
                        </div>
                        <span className={`text-2xl font-black ${deltaColor} bg-white rounded-lg px-2`}>
                            {deltaLabel}
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-5">

                {/* Mini Chart */}
                <MiniChart history={data.history} />

                {/* Summary */}
                {data.summary && (
                    <div className={`rounded-xl p-4 border ${
                        data.trend === 'improving' ? 'bg-emerald-50 border-emerald-200' :
                        data.trend === 'declining' ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                    }`}>
                        <p className={`text-sm font-medium ${
                            data.trend === 'improving' ? 'text-emerald-800' :
                            data.trend === 'declining' ? 'text-red-800' :
                            'text-amber-800'
                        }`}>{data.summary}</p>
                    </div>
                )}

                {/* Improvement Notes */}
                {data.improvementNotes?.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💪 Điểm tích cực</h4>
                        <div className="space-y-2">
                            {data.improvementNotes.map((note, i) => (
                                <div key={i} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                    <span className="text-green-600 font-bold text-sm">✓</span>
                                    <span className="text-sm text-green-800">{note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Warning Notes */}
                {data.warningNotes?.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">⚠️ Cần lưu ý</h4>
                        <div className="space-y-2">
                            {data.warningNotes.map((note, i) => (
                                <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <span className="text-red-600 font-bold text-sm">!</span>
                                    <span className="text-sm text-red-800">{note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* History Table */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Lịch sử điểm số</h4>
                    <div className="space-y-2">
                        {data.history.map((h, i) => {
                            const color = h.score >= 80 ? 'emerald' : h.score >= 60 ? 'blue' : h.score >= 40 ? 'amber' : 'red';
                            return (
                                <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                            i === 0 ? 'bg-gray-100 text-gray-500' :
                                            i === data.history.length - 1 ? 'bg-purple-100 text-purple-700' :
                                            'bg-gray-50 text-gray-400'
                                        }`}>
                                            {i === 0 ? '1st' : i === data.history.length - 1 ? 'Now' : `#${i + 1}`}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{h.examTitle}</p>
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <FiClock size={10} /> {h.date}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {h.correct !== undefined && (
                                            <span className="text-xs text-gray-400">{h.correct}/{h.total}</span>
                                        )}
                                        <span className={`font-bold text-lg text-${color}-600`}>{h.score}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Mini bar chart
function MiniChart({ history }: { history: HistoryItem[] }) {
    if (!history || history.length < 2) return null;

    const max = Math.max(...history.map(h => h.score));
    const min = Math.min(...history.map(h => h.score));
    const range = max - min || 1;

    return (
        <div className="space-y-1">
            <div className="flex items-end gap-1 h-20">
                {history.map((h, i) => {
                    const height = Math.max(10, ((h.score - min) / range) * 80 + 10);
                    const isFirst = i === 0;
                    const isLast = i === history.length - 1;
                    const color = h.score >= 80 ? 'bg-emerald-400' : h.score >= 60 ? 'bg-blue-400' : h.score >= 40 ? 'bg-amber-400' : 'bg-red-400';
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${h.examTitle}: ${h.score}%`}>
                            <div className="w-full flex flex-col items-center">
                                <span className="text-[10px] font-bold text-gray-600">{h.score}</span>
                                <div
                                    className={`w-full rounded-sm ${color} ${isFirst ? 'rounded-t-lg' : ''} ${isLast ? 'rounded-t-lg ring-2 ring-purple-400' : ''}`}
                                    style={{ height: `${height}px`, minHeight: '4px' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>Lần đầu</span>
                <span>Hiện tại</span>
            </div>
        </div>
    );
}
