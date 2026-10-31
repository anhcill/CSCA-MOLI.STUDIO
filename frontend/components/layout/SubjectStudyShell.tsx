'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiHome,
  FiSettings,
  FiTarget,
  FiTrendingUp,
} from 'react-icons/fi';
import { BsGraphUp, BsLightbulb, BsStars } from 'react-icons/bs';
import { HiOutlineSparkles } from 'react-icons/hi2';
import BackButton from '@/components/layout/BackButton';
import {
  buildSubjectScopedHref,
  getExamSubjectSlug,
  getSubjectMeta,
  normalizeContentSubject,
} from '@/lib/utils/subjectScope';
import { useLanguage } from '@/context/LanguageContext';
import { FEATURE_FLAGS } from '@/lib/config/features';

export type SubjectStudySection =
  | 'de-mo-phong'
  | 'luyen-chu-de'
  | 'lich-su'
  | 'cau-truc-de'
  | 'ly-thuyet'
  | 'cong-thuc'
  | 'tu-vung'
  | 'giai-de-chi-tiet'
  | 'lo-trinh'
  | 'ai-phan-tich'
  | 'cai-dat';

interface SubjectStudyShellProps {
  title: string;
  subtitle?: string;
  subjectSlug?: string | null;
  activeSection: SubjectStudySection;
  searchPlaceholder?: string;
  children: React.ReactNode;
  className?: string;
  showFeatureCards?: boolean;
  headerAction?: React.ReactNode;
}

const DEFAULT_SUBTITLE = 'Luyện tập theo đề, xem lịch sử điểm và để AI phân tích lộ trình cải thiện sau mỗi lần làm bài.';

const SIDE_LINKS = [
  { key: 'de-mo-phong', icon: FiHome, labelKey: 'course.section.mockExam', href: 'exam' },
  { key: 'luyen-chu-de', icon: FiTarget, labelKey: 'course.section.topicPractice', href: '/luyen-chu-de' },
  { key: 'cong-thuc', icon: FiFileText, labelKey: 'course.section.formulas', href: '/cong-thuc' },
  { key: 'tu-vung', icon: BsStars, labelKey: 'course.section.vocabulary', href: '/tu-vung' },
  { key: 'lich-su', icon: FiClock, labelKey: 'course.section.history', href: '/lich-su' },
  { key: 'ai-phan-tich', icon: BsGraphUp, labelKey: 'course.section.ai', href: '/lo-trinh' },
  { key: 'ly-thuyet', icon: BsLightbulb, labelKey: 'course.section.theory', href: '/ly-thuyet' },
  { key: 'lo-trinh', icon: FiTrendingUp, labelKey: 'course.section.progress', href: '/lo-trinh' },
  { key: 'cai-dat', icon: FiSettings, labelKey: 'course.section.settings', href: '/profile' },
] as const;

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

const TITLE_KEYS: Partial<Record<SubjectStudySection, string>> = {
  'de-mo-phong': 'course.title.mockExam',
  'luyen-chu-de': 'course.title.topicPractice',
  'lich-su': 'course.title.history',
  'cau-truc-de': 'course.title.structure',
  'ly-thuyet': 'course.title.theory',
  'cong-thuc': 'course.title.formulas',
  'tu-vung': 'course.title.vocabulary',
  'giai-de-chi-tiet': 'course.title.solutions',
  'lo-trinh': 'course.title.roadmap',
  'ai-phan-tich': 'course.title.roadmap',
};

const getExamHref = (subjectSlug?: string | null) => {
  const normalizedSubject = normalizeContentSubject(subjectSlug);
  const examSlug = getExamSubjectSlug(normalizedSubject);
  return examSlug ? `/${examSlug}/de-mo-phong` : '/de-mo-phong';
};

const getScopedHref = (href: string, subjectSlug?: string | null) => {
  if (href === 'exam') return getExamHref(subjectSlug);
  return buildSubjectScopedHref(href, subjectSlug || undefined);
};

export default function SubjectStudyShell({
  title,
  subtitle = DEFAULT_SUBTITLE,
  subjectSlug,
  activeSection,
  children,
  className = '',
  headerAction,
}: SubjectStudyShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t, format } = useLanguage();
  const subjectMeta = getSubjectMeta(subjectSlug);
  const normalizedSubject = normalizeContentSubject(subjectSlug);
  const subjectLabel = normalizedSubject ? t(SUBJECT_LABEL_KEYS[normalizedSubject] || normalizedSubject) : '';
  const titleKey = TITLE_KEYS[activeSection];
  const localizedTitle = titleKey
    ? format(titleKey, { subject: subjectLabel || title })
    : title;
  const localizedSubtitle = subtitle === DEFAULT_SUBTITLE
    ? t('course.defaultSubtitle')
    : subtitle;
  const visibleSideLinks = SIDE_LINKS.filter(
    (link) => link.key !== 'luyen-chu-de' || FEATURE_FLAGS.topicPractice,
  );

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem('moly.studySidebarCollapsed') === '1');
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('moly.studySidebarCollapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fdfaf7] text-slate-800 dark:bg-[#0b1120] dark:text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90 dark:hidden"
        style={{ backgroundImage: "url('/images/study-bg-20260705b.png')" }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-rose-50/45 via-white/35 to-sky-50/45 dark:hidden" />
      <div className="pointer-events-none fixed inset-0 z-0 hidden dark:block dark:bg-[radial-gradient(ellipse_at_top_right,_rgba(244,63,94,0.09),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(56,189,248,0.07),_transparent_55%)]" />
      <style>{`
        .subject-study-sidebar {
          width: 16rem;
        }

        .subject-study-main {
          width: 100%;
          max-width: 1600px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 1rem;
          padding-right: 1rem;
        }

        @media (min-width: 640px) {
          .subject-study-main {
            padding-left: 1.5rem;
            padding-right: 1.5rem;
          }
        }

        @media (min-width: 1280px) {
          .subject-study-main {
            width: calc(100% - 16rem);
            max-width: none;
            margin-left: 16rem;
            margin-right: 0;
            padding-left: 2.25rem;
            padding-right: 2.25rem;
          }

          .subject-study-main--collapsed {
            width: 100%;
            max-width: 1600px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 2.25rem;
            padding-right: 2.25rem;
          }
        }
      `}</style>

      <aside className={`subject-study-sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-rose-100/80 bg-white/85 px-4 py-6 shadow-[8px_0_32px_-8px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition-transform duration-300 ease-out dark:border-white/[0.07] dark:bg-[#0f172a]/90 dark:shadow-[8px_0_32px_-8px_rgba(0,0,0,0.45)] xl:block ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}`}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Thu gọn thanh chức năng"
          title="Thu gọn thanh chức năng"
          className="absolute -right-4 top-1/2 z-40 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-rose-100/90 bg-white text-slate-500 shadow-md transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
        >
          <FiChevronLeft />
        </button>
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 text-2xl font-black tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/25">
            <HiOutlineSparkles className="text-lg" />
          </span>
          <span className="bg-gradient-to-r from-rose-600 to-red-500 bg-clip-text text-transparent dark:from-rose-400 dark:to-amber-200">
            MOLY
          </span>
        </Link>
        <nav className="space-y-1.5">
          {visibleSideLinks.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={getScopedHref(item.href, normalizedSubject)}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition-all ${
                  active
                    ? 'bg-gradient-to-r from-rose-500/12 via-red-500/8 to-transparent text-rose-600 ring-1 ring-rose-200/70 shadow-sm dark:from-rose-500/20 dark:via-rose-500/10 dark:to-transparent dark:text-rose-300 dark:ring-rose-500/30'
                    : 'text-slate-500 hover:bg-rose-50/70 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="text-base" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 overflow-hidden rounded-2xl border border-rose-100/90 bg-gradient-to-br from-rose-50/85 via-white/95 to-amber-50/50 p-4 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:from-slate-800/85 dark:via-slate-900/90 dark:to-rose-950/30 dark:shadow-none">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-300">
            <HiOutlineSparkles className="text-sm" />
            <span>{t('course.aiCompanionTitle')}</span>
          </div>
          <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-300">
            {t('course.aiCompanionDesc')}
          </p>
          <Link
            href={buildSubjectScopedHref('/lo-trinh', normalizedSubject || undefined)}
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-sm shadow-rose-500/20 transition hover:from-rose-600 hover:to-red-700"
          >
            {t('course.exploreNow')} →
          </Link>
        </div>
      </aside>

      {sidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Mở thanh chức năng"
          title="Mở thanh chức năng"
          className="fixed left-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 shadow-xl transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none dark:hover:border-rose-500/50 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 xl:flex"
        >
          <FiChevronRight />
        </button>
      )}

      <main
        className={`subject-study-main relative z-10 py-5 pb-12 transition-[margin,width,padding] duration-300 ease-out ${sidebarCollapsed ? 'subject-study-main--collapsed' : ''} ${className}`}
      >
        <header className="relative mb-6 overflow-hidden rounded-3xl border border-rose-100/80 bg-white/85 px-5 py-5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#131c31]/85 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-rose-200/35 via-amber-100/25 to-transparent blur-2xl dark:from-rose-500/15 dark:via-sky-500/10 dark:to-transparent" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                <BackButton fallbackHref="/" />
                {subjectMeta && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-rose-50/80 px-3.5 py-1 text-xs font-bold tracking-wide text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
                    <span>{subjectMeta.icon}</span>
                    <span>{subjectMeta.label}</span>
                  </div>
                )}
                <span className="hidden items-center gap-1.5 rounded-full border border-sky-200/60 bg-sky-50/70 px-3 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300 sm:inline-flex">
                  <HiOutlineSparkles className="text-xs" />
                  CSCA Academic Space
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[28px]">
                  {localizedTitle}
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-300">
                  {localizedSubtitle}
                </p>
              </div>
            </div>
            {headerAction && (
              <div className="flex shrink-0 items-center gap-3">
                {headerAction}
              </div>
            )}
          </div>
        </header>

        <nav
          aria-label="Chức năng môn học"
          className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleSideLinks.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={getScopedHref(item.href, normalizedSubject)}
                className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-sm transition ${
                  active
                    ? 'border-rose-300 bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-500/20'
                    : 'border-rose-100/90 bg-white/85 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-white/[0.08] dark:bg-[#131c31]/90 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15 dark:hover:text-rose-200'
                }`}
              >
                <Icon className="shrink-0 text-sm" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {children}
      </main>
    </div>
  );
}
