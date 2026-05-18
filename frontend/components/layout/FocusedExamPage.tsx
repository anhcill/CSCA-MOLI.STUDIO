import Link from 'next/link';
import { FiArrowLeft, FiBookOpen, FiClock } from 'react-icons/fi';
import { BsGraphUp, BsJournalBookmark, BsLightbulb, BsStars } from 'react-icons/bs';
import AdminExamButton from '@/components/common/AdminExamButton';
import ExamList from '@/components/toan/ExamList';
import { buildSubjectScopedHref } from '@/lib/utils/subjectScope';

type ColorScheme = {
  from: string;
  via?: string;
  to: string;
};

type FocusedExamPageProps = {
  title: string;
  subjectCode: string;
  subjectSlug: string;
  colorScheme: ColorScheme;
  shadowClass?: string;
  accentSoftClass?: string;
  adminGradientClass?: string;
};

const QUICK_LINKS = [
  { icon: BsJournalBookmark, label: 'Cấu trúc đề', href: '/cau-truc-de' },
  { icon: BsLightbulb, label: 'Lý thuyết', href: '/ly-thuyet' },
  { icon: BsStars, label: 'Từ vựng', href: '/tu-vung' },
  { icon: BsGraphUp, label: 'Giải đề chi tiết', href: '/giai-de-chi-tiet' },
];

export default function FocusedExamPage({
  title,
  subjectCode,
  subjectSlug,
  colorScheme,
  shadowClass = 'shadow-indigo-900/10',
  accentSoftClass = 'from-indigo-500',
  adminGradientClass,
}: FocusedExamPageProps) {
  const gradient = `${colorScheme.from} ${colorScheme.via || ''} ${colorScheme.to}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className={`pointer-events-none absolute -top-32 left-1/4 h-[440px] w-[70vw] bg-gradient-to-br ${accentSoftClass} opacity-10 blur-[130px]`} />

      <main className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8 2xl:px-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
          >
            <FiArrowLeft size={16} />
            Quay về
          </Link>

          <div className="hidden items-center gap-2 text-sm font-black text-slate-800 sm:flex">
            <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${gradient}`} />
            moly.study
          </div>
        </div>

        <section className={`relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-5 text-white shadow-lg ${shadowClass} sm:p-6`}>
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/20 blur-3xl mix-blend-overlay" />
          <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/20 blur-3xl mix-blend-overlay" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <h1 className="text-2xl font-black leading-tight tracking-tight drop-shadow-md sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-white/90 sm:text-base">
                Luyện tập theo đề, xem lịch sử điểm và để AI phân tích lộ trình cải thiện sau mỗi lần làm bài.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Link
                href={subjectSlug ? `/lich-su?subject=${subjectSlug}` : '/lich-su'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25 sm:px-3 sm:text-sm"
              >
                <FiClock size={15} />
                Lịch sử thi
              </Link>
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={buildSubjectScopedHref(item.href, subjectSlug)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950 sm:px-3 sm:text-sm"
                  >
                    <Icon className="text-slate-500" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorScheme.from} ${colorScheme.to} text-white shadow-sm`}>
                <FiBookOpen size={19} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                  Danh sách đề thi
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  Chọn đề và làm lại nhiều lần để theo dõi tiến bộ.
                </p>
              </div>
            </div>

            <AdminExamButton
              href="/admin/exams/create"
              gradientClass={adminGradientClass || `${colorScheme.from} ${colorScheme.to}`}
              shadowClass="shadow-violet-500/20"
              hoverClass="hover:shadow-violet-500/40 hover:-translate-y-0.5"
            />
          </div>
        </section>

        <ExamList subjectCode={subjectCode} subjectSlug={subjectSlug} />
      </main>
    </div>
  );
}
