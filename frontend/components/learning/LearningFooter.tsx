import Link from 'next/link';

export function LearningFooter({ courseSlug, previousLessonId, nextLessonId }: { courseSlug: string; previousLessonId: number | null; nextLessonId: number | null }) {
  const href = (id: number) => `/hoc/${courseSlug}/bai-hoc/${id}`;
  return <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">{previousLessonId ? <Link href={href(previousLessonId)} className="rounded-xl border border-slate-300 px-5 py-2 font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">← Bài trước</Link> : <span />}{nextLessonId ? <Link href={href(nextLessonId)} className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-500">Bài tiếp theo →</Link> : <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Bạn đã đến bài cuối</span>}</footer>;
}
