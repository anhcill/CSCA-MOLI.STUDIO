'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import { useAuthStore } from '@/lib/store/authStore';
import examApi from '@/lib/api/exams';
import Link from 'next/link';
import {
  FiCalendar, FiCheckCircle, FiXCircle, FiClock,
  FiTrendingUp, FiAward, FiBarChart2, FiRefreshCw,
} from 'react-icons/fi';

interface HistoryItem {
  id: number;
  exam_id: number;
  exam_title: string;
  subject_name: string;
  subject_code: string;
  total_score: number;
  total_correct: number;
  total_questions: number;
  time_spent: number;
  status: string;
  submitted_at: string;
  attempt_number: number;
}

// Màu theo môn học
const SUBJECT_META: Record<string, { color: string; bg: string; emoji: string }> = {
  MATH: { color: 'text-purple-700', bg: 'bg-purple-100', emoji: '📐' },
  PHYSICS: { color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '⚡' },
  CHEMISTRY: { color: 'text-green-700', bg: 'bg-green-100', emoji: '🧪' },
  CHINESE: { color: 'text-red-700', bg: 'bg-red-100', emoji: '🈶' },
};

function scoreBadge(score: number): { label: string; cls: string } {
  if (score >= 8) return { label: 'Xuất sắc', cls: 'bg-emerald-100 text-emerald-700' };
  if (score >= 6.5) return { label: 'Khá', cls: 'bg-blue-100 text-blue-700' };
  if (score >= 5) return { label: 'Trung bình', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Yếu', cls: 'bg-red-100 text-red-700' };
}

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} ngày trước`;
  if (d < 365) return `${Math.floor(d / 30)} tháng trước`;
  return `${Math.floor(d / 365)} năm trước`;
}

function formatTime(seconds: number) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="text-white" size={18} />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LichSuPage() {
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filtered, setFiltered] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    if (isAuthenticated) loadHistory();
    else setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    const f = subjectFilter === 'ALL'
      ? history
      : history.filter(h => h.subject_code === subjectFilter);
    setFiltered(f);
    setPage(1);
  }, [subjectFilter, history]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await examApi.getHistory(undefined, 100);
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ──
  const avgScore = history.length
    ? (history.reduce((s, h) => s + (Number(h.total_score) || 0), 0) / history.length).toFixed(1)
    : '0';
  const bestScore = history.length
    ? Math.max(...history.map(h => h.total_score || 0)).toFixed(1)
    : '0';
  const passCount = history.filter(h => h.total_score >= 5).length;

  // ── Pagination ──
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Unique subjects ──
  const subjects = ['ALL', ...Array.from(new Set(history.map(h => h.subject_code).filter(Boolean)))];

  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
        <Header />
        <main className="container mx-auto px-6 py-8 max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3"><LeftSidebar /></div>
            <div className="lg:col-span-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🔒</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Đăng nhập để xem lịch sử</h2>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">Theo dõi tiến trình học tập và kết quả tất cả các bài thi đã làm.</p>
                <Link href="/login" className="inline-block px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg">
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
            <div className="lg:col-span-3"><RightSidebar /></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
      <Header />

      <main className="container mx-auto px-6 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-6 space-y-6">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                    <span className="text-3xl">📅</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight">Lịch Sử Làm Bài</h1>
                    <p className="text-blue-100 text-sm mt-1">
                      Tất cả {history.length} lần thi · {passCount} lần đạt
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  Tải lại
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={FiBarChart2} label="Tổng bài" value={history.length} color="bg-indigo-500" />
              <StatCard icon={FiTrendingUp} label="Điểm TB" value={`${avgScore}/10`} color="bg-blue-500" />
              <StatCard icon={FiAward} label="Điểm cao nhất" value={`${bestScore}/10`} color="bg-green-500" />
              <StatCard icon={FiCheckCircle} label="Lần đạt (≥5)" value={passCount} color="bg-emerald-500" />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
              {subjects.map(s => {
                const meta = SUBJECT_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSubjectFilter(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${subjectFilter === s
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}
                  >
                    {s === 'ALL' ? '📋 Tất cả' : `${meta?.emoji || ''} ${s}`}
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-10 text-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Đang tải lịch sử...</p>
                </div>
              ) : paged.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-5xl mb-3">📭</div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">
                    {history.length === 0 ? 'Chưa có bài thi nào' : 'Không có kết quả'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-5">
                    {history.length === 0
                      ? 'Hãy làm thử đề mô phỏng để xem kết quả tại đây.'
                      : 'Thử chọn bộ lọc khác.'}
                  </p>
                  {history.length === 0 && (
                    <Link href="/de-mo-phong" className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                      Làm đề ngay →
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div className="col-span-5">Đề thi</div>
                    <div className="col-span-2 text-center">Điểm</div>
                    <div className="col-span-2 text-center">Đúng</div>
                    <div className="col-span-2 text-center">Thời gian</div>
                    <div className="col-span-1 text-center">Kết quả</div>
                  </div>

                  {/* Rows */}
                  {paged.map((item) => {
                    const meta = SUBJECT_META[item.subject_code] || { color: 'text-gray-700', bg: 'bg-gray-100', emoji: '📝' };
                    const badge = scoreBadge(item.total_score || 0);
                    const pct = item.total_questions
                      ? Math.round(((item.total_correct || 0) / item.total_questions) * 100)
                      : 0;

                    return (
                      <Link
                        key={item.id}
                        href={`/exam/result/${item.id}`}
                        className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-gray-50 hover:bg-indigo-50/60 transition-colors items-center cursor-pointer"
                      >
                        {/* Exam title */}
                        <div className="col-span-5 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{item.exam_title || `Đề #${item.exam_id}`}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                              {meta.emoji} {item.subject_name || item.subject_code}
                            </span>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <FiClock size={10} /> {timeAgo(item.submitted_at)}
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-span-2 text-center">
                          <span className="text-lg font-black text-gray-900">{(item.total_score || 0).toFixed(1)}</span>
                          <span className="text-xs text-gray-400">/10</span>
                        </div>

                        {/* Correct */}
                        <div className="col-span-2 text-center text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">{item.total_correct || 0}</span>
                          <span className="text-gray-400">/{item.total_questions || '?'}</span>
                          <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                            <div
                              className={`h-1 rounded-full ${pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Time */}
                        <div className="col-span-2 text-center text-sm text-gray-500">
                          {formatTime(item.time_spent)}
                        </div>

                        {/* Badge */}
                        <div className="col-span-1 flex justify-center">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length} bài
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ←
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const p = page <= 3 ? i + 1 : page + i - 2;
                          if (p < 1 || p > totalPages) return null;
                          return (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${p === page
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'border-gray-200 hover:bg-white'
                                }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3">
            <RightSidebar />
          </div>
        </div>
      </main>
    </div>
  );
}
