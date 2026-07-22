import Link from 'next/link';

export function LearningHeader({ courseTitle, progressPct }: { courseTitle: string; progressPct: number }) {
  return <header className="flex min-h-16 items-center justify-between gap-4 bg-slate-950 px-4 py-3 text-white"><div className="flex min-w-0 items-center gap-4"><Link href="/hoc" className="rounded-lg px-2 py-1 hover:bg-white/10" aria-label="Quay lại khóa học">←</Link><span className="shrink-0 font-black text-cyan-300">CSCA</span><h1 className="truncate font-bold">{courseTitle}</h1></div><span className="shrink-0 text-sm font-bold">{Math.round(progressPct)}%</span></header>;
}
