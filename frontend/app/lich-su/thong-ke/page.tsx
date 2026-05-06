'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import {
  getHistoryStats,
  type HistoryStatsData,
} from '@/lib/api/insights';
import { SUBJECT_SLUG_TO_CODE } from '@/lib/api/exams';
import {
  FiBarChart2, FiTrendingUp, FiTrendingDown, FiMinus,
  FiTarget, FiAward, FiClock, FiCheckCircle, FiXCircle,
  FiRefreshCw, FiArrowLeft, FiCheck, FiAlertCircle,
  FiActivity, FiPieChart, FiChevronRight,
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${Math.round(s)}s`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPercent(value: number): string {
  if (!value || isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-600" style={{ color: p.color }}>
          <span className="font-semibold">{p.name}: </span>
          <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, iconBg }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={color} size={20} />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ThongKePage() {
  const { isAuthenticated } = useAuthStore();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<HistoryStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subjectParam = searchParams.get('subject');

  useEffect(() => {
    if (isAuthenticated) loadStats();
    else setLoading(false);
  }, [isAuthenticated, subjectParam]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Convert slug → code (e.g. "toan" → "MATH")
      const subjectCode = subjectParam
        ? (SUBJECT_SLUG_TO_CODE[subjectParam] || subjectParam.toUpperCase())
        : undefined;
      const data = await getHistoryStats(subjectCode);
      setStats(data);
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Lỗi khi tải thống kê');
    } finally {
      setLoading(false);
    }
  };

  // Compute per-subject stats when subject param is set
  const displayStats: HistoryStatsData | null = useMemo(() => {
    if (!stats || !subjectParam) return stats;

    // Map slug to code for comparison
    const mappedCode = SUBJECT_SLUG_TO_CODE[subjectParam] || subjectParam.toUpperCase();
    const subjectAttempts = stats.recentAttempts.filter(a => a.subjectCode === mappedCode);
    const subjectSubject = stats.subjects.find(s => s.subjectCode === mappedCode);
    const subjectScoreDist = stats.scoreDistribution;

    // Recompute overview for this subject only
    const totalAttempts = subjectAttempts.length;
    if (totalAttempts === 0) return stats;

    const scores = subjectAttempts.map(a => a.score);
    const totalCorrect = subjectAttempts.reduce((s, a) => s + a.totalCorrect, 0);
    const totalIncorrect = subjectAttempts.reduce((s, a) => s + a.totalIncorrect, 0);
    const totalUnanswered = subjectAttempts.reduce((s, a) => s + a.totalUnanswered, 0);
    const durations = subjectAttempts.map(a => a.durationSeconds);
    const totalDuration = durations.reduce((s, d) => s + d, 0);
    const uniqueDates = [...new Set(subjectAttempts.map(a => a.submitTime.split('T')[0]))];
    const uniqueExams = [...new Set(subjectAttempts.map(a => a.examId))];

    const passCount = subjectAttempts.filter(a => a.percentage >= 60).length;
    const failCount = totalAttempts - passCount;

    // Rebuild distribution from subject attempts
    const distBuckets = [
      { label: '0-2', min: 0, max: 2, count: 0 },
      { label: '2-4', min: 2, max: 4, count: 0 },
      { label: '4-6', min: 4, max: 6, count: 0 },
      { label: '6-8', min: 6, max: 8, count: 0 },
      { label: '8-10', min: 8, max: 10.01, count: 0 },
    ];
    subjectAttempts.forEach(a => {
      const bucket = distBuckets.find(b => a.score >= b.min && a.score < b.max);
      if (bucket) bucket.count++;
    });

    const scoreDistribution = distBuckets.map(b => ({
      range: b.label,
      count: b.count,
      percentage: totalAttempts > 0 ? (b.count / totalAttempts) * 100 : 0,
    }));

    // First half vs second half for improvement
    const mid = Math.floor(totalAttempts / 2);
    const firstHalf = subjectAttempts.slice(0, mid);
    const secondHalf = subjectAttempts.slice(mid);
    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((s, a) => s + a.score, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, a) => s + a.score, 0) / secondHalf.length
      : 0;

    return {
      ...stats,
      overview: {
        totalAttempts,
        uniqueExams: uniqueExams.length,
        activeDays: uniqueDates.length,
        avgScore: scores.reduce((s, v) => s + v, 0) / totalAttempts,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores),
        avgPercentage: subjectAttempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts,
        totalCorrect,
        totalIncorrect,
        totalUnanswered,
        avgDurationSeconds: totalDuration / totalAttempts,
        totalDurationSeconds: totalDuration,
      },
      subjects: subjectSubject ? [subjectSubject] : [],
      scoreDistribution,
      passFail: {
        passCount,
        failCount,
        totalCount: totalAttempts,
        passRate: (passCount / totalAttempts) * 100,
        excellentRate: (subjectAttempts.filter(a => a.percentage >= 80).length / totalAttempts) * 100,
      },
      recentAttempts: subjectAttempts,
      improvement: {
        firstHalfAvg,
        secondHalfAvg,
        improvement: secondHalfAvg - firstHalfAvg,
        trend: secondHalfAvg > firstHalfAvg + 0.3 ? 'improving'
          : secondHalfAvg < firstHalfAvg - 0.3 ? 'declining'
          : 'stable',
      },
    };
  }, [stats, subjectParam]);

  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
        <Header />
        <main className="container mx-auto px-6 py-8 max-w-[1100px]">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🔒</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Đăng nhập để xem thống kê</h2>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">Theo dõi tiến trình học tập và phân tích chi tiết kết quả thi của bạn.</p>
                <Link href="/login" className="inline-block px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg">
                  Đăng nhập ngay
                </Link>
              </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-[1100px]">
        <div className="space-y-6">

          {/* Hero Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                      <span className="text-3xl">📊</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-blue-100 text-sm">
                        <Link href={subjectParam ? `/lich-su?subject=${subjectParam}` : '/lich-su'} className="flex items-center gap-1 hover:text-white transition-colors">
                          <FiArrowLeft size={14} /> Lịch sử thi
                        </Link>
                        <span className="text-blue-200">/</span>
                        <span className="text-white font-medium">Thống kê chi tiết</span>
                      </div>
                      <h1 className="text-2xl font-black tracking-tight mt-0.5">Thống Kê Chi Tiết</h1>
                      <p className="text-blue-100 text-sm mt-1">
                        {displayStats
                          ? `${displayStats.overview.totalAttempts} lần thi · ${displayStats.overview.activeDays} ngày hoạt động · Điểm TB ${displayStats.overview.avgScore.toFixed(1)}/10`
                          : 'Đang tải dữ liệu...'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={loadStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Tải lại
                  </button>
                </div>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <FiAlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-red-800">Lỗi khi tải dữ liệu</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button onClick={loadStats} className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors shrink-0">
                  Thử lại
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !displayStats && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <div className="text-5xl mb-3">📊</div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Chưa có dữ liệu thống kê</h3>
                <p className="text-sm text-gray-500 mb-5">Hãy hoàn thành ít nhất 1 bài thi để xem thống kê chi tiết.</p>
                <Link href="/de-mo-phong" className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                  Làm đề ngay →
                </Link>
              </div>
            )}

            {/* Loading Skeletons */}
            {loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-72 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
                </div>
              </div>
            )}

            {displayStats && !loading && displayStats.overview.totalAttempts > 0 && (
              <>
                {/* ─── ROW 1: Overview Stats ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={FiBarChart2}
                    label="Tổng lần thi"
                    value={displayStats.overview.totalAttempts}
                    sub={`${displayStats.overview.uniqueExams} đề riêng biệt`}
                    color="text-indigo-500"
                    iconBg="bg-indigo-100"
                  />
                  <StatCard
                    icon={FiTarget}
                    label="Điểm trung bình"
                    value={`${displayStats.overview.avgScore.toFixed(1)}/10`}
                    sub={`Cao: ${displayStats.overview.maxScore.toFixed(1)} · Thấp: ${displayStats.overview.minScore.toFixed(1)}`}
                    color="text-emerald-500"
                    iconBg="bg-emerald-100"
                  />
                  <StatCard
                    icon={FiActivity}
                    label="Ngày hoạt động"
                    value={displayStats.overview.activeDays}
                    sub={`${displayStats.overview.totalCorrect + displayStats.overview.totalIncorrect} câu đã làm`}
                    color="text-amber-500"
                    iconBg="bg-amber-100"
                  />
                  <StatCard
                    icon={FiClock}
                    label="Tổng thời gian"
                    value={formatDuration(displayStats.overview.totalDurationSeconds)}
                    sub={`TB ${formatTime(displayStats.overview.avgDurationSeconds)}/bài`}
                    color="text-blue-500"
                    iconBg="bg-blue-100"
                  />
                </div>

                {/* ─── ROW 2: Score Distribution + Pass/Fail ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Score Distribution Bar Chart */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          <FiBarChart2 size={18} className="text-indigo-500" />
                          Phân bố điểm số
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Số lần thi theo từng khoảng điểm</p>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg font-medium">
                        {displayStats.scoreDistribution.reduce((s, d) => s + d.count, 0)} lần thi
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={displayStats.scoreDistribution.map(d => ({
                        name: d.range,
                        Số_lần: d.count,
                        'Tỷ lệ (%)': parseFloat(d.percentage.toFixed(1)),
                      }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Số_lần" fill="#6366f1" radius={[6, 6, 0, 0]} name="Số lần thi" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-2 pt-3 border-t border-gray-100">
                      {displayStats.scoreDistribution.map((d, i) => (
                        <div key={d.range} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-500">{d.range}:</span>
                          <span className="font-bold text-gray-700">{d.count} lần ({d.percentage.toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pass / Fail Pie Chart */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                      <FiPieChart size={18} className="text-emerald-500" />
                      Tỷ lệ đỗ / chưa đỗ
                    </h2>
                    <p className="text-xs text-gray-400 mb-2">≥60% = Đỗ · &lt;60% = Chưa đỗ</p>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Đỗ', value: displayStats.passFail.passCount },
                              { name: 'Chưa đỗ', value: displayStats.passFail.failCount },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#f87171" />
                          </Pie>
                          <Tooltip
                            formatter={(value: any, name: any) => [value, name]}
                            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-gray-800">{displayStats.passFail.passCount} lần đỗ</p>
                            <p className="text-xs text-gray-400">≥60%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-gray-800">{displayStats.passFail.failCount} lần chưa đỗ</p>
                            <p className="text-xs text-gray-400">&lt;60%</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            Tổng: <b className="text-gray-700">{displayStats.passFail.totalCount} lần thi</b>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                      <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-xs text-emerald-600 font-medium">Tỷ lệ đỗ</p>
                        <p className="text-xl font-black text-emerald-700">{displayStats.passFail.passRate.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-xs text-amber-600 font-medium">Xuất sắc (≥80%)</p>
                        <p className="text-xl font-black text-amber-700">{displayStats.passFail.excellentRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── ROW 3: Monthly Trend (Area) + Improvement ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          <FiTrendingUp size={18} className="text-blue-500" />
                          Xu hướng điểm số theo tháng
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Điểm TB qua 6 tháng gần nhất</p>
                      </div>
                      {displayStats.improvement && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                          displayStats.improvement.trend === 'improving' ? 'bg-emerald-50 text-emerald-700' :
                          displayStats.improvement.trend === 'declining' ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {displayStats.improvement.trend === 'improving' ? <FiTrendingUp size={12} /> :
                           displayStats.improvement.trend === 'declining' ? <FiTrendingDown size={12} /> :
                           <FiMinus size={12} />}
                          {displayStats.improvement.trend === 'improving' ? 'Tiến bộ' :
                           displayStats.improvement.trend === 'declining' ? 'Cần cải thiện' : 'Ổn định'}
                        </span>
                      )}
                    </div>
                    {displayStats.monthlyTrend.length > 1 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={displayStats.monthlyTrend.map(m => ({
                          tháng: m.monthLabel,
                          'Điểm TB': parseFloat(m.avgScore.toFixed(1)),
                          'Điểm cao nhất': parseFloat(m.maxScore.toFixed(1)),
                        }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="tháng" tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="Điểm TB" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorScore)" name="Điểm TB" />
                          <Line type="monotone" dataKey="Điểm cao nhất" stroke="#a5b4fc" strokeWidth={1.5} dot={{ r: 3, fill: '#a5b4fc' }} name="Điểm cao nhất" strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                        Cần thêm dữ liệu để xem xu hướng
                      </div>
                    )}
                  </div>

                  {/* Improvement Card */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <FiAward size={18} className="text-amber-500" />
                      Tiến bộ của bạn
                    </h2>
                    {displayStats.improvement ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Nửa đầu</p>
                            <p className="text-lg font-black text-gray-700">{displayStats.improvement.firstHalfAvg.toFixed(1)}</p>
                          </div>
                          <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-100">
                            <p className="text-xs text-indigo-500 mb-1">Nửa sau</p>
                            <p className="text-lg font-black text-indigo-700">{displayStats.improvement.secondHalfAvg.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl text-center border-2 ${
                          displayStats.improvement.improvement > 0 ? 'bg-emerald-50 border-emerald-200' :
                          displayStats.improvement.improvement < 0 ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                        }`}>
                          <p className={`text-3xl font-black ${
                            displayStats.improvement.improvement > 0 ? 'text-emerald-600' :
                            displayStats.improvement.improvement < 0 ? 'text-red-500' : 'text-gray-600'
                          }`}>
                            {displayStats.improvement.improvement > 0 ? '+' : ''}{displayStats.improvement.improvement.toFixed(1)}
                          </p>
                          <p className="text-xs font-medium mt-1 text-gray-600">
                            {displayStats.improvement.improvement > 0
                              ? 'Điểm của bạn đang cải thiện!'
                              : displayStats.improvement.improvement < 0
                              ? 'Điểm giảm so với trước đây'
                              : 'Điểm của bạn khá ổn định'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">Chưa đủ dữ liệu</p>
                    )}
                  </div>
                </div>

                {/* ─── ROW 4: Subject Stats + Difficulty ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Subject Performance Bar Chart */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          <FiTarget size={18} className="text-purple-500" />
                          Điểm trung bình theo môn học
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">So sánh điểm TB giữa các môn</p>
                      </div>
                    </div>
                    {displayStats.subjects.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={displayStats.subjects.map(s => ({
                            name: s.subjectName,
                            'Điểm TB': parseFloat(s.avgScore.toFixed(1)),
                            'Điểm cao nhất': parseFloat(s.maxScore.toFixed(1)),
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} width={75} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="Điểm TB" fill="#6366f1" radius={[0, 6, 6, 0]} name="Điểm TB" />
                          <Bar dataKey="Điểm cao nhất" fill="#c7d2fe" radius={[0, 6, 6, 0]} name="Điểm cao nhất" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                        Chưa có dữ liệu theo môn học
                      </div>
                    )}
                    {/* Subject Cards */}
                    {displayStats.subjects.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                        {displayStats.subjects.map(s => {
                          const scoreColor = s.avgScore >= 8 ? 'text-emerald-600' : s.avgScore >= 6 ? 'text-amber-600' : 'text-red-500';
                          const scoreBg = s.avgScore >= 8 ? 'bg-emerald-50 border-emerald-100' : s.avgScore >= 6 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
                          return (
                            <div key={s.subjectId} className={`p-3 rounded-xl border ${scoreBg}`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-bold text-gray-800 truncate">{s.subjectName}</p>
                                <span className={`text-lg font-black ${scoreColor}`}>{s.avgScore.toFixed(1)}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><FiCheck className="text-emerald-500" size={10} />{s.totalCorrect} đúng</span>
                                <span className="flex items-center gap-1"><FiXCircle className="text-red-400" size={10} />{s.totalIncorrect} sai</span>
                                <span className="flex items-center gap-1"><FiClock size={10} />{formatTime(s.avgDurationSeconds)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Difficulty Breakdown */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          <FiActivity size={18} className="text-rose-500" />
                          Phân tích theo độ khó
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Hiệu suất với từng mức độ khó</p>
                      </div>
                    </div>
                    {displayStats.difficulties.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={displayStats.difficulties.map(d => ({
                            name: d.difficulty === 'easy' ? 'Dễ' : d.difficulty === 'medium' ? 'TB' : 'Khó',
                            'Tỷ lệ đỗ (%)': parseFloat(d.passRate.toFixed(1)),
                            'Điểm TB (%)': parseFloat(d.avgPercentage.toFixed(1)),
                          }))}
                          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="Tỷ lệ đỗ (%)" fill="#22c55e" radius={[4, 4, 0, 0]} name="Tỷ lệ đỗ (%)" />
                          <Bar dataKey="Điểm TB (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Điểm TB (%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                        Chưa có dữ liệu theo độ khó
                      </div>
                    )}
                    {displayStats.difficulties.length > 0 && (
                      <div className="space-y-2.5 mt-3 pt-3 border-t border-gray-100">
                        {displayStats.difficulties.map(d => {
                          const color = d.difficulty === 'easy' ? '#22c55e' : d.difficulty === 'medium' ? '#f59e0b' : '#ef4444';
                          const label = d.difficulty === 'easy' ? 'Dễ' : d.difficulty === 'medium' ? 'Trung bình' : 'Khó';
                          return (
                            <div key={d.difficulty} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                                <span className="text-xs text-gray-400">({d.attemptCount} lần)</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-500">Đỗ: <b className="text-gray-700">{d.passRate.toFixed(0)}%</b></span>
                                <span className="text-xs font-medium text-gray-500">TB: <b className="text-gray-700">{d.avgPercentage.toFixed(0)}%</b></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── ROW 5: Time Management + Recent Attempts ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                      <FiClock size={18} className="text-blue-500" />
                      Quản lý thời gian
                    </h2>
                    <p className="text-xs text-gray-400 mb-4">Phân tích thời gian làm bài</p>
                    <div className="space-y-3">
                      {[
                        {
                          label: 'TB thời gian/bài',
                          value: formatDuration(displayStats.timeStats.avgDurationSeconds),
                          color: 'text-gray-800',
                        },
                        {
                          label: 'TB thời gian/câu',
                          value: displayStats.timeStats.avgSecondsPerQuestion > 120
                            ? `${Math.round(displayStats.timeStats.avgSecondsPerQuestion / 60)} phút`
                            : `${Math.round(displayStats.timeStats.avgSecondsPerQuestion)}s`,
                          color: displayStats.timeStats.avgSecondsPerQuestion > 120 ? 'text-amber-600' : 'text-gray-800',
                        },
                        {
                          label: 'Thời gian sử dụng',
                          value: formatPercent(displayStats.timeStats.avgTimeUsedPercent),
                          color: displayStats.timeStats.avgTimeUsedPercent > 100 ? 'text-red-500' : 'text-gray-800',
                        },
                        {
                          label: 'Câu đúng (TB thời gian)',
                          value: formatTime(displayStats.timeStats.correctAvgSeconds),
                          color: 'text-emerald-600',
                        },
                        {
                          label: 'Câu sai (TB thời gian)',
                          value: formatTime(displayStats.timeStats.incorrectAvgSeconds),
                          color: 'text-red-500',
                        },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm text-gray-600">{item.label}</span>
                          <span className={`font-bold ${item.color}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                    {/* Time comparison insight */}
                    {displayStats.timeStats.correctAvgSeconds > 0 && displayStats.timeStats.incorrectAvgSeconds > 0 && (
                      <div className={`mt-4 p-3 rounded-xl text-sm ${
                        displayStats.timeStats.incorrectAvgSeconds > displayStats.timeStats.correctAvgSeconds * 1.3
                          ? 'bg-amber-50 border border-amber-200 text-amber-800'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      }`}>
                        <p className="font-medium">
                          {displayStats.timeStats.incorrectAvgSeconds > displayStats.timeStats.correctAvgSeconds * 1.3
                            ? `⚡ Câu sai mất nhiều thời gian hơn ${((displayStats.timeStats.incorrectAvgSeconds / displayStats.timeStats.correctAvgSeconds - 1) * 100).toFixed(0)}% — Hãy cố gắng không suy nghĩ quá lâu ở những câu khó!`
                            : `✅ Thời gian phân bổ khá hợp lý giữa câu đúng và câu sai.`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Recent Attempts Mini Table */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <FiActivity size={18} className="text-indigo-500" />
                        Các lần thi gần đây
                      </h2>
                      <Link href="/lich-su" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                        Xem tất cả <FiChevronRight size={12} />
                      </Link>
                    </div>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                            <th className="px-4 py-3 font-medium">Đề thi</th>
                            <th className="px-3 py-3 font-medium">Môn</th>
                            <th className="px-3 py-3 font-medium text-center">Điểm</th>
                            <th className="px-3 py-3 font-medium text-center">%</th>
                            <th className="px-3 py-3 font-medium text-center">Đ/S</th>
                            <th className="px-3 py-3 font-medium text-center">Thời gian</th>
                            <th className="px-3 py-3 font-medium text-center">Kết quả</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {displayStats.recentAttempts.slice(0, 10).map((a) => {
                            const isPass = a.percentage >= 60;
                            return (
                              <tr key={a.id} className="hover:bg-indigo-50/40 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">
                                  {a.examTitle || `Đề #${a.examId}`}
                                </td>
                                <td className="px-3 py-3">
                                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                                    {a.subjectName}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className="font-black text-gray-900">{a.score.toFixed(1)}</span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-bold text-xs ${
                                    a.percentage >= 80 ? 'text-emerald-600' : a.percentage >= 60 ? 'text-amber-600' : 'text-red-500'
                                  }`}>
                                    {a.percentage.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center text-xs">
                                  <span className="text-emerald-600">{a.totalCorrect}✓</span>
                                  {' · '}
                                  <span className="text-red-400">{a.totalIncorrect}✗</span>
                                </td>
                                <td className="px-3 py-3 text-center text-gray-500">
                                  {formatTime(a.durationSeconds)}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {isPass ? 'Đỗ' : 'Chưa'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* ─── ROW 6: Summary Banner ─── */}
                <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <h2 className="font-bold text-lg mb-5 flex items-center gap-2 relative">
                    📋 Tổng kết nhanh toàn bộ quá trình học tập
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative">
                    {[
                      { label: 'Lần thi', value: displayStats.overview.totalAttempts, icon: '📝' },
                      { label: 'Điểm TB', value: `${displayStats.overview.avgScore.toFixed(1)}/10`, icon: '🎯' },
                      { label: 'Câu đúng', value: displayStats.overview.totalCorrect.toLocaleString(), icon: '✅' },
                      { label: 'Tổng thời gian', value: formatDuration(displayStats.overview.totalDurationSeconds), icon: '⏱️' },
                    ].map((item, i) => (
                      <div key={i} className="text-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                        <p className="text-3xl mb-1">{item.icon}</p>
                        <p className="text-2xl font-black">{item.value}</p>
                        <p className="text-blue-200 text-sm">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
        </div>
      </main>
    </div>
  );
}
