import Link from 'next/link';
import { FiArrowLeft, FiBookmark, FiChevronRight, FiCloud } from 'react-icons/fi';

export function LearningHeader({
  courseSlug,
  courseTitle,
  progressPct,
  onNotesClick,
}: {
  courseSlug: string;
  courseTitle: string;
  progressPct: number;
  onNotesClick: () => void;
}) {
  const progress = Math.min(100, Math.max(0, progressPct));
  const roundedProgress = Math.round(progress);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#061126] text-white shadow-lg shadow-slate-950/10">
      <div className="mx-auto flex min-h-[74px] max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#b98a64] px-4 py-2.5 text-sm font-black text-[#f6d9b4] transition hover:bg-white/5">
            <FiArrowLeft /><span className="hidden sm:inline">Về trang chủ</span>
          </Link>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <Link href="/khoa-hoc" className="shrink-0 font-black text-[#38aaa4] hover:text-emerald-300">CSCA</Link>
            <FiChevronRight className="shrink-0 text-[#b69472]" />
            <Link href={`/khoa-hoc/${courseSlug}`} className="truncate font-bold text-[#f2d1a8] hover:text-white">{courseTitle}</Link>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <div className="hidden w-64 lg:block">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-2 text-slate-200"><FiCloud className="text-[#41b9b2]" /> Tiến độ khóa học</span>
              <span className="text-[#f2d1a8]">{roundedProgress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-gradient-to-r from-[#23858a] to-[#58b8a9]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button type="button" onClick={onNotesClick} className="inline-flex items-center gap-2 rounded-full border border-[#b98a64]/80 px-4 py-2.5 text-sm font-black text-[#f6dfc1] transition hover:bg-white/5">
            <FiBookmark /><span className="hidden sm:inline">Ghi chú của tôi</span>
          </button>
        </div>
      </div>
    </header>
  );
}
