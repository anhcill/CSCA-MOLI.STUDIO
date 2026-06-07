'use client';

import Link from 'next/link';
import {
  FiBell,
  FiClock,
  FiEdit3,
  FiFileText,
  FiHome,
  FiLayers,
  FiSearch,
  FiSettings,
  FiTrendingUp,
} from 'react-icons/fi';
import { BsGraphUp, BsJournalBookmark, BsLightbulb, BsStars } from 'react-icons/bs';
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

const QUICK_LINKS = [
  { key: 'lich-su', icon: FiClock, labelKey: 'course.section.history', href: '/lich-su' },
  { key: 'cau-truc-de', icon: BsJournalBookmark, labelKey: 'course.section.structure', href: '/cau-truc-de' },
  { key: 'ly-thuyet', icon: BsLightbulb, labelKey: 'course.section.theory', href: '/ly-thuyet' },
  { key: 'cong-thuc', icon: FiFileText, labelKey: 'course.section.formulas', href: '/cong-thuc' },
  { key: 'tu-vung', icon: BsStars, labelKey: 'course.section.vocabulary', href: '/tu-vung' },
  { key: 'giai-de-chi-tiet', icon: BsGraphUp, labelKey: 'course.section.solutions', href: '/giai-de-chi-tiet' },
] as const;

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

  return (
    <div className="min-h-screen bg-[#fbfbff] text-slate-900">
      <div className="pointer-events-none fixed -top-32 left-1/4 h-[440px] w-[70vw] bg-gradient-to-br from-violet-500 opacity-10 blur-[130px]" />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] border-r border-violet-100 bg-white/95 px-4 py-5 shadow-sm xl:block">
        <Link href="/" className="mb-8 flex items-center gap-2 text-2xl font-black text-violet-600">
          <HiOutlineSparkles className="text-violet-600" />
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
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="text-base" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
          <div className="mb-2 text-xs font-black text-violet-700">{t('course.aiCompanionTitle')}</div>
          <p className="text-[11px] font-medium leading-relaxed text-slate-500">
            {t('course.aiCompanionDesc')}
          </p>
          <Link
            href={buildSubjectScopedHref('/lo-trinh', normalizedSubject || undefined)}
            className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black text-white shadow-sm"
          >
            {t('course.exploreNow')} →
          </Link>
        </div>
      </aside>

      <main className={`relative z-10 mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 xl:pl-[244px] xl:pr-6 ${className}`}>
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <BackButton fallbackHref="/" />
              {subjectMeta && (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-500">
                  <span>{subjectMeta.icon}</span>
                  <span>{subjectMeta.label}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {localizedTitle} <span className="text-violet-500">⚡</span>
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{localizedSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:shrink-0">
            <div className="hidden min-w-[360px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm lg:flex">
              <FiSearch />
              <span>{localizedSearchPlaceholder}</span>
            </div>
            <button
              type="button"
              aria-label="Thông báo"
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 lg:flex"
            >
              <FiBell />
            </button>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white lg:flex">
              M
            </div>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                href={getScopedHref(item.href, normalizedSubject)}
                className={`group flex min-h-[76px] items-center gap-4 rounded-2xl border px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md ${
                  active ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white'
                }`}>
                  <Icon />
                </span>
                <span className="text-sm font-black text-slate-800">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </section>

        {children}

        {showFeatureCards && (
          <section className="mt-5 grid gap-4 md:grid-cols-4">
            {FEATURE_CARDS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
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
