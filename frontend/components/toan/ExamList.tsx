'use client';

import { useState, useEffect, useMemo, useRef, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX, FiCalendar, FiClock, FiUsers, FiPlayCircle, FiLock, FiBookmark, FiCheckCircle, FiRotateCw, FiBarChart2, FiTarget, FiTrendingUp, FiEdit3 } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import examApi, { Exam, SUBJECT_SLUG_TO_CODE } from '@/lib/api/exams';
import { getHistoryStats, type HistoryStatsData } from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';
import { canAccessContent, type TierLevel } from '@/lib/utils/permissions';
import { ProUpgradeModal } from '@/components/common/ProModal';
import { useLanguage } from '@/context/LanguageContext';

interface ExamListProps {
  subjectCode?: string;
  subjectSlug?: string;
}

type FilterType = 'all' | 'done' | 'not-done';
type SortType = 'newest' | 'oldest' | 'name';
type ExamTypeTab = 'regular' | 'vip';

const isVipExam = (exam: Exam) =>
  exam.is_premium === true || (!!exam.vip_tier && exam.vip_tier !== 'basic');

const getExamTier = (exam: Exam): TierLevel => {
  if (exam.vip_tier === 'premium' || exam.vip_tier === 'pre') return 'premium';
  if (exam.vip_tier === 'vip' || exam.is_premium === true) return 'vip';
  return 'basic';
};

const getAttemptCount = (exam: Exam) => {
  const count = Number(exam.user_attempt_count ?? 0);
  return Number.isFinite(count) ? count : 0;
};

const isExamDone = (exam: Exam) => getAttemptCount(exam) > 0;

const groupExamsByYear = (items: Exam[]) => {
  const map = new Map<number, Exam[]>();
  items.forEach(exam => {
    const year = exam.publish_date ? new Date(exam.publish_date).getFullYear() : 0;
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(exam);
  });
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
};

export default function ExamList({ subjectCode = '', subjectSlug }: ExamListProps) {
  const router = useRouter();
  const { t, format, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyStats, setHistoryStats] = useState<HistoryStatsData | null>(null);
  const [vipModalExam, setVipModalExam] = useState<{ title: string; id: number } | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [examTypeTab, setExamTypeTab] = useState<ExamTypeTab>('regular');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('newest');
  const [showDone, setShowDone] = useState(false);
  const canAccessExam = (exam: Exam) => canAccessContent(user, getExamTier(exam), exam.subject_code);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExams();
  }, [subjectCode, subjectSlug]);

  useEffect(() => {
    if (!user) {
      setHistoryStats(null);
      return;
    }

    let cancelled = false;
    const historySubjectCode = subjectSlug
      ? (SUBJECT_SLUG_TO_CODE[subjectSlug] || subjectCode)
      : subjectCode;

    getHistoryStats(historySubjectCode || undefined)
      .then((data) => {
        if (!cancelled) setHistoryStats(data);
      })
      .catch((error) => {
        console.error('[ExamList] Error loading history stats:', error?.response?.data || error?.message || error);
        if (!cancelled) setHistoryStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user, subjectCode, subjectSlug]);

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
      const response = await examApi.getExamsBySubject(subjectCode, subjectSlug);
      // Validate: ensure data is an array
      if (!Array.isArray(response)) {
        console.error('[ExamList] API returned non-array data:', response);
        setExams([]);
        return;
      }
      setExams(response);
    } catch (error: any) {
      console.error('[ExamList] Error loading exams:', error?.response?.data || error?.message || error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam: Exam) => {
    if (isVipExam(exam) && !canAccessExam(exam)) {
      setVipModalExam({ title: exam.title, id: exam.id });
      return;
    }
    router.push(`/exam/${exam.id}`);
  };

  const handleMakeExam = (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVipExam(exam) && !canAccessExam(exam)) {
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
      result = result.filter(isExamDone);
    } else if (filter === 'not-done') {
      result = result.filter(e => !isExamDone(e));
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
    return filteredExams.filter(e => !isExamDone(e));
  }, [filteredExams, showDone]);

  const regularExams = useMemo(
    () => visibleExams.filter(exam => !isVipExam(exam)),
    [visibleExams]
  );

  const vipExams = useMemo(
    () => visibleExams.filter(exam => isVipExam(exam)),
    [visibleExams]
  );

  const regularByYear = useMemo(() => groupExamsByYear(regularExams), [regularExams]);
  const vipByYear = useMemo(() => groupExamsByYear(vipExams), [vipExams]);
  const activeExamList = examTypeTab === 'regular' ? regularExams : vipExams;
  const activeExamByYear = examTypeTab === 'regular' ? regularByYear : vipByYear;
  const activeExamMeta = examTypeTab === 'regular'
    ? {
        title: t('examList.regularTitle'),
        description: t('examList.regularDesc'),
        variant: 'regular' as const,
      }
    : {
        title: t('examList.vipTitle'),
        description: t('examList.vipDesc'),
        variant: 'vip' as const,
      };

  // Stats
  const stats = useMemo(() => ({
    total: exams.length,
    done: exams.filter(isExamDone).length,
    notDone: exams.filter(e => !isExamDone(e)).length,
    regular: exams.filter(e => !isVipExam(e)).length,
    vip: exams.filter(e => isVipExam(e)).length,
  }), [exams]);

  const progressStats = useMemo(() => {
    const doneExams = exams.filter(isExamDone);
    const completedQuestions = historyStats
      ? historyStats.overview.totalCorrect + historyStats.overview.totalIncorrect + historyStats.overview.totalUnanswered
      : doneExams.reduce((sum, exam) => sum + (Number(exam.total_questions || 0) * Math.max(1, getAttemptCount(exam))), 0);
    const completedExams = historyStats?.overview.uniqueExams ?? doneExams.length;
    const avgScore = historyStats
      ? Math.round(Number(historyStats.overview.avgScore || 0) * 10) / 10
      : 0;
    const passRate = historyStats
      ? Math.round(Number(historyStats.passFail.passRate || 0))
      : 0;
    const completion = exams.length ? Math.min(100, Math.round((completedExams / exams.length) * 100)) : 0;

    return {
      completion,
      done: completedExams,
      totalQuestions: completedQuestions,
      avgScore,
      passRate,
    };
  }, [exams, historyStats]);

  const recommendation = useMemo(() => {
    if (exams.length === 0) {
      return {
        exam: null as Exam | null,
        title: t('examList.noExamsTitle'),
        text: t('examList.noExamsText'),
        action: t('examList.viewLater'),
        disabled: true,
      };
    }

    const accessibleExams = exams.filter(exam => !isVipExam(exam) || canAccessExam(exam));
    const inProgressExam = accessibleExams.find(exam => exam.in_progress_attempt);
    if (inProgressExam) {
      return {
        exam: inProgressExam,
        title: t('examList.continueTitle'),
        text: inProgressExam.title,
        action: t('examList.continueAction'),
        disabled: false,
      };
    }

    const nextExam = accessibleExams.find(exam => !isExamDone(exam));
    if (nextExam) {
      return {
        exam: nextExam,
        title: t('examList.recommendTitle'),
        text: format('examList.recommendText', { title: nextExam.title }),
        action: t('examList.practiceNow'),
        disabled: false,
      };
    }

    const retryExam = accessibleExams
      .filter(isExamDone)
      .sort((a, b) => Number(a.user_best_score || 0) - Number(b.user_best_score || 0))[0];
    if (retryExam) {
      return {
        exam: retryExam,
        title: t('examList.retryWeakTitle'),
        text: format('examList.retryWeakText', { title: retryExam.title }),
        action: t('examList.retry'),
        disabled: false,
      };
    }

    const lockedVipExam = exams.find(exam => isVipExam(exam) && !canAccessExam(exam));
    if (lockedVipExam) {
      return {
        exam: lockedVipExam,
        title: t('examList.unlockTitle'),
        text: t('examList.unlockText'),
        action: t('examList.viewVip'),
        disabled: false,
      };
    }

    return {
      exam: null as Exam | null,
      title: t('examList.completedTitle'),
      text: t('examList.completedText'),
      action: t('exam.completed'),
      disabled: true,
    };
  }, [exams, user, t, format]);

  // Difficulty badge
  const DiffBadge = ({ level }: { level?: string }) => {
    if (!level) return null;
    const map: Record<string, { label: string; cls: string; dot: string }> = {
      easy: { label: t('examList.easy'), cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
      medium: { label: t('examList.medium'), cls: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
      hard: { label: t('examList.hard'), cls: 'text-rose-600 bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
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
        📊 {format('examList.passed', { rate: Math.round(rate) })}
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
        {improved ? '↑' : '↓'} {format('examList.scorePoint', { score: Math.abs(diff) })}
      </span>
    );
  };

  // Exam card
  const ExamCard = ({ exam }: { exam: Exam }) => {
    const attemptCount = getAttemptCount(exam);
    const done = attemptCount > 0;
    const vipOnly = isVipExam(exam);
    const isLocked = vipOnly && !canAccessExam(exam);
    const accentColor = isLocked ? 'from-amber-500 to-orange-500' : done ? 'from-rose-300 to-red-300' : 'from-red-500 to-rose-600';
    const textColor = isLocked ? 'text-amber-800' : done ? 'text-slate-700' : 'text-slate-950';
    const hoverBorder = isLocked ? 'hover:border-amber-300 hover:shadow-amber-100' : 'hover:border-red-200 hover:shadow-red-100';

    return (
      <div
        className={`relative group flex cursor-pointer flex-col items-start gap-4 overflow-hidden rounded-2xl border border-rose-100/80 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-all duration-200 hover:shadow-lg sm:flex-row sm:items-center sm:p-5 ${hoverBorder} ${isLocked ? 'opacity-90' : ''}`}
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
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <FiPlayCircle className="text-red-600" size={16} />
            </div>
          )}
          <div className={`w-px flex-1 min-h-[12px] ${done ? 'bg-emerald-200' : isLocked ? 'bg-amber-200' : 'bg-red-200'}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <h3 className={`font-bold text-sm sm:text-base group-hover:transition-colors truncate ${textColor} ${!isLocked ? 'group-hover:text-red-700' : ''}`}>
              {exam.title}
            </h3>
            {vipOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-200 to-orange-300 text-orange-900 text-xs font-bold rounded-md shadow-sm shrink-0">
                <FaCrown size={10} /> VIP
              </span>
            )}
            {exam.shuffle_mode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-md border border-blue-200 shrink-0">
                🔀 {t('examList.shuffle')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <FiClock size={12} />
              <span>{format('examList.minutes', { count: exam.duration })}</span>
            </span>
            <span className="flex items-center gap-1">
              <FiUsers size={12} />
              <span>{format('examList.questions', { count: exam.total_questions })}</span>
            </span>
            <DiffBadge level={exam.overall_difficulty || exam.difficulty_level} />
            <PassRateBadge rate={exam.pass_rate} />
            {exam.publish_date && (
              <span className="flex items-center gap-1 text-gray-400">
                <FiCalendar size={12} />
                <span>{new Date(exam.publish_date).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN')}</span>
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
                  {format('examList.attempts', { count: attemptCount })}
                </span>
                <span className={`px-2 py-0.5 rounded-md font-bold ${(exam.user_best_score || 0) >= 8 ? 'bg-emerald-100 text-emerald-700' : (exam.user_best_score || 0) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {format('examList.scorePoint', { score: exam.user_best_score || 0 })}
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
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-100'
                : 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            {isLocked ? (
              <><FiLock size={15} /> {t('examList.locked')}</>
            ) : done ? (
              <><FiRotateCw size={15} /> {t('examList.retry')}</>
            ) : (
              <><FiPlayCircle size={15} /> {t('examList.startExam')}</>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ─── LOADING ───────────────────────────────────────────────────────
  const ExamSection = ({
    title,
    description,
    count,
    grouped,
    variant,
  }: {
    title: string;
    description: string;
    count: number;
    grouped: Map<number, Exam[]>;
    variant: 'regular' | 'vip';
  }) => {
    const isVipSection = variant === 'vip';

    return (
      <section className={`rounded-2xl border bg-white/75 shadow-[0_8px_28px_rgba(127,29,29,0.06)] backdrop-blur-xl overflow-hidden flex flex-col min-h-[220px] max-h-[72vh] ${
        isVipSection ? 'border-amber-100/90' : 'border-rose-100/90'
      }`}>
        <div className={`px-4 sm:px-5 py-4 border-b shrink-0 ${
          isVipSection ? 'bg-amber-50/70 border-amber-100' : 'bg-white/60 border-rose-100'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isVipSection ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-600'
              }`}>
                {isVipSection ? <FaCrown size={16} /> : <FiPlayCircle size={17} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-gray-900 truncate">{title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">{description}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
              isVipSection ? 'bg-white text-amber-700 border border-amber-200' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {format('examList.examCount', { count })}
            </span>
          </div>
        </div>

        {count === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-400">
            {t('examList.noGroup')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-6">
            {[...grouped.entries()].map(([year, yearExams]) => (
              <div key={`${variant}-${year}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-lg font-black ${isVipSection ? 'text-amber-700' : 'text-red-600'}`}>
                    {year === 0 ? '?' : year}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    isVipSection ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-red-600 bg-red-50 border-red-100'
                  }`}>
                    {yearExams.length} đề
                  </span>
                  <div className={`flex-1 h-px ${isVipSection ? 'bg-amber-100' : 'bg-rose-100'}`} />
                </div>
                <div className="space-y-2">
                  {yearExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/75 rounded-2xl border border-rose-100/80 p-5 animate-pulse backdrop-blur-xl">
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
  const hasSearch = search.trim().length > 0;
  const noResults = filteredExams.length === 0 && !loading;

  if (noResults) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-rose-100/80 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-300">
          <FiSearch size={36} />
        </div>
        <p className="text-gray-500 font-semibold text-lg">
          {hasSearch ? format('examList.noSearch', { search }) : t('examList.noMatch')}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {hasSearch ? t('examList.tryAnother') : t('examList.updating')}
        </p>
        {hasSearch && (
          <button onClick={() => setSearch('')} className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors">
            {t('examList.clearSearch')}
          </button>
        )}
        {!hasSearch && exams.length === 0 && !loading && (
          <p className="text-xs text-gray-400 mt-3">
            {format('examList.subjectCode', { code: subjectCode || subjectSlug || '?' })}
          </p>
        )}
      </div>
    );
  }

  // ─── MAIN ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Controls Row (full-width top) ────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Filter pills */}
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-rose-100 bg-white/75 p-1 shadow-sm backdrop-blur-xl">
          {([
            { value: 'all', label: t('history.all'), emoji: '📋', count: stats.total },
            { value: 'done', label: t('examList.done'), emoji: '✓', count: stats.done },
            { value: 'not-done', label: t('examList.notDone'), emoji: '○', count: stats.notDone },
          ] as { value: FilterType; label: string; emoji: string; count: number }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.value
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
              <span className={`text-xs ${filter === f.value ? 'opacity-80' : 'opacity-60'}`}>({f.count})</span>
            </button>
          ))}
        </div>

        {/* Exam type tabs */}
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-rose-100 bg-white/75 p-1 shadow-sm backdrop-blur-xl">
          {([
            { value: 'regular', label: t('examList.regularTitle'), icon: FiPlayCircle, count: regularExams.length },
            { value: 'vip', label: t('examList.vipTitle'), icon: FaCrown, count: vipExams.length },
          ] as { value: ExamTypeTab; label: string; icon: ElementType; count: number }[]).map(tab => {
            const Icon = tab.icon;
            const active = examTypeTab === tab.value;
            const isVipTab = tab.value === 'vip';

            return (
              <button
                key={tab.value}
                onClick={() => setExamTypeTab(tab.value)}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? isVipTab
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-red-600 text-white shadow-sm'
                    : isVipTab
                    ? 'text-amber-700 hover:bg-amber-50'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className={`text-xs ${active ? 'opacity-85' : 'opacity-60'}`}>({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <span className="text-xs text-gray-400 font-medium">{t('examList.sort')}</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortType)}
            className="text-xs font-semibold border border-rose-100 rounded-lg px-2.5 py-1.5 bg-white/80 text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-300 cursor-pointer"
          >
            <option value="newest">{t('examList.newest')}</option>
            <option value="oldest">{t('examList.oldest')}</option>
            <option value="name">{t('examList.byName')}</option>
          </select>
        </div>

        {/* Show done toggle */}
        <button
          onClick={() => setShowDone(v => !v)}
          className={`flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showDone
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white/80 text-gray-500 border-rose-100 hover:border-red-200 hover:text-red-600'
          }`}
        >
          <FiBookmark size={13} />
          {showDone ? t('examList.hidingDone') : t('examList.hideDone')}
        </button>
      </div>

      {/* ── Result count (full-width) ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>{format('examList.foundCount', { count: visibleExams.length })}</span>
        {search && <span>{format('examList.searchFor', { search })}</span>}
        <span className="text-gray-300">|</span>
        <span>{format('examList.regularCount', { count: regularExams.length })}</span>
        <span>{format('examList.vipCount', { count: vipExams.length })}</span>
        <span className="text-gray-300">|</span>
        <span>{format('examList.viewing', { type: activeExamMeta.title.toLowerCase() })}</span>
        {showDone && <span className="text-emerald-500">{t('examList.doneHidden')}</span>}
      </div>

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 items-start">

        {/* ── Left column: Stats + Recommendation ──────────────── */}
        <div className="flex flex-col gap-5">
          {/* Stats overview card */}
          <div className="rounded-2xl border border-rose-100/80 bg-white/75 p-5 shadow-[0_8px_28px_rgba(127,29,29,0.06)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <FiBarChart2 />
              </div>
              <h3 className="text-base font-black text-slate-900">{t('examList.progressOverview')}</h3>
            </div>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#dc2626_var(--progress),#fee2e2_0)] dark:bg-[conic-gradient(#ef4444_var(--progress),#334155_0)]" style={{ ['--progress' as string]: `${progressStats.completion}%` }}>
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner dark:bg-slate-900">
                  <span className="text-3xl font-black text-slate-900">{progressStats.completion}%</span>
                  <span className="text-xs font-bold text-slate-400">{t('examList.setProgress')}</span>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3"><FiEdit3 className="text-red-500" /><div><div className="font-black text-slate-900">{progressStats.done}</div><div className="text-xs font-medium text-slate-500">{t('examList.done')}</div></div></div>
                <div className="flex items-center gap-3"><FiCheckCircle className="text-red-500" /><div><div className="font-black text-slate-900">{progressStats.totalQuestions}</div><div className="text-xs font-medium text-slate-500">{t('examList.questionsPracticed')}</div></div></div>
                <div className="flex items-center gap-3"><FiClock className="text-red-500" /><div><div className="font-black text-slate-900">{progressStats.avgScore}</div><div className="text-xs font-medium text-slate-500">{t('history.avgScore')}</div></div></div>
                <div className="flex items-center gap-3"><FiTrendingUp className="text-emerald-500" /><div><div className="font-black text-slate-900">{progressStats.passRate}%</div><div className="text-xs font-medium text-slate-500">{t('examList.passRate')}</div></div></div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="mt-5 rounded-2xl border border-red-100/80 bg-gradient-to-r from-red-50/90 to-rose-50/80 p-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/90">
              <div className="flex items-center gap-3">
                <FiTarget className="text-3xl text-red-600" />
                <div>
                  <div className="text-sm font-black text-slate-900">{recommendation.title}</div>
                  <p className="text-xs font-medium text-slate-500">{recommendation.text}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={recommendation.disabled || !recommendation.exam}
                onClick={() => recommendation.exam && handleExamClick(recommendation.exam)}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {recommendation.action}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column: Search + active exam type ───────────── */}
        <div className="flex flex-col gap-5">
          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              ref={searchRef}
              type="text"
              placeholder={t('examList.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white/80 border border-rose-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent shadow-sm backdrop-blur-xl"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <FiX size={16} />
              </button>
            )}
          </div>

          <ExamSection
            title={activeExamMeta.title}
            description={activeExamMeta.description}
            count={activeExamList.length}
            grouped={activeExamByYear}
            variant={activeExamMeta.variant}
          />
        </div>
      </div>

      {vipModalExam && (
        <ProUpgradeModal
          isOpen={true}
          onClose={() => setVipModalExam(null)}
          title={format('examList.vipOnlyTitle', { title: vipModalExam.title })}
        />
      )}
    </div>
  );
}
