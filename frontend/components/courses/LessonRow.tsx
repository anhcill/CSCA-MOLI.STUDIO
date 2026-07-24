import { FiCheckCircle, FiClock, FiFileText, FiLock, FiPlayCircle } from 'react-icons/fi';
import type { CurriculumLessonDto } from '@/lib/types/courses';

const typeLabels = { video: 'Video', article: 'Bài đọc', document: 'Tài liệu', quiz: 'Bài kiểm tra' };

export function LessonRow({ lesson, index }: { lesson: CurriculumLessonDto; index: number }) {
  const TypeIcon = lesson.lessonType === 'video' ? FiPlayCircle : FiFileText;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5 text-sm first:border-t-0 dark:border-slate-800 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-black text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-400">{lesson.progressStatus === 'completed' ? <FiCheckCircle className="text-emerald-500" /> : index}</span><div className="min-w-0"><p className="truncate font-bold text-slate-800 dark:text-slate-200">{lesson.title}</p><p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><TypeIcon /> {typeLabels[lesson.lessonType]}</span>{lesson.isFreePreview ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Xem thử</span> : null}</p></div></div>
      <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400"><span className="hidden items-center gap-1 sm:inline-flex"><FiClock /> {Math.max(1, Math.ceil(lesson.durationSeconds / 60))} phút</span>{lesson.isLocked ? <FiLock aria-label="Bài học bị khóa" className="text-slate-400 dark:text-slate-500" /> : <FiPlayCircle className="text-indigo-600 dark:text-indigo-400" />}</div>
    </div>
  );
}
