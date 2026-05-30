'use client';

import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { PremiumGate } from '@/components/common/PremiumGate';
import { canUseAI } from '@/lib/utils/permissions';
import {
  FiAlertCircle, FiCheckCircle, FiTrendingUp, FiTrendingDown,
  FiBook, FiRefreshCw, FiClock, FiAward, FiTarget, FiStar
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
  subjectCode?: string; // filter by subject
}

const AI_ANALYSIS_COST = 50;

export function AIInsights({ userId: userIdProp, subjectCode }: AIInsightsProps = {}) {
  const { user } = useAuthStore();
  const userId = userIdProp || user?.id;
  const hasAI = user ? canUseAI(user) : false;
  const currentCoins = Math.max(0, Number(user?.coins ?? 0));
  const canSpendCoins = currentCoins >= AI_ANALYSIS_COST;
  const missingCoins = Math.max(0, AI_ANALYSIS_COST - currentCoins);
  const coinButtonLabel = canSpendCoins
    ? `Dùng ${AI_ANALYSIS_COST} Xu`
    : `Cần thêm ${missingCoins.toLocaleString('vi-VN')} Xu`;
  const coinHelpText = canSpendCoins
    ? `Bạn đang có ${currentCoins.toLocaleString('vi-VN')} Xu, đủ để mở 1 lượt phân tích.`
    : `Bạn đang có ${currentCoins.toLocaleString('vi-VN')} Xu, cần thêm ${missingCoins.toLocaleString('vi-VN')} Xu để dùng phân tích AI.`;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [message, setMessage] = useState('');
  const [isPremiumRequired, setIsPremiumRequired] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFetchingRef = useRef(false);

  const fetchAnalysis = async (forceRefresh = false, useCoins = false) => {
    if (isFetchingRef.current) return;
    if (!userId) {
      setHasEnoughData(false);
      setMessage('Vui lòng đăng nhập để xem phân tích AI');
      setLoading(false);
      return;
    }
    if (useCoins && !canSpendCoins) {
      setIsPremiumRequired(true);
      setError(null);
      setRateLimited(false);
      setLoading(false);
      setRefreshing(false);
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
      const url = useCoins ? `${endpoint}?useCoins=true` : endpoint;

      const response = await axios[method](url);
      const d = response.data;

      // Check if user needs premium access
      if (d.code === 'PREMIUM_REQUIRED') {
        setIsPremiumRequired(true);
        setHasEnoughData(true);
        setLoading(false);
        return;
      }
      
      // Nếu thành công sau khi trả bằng xu, tắt bảng requires premium
      if (useCoins && d.success) {
         setIsPremiumRequired(false);
      }

      if (useCoins && d.success && d.coin_charged) {
         const nextCoins = Number.isFinite(Number(d.coin_balance))
           ? Math.max(0, Number(d.coin_balance))
           : Math.max(0, currentCoins - AI_ANALYSIS_COST);
         useAuthStore.setState((state) => {
           if (state.user) {
             return { user: { ...state.user, coins: nextCoins } };
           }
           return state;
         });
      }

      if (d.code === 'INSUFFICIENT_COINS') {
        setIsPremiumRequired(true);
        setError(null);
        setLoading(false);
        return;
      }

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
      if (err.response?.data?.code === 'PREMIUM_REQUIRED') {
        setIsPremiumRequired(true);
        setHasEnoughData(true);
      } else if (err.response?.data?.code === 'INSUFFICIENT_COINS') {
        setIsPremiumRequired(true);
        setError(null);
      } else {
        setError(err.response?.data?.message || 'Không thể tải phân tích AI');
      }
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
    fetchAnalysis(true, !hasAI);
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

  if (error && error !== 'PREMIUM_REQUIRED') {
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

  // Premium required — show limited UI for free users
  if (isPremiumRequired) {
    return (
      <div className="space-y-6">
        {/* Banner upgrade */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">✨</span>
          </div>
          <h3 className="text-lg font-bold text-amber-900 mb-2">Trải nghiệm Lộ trình AI</h3>
          <p className="text-amber-700 text-sm mb-4 max-w-sm mx-auto">
            Hệ thống AI sẽ phân tích lịch sử làm bài để đưa ra lộ trình cá nhân hoá riêng biệt. Bạn có thể dùng 50 Xu để mở 1 lượt trải nghiệm, hoặc nâng cấp VIP/Pre để dùng ổn định theo quyền gói.
          </p>
          <p className={`text-sm font-semibold mb-4 ${canSpendCoins ? 'text-amber-700' : 'text-red-600'}`}>
            {coinHelpText}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              type="button"
              onClick={() => fetchAnalysis(false, true)}
              disabled={!canSpendCoins || loading || refreshing}
              className={`inline-flex items-center gap-2 px-6 py-3 border-2 font-bold rounded-xl transition-all text-sm w-full sm:w-auto justify-center shadow-sm ${
                canSpendCoins
                  ? 'bg-white text-amber-600 border-amber-400 hover:bg-amber-50 hover:-translate-y-0.5'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed shadow-none'
              }`}
            >
              <span className="text-lg">⭐</span> {coinButtonLabel}
            </button>
            <a href="/vip" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm w-full sm:w-auto justify-center">
              👑 Xem gói VIP
            </a>
          </div>
        </div>

        {/* Roadmap template cho free user */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiClock className="text-blue-500" />
              Lộ Trình Học Tập
            </h3>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold flex items-center gap-1">
              <FiStar size={10} /> Nâng cấp VIP/Pre để cá nhân hoá
            </span>
          </div>
          <div className="space-y-4">
            {[
              { days: '1–3', title: 'Ôn từ vựng cơ bản', tasks: ['Học 20 từ mới mỗi ngày', 'Làm bài tập trắc nghiệm 10 câu', 'Xem lại từ đã học'] },
              { days: '4–7', title: 'Luyện ngữ pháp', tasks: ['Học cấu trúc câu thường gặp', 'Làm 1 đề mô phỏng', 'Ghi chú lỗi sai'] },
              { days: '8–15', title: 'Luyện đề + tốc độ', tasks: ['Làm 1 đề mỗi ngày', 'Rút kinh nghiệm từng đề', 'Ôn lại phần yếu'] },
            ].map((phase, i) => (
              <div key={i} className="border-l-4 border-gray-300 pl-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">
                    Ngày {phase.days}
                  </span>
                  <h4 className="font-bold text-gray-700">{phase.title}</h4>
                </div>
                <ul className="space-y-1">
                  {phase.tasks.map((task, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 mt-0.5">▸</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={() => fetchAnalysis(false, true)}
              disabled={!canSpendCoins || loading || refreshing}
              className={`block w-full text-center px-4 py-2.5 border font-bold rounded-xl transition-all text-sm ${
                canSpendCoins
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              ⭐ {coinButtonLabel}
            </button>
            <a href="/vip" className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm">
              ✨ Nâng cấp VIP/Pre
            </a>
          </div>
        </div>
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
          disabled={refreshing || (!hasAI && !canSpendCoins)}
          title={!hasAI && !canSpendCoins ? coinHelpText : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Đang phân tích...' : hasAI ? 'Làm mới' : `Làm mới ${AI_ANALYSIS_COST} Xu`}
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
          <p className="text-2xl font-bold text-red-600">{(analysis.weaknesses || []).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiTrendingUp className="text-green-500" size={16} />
            <span className="text-xs text-gray-500">Điểm mạnh</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{(analysis.strengths || []).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiTarget className="text-purple-500" size={16} />
            <span className="text-xs text-gray-500">Gợi ý</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{(analysis.suggestions || []).length}</p>
        </div>
      </div>

      {/* Weaknesses */}
      {(analysis.weaknesses || []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiAlertCircle className="text-red-500" />
            Điểm Yếu Cần Cải Thiện
          </h3>
          <div className="space-y-4">
            {(analysis.weaknesses || []).map((w, i) => (
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
      {(analysis.strengths || []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiCheckCircle className="text-green-500" />
            Điểm Mạnh Của Bạn
          </h3>
          <div className="space-y-4">
            {(analysis.strengths || []).map((s, i) => (
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
      {(analysis.suggestions || []).length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            💡 Gợi Ý Từ AI
          </h3>
          <ul className="space-y-3">
            {(analysis.suggestions || []).map((sug, i) => (
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

      {/* Roadmap — VIP/Pre: AI roadmap | Free: template roadmap */}
      {(analysis.roadmap || []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiClock className="text-blue-500" />
              Lộ Trình Học Tập
            </h3>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
              {hasAI ? '✨ AI cá nhân hoá' : '📋 Gợi ý chung'}
            </span>
          </div>
          <div className="space-y-4">
            {(analysis.roadmap || []).map((phase, i) => (
              <div key={i} className="border-l-4 border-blue-400 pl-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">
                    Ngày {phase.days}
                  </span>
                  <h4 className="font-bold text-gray-900">{phase.title}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3">{phase.description}</p>
                <ul className="space-y-1">
                  {(phase.tasks || []).map((task, j) => (
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

      {/* Free user: hiện roadmap template */}
      {!hasAI && !(analysis.roadmap || []).length && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiClock className="text-blue-500" />
              Lộ Trình Học Tập
            </h3>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold flex items-center gap-1">
              <FiStar size={10} /> Nâng cấp VIP/Pre để cá nhân hoá
            </span>
          </div>
          <div className="space-y-4">
            {[
              { days: '1–3', title: 'Ôn từ vựng cơ bản', tasks: ['Học 20 từ mới mỗi ngày', 'Làm bài tập trắc nghiệm 10 câu', 'Xem lại từ đã học'] },
              { days: '4–7', title: 'Luyện ngữ pháp', tasks: ['Học cấu trúc câu thường gặp', 'Làm 1 đề mô phỏng', 'Ghi chú lỗi sai'] },
              { days: '8–15', title: 'Luyện đề + tốc độ', tasks: ['Làm 1 đề mỗi ngày', 'Rút kinh nghiệm từng đề', 'Ôn lại phần yếu'] },
            ].map((phase, i) => (
              <div key={i} className="border-l-4 border-gray-300 pl-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">
                    Ngày {phase.days}
                  </span>
                  <h4 className="font-bold text-gray-700">{phase.title}</h4>
                </div>
                <ul className="space-y-1">
                  {phase.tasks.map((task, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 mt-0.5">▸</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={() => fetchAnalysis(false, true)}
              disabled={!canSpendCoins || loading || refreshing}
              className={`block w-full text-center px-4 py-2.5 border font-bold rounded-xl transition-all text-sm ${
                canSpendCoins
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              ⭐ {coinButtonLabel}
            </button>
            <a href="/vip" className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm">
              ✨ Nâng cấp VIP (Miễn phí AI)
            </a>
          </div>
        </div>
      )}

      {/* Recommended Materials */}
      {(analysis.recommendedMaterials || []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiBook className="text-orange-500" />
            Tài Liệu Gợi Ý
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(analysis.recommendedMaterials || []).map((mat) => (
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
