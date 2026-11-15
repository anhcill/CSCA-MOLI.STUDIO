import Link from 'next/link';
import { FiCheckCircle, FiClock, FiFileText, FiLock, FiPlayCircle } from 'react-icons/fi';
import type { CurriculumLessonDto } from '@/lib/types/courses';

const typeLabels = { video: 'Video', article: 'Bài đọc', document: 'Tài liệu', quiz: 'Bài kiểm tra' };

export function LessonRow({
  lesson,
  index,
  courseSlug,
}: {
  lesson: CurriculumLessonDto;
  index: number;
  courseSlug?: string;
}) {
  const TypeIcon = lesson.lessonType === 'video' ? FiPlayCircle : FiFileText;
  const isExternalUnit = Boolean(lesson.href || lesson.unitProjectionId);
  const canOpen = Boolean(courseSlug && (!lesson.isLocked || lesson.isFreePreview || isExternalUnit));
  const lessonHref = lesson.href || `/hoc/${courseSlug}/bai-hoc/${lesson.id}`;

  const inner = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-black text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-400">
          {lesson.progressStatus === 'completed' ? <FiCheckCircle className="text-emerald-500" /> : index}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800 group-hover:text-indigo-700 dark:text-slate-200 dark:group-hover:text-indigo-300">
            {lesson.title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <TypeIcon /> {lesson.unitType === 'class_session' ? 'Buổi học Live Mirror' : typeLabels[lesson.lessonType]}
            </span>
            {(lesson.isFreePreview || lesson.isPublicPreview) ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Xem thử miễn phí
              </span>
            ) : null}
            {(lesson.videoPartCount ?? 0) > 1 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {lesson.videoPartCount} phần video
              </span>
            ) : null}
            {lesson.hasTheory ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                Lý thuyết
              </span>
            ) : null}
            {(lesson.vocabCount ?? 0) > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                {lesson.vocabCount} từ vựng
              </span>
            ) : null}
            {(lesson.formulaCount ?? 0) > 0 ? (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                {lesson.formulaCount} công thức
              </span>
            ) : null}
            {(lesson.fileCount ?? 0) > 0 ? (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                {lesson.fileCount} tài liệu
              </span>
            ) : null}
            {(lesson.quizCount ?? 0) > 0 ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {lesson.quizCount} quiz
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {lesson.durationSeconds > 0 ? (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <FiClock /> {Math.max(1, Math.ceil(lesson.durationSeconds / 60))} phút
          </span>
        ) : null}
        {canOpen ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/60 dark:text-indigo-300">
            {lesson.isLocked && !(lesson.isFreePreview || lesson.isPublicPreview) ? <FiLock /> : <FiPlayCircle />}
            {(lesson.isFreePreview || lesson.isPublicPreview) && lesson.isLocked
              ? 'Học thử'
              : lesson.isLocked
                ? 'Xem trạng thái'
                : 'Vào học'}
          </span>
        ) : (
          <FiLock aria-label="Bài học bị khóa" className="text-slate-400 dark:text-slate-500" />
        )}
      </div>
    </>
  );

  if (canOpen && courseSlug) {
    return (
      <Link
        href={lessonHref}
        className="group flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5 text-sm transition first:border-t-0 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-800/60 sm:px-5"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5 text-sm first:border-t-0 dark:border-slate-800 sm:px-5">
      {inner}
    </div>
  );
}
