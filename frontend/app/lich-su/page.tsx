'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { useAuthStore } from '@/lib/store/authStore';
import examApi, { SUBJECT_SLUG_TO_CODE } from '@/lib/api/exams';
import Link from 'next/link';
import {
  FiCalendar, FiCheckCircle, FiXCircle, FiClock,
  FiTrendingUp, FiAward, FiBarChart2, FiRefreshCw,
  FiArrowRight,
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
  submitted_at?: string | null;
  submit_time?: string | null;
  attempt_number: number;
}

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
  if (!ts) return 'Chưa có thời gian';
  const time = new Date(ts).getTime();
  if (Number.isNaN(time)) return 'Chưa có thời gian';
  const s = Math.max(0, (Date.now() - time) / 1000);
  if (s < 60) return 'Vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
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

export default function LichSuPage() {
  const { isAuthenticated } = useAuthStore();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get('subject');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filtered, setFiltered] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    if (isAuthenticated) loadHistory();
    else setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    setFiltered(history);
    setPage(1);
  }, [history, subjectParam]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      // Convert slug → code if present (e.g. "toan" → "MATH")
      const subjectCode = subjectParam
        ? (SUBJECT_SLUG_TO_CODE[subjectParam] || subjectParam.toUpperCase())
        : undefined;
      const data = await examApi.getHistory(subjectCode, 100);
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const displayFiltered = subjectParam
    ? filtered.filter(h => {
        const mappedCode = SUBJECT_SLUG_TO_CODE[subjectParam] || subjectParam.toUpperCase();
        return h.subject_code === mappedCode;
      })
    : filtered;

  const avgScore = history.length
    ? (history.reduce((s, h) => s + (Number(h.total_score) || 0), 0) / history.length).toFixed(1)
    : '0';
  const bestScore = history.length
    ? Math.max(...history.map(h => h.total_score || 0)).toFixed(1)
    : '0';
  const passCount = history.filter(h => h.total_score >= 5).length;

  const totalPages = Math.ceil(displayFiltered.length / PER_PAGE);
  const paged = displayFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const subjects = ['ALL', ...Array.from(new Set(history.map(h => h.subject_code).filter(Boolean)))];

  if (!isAuthenticated && !loading) {
    const loginPrompt = (
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-100">
          <span className="text-4xl">🔒</span>
        </div>
        <h2 className="mb-3 text-xl font-bold text-gray-900">Đăng nhập để xem lịch sử</h2>
        <p className="mx-auto mb-6 max-w-sm text-gray-500">Theo dõi tiến trình học tập và kết quả tất cả các bài thi đã làm.</p>
        <Link href="/login" className="inline-block rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:opacity-90">
          Đăng nhập ngay
        </Link>
      </div>
    );

    if (subjectParam) {
      return (
        <SubjectStudyShell
          title="Lịch Sử Làm Bài"
          subjectSlug={subjectParam}
          activeSection="lich-su"
          searchPlaceholder="Tìm trong lịch sử làm bài..."
        >
          {loginPrompt}
        </SubjectStudyShell>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
        <Header />
        <main className="w-full mx-auto px-6 py-8 max-w-[1600px]">
          {loginPrompt}
        </main>
      </div>
    );
  }

  const historyContent = (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <span className="text-3xl">📅</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Lịch Sử Làm Bài</h1>
              <p className="mt-1 text-sm text-blue-100">
                Tất cả {history.length} lần thi · {passCount} lần đạt
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Tải lại
            </button>
            <Link
              href={subjectParam ? `/lich-su/thong-ke?subject=${subjectParam}` : '/lich-su/thong-ke'}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/30"
            >
              <FiBarChart2 size={14} />
              Thống kê chi tiết
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FiBarChart2} label="Tổng bài" value={displayFiltered.length} color="bg-indigo-500" />
        <StatCard icon={FiTrendingUp} label="Điểm TB" value={`${displayFiltered.length ? (displayFiltered.reduce((s, h) => s + (Number(h.total_score) || 0), 0) / displayFiltered.length).toFixed(1) : '0'}/10`} color="bg-blue-500" />
        <StatCard icon={FiAward} label="Điểm cao nhất" value={`${displayFiltered.length ? Math.max(...displayFiltered.map(h => h.total_score || 0)).toFixed(1) : '0'}/10`} color="bg-green-500" />
        <StatCard icon={FiCheckCircle} label="Lần đạt (≥5)" value={displayFiltered.filter(h => h.total_score >= 5).length} color="bg-emerald-500" />
      </div>

      {/* Filter tabs */}
      {!subjectParam && (
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => {
            const meta = SUBJECT_META[s];
            const isActive = s === 'ALL' ? !subjectParam : s === subjectParam;
            return (
              <button
                key={s}
                onClick={() => {
                  const url = new URL(window.location.href);
                  if (s === 'ALL') url.searchParams.delete('subject');
                  else url.searchParams.set('subject', s);
                  window.location.href = url.toString();
                }}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${isActive
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                  }`}
              >
                {s === 'ALL' ? '📋 Tất cả' : `${meta?.emoji || ''} ${s}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm text-gray-500">Đang tải lịch sử...</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mb-3 text-5xl">📭</div>
            <h3 className="mb-1 text-lg font-bold text-gray-800">
              {history.length === 0 ? 'Chưa có bài thi nào' : 'Không có kết quả'}
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              {history.length === 0
                ? 'Hãy làm thử đề mô phỏng để xem kết quả tại đây.'
                : 'Thử chọn bộ lọc khác.'}
            </p>
            {history.length === 0 && (
              <Link href="/de-mo-phong" className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white transition-colors hover:bg-indigo-700">
                Làm đề ngay →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <div className="col-span-5">Đề thi</div>
              <div className="col-span-2 text-center">Điểm</div>
              <div className="col-span-2 text-center">Đúng</div>
              <div className="col-span-2 text-center">Thời gian</div>
              <div className="col-span-1 text-center">Kết quả</div>
            </div>

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
                  className="grid cursor-pointer grid-cols-12 items-center gap-2 border-b border-gray-50 px-5 py-4 transition-colors hover:bg-indigo-50/60"
                >
                  <div className="col-span-5 min-w-0">
                    <p className="truncate text-sm font-semibold leading-snug text-gray-900">{item.exam_title || `Đề #${item.exam_id}`}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.color}`}>
                        {meta.emoji} {item.subject_name || item.subject_code}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <FiClock size={10} /> {timeAgo(item.submitted_at || item.submit_time || '')}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className="text-lg font-black text-gray-900">{Number(item.total_score || 0).toFixed(1)}</span>
                    <span className="text-xs text-gray-400">/10</span>
                  </div>

                  <div className="col-span-2 text-center text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{item.total_correct || 0}</span>
                    <span className="text-gray-400">/{item.total_questions || '?'}</span>
                    <div className="mt-1 h-1 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-1 rounded-full ${pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="col-span-2 text-center text-sm text-gray-500">
                    {formatTime(item.time_spent)}
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-4">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length} bài
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${p === page
                            ? 'border-indigo-600 bg-indigo-600 text-white'
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
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
  );

  if (subjectParam) {
    return (
      <SubjectStudyShell
        title="Lịch Sử Làm Bài"
        subjectSlug={subjectParam}
        activeSection="lich-su"
        searchPlaceholder="Tìm trong lịch sử làm bài..."
      >
        {historyContent}
      </SubjectStudyShell>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-blue-50">
      <Header />

      <main className="w-full mx-auto px-6 py-8 max-w-[1600px]">
        {historyContent}
      </main>
    </div>
  );
}
