'use client';

import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import {
  FiAlertCircle, FiCheckCircle, FiTrendingUp, FiTrendingDown,
  FiBook, FiRefreshCw, FiClock, FiAward, FiTarget
} from 'react-icons/fi';

interface Weakness {
  subject: string;
  percentage: number;
  advice: string;
}

interface Strength {
  subject: string;
  percentage: number;
  praise: string;
}

interface RoadmapPhase {
  phase: number;
  days: string;
  title: string;
  description: string;
  tasks: string[];
}

interface Material {
  id: number;
  title: string;
  file_url: string;
  category: string;
}

interface AIAnalysis {
  totalExams: number;
  weaknesses: Weakness[];
  strengths: Strength[];
  suggestions: string[];
  subjectStats: Array<{ subject: string; average: string; count: number }>;
  roadmap: RoadmapPhase[];
  recommendedMaterials: Material[];
  analyzedAt: string;
}

interface AIInsightsProps {
  userId?: number;
}

export function AIInsights({ userId: userIdProp }: AIInsightsProps = {}) {
  const { user } = useAuthStore();
  const userId = userIdProp || user?.id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [message, setMessage] = useState('');
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFetchingRef = useRef(false);

  const fetchAnalysis = async (forceRefresh = false) => {
    if (isFetchingRef.current) return;
    if (!userId) {
      setHasEnoughData(false);
      setMessage('Vui lòng đăng nhập để xem phân tích AI');
      setLoading(false);
      return;
    }
    isFetchingRef.current = true;
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setRateLimited(false);

      const endpoint = forceRefresh ? '/ai/refresh' : '/ai/analyze';
      const method = forceRefresh ? 'post' : 'get';

      const response = await axios[method](endpoint);
      const d = response.data;

      if (d.rateLimited) {
        setRateLimitMsg(d.message || 'Hệ thống AI đang bận, vui lòng thử lại sau.');
        if (d.data) {
          setHasEnoughData(true);
          setAnalysis(d.data);
          setCacheAge(d.cacheAge ?? null);
        }
        setRateLimited(true);
        // Bắt đầu đếm ngược và tự retry khi hết giờ
        const secs = d.retryAfter ?? 30;
        setCountdown(secs);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownRef.current!);
              countdownRef.current = null;
              setRateLimited(false);
              // Auto-retry khi hết countdown (cache sẽ trả về ngay nếu còn hạn)
              setTimeout(() => fetchAnalysis(), 200);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return;
      }

      if (d.success) {
        if (d.hasEnoughData === false) {
          setHasEnoughData(false);
          setMessage(d.message);
        } else {
          setHasEnoughData(true);
          setAnalysis(d.data);
          setCacheAge(d.cached ? (d.cacheAge ?? 0) : 0);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải phân tích AI');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [userId]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handleRefresh = () => {
    fetchAnalysis(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <FiAlertCircle className="mx-auto mb-3 text-red-500" size={32} />
        <p className="text-red-700 font-medium mb-2">Lỗi tải phân tích AI</p>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={() => fetchAnalysis()}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
        >
          Thử lại
        </button>
      </div>
    );
  }

  // Rate limited và không có dữ liệu cũ nào → hiện thông báo thân thiện
  if (rateLimited && !analysis) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⏳</div>
        <h3 className="font-semibold text-amber-800 mb-2">AI đang tạm thời bận</h3>
        <p className="text-sm text-amber-700 mb-4">{rateLimitMsg}</p>
        {countdown > 0 ? (
          <p className="text-2xl font-bold text-amber-600 mb-4 tabular-nums">{countdown}s</p>
        ) : null}
        <button
          onClick={() => fetchAnalysis()}
          disabled={countdown > 0 || refreshing}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {countdown > 0 ? `Tự động thử lại sau ${countdown}s` : 'Thử lại ngay'}
        </button>
      </div>
    );
  }

  if (!hasEnoughData) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiBook className="text-blue-600" size={28} />
        </div>
        <h3 className="text-lg font-bold text-blue-900 mb-2">Cần thêm dữ liệu</h3>
        <p className="text-blue-700 mb-4">{message}</p>
        <p className="text-sm text-blue-600">
          AI cần phân tích từ ít nhất 3 lần làm bài để đưa ra gợi ý chính xác cho bạn.
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* Rate limited banner — hiện khi đang dùng dữ liệu cũ */}
      {rateLimited && analysis && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <span className="text-lg leading-5 flex-shrink-0">⏳</span>
          <p className="text-amber-800 flex-1">{rateLimitMsg}</p>
          {countdown > 0 && (
            <span className="text-amber-600 font-bold tabular-nums flex-shrink-0">{countdown}s</span>
          )}
        </div>
      )}
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🤖</span>
            </div>
            Phân Tích AI
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {cacheAge !== null && cacheAge > 0 ? (
              <>Phân tích {cacheAge} phút trước</>
            ) : (
              <>Phân tích mới nhất</>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Đang phân tích...' : 'Làm mới'}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiBook className="text-blue-500" size={16} />
            <span className="text-xs text-gray-500">Đề thi đã làm</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{analysis.totalExams}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiTrendingDown className="text-red-500" size={16} />
            <span className="text-xs text-gray-500">Điểm yếu</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{analysis.weaknesses.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiTrendingUp className="text-green-500" size={16} />
            <span className="text-xs text-gray-500">Điểm mạnh</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{analysis.strengths.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiTarget className="text-purple-500" size={16} />
            <span className="text-xs text-gray-500">Gợi ý</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{analysis.suggestions.length}</p>
        </div>
      </div>

      {/* Weaknesses */}
      {analysis.weaknesses.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiAlertCircle className="text-red-500" />
            Điểm Yếu Cần Cải Thiện
          </h3>
          <div className="space-y-4">
            {analysis.weaknesses.map((w, i) => (
              <div key={i} className="border-l-4 border-red-400 pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{w.subject}</span>
                  <span className="text-sm font-bold text-red-600">{w.percentage}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${w.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{w.advice}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiCheckCircle className="text-green-500" />
            Điểm Mạnh Của Bạn
          </h3>
          <div className="space-y-4">
            {analysis.strengths.map((s, i) => (
              <div key={i} className="border-l-4 border-green-400 pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{s.subject}</span>
                  <span className="text-sm font-bold text-green-600">{s.percentage}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-green-400 rounded-full transition-all"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{s.praise}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            💡 Gợi Ý Từ AI
          </h3>
          <ul className="space-y-3">
            {analysis.suggestions.map((sug, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 pt-0.5">{sug}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Roadmap */}
      {analysis.roadmap.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiClock className="text-blue-500" />
            Lộ Trình 15 Ngày
          </h3>
          <div className="space-y-4">
            {analysis.roadmap.map((phase, i) => (
              <div key={i} className="border-l-4 border-blue-400 pl-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">
                    Ngày {phase.days}
                  </span>
                  <h4 className="font-bold text-gray-900">{phase.title}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3">{phase.description}</p>
                <ul className="space-y-1">
                  {phase.tasks.map((task, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-500 mt-0.5">▸</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Materials */}
      {analysis.recommendedMaterials.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiBook className="text-orange-500" />
            Tài Liệu Gợi Ý
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.recommendedMaterials.map((mat) => (
              <a
                key={mat.id}
                href={mat.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all group"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
                  <span className="text-xl">📄</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{mat.title}</p>
                  <p className="text-xs text-gray-500">{mat.category}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
