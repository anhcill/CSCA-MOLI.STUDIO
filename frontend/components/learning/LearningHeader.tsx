import Link from 'next/link';

export function LearningHeader({ courseSlug, courseTitle, progressPct }: { courseSlug: string; courseTitle: string; progressPct: number }) {
  return <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white dark:border-slate-700"><div className="flex min-w-0 items-center gap-3"><Link href={`/khoa-hoc/${courseSlug}`} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 font-bold hover:bg-white/10" aria-label="Quay lại khóa học"><span aria-hidden="true">←</span><span className="hidden sm:inline">Khóa học</span></Link><span className="shrink-0 font-black text-cyan-300">CSCA</span><h1 className="truncate font-bold">{courseTitle}</h1></div><span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">{Math.round(progressPct)}%</span></header>;
}
