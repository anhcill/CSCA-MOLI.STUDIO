'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX, FiCalendar, FiClock, FiUsers, FiPlayCircle, FiBarChart2, FiLock, FiChevronDown, FiChevronUp, FiBookmark, FiCheckCircle, FiRotateCw } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import examApi, { Exam } from '@/lib/api/exams';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import { ProUpgradeModal } from '@/components/common/ProModal';

interface ExamListProps {
  subjectCode?: string;
  subjectSlug?: string;
}

type FilterType = 'all' | 'done' | 'not-done' | 'pro';
type SortType = 'newest' | 'oldest' | 'name';

export default function ExamList({ subjectCode = '', subjectSlug }: ExamListProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [vipModalExam, setVipModalExam] = useState<{ title: string; id: number } | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('newest');
  const [showDone, setShowDone] = useState(false);
  const isVip = isVipActive(user);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExams();
  }, [subjectCode, subjectSlug]);

  // Keyboard shortcut: focus search on /
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await examApi.getExamsBySubject(subjectCode, subjectSlug);
      setExams(data);
    } catch (error: any) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam: Exam) => {
    if (exam.is_premium && !isVip) {
      setVipModalExam({ title: exam.title, id: exam.id });
      return;
    }
    router.push(`/exam/${exam.id}`);
  };

  const handleMakeExam = (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    if (exam.is_premium && !isVip) {
      setVipModalExam({ title: exam.title, id: exam.id });
      return;
    }
    router.push(`/exam/${exam.id}`);
  };

  // Filter + search + sort
  const filteredExams = useMemo(() => {
    let result = [...exams];

    // Filter
    if (filter === 'done') {
      result = result.filter(e => (e.user_attempt_count || 0) > 0);
    } else if (filter === 'not-done') {
      result = result.filter(e => (e.user_attempt_count || 0) === 0);
    } else if (filter === 'pro') {
      result = result.filter(e => e.is_premium);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sort === 'newest') {
        return new Date(b.publish_date || 0).getTime() - new Date(a.publish_date || 0).getTime();
      } else if (sort === 'oldest') {
        return new Date(a.publish_date || 0).getTime() - new Date(b.publish_date || 0).getTime();
      } else {
        return (a.title || '').localeCompare(b.title || '');
      }
    });

    return result;
  }, [exams, filter, search, sort]);

  // Exclude done exams when showDone is active (for display + count)
  const visibleExams = useMemo(() => {
    if (!showDone) return filteredExams;
    return filteredExams.filter(e => (e.user_attempt_count || 0) === 0);
  }, [filteredExams, showDone]);

  // Group by year
  const groupedByYear = useMemo(() => {
    const map = new Map<number, Exam[]>();
    visibleExams.forEach(exam => {
      const year = exam.publish_date ? new Date(exam.publish_date).getFullYear() : 0;
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(exam);
    });
    return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
  }, [visibleExams]);

  // Stats
  const stats = useMemo(() => ({
    total: exams.length,
    done: exams.filter(e => (e.user_attempt_count || 0) > 0).length,
    notDone: exams.filter(e => (e.user_attempt_count || 0) === 0).length,
    pro: exams.filter(e => e.is_premium).length,
  }), [exams]);

  const years = [...groupedByYear.keys()].filter(y => y > 0);

  // Scroll to year section
  const scrollToYear = (year: number) => {
    const el = document.getElementById(`year-${year}`);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Difficulty badge
  const DiffBadge = ({ level }: { level?: string }) => {
    if (!level) return null;
    const map: Record<string, { label: string; cls: string; dot: string }> = {
      easy: { label: 'Dễ', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
      medium: { label: 'TB', cls: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
      hard: { label: 'Khó', cls: 'text-rose-600 bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
    };
    const d = map[level] || map.medium;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${d.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
        {d.label}
      </span>
    );
  };

  // Pass rate badge
  const PassRateBadge = ({ rate }: { rate?: number }) => {
    if (rate === undefined || rate === null) return null;
    const color = rate >= 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : rate >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-rose-600 bg-rose-50 border-rose-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${color}`}>
        📊 {Math.round(rate)}% đỗ
      </span>
    );
  };

  // Score comparison badge (previous vs best)
  const ScoreCompare = ({ best, last }: { best?: number; last?: number }) => {
    if (!best || !last || best === last) return null;
    const diff = best - last;
    const improved = diff > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
        improved ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
      }`}>
        {improved ? '↑' : '↓'} {Math.abs(diff)}đ
      </span>
    );
  };

  // Exam card
  const ExamCard = ({ exam }: { exam: Exam }) => {
    const done = (exam.user_attempt_count || 0) > 0;
    const isLocked = exam.is_premium && !isVip;
    const accentColor = isLocked ? 'from-amber-500 to-orange-500' : done ? 'from-gray-400 to-gray-500' : 'from-indigo-500 to-purple-600';
    const textColor = isLocked ? 'text-amber-800' : done ? 'text-gray-700' : 'text-gray-900';
    const hoverBorder = isLocked ? 'hover:border-amber-300 hover:shadow-amber-200' : done ? 'hover:border-gray-300 hover:shadow-gray-200' : 'hover:border-indigo-300 hover:shadow-indigo-200';

    return (
      <div
        className={`relative group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 cursor-pointer hover:shadow-lg ${hoverBorder} transition-all duration-200 overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-4 ${isLocked ? 'opacity-90' : ''}`}
        onClick={() => handleExamClick(exam)}
      >
        {/* Left accent bar */}
        <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-gradient-to-b ${accentColor} opacity-0 group-hover:opacity-100 transition-opacity`} />

        {/* Status dot */}
        <div className="shrink-0 hidden sm:flex flex-col items-center gap-1 w-8">
          {done ? (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <FiCheckCircle className="text-emerald-600" size={18} />
            </div>
          ) : isLocked ? (
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <FiLock className="text-amber-600" size={16} />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <FiPlayCircle className="text-indigo-600" size={16} />
            </div>
          )}
          <div className={`w-px flex-1 min-h-[12px] ${done ? 'bg-emerald-200' : isLocked ? 'bg-amber-200' : 'bg-indigo-200'}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <h3 className={`font-bold text-sm sm:text-base group-hover:transition-colors truncate ${textColor} ${!isLocked && !done ? 'group-hover:text-indigo-700' : ''}`}>
              {exam.title}
            </h3>
            {exam.is_premium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-200 to-orange-300 text-orange-900 text-xs font-bold rounded-md shadow-sm shrink-0">
                <FaCrown size={10} /> PRO
              </span>
            )}
            {exam.shuffle_mode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-md border border-blue-200 shrink-0">
                🔀 Xáo trộn
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <FiClock size={12} />
              <span>{exam.duration} phút</span>
            </span>
            <span className="flex items-center gap-1">
              <FiUsers size={12} />
              <span>{exam.total_questions} câu</span>
            </span>
            <DiffBadge level={exam.overall_difficulty || exam.difficulty_level} />
            <PassRateBadge rate={exam.pass_rate} />
            {exam.publish_date && (
              <span className="flex items-center gap-1 text-gray-400">
                <FiCalendar size={12} />
                <span>{new Date(exam.publish_date).toLocaleDateString('vi-VN')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: results + action */}
        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
          {done && (
            <div className="hidden md:flex flex-col items-end gap-1 mr-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium">
                  {exam.user_attempt_count} lần
                </span>
                <span className={`px-2 py-0.5 rounded-md font-bold ${(exam.user_best_score || 0) >= 8 ? 'bg-emerald-100 text-emerald-700' : (exam.user_best_score || 0) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {exam.user_best_score || 0} đ
                </span>
                <ScoreCompare best={exam.user_best_score} last={exam.user_last_score} />
              </div>
            </div>
          )}

          <button
            onClick={(e) => handleMakeExam(exam, e)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl transition-all shrink-0 ${
              isLocked
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                : done
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            {isLocked ? (
              <><FiLock size={15} /> Khóa</>
            ) : done ? (
              <><FiRotateCw size={15} /> Làm lại</>
            ) : (
              <><FiPlayCircle size={15} /> Làm bài</>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ─── LOADING ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-9 bg-gray-200 rounded-xl w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── EMPTY ─────────────────────────────────────────────────────────
  if (filteredExams.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-300">
          <FiSearch size={36} />
        </div>
        <p className="text-gray-500 font-semibold text-lg">
          {search ? `Không tìm thấy đề "${search}"` : 'Không có đề thi phù hợp'}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {search ? 'Thử từ khóa khác' : 'Đội ngũ đang cập nhật thêm đề thi'}
        </p>
        {search && (
          <button onClick={() => setSearch('')} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
            Xóa tìm kiếm
          </button>
        )}
      </div>
    );
  }

  // ─── MAIN ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Search Bar ─────────────────────────────────────────────── */}
      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={searchRef}
          type="text"
          placeholder='Tìm nhanh đề thi... (nhấn / để focus)'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* ── Controls Row ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {([
            { value: 'all', label: 'Tất cả', emoji: '📋', count: stats.total },
            { value: 'done', label: 'Đã làm', emoji: '✓', count: stats.done },
            { value: 'not-done', label: 'Chưa làm', emoji: '○', count: stats.notDone },
            { value: 'pro', label: 'PRO', emoji: '👑', count: stats.pro },
          ] as { value: FilterType; label: string; emoji: string; count: number }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
              <span className={`text-xs ${filter === f.value ? 'opacity-80' : 'opacity-60'}`}>({f.count})</span>
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-400 font-medium">Sắp xếp:</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortType)}
            className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="name">Theo tên</option>
          </select>
        </div>

        {/* Show done toggle */}
        <button
          onClick={() => setShowDone(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showDone
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          <FiBookmark size={13} />
          {showDone ? 'Đang ẩn đã làm' : 'Ẩn đã làm'}
        </button>
      </div>

      {/* ── Result count ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>Tìm thấy <strong className="text-gray-600">{visibleExams.length}</strong> đề thi</span>
        {search && <span>cho "<strong className="text-gray-600">{search}</strong>"</span>}
        {groupedByYear.size > 1 && (
          <span>trong <strong className="text-gray-600">{groupedByYear.size}</strong> năm</span>
        )}
        {showDone && <span className="text-emerald-500">(đã ẩn đề đã làm)</span>}
      </div>

      {/* ── Year Jump Nav (sticky) ────────────────────────────────── */}
      {years.length > 1 && (
        <div className="sticky top-20 z-30 bg-indigo-50/90 backdrop-blur-sm border border-indigo-100 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
          <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider shrink-0">Nhảy nhanh:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {years.map(year => (
              <button
                key={year}
                onClick={() => scrollToYear(year)}
                className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Exam Groups by Year ───────────────────────────────────── */}
      <div className="space-y-8">
        {[...groupedByYear.entries()].map(([year, yearExams]) => (
          <div key={year} id={`year-${year}`}>
            {/* Year header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-2xl font-black text-indigo-600">{year === 0 ? '?' : year}</span>
                {year !== 0 && (
                  <span className="text-xs text-indigo-400 font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {yearExams.length} đề
                  </span>
                )}
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
            </div>

            {/* Exam cards */}
            <div className="space-y-2">
              {yearExams.map(exam => {
                return <ExamCard key={exam.id} exam={exam} />;
              })}
            </div>
          </div>
        ))}
      </div>

      {vipModalExam && (
        <ProUpgradeModal
          isOpen={true}
          onClose={() => setVipModalExam(null)}
          title={`Đề "${vipModalExam.title}" chỉ dành cho VIP`}
        />
      )}
    </div>
  );
}
