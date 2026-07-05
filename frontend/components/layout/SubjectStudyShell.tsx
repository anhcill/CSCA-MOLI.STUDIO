'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FiBell,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiFileText,
  FiHome,
  FiLayers,
  FiSearch,
  FiSettings,
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

export type SubjectStudySection =
  | 'de-mo-phong'
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
}

const DEFAULT_SUBTITLE = 'Luyện tập theo đề, xem lịch sử điểm và để AI phân tích lộ trình cải thiện sau mỗi lần làm bài.';
const DEFAULT_SEARCH_PLACEHOLDER = 'Tìm nhanh đề thi... (nhấn / để focus)';

const SIDE_LINKS = [
  { key: 'de-mo-phong', icon: FiHome, labelKey: 'course.section.mockExam', href: 'exam' },
  { key: 'lich-su', icon: FiClock, labelKey: 'course.section.history', href: '/lich-su' },
  { key: 'ai-phan-tich', icon: BsGraphUp, labelKey: 'course.section.ai', href: '/lo-trinh' },
  { key: 'ly-thuyet', icon: BsLightbulb, labelKey: 'course.section.theory', href: '/ly-thuyet' },
  { key: 'cong-thuc', icon: FiFileText, labelKey: 'course.section.formulas', href: '/cong-thuc' },
  { key: 'tu-vung', icon: BsStars, labelKey: 'course.section.vocabulary', href: '/tu-vung' },
  { key: 'lo-trinh', icon: FiTrendingUp, labelKey: 'course.section.progress', href: '/lo-trinh' },
  { key: 'cai-dat', icon: FiSettings, labelKey: 'course.section.settings', href: '/profile' },
] as const;

const FEATURE_CARDS = [
  { icon: FiFileText, titleKey: 'course.feature.practiceTitle', textKey: 'course.feature.practiceText' },
  { icon: FiLayers, titleKey: 'course.feature.progressTitle', textKey: 'course.feature.progressText' },
  { icon: HiOutlineSparkles, titleKey: 'course.feature.aiTitle', textKey: 'course.feature.aiText' },
  { icon: FiEdit3, titleKey: 'course.feature.realExamTitle', textKey: 'course.feature.realExamText' },
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
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  children,
  className = '',
  showFeatureCards = false,
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
  const localizedSearchPlaceholder = searchPlaceholder === DEFAULT_SEARCH_PLACEHOLDER
    ? t('course.searchPlaceholder')
    : searchPlaceholder;

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
    <div className="relative min-h-screen overflow-x-hidden bg-[#fff8f4] text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/study-bg-20260705b.png')" }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-white/40 via-white/10 to-white/45" />
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
            padding-left: 2rem;
            padding-right: 1.5rem;
          }

          .subject-study-main--collapsed {
            width: 100%;
            max-width: 1600px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 2rem;
          }
        }
      `}</style>

      <aside className={`subject-study-sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-rose-100/80 bg-white/80 px-4 py-5 shadow-[12px_0_40px_rgba(127,29,29,0.06)] backdrop-blur-xl transition-transform duration-300 ease-out xl:block ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}`}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Thu gọn thanh chức năng"
          title="Thu gọn thanh chức năng"
          className="absolute -right-4 top-1/2 z-40 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-500 shadow-lg transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <FiChevronLeft />
        </button>
        <Link href="/" className="mb-8 flex items-center gap-2 text-2xl font-black text-red-600">
          <HiOutlineSparkles className="text-red-600" />
          MOLY
        </Link>
        <nav className="space-y-1.5">
          {SIDE_LINKS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={getScopedHref(item.href, normalizedSubject)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                  active
                    ? 'bg-red-50 text-red-600 shadow-sm'
                    : 'text-slate-500 hover:bg-rose-50 hover:text-red-600'
                }`}
              >
                <Icon className="text-base" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 overflow-hidden rounded-2xl border border-rose-100/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
          <div className="mb-2 text-xs font-black text-red-600">{t('course.aiCompanionTitle')}</div>
          <p className="text-[11px] font-medium leading-relaxed text-slate-500">
            {t('course.aiCompanionDesc')}
          </p>
          <Link
            href={buildSubjectScopedHref('/lo-trinh', normalizedSubject || undefined)}
            className="mt-3 inline-flex rounded-lg bg-red-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-red-700"
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
          className="fixed left-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 shadow-xl transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 xl:flex"
        >
          <FiChevronRight />
        </button>
      )}

      <main
        className={`subject-study-main relative z-10 py-4 transition-[margin,width,padding] duration-300 ease-out ${sidebarCollapsed ? 'subject-study-main--collapsed' : ''} ${className}`}
      >
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/75 px-5 py-4 shadow-[0_10px_30px_rgba(127,29,29,0.08)] backdrop-blur-xl lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <BackButton fallbackHref="/" />
              {subjectMeta && (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-500">
                  <span>{subjectMeta.icon}</span>
                  <span>{subjectMeta.label}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {localizedTitle} <span className="text-red-500">⚡</span>
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{localizedSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:shrink-0">
            <div className="hidden min-w-[360px] items-center gap-2 rounded-xl border border-rose-100 bg-white/80 px-4 py-2.5 text-sm text-slate-400 shadow-sm lg:flex">
              <FiSearch />
              <span>{localizedSearchPlaceholder}</span>
            </div>
            <button
              type="button"
              aria-label="Thông báo"
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-rose-100 bg-white/80 text-slate-500 shadow-sm transition hover:text-red-600 lg:flex"
            >
              <FiBell />
            </button>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white shadow-sm lg:flex">
              M
            </div>
          </div>
        </header>

        <nav
          aria-label="Chức năng môn học"
          className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SIDE_LINKS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={getScopedHref(item.href, normalizedSubject)}
                className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border px-3 py-2 text-xs font-black shadow-sm transition ${
                  active
                    ? 'border-red-200 bg-red-600 text-white'
                    : 'border-rose-100 bg-white/80 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <Icon className="shrink-0 text-sm" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {children}

        {showFeatureCards && (
          <section className="mt-5 grid gap-4 md:grid-cols-4">
            {FEATURE_CARDS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="rounded-2xl border border-rose-100/80 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <Icon />
                  </div>
                  <div className="text-sm font-black text-slate-800">{t(item.titleKey)}</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{t(item.textKey)}</p>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
