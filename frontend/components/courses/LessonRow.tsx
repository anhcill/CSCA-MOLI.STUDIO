import type { CurriculumLessonDto } from '@/lib/types/courses';

export function LessonRow({ lesson }: { lesson: CurriculumLessonDto }) {
  return <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-sm"><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{lesson.title}</p><p className="mt-1 text-xs text-slate-500">{lesson.lessonType}{lesson.isFreePreview ? ' · Xem thử' : ''}</p></div><span className="shrink-0 text-slate-500">{Math.ceil(lesson.durationSeconds / 60)} phút</span></div>;
}
