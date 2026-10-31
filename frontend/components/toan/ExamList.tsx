'use client';

import { useState, useEffect, useMemo, useRef, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiSearch,
  FiX,
  FiCalendar,
  FiClock,
  FiUsers,
  FiPlayCircle,
  FiLock,
  FiBookmark,
  FiCheckCircle,
  FiRotateCw,
  FiBarChart2,
  FiTarget,
  FiTrendingUp,
  FiEdit3,
  FiArrowRight,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { HiOutlineSparkles } from 'react-icons/hi2';
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
type SortType = 'popular' | 'newest' | 'oldest' | 'name';
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

const getPopularityAttemptCount = (exam: Exam) => {
  const count = Number((exam as Exam & { popularity_attempt_count?: number }).popularity_attempt_count ?? 0);
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

const EXAM_SORT_STORAGE_KEY = 'csca_exam_list_sort';
const EXAM_HIDE_DONE_STORAGE_KEY = 'csca_exam_list_hide_done';

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

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(EXAM_SORT_STORAGE_KEY) as SortType;
      if (savedSort && ['newest', 'popular', 'oldest', 'name'].includes(savedSort)) {
        setSort(savedSort);
      }
      const savedHideDone = localStorage.getItem(EXAM_HIDE_DONE_STORAGE_KEY);
      if (savedHideDone !== null) {
        setShowDone(savedHideDone === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSortChange = (newSort: SortType) => {
    setSort(newSort);
    try {
      localStorage.setItem(EXAM_SORT_STORAGE_KEY, newSort);
    } catch {
      // ignore
    }
  };

  const handleToggleShowDone = () => {
    setShowDone((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(EXAM_HIDE_DONE_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
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
      const timeA = new Date(a.publish_date || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.publish_date || (b as any).created_at || 0).getTime();

      if (sort === 'popular') {
        const popularityDifference = getPopularityAttemptCount(b) - getPopularityAttemptCount(a);
        if (popularityDifference !== 0) return popularityDifference;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      } else if (sort === 'newest') {
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      } else if (sort === 'oldest') {
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
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
      easy: {
        label: t('examList.easy'),
        cls: 'text-emerald-700 bg-emerald-50/90 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
      },
      medium: {
        label: t('examList.medium'),
        cls: 'text-amber-700 bg-amber-50/90 border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30',
        dot: 'bg-amber-500 dark:bg-amber-400',
      },
      hard: {
        label: t('examList.hard'),
        cls: 'text-rose-700 bg-rose-50/90 border-rose-200/80 dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30',
        dot: 'bg-rose-500 dark:bg-rose-400',
      },
    };
    const d = map[level] || map.medium;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${d.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
        {d.label}
      </span>
    );
  };

  // Pass rate badge
  const PassRateBadge = ({ rate }: { rate?: number }) => {
    if (rate === undefined || rate === null) return null;
    const color =
      rate >= 70
        ? 'text-emerald-700 bg-emerald-50/90 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30'
        : rate >= 40
        ? 'text-amber-700 bg-amber-50/90 border-amber-200/80 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30'
        : 'text-rose-700 bg-rose-50/90 border-rose-200/80 dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${color}`}>
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
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-lg border ${
          improved
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200/70 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30'
            : 'text-rose-700 bg-rose-50 border-rose-200/70 dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30'
        }`}
      >
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

    const accentColor = isLocked
      ? 'from-amber-400 to-orange-500'
      : done
      ? 'from-emerald-400 to-teal-500'
      : 'from-rose-500 to-red-600';

    const hoverSurface = isLocked
      ? 'hover:border-amber-300/90 hover:shadow-[0_14px_32px_-8px_rgba(245,158,11,0.14)] dark:hover:border-amber-500/40 dark:hover:shadow-[0_14px_32px_-8px_rgba(245,158,11,0.16)]'
      : done
      ? 'hover:border-emerald-200/90 hover:shadow-[0_14px_32px_-8px_rgba(16,185,129,0.12)] dark:hover:border-emerald-500/35 dark:hover:shadow-[0_14px_32px_-8px_rgba(16,185,129,0.15)]'
      : 'hover:border-rose-200/90 hover:shadow-[0_14px_32px_-8px_rgba(244,63,94,0.13)] dark:hover:border-rose-500/40 dark:hover:shadow-[0_14px_32px_-8px_rgba(244,63,94,0.18)]';

    return (
      <div
        className={`group relative flex cursor-pointer flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200/75 bg-white/95 p-5 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-[#17223b]/90 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] sm:flex-row sm:items-center sm:rounded-3xl sm:px-6 sm:py-5 ${hoverSurface} ${
          isLocked ? 'opacity-95' : ''
        }`}
        onClick={() => handleExamClick(exam)}
      >
        {/* Left accent bar */}
        <div
          className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${accentColor} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
        />

        {/* Left status icon + main content */}
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
          <div className="shrink-0">
            {done ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100/80 text-emerald-600 ring-1 ring-emerald-200/70 transition-transform duration-200 group-hover:scale-105 dark:from-emerald-500/20 dark:to-teal-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                <FiCheckCircle size={22} />
              </div>
            ) : isLocked ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100/80 text-amber-600 ring-1 ring-amber-200/70 transition-transform duration-200 group-hover:scale-105 dark:from-amber-500/20 dark:to-orange-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                <FiLock size={20} />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-pink-100/70 text-rose-600 ring-1 ring-rose-200/70 transition-all duration-200 group-hover:scale-105 group-hover:from-rose-500 group-hover:to-red-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-rose-500/25 dark:from-rose-500/15 dark:to-pink-500/10 dark:text-rose-300 dark:ring-rose-500/30 dark:group-hover:from-rose-500 dark:group-hover:to-red-600 dark:group-hover:text-white">
                <FiPlayCircle size={22} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3
                className={`text-base font-bold tracking-tight transition-colors sm:text-[17px] ${
                  isLocked
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-900 group-hover:text-rose-600 dark:text-slate-100 dark:group-hover:text-rose-400'
                }`}
              >
                {exam.title}
              </h3>
              {vipOnly && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-amber-200 to-orange-300 px-2.5 py-0.5 text-xs font-extrabold text-amber-950 shadow-sm dark:from-amber-500/30 dark:to-orange-500/30 dark:text-amber-200 dark:ring-1 dark:ring-amber-400/30">
                  <FaCrown size={10} /> VIP
                </span>
              )}
              {exam.shuffle_mode && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300">
                  🔀 {t('examList.shuffle')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/85 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                <FiClock size={12} className="text-rose-500 dark:text-rose-400" />
                <span>{format('examList.minutes', { count: exam.duration })}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/85 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                <FiUsers size={12} className="text-sky-500 dark:text-sky-400" />
                <span>{format('examList.questions', { count: exam.total_questions })}</span>
              </span>
              <DiffBadge level={exam.overall_difficulty || exam.difficulty_level} />
              <PassRateBadge rate={exam.pass_rate} />
              {exam.publish_date && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 font-medium text-slate-400 dark:bg-slate-800/40 dark:text-slate-400">
                  <FiCalendar size={12} />
                  <span>
                    {new Date(exam.publish_date).toLocaleDateString(
                      language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN'
                    )}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: results + action */}
        <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/[0.06] sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
          {done && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {format('examList.attempts', { count: attemptCount })}
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  (exam.user_best_score || 0) >= 8
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                    : (exam.user_best_score || 0) >= 5
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                    : 'bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                }`}
              >
                {format('examList.scorePoint', { score: exam.user_best_score || 0 })}
              </span>
              <ScoreCompare best={exam.user_best_score} last={exam.user_last_score} />
            </div>
          )}

          <button
            onClick={(e) => handleMakeExam(exam, e)}
            className={`ml-auto flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all sm:ml-0 sm:rounded-2xl sm:px-6 sm:py-3 ${
              isLocked
                ? 'border border-amber-200/90 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25'
                : done
                ? 'border border-rose-200/80 bg-rose-50/90 text-rose-600 hover:border-rose-500 hover:bg-rose-500 hover:text-white hover:shadow-md hover:shadow-rose-500/20 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:border-rose-500 dark:hover:bg-rose-500 dark:hover:text-white'
                : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20 hover:-translate-y-0.5 hover:from-rose-600 hover:to-red-700 hover:shadow-lg hover:shadow-rose-500/30'
            }`}
          >
            {isLocked ? (
              <>
                <FiLock size={15} /> {t('examList.locked')}
              </>
            ) : done ? (
              <>
                <FiRotateCw size={15} /> {t('examList.retry')}
              </>
            ) : (
              <>
                <FiPlayCircle size={16} /> {t('examList.startExam')}
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ─── EXAM SECTION ──────────────────────────────────────────────────
  const ExamSection = ({
    title,
    description,
    count,
    exams,
    grouped,
    variant,
  }: {
    title: string;
    description: string;
    count: number;
    exams: Exam[];
    grouped: Map<number, Exam[]>;
    variant: 'regular' | 'vip';
  }) => {
    const isVipSection = variant === 'vip';

    return (
      <section
        className={`overflow-hidden rounded-3xl border bg-white/85 shadow-[0_14px_36px_-10px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:bg-[#131c31]/80 dark:shadow-[0_14px_36px_-10px_rgba(0,0,0,0.4)] ${
          isVipSection
            ? 'border-amber-200/80 dark:border-amber-500/20'
            : 'border-rose-100/85 dark:border-white/[0.07]'
        }`}
      >
        <div
          className={`border-b px-5 py-4 sm:px-7 sm:py-5 ${
            isVipSection
              ? 'border-amber-100/90 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-transparent dark:border-amber-500/15 dark:from-amber-500/10 dark:via-slate-900/40 dark:to-transparent'
              : 'border-rose-100/80 bg-gradient-to-r from-rose-50/60 via-white/40 to-transparent dark:border-white/[0.06] dark:from-rose-500/10 dark:via-slate-900/40 dark:to-transparent'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                  isVipSection
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/20'
                    : 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/20'
                }`}
              >
                {isVipSection ? <FaCrown size={17} /> : <FiPlayCircle size={19} />}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                  {title}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                  {description}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-extrabold ${
                isVipSection
                  ? 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300'
              }`}
            >
              {format('examList.examCount', { count })}
            </span>
          </div>
        </div>

        {count === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('examList.noGroup')}
            </p>
          </div>
        ) : (
          <div className="space-y-8 p-4 sm:p-6 lg:p-7">
            {sort === 'popular' ? (
              <div className="space-y-3.5">
                {exams.map(exam => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            ) : (
              [...grouped.entries()].map(([year, yearExams]) => (
                <div key={`${variant}-${year}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1 text-base font-black tracking-tight ${
                        isVipSection
                          ? 'border-amber-200/70 bg-amber-50/90 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'border-rose-200/70 bg-rose-50/90 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300'
                      }`}
                    >
                      <FiCalendar size={14} />
                      <span>{year === 0 ? '?' : year}</span>
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        isVipSection
                          ? 'border-amber-200/60 bg-white/80 text-amber-700 dark:border-amber-500/25 dark:bg-slate-800/80 dark:text-amber-300'
                          : 'border-rose-100 bg-white/80 text-slate-600 dark:border-white/[0.08] dark:bg-slate-800/80 dark:text-slate-300'
                      }`}
                    >
                      {yearExams.length} đề
                    </span>
                    <div
                      className={`h-px flex-1 bg-gradient-to-r ${
                        isVipSection
                          ? 'from-amber-200/80 via-amber-100/30 to-transparent dark:from-amber-500/30 dark:to-transparent'
                          : 'from-rose-200/80 via-rose-100/30 to-transparent dark:from-slate-700 dark:to-transparent'
                      }`}
                    />
                  </div>
                  <div className="space-y-3.5">
                    {yearExams.map(exam => (
                      <ExamCard key={exam.id} exam={exam} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    );
  };

  // ─── LOADING ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl border border-rose-100/80 bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#131c31]/80"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-3/4 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
              </div>
              <div className="h-11 w-32 rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasSearch = search.trim().length > 0;
  const noResults = filteredExams.length === 0 && !loading;

  // ─── MAIN ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Top Row: Progress Overview + AI Study Companion ─────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Progress Overview Card */}
        <div className="rounded-3xl border border-rose-100/80 bg-white/85 p-5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#131c31]/85 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] sm:p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">
                <FiBarChart2 size={18} />
              </div>
              <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('examList.progressOverview')}
              </h3>
            </div>
            <span className="rounded-full bg-slate-100/90 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {progressStats.done}/{stats.total} đề
            </span>
          </div>

          <div className="flex flex-col items-center gap-5 sm:flex-row">
            {/* Circular Progress */}
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#f43f5e_var(--progress),#ffe4e6_0)] dark:bg-[conic-gradient(#fb7185_var(--progress),#1e293b_0)] sm:h-32 sm:w-32"
              style={{ ['--progress' as string]: `${progressStats.completion}%` }}
            >
              <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full bg-white shadow-inner dark:bg-[#0f172a] sm:h-24 sm:w-24">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {progressStats.completion}%
                </span>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">
                  {t('examList.setProgress')}
                </span>
              </div>
            </div>

            {/* 4 Mini Stat Tiles */}
            <div className="grid w-full flex-1 grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-slate-800/50">
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100/80 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                  <FiEdit3 size={15} />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {progressStats.done}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('examList.done')}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-slate-800/50">
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100/80 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
                  <FiCheckCircle size={15} />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {progressStats.totalQuestions}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('examList.questionsPracticed')}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-slate-800/50">
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/80 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                  <FiClock size={15} />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {progressStats.avgScore}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('history.avgScore')}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-slate-800/50">
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <FiTrendingUp size={15} />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {progressStats.passRate}%
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('examList.passRate')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendation Card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-50/90 via-white/95 to-amber-50/60 p-5 shadow-[0_12px_32px_-8px_rgba(244,63,94,0.08)] backdrop-blur-xl dark:border-rose-500/20 dark:from-[#1b172a]/95 dark:via-[#131c31]/95 dark:to-[#1f1726]/90 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] sm:p-6 lg:col-span-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-300/25 blur-2xl dark:bg-rose-500/15" />
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-rose-600 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
              <HiOutlineSparkles className="text-sm" />
              <span>AI Study Coach</span>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20">
                <FiTarget size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                  {recommendation.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
                  {recommendation.text}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={recommendation.disabled || !recommendation.exam}
              onClick={() => recommendation.exam && handleExamClick(recommendation.exam)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition-all hover:-translate-y-0.5 hover:from-rose-600 hover:to-red-700 hover:shadow-lg hover:shadow-rose-500/30 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 disabled:shadow-none dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500 sm:text-sm"
            >
              <span>{recommendation.action}</span>
              <FiArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Unified Search & Filter Command Bar ─────────────────────── */}
      <div className="rounded-3xl border border-rose-100/80 bg-white/85 p-4 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#131c31]/85 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Exam Type Segmented Tabs */}
          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-rose-100/80 bg-slate-50/80 p-1.5 dark:border-white/[0.06] dark:bg-slate-900/70">
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
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all sm:text-sm ${
                    active
                      ? isVipTab
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25'
                        : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/25'
                      : isVipTab
                      ? 'text-amber-700 hover:bg-amber-50/80 dark:text-amber-300 dark:hover:bg-amber-500/10'
                      : 'text-slate-600 hover:bg-rose-50/80 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={17} />
            <input
              ref={searchRef}
              type="text"
              placeholder={t('examList.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.5 pl-11 pr-10 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-white/[0.08] dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500/40"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <FiX size={15} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 sm:inline-block">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Bottom Filter & Sort Row */}
        <div className="mt-3.5 flex flex-col gap-3 border-t border-slate-100 pt-3.5 dark:border-white/[0.06] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { value: 'all', label: t('history.all'), emoji: '📋', count: stats.total },
              { value: 'done', label: t('examList.done'), emoji: '✓', count: stats.done },
              { value: 'not-done', label: t('examList.notDone'), emoji: '○', count: stats.notDone },
            ] as { value: FilterType; label: string; emoji: string; count: number }[]).map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  filter === f.value
                    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                    : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
                <span className="opacity-70">({f.count})</span>
              </button>
            ))}
          </div>

          {/* Sort + Hide Done + Result Summary */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden text-xs font-medium text-slate-400 dark:text-slate-500 xl:inline">
              {format('examList.foundCount', { count: visibleExams.length })}
              {search ? ` • ${format('examList.searchFor', { search })}` : ''}
            </span>

            <button
              onClick={handleToggleShowDone}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                showDone
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-rose-200 hover:text-rose-600 dark:border-white/[0.08] dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-rose-500/30 dark:hover:text-rose-300'
              }`}
            >
              <FiBookmark size={12} />
              <span>{showDone ? t('examList.hidingDone') : t('examList.hideDone')}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
                {t('examList.sort')}
              </span>
              <select
                value={sort}
                onChange={e => handleSortChange(e.target.value as SortType)}
                className="cursor-pointer rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-white/[0.08] dark:bg-slate-900/80 dark:text-slate-200"
              >
                <option value="newest">{t('examList.newest')}</option>
                <option value="popular">{t('examList.popular')}</option>
                <option value="oldest">{t('examList.oldest')}</option>
                <option value="name">{t('examList.byName')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-Width Exam List or Empty State ─────────────────────── */}
      {noResults ? (
        <div className="rounded-3xl border border-rose-100/80 bg-white/85 p-12 text-center shadow-sm backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#131c31]/85 sm:p-16">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-400 dark:bg-rose-500/15 dark:text-rose-300">
            <FiSearch size={34} />
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
            {hasSearch ? format('examList.noSearch', { search }) : t('examList.noMatch')}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
            {hasSearch ? t('examList.tryAnother') : t('examList.updating')}
          </p>
          {(hasSearch || filter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
              className="mt-5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/20 transition hover:from-rose-600 hover:to-red-700"
            >
              {t('examList.clearSearch')}
            </button>
          )}
          {!hasSearch && exams.length === 0 && !loading && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              {format('examList.subjectCode', { code: subjectCode || subjectSlug || '?' })}
            </p>
          )}
        </div>
      ) : (
        <ExamSection
          title={activeExamMeta.title}
          description={activeExamMeta.description}
          count={activeExamList.length}
          exams={activeExamList}
          grouped={activeExamByYear}
          variant={activeExamMeta.variant}
        />
      )}

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
