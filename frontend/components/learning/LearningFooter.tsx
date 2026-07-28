import Link from 'next/link';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';

type Props = {
  courseSlug: string;
  previousLessonId: number | null;
  previousLessonTitle?: string | null;
  nextLessonId: number | null;
  nextLessonTitle?: string | null;
  currentLabel: string;
  currentTitle: string;
};

export function LearningFooter({
  courseSlug,
  previousLessonId,
  previousLessonTitle,
  nextLessonId,
  nextLessonTitle,
  currentLabel,
  currentTitle,
}: Props) {
  const href = (id: number) => `/hoc/${courseSlug}/bai-hoc/${id}`;
  return (
    <nav aria-label="Điều hướng bài học" className="grid gap-4 rounded-2xl border border-[#dfd0c2] bg-[#fffaf4] p-4 shadow-sm transition-colors dark:border-[#2d3b52] dark:bg-[#0b172b] md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div>
        {previousLessonId ? (
          <Link href={href(previousLessonId)} className="group flex items-center gap-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#cdb69e] text-[#6e5947] transition group-hover:bg-[#f1e4d7] dark:border-[#5a4b3e] dark:text-[#d8b28e] dark:group-hover:bg-[#17263c]"><FiArrowLeft /></span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#8c8076] dark:text-slate-500">Bài trước</span>
              <span className="mt-1 block truncate text-sm font-black text-[#243048] dark:text-slate-200">{previousLessonTitle || 'Quay lại bài trước'}</span>
            </span>
          </Link>
        ) : <span className="hidden md:block" />}
      </div>

      <div className="rounded-xl border border-[#dbc4a9] bg-[#fffdf8] px-7 py-3 text-center shadow-sm dark:border-[#5a4939] dark:bg-[#101e33]">
        <span className="text-xs font-black uppercase tracking-wider text-[#a92235]">{currentLabel}</span>
        <p className="mt-1 max-w-sm truncate font-black text-[#1e2b44] dark:text-[#f3e5d1]">{currentTitle}</p>
      </div>

      <div className="md:text-right">
        {nextLessonId ? (
          <Link href={href(nextLessonId)} className="group flex items-center gap-3 md:justify-end">
            <span className="min-w-0 md:text-right">
              <span className="block text-xs font-bold text-[#8c8076] dark:text-slate-500">Bài tiếp theo</span>
              <span className="mt-1 block truncate text-sm font-black text-[#243048] dark:text-slate-200">{nextLessonTitle || 'Chuyển sang bài tiếp theo'}</span>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#cdb69e] text-[#6e5947] transition group-hover:bg-[#f1e4d7] dark:border-[#5a4b3e] dark:text-[#d8b28e] dark:group-hover:bg-[#17263c]"><FiArrowRight /></span>
          </Link>
        ) : <span className="text-sm font-bold text-[#27867f]">Bạn đã đến bài cuối</span>}
      </div>
    </nav>
  );
}
