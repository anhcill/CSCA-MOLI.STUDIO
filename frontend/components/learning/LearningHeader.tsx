import Link from 'next/link';
import { FiArrowLeft, FiCloud } from 'react-icons/fi';

export function LearningHeader({ courseSlug, courseTitle, progressPct }: { courseSlug: string; courseTitle: string; progressPct: number }) {
  const progress = Math.min(100, Math.max(0, progressPct));
  const roundedProgress = Math.round(progress);
  const label = progress >= 100 ? 'Hoàn thành' : progress > 0 ? 'Đang học' : 'Chưa bắt đầu';

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-slate-950 px-3 py-2.5 text-white sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link href={`/khoa-hoc/${courseSlug}`} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 font-bold transition hover:bg-white/10" aria-label="Quay lại khóa học">
          <FiArrowLeft /><span className="hidden sm:inline">Khóa học</span>
        </Link>
        <span className="hidden shrink-0 rounded-lg bg-cyan-400/10 px-2.5 py-1.5 text-sm font-black text-cyan-300 sm:inline">CSCA</span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black sm:text-base">{courseTitle}</h1>
          <p className="mt-0.5 hidden items-center gap-1.5 text-[11px] font-semibold text-slate-400 sm:flex"><FiCloud /> Tiến độ được đồng bộ tự động</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-xs font-bold text-cyan-200">{roundedProgress}% toàn khóa</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full p-[3px]" style={{ background: `conic-gradient(#22d3ee ${progress * 3.6}deg, rgba(255,255,255,.14) 0)` }}>
          <span className="grid h-full w-full place-items-center rounded-full bg-slate-950 text-[11px] font-black">{roundedProgress}%</span>
        </div>
      </div>
    </header>
  );
}
