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

export type SubjectStudySection =
  | 'de-mo-phong'
  | 'lich-su'
  | 'cau-truc-de'
  | 'ly-thuyet'
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

const QUICK_LINKS = [
  { key: 'lich-su', icon: FiClock, label: 'Lịch sử thi', href: '/lich-su' },
  { key: 'cau-truc-de', icon: BsJournalBookmark, label: 'Cấu trúc đề', href: '/cau-truc-de' },
  { key: 'ly-thuyet', icon: BsLightbulb, label: 'Lý thuyết', href: '/ly-thuyet' },
  { key: 'tu-vung', icon: BsStars, label: 'Từ vựng', href: '/tu-vung' },
  { key: 'giai-de-chi-tiet', icon: BsGraphUp, label: 'Giải đề chi tiết', href: '/giai-de-chi-tiet' },
] as const;

const SIDE_LINKS = [
  { key: 'de-mo-phong', icon: FiHome, label: 'Đề mô phỏng', href: 'exam' },
  { key: 'lich-su', icon: FiClock, label: 'Lịch sử thi', href: '/lich-su' },
  { key: 'ai-phan-tich', icon: BsGraphUp, label: 'AI phân tích', href: '/lo-trinh' },
  { key: 'ly-thuyet', icon: BsLightbulb, label: 'Lý thuyết', href: '/ly-thuyet' },
  { key: 'tu-vung', icon: BsStars, label: 'Từ vựng', href: '/tu-vung' },
  { key: 'lo-trinh', icon: FiTrendingUp, label: 'Theo dõi tiến bộ', href: '/lo-trinh' },
  { key: 'cai-dat', icon: FiSettings, label: 'Cài đặt', href: '/profile' },
] as const;

const FEATURE_CARDS = [
  { icon: FiFileText, title: 'Luyện tập thông minh', text: 'Hệ thống đề mô phỏng sát với đề thi thật.' },
  { icon: FiLayers, title: 'Theo dõi tiến bộ', text: 'Xem lịch sử làm bài và phân tích điểm mạnh, điểm yếu.' },
  { icon: HiOutlineSparkles, title: 'AI gợi ý lộ trình', text: 'Nhận gợi ý cá nhân hóa để cải thiện hiệu quả hơn.' },
  { icon: FiEdit3, title: 'Thi thử như thật', text: 'Giao diện và thời gian thi bám sát kỳ thi chính thức.' },
] as const;

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
  subtitle = 'Luyện tập theo đề, xem lịch sử điểm và để AI phân tích lộ trình cải thiện sau mỗi lần làm bài.',
  subjectSlug,
  activeSection,
  searchPlaceholder = 'Tìm nhanh đề thi... (nhấn / để focus)',
  children,
  className = '',
  showFeatureCards = false,
}: SubjectStudyShellProps) {
  const subjectMeta = getSubjectMeta(subjectSlug);
  const normalizedSubject = normalizeContentSubject(subjectSlug);

  return (
    <div className="min-h-screen bg-[#fbfbff] text-slate-900">
      <div className="pointer-events-none fixed -top-32 left-1/4 h-[440px] w-[70vw] bg-gradient-to-br from-violet-500 opacity-10 blur-[130px]" />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] border-r border-violet-100 bg-white/95 px-4 py-5 shadow-sm xl:block">
        <Link href="/" className="mb-8 flex items-center gap-2 text-2xl font-black text-violet-600">
          <HiOutlineSparkles className="text-violet-600" />
          MOLI
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
          <div className="mb-2 text-xs font-black text-violet-700">AI đồng hành cùng bạn</div>
          <p className="text-[11px] font-medium leading-relaxed text-slate-500">
            Phân tích điểm mạnh, điểm yếu và gợi ý cách cải thiện.
          </p>
          <Link
            href={buildSubjectScopedHref('/lo-trinh', normalizedSubject || undefined)}
            className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black text-white shadow-sm"
          >
            Khám phá ngay →
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
                {title} <span className="text-violet-500">⚡</span>
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:shrink-0">
            <div className="hidden min-w-[360px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm lg:flex">
              <FiSearch />
              <span>{searchPlaceholder}</span>
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

        <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
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
                <span className="text-sm font-black text-slate-800">{item.label}</span>
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
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Icon />
                  </div>
                  <div className="text-sm font-black text-slate-800">{item.title}</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.text}</p>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
